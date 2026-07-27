#!/usr/bin/env node
'use strict';

const assert = require('assert');
const U = require('./foundation-utils');
const F = require('./foundation-index');

// #40: high-to-low bakes require real ray hits, exact mesh bindings, tangent evidence and rendered comparison.
const highDigest=U.sha256('high-mesh'),lowDigest=U.sha256('low-mesh');
const maps=['normal','ambient-occlusion','curvature'].map((kind)=>({kind,mime:'image/png',pixel_digest:U.sha256(kind),source_high_digest:highDigest,target_low_digest:lowDigest,ray_hits:1000,miss_ratio:.001}));
const bakePass=F.advanced3d.assessBake({high_mesh_digest:highDigest,low_mesh_digest:lowDigest,maps,max_miss_ratio:.01,tangent_convention:'MikkTSpace',raycast_receipt:{status:'PASS',high_mesh_digest:highDigest,low_mesh_digest:lowDigest,digest:U.sha256('rays')},tangent_receipt:{status:'PASS',low_mesh_digest:lowDigest,convention:'MikkTSpace',digest:U.sha256('tangents')},render_matrix:{status:'PASS',digest:U.sha256('bake-render')}});
assert.equal(bakePass.status,'PASS');
assert.equal(F.advanced3d.assessBake({high_mesh_digest:highDigest,low_mesh_digest:lowDigest,maps,max_miss_ratio:.01,tangent_convention:'MikkTSpace',raycast_receipt:{status:'MISSING_SUBSTRATE',digest:U.sha256('missing')},tangent_receipt:{status:'PASS',low_mesh_digest:lowDigest,convention:'MikkTSpace'},render_matrix:{status:'PASS'}}).status,'MISSING_SUBSTRATE');

// #41: LODs carry real topology/UV/silhouette facts and independently decompress to the same mesh.
const lod0={id:'lod0',positions:[0,0,0,1,0,0,1,1,0,0,1,0],indices:[0,1,2,0,2,3],uvs:[0,0,1,0,1,1,0,1]};
const lod1={id:'lod1',positions:[0,0,0,1,0,0,0,1,0],indices:[0,1,2],uvs:[0,0,1,0,0,1]};
const lods=F.advanced3d.assessLods({source_high_digest:highDigest,reference_silhouette:[1,1,1,1],lods:[{level:0,mesh:lod0,silhouette:[1,1,1,1]},{level:1,mesh:lod1,silhouette:[1,1,1,1]}],max_silhouette_error:.1,distance_render_receipt:{status:'PASS',digest:U.sha256('distance-render')}});
assert.equal(lods.status,'PASS');
assert.ok(lods.lods[0].compressed_base64.length>0);
assert.equal(lods.checks.find((item)=>item.name==='descending-triangles').pass,true);

// #42: visible mesh vertices deform across timestamped frames with valid skin weights, retarget, IK/FK and root-motion bounds.
const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],translated=[1,0,0,0,0,1,0,0,0,0,1,0,1,0,0,1];
const meshDigest=U.sha256('character-mesh');
const frameBase={positions:[0,0,0,1,0,0,0,1,0],skin:[[{joint:0,weight:1}],[{joint:0,weight:1}],[{joint:0,weight:1}]],blend_shapes:[{weight:.5,deltas:[0,0,.1,0,0,.1,0,0,.1]}]};
const animation=F.advanced3d.assessAnimation({mesh_digest:meshDigest,max_root_motion_per_frame:2,retarget_receipt:{status:'PASS'},ik_receipt:{status:'PASS'},frames:[{time_seconds:0,deformation:{...frameBase,joint_matrices:[identity]},root_motion:[0,0,0],render_receipt:{status:'PASS',mesh_digest:meshDigest,digest:U.sha256('frame0')}},{time_seconds:1/30,deformation:{...frameBase,joint_matrices:[translated]},root_motion:[1,0,0],render_receipt:{status:'PASS',mesh_digest:meshDigest,digest:U.sha256('frame1')}}]});
assert.equal(animation.status,'PASS');
assert.notEqual(animation.frames[0].deformation.digest,animation.frames[1].deformation.digest);
const ik=F.advanced3d.twoBoneIk({root:[0,0,0],target:[1,1,0],upper_length:1,lower_length:1});
assert.equal(ik.reachable,true);

// #43: real numeric AOV buffers must recompose the beauty image within threshold.
const diffuse=[.2,.1,.1,.2,.1,.1],specular=[.05,.05,.05,.05,.05,.05],beauty=diffuse.map((value,index)=>value+specular[index]);
const aov=F.advanced3d.assessAovs({scene_digest:U.sha256('lookdev-scene'),camera:{id:'main'},lights:[{kind:'area'}],exposure:0,beauty,aovs:[{name:'diffuse',pixels:diffuse},{name:'specular',pixels:specular}],max_error:1e-9,renderer_receipt:{status:'PASS',digest:U.sha256('renderer')}});
assert.equal(aov.status,'PASS');
assert.equal(aov.recomposition.rmse,0);

// #44: seeded particle/spring simulation produces deterministic, changing, bounded caches.
const simulationSpec={kind:'cloth',seed:'cloth-seed',frames:8,dt:1/60,gravity:-9.81,jitter:.01,bounce:.1,particles:[{position:[0,2,0],velocity:[0,0,0],inverse_mass:0},{position:[1,2,0],velocity:[0,0,0],inverse_mass:1},{position:[2,2,0],velocity:[0,0,0],inverse_mass:1}],constraints:[{a:0,b:1,length:1},{a:1,b:2,length:1}],max_cache_bytes:100000,max_particles:100};
const simulationA=F.advanced3d.simulate(simulationSpec),simulationB=F.advanced3d.simulate(simulationSpec);
assert.equal(simulationA.status,'PASS');
assert.equal(simulationA.cache_digest,simulationB.cache_digest);
assert.ok(new Set(simulationA.frames.map((item)=>item.digest)).size>1);

// #45: terrain, tilemap, prefabs, navigation, spawns and region streaming are concrete; native traversal remains explicit.
const world=F.advanced3d.createWorld({id:'island',seed:'world-seed',width:16,height:16,region_size:4,max_height:10,max_walk_slope:8,tilemap:{width:16,height:16,tiles:Array(256).fill(1)},prefabs:[{id:'tree-1',asset_digest:U.sha256('tree'),position:[4,0,5],collision:{kind:'capsule'}}],spawn_markers:[{id:'player-start',position:[1,0,1],kind:'player'}],budgets:{bytes_per_region:1024,max_stream_bytes:16384}});
assert.match(world.status,/NATIVE_TRAVERSAL_REQUIRED/);
assert.equal(world.regions.length,16);
assert.equal(world.spawn_markers.length,1);
const streamed=F.advanced3d.streamAt(world,[8,8],5);
assert.equal(streamed.status,'PASS');
assert.ok(streamed.loaded_regions.length>0);

// #46: audible PCM and a genuine RIFF/WAVE delivery exist; independent decode/playback controls the final claim.
const audioTechnical=F.audioProduction.synthesize({sample_rate:8000,channels:2,duration_seconds:.1,seed:'tone',voices:[{kind:'sine',frequency:440,amplitude:.8,pan:0}]});
const wavBytes=Buffer.from(audioTechnical.wav.base64,'base64');
assert.equal(wavBytes.toString('ascii',0,4),'RIFF');
assert.equal(F.audioProduction.wavDecode(wavBytes).sample_rate,8000);
assert.match(audioTechnical.status,/INDEPENDENT_DECODE/);
const audioPass=F.audioProduction.synthesize({sample_rate:8000,channels:2,duration_seconds:.1,seed:'tone',voices:[{kind:'sine',frequency:440,amplitude:.8,pan:0}],independent_decoder_receipt:{status:'PASS',digest:U.sha256('decoder')},playback_receipt:{status:'PASS',digest:U.sha256('playback')}});
assert.equal(audioPass.status,'PASS');

// #47: trims, fades, restoration gate, automation, stems and master modify real samples without clipping.
const sourceSamples=F.audioProduction.wavDecode(wavBytes).samples;
const mixTechnical=F.audioProduction.editMix({stems:[{id:'tone',sample_rate:8000,channels:2,samples:sourceSamples,trim:{start_seconds:0,end_seconds:.08},fade:{in_seconds:.01,out_seconds:.01},noise_gate:.001,automation:[{time:0,gain:.5},{time:.08,gain:1}]}],target_peak:.9,output_channels:2});
assert.match(mixTechnical.status,/EXTERNAL_LOUDNESS/);
assert.ok(mixTechnical.master.analysis.sample_peak<=.9+1e-9);
const masterDigest=mixTechnical.master.digest;
const mixPass=F.audioProduction.editMix({stems:[{id:'tone',sample_rate:8000,channels:2,samples:sourceSamples,trim:{start_seconds:0,end_seconds:.08},fade:{in_seconds:.01,out_seconds:.01},noise_gate:.001,automation:[{time:0,gain:.5},{time:.08,gain:1}]}],target_peak:.9,output_channels:2,independent_loudness_receipt:{status:'PASS',master_digest:masterDigest,digest:U.sha256('loudness')},independent_decoder_receipt:{status:'PASS',master_digest:masterDigest,digest:U.sha256('mix-decoder')}});
assert.equal(mixPass.status,'PASS');

// #48: actual 64-bit MIDI 2 UMP packets are not mislabeled as an unavailable SMF2 clip codec.
const midiTechnical=F.audioProduction.createMidi2({events:[{time_ticks:0,group:0,channel:0,note:60,velocity:65535,on:true},{time_ticks:960,group:0,channel:0,note:60,velocity:0,on:false}]});
assert.equal(midiTechnical.ump.words,4);
assert.equal(Buffer.from(midiTechnical.ump.base64,'base64').length,16);
assert.equal(midiTechnical.midi_clip_file,null);
assert.equal(midiTechnical.smf2_status,'MISSING_OFFICIAL_CLIP_CODEC');
const midiParsed=F.audioProduction.createMidi2({events:[{time_ticks:0,group:0,channel:0,note:60,velocity:65535,on:true},{time_ticks:960,group:0,channel:0,note:60,velocity:0,on:false}],independent_parser_receipt:{status:'PASS',ump_digest:midiTechnical.ump.digest,digest:U.sha256('ump-parser')}});
assert.match(midiParsed.status,/UMP_PASS/);
const midiFallback=F.audioProduction.negotiateMidi({device:{id:'legacy-keyboard',transport:'simulated',protocols:['MIDI1'],profiles:[],mpe:true},request:{prefer_midi2:true,profiles:[],per_note_controllers:true}});
assert.equal(midiFallback.protocol,'MIDI1');
assert.ok(midiFallback.loss_map.length>=1);
assert.equal(F.audioProduction.negotiateMidi({device:{id:'midi2-device',transport:'usb',protocols:['MIDI2','MIDI1'],profiles:['drawbar'],opt_in:true},request:{prefer_midi2:true,profiles:['drawbar']}}).status,'MIDI2_NEGOTIATED');

// #49: source/proxy timecode survives ripple, slip, roll/time-remap, multicam and relink mapping.
const edl=F.videoProduction.createEdl({id:'edit',fps:{numerator:30,denominator:1},sources:[{id:'cam-a',digest:U.sha256('cam-a'),mime:'video/mp4',duration_frames:300,timecode_start_frame:1000,proxy:{digest:U.sha256('proxy-a'),source_digest:U.sha256('cam-a'),timecode_start_frame:1000}},{id:'cam-b',digest:U.sha256('cam-b'),mime:'video/mp4',duration_frames:300,timecode_start_frame:1000}],clips:[{id:'clip-a',track:0,source_id:'cam-a',source_in:0,source_out:60,timeline_start:0,speed:1,angle:'A'},{id:'clip-b',track:0,source_id:'cam-a',source_in:60,source_out:120,timeline_start:60,speed:1,angle:'A'}]});
assert.equal(F.videoProduction.frameMap(edl,30,0).source_frame,30);
const slipped=F.videoProduction.applyOperation(edl,{type:'slip',clip_id:'clip-a',delta_frames:10});
assert.equal(F.videoProduction.frameMap(slipped,0,0).source_frame,10);
const remapped=F.videoProduction.applyOperation(slipped,{type:'time-remap',clip_id:'clip-a',speed:2});
assert.equal(F.videoProduction.frameMap(remapped,10,0).source_frame,30);
const switched=F.videoProduction.applyOperation(edl,{type:'multicam-switch',clip_id:'clip-a',source_id:'cam-b',angle:'B'});
assert.equal(switched.clips.find((item)=>item.id==='clip-a').source_id,'cam-b');
const mapped=F.videoProduction.frameMap(switched,20,0);
const frameEvidence=F.videoProduction.verifyFrames(switched,[{timeline_frame:20,track:0,source_digest:mapped.source_digest,source_frame:mapped.source_frame,status:'PASS',frame_digest:U.sha256('decoded-frame')}]);
assert.equal(frameEvidence.status,'PASS');
const relinked=F.videoProduction.relink(edl,'cam-a',{original_digest:U.sha256('cam-a'),digest:U.sha256('cam-a-new-location'),timecode_start_frame:1000,duration_frames:300,receipt_digest:U.sha256('relink')});
assert.equal(relinked.clips[0].source_digest,U.sha256('cam-a-new-location'));

// #50: captions and queue are real, but no finished claim exists without mux + independent demux/decode.
const finishSpec={id:'accessible-finish',picture:{digest:U.sha256('picture'),mime:'video/webm'},audio:{digest:mixPass.master.digest,mime:'audio/wav'},captions:[{id:'1',start_seconds:0,end_seconds:1,text:'Welcome to AXM.'}],settings:{video_codec:'AV1',audio_codec:'Opus',colour:'bt709',max_file_bytes:1000000,max_av_sync_error_ms:20},colour_receipt:{status:'PASS',digest:U.sha256('colour')},loudness_receipt:{status:'PASS',digest:U.sha256('finish-loudness')}};
const missingFinish=F.videoProduction.finish({...finishSpec,runtime_resolution:{status:'MISSING'}});
assert.equal(missingFinish.status,'MISSING_MUX_SUBSTRATE');
assert.ok(missingFinish.captions.text.startsWith('WEBVTT'));
assert.equal(missingFinish.delivery,null);
const muxFixture={identity:{kind:'test-fixture',fresh_process:true},mux_and_inspect(request){const delivery=Buffer.from('fixture-muxed-av1-opus-captions');return{status:'PASS',picture_digest:request.picture.digest,audio_digest:request.audio.digest,captions_digest:request.captions.digest,video_stream:{codec:'AV1'},audio_stream:{codec:'Opus'},caption_stream:{codec:'WebVTT'},colour:'bt709',loudness_receipt_digest:finishSpec.loudness_receipt.digest,bytes:delivery.length,av_sync_error_ms:5,mime:'video/webm',delivery_bytes_base64:delivery.toString('base64')};}};
const fixtureFinish=F.videoProduction.finish({...finishSpec,runtime_resolution:{status:'READY',selected:{artifact_sha256:U.sha256('mux-runtime')}},executor:muxFixture});
assert.equal(fixtureFinish.status,'TEST_ONLY');
assert.ok(fixtureFinish.delivery.bytes>0);

console.log('Asset Hands upgrade wave 4 PASS (11 advanced 3D/audio/video upgrades; missing production substrates remain explicit)');
