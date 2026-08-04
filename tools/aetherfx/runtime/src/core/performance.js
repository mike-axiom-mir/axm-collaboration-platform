(function (root) {
  'use strict';
  const AXM = root.AXM;

  const QUALITY_ORDER = ['low', 'medium', 'high'];
  const QUALITY_MULTIPLIER = { low: 0.48, medium: 0.72, high: 1, cinematic: 1.35 };
  const BIAS = {
    battery: { target: 48, upgrade: 59, initialCap: 'medium', costCap: 48 },
    balanced: { target: 54, upgrade: 59, initialCap: 'high', costCap: 70 },
    quality: { target: 48, upgrade: 57, initialCap: 'high', costCap: 92 }
  };

  function clampQuality(quality, cap) {
    const qualityIndex = QUALITY_ORDER.indexOf(quality);
    const capIndex = QUALITY_ORDER.indexOf(cap);
    if (qualityIndex < 0) return cap;
    return QUALITY_ORDER[Math.min(qualityIndex, capIndex)];
  }

  function baseModuleCost(item) {
    const id = String(item?.moduleId || '');
    const renderer = item?.module?.renderer || {};
    let cost = renderer.type === 'overlay' ? 3 : renderer.type === 'interaction' ? 2 : 1.2;
    if (/blur|bloom|frost|liquid|crystal|reflection|prism|dispersion|caustic|godray|volumetric|aurora|fog/i.test(id)) cost += 3.4;
    if (/particle|dust|rain|atmosphere|field/i.test(id)) cost += 2.8;
    if (/shimmer|sweep|scanline|pulse|ripple|parallax|magnetic|spring|trail/i.test(id)) cost += 1.8;
    if (/shadow|vignette|focus|edge|rim|halo/i.test(id)) cost += 0.9;
    if (renderer.generatedCount) cost += Math.min(4, Number(renderer.generatedCount || 0) / 10);
    return cost;
  }

  function percentile(values, fraction) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.max(0, Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction)))];
  }

  AXM.PerformanceGovernor = class PerformanceGovernor {
    constructor(options = {}) {
      this.onChange = options.onChange || (() => {});
      this.samples = [];
      this.running = false;
      this.last = 0;
      this.bias = options.bias || 'balanced';
      this.lastDecision = this.detectInitialQuality();
      this.stableSince = (root.performance?.now?.() || Date.now());
      this.frame = null;
      this.lastEvaluation = null;
      this.transitions = [];
    }

    static estimatePlan(plan = [], quality = 'high', globals = {}) {
      const effectiveQuality = quality === 'auto' ? (globals.resolvedQuality || 'high') : quality;
      const qualityMultiplier = QUALITY_MULTIPLIER[effectiveQuality] || 1;
      const motionMultiplier = globals.reducedMotion ? 0.72 : 0.82 + Number(globals.motion ?? 0.68) * 0.38;
      const safetyMultiplier = globals.photosensitiveSafe ? 0.86 : 1;
      const items = plan.map((item) => ({
        moduleId: item.moduleId,
        name: item.module?.name || item.moduleId,
        score: Number((baseModuleCost(item) * qualityMultiplier * motionMultiplier * safetyMultiplier).toFixed(2))
      })).sort((a, b) => b.score - a.score);
      const score = Number(items.reduce((sum, item) => sum + item.score, 0).toFixed(2));
      const tier = score < 30 ? 'light' : score < 58 ? 'balanced' : score < 88 ? 'heavy' : 'extreme';
      const recommendedQuality = score > 95 ? 'low' : score > 66 ? 'medium' : 'high';
      return {
        score,
        tier,
        recommendedQuality,
        resolvedQuality: effectiveQuality,
        activeModules: plan.length,
        topContributors: items.slice(0, 8),
        note: 'Estimated visual load from declared effect behavior. Actual device performance is measured separately in FPS.'
      };
    }

    detectInitialQuality() {
      const nav = root.navigator || {};
      const memory = Number(nav.deviceMemory || 0);
      const cores = Number(nav.hardwareConcurrency || 0);
      const reduced = Boolean(root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
      let quality = 'high';
      if ((memory && memory <= 2) || (cores && cores <= 2)) quality = 'low';
      else if ((memory && memory <= 4) || (cores && cores <= 4) || reduced) quality = 'medium';
      return clampQuality(quality, (BIAS[this.bias] || BIAS.balanced).initialCap);
    }

    setBias(bias) {
      if (!BIAS[bias]) return;
      this.bias = bias;
      this.lastDecision = clampQuality(this.lastDecision, BIAS[bias].initialCap);
      this.stableSince = root.performance?.now?.() || Date.now();
    }

    start() {
      if (this.running || typeof root.requestAnimationFrame !== 'function') return;
      this.running = true;
      this.last = root.performance?.now?.() || Date.now();
      const tick = (now) => {
        if (!this.running) return;
        const delta = now - this.last;
        this.last = now;
        if (delta > 0 && delta < 1000) this.samples.push(1000 / delta);
        if (this.samples.length > 180) this.samples.shift();
        if (this.samples.length >= 75) this.evaluate(now);
        this.frame = root.requestAnimationFrame(tick);
      };
      this.frame = root.requestAnimationFrame(tick);
    }

    stop() {
      this.running = false;
      if (this.frame && typeof root.cancelAnimationFrame === 'function') root.cancelAnimationFrame(this.frame);
      this.frame = null;
    }

    evaluate(now) {
      const average = this.averageFps;
      const lowPercentile = percentile(this.samples, 0.1);
      const profile = BIAS[this.bias] || BIAS.balanced;
      const currentIndex = QUALITY_ORDER.indexOf(this.lastDecision);
      let decision = this.lastDecision;
      let reason = 'stable';

      const severeDrop = average < profile.target - 12 || lowPercentile < profile.target - 20;
      const belowTarget = average < profile.target || lowPercentile < profile.target - 10;
      const strongHeadroom = average > profile.upgrade && lowPercentile > profile.target;
      const timeStable = now - this.stableSince;

      if (severeDrop && currentIndex > 0 && timeStable > 1600) {
        decision = QUALITY_ORDER[Math.max(0, currentIndex - 1)];
        reason = 'sustained frame loss';
      } else if (belowTarget && currentIndex > 0 && timeStable > 3000) {
        decision = QUALITY_ORDER[currentIndex - 1];
        reason = 'below target';
      } else if (strongHeadroom && currentIndex < QUALITY_ORDER.length - 1 && timeStable > 9000) {
        decision = QUALITY_ORDER[currentIndex + 1];
        decision = clampQuality(decision, profile.initialCap);
        reason = 'stable headroom';
      }

      this.lastEvaluation = { average, lowPercentile, decision, reason, bias: this.bias, at: new Date().toISOString() };
      if (decision !== this.lastDecision) {
        const prior = this.lastDecision;
        this.lastDecision = decision;
        this.stableSince = now;
        this.transitions.push({ from: prior, to: decision, reason, fps: average, lowPercentile, at: new Date().toISOString() });
        if (this.transitions.length > 20) this.transitions.shift();
        this.onChange({ quality: decision, fps: average, lowPercentile, reason, bias: this.bias });
      }
    }

    get averageFps() {
      if (!this.samples.length) return 0;
      return this.samples.reduce((sum, value) => sum + value, 0) / this.samples.length;
    }

    get lowPercentileFps() {
      return percentile(this.samples, 0.1);
    }

    snapshot() {
      const nav = root.navigator || {};
      return {
        bias: this.bias,
        decision: this.lastDecision,
        averageFps: Number(this.averageFps.toFixed(1)),
        lowPercentileFps: Number(this.lowPercentileFps.toFixed(1)),
        sampleCount: this.samples.length,
        hardware: {
          logicalProcessors: Number(nav.hardwareConcurrency || 0) || null,
          deviceMemoryGb: Number(nav.deviceMemory || 0) || null,
          reducedMotionPreference: Boolean(root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)
        },
        lastEvaluation: this.lastEvaluation,
        transitions: [...this.transitions]
      };
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
