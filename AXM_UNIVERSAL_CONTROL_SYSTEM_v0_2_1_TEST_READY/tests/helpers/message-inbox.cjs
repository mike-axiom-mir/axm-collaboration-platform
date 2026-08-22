'use strict';

class MessageInbox {
  constructor(socket) {
    this.socket = socket;
    this.queue = [];
    this.waiters = [];
    this.closedError = null;

    this.onMessage = event => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch (error) {
        this.fail(error);
        return;
      }

      const waiterIndex = this.waiters.findIndex(waiter => {
        try { return waiter.predicate(message); } catch (error) { waiter.reject(error); return true; }
      });
      if (waiterIndex >= 0) {
        const [waiter] = this.waiters.splice(waiterIndex, 1);
        clearTimeout(waiter.timer);
        waiter.resolve(message);
        return;
      }
      this.queue.push(message);
    };

    this.onClose = () => {
      this.closedError = new Error('WebSocket closed before matching message arrived');
      this.fail(this.closedError);
    };

    socket.addEventListener('message', this.onMessage);
    socket.addEventListener('close', this.onClose, { once: true });
  }

  wait(predicate = () => true, timeoutMs = 3000) {
    const queuedIndex = this.queue.findIndex(message => predicate(message));
    if (queuedIndex >= 0) {
      const [message] = this.queue.splice(queuedIndex, 1);
      return Promise.resolve(message);
    }
    if (this.closedError) return Promise.reject(this.closedError);

    return new Promise((resolve, reject) => {
      const waiter = { predicate, resolve, reject, timer: null };
      waiter.timer = setTimeout(() => {
        const index = this.waiters.indexOf(waiter);
        if (index >= 0) this.waiters.splice(index, 1);
        reject(new Error('WebSocket matching-message timeout'));
      }, timeoutMs);
      this.waiters.push(waiter);
    });
  }

  fail(error) {
    const waiters = this.waiters.splice(0);
    for (const waiter of waiters) {
      clearTimeout(waiter.timer);
      waiter.reject(error);
    }
  }

  dispose() {
    this.socket.removeEventListener('message', this.onMessage);
    this.fail(new Error('Message inbox disposed'));
  }
}

module.exports = { MessageInbox };
