'use strict';

const STATUS_SCHEMA = 'axm.heartbeat-organ-run/v1';

function create(inputSteps) {
  const steps = Array.isArray(inputSteps) ? inputSteps.map((step, index) => {
    const id = String(step && step.id || '').trim();
    if (!id || !step || typeof step.onBeat !== 'function') throw new Error('heartbeat organ step #' + (index + 1) + ' requires id and onBeat');
    return { id, onBeat: step.onBeat };
  }) : [];
  if (!steps.length) throw new Error('at least one heartbeat organ step is required');

  async function onBeat(beat) {
    const receipts = [];
    const errors = [];
    for (const step of steps) {
      try {
        receipts.push({ organId: step.id, status: 'PASS', result: await step.onBeat(beat) });
      } catch (error) {
        receipts.push({ organId: step.id, status: 'ERROR', error: String(error && error.message || error) });
        errors.push({ organId: step.id, error });
      }
    }
    if (errors.length) {
      const failure = new Error('heartbeat organ error: ' + errors.map(item => item.organId + ': ' + String(item.error && item.error.message || item.error)).join('; '));
      failure.receipts = receipts;
      throw failure;
    }
    return { schema: STATUS_SCHEMA, beatId: beat && beat.beatId || null, receipts };
  }

  return { onBeat, STATUS_SCHEMA, organIds: steps.map(step => step.id) };
}

module.exports = { create, STATUS_SCHEMA };
