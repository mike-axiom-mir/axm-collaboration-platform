(function (root) {
  'use strict';
  const AXM = root.AXM;

  AXM.HistoryStack = class HistoryStack {
    constructor(limit = 40) {
      this.limit = limit;
      this.past = [];
      this.future = [];
      this.current = null;
    }

    seed(state) {
      this.past = [];
      this.future = [];
      this.current = AXM.Utils.clone(state);
    }

    commit(state) {
      if (this.current !== null) {
        this.past.push(AXM.Utils.clone(this.current));
        if (this.past.length > this.limit) this.past.shift();
      }
      this.current = AXM.Utils.clone(state);
      this.future = [];
    }

    undo() {
      if (!this.past.length) return null;
      this.future.unshift(AXM.Utils.clone(this.current));
      this.current = this.past.pop();
      return AXM.Utils.clone(this.current);
    }

    redo() {
      if (!this.future.length) return null;
      this.past.push(AXM.Utils.clone(this.current));
      this.current = this.future.shift();
      return AXM.Utils.clone(this.current);
    }

    get canUndo() { return this.past.length > 0; }
    get canRedo() { return this.future.length > 0; }
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
