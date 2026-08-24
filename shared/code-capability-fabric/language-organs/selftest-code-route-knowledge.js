'use strict';
const assert=require('assert');
const atlas=require('./code-route-knowledge.json');
const route=require('./code-route-knowledge.js');
const registry=require('./registry.js');
const organs=registry.all();
assert.strictEqual(organs.length,102);
assert.strictEqual(Object.keys(atlas.routeClasses).length,18);
assert(atlas.explicitBridges.length>=10);
assert(atlas.familyRules.length>=9);
assert(atlas.buildRecipes.length>=10);
const ids=new Set(organs.map(o=>o.languageId));
const families=new Set(organs.map(o=>o.family));
for(const b of atlas.explicitBridges){
 assert(b.id&&b.class&&atlas.routeClasses[b.class],`invalid explicit bridge ${b.id}`);
 for(const endpoint of [b.source,b.destination]){
  if(endpoint.startsWith('runtime:'))continue;
  if(endpoint.startsWith('family:')){assert(families.has(endpoint.slice(7)),`unknown family endpoint ${endpoint}`);continue}
  assert(ids.has(endpoint),`unknown language endpoint ${endpoint}`);
 }
 assert(Array.isArray(b.purpose)&&b.purpose.length);
 assert(Array.isArray(b.failureBoundaries)&&b.failureBoundaries.length);
 assert(Array.isArray(b.verify)&&b.verify.length);
}
for(const r of atlas.familyRules){
 assert(atlas.routeClasses[r.class]);
 for(const f of [...r.sourceFamilies,...r.destinationFamilies])assert(families.has(f),`unknown family ${f} in ${r.id}`);
}
for(const recipe of atlas.buildRecipes){
 assert(recipe.id&&recipe.goalTags.length&&recipe.roles.length&&recipe.routeClasses.length);
 for(const c of recipe.routeClasses)assert(atlas.routeClasses[c],`unknown route class ${c}`);
 for(const role of recipe.roles)for(const f of role.families)assert(families.has(f),`unknown recipe family ${f}`);
}
const htmlJs=route.relate({languageA:'html',languageB:'javascript'});
assert.strictEqual(htmlJs.result,'ROUTES_FOUND');
assert(htmlJs.routes.some(r=>r.id==='browser-document-host'&&r.class==='HOSTED_DSL'));
assert.strictEqual(htmlJs.routes[0].knowledgeSource,'EXPLICIT_BRIDGE');
const pyC=route.relate({languageA:'python',languageB:'c'});
assert.strictEqual(pyC.result,'ROUTES_FOUND');
assert(pyC.routes.some(r=>r.id==='python-extended-by-c'||r.id==='c-embeds-python'));
assert.strictEqual(pyC.routes[0].knowledgeSource,'EXPLICIT_BRIDGE');
assert(pyC.routes[0].score>pyC.routes.filter(r=>r.knowledgeSource==='FAMILY_RULE').reduce((m,r)=>Math.max(m,r.score),-1));
const daxVhdl=route.relate({languageA:'dax',languageB:'vhdl'});
assert.strictEqual(daxVhdl.result,'NO_KNOWN_DIRECT_ROUTE');
const browser=route.planGoal({goal:'build a browser game',activeLanguageIds:['html','css','javascript']});
assert.strictEqual(browser.result,'ROUTE_RECIPES_FOUND');
assert.strictEqual(browser.recipes[0].id,'browser-game');
const br=browser.recipes[0].roles;
assert.strictEqual(br.find(x=>x.role==='document-shell').candidates[0].languageId,'html');
assert.strictEqual(br.find(x=>x.role==='style-layout').candidates[0].languageId,'css');
assert.strictEqual(br.find(x=>x.role==='game-runtime').candidates[0].languageId,'javascript');
assert(br.filter(x=>!x.optional).every(x=>x.status==='ACTIVE_MATCH'||x.status==='CANDIDATES_AVAILABLE'));
assert.strictEqual(browser.truth.languageSwitched,false);
assert.strictEqual(browser.truth.dependenciesInstalled,false);
assert.strictEqual(browser.truth.toolchainExecuted,false);
const nativeGame=route.planGoal({goal:'native game engine',activeLanguageIds:['rust']});
assert.strictEqual(nativeGame.recipes[0].id,'native-game');
assert(nativeGame.recipes[0].roles.find(x=>x.role==='engine-runtime').candidates.some(x=>x.languageId==='rust'));
const unknown=route.planGoal({goal:'quantum banana orchestra'});
assert.strictEqual(unknown.result,'NO_RECIPE_MATCH');
const rust=route.explainLanguage('rust');
assert.strictEqual(rust.result,'LANGUAGE_ROUTE_VIEW');
assert(rust.buildRecipes.some(x=>x.id==='native-game'));
const snap=route.snapshot();
assert.strictEqual(snap.organCount,102);
assert.strictEqual(snap.routeClassCount,18);
assert.strictEqual(snap.explicitBridgeCount,atlas.explicitBridges.length);
assert.strictEqual(snap.authority,'NONE');
console.log(JSON.stringify({ok:true,organCount:snap.organCount,routeClassCount:snap.routeClassCount,explicitBridgeCount:snap.explicitBridgeCount,familyRuleCount:snap.familyRuleCount,buildRecipeCount:snap.buildRecipeCount,browserRecipe:browser.recipes[0].id,nativeGameRecipe:nativeGame.recipes[0].id,pythonCFirstRoute:pyC.routes[0].id,pythonCFirstRouteClass:pyC.routes[0].class,snapshotSha256:snap.snapshotSha256,authority:snap.authority},null,2));
