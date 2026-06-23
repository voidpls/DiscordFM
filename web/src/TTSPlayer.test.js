import { describe, it, expect } from 'vitest';
import TTSPlayer from './TTSPlayer.js';

describe('TTSPlayer volume', () => {
  it('defaults to 0.5', () => {
    const player = new TTSPlayer();
    expect(player.volume).toBe(0.5);
  });

  it('setVolume(50) maps to 0.5', () => {
    const player = new TTSPlayer();
    player.setVolume(50);
    expect(player.volume).toBe(0.5);
  });

  it('setVolume(0) maps to 0', () => {
    const player = new TTSPlayer();
    player.setVolume(0);
    expect(player.volume).toBe(0);
  });

  it('setVolume(100) maps to 1', () => {
    const player = new TTSPlayer();
    player.setVolume(100);
    expect(player.volume).toBe(1);
  });

  it('setVolume(150) clamps to 1', () => {
    const player = new TTSPlayer();
    player.setVolume(150);
    expect(player.volume).toBe(1);
  });

  it('setVolume(-10) clamps to 0', () => {
    const player = new TTSPlayer();
    player.setVolume(-10);
    expect(player.volume).toBe(0);
  });

  it('setVolume does not affect other state', () => {
    const player = new TTSPlayer();
    player.speed = 1.75;
    player.setVolume(80);
    expect(player.speed).toBe(1.75);
    expect(player.volume).toBe(0.8);
  });
});
