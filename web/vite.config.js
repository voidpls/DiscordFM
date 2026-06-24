import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    conditions: ['browser', 'module', 'import', 'onnxruntime-web-use-extern-wasm'],
  },
  server: {
    proxy: {
      '/events': 'http://127.0.0.1:3000',
      '/api': 'http://127.0.0.1:3000',
    },
  },
});
