/*
 * AXM Aetherfield v7.1.0
 * Optional adaptive Canvas 2D atmosphere: stardust, constellation, nebula,
 * fireflies, embers, crystal shards, snow, data rain, orbitals, motes, and warp.
 */
(function attachAXMAetherfield(global) {
  "use strict";

  const VERSION = "7.1.0";
  const PRESETS = new Set(["off", "stardust", "constellation", "nebula", "fireflies", "embers", "crystal", "snow", "data-rain", "orbitals", "motes", "warp"]);
  const DEFAULTS = Object.freeze({
    preset: "stardust",
    density: .72,
    energy: .78,
    speed: .62,
    interactive: true,
    maxDpr: 1.75,
    seed: 7419,
    autoStart: true
  });

  function clamp(value, min, max, fallback = min) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  }

  function hashSeed(seed) {
    let state = Math.abs(Number(seed) || 1) >>> 0;
    return function random() {
      state += 0x6D2B79F5;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function parseColor(context, value, fallback) {
    try {
      const previous = context.fillStyle;
      context.fillStyle = "#010203";
      context.fillStyle = String(value || "").trim();
      const normalized = String(context.fillStyle);
      context.fillStyle = previous;
      if (/^#[0-9a-f]{6}$/i.test(normalized)) {
        return {
          r: parseInt(normalized.slice(1, 3), 16),
          g: parseInt(normalized.slice(3, 5), 16),
          b: parseInt(normalized.slice(5, 7), 16)
        };
      }
      const match = normalized.match(/rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)/i);
      if (match) return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]) };
    } catch (_) {
      // Use fallback below.
    }
    return fallback;
  }

  function rgba(color, alpha) {
    return `rgba(${color.r},${color.g},${color.b},${clamp(alpha, 0, 1, 0)})`;
  }

  function resolveTargetPoint(target, documentRef) {
    if (typeof target === "string") target = documentRef.querySelector(target);
    if (target?.getBoundingClientRect) {
      const rect = target.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
    if (target && Number.isFinite(target.x) && Number.isFinite(target.y)) return { x: target.x, y: target.y };
    return null;
  }

  class AXMAetherfield {
    constructor(engine, options = {}) {
      if (!engine?.root || !engine?.atmosphere) {
        throw new Error("AXMAetherfield requires a mounted AXMVisualEngine instance.");
      }
      this.engine = engine;
      this.root = engine.root;
      this.document = engine.document || global.document;
      this.options = { ...DEFAULTS, ...options };
      this.canvas = null;
      this.context = null;
      this.mounted = false;
      this.running = false;
      this.width = 0;
      this.height = 0;
      this.dpr = 1;
      this.particles = [];
      this.bursts = [];
      this.pointer = { x: -9999, y: -9999, active: false };
      this.colors = [];
      this._raf = 0;
      this._lastTime = 0;
      this._lastDraw = 0;
      this._random = hashSeed(this.options.seed);
      this._resizeObserver = null;
      this._interactiveBound = false;
      this._handlers = {
        resize: () => this.resize(),
        pointerMove: (event) => this._onPointerMove(event),
        pointerOut: () => { this.pointer.active = false; },
        state: () => this._onEngineState(),
        visibility: () => this._onVisibility()
      };
    }

    static mount(engine, options = {}) {
      return new AXMAetherfield(engine, options).mount();
    }

    static get presets() {
      return Array.from(PRESETS);
    }

    mount() {
      if (this.mounted) return this;
      this.canvas = this.document.createElement("canvas");
      this.canvas.className = "axm-aetherfield";
      this.canvas.setAttribute("aria-hidden", "true");
      this.canvas.dataset.axmOwned = "aetherfield";
      const lightsLayer = this.engine.atmosphere.querySelector(".axm-atmosphere__lights");
      this.engine.atmosphere.insertBefore(this.canvas, lightsLayer || null);
      this.context = this.canvas.getContext("2d", { alpha: true, desynchronized: true });
      if (!this.context) throw new Error("AXMAetherfield could not acquire a Canvas 2D context.");

      this.mounted = true;
      this.setPreset(this.options.preset, false);
      this.setDensity(this.options.density, false);
      this.setEnergy(this.options.energy, false);
      this.setSpeed(this.options.speed, false);
      this.setInteractive(this.options.interactive, false);

      global.addEventListener("resize", this._handlers.resize, { passive: true });
      this.root.addEventListener("axmvisual:themechange", this._handlers.state);
      this.root.addEventListener("axmvisual:qualitychange", this._handlers.state);
      this.root.addEventListener("axmvisual:motionchange", this._handlers.state);
      this.root.addEventListener("axmvisual:intensitychange", this._handlers.state);
      this.document.addEventListener("visibilitychange", this._handlers.visibility);

      if (global.ResizeObserver) {
        this._resizeObserver = new global.ResizeObserver(() => this.resize());
        this._resizeObserver.observe(this.document.documentElement);
      }

      this.resize();
      this._syncColors();
      this._rebuildParticles();
      if (this.options.autoStart) this.start();
      this._emit("mounted", this.getState());
      return this;
    }

    setPreset(value, rebuild = true) {
      const preset = PRESETS.has(value) ? value : "stardust";
      this.options.preset = preset;
      if (this.canvas) this.canvas.dataset.axmField = preset;
      if (rebuild && this.mounted) this._rebuildParticles();
      if (preset === "off") this.stop(true);
      else if (this.mounted && this.options.autoStart) this.start();
      this._emit("presetchange", { preset });
      return this;
    }

    setDensity(value, rebuild = true) {
      this.options.density = clamp(value, 0, 1.5, .72);
      if (rebuild && this.mounted) this._rebuildParticles();
      this._emit("densitychange", { density: this.options.density });
      return this;
    }

    setEnergy(value, emit = true) {
      this.options.energy = clamp(value, 0, 1.6, .78);
      if (emit) this._emit("energychange", { energy: this.options.energy });
      return this;
    }

    setSpeed(value, emit = true) {
      this.options.speed = clamp(value, 0, 2, .62);
      if (emit) this._emit("speedchange", { speed: this.options.speed });
      return this;
    }

    setInteractive(enabled, emit = true) {
      const next = Boolean(enabled);
      this.options.interactive = next;
      if (this.mounted) {
        if (next && !this._interactiveBound) {
          global.addEventListener("pointermove", this._handlers.pointerMove, { passive: true });
          global.addEventListener("pointerout", this._handlers.pointerOut, { passive: true });
          this._interactiveBound = true;
        } else if (!next && this._interactiveBound) {
          global.removeEventListener("pointermove", this._handlers.pointerMove);
          global.removeEventListener("pointerout", this._handlers.pointerOut);
          this._interactiveBound = false;
          this.pointer.active = false;
        }
      }
      if (emit) this._emit("interactivechange", { interactive: next });
      return this;
    }

    start() {
      if (!this.mounted || this.running || this.options.preset === "off") return this;
      this.running = true;
      this._lastTime = global.performance?.now?.() || Date.now();
      this._raf = global.requestAnimationFrame((time) => this._frame(time));
      this._emit("started", this.getState());
      return this;
    }

    stop(clear = false) {
      this.running = false;
      if (this._raf) global.cancelAnimationFrame(this._raf);
      this._raf = 0;
      if (clear && this.context) this.context.clearRect(0, 0, this.width, this.height);
      this._emit("stopped", this.getState());
      return this;
    }

    resize() {
      if (!this.canvas || !this.context) return this;
      const width = Math.max(1, global.innerWidth || this.document.documentElement.clientWidth || 1);
      const height = Math.max(1, global.innerHeight || this.document.documentElement.clientHeight || 1);
      const dpr = Math.min(clamp(global.devicePixelRatio || 1, 1, 4, 1), clamp(this.options.maxDpr, 1, 2.5, 1.75));
      const changed = width !== this.width || height !== this.height || dpr !== this.dpr;
      this.width = width;
      this.height = height;
      this.dpr = dpr;
      this.canvas.width = Math.round(width * dpr);
      this.canvas.height = Math.round(height * dpr);
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;
      this.context.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (changed) this._rebuildParticles();
      return this;
    }

    burstAt(target, options = {}) {
      if (!this.mounted || this.options.preset === "off") return null;
      const point = resolveTargetPoint(target, this.document);
      if (!point) return null;
      const count = Math.round(clamp(options.count, 4, 60, 18));
      const colorIndex = Math.max(0, Math.min(3, Number(options.colorIndex) || 0));
      const strength = clamp(options.strength, .1, 3, 1);
      const burst = [];
      for (let index = 0; index < count; index += 1) {
        const angle = this._random() * Math.PI * 2;
        const speed = (22 + this._random() * 90) * strength;
        burst.push({
          x: point.x,
          y: point.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 1 + this._random() * 3.2,
          age: 0,
          life: .55 + this._random() * .75,
          colorIndex
        });
      }
      this.bursts.push(...burst);
      this.start();
      this._emit("burst", { point, count, strength });
      return burst.length;
    }

    getState() {
      return {
        version: VERSION,
        mounted: this.mounted,
        running: this.running,
        preset: this.options.preset,
        density: this.options.density,
        energy: this.options.energy,
        speed: this.options.speed,
        interactive: this.options.interactive,
        particles: this.particles.length,
        quality: this.engine.getState().quality,
        motion: this.engine.getState().motion,
        localOnly: true,
        telemetry: false
      };
    }

    destroy() {
      if (!this.mounted) return this;
      this.stop(true);
      global.removeEventListener("resize", this._handlers.resize);
      global.removeEventListener("pointermove", this._handlers.pointerMove);
      global.removeEventListener("pointerout", this._handlers.pointerOut);
      this._interactiveBound = false;
      this.root.removeEventListener("axmvisual:themechange", this._handlers.state);
      this.root.removeEventListener("axmvisual:qualitychange", this._handlers.state);
      this.root.removeEventListener("axmvisual:motionchange", this._handlers.state);
      this.root.removeEventListener("axmvisual:intensitychange", this._handlers.state);
      this.document.removeEventListener("visibilitychange", this._handlers.visibility);
      this._resizeObserver?.disconnect();
      this._resizeObserver = null;
      this.canvas?.remove();
      this.canvas = null;
      this.context = null;
      this.particles = [];
      this.bursts = [];
      this.mounted = false;
      this._emit("destroyed", { version: VERSION });
      return this;
    }

    _onEngineState() {
      if (!this.mounted) return;
      this._syncColors();
      this._rebuildParticles();
      const state = this.engine.getState();
      if (state.quality === "low" || state.motion === "off" || this.options.preset === "off") {
        this.stop(false);
        this._draw(global.performance?.now?.() || Date.now(), 0);
      } else {
        this.start();
      }
    }

    _onVisibility() {
      if (this.document.hidden) this.stop(false);
      else if (this.options.preset !== "off") this.start();
    }

    _onPointerMove(event) {
      this.pointer.x = event.clientX;
      this.pointer.y = event.clientY;
      this.pointer.active = true;
    }

    _syncColors() {
      if (!this.context) return;
      const styles = global.getComputedStyle(this.root);
      const fallbacks = [
        { r: 112, g: 245, b: 255 },
        { r: 141, g: 120, b: 255 },
        { r: 255, g: 114, b: 210 },
        { r: 240, g: 212, b: 140 }
      ];
      this.colors = ["--axm-accent-1", "--axm-accent-2", "--axm-accent-3", "--axm-lux"].map((name, index) => {
        return parseColor(this.context, styles.getPropertyValue(name).trim(), fallbacks[index]);
      });
    }

    _particleCount() {
      const state = this.engine.getState();
      if (state.quality === "low" || this.options.preset === "off") return 0;
      const areaScale = clamp((this.width * this.height) / 1_000_000, .55, 2.2, 1);
      const qualityBase = state.quality === "high" ? 96 : 58;
      const presetFactor = {
        constellation: .62,
        nebula: .38,
        fireflies: .42,
        embers: .72,
        crystal: .48,
        snow: .9,
        "data-rain": .55,
        orbitals: .36,
        motes: .48,
        warp: .52,
        stardust: 1
      }[this.options.preset] || 1;
      return Math.round(clamp(qualityBase * areaScale * this.options.density * presetFactor, 0, 190, 0));
    }

    _rebuildParticles() {
      if (!this.mounted || !this.width || !this.height) return;
      this._random = hashSeed(this.options.seed + this.width + this.height + this.options.preset.length * 97);
      const count = this._particleCount();
      this.particles = Array.from({ length: count }, (_, index) => this._createParticle(index));
      this._syncColors();
      if (!this.running) {
        this._draw(global.performance?.now?.() || Date.now(), 0);
        const state = this.engine.getState();
        if (count > 0 && this.options.autoStart && state.motion !== "off" && state.quality !== "low") this.start();
      }
    }

    _createParticle(index) {
      const preset = this.options.preset;
      const particle = {
        x: this._random() * this.width,
        y: this._random() * this.height,
        vx: (this._random() - .5) * 8,
        vy: (this._random() - .5) * 8,
        size: .45 + this._random() * 2.1,
        phase: this._random() * Math.PI * 2,
        twinkle: .5 + this._random() * 1.6,
        colorIndex: index % 4,
        rotation: this._random() * Math.PI * 2,
        spin: (this._random() - .5) * .24,
        length: 8 + this._random() * 46,
        radius: 0,
        orbitSpeed: 0,
        radialSpeed: 0
      };

      if (preset === "embers") {
        particle.vx = (this._random() - .5) * 16;
        particle.vy = -(14 + this._random() * 46);
        particle.size = .8 + this._random() * 2.8;
        particle.colorIndex = this._random() > .35 ? 3 : 2;
      } else if (preset === "fireflies") {
        particle.vx = (this._random() - .5) * 12;
        particle.vy = (this._random() - .5) * 9;
        particle.size = 1.4 + this._random() * 3.8;
      } else if (preset === "snow") {
        particle.vx = (this._random() - .5) * 12;
        particle.vy = 10 + this._random() * 34;
        particle.size = .7 + this._random() * 2.4;
        particle.colorIndex = this._random() > .5 ? 0 : 1;
      } else if (preset === "data-rain") {
        particle.vx = 0;
        particle.vy = 24 + this._random() * 86;
        particle.size = .6 + this._random() * 1.3;
        particle.length = 10 + this._random() * 60;
      } else if (preset === "crystal") {
        particle.vx = (this._random() - .5) * 12;
        particle.vy = (this._random() - .5) * 8;
        particle.size = 2 + this._random() * 6;
      } else if (preset === "nebula") {
        particle.vx = (this._random() - .5) * 4;
        particle.vy = (this._random() - .5) * 3;
        particle.size = 2 + this._random() * 6;
      } else if (preset === "motes") {
        particle.vx = (this._random() - .5) * 5;
        particle.vy = (this._random() - .5) * 4;
        particle.size = .9 + this._random() * 2.8;
        particle.twinkle = .25 + this._random() * .65;
      } else if (preset === "orbitals") {
        particle.radius = 42 + this._random() * Math.min(this.width, this.height) * .48;
        particle.orbitSpeed = (.08 + this._random() * .22) * (this._random() > .5 ? 1 : -1);
        particle.size = .8 + this._random() * 2.6;
        particle.phase = this._random() * Math.PI * 2;
        particle.x = this.width / 2 + Math.cos(particle.phase) * particle.radius;
        particle.y = this.height * .44 + Math.sin(particle.phase) * particle.radius * .42;
      } else if (preset === "warp") {
        particle.phase = this._random() * Math.PI * 2;
        particle.radius = 8 + this._random() * Math.max(this.width, this.height) * .62;
        particle.radialSpeed = 46 + this._random() * 150;
        particle.length = 16 + this._random() * 70;
        particle.size = .55 + this._random() * 1.5;
        particle.x = this.width / 2 + Math.cos(particle.phase) * particle.radius;
        particle.y = this.height * .45 + Math.sin(particle.phase) * particle.radius * .64;
      }
      return particle;
    }

    _targetInterval() {
      const state = this.engine.getState();
      if (state.motion === "off" || state.quality === "low") return Infinity;
      if (state.motion === "reduced") return 1000 / 12;
      return state.quality === "high" ? 1000 / 48 : 1000 / 30;
    }

    _frame(time) {
      if (!this.running) return;
      const interval = this._targetInterval();
      if (time - this._lastDraw >= interval) {
        const dt = Math.min(.05, Math.max(0, (time - this._lastTime) / 1000));
        this._lastTime = time;
        this._lastDraw = time;
        this._draw(time, dt);
        if (!this.particles.length && !this.bursts.length) {
          this.stop(false);
          return;
        }
      }
      this._raf = global.requestAnimationFrame((next) => this._frame(next));
    }

    _draw(time, dt) {
      if (!this.context || !this.width || !this.height) return;
      const context = this.context;
      context.clearRect(0, 0, this.width, this.height);
      if (this.options.preset === "off") return;

      const state = this.engine.getState();
      const intensity = clamp(state.intensity, 0, 1.8, 1) * this.options.energy;
      const seconds = time / 1000;
      const speed = this.options.speed * (state.motion === "reduced" ? .22 : 1);

      if (this.options.preset === "nebula") this._drawNebula(context, seconds, intensity);
      if (this.options.preset === "constellation") this._drawConstellations(context, intensity);

      for (const particle of this.particles) {
        this._updateParticle(particle, dt * speed);
        this._drawParticle(context, particle, seconds, intensity);
      }
      this._drawBursts(context, dt, intensity);
    }

    _updateParticle(particle, dt) {
      const preset = this.options.preset;
      if (dt > 0) {
        if (preset === "orbitals") {
          particle.phase += particle.orbitSpeed * dt;
          particle.x = this.width / 2 + Math.cos(particle.phase) * particle.radius;
          particle.y = this.height * .44 + Math.sin(particle.phase) * particle.radius * .42;
          particle.rotation += particle.spin * dt;
          return;
        }
        if (preset === "warp") {
          particle.radius += particle.radialSpeed * dt;
          const maxRadius = Math.max(this.width, this.height) * .78;
          if (particle.radius > maxRadius) {
            particle.radius = 6 + this._random() * 24;
            particle.phase = this._random() * Math.PI * 2;
          }
          particle.x = this.width / 2 + Math.cos(particle.phase) * particle.radius;
          particle.y = this.height * .45 + Math.sin(particle.phase) * particle.radius * .64;
          particle.rotation = particle.phase;
          return;
        }
        if (preset === "fireflies" || preset === "motes") {
          particle.vx += Math.sin(particle.phase) * dt * 2.4;
          particle.vy += Math.cos(particle.phase * .7) * dt * 1.8;
        }
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.rotation += particle.spin * dt;
        particle.phase += dt * particle.twinkle;
      }

      if (this.pointer.active && this.options.interactive && ["stardust", "constellation", "fireflies", "crystal", "motes"].includes(preset)) {
        const dx = particle.x - this.pointer.x;
        const dy = particle.y - this.pointer.y;
        const distance2 = dx * dx + dy * dy;
        if (distance2 < 18000 && distance2 > 4) {
          const force = (1 - distance2 / 18000) * .45;
          particle.x += dx * force * .035;
          particle.y += dy * force * .035;
        }
      }

      const margin = 70;
      if (particle.x < -margin) particle.x = this.width + margin;
      else if (particle.x > this.width + margin) particle.x = -margin;
      if (particle.y < -margin) particle.y = this.height + margin;
      else if (particle.y > this.height + margin) particle.y = -margin;
    }

    _drawParticle(context, particle, seconds, intensity) {
      const preset = this.options.preset;
      const color = this.colors[particle.colorIndex % this.colors.length] || { r: 255, g: 255, b: 255 };
      const pulse = .52 + Math.sin(particle.phase + seconds * particle.twinkle) * .34;
      const alpha = clamp(pulse * .36 * intensity, .025, .78, .2);

      if (preset === "warp") {
        const cx = this.width / 2;
        const cy = this.height * .45;
        const dx = particle.x - cx;
        const dy = particle.y - cy;
        const length = Math.max(5, particle.length * Math.min(1, particle.radius / 260));
        const magnitude = Math.max(1, Math.hypot(dx, dy));
        const ux = dx / magnitude;
        const uy = dy / magnitude;
        const gradient = context.createLinearGradient(particle.x - ux * length, particle.y - uy * length, particle.x, particle.y);
        gradient.addColorStop(0, rgba(color, 0));
        gradient.addColorStop(.7, rgba(color, alpha * .36));
        gradient.addColorStop(1, rgba({ r: 255, g: 255, b: 255 }, Math.min(1, alpha * 1.8)));
        context.save();
        context.globalCompositeOperation = "lighter";
        context.strokeStyle = gradient;
        context.lineWidth = particle.size;
        context.beginPath();
        context.moveTo(particle.x - ux * length, particle.y - uy * length);
        context.lineTo(particle.x, particle.y);
        context.stroke();
        context.restore();
        return;
      }

      if (preset === "data-rain") {
        const gradient = context.createLinearGradient(particle.x, particle.y - particle.length, particle.x, particle.y);
        gradient.addColorStop(0, rgba(color, 0));
        gradient.addColorStop(.75, rgba(color, alpha * .26));
        gradient.addColorStop(1, rgba(color, alpha));
        context.strokeStyle = gradient;
        context.lineWidth = particle.size;
        context.beginPath();
        context.moveTo(particle.x, particle.y - particle.length);
        context.lineTo(particle.x, particle.y);
        context.stroke();
        return;
      }

      if (preset === "crystal") {
        context.save();
        context.translate(particle.x, particle.y);
        context.rotate(particle.rotation);
        context.beginPath();
        context.moveTo(0, -particle.size * 1.8);
        context.lineTo(particle.size, particle.size);
        context.lineTo(-particle.size * .75, particle.size * .55);
        context.closePath();
        context.fillStyle = rgba(color, alpha * .55);
        context.strokeStyle = rgba(this.colors[(particle.colorIndex + 1) % this.colors.length], alpha * .72);
        context.lineWidth = .7;
        context.fill();
        context.stroke();
        context.restore();
        return;
      }

      if (preset === "embers") {
        context.save();
        context.globalCompositeOperation = "lighter";
        context.strokeStyle = rgba(color, alpha);
        context.lineWidth = Math.max(.7, particle.size * .55);
        context.beginPath();
        context.moveTo(particle.x, particle.y + particle.size * 5);
        context.lineTo(particle.x - particle.vx * .08, particle.y);
        context.stroke();
        context.restore();
        return;
      }

      const glowSize = particle.size * (preset === "fireflies" ? 7 : preset === "motes" ? 5.5 : preset === "orbitals" ? 4.8 : preset === "nebula" ? 5 : 3.6);
      const gradient = context.createRadialGradient(particle.x, particle.y, 0, particle.x, particle.y, glowSize);
      gradient.addColorStop(0, rgba(color, Math.min(1, alpha * 2.2)));
      gradient.addColorStop(.22, rgba(color, alpha));
      gradient.addColorStop(1, rgba(color, 0));
      context.save();
      context.globalCompositeOperation = "lighter";
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(particle.x, particle.y, glowSize, 0, Math.PI * 2);
      context.fill();
      if (["stardust", "constellation", "snow", "orbitals"].includes(preset)) {
        context.fillStyle = rgba({ r: 255, g: 255, b: 255 }, Math.min(.92, alpha * 1.8));
        context.beginPath();
        context.arc(particle.x, particle.y, Math.max(.35, particle.size * .36), 0, Math.PI * 2);
        context.fill();
      }
      context.restore();
    }

    _drawNebula(context, seconds, intensity) {
      context.save();
      context.globalCompositeOperation = "lighter";
      const positions = [
        [.22 + Math.sin(seconds * .07) * .04, .28, .34, 0],
        [.72, .36 + Math.cos(seconds * .06) * .04, .38, 1],
        [.48 + Math.cos(seconds * .05) * .05, .78, .32, 2]
      ];
      for (const [x, y, radius, colorIndex] of positions) {
        const color = this.colors[colorIndex];
        const r = Math.max(this.width, this.height) * radius;
        const gradient = context.createRadialGradient(this.width * x, this.height * y, 0, this.width * x, this.height * y, r);
        gradient.addColorStop(0, rgba(color, .055 * intensity));
        gradient.addColorStop(.38, rgba(color, .025 * intensity));
        gradient.addColorStop(1, rgba(color, 0));
        context.fillStyle = gradient;
        context.fillRect(0, 0, this.width, this.height);
      }
      context.restore();
    }

    _drawConstellations(context, intensity) {
      const maxDistance = Math.min(160, Math.max(80, this.width * .12));
      const maxDistance2 = maxDistance * maxDistance;
      context.save();
      context.lineWidth = .55;
      for (let a = 0; a < this.particles.length; a += 1) {
        const first = this.particles[a];
        for (let b = a + 1; b < this.particles.length; b += 1) {
          const second = this.particles[b];
          const dx = first.x - second.x;
          const dy = first.y - second.y;
          const distance2 = dx * dx + dy * dy;
          if (distance2 > maxDistance2) continue;
          const alpha = (1 - distance2 / maxDistance2) * .11 * intensity;
          context.strokeStyle = rgba(this.colors[(a + b) % 3], alpha);
          context.beginPath();
          context.moveTo(first.x, first.y);
          context.lineTo(second.x, second.y);
          context.stroke();
        }
      }
      context.restore();
    }

    _drawBursts(context, dt, intensity) {
      if (!this.bursts.length) return;
      context.save();
      context.globalCompositeOperation = "lighter";
      this.bursts = this.bursts.filter((particle) => {
        particle.age += dt;
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vx *= Math.pow(.06, dt);
        particle.vy *= Math.pow(.06, dt);
        const remaining = 1 - particle.age / particle.life;
        if (remaining <= 0) return false;
        const color = this.colors[particle.colorIndex % this.colors.length];
        const radius = particle.size * (1.5 + remaining * 3.5);
        const gradient = context.createRadialGradient(particle.x, particle.y, 0, particle.x, particle.y, radius);
        gradient.addColorStop(0, rgba({ r: 255, g: 255, b: 255 }, remaining * intensity));
        gradient.addColorStop(.25, rgba(color, remaining * .7 * intensity));
        gradient.addColorStop(1, rgba(color, 0));
        context.fillStyle = gradient;
        context.beginPath();
        context.arc(particle.x, particle.y, radius, 0, Math.PI * 2);
        context.fill();
        return true;
      });
      context.restore();
    }

    _emit(name, detail) {
      if (!this.root || typeof global.CustomEvent !== "function") return;
      this.root.dispatchEvent(new global.CustomEvent(`axmfield:${name}`, { detail }));
    }
  }

  global.AXMAetherfield = AXMAetherfield;
})(typeof window !== "undefined" ? window : globalThis);
