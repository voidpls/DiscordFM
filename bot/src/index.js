import { Client, GatewayIntentBits, PermissionFlagsBits, ChannelType } from 'discord.js';
import { createRequire } from 'module';
import { getPhonemeIds } from './g2p.js';

const require = createRequire(import.meta.url);
const config = require('../../config.js');

const { discordToken, serverId, viewAsRoleId, port, ttsMaxChars } = config;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const API_BASE = `http://127.0.0.1:${port}`;

// Resolve the best display name for a user, falling back through nickname > global name > username
function formatDisplayName(member) {
  return member?.nickname ?? member?.user?.globalName ?? member?.user?.username ?? 'Unknown';
}

// Resolve user/role/channel mentions in message content while preserving custom emoji format
function formatContent(message) {
  let text = message.content || '';
  text = text.replace(/<@!?(\d+)>/g, (_, id) => {
    const member = message.guild?.members.cache.get(id);
    if (member) return `@${formatDisplayName(member)}`;
    const user = message.client?.users.cache.get(id);
    return user ? `@${user.displayName}` : `@unknown`;
  });
  text = text.replace(/<#(\d+)>/g, (_, id) => {
    const ch = message.guild?.channels.cache.get(id);
    return ch ? `#${ch.name}` : `#unknown`;
  });
  text = text.replace(/<@&(\d+)>/g, (_, id) => {
    const role = message.guild?.roles.cache.get(id);
    return role ? `@${role.name}` : `@unknown`;
  });
  return text;
}

// Build the full message payload sent to the API, including pre-computed phoneme IDs
function formatMessagePayload(message) {
  const raw = formatContent(message);
  const clean = message.cleanContent || raw;
  let g2pInput = clean;
  if (g2pInput.length > ttsMaxChars) {
    const cutoff = g2pInput.lastIndexOf(' ', ttsMaxChars);
    g2pInput = cutoff > 0 ? g2pInput.slice(0, cutoff) : g2pInput.slice(0, ttsMaxChars);
  }
  let phonemes = null;
  try {
    phonemes = getPhonemeIds(g2pInput);
  } catch (err) {
    console.error('[bot] G2P error:', err.message);
  }
  return {
    id: message.id,
    channelId: message.channelId,
    displayName: formatDisplayName(message.member),
    username: message.author.username,
    content: raw,
    phonemes,
    attachments: message.attachments.map(a => ({ url: a.url })),
    stickers: (message.stickers || []).map(s => ({ name: s.name, url: s.url })),
    timestamp: message.createdAt.toISOString(),
  };
}

// Send a POST request to the API with the given path and body, logging errors without crashing
async function postToApi(path, body) {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error(`[bot] POST ${path} returned ${res.status}`);
    }
  } catch (err) {
    console.error(`[bot] Failed to POST ${path}:`, err.message);
  }
}

// Try to push a channel list to the API, retrying a few times if the API isn't ready yet
async function pushChannelsWithRetry(guild, retries = 5, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`${API_BASE}/api/channels`, {
        method: 'GET',
      });
      if (res.ok) {
        await pushChannels(guild);
        return;
      }
    } catch {}
    if (i < retries - 1) {
      console.log(`[bot] API not ready, retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  console.error(`[bot] Could not reach API after ${retries} attempts`);
}

// Filter and send the visible text channels to the API so the web client can show them
async function pushChannels(guild) {
  const isEveryone = !viewAsRoleId || viewAsRoleId === 'everyone' || viewAsRoleId === serverId;

  let channelFilter;
  if (isEveryone) {
    channelFilter = c => c.type === ChannelType.GuildText && !c.isThread();
  } else {
    const role = await guild.roles.fetch(viewAsRoleId);
    if (!role) {
      console.error(`[bot] Role ${viewAsRoleId} not found`);
      return;
    }
    channelFilter = c =>
      c.type === ChannelType.GuildText &&
      !c.isThread() &&
      c.permissionsFor(role).has(PermissionFlagsBits.ViewChannel);
  }

  const channels = guild.channels.cache
    .filter(channelFilter)
    .map(c => ({ id: c.id, name: c.name }));

  await postToApi('/api/channels', {
    channels,
    serverName: guild.name,
    serverIcon: guild.iconURL({ size: 128 }) || '',
  });

  console.log(`[bot] Pushed ${channels.length} channels to API`);
}

client.on('clientReady', async () => {
  console.log(`[bot] Logged in as ${client.user.tag}`);
  const guild = client.guilds.cache.get(serverId);
  if (!guild) {
    console.error(`[bot] Guild ${serverId} not found`);
    return;
  }
  await pushChannelsWithRetry(guild);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (message.system) return;
  if (message.guildId !== serverId) return;

  await postToApi('/api/message', formatMessagePayload(message));
});

client.on('error', console.error);
client.on('shardError', console.error);

export { formatDisplayName, formatMessagePayload, pushChannels };

if (!process.env.VITEST) {
  client.login(discordToken);
}
