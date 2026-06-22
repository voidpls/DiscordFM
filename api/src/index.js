import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { streamSSE } from 'hono/streaming';
import { serveStatic } from '@hono/node-server/serve-static';
import { createRequire } from 'module';
import { state } from './state.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '../..');

const cachedHtml = (() => {
  try { return readFileSync(join(projectRoot, 'web/dist/index.html'), 'utf-8'); }
  catch { return '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>DiscordFM</title></head><body></body></html>'; }
})();

const require = createRequire(import.meta.url);
const config = require('../../config.js');

const { port } = config;

const app = new Hono();
// Track active SSE connections per channel so new messages are pushed to the right clients
const subscribers = new Map();

app.use('*', cors());

// SSE endpoint — sends init payload on connect, then streams new messages as they arrive
app.get('/events', (c) => {
  const channelId = c.req.query('channel') || '';
  const allowed = state.getChannels().some(ch => ch.id === channelId);
  if (!allowed) {
    return c.json({ error: 'Channel not available' }, 403);
  }

  return streamSSE(c, async (stream) => {
    stream.onAbort(() => {
      cleanupSubscriber(channelId, stream);
    });

    let subs = subscribers.get(channelId);
    if (!subs) {
      subs = new Set();
      subscribers.set(channelId, subs);
    }
    subs.add(stream);

    await stream.writeSSE({
      event: 'init',
      data: JSON.stringify({
        channels: state.getChannels(),
        ...state.getServerInfo(),
        messages: state.getMessages(channelId),
      }),
    });

    // Keep the stream open indefinitely — the connection stays alive until the client disconnects
    await new Promise(() => {});
  });
});

function cleanupSubscriber(channelId, stream) {
  const subs = subscribers.get(channelId);
  if (subs) {
    subs.delete(stream);
    if (subs.size === 0) subscribers.delete(channelId);
  }
}

// Push an event to all subscribers watching a given channel
async function broadcast(channelId, event, data) {
  const subs = subscribers.get(channelId);
  if (!subs) return;
  const payload = JSON.stringify(data);
  for (const stream of subs) {
    try {
      await stream.writeSSE({ event, data: payload });
    } catch {
      cleanupSubscriber(channelId, stream);
    }
  }
}

function validateMessage(body) {
  const required = ['id', 'channelId', 'displayName', 'username', 'content'];
  for (const field of required) {
    if (typeof body[field] !== 'string') {
      return `Missing or invalid field: ${field}`;
    }
  }
  return null;
}

app.post('/api/message', async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  const err = validateMessage(body);
  if (err) return c.json({ error: err }, 400);

  body.attachments = Array.isArray(body.attachments) ? body.attachments : [];
  body.timestamp = body.timestamp || new Date().toISOString();

  state.addMessage(body);
  await broadcast(body.channelId, 'message', body);

  return c.json({ ok: true });
});

app.post('/api/channels', async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  const { channels, serverName, serverIcon } = body;

  if (!Array.isArray(channels)) {
    return c.json({ error: 'channels must be an array' }, 400);
  }

  state.setChannels(channels, serverName || '', serverIcon || '');

  for (const [channelId] of subscribers) {
    await broadcast(channelId, 'init', {
      channels: state.getChannels(),
      ...state.getServerInfo(),
      messages: state.getMessages(channelId),
    });
  }

  return c.json({ ok: true });
});

app.get('/api/channels', (c) => {
  return c.json({
    channels: state.getChannels(),
    ...state.getServerInfo(),
  });
});

app.get('/api/config', (c) => {
  return c.json({
    overrideDefaultChannelId: config.overrideDefaultChannelId,
  });
});

// Serve the root HTML with dynamic OG tags based on the current server state
app.get('/', (c) => {
  let html = cachedHtml;
  const { serverName, serverIcon } = state.getServerInfo();
  if (serverName) {
    html = html.replace(
      /property="og:description"\s+content="[^"]*"/,
      `property="og:description" content="Live [${serverName}] TTS radio."`
    );
  }
  if (serverIcon) {
    html = html.replace(
      /property="og:image"\s+content="[^"]*"/,
      `property="og:image" content="${serverIcon}"`
    );
  }
  return c.html(html);
});

app.use('*', serveStatic({ root: join(projectRoot, 'web/dist') }));

export { app };

if (!process.env.VITEST) {
  serve({ fetch: app.fetch, port, hostname: '127.0.0.1' });
  console.log(`[api] Listening on http://127.0.0.1:${port}`);
}
