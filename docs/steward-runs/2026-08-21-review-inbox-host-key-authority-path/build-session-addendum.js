#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const events = [
  ['overbroad_secret_scan_fixture_match_observed', 'An overbroad scan included an inherited deliberate secret-redaction test fixture and failed; it did not identify task material.'],
  ['changed_path_secret_scan_corrected', 'The scan was narrowed to the forty-one changed paths and passed with no secret or machine-path match.'],
  ['powershell_revision_expression_misparsed', 'An unquoted Git tree revision expression was interpreted by PowerShell and failed; the exact quoted revision returned the committed tree.'],
  ['long_temp_detached_checkout_failed', 'The first separate detached checkout could not materialize inherited long filenames under a long temporary root and no replay was claimed.'],
  ['failed_long_checkout_root_absent', 'The failed long-path checkout was not registered and its exact temporary root was already absent.'],
  ['short_detached_checkout_interrupted', 'A second short-root checkout outlived the command transport and stopped incomplete under Git locked-initializing state; its deletion-looking status was not treated as a source change.'],
  ['single_force_locked_cleanup_refused', 'Git correctly refused one-force removal of its locked initializing worktree and named the required stronger explicit force.'],
  ['exact_locked_worktree_cleanup_succeeded', 'The exact registered short replay worktree was removed with double explicit force after path and registration verification.'],
  ['exact_commit_detached_replay_passed', 'The clean task worktree detached at commit 8ce0e4fd8b59dd58572fc453466cee4ceaf40ba2 and passed all sixty-one recorded commands plus the forty-five-check evidence selftest.'],
  ['detached_replay_tree_stayed_clean', 'Detached replay ended at tree 790e8727430dc9a82d38143c66110fc89897966e with no status entries.'],
  ['review_branch_reattached_clean', 'The task worktree reattached codex/grounded-growth-host-trusted-review-path-v4.1 at the exact replayed commit with no status entries.']
].map((entry, index) => ({ schema:'axm.session-event/v1', eventId:'evt-' + String(index + 50).padStart(3, '0'), event:entry[0], status:'TEST', detail:entry[1], timeAuthority:'SESSION_ORDER_ONLY_NOT_EXTERNALLY_TRUSTED' }));
fs.writeFileSync(path.join(__dirname, 'SESSION_SEGMENT_ADDENDUM.jsonl'), events.map(event => JSON.stringify(event)).join('\n') + '\n', 'utf8');
console.log('PASS wrote ' + events.length + ' append-only continuation events');
