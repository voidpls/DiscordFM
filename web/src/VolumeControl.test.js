import { describe, it, expect } from 'vitest';
import VolumeControl from './VolumeControl.svelte';

describe('VolumeControl', () => {
  it('is a Svelte component', () => {
    expect(VolumeControl).toBeDefined();
    expect(typeof VolumeControl).toBe('function');
  });
});
