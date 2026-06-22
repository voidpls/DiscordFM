<script>
  let { queueLength = 0 } = $props();
</script>

{#if queueLength > 0}
  <div class="queue-counter" class:warning={queueLength > 5}>
    Messages queued: {queueLength}
  </div>
{/if}

<style>
  .queue-counter {
    font-size: 0.75rem;
    color: var(--text-muted);
    text-align: center;
    padding: 4px 0;
  }

  .queue-counter.warning {
    color: var(--warning);
    font-weight: 600;
  }
</style>
