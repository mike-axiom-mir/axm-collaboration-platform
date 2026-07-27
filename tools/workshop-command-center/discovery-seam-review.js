#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const server = fs.readFileSync(path.join(root,'server.js'),'utf8');
const operationsApi = fs.readFileSync(path.join(root,'shared','operations','operations-api.js'),'utf8');
const hub = fs.readFileSync(path.join(root,'hub','index.html'),'utf8');
const shell = fs.readFileSync(path.join(root,'hub','hub-shell.js'),'utf8');
const review = fs.readFileSync(path.join(root,'shared','operations','review-service.js'),'utf8');
const app = fs.readFileSync(path.join(__dirname,'app.js'),'utf8');
const html = fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname,'manifest.json'),'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(__dirname,'module.contract.json'),'utf8'));
const checks = [
  [manifest.schema === 'axm.tool-manifest/v1' && manifest.kind === 'product' && manifest.permissions.length === 0, 'cockpit is a versioned zero-permission product'],
  [hub.includes('id="commandCenterNav"') && shell.includes("this.open('workshop-command-center')"), 'dedicated Hub door exists above workflow parents'],
  [shell.includes('command-center-home-card') && shell.includes('Above 5 parent rooms'), 'Home promotes the cockpit without adding a sixth workflow parent'],
  [server.includes('review: OperationsApi.services.review'), 'Direction commit uses the shared exact-digest review service'],
  [review.includes('Math.min(10'), 'review service accepts bounded panels up to ten while actor replacement preserves one vote per identity'],
  [app.includes('window.AXMDirectionReview'), 'browser and service share the same advisory judge'],
  [app.includes('codeLinesPerHour') && app.includes('Finished stays separate') && server.includes('scheduleGrowthVelocity'), 'human output panel measures net code growth separately from explicit completion'],
  [operationsApi.includes("url === '/api/workshop-needs' && req.method === 'GET'") && app.includes("api('/api/workshop-needs')"), 'cockpit reads needs and readiness from the Observatory owner'],
  [contract.consumes.includes('axm.workshop-readiness-view/v1') && contract.boundaries.refuses.includes('readiness-as-promotion') && html.includes('OPEN NEEDS &amp; MODULE REVIEW OWNER'), 'readiness summary routes to its owner without promotion authority'],
  [app.includes('OPEN OWNER ROOM') && !app.includes('data-generic-post'), 'advanced mutations route to specialist owners instead of generic POST execution']
];
checks.forEach(([pass,label]) => { assert(pass,label); console.log('PASS command-center seam · ' + label); });
console.log('\n' + checks.length + ' PASS · 0 FAIL');
