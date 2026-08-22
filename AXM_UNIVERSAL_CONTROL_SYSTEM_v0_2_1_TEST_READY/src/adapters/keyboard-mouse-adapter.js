export class KeyboardMouseAdapter {
  constructor(bus, options = {}) {
    this.bus = bus;
    this.sourceId = options.sourceId || 'keyboard-mouse';
    this.target = options.target || globalThis.window;
    this.keyState = new Set();
    this.enabled = false;
    this.sequence = 0;
    this.mapping = {
      up: options.up || ['KeyW'],
      down: options.down || ['KeyS'],
      left: options.left || ['KeyA'],
      right: options.right || ['KeyD'],
      aimUp: options.aimUp || ['ArrowUp'],
      aimDown: options.aimDown || ['ArrowDown'],
      aimLeft: options.aimLeft || ['ArrowLeft'],
      aimRight: options.aimRight || ['ArrowRight'],
      buttons: options.buttons || {
        Space: 'PRIMARY_ACTION',
        ShiftLeft: 'DODGE',
        KeyE: 'INTERACT',
        Escape: 'OPEN_MENU'
      }
    };
    this.onKeyDown = event => this.#key(event, true);
    this.onKeyUp = event => this.#key(event, false);
    this.onBlur = () => this.releaseAll();
  }

  start() {
    if (this.enabled || !this.target?.addEventListener) return;
    this.enabled = true;
    this.target.addEventListener('keydown', this.onKeyDown);
    this.target.addEventListener('keyup', this.onKeyUp);
    this.target.addEventListener('blur', this.onBlur);
    this.#publish();
  }

  stop() {
    if (!this.enabled || !this.target?.removeEventListener) return;
    this.enabled = false;
    this.target.removeEventListener('keydown', this.onKeyDown);
    this.target.removeEventListener('keyup', this.onKeyUp);
    this.target.removeEventListener('blur', this.onBlur);
    this.releaseAll();
  }

  releaseAll() {
    this.keyState.clear();
    this.#publish();
  }

  #key(event, pressed) {
    if (event.repeat && pressed) return;
    const code = event.code || event.key;
    if (pressed) this.keyState.add(code); else this.keyState.delete(code);
    if (this.#isMapped(code)) event.preventDefault?.();
    this.#publish();
  }

  #isMapped(code) {
    return Object.values(this.mapping).flatMap(value => Array.isArray(value) ? value : Object.keys(value || {})).includes(code);
  }

  #pressed(codes) { return codes.some(code => this.keyState.has(code)); }

  #publish() {
    const actions = [
      { id:'MOVE', value:{
        x:(this.#pressed(this.mapping.right)?1:0)-(this.#pressed(this.mapping.left)?1:0),
        y:(this.#pressed(this.mapping.down)?1:0)-(this.#pressed(this.mapping.up)?1:0)
      }},
      { id:'AIM', value:{
        x:(this.#pressed(this.mapping.aimRight)?1:0)-(this.#pressed(this.mapping.aimLeft)?1:0),
        y:(this.#pressed(this.mapping.aimDown)?1:0)-(this.#pressed(this.mapping.aimUp)?1:0)
      }}
    ];
    for (const [code,actionId] of Object.entries(this.mapping.buttons)) {
      actions.push({id:actionId,value:this.keyState.has(code)?1:0});
    }
    this.bus.applyFrame(this.sourceId,{
      sequence:this.sequence++,timestamp:Date.now(),fullState:true,actions
    },{deviceType:'keyboard',priority:1});
  }
}
