<script>
  import { emojiToName } from 'gemoji';

  let { messages = [], currentChannel = '' } = $props();

  let container;
  let autoScroll = $state(true);

  $effect(() => {
    messages;
    currentChannel;
    if (autoScroll && container) {
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    }
  });

  function handleScroll() {
    if (!container) return;
    const threshold = 100;
    const dist = container.scrollHeight - container.scrollTop - container.clientHeight;
    autoScroll = dist < threshold;
  }

  function formatTimestamp(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // Build a Twemoji CDN URL from a Unicode emoji (e.g. 😀 → 1f600.png; 👪 → 1f46a-200d-1f466-200d-1f467-200d-1f466.png)
  function emojiToTwemojiUrl(emoji) {
    const codepoints = [...emoji].map(ch => ch.codePointAt(0).toString(16)).join('-');
    return `https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/72x72/${codepoints}.png`;
  }

  // Split message text into typed segments: custom Discord emojis, Twemoji images, and plain text
  function renderContent(content) {
    const parts = [];
    content = content.replace(/https?:\/\/\S+/g, '[link]');
    const customRe = /<a?:(\w+):(\d+)>/g;
    let lastIndex = 0;
    let match;

    while ((match = customRe.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push(...renderUnicode(content.slice(lastIndex, match.index)));
      }
      parts.push({ type: 'custom', name: match[1], id: match[2] });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < content.length) {
      parts.push(...renderUnicode(content.slice(lastIndex)));
    }
    return parts;
  }

  // Replace Unicode emojis with Twemoji images using longest-possible-match (up to 8 codepoints for ZWJ sequences)
  function renderUnicode(text) {
    const parts = [];
    const chars = [...text];
    let buf = '';
    let i = 0;
    while (i < chars.length) {
      let matched = false;
      for (let len = Math.min(8, chars.length - i); len >= 1; len--) {
        const seq = chars.slice(i, i + len).join('');
        const name = emojiToName[seq];
        if (name) {
          if (buf) { parts.push({ type: 'text', text: buf }); buf = ''; }
          parts.push({ type: 'twemoji', src: emojiToTwemojiUrl(seq), alt: name });
          i += len;
          matched = true;
          break;
        }
      }
      if (!matched) { buf += chars[i]; i++; }
    }
    if (buf) parts.push({ type: 'text', text: buf });
    return parts;
  }
</script>

<div
  class="chat"
  bind:this={container}
  onscroll={handleScroll}
>
  {#if messages.length === 0}
    <div class="empty">No messages yet. Select a channel to start.</div>
  {/if}
  {#each messages as msg}
    <div class="message">
      <div class="header">
        <span class="display-name" style={msg.color ? `color:#${msg.color.toString(16).padStart(6,'0')}` : ''}>{msg.displayName}</span>
        <span class="username">(@{msg.username})</span>
        <span class="timestamp">{formatTimestamp(msg.timestamp)}</span>
      </div>
      <div class="body">
        <span class="content">
          {#each renderContent(msg.content) as part}
            {#if part.type === 'custom'}
              <img
                class="emoji"
                src="https://cdn.discordapp.com/emojis/{part.id}.png"
                alt=":{part.name}:"
                loading="lazy"
              />
            {:else if part.type === 'twemoji'}
              <img
                class="emoji"
                src={part.src}
                alt=":{part.alt}:"
                loading="lazy"
              />
            {:else}
              {part.text}
            {/if}
          {/each}
        </span>
      </div>
      {#if msg.stickers && msg.stickers.length > 0}
        <div class="stickers">
          {#each msg.stickers as st}
            {#if st.format === 3}
              <span class="sticker-text">:{st.name}:</span>
            {:else}
              <img class="sticker" src={st.url} alt={st.name} loading="lazy" />
            {/if}
          {/each}
        </div>
      {/if}
      {#if msg.attachments && msg.attachments.length > 0}
        <div class="attachments">
          <span class="attachment-badge">
            {msg.attachments.length === 1 ? '[link]' : `[${msg.attachments.length} attachments]`}
          </span>
        </div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .chat {
    flex: 1;
    min-height: 200px;
    max-height: 60vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }

  .empty {
    color: var(--text-dim);
    text-align: center;
    padding: 40px 16px;
    font-size: 0.85rem;
  }

  .message {
    padding: 6px 8px;
    border-radius: 4px;
    line-height: 1.4;
  }

  .message:hover {
    background: rgba(255, 255, 255, 0.02);
  }

  .header {
    display: flex;
    align-items: baseline;
    gap: 6px;
    flex-wrap: wrap;
  }

  .display-name {
    color: var(--text-name);
    font-weight: 700;
    font-size: 0.85rem;
  }

  .username {
    color: var(--text-muted);
    font-size: 0.75rem;
  }

  .timestamp {
    color: var(--text-dim);
    font-size: 0.7rem;
    margin-left: auto;
  }

  .body {
    margin-top: 2px;
  }

  .content {
    font-size: 0.85rem;
    word-break: break-word;
    white-space: pre-wrap;
  }

  .emoji {
    width: 20px;
    height: 20px;
    vertical-align: middle;
    margin: 0 1px;
  }

  .stickers {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    margin-top: 4px;
  }

  .sticker-text {
    font-size: 0.8rem;
    color: var(--text-muted);
    font-style: italic;
  }

  .sticker {
    width: 96px;
    height: 96px;
    object-fit: contain;
    border-radius: 4px;
  }

  .attachments {
    margin-top: 4px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .attachment-badge {
    color: var(--text-dim);
    font-size: 0.75rem;
    font-style: italic;
  }
</style>
