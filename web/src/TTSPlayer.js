import * as ort from 'onnxruntime-web';
import { get, set } from 'idb-keyval';

const MODEL_URL = 'https://huggingface.co/backtracking/tiny-tts/resolve/main/tinytts.onnx';
const MODEL_CACHE_KEY = 'tinytts-onnx-model';
const SAMPLE_RATE = 44100;

// Encode Float32 audio samples as a WAV ArrayBuffer (PCM 16-bit, mono)
function float32ToWav(samples, sampleRate) {
  const len = samples.length;
  const buf = new ArrayBuffer(44 + len * 2);
  const v = new DataView(buf);
  const w = (off, s) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + len * 2, true);
  w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, len * 2, true);
  let off = 44;
  for (let i = 0; i < len; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    off += 2;
  }
  return buf;
}

class TTSPlayer {
  constructor() {
    this.session = null;
    this.queue = [];
    this.currentSource = null;
    this.speed = 1.0;
    this.paused = false;
    this.speaking = false;
    this.modelLoaded = false;
    this.destroyed = false;
    this.modelDownloadAbort = null;

    this.volume = 0.5;

    this.onQueueChange = null;
    this.onModelProgress = null;
    this.onModelLoaded = null;
    this.onError = null;
  }

  async init(speed) {
    this.speed = speed || 1.0;
    this.destroyed = false;
    await this.loadModel();
  }

  // Load ONNX model from IndexedDB cache or download from HuggingFace
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

  // Stream-download the ONNX model with progress tracking
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
      length_scale: new ort.Tensor('float32', [1.0], [1]),
    };

    const results = await this.session.run(feeds);
    await this.playAudio(results.audio.data);
  }

  // Scale samples down and play through an <audio> element (bypasses iOS mute switch)
  async playAudio(samples) {
    return new Promise((resolve) => {
      if (this.destroyed) return resolve();

      const wav = float32ToWav(samples, SAMPLE_RATE);
      const blob = new Blob([wav], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      const el = document.createElement('audio');
      el.setAttribute('playsinline', '');
      el.preservesPitch = true;
      el.webkitPreservesPitch = true;
      el.src = url;
      el.playbackRate = this.speed;
      el.volume = this.volume;
      this.currentSource = el;

      el.onended = () => {
        URL.revokeObjectURL(url);
        this.currentSource = null;
        resolve();
      };

      el.play().catch(() => {
        URL.revokeObjectURL(url);
        this.currentSource = null;
        resolve();
      });
    });
  }

  setSpeed(speed) {
    this.speed = speed;
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(100, v)) / 100;
  }

  pause() {
    this.paused = true;
    if (this.currentSource) {
      this.currentSource.pause();
    }
  }

  resume() {
    this.paused = false;
    if (this.currentSource && this.currentSource.paused) {
      this.currentSource.play().catch(() => {});
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
      this.currentSource.pause();
      this.currentSource.src = '';
      this.currentSource = null;
    }

    if (this.modelDownloadAbort) {
      this.modelDownloadAbort.abort();
      this.modelDownloadAbort = null;
    }

    this.session = null;
    this.modelLoaded = false;
  }
}

export default TTSPlayer;
