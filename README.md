# DiscordFM

A Discord server that speaks.

**DiscordFM** connects a bot to your server, streams messages into a browser-based radio, and reads each one aloud using local AI voice synthesis. No cloud TTS. No telemetry. No data leaves your machine.

---

## Getting Started

```bash
cp .env.example .env
```

You'll need a **bot token** from the [Discord Developer Portal](https://discord.com/developers/applications), your **server ID**, and optionally a **role ID** to control which channels are visible (omit for @everyone).

```bash
npm install
npm run build -w web
npm run dev
```

Open **`http://localhost:3000`**.

---

## How It Works

1. A **Discord bot** listens for messages and forwards them to a local API.
2. The **API** streams messages to the browser via SSE and keeps a short in-memory buffer.
3. The **web app** displays a real-time chat feed and speaks messages one at a time using **ONNX-powered TTS** inside your browser.

| Layer | What it does |
|---|---|
| `bot/` | Discord.js v14 — message listener, channel filtering |
| `api/` | Hono + SSE — message relay, static file server |
| `web/` | Svelte 5 + onnxruntime-web — radio UI, local TTS inference |

The TTS model (~6 MB) is downloaded once and cached in your browser's IndexedDB. Subsequent loads are instant.

---

## Configuration

| Variable | Purpose |
|---|---|
| `DISCORD_TOKEN` | Bot token (required) |
| `DISCORD_SERVER_ID` | Your Discord guild ID |
| `VIEW_AS_ROLE_ID` | Role for channel visibility filtering |
| `OVERRIDE_DEFAULT_CHANNEL_ID` | Skip auto-detect, pick a specific default channel |

---

## Development

```bash
npm test      # Bot and API tests (Vitest)
npm run dev   # Starts bot + API concurrently
```

---

Built with [Svelte](https://svelte.dev), [Hono](https://hono.dev), [Discord.js](https://discord.js.org), and [TinyTTS](https://github.com/tronghieuit/tiny-tts).
