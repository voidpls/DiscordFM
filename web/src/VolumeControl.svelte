<script>
  let { volume = 50, onsetvolume } = $props();

  function handleInput(e) {
    const v = parseInt(e.target.value, 10);
    onsetvolume?.(v);
  }
</script>

<div class="volume-control">
  <span class="label">Vol</span>
  <input
    type="range"
    min="0"
    max="100"
    value={volume}
    oninput={handleInput}
  />
  <span class="value">{volume}%</span>
</div>

<style>
  .volume-control {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .label {
    font-size: 0.8rem;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .value {
    font-size: 0.75rem;
    color: var(--text-muted);
    min-width: 28px;
    text-align: right;
    flex-shrink: 0;
  }

  input[type="range"] {
    -webkit-appearance: none;
    appearance: none;
    width: 70px;
    min-width: 70px;
    height: 4px;
    background: var(--border);
    border-radius: 2px;
    border: none;
    outline: none;
    cursor: pointer;
    vertical-align: middle;
  }

  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 12px;
    height: 12px;
    margin-top: -4px;
    background: var(--accent);
    border-radius: 50%;
    border: none;
    cursor: pointer;
  }

  input[type="range"]::-moz-range-thumb {
    width: 12px;
    height: 12px;
    margin-top: -4px;
    background: var(--accent);
    border-radius: 50%;
    border: none;
    cursor: pointer;
  }

  input[type="range"]::-webkit-slider-runnable-track {
    height: 4px;
    background: var(--border);
    border-radius: 2px;
  }

  input[type="range"]::-moz-range-track {
    height: 4px;
    background: var(--border);
    border-radius: 2px;
  }

  input[type="range"]:focus {
    outline: none;
  }
</style>
