export class NetworkControllerAdapter {
  constructor(bus, socket, options = {}) {
    this.bus = bus;
    this.socket = socket;
    this.sourcePrefix = options.sourcePrefix || 'phone';
    this.onFrame = event => {
      const message = event.detail || event.data || event;
      if (message?.type !== 'input_frame') return;
      const sourceId = `${this.sourcePrefix}:${message.playerId || message.deviceId || 'unknown'}`;
      this.bus.applyFrame(sourceId, message, { deviceType: 'phone', priority: 5 });
    };
    this.onRelease = event => {
      const message = event.detail || event.data || event;
      if (message?.type !== 'controller_disconnected') return;
      this.bus.releaseSource(`${this.sourcePrefix}:${message.playerId || message.deviceId || 'unknown'}`);
    };
  }

  start() {
    this.socket.addEventListener('message-object', this.onFrame);
    this.socket.addEventListener('message-object', this.onRelease);
  }

  stop() {
    this.socket.removeEventListener('message-object', this.onFrame);
    this.socket.removeEventListener('message-object', this.onRelease);
  }
}
