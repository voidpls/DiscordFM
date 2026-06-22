// DiscordFM Configuration
// Copy .env.example to .env and fill in values.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

module.exports = {
  // Discord bot token from https://discord.com/developers/applications
  discordToken: process.env.DISCORD_TOKEN,

  // Discord server (guild) ID to connect to
  serverId: process.env.DISCORD_SERVER_ID || "",

  // Role ID used to filter visible channels.
  // Set to "everyone" or the server's @everyone role ID (same as serverId) to show all channels.
  // Set to a specific role ID to only show channels visible to that role.
  viewAsRoleId: process.env.VIEW_AS_ROLE_ID || "",

  // Override the default channel auto-detection (fuzzy search).
  // If set, this channel ID is selected instead of the fuzzy match result.
  overrideDefaultChannelId: process.env.OVERRIDE_DEFAULT_CHANNEL_ID || "",

  // Server port (API + static web files in production, default 3000)
  port: parseInt(process.env.PORT || "3000", 10),
};
