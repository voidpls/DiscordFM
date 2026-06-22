<script>
  let { speed = 1.0, onsetspeed } = $props();

  const speeds = [1.0, 1.25, 1.5, 1.75, 2.0, 3.0];

  function handleClick(s) {
    onsetspeed?.(s);
  }
</script>

<div class="speed-control">
  <span class="label">Speed</span>
  <div class="buttons">
    {#each speeds as s}
      <button
        class={speed === s ? 'active' : ''}
        onclick={() => handleClick(s)}
      >
        {s}x
      </button>
    {/each}
  </div>
</div>

<style>
  .speed-control {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .label {
    font-size: 0.8rem;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .buttons {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .buttons button {
    padding: 4px 0;
    height: 30px;
    width: 48px;
    font-size: 0.75rem;
    text-align: center;
  }
</style>
