#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const direction = JSON.parse(fs.readFileSync(path.join(__dirname, 'role-direction-v1.json'), 'utf8'));
const repairBuddyManifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'repairbuddy', 'manifest.json'), 'utf8'));
const repairBuddyContract = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'repairbuddy', 'module.contract.json'), 'utf8'));
let checks = 0;
function check(value, message) { assert.ok(value, message); checks += 1; }

check(direction.schema === 'axm.mirror-code-role-direction/v1' && direction.status === 'NEEDS_REVIEW', 'role direction identity and honest status');
check(direction.humanDirection.statement === 'Repair needs stability. Coding needs story and innovation. RepairBuddy is for stable repair; a future Code Mirror is for story-led innovation.' && direction.humanDirection.canonAccepted === false, 'human role direction is exact and not CANON');
check(direction.roleMap.repairBuddy.role === 'RESTORE_AND_PRESERVE_KNOWN_GOOD_BEHAVIOR_WITH_PREVIOUSLY_PROVEN_BOUNDED_REPAIR_PATTERNS' && direction.roleMap.repairBuddy.successCriterion === 'STABILITY_WITH_MINIMUM_CHANGE_AND_NO_REGRESSION', 'RepairBuddy owns stability-oriented bounded repair replay');
check(direction.roleMap.repairBuddy.mayFreelySelfCode === false && direction.roleMap.repairBuddy.mayAutomaticallyModifyMirror === false, 'RepairBuddy remains bounded');
check(direction.roleMap.futureCodeMirror.role === 'ORIGINATE_NEW_CAPABILITY_BEARING_CODE_STORIES_IN_DISPOSABLE_EXPERIMENTS' && direction.roleMap.futureCodeMirror.storyFunction === 'CREATIVE_CONTEXT_AND_DESIGN_CONSTRAINT', 'future Code Mirror owns capability-bearing code stories');
check(direction.roleMap.futureCodeMirror.storyAuthority === 'NOT_TRUTH_PERMISSION_EVIDENCE_RELEASE_GATE_OR_CANON', 'story guides creativity without becoming hidden authority');
check(direction.roleMap.futureCodeMirror.twoViewsOneTrace.humanView === 'WHAT_NEW_EXPERIENCE_OR_POSSIBILITY_THE_CODE_CREATES' && direction.roleMap.futureCodeMirror.twoViewsOneTrace.machineView === 'EXECUTABLE_CAPABILITY_CONTRACT_CANDIDATE_AND_VERIFICATION_EVIDENCE', 'human story and machine capability remain two views of one trace');
check(direction.roleMap.futureCodeMirror.candidateOnly && direction.roleMap.futureCodeMirror.independentVerificationRequired && direction.roleMap.futureCodeMirror.humanReviewRequired, 'innovation remains disposable and review-gated');
check(direction.currentV02Assessment.roleFit === 'FAIL_REPAIR_BELONGS_TO_REPAIRBUDDY' && direction.currentV02Assessment.automaticDeletion === false, 'v0.2 mismatch and preservation are explicit');
check(direction.training.repairReceiptsEligibleAsCodeMirrorInnovation === false && direction.training.capabilityStoryInnovationCorpusState === 'ABSENT' && direction.training.heldOutInnovationExamState === 'ABSENT', 'repair evidence cannot masquerade as capability-story innovation training');
check(Object.values(direction.authority).every(value => value === false), 'role direction grants zero authority');
check(/repair/i.test(repairBuddyManifest.summary) && repairBuddyContract.boundaries.refuses.includes('new-code-generation') && repairBuddyContract.boundaries.refuses.includes('automatic-repair-application'), 'current RepairBuddy declarations match the repair role and refuse free coding');

console.log('PASS Code Mirror role direction (' + checks + ' checks; RepairBuddy=stability, future Code Mirror=story+working capability, current v0.2 held and preserved)');
