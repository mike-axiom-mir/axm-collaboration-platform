'use strict';

const Rigged=require('../asset-hands/rigged-gltf-codec');
const JOINTS=[
  {name:'root',parent:null,t:[0,0,0]},
  {name:'pelvis',parent:0,t:[0,.8,0]},
  {name:'spine',parent:1,t:[0,.35,0]},
  {name:'chest',parent:2,t:[0,.35,0]},
  {name:'head',parent:3,t:[0,.45,0]},
  {name:'upper_arm_l',parent:3,t:[-.38,.08,0]},
  {name:'lower_arm_l',parent:5,t:[0,-.38,0]},
  {name:'upper_arm_r',parent:3,t:[.38,.08,0]},
  {name:'lower_arm_r',parent:7,t:[0,-.38,0]},
  {name:'upper_leg_l',parent:1,t:[-.17,-.15,0]},
  {name:'lower_leg_l',parent:9,t:[0,-.45,0]},
  {name:'upper_leg_r',parent:1,t:[.17,-.15,0]},
  {name:'lower_leg_r',parent:11,t:[0,-.45,0]}
];
function bytes(value){return value instanceof Uint8Array?value:new Uint8Array(value.buffer,value.byteOffset,value.byteLength);}
function pad(value,multiple,fill){value=bytes(value);const out=new Uint8Array(Math.ceil(value.length/multiple)*multiple);out.fill(fill||0);out.set(value);return out;}
function concat(parts){const length=parts.reduce((sum,item)=>sum+item.length,0),out=new Uint8Array(length);let offset=0;for(const item of parts){out.set(item,offset);offset+=item.length;}return out;}
function utf8(value){return new TextEncoder().encode(String(value));}
function rgb(hex){const n=parseInt(String(hex||'#808080').slice(1),16);return[((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255,1];}
function normal(a,b,c){const u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],v=[c[0]-a[0],c[1]-a[1],c[2]-a[2]],n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],l=Math.hypot(...n)||1;return n.map(value=>value/l);}
function jointFor(point){const x=point[0],y=point[1];if(y>1.68)return 4;if(Math.abs(x)>.29&&y>.72){if(x<0)return y>1.16?5:6;return y>1.16?7:8;}if(y<.82){if(x<0)return y>.34?9:10;return y>.34?11:12;}if(y<1.0)return 1;if(y<1.36)return 2;return 3;}
function quatX(angle){return[Math.sin(angle/2),0,0,Math.cos(angle/2)];}
function skeletonGlobals(){const values=[];for(let i=0;i<JOINTS.length;i++){const joint=JOINTS[i],parent=joint.parent==null?[0,0,0]:values[joint.parent];values.push([parent[0]+joint.t[0],parent[1]+joint.t[1],parent[2]+joint.t[2]]);}return values;}
function buildArrays(mesh,palette){const positions=[],normals=[],colours=[],joints=[],weights=[],indices=[];for(const face of mesh.triangles){const n=normal(...face.points),colour=rgb(palette[face.material]||palette.cloth);for(const point of face.points){positions.push(...point);normals.push(...n);colours.push(...colour);const joint=jointFor(point);joints.push(joint,0,0,0);weights.push(1,0,0,0);indices.push(indices.length);}}return{positions:new Float32Array(positions),normals:new Float32Array(normals),colours:new Float32Array(colours),joints:new Uint16Array(joints),weights:new Float32Array(weights),indices:new Uint16Array(indices)};}
function pack(mesh,options){
  options=options||{};if(!mesh||!Array.isArray(mesh.triangles)||!mesh.triangles.length)throw new Error('PS2 character rig requires a triangle mesh');const arrays=buildArrays(mesh,options.palette||{}),chunks=[],views=[],accessors=[];
  function view(array,target){const value=pad(new Uint8Array(array.buffer,array.byteOffset,array.byteLength),4),offset=chunks.reduce((sum,item)=>sum+item.length,0),index=views.length;chunks.push(value);views.push({buffer:0,byteOffset:offset,byteLength:array.byteLength});if(target)views[index].target=target;return index;}
  function accessor(array,type,componentType,target,min,max){const size={SCALAR:1,VEC3:3,VEC4:4,MAT4:16}[type],record={bufferView:view(array,target),componentType,count:array.length/size,type};if(min)record.min=min;if(max)record.max=max;accessors.push(record);return accessors.length-1;}
  const bounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};for(let i=0;i<arrays.positions.length;i+=3)for(let d=0;d<3;d++){bounds.min[d]=Math.min(bounds.min[d],arrays.positions[i+d]);bounds.max[d]=Math.max(bounds.max[d],arrays.positions[i+d]);}
  const position=accessor(arrays.positions,'VEC3',5126,34962,bounds.min,bounds.max),normalAccessor=accessor(arrays.normals,'VEC3',5126,34962),colour=accessor(arrays.colours,'VEC4',5126,34962),joint=accessor(arrays.joints,'VEC4',5123,34962),weight=accessor(arrays.weights,'VEC4',5126,34962),index=accessor(arrays.indices,'SCALAR',5123,34963),globals=skeletonGlobals(),inverse=new Float32Array(JOINTS.length*16);
  for(let i=0;i<JOINTS.length;i++){inverse[i*16]=1;inverse[i*16+5]=1;inverse[i*16+10]=1;inverse[i*16+15]=1;inverse[i*16+12]=-globals[i][0];inverse[i*16+13]=-globals[i][1];inverse[i*16+14]=-globals[i][2];}
  const inverseAccessor=accessor(inverse,'MAT4',5126),times=new Float32Array([0,.25,.5,.75,1]),timeAccessor=accessor(times,'SCALAR',5126,null,[0],[1]),animated=[2,5,7,9,11],angles={2:[0,.035,0,-.035,0],5:[-.48,0,.48,0,-.48],7:[.48,0,-.48,0,.48],9:[.5,0,-.5,0,.5],11:[-.5,0,.5,0,-.5]},samplers=[],channels=[];
  for(const jointIndex of animated){const rotations=new Float32Array(angles[jointIndex].flatMap(quatX)),rotationAccessor=accessor(rotations,'VEC4',5126);samplers.push({input:timeAccessor,output:rotationAccessor,interpolation:'LINEAR'});channels.push({sampler:samplers.length-1,target:{node:jointIndex+1,path:'rotation'}});}
  const nodes=[{name:'CharacterMesh',mesh:0,skin:0}].concat(JOINTS.map((item,index)=>{const node={name:item.name,translation:item.t.slice()},children=[];for(let child=0;child<JOINTS.length;child++)if(JOINTS[child].parent===index)children.push(child+1);if(children.length)node.children=children;return node;})),binary=concat(chunks),json={asset:{version:'2.0',generator:'AXM PS2 Character Rig 1.0.0'},scene:0,scenes:[{name:options.name||mesh.name,nodes:[0,1]}],nodes,meshes:[{name:'PS2SkinnedCharacter',primitives:[{attributes:{POSITION:position,NORMAL:normalAccessor,COLOR_0:colour,JOINTS_0:joint,WEIGHTS_0:weight},indices:index,material:0,mode:4}]}],materials:[{name:'VertexColourCharacter',pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],metallicFactor:0,roughnessFactor:.72},doubleSided:false,alphaMode:'OPAQUE'}],skins:[{name:'PS2HumanoidSkin',inverseBindMatrices:inverseAccessor,skeleton:1,joints:JOINTS.map((_,i)=>i+1)}],animations:[{name:'WalkCycle',samplers,channels}],buffers:[{byteLength:binary.length}],bufferViews:views,accessors,extras:{axm:{schema:'axm.ps2-character-rig/v1',source_mesh:mesh.name,joints:JOINTS.length,frames:times.length,triangles:mesh.triangles.length,vertex_colours:true,animation:'walk-cycle',up_axis:'y',handedness:'right'}}},jsonBytes=pad(utf8(JSON.stringify(json)),4,32),binBytes=pad(binary,4,0),total=12+8+jsonBytes.length+8+binBytes.length,output=new Uint8Array(total),data=new DataView(output.buffer);data.setUint32(0,0x46546c67,true);data.setUint32(4,2,true);data.setUint32(8,total,true);data.setUint32(12,jsonBytes.length,true);data.setUint32(16,0x4e4f534a,true);output.set(jsonBytes,20);const header=20+jsonBytes.length;data.setUint32(header,binBytes.length,true);data.setUint32(header+4,0x004e4942,true);output.set(binBytes,header+8);const inspection=Rigged.inspect(output);if(!inspection.pass)throw new Error('PS2 character GLB failed: '+inspection.errors.join(', '));return{bytes:output,inspection,clip:{schema:'animation/clip+json',version:'2.0.0',id:(options.id||mesh.name)+'-walk',name:'PS2 humanoid walk',fps:4,duration_seconds:1,loop:true,joints:JOINTS.map(item=>item.name),frames:Array.from(times),animated_joints:animated.map(index=>JOINTS[index].name)},report:{schema:'axm.ps2-character-rig-validation/v1',status:'PASS',joints:JOINTS.length,frames:times.length,triangles:mesh.triangles.length,vertices:arrays.positions.length/3,weightSumsPass:inspection.weightSumsPass,jointIndicesPass:inspection.jointIndicesPass,deformation:inspection.deformation}};}

module.exports={JOINTS,pack,jointFor};
