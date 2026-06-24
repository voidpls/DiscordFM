# DiscordFM

A Discord server that speaks.

Stream Discord messages into a browser radio, using local AI voice synthesis. No external APIs or cloud services.

## Getting started

```bash
cp .env.example .env # add DISCORD_TOKEN, DISCORD_SERVER_ID
npm install
npm run start
# OR via PM2 (recommended):
pm2 start npm --name discordfm -- start
```

Default Website/API port: `3000`

## How it works
#### Text-to-Speech Pipeline
1. **Bot** resolves mentions and emojis, then converts text to phoneme IDs using a CMU Pronouncing Dictionary lookup with a neural G2P fallback.
2. **API** streams each message and its pre-computed phonemes to the browser via Server-Sent Events.
3. **Web** feeds phonemes into a TinyTTS ONNX model running locally in the browser to synthesize speech.

Tiny footprint: TinyTTS model (half-precision FP8, ~3.5 MB) and ONNX Runtime (~13 MB, ~3 MB compressed). G2P runs server-side on new messages.

| Layer | Role | Stack |
|---|---|---|
| `bot/` | Text → phonemes | Discord.js, CMU dict, TinyTTS G2P |
| `api/` | Message relay | Hono, SSE |
| `web/` | Phonemes → speech | Svelte 5, ONNX Runtime Web |


## Configuration (.env)

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
npm test       # All tests (Bot + API)
npm run dev    # bot + API + web (concurrently)
```

Built with [Svelte](https://svelte.dev), [Hono](https://hono.dev), [Discord.js](https://discord.js.org), and [TinyTTS](https://github.com/tronghieuit/tiny-tts).
