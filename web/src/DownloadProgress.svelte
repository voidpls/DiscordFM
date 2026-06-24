<script>
  let { progress = 0, downloading = false, loading = false } = $props();

  let clamped = $derived(Math.max(0, Math.min(100, progress)));

  let bar = $derived.by(() => {
    const filled = Math.round(clamped / 10);
    return '\u2588'.repeat(filled) + '\u2591'.repeat(10 - filled);
  });

  let statusText = $derived(
    downloading
      ? `[${bar}] ${clamped}% — Downloading TTS model...`
      : 'Loading TTS model...'
  );
</script>

{#if downloading || loading}
  <div class="download-progress">
    <span class="spinner" aria-hidden="true">
      <span>⠋</span><span>⠙</span><span>⠹</span><span>⠸</span><span>⠼</span><span>⠴</span><span>⠦</span><span>⠧</span><span>⠇</span><span>⠏</span>
    </span>
    {statusText}
  </div>
{/if}

<style>
  .download-progress {
    font-size: 0.8rem;
    color: var(--text-muted);
    text-align: center;
    padding: 6px 0;
    letter-spacing: 0.5px;
  }

  .spinner {
    position: relative;
    display: inline-block;
    width: 1ch;
    height: 1.2em;
    vertical-align: middle;
    margin-right: 2px;
  }

  .spinner span {
    position: absolute;
    left: 0;
    top: 0;
    opacity: 0;
    animation: spin-frame 1s linear infinite;
  }

  .spinner span:nth-child(1)  { animation-delay: 0s; }
  .spinner span:nth-child(2)  { animation-delay: 0.1s; }
  .spinner span:nth-child(3)  { animation-delay: 0.2s; }
  .spinner span:nth-child(4)  { animation-delay: 0.3s; }
  .spinner span:nth-child(5)  { animation-delay: 0.4s; }
  .spinner span:nth-child(6)  { animation-delay: 0.5s; }
  .spinner span:nth-child(7)  { animation-delay: 0.6s; }
  .spinner span:nth-child(8)  { animation-delay: 0.7s; }
  .spinner span:nth-child(9)  { animation-delay: 0.8s; }
  .spinner span:nth-child(10) { animation-delay: 0.9s; }

  @keyframes spin-frame {
    0%   { opacity: 1; }
    5%   { opacity: 1; }
    10%  { opacity: 0.5; }
    15%  { opacity: 0; }
    100% { opacity: 0; }
  }
</style>
