import * as ort from 'onnxruntime-web';
import { get, set } from 'idb-keyval';

const MODEL_URL = 'https://huggingface.co/backtracking/tiny-tts/resolve/main/tinytts.onnx';
const MODEL_CACHE_KEY = 'tinytts-onnx-model';
const SAMPLE_RATE = 44100;

class TTSPlayer {
  constructor() {
    this.audioContext = null;
    this.session = null;
    this.queue = [];
    this.currentSource = null;
    this.speed = 1.0;
    this.paused = false;
    this.speaking = false;
    this.modelLoaded = false;
    this.destroyed = false;
    this.modelDownloadAbort = null;

    this.onQueueChange = null;
    this.onModelProgress = null;
    this.onModelLoaded = null;
    this.onError = null;
  }

  async init(speed) {
    this.speed = speed || 1.0;
    this.destroyed = false;

    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    await this.loadModel();
  }

  async loadModel() {
    if (this.session && this.modelLoaded) return;

    let modelData;
    const cached = await get(MODEL_CACHE_KEY);
    if (cached) {
      modelData = cached;
    } else {
      modelData = await this.downloadModel();
      try {
        await set(MODEL_CACHE_KEY, modelData);
      } catch (e) {
        console.warn('[TTSPlayer] Failed to cache model:', e.message);
      }
    }

    this.session = await ort.InferenceSession.create(modelData, {
      executionProviders: ['wasm'],
    });

    this.modelLoaded = true;
    if (this.onModelLoaded) this.onModelLoaded();
  }

  async downloadModel() {
    const controller = new AbortController();
    this.modelDownloadAbort = controller;

    const response = await fetch(MODEL_URL, {
      signal: controller.signal,
      headers: { 'User-Agent': 'DiscordFM/1.0' },
    });

    if (!response.ok) throw new Error(`Model download failed: HTTP ${response.status}`);

    const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
    const reader = response.body.getReader();
    const chunks = [];
    let loaded = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.byteLength;
      if (contentLength > 0 && this.onModelProgress) {
        this.onModelProgress(Math.round((loaded / contentLength) * 100));
      } else if (this.onModelProgress) {
        this.onModelProgress(-1);
      }
    }

    if (this.onModelProgress) this.onModelProgress(100);

    const blob = new Blob(chunks, { type: 'application/octet-stream' });
    return await blob.arrayBuffer();
  }

  // Queue pre-computed phoneme IDs for speech and start processing if idle
  speakPhonemes(phonemes) {
    if (this.destroyed) return;
    if (!phonemes || !phonemes.phoneIds) return;
    this.queue.push(phonemes);
    if (this.onQueueChange) this.onQueueChange(this.queue.length);
    if (!this.speaking && !this.paused) {
      this.processNext();
    }
  }

  // Process items one at a time — calls itself recursively after each utterance finishes
  async processNext() {
    if (this.destroyed || this.paused || this.queue.length === 0) {
      this.speaking = false;
      return;
    }

    this.speaking = true;

    const { phoneIds, toneIds, langIds } = this.queue.shift();
    if (this.onQueueChange) this.onQueueChange(this.queue.length);

    try {
      await this.synthesize(phoneIds, toneIds, langIds);
    } catch (err) {
      console.error('[TTSPlayer] Synthesis error:', err);
      if (this.onError) this.onError(err);
    }

    if (!this.destroyed && !this.paused) {
      await this.processNext();
    } else {
      this.speaking = false;
    }
  }

  // Run the TinyTTS ONNX model and play the resulting audio
  async synthesize(phoneIds, toneIds, langIds) {
    const seqLen = phoneIds.length;
    // bert and ja_bert are unused by the model but are required inputs — pass zero-filled tensors
    const feeds = {
      x: new ort.Tensor('int64', BigInt64Array.from(phoneIds.map(v => BigInt(v))), [1, seqLen]),
      x_lengths: new ort.Tensor('int64', [BigInt(seqLen)], [1]),
      sid: new ort.Tensor('int64', [BigInt(0)], [1]),
      tone: new ort.Tensor('int64', BigInt64Array.from(toneIds.map(v => BigInt(v))), [1, seqLen]),
      language: new ort.Tensor('int64', BigInt64Array.from(langIds.map(v => BigInt(v))), [1, seqLen]),
      bert: new ort.Tensor('float32', new Float32Array(seqLen * 1024), [1, 1024, seqLen]),
      ja_bert: new ort.Tensor('float32', new Float32Array(seqLen * 768), [1, 768, seqLen]),
      noise_scale: new ort.Tensor('float32', [0.667], [1]),
      noise_scale_w: new ort.Tensor('float32', [0.8], [1]),
      length_scale: new ort.Tensor('float32', [1.0 / this.speed], [1]),
    };

    const results = await this.session.run(feeds);
    await this.playAudio(results.audio.data);
  }

  // Play raw Float32Array audio samples through the Web Audio API
  async playAudio(samples) {
    return new Promise((resolve) => {
      if (this.destroyed) return resolve();

      const audioBuffer = this.audioContext.createBuffer(1, samples.length, SAMPLE_RATE);
      audioBuffer.getChannelData(0).set(samples);

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      this.currentSource = source;

      source.onended = () => {
        this.currentSource = null;
        resolve();
      };

      source.start(0);
    });
  }

  setSpeed(speed) {
    this.speed = speed;
  }

  pause() {
    this.paused = true;
    if (this.audioContext && this.audioContext.state === 'running') {
      this.audioContext.suspend();
    }
  }

  resume() {
    this.paused = false;
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    if (!this.speaking && this.queue.length > 0) {
      this.processNext();
    }
  }

  get queueLength() {
    return this.queue.length;
  }

  get isSpeaking() {
    return this.speaking;
  }

  destroy() {
    this.destroyed = true;
    this.queue = [];
    this.speaking = false;

    if (this.currentSource) {
      try { this.currentSource.stop(); } catch (e) {}
      this.currentSource = null;
    }

    if (this.modelDownloadAbort) {
      this.modelDownloadAbort.abort();
      this.modelDownloadAbort = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.session = null;
    this.modelLoaded = false;
  }
}

export default TTSPlayer;
