const MAX_MESSAGES_PER_CHANNEL = 200;

class State {
  constructor() {
    this.messages = new Map();
    this.channelList = [];
    this.serverName = '';
    this.serverIcon = '';
  }

  addMessage(msg) {
    if (!msg.channelId) return;

    let buffer = this.messages.get(msg.channelId);
    if (!buffer) {
      buffer = [];
      this.messages.set(msg.channelId, buffer);
    }

    buffer.push(msg);
    if (buffer.length > MAX_MESSAGES_PER_CHANNEL) {
      buffer.shift();
    }
  }

  setChannels(channels, serverName, serverIcon) {
    this.channelList = channels;
    this.serverName = serverName;
    this.serverIcon = serverIcon;
  }

  getMessages(channelId) {
    return this.messages.get(channelId) || [];
  }

  getChannels() {
    return this.channelList;
  }

  getServerInfo() {
    return {
      serverName: this.serverName,
      serverIcon: this.serverIcon,
    };
  }
}

export const state = new State();
