import { VirtualStick } from './virtual-stick.js';
import { LayoutEditor } from './layout-editor.js';

const ZERO = Object.freeze({ x: 0, y: 0 });
const BASE_DIGITAL_ACTIONS = ['PRIMARY_ACTION','SECONDARY_ACTION','JUMP','DODGE','ATTACK','INTERACT','USE_ITEM','SPRINT','CROUCH','RELOAD','OPEN_MENU','PAUSE','CONFIRM','CANCEL'];

export class PhoneController {
  constructor(container, options = {}) {
    this.container = container;
    this.onState = options.onState || (() => {});
    this.settings = {
      stickSize: 150,
      buttonSize: 66,
      opacity: 0.82,
      sensitivity: 1,
      deadZone: 0.12,
      leftHanded: false,
      oneHandedMode: 'off',
      highContrast: false,
      reducedMotion: false,
      vibrationEnabled: true,
      vibrationStrength: 0.65,
      floatingSticks: true,
      snapDirections: 0,
      layout: {},
      ...options.settings
    };
    this.state = { MOVE:{...ZERO}, AIM:{...ZERO}, LOOK:{...ZERO} };
    for (const id of BASE_DIGITAL_ACTIONS) this.state[id]=0;
    this.sticks = {};
    this.buttons = [];
    this.layoutEditor = null;
    this.activeOneHandedAxis = 'MOVE';
    this.stickBindings = { leftStick:'MOVE', rightStick:'AIM' };
    this.profile = null;
    this.#build();
    if (options.profile) this.applyProfile(options.profile, options.bindingOverrides);
    this.applySettings(this.settings);
  }

  getState() { return structuredClone(this.state); }

  neutralize() {
    for (const [id, value] of Object.entries(this.state)) this.state[id] = typeof value === 'object' ? { ...ZERO } : 0;
    for (const stick of Object.values(this.sticks)) stick.release();
    for (const button of this.buttons) button.classList.remove('pressed');
    this.#emit();
  }

  setEditMode(enabled) {
    this.layoutEditor.setEnabled(enabled);
    for (const stick of Object.values(this.sticks)) stick.enabled = !enabled;
  }

  applyProfile(profile, bindingOverrides = {}) {
    if (!profile?.phoneLayout) throw new Error('Phone profile requires phoneLayout');
    this.neutralize();
    this.profile = structuredClone(profile);
    const mode = ['simple','standard','advanced','custom'].includes(profile.phoneLayout.mode) ? profile.phoneLayout.mode : 'standard';
    for (const name of ['simple','standard','advanced','custom']) this.container.classList.toggle(`mode-${name}`,name===mode);
    this.container.dataset.controlMode=mode;

    const controls=Array.isArray(profile.phoneLayout.controls)?profile.phoneLayout.controls:[];
    if (!controls.length) return;
    const declaredLabels=new Map((profile.actions||[]).map(item=>[item.id,item.label||item.id]));
    const usedElements=new Set();

    for (const control of controls) {
      const action=bindingOverrides[control.id] || control.action;
      if (!action) continue;
      this.#ensureState(action, control.id.toLowerCase().includes('stick') ? { ...ZERO } : 0);
      if (control.id==='leftStick' || control.id==='rightStick') {
        this.stickBindings[control.id]=action;
        const root=this.container.querySelector(control.id==='leftStick'?'.axm-left-stick':'.axm-right-stick');
        root.hidden=false;
        root.querySelector('span').textContent=declaredLabels.get(action)||action;
        usedElements.add(root);
        continue;
      }
      const button=this.#buttonByControlId(control.id);
      if (!button) continue;
      button.hidden=false;
      button.dataset.action=action;
      button.setAttribute('aria-label',declaredLabels.get(action)||action);
      const small=button.querySelector('small');
      if (small) small.textContent=(declaredLabels.get(action)||action).slice(0,10);
      usedElements.add(button);
    }

    for (const root of [this.container.querySelector('.axm-left-stick'),this.container.querySelector('.axm-right-stick')]) {
      if (!usedElements.has(root)) root.hidden=true;
    }
    for (const button of this.buttons) if (!usedElements.has(button)) button.hidden=true;
    this.#updateOneHandedUi();
  }

  remapControl(controlId, actionId, label = actionId) {
    if (!controlId || !actionId) throw new Error('controlId and actionId are required');
    this.neutralize();
    this.#ensureState(actionId, controlId.toLowerCase().includes('stick') ? { ...ZERO } : 0);
    if (controlId==='leftStick' || controlId==='rightStick') {
      this.stickBindings[controlId]=actionId;
      const root=this.container.querySelector(controlId==='leftStick'?'.axm-left-stick':'.axm-right-stick');
      root.hidden=false;
      root.querySelector('span').textContent=label;
    } else {
      const button=this.#buttonByControlId(controlId);
      if (!button) throw new Error(`Unknown phone control ${controlId}`);
      button.hidden=false;
      button.dataset.action=actionId;
      button.setAttribute('aria-label',label);
      const small=button.querySelector('small');
      if (small) small.textContent=label.slice(0,10);
    }
    this.container.dispatchEvent(new CustomEvent('bindingchange',{detail:{controlId,actionId,label}}));
  }

  applySettings(patch = {}) {
    Object.assign(this.settings, patch);
    this.container.style.setProperty('--axm-stick-size', `${this.settings.stickSize}px`);
    this.container.style.setProperty('--axm-button-size', `${this.settings.buttonSize}px`);
    this.container.style.setProperty('--axm-control-opacity', String(this.settings.opacity));
    this.container.classList.toggle('left-handed', Boolean(this.settings.leftHanded));
    const oneHandedMode = ['left','right'].includes(this.settings.oneHandedMode) ? this.settings.oneHandedMode : 'off';
    this.settings.oneHandedMode = oneHandedMode;
    this.container.classList.toggle('one-hand-enabled', oneHandedMode !== 'off');
    this.container.classList.toggle('one-hand-left', oneHandedMode === 'left');
    this.container.classList.toggle('one-hand-right', oneHandedMode === 'right');
    if (oneHandedMode === 'off') this.activeOneHandedAxis = this.stickBindings.leftStick || 'MOVE';
    this.container.classList.toggle('high-contrast', Boolean(this.settings.highContrast));
    this.container.classList.toggle('reduced-motion', Boolean(this.settings.reducedMotion));
    for (const stick of Object.values(this.sticks)) stick.configure({
      deadZone: this.settings.deadZone,
      sensitivity: this.settings.sensitivity,
      floating: this.settings.floatingSticks,
      snapDirections: this.settings.snapDirections
    });
    this.layoutEditor.apply(this.settings.layout || {});
    this.#updateOneHandedUi();
  }

  #build() {
    this.container.classList.add('axm-phone-controller');
    this.container.innerHTML = `
      <section class="axm-stick axm-left-stick" data-control-id="leftStick" aria-label="Movement stick">
        <div class="axm-stick-ring"></div><div class="axm-stick-knob" data-stick-knob></div><span>MOVE</span>
      </section>
      <section class="axm-stick axm-right-stick" data-control-id="rightStick" aria-label="Aim stick">
        <div class="axm-stick-ring"></div><div class="axm-stick-knob" data-stick-knob></div><span>AIM</span>
      </section>
      <section class="axm-face-buttons" data-control-id="faceButtons" aria-label="Action buttons">
        <button data-action="USE_ITEM" data-label="Y" aria-label="Use item">Y<small>ITEM</small></button>
        <button data-action="INTERACT" data-label="X" aria-label="Interact">X<small>USE</small></button>
        <button data-action="DODGE" data-label="B" aria-label="Dodge">B<small>DODGE</small></button>
        <button data-action="PRIMARY_ACTION" data-label="A" aria-label="Primary action">A<small>ACTION</small></button>
      </section>
      <button class="axm-menu-button" data-control-id="Menu" data-action="OPEN_MENU" aria-label="Open menu">MENU</button>
      <button class="axm-mode-button" data-control-id="oneHandSwitch" aria-label="Switch one-handed stick role">STICK: MOVE</button>
    `;

    this.sticks.leftStick = new VirtualStick(this.container.querySelector('.axm-left-stick'), {
      onChange: value => {
        const target = this.settings.oneHandedMode === 'off' ? this.stickBindings.leftStick : this.activeOneHandedAxis;
        const other = target === this.stickBindings.leftStick ? this.stickBindings.rightStick : this.stickBindings.leftStick;
        this.#setAxis(target,value);
        if (this.settings.oneHandedMode !== 'off' && other) this.#setAxis(other,ZERO);
        this.#emit();
      }
    });
    this.sticks.rightStick = new VirtualStick(this.container.querySelector('.axm-right-stick'), {
      onChange: value => {
        if (this.settings.oneHandedMode !== 'off') return;
        this.#setAxis(this.stickBindings.rightStick,value);
        this.#emit();
      }
    });

    this.modeButton = this.container.querySelector('.axm-mode-button');
    this.modeButton.addEventListener('click', event => {
      event.preventDefault();
      if (this.settings.oneHandedMode === 'off' || this.layoutEditor?.enabled) return;
      const choices=[this.stickBindings.leftStick,this.stickBindings.rightStick].filter(Boolean);
      if (choices.length<2) return;
      this.activeOneHandedAxis = this.activeOneHandedAxis === choices[0] ? choices[1] : choices[0];
      this.#setAxis(choices[0],ZERO); this.#setAxis(choices[1],ZERO);
      this.sticks.leftStick.release();
      this.#vibrate();
      this.#updateOneHandedUi();
      this.#emit();
    });

    for (const button of this.container.querySelectorAll('[data-action]')) {
      this.buttons.push(button);
      const press = event => {
        if (this.layoutEditor?.enabled) return;
        event.preventDefault();
        button.setPointerCapture?.(event.pointerId);
        button.classList.add('pressed');
        const id=button.dataset.action;
        this.#ensureState(id,0); this.state[id]=1;
        this.#vibrate(); this.#emit();
      };
      const release = event => {
        if (this.layoutEditor?.enabled) return;
        event.preventDefault();
        button.classList.remove('pressed');
        const id=button.dataset.action;
        this.#ensureState(id,0); this.state[id]=0;
        this.#emit();
      };
      button.addEventListener('pointerdown', press);
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('lostpointercapture', release);
    }

    this.layoutEditor = new LayoutEditor(this.container, {
      onSave: layout => {
        this.settings.layout = layout;
        this.container.dispatchEvent(new CustomEvent('layoutchange', { detail: layout }));
      }
    });

    addEventListener('blur', () => this.neutralize());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.neutralize(); });
  }

  #buttonByControlId(controlId) {
    if (String(controlId).toLowerCase()==='menu') return this.container.querySelector('.axm-menu-button');
    return this.container.querySelector(`[data-label="${CSS.escape(String(controlId))}"]`);
  }

  #ensureState(actionId, initialValue) {
    if (!actionId) return;
    if (!(actionId in this.state)) this.state[actionId]=structuredClone(initialValue);
  }

  #setAxis(actionId,value) {
    if (!actionId) return;
    this.#ensureState(actionId,{...ZERO});
    this.state[actionId]={x:Number(value.x)||0,y:Number(value.y)||0};
  }

  #updateOneHandedUi() {
    if (!this.modeButton) return;
    const choices=[this.stickBindings.leftStick,this.stickBindings.rightStick].filter(Boolean);
    const enabled = this.settings.oneHandedMode !== 'off' && choices.length>1;
    this.modeButton.hidden = !enabled;
    if (!choices.includes(this.activeOneHandedAxis)) this.activeOneHandedAxis=choices[0] || 'MOVE';
    this.modeButton.textContent = `STICK: ${this.activeOneHandedAxis}`;
    const label = this.container.querySelector('.axm-left-stick > span');
    if (label) label.textContent = enabled ? this.activeOneHandedAxis : (this.stickBindings.leftStick || 'MOVE');
  }

  #emit() {
    const state=this.getState();
    this.onState(state);
    this.container.dispatchEvent(new CustomEvent('controlstate', { detail: state }));
  }

  #vibrate() {
    if (!this.settings.vibrationEnabled || !navigator.vibrate) return;
    const duration = Math.round(10 + 20 * Math.max(0, Math.min(1, this.settings.vibrationStrength)));
    navigator.vibrate(duration);
  }
}
