(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MirrorShiftEcho = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SCHEMA = 'axm.mirror-echo/v2';
  const MAX_ECHOES = 18;
  const MAX_SAMPLES = 720;
  const MIN_SAMPLE_GAP_MS = 70;
  const MIN_LAP_MS = 1000;
  const MIN_SAMPLES = 6;
  const TAU = Math.PI * 2;

  function finite(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function angleDelta(target, source) {
    let delta = finite(target, 0) - finite(source, 0);
    while (delta > Math.PI) delta -= TAU;
    while (delta < -Math.PI) delta += TAU;
    return delta;
  }

  function normalizeDirection(directionId) {
    return String(directionId || 'forward') === 'reflection' ? 'reflection' : 'forward';
  }

  function courseKey(trackId, variantId, directionId) {
    return String(trackId || '') + '::' + String(variantId || '') + '::' + normalizeDirection(directionId);
  }

  function sourceFrom(racer) {
    return Object.freeze({
      racerId: String(racer.id || ''),
      characterId: String(racer.characterId || racer.id || ''),
      character: String(racer.character || 'Unknown'),
      vehicle: String(racer.vehicle || 'Echo chassis'),
      color: String(racer.color || '#35f2ff'),
      accent: String(racer.accent || '#ffffff')
    });
  }

  function sampleFrom(racer, time) {
    return {
      t: Math.max(0, finite(time, 0)),
      x: finite(racer.x, 0),
      y: finite(racer.y, 0),
      heading: finite(racer.heading, 0),
      speed: Math.max(0, finite(racer.speed, 0))
    };
  }

  function cloneSample(sample) {
    return { t: sample.t, x: sample.x, y: sample.y, heading: sample.heading, speed: sample.speed };
  }

  function interpolateSamples(samples, elapsedMs) {
    if (!Array.isArray(samples) || !samples.length) return null;
    const elapsed = Math.max(0, finite(elapsedMs, 0));
    if (elapsed <= samples[0].t) return cloneSample(samples[0]);
    const last = samples[samples.length - 1];
    if (elapsed >= last.t) return cloneSample(last);
    let low = 0;
    let high = samples.length - 1;
    while (low + 1 < high) {
      const middle = Math.floor((low + high) / 2);
      if (samples[middle].t <= elapsed) low = middle;
      else high = middle;
    }
    const before = samples[low];
    const after = samples[high];
    const alpha = clamp((elapsed - before.t) / Math.max(1, after.t - before.t), 0, 1);
    return {
      t: elapsed,
      x: before.x + (after.x - before.x) * alpha,
      y: before.y + (after.y - before.y) * alpha,
      heading: before.heading + angleDelta(after.heading, before.heading) * alpha,
      speed: before.speed + (after.speed - before.speed) * alpha
    };
  }

  function createMirrorEchoVault(options) {
    const settings = options || {};
    const maxEchoes = Math.max(1, Math.floor(finite(settings.maxEchoes, MAX_ECHOES)));
    const maxSamples = Math.max(MIN_SAMPLES, Math.floor(finite(settings.maxSamples, MAX_SAMPLES)));
    const minSampleGapMs = Math.max(1, finite(settings.minSampleGapMs, MIN_SAMPLE_GAP_MS));
    const minLapMs = Math.max(1, finite(settings.minLapMs, MIN_LAP_MS));
    const echoes = new Map();
    const captures = new Map();
    let enabled = settings.enabled !== false;
    let activeRaceId = null;
    let activeCourseKey = null;
    let sequence = 0;
    const diagnostics = {
      schema: SCHEMA,
      changesAuthority: false,
      storage: 'bounded-browser-session-memory',
      maxEchoes,
      maxSamplesPerLap: maxSamples,
      observedPackets: 0,
      capturesStarted: 0,
      lapsSealed: 0,
      bestLapsReplaced: 0,
      rejectedLaps: 0,
      sampleCompactions: 0,
      playbackFrames: 0
    };

    function compact(capture) {
      const reduced = capture.samples.filter(function (_, index) { return index % 2 === 0; });
      const tail = capture.samples[capture.samples.length - 1];
      if (reduced[reduced.length - 1] !== tail) reduced.push(tail);
      capture.samples = reduced;
      capture.sampleGapMs *= 2;
      capture.compactions += 1;
      diagnostics.sampleCompactions += 1;
    }

    function append(capture, racer, absoluteTime, force) {
      const relativeTime = Math.max(0, finite(absoluteTime, capture.startedAt) - capture.startedAt);
      const last = capture.samples[capture.samples.length - 1];
      if (!force && last && relativeTime - last.t < capture.sampleGapMs) return;
      if (last && Math.abs(relativeTime - last.t) < .001) {
        capture.samples[capture.samples.length - 1] = sampleFrom(racer, relativeTime);
        return;
      }
      if (capture.samples.length >= maxSamples) compact(capture);
      capture.samples.push(sampleFrom(racer, relativeTime));
    }

    function beginCapture(racer, lap, startedAt, eligibleAtStart) {
      const capture = {
        lap: Math.max(0, Math.floor(finite(lap, 0))),
        startedAt: finite(startedAt, 0),
        source: sourceFrom(racer),
        samples: [],
        sampleGapMs: minSampleGapMs,
        compactions: 0,
        eligibleAtStart: Boolean(eligibleAtStart)
      };
      append(capture, racer, capture.startedAt, true);
      captures.set(String(racer.id), capture);
      diagnostics.capturesStarted += 1;
      return capture;
    }

    function freezeEcho(record) {
      record.samples = Object.freeze(record.samples.map(function (sample) { return Object.freeze(cloneSample(sample)); }));
      return Object.freeze(record);
    }

    function sealCapture(capture, racer, boundaryTime, state) {
      append(capture, racer, boundaryTime, true);
      const durationMs = Math.max(0, finite(boundaryTime, state.now) - capture.startedAt);
      if (!capture.eligibleAtStart || durationMs < minLapMs || capture.samples.length < MIN_SAMPLES) {
        diagnostics.rejectedLaps += 1;
        return null;
      }
      const directionId = normalizeDirection(state.routeDirectionId);
      const key = courseKey(state.trackId, state.variantId, directionId);
      const incumbent = echoes.get(key);
      if (incumbent && incumbent.durationMs <= durationMs) return incumbent;
      const record = freezeEcho({
        schema: SCHEMA,
        id: 'echo-' + (++sequence),
        trackId: String(state.trackId),
        trackName: String(state.track && state.track.name || state.trackId),
        variantId: String(state.variantId),
        routeDirectionId: directionId,
        raceId: activeRaceId,
        lap: capture.lap + 1,
        durationMs,
        sampleCount: capture.samples.length,
        sampleCompactions: capture.compactions,
        source: capture.source,
        samples: capture.samples
      });
      if (incumbent) diagnostics.bestLapsReplaced += 1;
      echoes.delete(key);
      echoes.set(key, record);
      while (echoes.size > maxEchoes) echoes.delete(echoes.keys().next().value);
      diagnostics.lapsSealed += 1;
      return record;
    }

    function isRaceCourse(state) {
      return Boolean(state && state.trackId && state.variantId && state.mode !== 'battle');
    }

    function observe(state) {
      if (!state || !Number.isFinite(Number(state.now))) return snapshot(state);
      diagnostics.observedPackets += 1;
      if (!isRaceCourse(state)) {
        captures.clear();
        activeRaceId = null;
        activeCourseKey = null;
        return snapshot(state);
      }
      const phase = String(state.phase || '');
      const startedAt = finite(state.raceStartedAt, 0);
      if ((phase !== 'racing' && phase !== 'results') || startedAt <= 0) {
        captures.clear();
        activeRaceId = null;
        activeCourseKey = courseKey(state.trackId, state.variantId, state.routeDirectionId);
        return snapshot(state);
      }
      const raceId = courseKey(state.trackId, state.variantId, state.routeDirectionId) + '@' + startedAt;
      if (raceId !== activeRaceId) {
        captures.clear();
        activeRaceId = raceId;
        activeCourseKey = courseKey(state.trackId, state.variantId, state.routeDirectionId);
      }
      const racers = state.racers && Object.values(state.racers) || [];
      racers.forEach(function (racer) {
        if (!racer || !racer.id) return;
        const racerId = String(racer.id);
        const racerLap = Math.max(0, Math.floor(finite(racer.lap, 0)));
        let capture = captures.get(racerId);
        if (!capture) {
          if (phase !== 'racing' || racerLap >= finite(state.raceLaps, Infinity)) return;
          const eligibleAtStart = racerLap === 0;
          capture = beginCapture(racer, racerLap, eligibleAtStart ? startedAt : state.now, eligibleAtStart);
          append(capture, racer, state.now, false);
          return;
        }
        if (racerLap < capture.lap) {
          captures.delete(racerId);
          return;
        }
        if (racerLap === capture.lap) {
          append(capture, racer, state.now, false);
          return;
        }
        const completedExactlyOneLap = racerLap === capture.lap + 1;
        const finalLap = racerLap >= finite(state.raceLaps, Infinity);
        const boundaryTime = finalLap && finite(racer.finishedAt, 0) > 0 ? finite(racer.finishedAt, state.now) : state.now;
        if (completedExactlyOneLap) sealCapture(capture, racer, boundaryTime, state);
        else diagnostics.rejectedLaps += 1;
        captures.delete(racerId);
        if (phase === 'racing' && !finalLap) {
          capture = beginCapture(racer, racerLap, boundaryTime, true);
          append(capture, racer, state.now, false);
        }
      });
      return snapshot(state);
    }

    function bestFor(trackId, variantId, directionId) {
      return echoes.get(courseKey(trackId, variantId, directionId)) || null;
    }

    function playback(state) {
      if (!enabled || !state || state.phase !== 'racing' || !isRaceCourse(state)) return null;
      const record = bestFor(state.trackId, state.variantId, state.routeDirectionId);
      if (!record || record.durationMs <= 0) return null;
      const elapsed = Math.max(0, finite(state.now, 0) - finite(state.raceStartedAt, state.now)) % record.durationMs;
      const pose = interpolateSamples(record.samples, elapsed);
      if (!pose) return null;
      diagnostics.playbackFrames += 1;
      return {
        schema: SCHEMA,
        changesAuthority: false,
        id: record.id,
        durationMs: record.durationMs,
        source: record.source,
        pose
      };
    }

    function setEnabled(value) {
      enabled = Boolean(value);
      return enabled;
    }

    function summary(state) {
      const key = state && state.trackId && state.variantId ? courseKey(state.trackId, state.variantId, state.routeDirectionId) : activeCourseKey;
      const record = key ? echoes.get(key) : null;
      return {
        schema: SCHEMA,
        changesAuthority: false,
        enabled,
        status: record ? 'sealed' : 'empty',
        echoCount: echoes.size,
        activeCourseKey: key || null,
        best: record ? {
          id: record.id,
          trackId: record.trackId,
          trackName: record.trackName,
          variantId: record.variantId,
          routeDirectionId: record.routeDirectionId,
          durationMs: record.durationMs,
          sampleCount: record.sampleCount,
          source: Object.assign({}, record.source)
        } : null
      };
    }

    function snapshot(state) {
      const activeCaptures = Array.from(captures.entries()).map(function (entry) {
        return {
          racerId: entry[0],
          lap: entry[1].lap,
          sampleCount: entry[1].samples.length,
          sampleGapMs: entry[1].sampleGapMs,
          compactions: entry[1].compactions,
          eligibleAtStart: entry[1].eligibleAtStart
        };
      });
      return Object.assign({}, diagnostics, summary(state), {
        activeRaceId,
        activeCaptures,
        echoCatalog: Array.from(echoes.values()).map(function (record) {
          return {
            id: record.id,
            trackId: record.trackId,
            variantId: record.variantId,
            routeDirectionId: record.routeDirectionId,
            durationMs: record.durationMs,
            sampleCount: record.sampleCount,
            source: Object.assign({}, record.source)
          };
        })
      });
    }

    return Object.freeze({ observe, playback, bestFor, summary, snapshot, setEnabled });
  }

  return Object.freeze({
    SCHEMA,
    MAX_ECHOES,
    MAX_SAMPLES,
    MIN_SAMPLE_GAP_MS,
    createMirrorEchoVault,
    interpolateSamples,
    angleDelta
  });
});
