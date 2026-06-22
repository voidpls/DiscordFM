<script>
  let { serverName = '', serverIcon = '', connected = false } = $props();
</script>

<header class="header">
  <div class="server-info">
    {#if serverIcon}
      <img class="icon" src={serverIcon} alt={serverName} />
    {/if}
    <h1 class="title">{serverName || 'DiscordFM'} Radio</h1>
  </div>
  <div class="status">
    <span class="dot {connected ? 'green' : 'red'}"></span>
    <span class="status-text">{connected ? 'Connected' : 'Disconnected'}</span>
  </div>
</header>

<style>
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 0;
    border-bottom: 1px solid var(--border);
  }

  .server-info {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .icon {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .title {
    font-size: 1.1rem;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--text-name);
  }

  .status {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .dot.green { background: var(--success); }
  .dot.red   { background: var(--danger); }

  .status-text {
    font-size: 0.8rem;
    color: var(--text-muted);
  }
</style>
