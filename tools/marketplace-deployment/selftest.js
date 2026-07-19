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

const solo = Core.createProject({ governance:'solo' });
const soloListing = Core.addListing(solo, { name:'Solo Tool', version:'1.0.0', kind:'other', summary:'Single-steward distribution candidate.' }, 'solo');
Core.reviewRights(solo, { listingId:soloListing.listing.id, license:'MIT', provenance:'Created by the solo steward.', dependencies:'None.', rightsConfirmed:true }, 'solo');
Core.addReview(solo, { listingId:soloListing.listing.id, reviewer:'Solo steward', seatKind:'machine', scope:'both', verdict:'UPVOTE', note:'Explicit single-seat review.' });
check(Core.listingReadiness(solo, soloListing.listing.id).ready, 'solo mode remains usable by one human or machine intelligence');
check(Core.normalize(JSON.parse(JSON.stringify(project))).listings.length === project.listings.length, 'project survives JSON round trip');
check(Core.summary(project).ready === 1 && Core.summary(project).plans === 2 && Core.summary(project).updates === 1, 'summary reports real ledger state');

const manifest = json('tools/marketplace-deployment/manifest.json');
const contract = json('tools/marketplace-deployment/module.contract.json');
const publishManifest = json('tools/publish-library/manifest.json');
check(manifest.id === 'marketplace-deployment' && manifest.audience === 'human-machine' && manifest.status === 'TEST', 'manifest registers visible human-machine parent');
check(publishManifest.integratedInto === 'marketplace-deployment', 'Publish & Library points at the final parent while retaining its route');
check(contract.boundaries.refuses.includes('marketplace-publication') && contract.boundaries.refuses.includes('automatic-network-upload') && contract.boundaries.refuses.includes('payment-processing'), 'contract refuses fake publication payment and upload authority');
const html = read('tools/marketplace-deployment/index.html');
check(['catalogPanel','rightsPanel','pluginsPanel','deployPanel','galleryPanel','updatesPanel','reviewsPanel','publishPanel'].every(id => html.includes('id="' + id + '"')), 'interface exposes every promised distribution surface');
check(/data-src="\.\.\/publish-library\/index\.html/.test(html), 'real Publish & Library loads as the child foundation');
const app = read('tools/marketplace-deployment/marketplace-deployment-app.js');
check(!/https?:\/\//.test(app) && /network action: NONE/.test(app), 'application has no remote endpoint and reports non-execution honestly');

console.log('Marketplace & Deployment selftest: PASS (' + passed + ' checks)');
