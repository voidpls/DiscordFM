<script>
  import { onMount, onDestroy } from 'svelte';
  import RadioHeader from './RadioHeader.svelte';
  import PlayButton from './PlayButton.svelte';
  import SpeedControl from './SpeedControl.svelte';

  import ChannelSelect from './ChannelSelect.svelte';
  import Chat from './Chat.svelte';
  import QueueCounter from './QueueCounter.svelte';
  import DownloadProgress from './DownloadProgress.svelte';
  import TTSPlayer from './TTSPlayer.js';

  let messages = $state([]);
  let channels = $state([]);
  let serverInfo = $state({ serverName: '', serverIcon: '' });
  let connected = $state(false);
  let currentChannel = $state('');
  let speed = $state(1.5);
  let playing = $state(false);
  let queueLength = $state(0);
  let modelLoading = $state(false);
  let modelDownloading = $state(false);
  let modelProgress = $state(0);
  let overrideDefaultChannelId = $state('');

  let eventSource = $state(null);
  let tts = $state(null);

  onMount(async () => {
    try {
      const [configRes, channelsRes] = await Promise.all([
        fetch('/api/config'),
        fetch('/api/channels'),
      ]);
      if (configRes.ok) {
        const cfg = await configRes.json();
        overrideDefaultChannelId = cfg.overrideDefaultChannelId || '';
      }
      if (channelsRes.ok) {
        const data = await channelsRes.json();
        if (data.channels) channels = data.channels;
        if (data.serverName) {
          serverInfo = { serverName: data.serverName, serverIcon: data.serverIcon || '' };
        }
      }
    } catch (e) {
      console.warn('[App] Failed to fetch config/channels:', e.message);
    }

    if (!tts) {
      tts = new TTSPlayer();
      tts.onQueueChange = (n) => { queueLength = n; };
      tts.onModelProgress = (p) => {
        if (p >= 0) { modelDownloading = true; modelProgress = p; modelLoading = false; }
      };
      tts.onModelLoaded = () => { modelDownloading = false; modelLoading = false; };
      tts.onError = (err) => {
        console.error('[App] TTS error:', err);
        modelDownloading = false;
        modelLoading = false;
      };
    }
  });

  onDestroy(() => {
    closeEventSource();
    if (tts) {
      tts.destroy();
      tts = null;
    }
  });

  // Tear down the current SSE connection and mark disconnected
  function closeEventSource() {
    if (eventSource) {
      eventSource.onopen = null;
      eventSource.onmessage = null;
      eventSource.onerror = null;
      eventSource.close();
      eventSource = null;
    }
    connected = false;
  }

  // Open an SSE stream to the API for the given channel, handling init and message events
  function connectSSE(channelId) {
    closeEventSource();

    if (!channelId) return;

    const url = `/events?channel=${encodeURIComponent(channelId)}`;
    const es = new EventSource(url);
    eventSource = es;

    es.onopen = () => {
      connected = true;
    };

    es.addEventListener('init', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.channels) channels = data.channels;
        if (data.serverName !== undefined) {
          serverInfo = { serverName: data.serverName, serverIcon: data.serverIcon || '' };
        }
        if (data.messages) messages = data.messages;
        connected = true;
      } catch (err) {
        console.error('[App] Failed to parse init event:', err);
      }
    });

    es.addEventListener('message', (e) => {
      try {
        const msg = JSON.parse(e.data);
        messages = [...messages, msg];
        if (playing && tts && msg.channelId === currentChannel && msg.phonemes) {
          tts.speakPhonemes(msg.phonemes);
        }
      } catch (err) {
        console.error('[App] Failed to parse message event:', err);
      }
    });

    es.onerror = () => {
      connected = false;
    };
  }

  // Switch to a different channel, clearing messages and reconnecting SSE
  function selectChannel(id) {
    if (id === currentChannel) return;
    currentChannel = id;
    messages = [];
    connected = false;
    connectSSE(id);
  }

  // Toggle play/pause — initializes TTS on first play (triggers model download if needed)
  async function handleToggle() {
    if (!tts) return;

    if (!playing) {
      if (!tts.modelLoaded) {
        modelLoading = true;
      }
      try {
        await tts.init(speed);
        modelLoading = false;
        playing = true;
        tts.resume();
      } catch (err) {
        console.error('[App] TTS init failed:', err);
        modelLoading = false;
        playing = false;
      }
    } else {
      playing = false;
      tts.pause();
    }
  }

  function handleSetSpeed(s) {
    speed = s;
    if (tts) tts.setSpeed(s);
  }

  // Switch channel and clear the TTS queue so old channel audio doesn't carry over
  function handleSelectChannel(id) {
    if (tts) {
      tts.queue = [];
      queueLength = 0;
    }
    selectChannel(id);
  }
</script>

<RadioHeader
  serverName={serverInfo.serverName}
  serverIcon={serverInfo.serverIcon}
  {connected}
/>

<div class="controls-row">
  <PlayButton playing={playing} ontoggle={handleToggle} />
  <SpeedControl speed={speed} onsetspeed={handleSetSpeed} />
</div>

<DownloadProgress
  progress={modelProgress}
  downloading={modelDownloading}
  loading={modelLoading}
/>

<ChannelSelect
  {channels}
  currentChannel={currentChannel}
  onselectchannel={handleSelectChannel}
  overrideDefaultChannelId={overrideDefaultChannelId}
/>

<QueueCounter queueLength={queueLength} />

<Chat {messages} {currentChannel} />

<style>
  .controls-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 0;
    flex-wrap: wrap;
  }
</style>
