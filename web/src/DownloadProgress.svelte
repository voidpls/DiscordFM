<script>
  let { progress = 0, downloading = false, loading = false } = $props();

  let clamped = $derived(Math.max(0, Math.min(100, progress)));

  let bar = $derived.by(() => {
    const filled = Math.round(clamped / 10);
    const empty = 10 - filled;
    return '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
  });
</script>

{#if downloading}
  <div class="download-progress">
    <span class="bar">[{bar}] {clamped}%</span>
    <span class="label">Downloading TTS model...</span>
  </div>
{:else if loading}
  <div class="download-progress">
    <span class="label">Loading TTS model...</span>
  </div>
{/if}

<style>
  .download-progress {
    font-size: 0.75rem;
    color: var(--text-muted);
    text-align: center;
    padding: 6px 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .bar {
    letter-spacing: 1px;
  }

  .label {
    font-size: 0.7rem;
    color: var(--text-dim);
  }
</style>
