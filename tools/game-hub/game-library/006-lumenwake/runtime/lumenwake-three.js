(function(){
  'use strict';
  var query=new URLSearchParams(location.search),player=query.get('player')||'screen',phone=player!=='screen'&&(query.get('controller')==='1'||matchMedia('(max-width:800px)').matches||/Android|iPhone|Mobile/i.test(navigator.userAgent));
  var canvas=document.getElementById('world3d'),stage=canvas&&canvas.closest('.stage'),current=null,THREE=null,renderer=null,scene=null,camera=null,mapRoot=null,dynamicRoot=null,core=null,coreOrb=null,coreLight=null,coreRings=[],mapId='',ready=false,failed=false;
  var players=new Map(),enemies=new Map(),shards=new Map(),duets=new Map(),resonances=new Map(),effects=new Map();
  var palette={cyan:'#55ecff',violet:'#ff6bd6',gold:'#ffd66b'};
  window.LumenwakeThree={setState:function(next){current=next;},status:function(){return{ready:ready,failed:failed,map:mapId,renderer:renderer?'three-r160':null};}};
  if(!canvas||phone)return;

  function seeded(seed){var value=seed%2147483647;if(value<=0)value+=2147483646;return function(){return(value=value*16807%2147483647)/2147483647;};}
  function world(x,y,height){return new THREE.Vector3((Number(x)-50)*1.05,Number(height)||0,(Number(y)-32)*.9);}
  function color(value){try{return new THREE.Color(value||'#ffffff');}catch(e){return new THREE.Color('#ffffff');}}
  function material(value,emissive,roughness){return new THREE.MeshStandardMaterial({color:value,emissive:value,emissiveIntensity:emissive==null?.18:emissive,roughness:roughness==null?.72:roughness,metalness:.05,flatShading:true});}
  function shadow(mesh){mesh.castShadow=true;mesh.receiveShadow=true;return mesh;}
  function clearGroup(group){while(group.children.length)group.remove(group.children[group.children.length-1]);}
  function clearMap(map){map.forEach(function(object){dynamicRoot.remove(object);});map.clear();}
  function resetDynamic(){[players,enemies,shards,duets,resonances,effects].forEach(clearMap);}
  function sync(map,items,key,maker,updater){var live=new Set();items.forEach(function(item,index){var id=key(item,index);live.add(id);var object=map.get(id);if(!object){object=maker(item,index);map.set(id,object);dynamicRoot.add(object);}updater(object,item,index);});map.forEach(function(object,id){if(live.has(id))return;dynamicRoot.remove(object);map.delete(id);});}

  function buildBackdrop(){
    var random=seeded(6062026),positions=[];
    for(var i=0;i<260;i++)positions.push((random()-.5)*180,8+random()*70,(random()-.5)*130);
    var geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    scene.add(new THREE.Points(geometry,new THREE.PointsMaterial({color:'#bfeeff',size:.18,transparent:true,opacity:.56,sizeAttenuation:true})));
    var horizon=new THREE.Mesh(new THREE.CylinderGeometry(78,84,4,12,1,true),new THREE.MeshStandardMaterial({color:'#07101d',roughness:1,side:THREE.DoubleSide,flatShading:true}));horizon.scale.z=.62;horizon.position.y=-2.8;horizon.receiveShadow=true;scene.add(horizon);
  }

  function buildCore(){
    core=new THREE.Group();core.position.copy(world(50,32,1.1));
    var pedestal=shadow(new THREE.Mesh(new THREE.CylinderGeometry(5.2,6.5,1.5,10),material('#10283a',.2,.82)));pedestal.position.y=-.25;core.add(pedestal);
    coreOrb=shadow(new THREE.Mesh(new THREE.IcosahedronGeometry(2.8,1),material('#74f5ff',1.4,.22)));coreOrb.position.y=3.8;core.add(coreOrb);
    var beam=new THREE.Mesh(new THREE.CylinderGeometry(1.1,3.6,18,8,1,true),new THREE.MeshBasicMaterial({color:'#55ecff',transparent:true,opacity:.075,side:THREE.DoubleSide,depthWrite:false}));beam.position.y=9;core.add(beam);
    ['#55ecff','#ff6bd6','#ffd66b'].forEach(function(value,index){var ring=new THREE.Mesh(new THREE.TorusGeometry(4.7+index*1.75,.14+index*.025,4,12),new THREE.MeshBasicMaterial({color:value,transparent:true,opacity:.58,depthWrite:false}));ring.rotation.x=Math.PI/2;ring.position.y=.7+index*.16;core.add(ring);coreRings.push(ring);});
    coreLight=new THREE.PointLight('#55ecff',2.4,46,1.7);coreLight.position.y=5;core.add(coreLight);scene.add(core);
  }

  function addBasinDecor(random){
    var ground=shadow(new THREE.Mesh(new THREE.CylinderGeometry(59,62,2,12),material('#071721',.08,1)));ground.scale.z=.56;ground.position.y=-1.3;mapRoot.add(ground);
    var top=shadow(new THREE.Mesh(new THREE.CylinderGeometry(57.5,58.5,.42,12),material('#0d2630',.12,.96)));top.scale.z=.55;top.position.y=-.08;mapRoot.add(top);
    var patchColors=['#123440','#102936','#183140','#1a283c','#0d3340'];
    for(var i=0;i<44;i++){var patch=shadow(new THREE.Mesh(new THREE.CylinderGeometry(2.5+random()*4.8,3+random()*5.2,.16,5+Math.floor(random()*3)),material(patchColors[i%patchColors.length],.08,1)));patch.position.set((random()-.5)*104,.12,(random()-.5)*52);patch.rotation.y=random()*Math.PI;patch.scale.z=.58+random()*.5;mapRoot.add(patch);}
    [12,20,29,39].forEach(function(radius,index){var ring=new THREE.Mesh(new THREE.TorusGeometry(radius,.08+index*.018,4,48),new THREE.MeshBasicMaterial({color:index%2?'#ff6bd6':'#55ecff',transparent:true,opacity:.11,depthWrite:false}));ring.rotation.x=Math.PI/2;ring.scale.z=.72;ring.position.y=.27;mapRoot.add(ring);});
    for(var p=0;p<26;p++){var crystal=shadow(new THREE.Mesh(new THREE.TetrahedronGeometry(.55+random()*1.3,0),material(p%3===0?'#24556a':p%3===1?'#4a245d':'#594e25',.24,.76)));var angle=p/26*Math.PI*2,radius=48+random()*7;crystal.position.set(Math.cos(angle)*radius,.4+random()*1.3,Math.sin(angle)*radius*.55);crystal.rotation.set(random()*Math.PI,random()*Math.PI,random()*Math.PI);mapRoot.add(crystal);}
  }

  function addCausewayDecor(random){
    var abyss=shadow(new THREE.Mesh(new THREE.CylinderGeometry(59,62,2,12),material('#080d21',.08,1)));abyss.scale.z=.56;abyss.position.y=-1.4;mapRoot.add(abyss);
    var causeway=shadow(new THREE.Mesh(new THREE.BoxGeometry(106,1.1,18,12,1,1),material('#182b45',.2,.86)));causeway.position.y=-.15;mapRoot.add(causeway);
    for(var i=-48;i<=48;i+=8){var tile=shadow(new THREE.Mesh(new THREE.BoxGeometry(6.2,.32,15.8),material(Math.abs(i/8)%2?'#203958':'#172f4d',.18,.88)));tile.position.set(i,.48,0);mapRoot.add(tile);[-1,1].forEach(function(side){var prism=shadow(new THREE.Mesh(new THREE.ConeGeometry(.7,3.5,4),material(side>0?'#ff6bd6':'#55ecff',.65,.48)));prism.position.set(i,.9,side*10.4);prism.rotation.y=Math.PI/4;mapRoot.add(prism);});}
    [-1,1].forEach(function(side){var rail=new THREE.Mesh(new THREE.BoxGeometry(110,.32,.35),material(side>0?'#ff6bd6':'#55ecff',.75,.45));rail.position.set(0,.8,side*9.2);mapRoot.add(rail);});
    for(var c=0;c<30;c++){var floater=shadow(new THREE.Mesh(new THREE.OctahedronGeometry(.6+random()*1.4,0),material(c%2?'#392250':'#164258',.3,.72)));floater.position.set((random()-.5)*112,-1+random()*3,(random()<.5?-1:1)*(13+random()*19));floater.rotation.set(random()*2,random()*2,random()*2);mapRoot.add(floater);}
  }

  function buildMap(id){
    mapId=id||'aurora-basin';clearGroup(mapRoot);resetDynamic();var random=seeded(mapId==='prism-causeway'?6062:6061);
    if(mapId==='prism-causeway')addCausewayDecor(random);else addBasinDecor(random);
    stage.dataset.map3d=mapId;
  }

  function makePlayer(data){
    var group=new THREE.Group(),mat=material(data.color,.48,.55),body=shadow(new THREE.Mesh(new THREE.CylinderGeometry(.62,.9,1.9,6),mat)),head=shadow(new THREE.Mesh(new THREE.IcosahedronGeometry(.66,0),mat)),cape=shadow(new THREE.Mesh(new THREE.ConeGeometry(.82,1.55,4),material(data.color,.24,.8))),halo=new THREE.Mesh(new THREE.TorusGeometry(1.28,.1,4,16),new THREE.MeshBasicMaterial({color:data.color,transparent:true,opacity:.9,depthTest:false}));
    body.position.y=1.05;head.position.y=2.35;cape.position.set(0,1,-.38);cape.rotation.x=.18;halo.rotation.x=Math.PI/2;halo.position.y=.16;group.add(body,head,cape,halo);group.userData={mat:mat,halo:halo,carried:[]};
    for(var i=0;i<3;i++){var crystal=new THREE.Mesh(new THREE.OctahedronGeometry(.34,0),material('#ffffff',1.1,.3));crystal.visible=false;group.add(crystal);group.userData.carried.push(crystal);}return group;
  }
  function updatePlayer(group,data,index,time){var p=world(data.x,data.y,.25);group.position.copy(p);group.visible=!data.down;group.rotation.y=Math.sin(time*.001+index)*.08;group.userData.mat.color.set(data.color);group.userData.mat.emissive.set(data.color);group.userData.halo.material.color.set(data.color);group.userData.halo.rotation.z=-time*.0008;group.userData.carried.forEach(function(crystal,i){var value=data.carried&&data.carried[i];crystal.visible=!!value;if(!value)return;var a=time*.002+i*Math.PI*2/Math.max(1,data.carried.length);crystal.position.set(Math.cos(a)*(1.7+i*.25),1.55+Math.sin(a*1.7)*.35,Math.sin(a)*(1.7+i*.25));crystal.rotation.y=time*.003+i;crystal.material.color.set(palette[value]||'#ffffff');crystal.material.emissive.set(palette[value]||'#ffffff');});}

  function makeEnemy(){var group=new THREE.Group(),mat=material('#391752',.55,.68),body=shadow(new THREE.Mesh(new THREE.IcosahedronGeometry(1.25,0),mat));body.scale.set(1.25,.85,1.25);body.position.y=1.35;group.add(body);for(var i=0;i<5;i++){var spike=shadow(new THREE.Mesh(new THREE.ConeGeometry(.26,.95,4),mat));var a=i/5*Math.PI*2;spike.position.set(Math.cos(a)*1.05,2.1,Math.sin(a)*1.05);spike.rotation.z=Math.cos(a)*.62;spike.rotation.x=Math.sin(a)*.62;group.add(spike);}group.userData={mat:mat};return group;}
  function updateEnemy(group,data,index,time){group.position.copy(world(data.x,data.y,.24+Math.sin(time*.004+index)*.18));var stunned=Number(data.stunnedUntil)>Number(current&&current.now);group.userData.mat.color.set(stunned?'#1f7688':'#391752');group.userData.mat.emissive.set(stunned?'#55ecff':'#c45cff');group.userData.mat.emissiveIntensity=stunned?1:.55;group.rotation.y=time*.0007+index;}

  function makeShard(data){var value=palette[data.color]||'#ffffff',group=new THREE.Group(),crystal=shadow(new THREE.Mesh(new THREE.OctahedronGeometry(.72,0),material(value,1.25,.28))),ring=new THREE.Mesh(new THREE.TorusGeometry(1.05,.055,4,12),new THREE.MeshBasicMaterial({color:value,transparent:true,opacity:.55,depthWrite:false}));ring.rotation.x=Math.PI/2;group.add(crystal,ring);group.userData={crystal:crystal,ring:ring};return group;}
  function updateShard(group,data,index,time){group.position.copy(world(data.x,data.y,1.15+Math.sin(time*.0025+index)*.38));group.rotation.y=time*.0018+index;group.userData.ring.rotation.z=-time*.0014-index;}

  function makeDuet(data){var group=new THREE.Group(),pads=[],rings=[];for(var i=0;i<2;i++){var pad=shadow(new THREE.Mesh(new THREE.CylinderGeometry(1.65,1.9,.38,8),material(data.color,.5,.62))),ring=new THREE.Mesh(new THREE.TorusGeometry(2.15,.12,4,16),new THREE.MeshBasicMaterial({color:data.color,transparent:true,opacity:.7,depthWrite:false}));ring.rotation.x=Math.PI/2;pad.position.y=.18;ring.position.y=.48;group.add(pad,ring);pads.push(pad);rings.push(ring);}var line=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:data.color,transparent:true,opacity:.55}));group.add(line);group.userData={pads:pads,rings:rings,line:line};return group;}
  function updateDuet(group,data,index,time){var points=(data.pads||[]).map(function(p){return world(p.x,p.y,.52);});group.userData.pads.forEach(function(pad,i){if(!points[i])return;pad.position.copy(points[i]);pad.position.y=.2;pad.material.emissiveIntensity=data.complete?.95:.35+Number(data.progress||0)*.6;pad.scale.y=data.occupants&&data.occupants[i]?1.8:1;group.userData.rings[i].position.copy(points[i]);group.userData.rings[i].rotation.z=time*.0007*(i?1:-1);group.userData.rings[i].material.opacity=data.complete?.95:.42+Number(data.progress||0)*.4;});if(points.length===2)group.userData.line.geometry.setFromPoints(points);}

  function makeResonance(data){var group=new THREE.Group(),base=shadow(new THREE.Mesh(new THREE.CylinderGeometry(1.9,2.25,.65,6),material(data.color,.48,.7))),obelisk=shadow(new THREE.Mesh(new THREE.ConeGeometry(.68,3.8,5),material(data.color,.72,.52))),ring=new THREE.Mesh(new THREE.TorusGeometry(2.45,.13,4,16),new THREE.MeshBasicMaterial({color:data.color,transparent:true,opacity:.75,depthWrite:false}));base.position.y=.34;obelisk.position.y=2.2;ring.rotation.x=Math.PI/2;ring.position.y=.72;group.add(base,obelisk,ring);group.userData={base:base,obelisk:obelisk,ring:ring};return group;}
  function updateResonance(group,data,index,time){group.position.copy(world(data.x,data.y,.02));var armed=data.firstPlayer&&!data.complete,scale=data.complete?1.28:armed?1.13:1;group.scale.setScalar(scale);group.userData.obelisk.rotation.y=time*.0014+index;group.userData.ring.rotation.z=-time*.001+index;group.userData.ring.material.opacity=data.complete?.98:armed?.9:.52;group.userData.obelisk.material.emissiveIntensity=data.complete?1.2:armed?.95:.5;}

  function makeEffect(data){var value=palette[data.color]||data.color||'#ffffff',ring=new THREE.Mesh(new THREE.TorusGeometry(2,.17,4,20),new THREE.MeshBasicMaterial({color:value,transparent:true,opacity:1,depthWrite:false}));ring.rotation.x=Math.PI/2;ring.userData={bornAt:Number(data.bornAt)||Date.now()};return ring;}
  function updateEffect(ring,data,index,time){var now=Number(current&&current.now)||Date.now(),born=Number(data.bornAt)||now,age=Math.max(0,(now-born)/900);ring.position.copy(world(data.x,data.y,.65));ring.scale.setScalar(1+age*6);ring.material.opacity=Math.max(0,1-age);}

  function updateScene(time){
    if(!current)return;if((current.map&&current.map.id||'aurora-basin')!==mapId)buildMap(current.map&&current.map.id);
    var playerItems=Object.keys(current.players||{}).map(function(id){return current.players[id];});
    sync(players,playerItems,function(item){return item.id;},makePlayer,function(object,item,index){updatePlayer(object,item,index,time);});
    sync(enemies,current.enemies||[],function(item){return item.id;},makeEnemy,function(object,item,index){updateEnemy(object,item,index,time);});
    sync(shards,current.shards||[],function(item){return item.id;},makeShard,function(object,item,index){updateShard(object,item,index,time);});
    sync(duets,current.duets||[],function(item){return item.id;},makeDuet,function(object,item,index){updateDuet(object,item,index,time);});
    sync(resonances,current.resonances||[],function(item){return item.id;},makeResonance,function(object,item,index){updateResonance(object,item,index,time);});
    sync(effects,current.effects||[],function(item,index){return String(item.id||item.kind||'fx')+':'+String(item.bornAt||index);},makeEffect,function(object,item,index){updateEffect(object,item,index,time);});
    var ratio=Math.max(0,Math.min(1,Number(current.charge||0)/Math.max(1,Number(current.goal||1))));coreOrb.scale.setScalar(1+Math.sin(time*.003)*.08+ratio*.36);coreOrb.rotation.y=time*.0007;coreOrb.rotation.x=time*.00035;coreLight.intensity=2.1+ratio*3+Math.sin(time*.004)*.3;coreRings.forEach(function(ring,index){ring.rotation.z=time*.00035*(index%2?1:-1)*(index+1);ring.material.opacity=.38+ratio*.48;});
  }

  function frame(time){requestAnimationFrame(frame);updateScene(time||0);camera.position.x=Math.sin((time||0)*.00008)*1.2;camera.lookAt(0,0,0);renderer.render(scene,camera);}
  function init(module){
    THREE=module;renderer=new THREE.WebGLRenderer({canvas:canvas,antialias:false,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1));renderer.setSize(1280,720,false);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.38;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    scene=new THREE.Scene();scene.background=new THREE.Color('#02050d');scene.fog=new THREE.Fog('#07101b',68,145);camera=new THREE.PerspectiveCamera(42,16/9,.1,260);camera.position.set(0,78,54);camera.lookAt(0,0,0);
    scene.add(new THREE.HemisphereLight('#98edff','#160b27',1.15));var sun=new THREE.DirectionalLight('#d7f7ff',1.7);sun.position.set(-24,48,26);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-70;sun.shadow.camera.right=70;sun.shadow.camera.top=55;sun.shadow.camera.bottom=-55;sun.shadow.camera.far=180;scene.add(sun);var violet=new THREE.DirectionalLight('#ff6bd6',.42);violet.position.set(35,20,-28);scene.add(violet);
    mapRoot=new THREE.Group();dynamicRoot=new THREE.Group();scene.add(mapRoot,dynamicRoot);buildBackdrop();buildCore();buildMap('aurora-basin');ready=true;stage.dataset.renderer='three-r160';stage.classList.add('three-ready');frame(0);
  }
  import('/vendor/three.module.js').then(init).catch(function(error){failed=true;if(stage)stage.dataset.renderer='canvas2d-fallback';console.warn('Lumenwake 3D renderer unavailable; retaining Canvas2D fallback.',error&&error.message||error);});
})();
