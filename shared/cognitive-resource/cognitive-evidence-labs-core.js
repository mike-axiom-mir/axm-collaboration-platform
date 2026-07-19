'use strict';

const Core = require('./cognitive-resource-core');

const SCHEMAS = Object.freeze({
  CALIBRATION:'axm.cognitive-calibration.record/v1',
  ATTENTION:'axm.human-attention.observation/v1',
  ATTENTION_WITHDRAWAL:'axm.human-attention.consent-withdrawal/v1',
  SUSTAINABILITY:'axm.sustainability-metrology.observation/v1',
  MIRROR_INTAKE:'axm.mirror-intake.receipt/v1'
});
const CALIBRATION_UNITS=Object.freeze({TOKENS:'TOKENS',CPU_CORE_MILLISECONDS:'MILLISECONDS',ACCELERATOR_MILLISECONDS:'MILLISECONDS',WALL_MILLISECONDS:'MILLISECONDS',MONEY_MICROS:'MONEY_MICROS',ENERGY_MILLIWATT_HOURS:'MILLIWATT_HOURS',CARBON_MILLIGRAMS:'MILLIGRAMS'});

function source(value,label,methods) {
  Core.exactKeys(value,['sourceSystemId','sourceRecordId','sourceRecordDigest','collectionMethod','authorshipState'],label+' source');
  return {sourceSystemId:Core.id(value.sourceSystemId,label+'.sourceSystemId'),sourceRecordId:Core.id(value.sourceRecordId,label+'.sourceRecordId'),sourceRecordDigest:Core.sha(value.sourceRecordDigest,label+'.sourceRecordDigest'),collectionMethod:Core.enumValue(value.collectionMethod,methods,label+'.collectionMethod'),authorshipState:Core.enumValue(value.authorshipState,['DECLARED_NOT_CERTIFIED','UNKNOWN'],label+'.authorshipState')};
}
function list(values,label,max) { if(!Array.isArray(values)||values.length>(max||32))throw new Error(label+' must be a bounded array');const items=values.map((item,index)=>Core.id(item,label+'['+index+']'));if(new Set(items).size!==items.length)throw new Error(label+' contains duplicates');return items.sort(); }
function time(value,label) { const text=String(value||'');if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(text)||!Number.isFinite(Date.parse(text)))throw new Error(label+' requires an ISO UTC timestamp');return text; }

function normalizeCalibration(value) {
  Core.assertPrivacySafe(value);Core.exactKeys(value,['schema','source','prediction','actual','permission'],'calibration record');if(value.schema!==SCHEMAS.CALIBRATION)throw new Error('calibration record schema changed');
  Core.exactKeys(value.prediction,['dimension','unit','lowerBound','upperBound','profileDigest'],'calibration prediction');const dimension=Core.enumValue(value.prediction.dimension,Object.keys(CALIBRATION_UNITS),'prediction.dimension'),unit=Core.enumValue(value.prediction.unit,[CALIBRATION_UNITS[dimension]],'prediction.unit'),lowerBound=Core.count(value.prediction.lowerBound,'prediction.lowerBound',false),upperBound=Core.count(value.prediction.upperBound,'prediction.upperBound',false);if(lowerBound>upperBound)throw new Error('calibration prediction lower bound exceeds upper bound');
  Core.exactKeys(value.actual,['value','observationRecordId','observationDigest'],'calibration actual');
  return Core.stableValue({schema:SCHEMAS.CALIBRATION,source:source(value.source,'calibration',['IMPORTED_ATTESTATION','MANUAL_DECLARATION']),prediction:{dimension,unit,lowerBound,upperBound,profileDigest:Core.sha(value.prediction.profileDigest,'prediction.profileDigest',true)},actual:{value:Core.count(value.actual.value,'actual.value',false),observationRecordId:Core.id(value.actual.observationRecordId,'actual.observationRecordId'),observationDigest:Core.sha(value.actual.observationDigest,'actual.observationDigest')},permission:Core.permission(value.permission,'calibration permission')});
}
function calibrationComparison(record) { const value=record.actual.value,lower=record.prediction.lowerBound,upper=record.prediction.upperBound,inside=value>=lower&&value<=upper,error=value<lower?lower-value:(value>upper?value-upper:0);return {dimension:record.prediction.dimension,unit:record.prediction.unit,insideDeclaredInterval:inside,distanceOutsideInterval:error,absoluteErrorToMidpoint:Math.abs(value-Math.floor((lower+upper)/2)),calibratedAccuracyClaim:false,ranking:false,selection:false}; }

function normalizeAttention(value) {
  Core.assertPrivacySafe(value);Core.exactKeys(value,['schema','source','participantPseudonymDigest','consent','contextDigest','reviewMilliseconds','interruptionCount','accessibilityLoad','outcome','permission'],'attention observation');if(value.schema!==SCHEMAS.ATTENTION)throw new Error('attention observation schema changed');Core.exactKeys(value.consent,['status','basisDigest'],'attention consent');
  const consent={status:Core.enumValue(value.consent.status,['OPTED_IN'],'consent.status'),basisDigest:Core.sha(value.consent.basisDigest,'consent.basisDigest')};
  return Core.stableValue({schema:SCHEMAS.ATTENTION,source:source(value.source,'attention',['DIRECT_MACHINE_METER','IMPORTED_ATTESTATION','MANUAL_DECLARATION']),participantPseudonymDigest:Core.sha(value.participantPseudonymDigest,'participantPseudonymDigest'),consent,contextDigest:Core.sha(value.contextDigest,'contextDigest'),reviewMilliseconds:Core.count(value.reviewMilliseconds,'reviewMilliseconds',false),interruptionCount:Core.count(value.interruptionCount,'interruptionCount',false),accessibilityLoad:Core.enumValue(value.accessibilityLoad,['NOT_RECORDED','LOW','MEDIUM','HIGH'],'accessibilityLoad'),outcome:Core.enumValue(value.outcome,['COMPLETED','PARTIAL','ABANDONED','UNKNOWN'],'outcome'),permission:Core.permission(value.permission,'attention permission')});
}
function normalizeAttentionWithdrawal(value) { Core.assertPrivacySafe(value);Core.exactKeys(value,['schema','participantPseudonymDigest','basisDigest','withdrawnAt','permission'],'attention withdrawal');if(value.schema!==SCHEMAS.ATTENTION_WITHDRAWAL)throw new Error('attention withdrawal schema changed');return Core.stableValue({schema:SCHEMAS.ATTENTION_WITHDRAWAL,participantPseudonymDigest:Core.sha(value.participantPseudonymDigest,'participantPseudonymDigest'),basisDigest:Core.sha(value.basisDigest,'basisDigest'),withdrawnAt:time(value.withdrawnAt,'withdrawnAt'),permission:Core.permission(value.permission,'attention withdrawal permission')}); }

function normalizeSustainability(value) {
  Core.assertPrivacySafe(value);Core.exactKeys(value,['schema','source','hardwareProfileDigest','measurement','permission'],'sustainability observation');if(value.schema!==SCHEMAS.SUSTAINABILITY)throw new Error('sustainability observation schema changed');Core.exactKeys(value.measurement,['method','durationMilliseconds','energyMilliwattHours','carbonMilligrams','powerMeterDigest','regionalFactorDigest'],'sustainability measurement');
  const measurement={method:Core.enumValue(value.measurement.method,['DIRECT_POWER_METER','IMPORTED_ATTESTATION','MANUAL_DECLARATION'],'measurement.method'),durationMilliseconds:Core.count(value.measurement.durationMilliseconds,'measurement.durationMilliseconds',true),energyMilliwattHours:Core.count(value.measurement.energyMilliwattHours,'measurement.energyMilliwattHours',true),carbonMilligrams:Core.count(value.measurement.carbonMilligrams,'measurement.carbonMilligrams',true),powerMeterDigest:Core.sha(value.measurement.powerMeterDigest,'measurement.powerMeterDigest',true),regionalFactorDigest:Core.sha(value.measurement.regionalFactorDigest,'measurement.regionalFactorDigest',true)};
  if(measurement.energyMilliwattHours===null&&measurement.carbonMilligrams===null)throw new Error('sustainability observation requires direct energy or carbon evidence');if(measurement.method==='DIRECT_POWER_METER'&&(measurement.energyMilliwattHours===null||measurement.powerMeterDigest===null))throw new Error('direct power meter evidence requires energy and a meter digest');if(measurement.carbonMilligrams!==null&&measurement.regionalFactorDigest===null)throw new Error('carbon evidence requires a regional factor digest');
  return Core.stableValue({schema:SCHEMAS.SUSTAINABILITY,source:source(value.source,'sustainability',['DIRECT_MACHINE_METER','IMPORTED_ATTESTATION','MANUAL_DECLARATION']),hardwareProfileDigest:Core.sha(value.hardwareProfileDigest,'hardwareProfileDigest'),measurement,permission:Core.permission(value.permission,'sustainability permission')});
}

function normalizeMirrorIntake(value) {
  Core.assertPrivacySafe(value);Core.exactKeys(value,['schema','source','draftRecordId','draftDigest','draftSchema','intakeState','mirrorReceiptDigest','issues','observedAt','permission'],'Mirror intake receipt');if(value.schema!==SCHEMAS.MIRROR_INTAKE)throw new Error('Mirror intake receipt schema changed');
  return Core.stableValue({schema:SCHEMAS.MIRROR_INTAKE,source:source(value.source,'Mirror intake',['IMPORTED_ATTESTATION','MANUAL_DECLARATION']),draftRecordId:Core.id(value.draftRecordId,'draftRecordId'),draftDigest:Core.sha(value.draftDigest,'draftDigest'),draftSchema:Core.enumValue(value.draftSchema,[Core.OBSERVATION_DRAFT_SCHEMA,Core.ECONOMICS_DRAFT_SCHEMA],'draftSchema'),intakeState:Core.enumValue(value.intakeState,['ACCEPTED','HELD','SUPERSEDED','REJECTED','UNKNOWN'],'intakeState'),mirrorReceiptDigest:Core.sha(value.mirrorReceiptDigest,'mirrorReceiptDigest',true),issues:list(value.issues,'issues',64),observedAt:time(value.observedAt,'observedAt'),permission:Core.permission(value.permission,'Mirror intake permission')});
}

module.exports={SCHEMAS,CALIBRATION_UNITS,normalizeCalibration,calibrationComparison,normalizeAttention,normalizeAttentionWithdrawal,normalizeSustainability,normalizeMirrorIntake};

