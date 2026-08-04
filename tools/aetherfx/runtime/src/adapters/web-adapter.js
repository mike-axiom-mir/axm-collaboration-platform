(function (root) {
  'use strict';
  const AXM = root.AXM;
  const CSS_VAR_PATTERN = /^--(?:fx|axm)-[a-z0-9-]+$/;
  const CLASS_PATTERN = /^fx-[a-z0-9_-]+$/;
  const HEX_COLOR_PATTERN = /^#[0-9a-f]{3}(?:[0-9a-f]{3})?(?:[0-9a-f]{2})?$/i;

  function setVars(target, module, params) {
    (module.parameters || []).forEach((definition) => {
      if (!definition.cssVar || !CSS_VAR_PATTERN.test(definition.cssVar) || params[definition.id] === undefined) return;
      const value = params[definition.id];
      if (definition.type === 'number' && !Number.isFinite(Number(value))) return;
      if (definition.type === 'color' && !HEX_COLOR_PATTERN.test(String(value))) return;
      if (!['number', 'color'].includes(definition.type)) return;
      const rendered = definition.type === 'number' && definition.unit ? `${value}${definition.unit}` : String(value);
      target.style.setProperty(definition.cssVar, rendered);
    });
  }

  AXM.WebAdapter = class WebAdapter {
    constructor(stage) {
      if (!stage) throw new Error('WebAdapter requires a preview stage element.');
      this.stage = stage;
      this.sceneHost = stage.querySelector('[data-axm-layer="scene"]');
      this.layers = {
        ambient: stage.querySelector('[data-axm-layer="ambient"]'),
        light: stage.querySelector('[data-axm-layer="light"]'),
        atmosphere: stage.querySelector('[data-axm-layer="atmosphere"]')
      };
      this.abortController = null;
      this.lastCompiled = null;
    }

    cleanup() {
      this.abortController?.abort();
      this.abortController = new AbortController();
      Object.values(this.layers).forEach((layer) => { layer.innerHTML = ''; layer.removeAttribute('style'); layer.className = `axm-${layer.dataset.axmLayer}-layer`; });
      this.stage.removeAttribute('style');
      this.stage.className = 'axm-stage';
      this.stage.querySelectorAll('.fx-ripple-instance').forEach((node) => node.remove());
    }

    targets(scope, targetRole = null) {
      const scene = this.sceneHost.querySelector('.axm-scene');
      const role = (name) => [...this.sceneHost.querySelectorAll(`[data-axm-role~="${name}"]`)];
      let targets;
      switch (scope) {
        case 'stage': targets = [this.stage]; break;
        case 'scene': targets = scene ? [scene] : []; break;
        case 'surface': targets = role('surface'); break;
        case 'active': targets = role('active'); break;
        case 'loading': targets = role('loading'); break;
        case 'ambient': targets = [this.layers.ambient]; break;
        case 'light': targets = [this.layers.light]; break;
        case 'atmosphere': targets = [this.layers.atmosphere]; break;
        default: targets = scene ? [scene] : [this.stage];
      }
      if (!targetRole || ['stage', 'ambient', 'light', 'atmosphere'].includes(scope)) return targets;
      return targets.filter((target) => String(target.dataset?.axmRole || '').split(/\s+/).includes(targetRole));
    }

    applyGlobals(recipe, registry, resolvedQuality) {
      const globals = recipe.globals || {};
      const mood = registry.mood(globals.mood) || { accent: '#58e6ff', accent2: '#a56cff', warm: '#ff75d8', bg: '#050814' };
      this.stage.style.setProperty('--axm-accent', mood.accent);
      this.stage.style.setProperty('--axm-accent-2', mood.accent2);
      this.stage.style.setProperty('--axm-warm', mood.warm);
      this.stage.style.setProperty('--axm-bg', mood.bg);
      this.stage.style.setProperty('--fx-global-intensity', String(globals.intensity ?? 0.72));
      this.stage.style.setProperty('--fx-global-depth', String(globals.depth ?? 0.64));
      this.stage.style.setProperty('--fx-motion-scale', String(globals.motion ?? 0.68));
      this.stage.classList.add(`quality-${resolvedQuality}`);
      if (globals.reducedMotion) this.stage.classList.add('is-reduced-motion');
      if (globals.photosensitiveSafe) this.stage.classList.add('is-photosensitive-safe');
      if (globals.highContrast) this.stage.classList.add('is-high-contrast');
      if (globals.largeText) this.stage.classList.add('is-large-text');
    }

    addOverlay(item) {
      const renderer = item.module.renderer;
      if (!CLASS_PATTERN.test(String(renderer.className || ''))) return null;
      const host = this.layers[renderer.scope] || this.layers.light;
      const overlay = document.createElement('div');
      overlay.className = `axm-fx-overlay ${renderer.className}`;
      overlay.dataset.moduleId = item.moduleId;
      overlay.dataset.instanceId = item.instanceId;
      setVars(overlay, item.module, item.params);

      if (renderer.generatedCount || renderer.className === 'fx-overlay-particles') {
        const countBase = AXM.Utils.clamp(Math.round(Number(renderer.generatedCount || 20)), 0, 256);
        const density = Number(item.params.density ?? 0.5);
        const qualityMultiplier = this.stage.classList.contains('quality-cinematic') ? 1.6 : this.stage.classList.contains('quality-high') ? 1.2 : 0.8;
        const count = Math.max(4, Math.round(countBase * density * qualityMultiplier));
        for (let index = 0; index < count; index += 1) {
          const mote = document.createElement('i');
          const x = (index * 37 + 11) % 97;
          const y = (index * 53 + 17) % 93;
          const size = 1 + ((index * 7) % 5);
          const delay = -((index * 0.61) % 12);
          mote.style.cssText = `--mote-x:${x}%;--mote-y:${y}%;--mote-size:${size}px;--mote-delay:${delay}s;--mote-depth:${(index % 5) - 2};`;
          if (renderer.particleMode) mote.dataset.particleMode = renderer.particleMode;
          overlay.appendChild(mote);
        }
      }
      host.appendChild(overlay);
      return overlay;
    }

    bindPointerSpotlight(overlay) {
      const signal = this.abortController.signal;
      const update = (event) => {
        const rect = this.stage.getBoundingClientRect();
        overlay.style.setProperty('--pointer-x', `${event.clientX - rect.left}px`);
        overlay.style.setProperty('--pointer-y', `${event.clientY - rect.top}px`);
      };
      this.stage.addEventListener('pointermove', update, { signal });
      this.stage.addEventListener('pointerenter', update, { signal });
    }

    bindClickRipple(item) {
      const signal = this.abortController.signal;
      this.stage.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        const rect = this.stage.getBoundingClientRect();
        const ripple = document.createElement('span');
        ripple.className = 'fx-ripple-instance';
        ripple.style.left = `${event.clientX - rect.left}px`;
        ripple.style.top = `${event.clientY - rect.top}px`;
        setVars(ripple, item.module, item.params);
        this.stage.appendChild(ripple);
        const duration = Number(item.params.duration || 620);
        setTimeout(() => ripple.remove(), duration + 80);
      }, { signal });
    }

    bindParallax(item) {
      const signal = this.abortController.signal;
      let currentX = 0;
      let currentY = 0;
      let targetX = 0;
      let targetY = 0;
      let frame = null;
      const damping = Number(item.params.damping || 0.12);
      const distance = Number(item.params.distance || 10);
      const animate = () => {
        currentX += (targetX - currentX) * damping;
        currentY += (targetY - currentY) * damping;
        this.stage.style.setProperty('--parallax-x', `${currentX * distance}px`);
        this.stage.style.setProperty('--parallax-y', `${currentY * distance}px`);
        if (Math.abs(targetX - currentX) > 0.001 || Math.abs(targetY - currentY) > 0.001) frame = requestAnimationFrame(animate);
        else frame = null;
      };
      this.stage.addEventListener('pointermove', (event) => {
        const rect = this.stage.getBoundingClientRect();
        targetX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
        targetY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
        if (!frame) frame = requestAnimationFrame(animate);
      }, { signal });
      this.stage.addEventListener('pointerleave', () => {
        targetX = 0; targetY = 0;
        if (!frame) frame = requestAnimationFrame(animate);
      }, { signal });
      signal.addEventListener('abort', () => { if (frame) cancelAnimationFrame(frame); }, { once: true });
    }

    applyItem(item) {
      const renderer = item.module.renderer || {};
      if (renderer.type === 'class') {
        if (!CLASS_PATTERN.test(String(renderer.className || ''))) return;
        this.targets(renderer.scope, item.targetRole).forEach((target) => {
          target.classList.add(renderer.className);
          setVars(target, item.module, item.params);
        });
        return;
      }
      if (renderer.type === 'overlay') {
        const overlay = this.addOverlay(item);
        if (overlay && renderer.interactive === 'pointer') this.bindPointerSpotlight(overlay);
        return;
      }
      if (renderer.type === 'interaction') {
        if (!CLASS_PATTERN.test(String(renderer.className || ''))) return;
        this.targets(renderer.scope, item.targetRole).forEach((target) => { target.classList.add(renderer.className); setVars(target, item.module, item.params); });
        if (renderer.interactive === 'click') this.bindClickRipple(item);
        if (renderer.interactive === 'parallax') this.bindParallax(item);
      }
    }

    render(compiled, registry) {
      this.cleanup();
      const sceneModule = registry.get(compiled.recipe.sceneId);
      this.sceneHost.innerHTML = AXM.Scenes.render(sceneModule);
      this.applyGlobals(compiled.recipe, registry, compiled.resolvedQuality);
      compiled.plan.forEach((item) => this.applyItem(item));
      this.lastCompiled = compiled;
      this.stage.dataset.ready = 'true';
      this.stage.dispatchEvent(new CustomEvent('axm-rendered', { detail: compiled }));
    }

    cloneStage() {
      const clone = this.stage.cloneNode(true);
      clone.querySelectorAll('.fx-ripple-instance').forEach((node) => node.remove());
      clone.removeAttribute('data-ready');
      return clone;
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
