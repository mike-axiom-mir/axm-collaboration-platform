export const MATERIAL_VERIFICATION_SCHEMA = 'axm.pbr-material-verification/v1';

function channel(map, channelIndex) {
  const values=[];for(let index=channelIndex;index<map.length;index+=4)values.push(map[index]);return values;
}
function stats(values){let sum=0,minimum=Infinity,maximum=-Infinity;for(const value of values){sum+=value;minimum=Math.min(minimum,value);maximum=Math.max(maximum,value);}const mean=sum/values.length;let variance=0;for(const value of values)variance+=(value-mean)**2;return{minimum,maximum,mean,stddev:Math.sqrt(variance/values.length)};}
function sameChannel(a,b){if(a.length!==b.length)return false;for(let i=0;i<a.length;i+=1)if(a[i]!==b[i])return false;return true;}
function result(id,label,passed,evidence){return{id,label,status:passed?'pass':'fail',evidence};}

export function verifyMaterialBake(bake) {
  const size=bake.recipe?.size||0,expected=size*size*4,maps=bake.maps||{},checks=[];
  for(const name of ['albedo','normal','orm','emissive','height'])checks.push(result(`map-${name}`,`${name} map has exact dimensions`,maps[name]?.length===expected,`${maps[name]?.length||0} / ${expected} channel bytes`));
  if(checks.some(check=>check.status==='fail'))return{schema:MATERIAL_VERIFICATION_SCHEMA,status:'fail',checks,statistics:{}};
  const albedoStats=[0,1,2].map(index=>stats(channel(maps.albedo,index)));
  const heightStats=stats(channel(maps.height,0));
  const normalStats=[0,1,2].map(index=>stats(channel(maps.normal,index)));
  const ormChannels=[0,1,2].map(index=>channel(maps.orm,index)),ormStats=ormChannels.map(stats);
  checks.push(result('albedo-signal','Albedo contains non-flat surface signal',albedoStats.some(value=>value.stddev>2),`max channel σ ${Math.max(...albedoStats.map(value=>value.stddev)).toFixed(2)}`));
  checks.push(result('height-signal','Height contains non-flat relief signal',heightStats.stddev>1.5,`σ ${heightStats.stddev.toFixed(2)}, range ${heightStats.minimum}–${heightStats.maximum}`));
  checks.push(result('normal-signal','Normal contains derived directional signal',normalStats[0].stddev>1&&normalStats[1].stddev>1&&normalStats[2].mean>170,`X σ ${normalStats[0].stddev.toFixed(2)}, Y σ ${normalStats[1].stddev.toFixed(2)}, Z μ ${normalStats[2].mean.toFixed(2)}`));
  let lengthTotal=0,pixels=0;for(let offset=0;offset<maps.normal.length;offset+=4){const x=maps.normal[offset]/255*2-1,y=maps.normal[offset+1]/255*2-1,z=maps.normal[offset+2]/255*2-1;lengthTotal+=Math.hypot(x,y,z);pixels+=1;}const meanLength=lengthTotal/pixels;
  checks.push(result('normal-unit','Decoded normals remain unit length',Math.abs(meanLength-1)<.025,`mean length ${meanLength.toFixed(4)}`));
  checks.push(result('tangent-convention','Tangent convention is explicit',/OpenGL tangent space; \+Y green/.test(bake.recipe.tangentConvention||''),bake.recipe.tangentConvention||'missing'));
  checks.push(result('orm-signal','Packed ORM contains independent channel meaning',!sameChannel(ormChannels[0],ormChannels[1])&&!sameChannel(ormChannels[1],ormChannels[2]),`AO σ ${ormStats[0].stddev.toFixed(2)}, roughness σ ${ormStats[1].stddev.toFixed(2)}, metal σ ${ormStats[2].stddev.toFixed(2)}`));
  checks.push(result('orm-semantics','Packed channel semantics are declared',bake.recipe.packing?.orm?.red==='ambient-occlusion'&&bake.recipe.packing?.orm?.green==='roughness'&&bake.recipe.packing?.orm?.blue==='metalness','R=AO, G=roughness, B=metalness'));
  const failures=checks.filter(check=>check.status==='fail');
  return{schema:MATERIAL_VERIFICATION_SCHEMA,status:failures.length?'fail':'pass',checks,summary:{passed:checks.length-failures.length,failed:failures.length},statistics:{albedo:albedoStats,height:heightStats,normal:normalStats,orm:ormStats,normalMeanLength:meanLength}};
}
