# DiscordFM

A Discord server that speaks.

Connects a bot to your server, streams messages into a browser radio, and reads each one aloud using local AI voice synthesis. No cloud TTS. No telemetry.

## Quick start

```bash
cp .env.example .env   # add DISCORD_TOKEN, DISCORD_SERVER_ID
npm install
npm run start           # production: builds web, starts bot + API
pm2 start npm --name discordfm -- start  # recommended: auto-restart on crash
```

Open `http://localhost:3000` (configurable via `PORT`). Use a reverse proxy for production traffic.

## How it works

1. **Bot** listens for messages, resolves mentions and emojis, then runs G2P to produce phoneme IDs.
2. **API** streams both the raw message (for chat display) and pre-computed phonemes (for TTS) via SSE.
3. **Web** renders the chat feed and feeds phonemes into an ONNX model running in-browser to generate speech.

| Layer | What it does |
|---|---|
| `bot/` | Discord.js v14 listener, G2P pipeline (CMU dict + neural fallback) |
| `api/` | Hono SSE relay, in-memory message buffer |
| `web/` | Svelte 5 + onnxruntime-web radio UI |

The TTS model (~6 MB) is downloaded once and cached in IndexedDB. G2P runs server-side — no heavy models loaded in the browser beyond the core TTS model.

## Configuration

```
DISCORD_TOKEN=           # Bot token (required)
DISCORD_SERVER_ID=       # Guild ID
VIEW_AS_ROLE_ID=everyone # Role for channel visibility
OVERRIDE_DEFAULT_CHANNEL_ID=  # Skip auto-detect, pick a specific channel
PORT=3000                # Production server port
TTS_MAX_CHARS=250        # TTS input character limit
```

## Development

```bash
npm test       # All tests (Bot + API + Web)
npm run dev    # bot + API + web (concurrently)
```

Built with [Svelte](https://svelte.dev), [Hono](https://hono.dev), [Discord.js](https://discord.js.org), and [TinyTTS](https://github.com/tronghieuit/tiny-tts).
