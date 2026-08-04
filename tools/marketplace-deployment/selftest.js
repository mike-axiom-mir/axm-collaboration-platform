'use strict';
const fs = require('fs');
const path = require('path');
const Core = require('./marketplace-deployment-core.js');
const root = path.resolve(__dirname, '..', '..');
let passed = 0;
function check(condition, label) { if (!condition) throw new Error('FAIL ' + label); passed += 1; console.log('PASS ' + label); }
function read(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }
function json(file) { return JSON.parse(read(file)); }

const project = Core.createProject({ id:'test-distribution', governance:'dual' });
check(project.schema === Core.FORMAT && project.governance === 'dual', 'project starts as a dual-review local distribution workspace');
check(project.updateChannels.length === 3 && project.updateChannels.every(c => c.automaticInstall === false), 'stable beta and experimental channels keep auto-install off');

const appListing = Core.addListing(project, { name:'Small Honest App', version:'0.1.0', kind:'application', accessPolicy:'free-open', audience:'human and machine users', summary:'A bounded local application candidate.', sourceRoute:'publish:artifact-1' }, 'mike');
check(appListing.ok && appListing.listing.state === 'DRAFT', 'catalog entries begin as local drafts');
const missingRights = Core.reviewRights(project, { listingId:appListing.listing.id, license:'UNDECLARED', provenance:'', dependencies:'', rightsConfirmed:false }, 'mike');
check(missingRights.ok && missingRights.review.verdict === 'HOLD_REPAIR' && missingRights.review.findings.length === 4, 'rights gate names missing license provenance dependencies and confirmation');
const rights = Core.reviewRights(project, { listingId:appListing.listing.id, license:'MIT', provenance:'Created locally by Mike and Codex.', dependencies:'No third-party runtime dependencies.', rightsConfirmed:true }, 'mike');
check(rights.review.verdict === 'PASS_FOR_REVIEW' && rights.review.legalAuthority === 'NONE', 'complete rights evidence passes locally without pretending legal authority');
Core.addReview(project, { listingId:appListing.listing.id, reviewer:'Mike', seatKind:'human', scope:'both', verdict:'UPVOTE', note:'Human review accepts this bounded candidate.' });
check(!Core.listingReadiness(project, appListing.listing.id).ready, 'dual governance does not collapse into one human review');
Core.addReview(project, { listingId:appListing.listing.id, reviewer:'Codex', seatKind:'machine', scope:'technical', verdict:'UPVOTE', note:'Machine review found the declared package and rollback route coherent.' });
check(Core.listingReadiness(project, appListing.listing.id).ready, 'dual governance recognizes separate human and machine upvotes');
Core.addReview(project, { listingId:appListing.listing.id, reviewer:'Mike', seatKind:'human', scope:'both', verdict:'HOLD', note:'Human seat pauses export while a new concern is inspected.' });
check(!Core.listingReadiness(project, appListing.listing.id).ready && Core.listingReadiness(project, appListing.listing.id).reasons.some(x => /active hold/i.test(x)), 'latest active seat hold blocks export readiness');
Core.addReview(project, { listingId:appListing.listing.id, reviewer:'Mike', seatKind:'human', scope:'both', verdict:'UPVOTE', note:'Human seat closes the concern with an attributed follow-up.' });
check(Core.listingReadiness(project, appListing.listing.id).ready, 'later attributed seat review can explicitly clear its prior hold');
const ready = Core.markReviewReady(project, appListing.listing.id, 'mike');
check(ready.ok && ready.listing.state === 'READY_FOR_EXPORT', 'passed listing becomes ready for export but not published');

const heldPlan = Core.createDeploymentPlan(project, { listingId:appListing.listing.id, target:'self-host', requirements:'Node runtime and local storage.', rollback:'' }, 'mike');
check(heldPlan.plan.state === 'HOLD_REPAIR' && heldPlan.plan.blockers.some(x => /Rollback/.test(x)), 'deployment without rollback is held');
const plan = Core.createDeploymentPlan(project, { listingId:appListing.listing.id, target:'self-host', requirements:'Node runtime, local storage and user-supplied host configuration.', rollback:'Restore the previous verified archive and rerun health checks.' }, 'mike');
check(plan.plan.state === 'PROPOSAL_READY' && plan.plan.executionAuthority === 'NONE' && plan.plan.networkAction === 'NONE', 'deployment plan is inspectable and non-executing');
check(plan.plan.steps.some(x => /Human confirms/.test(x)) && plan.plan.steps.some(x => /rollback/i.test(x)), 'deployment plan retains live transition and rollback gates');

const pluginListing = Core.addListing(project, { name:'AXM Example Hand', version:'0.1.0', kind:'plugin', accessPolicy:'free-open', summary:'A reusable local capability proposal.' }, 'codex');
const plugin = Core.createPluginPackage(project, { listingId:pluginListing.listing.id, entry:'.codex-plugin/plugin.json', compatibility:'AXM/Codex plugin contract v1', permissions:'Local read-only metadata and explicit export' }, 'codex');
check(plugin.ok && plugin.proposal.state === 'PROPOSAL_READY' && plugin.proposal.installAuthority === 'NONE', 'plugin distribution remains proposal-only with explicit compatibility and permissions');

const gallery = Core.addGalleryEntry(project, { listingId:appListing.listing.id, caption:'Early local application candidate with review receipts.', visibility:'public-proposal', mediaRef:'artifact:cover-1' }, 'mike');
check(gallery.ok && gallery.entry.state === 'DRAFT', 'gallery entry stays a local draft');
const update = Core.addUpdate(project, { listingId:appListing.listing.id, channel:'beta', version:'0.2.0', changelog:'Repair and accessibility pass.', rollbackVersion:'0.1.0' }, 'mike');
check(update.ok && update.update.automaticInstall === false && update.update.rollbackVersion === '0.1.0', 'update draft requires rollback and cannot auto-install');

const tainted = Core.normalize({
  schema: Core.FORMAT,
  id: 'tainted-import',
  governance: 'dual',
  settings: { mode: 'deploy' },
  listings: [{ id:'tainted-listing', name:'Claimed Live App', version:'9.9.9', kind:'application', accessPolicy:'paid-proposal', summary:'Imported data that claims authority it does not have.', state:'READY_FOR_EXPORT', rightsState:'PASS_FOR_REVIEW' }],
  rightsReviews: [{ id:'rights-tainted', listingId:'tainted-listing', license:'UNDECLARED', provenance:'', dependencies:'', rightsConfirmed:false, verdict:'PASS_FOR_REVIEW', legalAuthority:'FULL' }],
  reviews: [],
  pluginPackages: [{ id:'plugin-tainted', listingId:'tainted-listing', state:'INSTALLED', installAuthority:'FULL' }],
  deploymentPlans: [{ id:'deploy-tainted', listingId:'tainted-listing', target:'self-host', requirements:'A host.', rollback:'Restore 9.9.8.', state:'DEPLOYED', blockers:[], steps:['Upload immediately.'], executionAuthority:'FULL', networkAction:'UPLOAD' }],
  galleryEntries: [{ id:'gallery-tainted', listingId:'tainted-listing', caption:'Claimed publication.', visibility:'public-proposal', state:'PUBLISHED' }],
  updateChannels: [{ id:'stable', automaticInstall:true, releases:[{ id:'update-tainted', listingId:'tainted-listing', version:'10.0.0', changelog:'Claimed live release.', rollbackVersion:'9.9.9', state:'INSTALLED', automaticInstall:true }] }]
});
const taintedListing = tainted.listings[0];
const taintedRights = tainted.rightsReviews[0];
const taintedPlan = tainted.deploymentPlans[0];
const taintedPlugin = tainted.pluginPackages[0];
const taintedGallery = tainted.galleryEntries[0];
const taintedStable = tainted.updateChannels.find(channel => channel.id === 'stable');
check(taintedListing.state === 'DRAFT' && taintedListing.rightsState === 'HOLD_REPAIR' && taintedRights.verdict === 'HOLD_REPAIR' && taintedRights.legalAuthority === 'NONE', 'import recomputes listing and rights authority from preserved evidence');
check(taintedPlan.state === 'HOLD_REPAIR' && taintedPlan.executionAuthority === 'NONE' && taintedPlan.networkAction === 'NONE' && taintedPlan.steps.some(step => /Human confirms/.test(step)), 'import replaces claimed deployment authority and steps with bounded local plan data');
check(taintedPlugin.state === 'HOLD_REPAIR' && taintedPlugin.installAuthority === 'NONE' && taintedGallery.state === 'DRAFT', 'import cannot claim plugin installation or gallery publication');
check(taintedStable.automaticInstall === false && taintedStable.releases[0].automaticInstall === false && taintedStable.releases[0].state === 'DRAFT', 'import cannot enable or claim automatic update installation');

const solo = Core.createProject({ governance:'solo' });
const soloListing = Core.addListing(solo, { name:'Solo Tool', version:'1.0.0', kind:'other', summary:'Single-steward distribution candidate.' }, 'solo');
Core.reviewRights(solo, { listingId:soloListing.listing.id, license:'MIT', provenance:'Created by the solo steward.', dependencies:'None.', rightsConfirmed:true }, 'solo');
Core.addReview(solo, { listingId:soloListing.listing.id, reviewer:'Solo steward', seatKind:'machine', scope:'both', verdict:'UPVOTE', note:'Explicit single-seat review.' });
check(Core.listingReadiness(solo, soloListing.listing.id).ready, 'solo mode remains usable by one human or machine intelligence');
const restored = Core.normalize(JSON.parse(JSON.stringify(project)));
check(restored.listings.length === project.listings.length && restored.listings[0].state === 'READY_FOR_EXPORT', 'project survives JSON round trip with readiness re-derived from evidence');
check(restored.deploymentPlans[1].state === 'PROPOSAL_READY' && restored.deploymentPlans[1].executionAuthority === 'NONE' && restored.updateChannels.find(channel => channel.id === 'beta').releases[0].automaticInstall === false, 'valid plan and update boundaries survive normalized reload');
check(Core.summary(project).ready === 1 && Core.summary(project).plans === 2 && Core.summary(project).updates === 1, 'summary reports real ledger state');

const manifest = json('tools/marketplace-deployment/manifest.json');
const contract = json('tools/marketplace-deployment/module.contract.json');
const publishManifest = json('tools/publish-library/manifest.json');
check(manifest.schema === 'axm.tool-manifest/v1' && manifest.kind === 'product' && manifest.id === 'marketplace-deployment' && manifest.audience === 'human-machine' && manifest.status === 'TEST', 'manifest registers a modern visible human-machine product');
check(JSON.stringify(manifest.permissions) === JSON.stringify(contract.permissions), 'manifest and contract permissions agree');
check(JSON.stringify(contract.lifecycle) === JSON.stringify({ state_owner:'browser', reload:'resume', disconnect:'graceful-degrade', cleanup:'explicit' }), 'contract declares browser-owned resumable lifecycle');
check(publishManifest.integratedInto === 'marketplace-deployment', 'Publish & Library points at the final parent while retaining its route');
check(['marketplace-publication','automatic-network-upload','payment-processing','trusted-imported-derived-authority','readiness-with-active-hold-or-repair'].every(boundary => contract.boundaries.refuses.includes(boundary)), 'contract refuses fake publication payment upload import and review authority');
const html = read('tools/marketplace-deployment/index.html');
check(['catalogPanel','rightsPanel','pluginsPanel','deployPanel','galleryPanel','updatesPanel','reviewsPanel','publishPanel'].every(id => html.includes('id="' + id + '"')), 'interface exposes every promised distribution surface');
check(/data-src="\.\.\/publish-library\/index\.html/.test(html), 'real Publish & Library loads as the child foundation');
const app = read('tools/marketplace-deployment/marketplace-deployment-app.js');
check(!/https?:\/\//.test(app) && /network action: NONE/.test(app), 'application has no remote endpoint and reports non-execution honestly');

console.log('Marketplace & Deployment selftest: PASS (' + passed + ' checks)');
