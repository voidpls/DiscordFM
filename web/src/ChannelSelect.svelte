<script>
  import fuzzysort from 'fuzzysort';

  let {
    channels = [],
    currentChannel = '',
    onselectchannel,
    overrideDefaultChannelId = ''
  } = $props();

  let open = $state(false);
  let search = $state('');
  let selected = $state(false);

  let currentName = $derived(
    channels.find(c => c.id === currentChannel)?.name || ''
  );

  let displayList = $derived.by(() => {
    if (!search) return [...channels].sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity));
    const results = fuzzysort.go(search, channels, { key: 'name', threshold: -10000 });
    return results.map(r => r.obj);
  });

  // Auto-select the best channel on first load: use overrideDefaultChannelId if set,
  // otherwise pick the channel name that best fuzzy-matches ["general", "main", "chat", "lounge"]
  $effect(() => {
    if (selected) return;
    if (!channels.length) return;

    if (overrideDefaultChannelId) {
      const found = channels.find(c => c.id === overrideDefaultChannelId);
      if (found) {
        onselectchannel?.(found.id);
        selected = true;
        return;
      }
    }

    const targets = ['general', 'main', 'chat', 'lounge'];
    let best = null;
    let bestScore = -Infinity;
    for (const ch of channels) {
      let score = 0;
      for (const t of targets) {
        const r = fuzzysort.single(t, ch.name);
        if (r) score += r.score;
      }
      if (score > bestScore) { bestScore = score; best = ch; }
    }
    if (best) { onselectchannel?.(best.id); selected = true; }
  });

  function toggle() {
    open = !open;
    if (open) search = '';
  }

  function select(id) {
    search = '';
    open = false;
    onselectchannel?.(id);
  }
</script>

<div class="channel-select">
  <button class="toggle" onclick={toggle} class:open>
    <span class="toggle-label">{currentName || 'Select channel'}</span>
    <span class="arrow">{open ? '\u25B2' : '\u25BC'}</span>
  </button>

  {#if open}
    <div class="dropdown" role="listbox">
      <input
        type="text"
        placeholder="Search channels..."
        value={search}
        oninput={(e) => { search = e.target.value; }}
      />
      <div class="options">
        {#each displayList as ch}
          <button
            class="option"
            class:active={ch.id === currentChannel}
            onmousedown={() => select(ch.id)}
            role="option"
            aria-selected={ch.id === currentChannel}
          >
            <span class="name">{ch.name}</span>
            {#if ch.id === currentChannel}
              <span class="check">\u2713</span>
            {/if}
          </button>
        {/each}
        {#if displayList.length === 0}
          <div class="empty">No channels match</div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .channel-select {
    position: relative;
  }

  .toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 8px 12px;
    font-size: 0.85rem;
    height: 30px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
  }

  .toggle:hover, .toggle.open {
    border-color: var(--text-muted);
  }

  .toggle-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .arrow {
    font-size: 0.65rem;
    margin-left: 8px;
    flex-shrink: 0;
  }

  .dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    z-index: 10;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
  }

  .dropdown input {
    border: none;
    border-bottom: 1px solid var(--border);
    border-radius: 0;
    padding: 8px 12px;
    font-size: 0.8rem;
    background: var(--bg);
  }

  .options {
    max-height: 240px;
    overflow-y: auto;
  }

  .option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    border: none;
    border-radius: 0;
    padding: 8px 12px;
    font-size: 0.85rem;
    background: transparent;
  }

  .option:hover {
    background: var(--bg-hover);
  }

  .option.active {
    background: rgba(88, 101, 242, 0.15);
  }

  .name {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .check {
    color: var(--accent);
    flex-shrink: 0;
    margin-left: 8px;
  }

  .empty {
    padding: 16px;
    text-align: center;
    color: var(--text-dim);
    font-size: 0.8rem;
  }
</style>
