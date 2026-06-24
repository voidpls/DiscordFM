import * as ort from 'onnxruntime-web/wasm';
import { get, set } from 'idb-keyval';

const MODEL_URL = 'https://huggingface.co/backtracking/tiny-tts/resolve/main/tinytts_fp16.onnx';
const MODEL_CACHE_KEY = 'tinytts-onnx-model';
const WASM_CACHE_KEY = 'onnx-wasm-binary';
const WASM_URL = '/onnx-wasm.wasm';
const SAMPLE_RATE = 44100;

// Convert float32 value to 16-bit half-precision bit pattern
function f32ToF16Bits(val) {
  const buf = new ArrayBuffer(4);
  new Float32Array(buf)[0] = val;
  const bits = new Uint32Array(buf)[0];
  const sign = (bits >> 16) & 0x8000;
  const exp = (bits >> 23) & 0xFF;
  const mant = bits & 0x7FFFFF;
  if (exp === 0) return sign;
  if (exp === 0xFF) return sign | 0x7C00 | (mant !== 0 ? 0x0200 : 0);
  const newExp = exp - 112;
  if (newExp > 30) return sign | 0x7C00;
  if (newExp < 1) return sign;
  return sign | (newExp << 10) | (mant >> 13);
}

// Decode 16-bit half-precision bit pattern to float32
function f16ToF32(u16) {
  const sign = (u16 >> 15) & 1;
  const exp = (u16 >> 10) & 0x1F;
  const mant = u16 & 0x3FF;
  if (exp === 0) return (sign ? -1 : 1) * Math.pow(2, -14) * (mant / 1024);
  if (exp === 31) return mant ? NaN : (sign ? -Infinity : Infinity);
  return (sign ? -1 : 1) * Math.pow(2, exp - 15) * (1 + mant / 1024);
}

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
    this.audioEl = null;

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

  // Load ONNX model and WASM runtime from cache or download in parallel
  async loadModel() {
    if (this.session && this.modelLoaded) return;

    const modelPromise = (async () => {
      const cached = await get(MODEL_CACHE_KEY);
      if (cached) return { data: cached, total: cached.byteLength, cached: true };
      const data = await this.downloadModel();
      return { data, total: data.byteLength, cached: false };
    })();

    const wasmPromise = this.getWasmBinary();

    const [modelResult, wasmResult] = await Promise.all([modelPromise, wasmPromise]);

    if (!modelResult.cached) {
      try { await set(MODEL_CACHE_KEY, modelResult.data); }
      catch (e) { console.warn('[TTSPlayer] Failed to cache model:', e.message); }
    }
    if (!wasmResult.cached) {
      try { await set(WASM_CACHE_KEY, wasmResult.data); }
      catch (e) { console.warn('[TTSPlayer] Failed to cache WASM:', e.message); }
    }

    ort.env.wasm.wasmPaths = { mjs: '/onnx-wasm.mjs', wasm: '/onnx-wasm.wasm' };
    ort.env.wasm.wasmBinary = wasmResult.data;

    this.session = await ort.InferenceSession.create(modelResult.data, {
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

  // Load ONNX Runtime WASM binary from IndexedDB cache or download
  async getWasmBinary() {
    const cached = await get(WASM_CACHE_KEY);
    if (cached) return { data: cached, total: cached.byteLength, cached: true };

    const response = await fetch(WASM_URL);
    if (!response.ok) throw new Error(`WASM download failed: HTTP ${response.status}`);

    const reader = response.body.getReader();
    const chunks = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    const blob = new Blob(chunks, { type: 'application/wasm' });
    const buffer = await blob.arrayBuffer();
    const total = buffer.byteLength;

    try {
      await set(WASM_CACHE_KEY, buffer);
    } catch (e) {
      console.warn('[TTSPlayer] Failed to cache WASM:', e.message);
    }
    return { data: buffer, total, cached: false };
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

    const modelSpeed = Math.min(this.speed, 1.5);
    const lengthScale = 1 / modelSpeed;
    this.playbackRate = this.speed > 1.5 ? this.speed / 1.5 : 1.0;

    // bert and ja_bert are unused by the model but are required inputs — pass zero-filled tensors
    const feeds = {
      x: new ort.Tensor('int64', BigInt64Array.from(phoneIds.map(v => BigInt(v))), [1, seqLen]),
      x_lengths: new ort.Tensor('int64', [BigInt(seqLen)], [1]),
      sid: new ort.Tensor('int64', [BigInt(0)], [1]),
      tone: new ort.Tensor('int64', BigInt64Array.from(toneIds.map(v => BigInt(v))), [1, seqLen]),
      language: new ort.Tensor('int64', BigInt64Array.from(langIds.map(v => BigInt(v))), [1, seqLen]),
      bert: new ort.Tensor('float16', new Uint16Array(seqLen * 1024), [1, 1024, seqLen]),
      ja_bert: new ort.Tensor('float16', new Uint16Array(seqLen * 768), [1, 768, seqLen]),
      noise_scale: new ort.Tensor('float16', new Uint16Array([f32ToF16Bits(0.667)]), [1]),
      noise_scale_w: new ort.Tensor('float16', new Uint16Array([f32ToF16Bits(0.8)]), [1]),
      length_scale: new ort.Tensor('float16', new Uint16Array([f32ToF16Bits(lengthScale)]), [1]),
    };

    const results = await this.session.run(feeds);
    await this.playAudio(results.audio.data);
  }

  // Scale samples down and play through an <audio> element (bypasses iOS mute switch)
  async playAudio(samples) {
    // Ensure float32 audio regardless of model output type
    let f32;
    if (samples instanceof Float32Array) {
      f32 = samples;
    } else if (typeof Float16Array !== 'undefined' && samples instanceof Float16Array) {
      f32 = new Float32Array(samples);
    } else {
      // Uint16Array fallback — raw half-precision bits, decode manually
      f32 = new Float32Array(samples.length);
      for (let i = 0; i < samples.length; i++) f32[i] = f16ToF32(samples[i]);
    }
    return new Promise((resolve) => {
      if (this.destroyed) return resolve();

      const wav = float32ToWav(f32, SAMPLE_RATE);
      const blob = new Blob([wav], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);

      if (!this.audioEl) {
        this.audioEl = document.createElement('audio');
        this.audioEl.setAttribute('playsinline', '');
        this.audioEl.preservesPitch = true;
        this.audioEl.webkitPreservesPitch = true;
      }
      const el = this.audioEl;
      el.src = url;
      el.playbackRate = this.playbackRate;
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

  // Create and authorize a persistent audio element during a user gesture (required for iOS)
  activateAudio() {
    if (this.audioEl || this.destroyed) return;
    const el = document.createElement('audio');
    el.setAttribute('playsinline', '');
    el.preservesPitch = true;
    el.webkitPreservesPitch = true;
    const silent = new Float32Array(Math.floor(SAMPLE_RATE * 0.1));
    const wav = float32ToWav(silent, SAMPLE_RATE);
    const blob = new Blob([wav], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    el.src = url;
    el.play().then(() => URL.revokeObjectURL(url)).catch(() => URL.revokeObjectURL(url));
    this.audioEl = el;
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

    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl.src = '';
      this.audioEl = null;
    }

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
