'use strict';
const assert=require('assert'),r=require('./registry');
const expected={
'code.organ.html.v1':['code-family.static-html-page','6937f9925297f8e898ce8ec0930c2f1a3b47b6645c974d77ab12e7c30a84008e','static-accessible-html-page','e5216430a135f44927364f3beb9bd7825f0aa2e4b5410be6e9cf3cc5c6a28417','static-accessible-html-page-v1','ca938e6fe3b7635c4fe30b00c1fc13edb9a875257cabdcce1c487d35640aa122'],
'code.organ.python.v1':['code-family.bounded-python-record-transform','b4140fd2ae3b416802962b97bbb8131e4c8202c2e7dd9277a51efd6922fa4549','bounded-python-record-transform','82d04d8b78e44978f4d5a42c8c7fb62b944279c89dd498f1268d3cfa97bc5637','bounded-python-record-transform-v1','ad281fa5a1381de86d71e1c4a2ffbad30ee20683cb705b4a09d778464ea5227c'],
'code.organ.json-schema.v1':['code-family.json-schema-validator','f1523fc6299d850259eb88ceb4213e4b005b2c1bd96118e479f6cabd68e4c405','closed-json-schema-validator','8840621b497fda2296a370c220de52a6e18147bf5562a0ff1e050965ec454b23','closed-json-schema-validator-v1','d5bbf6fc6c4219fd90987b7b458c2d396ce5d5c421f06c8763b85338e40c38a0']};
for(const [id,x] of Object.entries(expected)){const o=r.get(id),d=o.donor;assert.strictEqual(o.execution,'PR51_SOURCE_REVIEWED_DONOR_BOUND_RUNTIME_UNKNOWN');assert.deepStrictEqual([d.profile,d.profileSha256,d.recipe,d.recipeSha256,d.builder,d.builderSha256],x);assert.strictEqual(d.pr,51);assert.strictEqual(d.runtimeCorrectness,'UNKNOWN');assert.strictEqual(d.candidateExecution,false);assert.strictEqual(r.plan({organId:id}).authority.toolExecution,false)}
assert.strictEqual(r.get('code.organ.html.v1').donor.visualBehavior,'UNKNOWN');
console.log(JSON.stringify({ok:true,boundOrgans:Object.keys(expected),runtimeCorrectness:'UNKNOWN',authority:'NONE'},null,2));
