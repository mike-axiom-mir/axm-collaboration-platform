'use strict';
const assert=require('assert');
const Boundary=require('./static-boundary');
['state/shared-profile/profile.json','logs/workshop.log','bridge/bridge-token.txt','projects/example/project.json','prompts/local/core.txt','backups/x.zip','node_modules/pkg/index.js','.claude/settings.json'].forEach(p=>assert.equal(Boundary.isPrivateStaticPath(p),true,p));
['hub/index.html','tools/game-hub/index.html','assets/local/art.png','shared/vendor/three-r160/three.module.js','worlds/living-globe/index.html','museum/catalog.json','exports/example.zip'].forEach(p=>assert.equal(Boundary.isPrivateStaticPath(p),false,p));
assert.equal(Boundary.firstSegment('STATE\\x.json'),'state');
console.log('static privacy boundary selftest: PASS (16 assertions)');
