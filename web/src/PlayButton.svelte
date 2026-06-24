<script>
  let { playing = false, loading = false, ontoggle } = $props();

  function handleClick() {
    if (!loading) ontoggle?.();
  }
</script>

<button class="play-btn" class:active={playing} class:loading disabled={loading} onclick={handleClick}>
  <span class="icon">{playing ? '\u23F8' : '\u25B6'}</span>
  <span class="label">{playing ? 'Pause' : 'Play'}</span>
</button>

<style>
  .play-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 16px;
    height: 30px;
    font-size: 0.85rem;
    border-radius: var(--radius);
    background: var(--accent);
    border: 1px solid var(--accent);
    color: #fff;
  }

  .play-btn:hover {
    background: var(--accent-hover);
    border-color: var(--accent-hover);
  }

  .play-btn.active {
    background: transparent;
    border-color: var(--accent);
    color: var(--accent);
  }

  .play-btn.loading {
    opacity: 0.5;
    cursor: default;
  }

  .play-btn.loading:hover {
    background: var(--accent);
    border-color: var(--accent);
  }

  .icon {
    font-size: 0.85rem;
    line-height: 1;
  }

  .label {
    font-size: 0.8rem;
    font-weight: 600;
  }
</style>
