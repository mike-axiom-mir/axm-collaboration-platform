#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const dir = __dirname;
const events = [
  ['evidence_selftest_renderer_boundary_phrase_mismatch_found', 'The first evidence selftest searched globally consistent history while the renderer accurately said protected global history and stopped after earlier checks passed.'],
  ['evidence_selftest_renderer_boundary_phrase_corrected', 'The evidence assertion now checks the exact renderer wording without changing the product boundary.'],
  ['evidence_selftest_renderer_label_mismatch_found', 'The next evidence selftest searched approval-as-reconciliation inflation reason while the focused label ended at inflation.'],
  ['evidence_selftest_renderer_label_corrected', 'The evidence assertion now checks the exact focused label without weakening the authority-inflation requirement.'],
  ['frontier_boundary_assertion_phrase_mismatch_found', 'The next evidence selftest could not find its preferred approval-as-reconciliation phrase although the frontier already explained what approval cannot do.'],
  ['frontier_boundary_made_explicit', 'The frontier report now states Review approval is not reconciliation and does not resolve the divergence.'],
  ['evidence_selftest_final_green', 'The final capability product schema source visual and evidence selftest passed 82 checks.'],
  ['verification_evidence_selftest_green', 'The primary seal curation index source results routes visual receipt path and credential verification selftest passed 73 checks before this continuation was added.']
].map((entry, index) => ({ schema:'axm.session-event/v1', eventId:'evt-' + String(index + 49).padStart(3, '0'), event:entry[0], status:'TEST', detail:entry[1], timeAuthority:'SESSION_ORDER_ONLY_NOT_EXTERNALLY_TRUSTED' }));
fs.writeFileSync(path.join(dir, 'SESSION_SEGMENT_ADDENDUM.jsonl'), events.map(event => JSON.stringify(event)).join('\n') + '\n', 'utf8');
console.log('PASS wrote ' + events.length + ' append-only continuation events');
