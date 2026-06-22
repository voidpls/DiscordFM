import { describe, it, expect } from 'vitest';
import { getPhonemeIds } from './g2p.js';

describe('getPhonemeIds', () => {
  it('inserts blanks at even positions', () => {
    const r = getPhonemeIds('hello');
    for (let i = 0; i < r.phoneIds.length; i += 2) {
      expect(r.phoneIds[i]).toBe(0);
      expect(r.toneIds[i]).toBe(0);
      expect(r.langIds[i]).toBe(0);
    }
  });

  it('strips URLs', () => {
    expect(getPhonemeIds('hello https://x.com/path world').phoneIds.length)
      .toBe(getPhonemeIds('hello world').phoneIds.length);
  });

  it('converts custom emojis', () => {
    expect(getPhonemeIds('hello <:dog:12345>').phoneIds.length).toBeGreaterThan(10);
  });

  it('expands ordinals, currency, and percentages', () => {
    expect(getPhonemeIds('1st $5.99').phoneIds.length).toBeGreaterThan(10);
    expect(getPhonemeIds('50%').phoneIds.length).toBeGreaterThan(5);
  });

  it('expands acronyms', () => {
    const r = getPhonemeIds('the AI model and FBI agent');
    expect(r.phoneIds.length).toBeGreaterThan(10);
  });

  it('expands abbreviations', () => {
    const r = getPhonemeIds('Dr. Smith said etc.');
    expect(r.phoneIds.length).toBeGreaterThan(10);
  });

  it('handles empty text', () => {
    expect(getPhonemeIds('').phoneIds.every(v => v === 0)).toBe(true);
  });

  it('handles contractions', () => {
    expect(getPhonemeIds("don't").phoneIds.length).toBeGreaterThan(5);
  });

  it('produces deterministic output', () => {
    const a = getPhonemeIds('the weather is nice today');
    const b = getPhonemeIds('the weather is nice today');
    expect(a.phoneIds).toEqual(b.phoneIds);
  });
});
