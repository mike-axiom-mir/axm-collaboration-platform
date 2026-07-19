'use strict';
const fs=require('fs'),path=require('path');
const {listFiles,sha256,atomicWriteJson,now}=require('../core/utils');
const root=path.resolve(__dirname,'..');
const files=listFiles(root).filter(f=>!f.endsWith('BUILD_MANIFEST.json')&&!f.includes(path.join('storage','runtime'))&&!f.endsWith('.zip'));
const manifest={
  schema:'axm.mirror.learning-forge.build-manifest/v1',
  build:'AXM Mirror Learning Forge',version:'0.7.1-body-safe',status:'WORKING TEST',
  localOnly:true,runtimeInternetRequired:false,automaticTraining:false,automaticPromotion:false,liveMirrorCoreApply:false,
  learningMetabolism:true,singleBoundedLearningSession:true,automaticLearningRequiresBodyPulseLease:true,resourceUseIsNotLearningEvidence:true,
  jsonStructuredLiteracy:true,codingStaticFirst:true,codeExecutionAuthority:false,
  creativeStudioClasses:true,studioAccessAuthority:false,studioVisualReceiptRequired:true,
  rootedIntelligenceTeaching:true,rootCanonEditAuthority:false,rootPhraseOverlapPrimary:false,dissentPreserved:true,
  reasoningSchool:true,singleIqScore:false,humanEquivalenceClaim:false,reasoningProfileIsBenchmark:false,hiddenChainOfThoughtRequired:false,reasoningAuthorityFromGrade:false,
  adaptiveCommunicationSchool:true,adaptationIsNotSubmission:true,semanticPreservationRequired:true,audienceModelIsTentative:true,agreementIsNotSuccess:true,adaptivityAuthorityFromGrade:false,
  githubModified:false,sourcePr:14,sourcePrHead:'d427a35f3dafa500d40ff66b86cb464563e4e42b',generatedAt:now(),fileCount:files.length,
  files:files.map(f=>({path:path.relative(root,f).replace(/\\/g,'/'),bytes:fs.statSync(f).size,sha256:sha256(fs.readFileSync(f))}))
};
atomicWriteJson(path.join(root,'BUILD_MANIFEST.json'),manifest);console.log('Manifest:',manifest.fileCount,'files');
