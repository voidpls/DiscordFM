import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  server: {
    proxy: {
      '/events': 'http://127.0.0.1:3000',
      '/api': 'http://127.0.0.1:3000',
    },
  },
});
