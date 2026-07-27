'use strict';

const U = require('./foundation-utils');

const PLAN_SCHEMA = 'axm.wcag22-journey-plan/v1';
const RECEIPT_SCHEMA = 'axm.wcag22-live-journey-receipt/v1';

function createPlan(spec) {
  spec = U.clone(spec || {});
  const plan = {
    schema: PLAN_SCHEMA, version: '1.0.0', id: U.text(spec.id, 100, 'WCAG journey plan id'),
    target_canvas_digest: U.text(spec.target_canvas_digest, 128, 'WCAG canvas digest'),
    thresholds: {
      minimum_contrast_ratio: U.finite(spec.thresholds && spec.thresholds.minimum_contrast_ratio, 'minimum contrast ratio'),
      minimum_target_width_css_px: U.finite(spec.thresholds && spec.thresholds.minimum_target_width_css_px, 'minimum target width'),
      minimum_target_height_css_px: U.finite(spec.thresholds && spec.thresholds.minimum_target_height_css_px, 'minimum target height'),
      reflow_viewport_width_css_px: U.finite(spec.thresholds && spec.thresholds.reflow_viewport_width_css_px, 'reflow viewport width'),
    },
    required_journeys: ['keyboard', 'pointer-targets', 'reflow', 'reduced-motion'],
    checks: ['focus-order', 'focus-visible', 'keyboard-activation', 'target-size', 'contrast', 'reflow-no-two-dimensional-scroll', 'reduced-motion', 'no-hidden-blocking-state'],
    human_review: 'RECOMMENDED',
  };
  plan.digest = U.sha256(plan);
  return plan;
}

function assess(plan, recording) {
  U.ensure(plan && plan.schema === PLAN_SCHEMA, 'WCAG journey plan required');
  recording = U.clone(recording || {});
  U.ensure(recording.plan_digest === plan.digest, 'WCAG recording plan binding mismatch');
  const source = recording.source || {};
  const steps = U.boundedArray(recording.steps, 4, 10000, 'WCAG journey steps');
  const keyboard = steps.filter((item) => item.journey === 'keyboard');
  const pointer = steps.filter((item) => item.journey === 'pointer-targets');
  const reflow = steps.filter((item) => item.journey === 'reflow');
  const reduced = steps.filter((item) => item.journey === 'reduced-motion');
  const checks = [
    { name: 'live-browser-source', pass: source.kind === 'live-browser' && source.fresh_session === true && !!source.driver_receipt_digest && Array.isArray(source.frame_receipt_digests) && source.frame_receipt_digests.length >= 4 },
    { name: 'focus-order', pass: keyboard.length >= 2 && keyboard.every((item, index) => item.focus_id && (index === 0 || item.focus_id !== keyboard[index - 1].focus_id)) },
    { name: 'focus-visible', pass: keyboard.length > 0 && keyboard.every((item) => item.focus_visible === true) },
    { name: 'keyboard-activation', pass: keyboard.some((item) => item.activated === true && ['Enter', 'Space'].includes(item.key)) },
    { name: 'target-size', pass: pointer.length > 0 && pointer.every((item) => item.exempt === true || (item.width_css_px >= plan.thresholds.minimum_target_width_css_px && item.height_css_px >= plan.thresholds.minimum_target_height_css_px)) },
    { name: 'contrast', pass: steps.filter((item) => item.contrast_ratio != null).length > 0 && steps.filter((item) => item.contrast_ratio != null).every((item) => item.contrast_ratio >= plan.thresholds.minimum_contrast_ratio) },
    { name: 'reflow', pass: reflow.some((item) => item.viewport_width_css_px <= plan.thresholds.reflow_viewport_width_css_px && item.horizontal_scroll === false && item.content_clipped === false) },
    { name: 'reduced-motion', pass: reduced.some((item) => item.prefers_reduced_motion === true && item.nonessential_motion_running === false) },
    { name: 'no-hidden-blocking-state', pass: steps.every((item) => item.blocking_overlay !== true && item.hidden_focus !== true) },
  ];
  const receipt = {
    schema: RECEIPT_SCHEMA, version: '1.0.0', plan_digest: plan.digest, target_canvas_digest: plan.target_canvas_digest,
    source: U.clone(source), checks, step_count: steps.length,
    status: checks.every((item) => item.pass) ? 'PASS' : source.kind !== 'live-browser' ? 'MISSING_LIVE_EVIDENCE' : 'FAIL',
    scope: 'bounded WCAG 2.2 interaction journey; not a complete accessibility certification',
    human_review: plan.human_review,
  };
  receipt.digest = U.sha256(receipt);
  return receipt;
}

module.exports = { PLAN_SCHEMA, RECEIPT_SCHEMA, createPlan, assess };
