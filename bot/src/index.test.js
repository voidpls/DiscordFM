import { describe, it, expect } from 'vitest';
import { formatDisplayName, formatMessagePayload } from './index.js';

describe('formatDisplayName', () => {
  it('uses nickname when available', () => {
    const member = { nickname: 'Bob', user: { globalName: 'Robert', username: 'rob123' } };
    expect(formatDisplayName(member)).toBe('Bob');
  });

  it('falls back to globalName then username', () => {
    expect(formatDisplayName({ nickname: null, user: { globalName: 'R', username: 'r' } })).toBe('R');
    expect(formatDisplayName({ nickname: undefined, user: { globalName: undefined, username: 'r' } })).toBe('r');
  });

  it('returns Unknown for null/undefined member', () => {
    expect(formatDisplayName(null)).toBe('Unknown');
    expect(formatDisplayName(undefined)).toBe('Unknown');
  });
});

describe('formatMessagePayload', () => {
  it('formats a message with all fields', () => {
    const msg = {
      id: '123', channelId: '456',
      member: { nickname: 'Alice', user: { username: 'alice99' } },
      author: { username: 'alice99' },
      content: 'Hello world',
      attachments: [{ url: 'https://cdn.discord.com/file.png' }],
      stickers: [],
      createdAt: new Date('2025-01-01T00:00:00Z'),
    };
    const r = formatMessagePayload(msg);
    expect(r.displayName).toBe('Alice');
    expect(r.content).toBe('Hello world');
    expect(r.attachments).toHaveLength(1);
  });

  it('includes phonemes in payload', () => {
    const msg = {
      id: '1', channelId: '2',
      member: { user: { username: 'x' } },
      author: { username: 'x' },
      content: 'hello', attachments: [], stickers: [],
      createdAt: new Date(),
    };
    const r = formatMessagePayload(msg);
    expect(r.phonemes).toHaveProperty('phoneIds');
    expect(r.phonemes.phoneIds.length).toBeGreaterThan(0);
  });
});
