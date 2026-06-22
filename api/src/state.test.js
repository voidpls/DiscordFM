import { describe, it, expect, beforeEach } from 'vitest';
import { state } from './state.js';

beforeEach(() => {
  state.messages = new Map();
  state.channelList = [];
  state.serverName = '';
  state.serverIcon = '';
});

describe('State', () => {
  describe('addMessage', () => {
    it('adds a message to the channel buffer', () => {
      state.addMessage({ id: '1', channelId: 'abc', content: 'hello' });
      expect(state.getMessages('abc')).toHaveLength(1);
      expect(state.getMessages('abc')[0].content).toBe('hello');
    });

    it('appends messages to the same channel', () => {
      state.addMessage({ id: '1', channelId: 'abc', content: 'a' });
      state.addMessage({ id: '2', channelId: 'abc', content: 'b' });
      expect(state.getMessages('abc')).toHaveLength(2);
    });

    it('keeps channels separate', () => {
      state.addMessage({ id: '1', channelId: 'abc', content: 'a' });
      state.addMessage({ id: '2', channelId: 'xyz', content: 'b' });
      expect(state.getMessages('abc')).toHaveLength(1);
      expect(state.getMessages('xyz')).toHaveLength(1);
    });

    it('returns empty array for unknown channel', () => {
      expect(state.getMessages('nonexistent')).toEqual([]);
    });

    it('enforces ring buffer max of 200', () => {
      for (let i = 0; i < 250; i++) {
        state.addMessage({ id: String(i), channelId: 'abc', content: `msg${i}` });
      }
      const msgs = state.getMessages('abc');
      expect(msgs).toHaveLength(200);
      expect(msgs[0].id).toBe('50');
      expect(msgs[199].id).toBe('249');
    });

    it('ignores messages without channelId', () => {
      state.addMessage({ id: '1', content: 'nope' });
      expect(state.messages.size).toBe(0);
    });
  });

  describe('setChannels', () => {
    it('stores channel list and server info', () => {
      state.setChannels(
        [{ id: '1', name: 'general' }],
        'Test Server',
        'https://cdn.discord.com/icon.png'
      );
      expect(state.getChannels()).toEqual([{ id: '1', name: 'general' }]);
      expect(state.getServerInfo()).toEqual({
        serverName: 'Test Server',
        serverIcon: 'https://cdn.discord.com/icon.png',
      });
    });
  });
});
