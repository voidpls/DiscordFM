import { describe, it, expect, beforeEach } from 'vitest';
import { app } from './index.js';
import { state } from './state.js';

beforeEach(() => {
  state.messages = new Map();
  state.channelList = [];
  state.serverName = '';
  state.serverIcon = '';
});

describe('POST /api/message', () => {
  it('accepts a valid message', async () => {
    const res = await app.request('/api/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: '1',
        channelId: 'abc',
        displayName: 'Alice',
        username: 'alice99',
        content: 'Hello',
        attachments: [],
        timestamp: '2025-01-01T00:00:00Z',
      }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(state.getMessages('abc')).toHaveLength(1);
  });

  it('returns 400 when missing id', async () => {
    const res = await app.request('/api/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelId: 'abc',
        displayName: 'Alice',
        username: 'alice99',
        content: 'Hello',
      }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('id');
  });

  it('returns 400 when missing channelId', async () => {
    const res = await app.request('/api/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: '1',
        displayName: 'Alice',
        username: 'alice99',
        content: 'Hello',
      }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('channelId');
  });

  it('returns 400 for invalid JSON', async () => {
    const res = await app.request('/api/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    expect(res.status).toBe(400);
  });

  it('defaults attachments to empty array', async () => {
    const res = await app.request('/api/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: '1',
        channelId: 'abc',
        displayName: 'Alice',
        username: 'alice99',
        content: 'Hello',
      }),
    });
    expect(res.status).toBe(200);
    const msg = state.getMessages('abc')[0];
    expect(msg.attachments).toEqual([]);
  });
});

describe('POST /api/channels', () => {
  it('accepts channel list', async () => {
    const res = await app.request('/api/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channels: [{ id: '1', name: 'general' }],
        serverName: 'Test',
        serverIcon: 'https://icon.png',
      }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(state.getChannels()).toEqual([{ id: '1', name: 'general' }]);
    expect(state.getServerInfo().serverName).toBe('Test');
  });

  it('returns 400 when channels is not an array', async () => {
    const res = await app.request('/api/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channels: 'not-array' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid JSON', async () => {
    const res = await app.request('/api/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'bad json',
    });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/channels', () => {
  it('returns stored channels and server info', async () => {
    state.setChannels([{ id: '1', name: 'general' }], 'Server', 'icon.png');
    const res = await app.request('/api/channels');
    const body = await res.json();
    expect(body.channels).toEqual([{ id: '1', name: 'general' }]);
    expect(body.serverName).toBe('Server');
  });
});

describe('GET /events', () => {
  it('returns 403 for unregistered channel', async () => {
    const res = await app.request('/events?channel=abc');
    expect(res.status).toBe(403);
  });

  it('responds with text/event-stream for registered channel', async () => {
    state.setChannels([{ id: 'abc', name: 'general' }], 'Server', '');
    const res = await app.request('/events?channel=abc');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
  });
});
