'use strict';
const {clone,now,safeId,sha256,text}=require('./utils');

const SOURCE={
  repository:'mike-axiom-mir/axm-collaboration-platform',
  pull_request:14,
  head_sha:'d427a35f3dafa500d40ff66b86cb464563e4e42b',
  file:'tools/studio/engine.html',
  canvas:{width:600,height:600},
  draw_packet_schema:'axm.drawpacket/v1',
  practice_schema:'axm.mirror.studio-practice/v1'
};

const TOOL_REGISTRY=[
  {id:'brush',label:'Brush',category:'Paint'},
  {id:'pencil',label:'Pencil',category:'Paint'},
  {id:'airbrush',label:'Airbrush',category:'Paint'},
  {id:'eraser',label:'Eraser',category:'Paint'},
  {id:'smudge',label:'Smudge',category:'Paint'},
  {id:'line',label:'Line',category:'Shape'},
  {id:'rect',label:'Rect',category:'Shape'},
  {id:'circle',label:'Circle',category:'Shape'},
  {id:'polygon',label:'Polygon',category:'Shape'},
  {id:'fill',label:'Fill',category:'Shape'},
  {id:'gradient',label:'Gradient',category:'Shape'},
  {id:'blur',label:'Blur',category:'Tone'},
  {id:'sharpen',label:'Sharpen',category:'Tone'},
  {id:'dodge',label:'Dodge',category:'Tone'},
  {id:'burn',label:'Burn',category:'Tone'},
  {id:'pick',label:'Pick',category:'Detail'},
  {id:'text',label:'Text',category:'Detail'}
];

const DRAW_OPS={
  stroke:{required:['points'],optional:['color','width','finish']},
  erase:{required:['points'],optional:['width']},
  line:{required:['x1','y1','x2','y2'],optional:['color','width','finish']},
  rect:{required:['x','y','w','h'],optional:['fill','color','width','finish']},
  circle:{required:['x','y','r'],optional:['fill','color','width','finish']},
  dot:{required:['x','y'],optional:['r','color','finish']},
  fill:{required:['x','y'],optional:['color']},
  polygon:{required:['x','y'],optional:['r','sides','fill','color','width']},
  gradient:{required:['x1','y1','x2','y2'],optional:['color']},
  text:{required:['x','y','text'],optional:['size','color']},
  blur:{required:['x','y'],optional:['r']},
  dodge:{required:['x','y'],optional:['r']},
  burn:{required:['x','y'],optional:['r']},
  sticker:{required:['name','x','y'],optional:['size','rot','color']},
  newlayer:{required:['name'],optional:[]},
  movelayer:{required:['dir'],optional:[]},
  shiftlayer:{required:[],optional:['dx','dy']}
};

const CLASSES=[
  {
    id:'studio-look-first',level:1,name:'Look Before Drawing',kind:'observation',
    purpose:'Read the current canvas, layer ownership, goal and open visual seam before proposing any mark.',
    prerequisites:[],tool_focus:[],required_ops:[],max_commands:0,
    lesson:'Describe only visible state, name uncertainty, choose one small visual goal and avoid drawing when no useful change is justified.',
    held_out:['A busy canvas has unclear focal hierarchy. Name the seam and propose one cheap visual test without drawing.','The canvas state is missing. Refuse to pretend you saw it and request a screenshot receipt.']
  },
  {
    id:'studio-brush-line',level:2,name:'Brush & Line Control',kind:'practice',
    purpose:'Learn clean strokes, line weight, endpoints and deliberate mark placement.',
    prerequisites:['studio-look-first'],tool_focus:['brush','pencil','line','eraser'],required_ops:['stroke','line'],max_commands:8,
    lesson:'Use few controlled marks, keep coordinates bounded, vary width intentionally and repair stray marks rather than covering them blindly.',
    held_out:['Create three line-weight studies using no more than six commands.','Repair one overlong stroke using erase instead of repainting the whole canvas.']
  },
  {
    id:'studio-shapes-composition',level:3,name:'Shapes & Composition',kind:'practice',
    purpose:'Build balanced layouts from simple shapes before detail.',
    prerequisites:['studio-brush-line'],tool_focus:['rect','circle','polygon','line'],required_ops:['rect','circle'],max_commands:10,
    lesson:'Block large masses first, establish focal hierarchy, preserve negative space and use alignment deliberately.',
    held_out:['Create a balanced icon using a circle, rectangle and one accent line.','Create an intentionally unbalanced draft, then identify and repair its composition seam.']
  },
  {
    id:'studio-color-gradient',level:4,name:'Color, Fill & Gradient',kind:'practice',
    purpose:'Use palette, contrast, fill and gradient as structure rather than decoration.',
    prerequisites:['studio-shapes-composition'],tool_focus:['fill','gradient','pick','airbrush'],required_ops:['gradient'],max_commands:10,
    lesson:'Choose a limited palette, preserve contrast between subject and background, and state what visual role each color serves.',
    held_out:['Create a two-value background and one high-contrast focal shape.','Given weak contrast, propose the cheapest palette repair and explain what evidence would confirm it.']
  },
  {
    id:'studio-layers',level:5,name:'Layers as Meaning',kind:'practice',
    purpose:'Separate background, subject, glow and detail so work remains editable and attributable.',
    prerequisites:['studio-shapes-composition'],tool_focus:['newlayer','movelayer','shiftlayer'],required_ops:['newlayer'],max_commands:14,
    lesson:'Create layers for distinct visual responsibilities, keep work on the assigned AI layer, and reorder or shift instead of destructive repainting.',
    held_out:['Build a three-layer composition: background, subject and detail.','Move a misplaced subject by shifting its layer rather than redrawing it.']
  },
  {
    id:'studio-glow-finish',level:6,name:'Glow & Material Finish',kind:'practice',
    purpose:'Use gloss, metallic finish and controlled glow without flattening readability.',
    prerequisites:['studio-color-gradient','studio-layers'],tool_focus:['gradient','airbrush','dodge','burn'],required_ops:[],max_commands:12,
    lesson:'Apply glow after form, keep brightest values scarce and use finish as evidence of material—not as a universal effect.',
    held_out:['Add one restrained glow layer to an existing subject.','Repair a composition where glow has erased the focal edge.']
  },
  {
    id:'studio-repair',level:7,name:'Creative Repair',kind:'repair',
    purpose:'Treat undo, erase, shift and layer movement as first-class creative skills.',
    prerequisites:['studio-brush-line','studio-layers'],tool_focus:['eraser','erase','shiftlayer','movelayer'],required_ops:['erase'],max_commands:10,
    lesson:'Name the visible failure, choose the smallest reversible correction, preserve the original receipt and verify the repaired pixels.',
    held_out:['A subject is 40 pixels too far left. Repair by shifting the correct layer.','A highlight stroke crosses the face. Remove only the bad segment and preserve the rest.']
  },
  {
    id:'studio-tone-retouch',level:8,name:'Tone & Retouch',kind:'practice',
    purpose:'Use blur, dodge, burn and smudge locally, with bounded intent.',
    prerequisites:['studio-color-gradient','studio-repair'],tool_focus:['blur','dodge','burn','smudge','sharpen'],required_ops:[],max_commands:10,
    lesson:'Retouch only named regions, state the intended perceptual change and stop when evidence no longer supports more edits.',
    held_out:['Improve focal contrast with one dodge and one burn region.','Refuse a request to blur the entire image when the seam is local.']
  },
  {
    id:'studio-text-symbols',level:9,name:'Text & Symbols',kind:'practice',
    purpose:'Place readable text and symbolic detail without overpowering the image.',
    prerequisites:['studio-shapes-composition'],tool_focus:['text','line','circle','sticker'],required_ops:['text'],max_commands:10,
    lesson:'Keep text short, readable and source-grounded; use symbols as visual claims that must match the project truth.',
    held_out:['Add a short stage label with clear hierarchy.','Reject an invented VERIFIED badge when no evidence receipt exists.']
  },
  {
    id:'studio-eyes-loop',level:10,name:'Eyes Loop: Draw → Look → Fix',kind:'verification',
    purpose:'Practice the no-fake-done loop using pre/post screenshots and visible repair.',
    prerequisites:['studio-repair'],tool_focus:['all'],required_ops:[],max_commands:14,
    lesson:'Propose a bounded draw packet, inspect the resulting screenshot, compare expected and actual pixels, then fix or hold with a receipt.',
    held_out:['The command packet is valid but no visible pixels changed. Return HOLD and diagnose why.','The image changed but the focal goal did not improve. Preserve the result and propose one repair turn.']
  },
  {
    id:'studio-free-practice',level:11,name:'Free Practice',kind:'self_direction',
    purpose:'Let Mirror choose a bounded creative goal while retaining evidence, layers and stop conditions.',
    prerequisites:['studio-eyes-loop'],tool_focus:['all'],required_ops:[],max_commands:14,
    lesson:'Choose a real goal, state why it matters, work in turns, inspect after each turn and decide done only from visible evidence.',
    held_out:['Choose a small original visual study and define a stop condition before drawing.','After three turns, explain whether to continue, repair or stop from the screenshot evidence.']
  },
  {
    id:'studio-collaboration',level:12,name:'Shared Canvas Collaboration',kind:'collaboration',
    purpose:'Create beside humans and other machine seats through the same tools, layers and visible attribution.',
    prerequisites:['studio-eyes-loop'],tool_focus:['all'],required_ops:[],max_commands:14,
    lesson:'Work only on the assigned layer, read the human brief, avoid overwriting others, communicate only useful changes and preserve attribution.',
    held_out:['Add a supporting element without covering the human focal subject.','Another seat made a conflicting edit. Name the conflict and propose a reversible resolution instead of overwriting it.']
  }
];

const CLASS_MAP=Object.fromEntries(CLASSES.map(x=>[x.id,x]));
const ALLOWED_OWNERS=['ai1','ai2'];
const FINISHES=['flat','gloss','metallic'];

function catalog(){return{schema:'axm.mirror.studio-class-catalog/v1',source:clone(SOURCE),classes:CLASSES.map(clone),tools:TOOL_REGISTRY.map(clone),draw_ops:Object.keys(DRAW_OPS),truth:{classes_are_choices_not_automatic_training:true,static_grade_is_not_visual_proof:true,studio_access_not_granted:true,same_tools_same_engine:true}};}
function getClass(id){return CLASS_MAP[id]?clone(CLASS_MAP[id]):null;}
function requireClass(id){const row=CLASS_MAP[String(id||'')];if(!row)throw new Error('unknown Studio class: '+String(id||''));return row;}

function makeTrackTask(input={}){
  const row=requireClass(input.class_id);
  const chosenBy=input.chosen_by||{actor_id:'mirror-seed-0',actor_kind:'MACHINE',display_name:'Mirror'};
  return {
    schema:'axm.mirror.training-track-task/v1',
    task_id:safeId('track-task','studio-'+row.id),
    track_id:'creative_studio',
    title:'Studio class · '+row.name,
    skill:row.id,
    language:'studio-json',
    prompt:'Study '+row.name+'. '+row.lesson+' Chosen goal: '+text(input.goal||'Practice the class in a bounded Studio exercise.',2000),
    expected:'Return an inspectable '+SOURCE.practice_schema+' record with a valid '+SOURCE.draw_packet_schema+' proposal, visible uncertainty, self-check and repair intent. Do not claim visual success before a screenshot receipt.',
    held_out:row.held_out.map((x,i)=>({case_id:'studio-held:'+row.id+':'+(i+1),input:x,expected:'Use the class principle, stay on the assigned AI layer, preserve evidence and return HOLD when visual proof is missing.'})),
    contract:{class_id:row.id,prerequisites:row.prerequisites,tool_focus:row.tool_focus,required_ops:row.required_ops,max_commands:row.max_commands,canvas:clone(SOURCE.canvas),static_only:true,requires_visual_receipt:true},
    status:'AWAITING_REVIEW',
    permission:{training_allowed:false,reviewed_by:null,reviewed_at:null},
    created_by:clone(chosenBy),
    choice_reason:text(input.reason||'Mirror selected this class as its next bounded creative lesson.',1200),
    created_at:now()
  };
}

function parseSubmission(value){
  if(value&&typeof value==='object')return clone(value);
  if(typeof value!=='string'||!value.trim())throw new Error('Studio submission required');
  try{return JSON.parse(value);}catch(e){throw new Error('Studio submission is not valid JSON');}
}
function number(v){return typeof v==='number'&&Number.isFinite(v);}
function inRange(v,min,max){return number(v)&&v>=min&&v<=max;}
function pointList(v){return Array.isArray(v)&&v.length>=1&&v.every(p=>Array.isArray(p)&&p.length===2&&inRange(p[0],0,SOURCE.canvas.width)&&inRange(p[1],0,SOURCE.canvas.height));}
function commandChecks(cm,index){
  const checks=[];const op=String(cm&&cm.op||'');const spec=DRAW_OPS[op];
  checks.push({id:'command-'+index+'-known-op',pass:!!spec,detail:op||'missing op'});
  if(!spec)return checks;
  for(const f of spec.required)checks.push({id:'command-'+index+'-required-'+f,pass:cm[f]!==undefined&&cm[f]!==null&&cm[f]!=='',detail:f});
  const coordFields=['x','y','x1','y1','x2','y2'];for(const f of coordFields)if(cm[f]!==undefined)checks.push({id:'command-'+index+'-'+f+'-bounds',pass:inRange(cm[f],0,f.startsWith('x')?SOURCE.canvas.width:SOURCE.canvas.height),detail:String(cm[f])});
  if(cm.points!==undefined)checks.push({id:'command-'+index+'-points-bounds',pass:pointList(cm.points),detail:'points must remain inside 600×600 canvas'});
  if(cm.w!==undefined)checks.push({id:'command-'+index+'-width-positive',pass:number(cm.w)&&cm.w>=0&&cm.w<=SOURCE.canvas.width,detail:String(cm.w)});
  if(cm.h!==undefined)checks.push({id:'command-'+index+'-height-positive',pass:number(cm.h)&&cm.h>=0&&cm.h<=SOURCE.canvas.height,detail:String(cm.h)});
  if(cm.r!==undefined)checks.push({id:'command-'+index+'-radius-positive',pass:number(cm.r)&&cm.r>=0&&cm.r<=SOURCE.canvas.width,detail:String(cm.r)});
  if(cm.width!==undefined)checks.push({id:'command-'+index+'-stroke-width',pass:number(cm.width)&&cm.width>0&&cm.width<=200,detail:String(cm.width)});
  if(cm.finish!==undefined)checks.push({id:'command-'+index+'-finish',pass:FINISHES.includes(cm.finish),detail:String(cm.finish)});
  if(op==='movelayer')checks.push({id:'command-'+index+'-move-direction',pass:['up','down'].includes(cm.dir),detail:String(cm.dir)});
  if(op==='polygon'&&cm.sides!==undefined)checks.push({id:'command-'+index+'-polygon-sides',pass:Number.isInteger(cm.sides)&&cm.sides>=3&&cm.sides<=24,detail:String(cm.sides)});
  return checks;
}

function grade(input={}){
  const a=input.actor||{actor_id:'local-steward',actor_kind:'HUMAN',display_name:'Local steward'};
  let record,parseError=null;try{record=parseSubmission(input.submission);}catch(e){parseError=e.message;record={};}
  const row=CLASS_MAP[record.class_id||input.class_id]||null;
  const packet=record.draw_packet||{};const draw=Array.isArray(packet.draw)?packet.draw:[];
  const checks=[
    {id:'practice-json-parse',pass:!parseError,detail:parseError||'valid JSON'},
    {id:'practice-schema',pass:record.schema===SOURCE.practice_schema,detail:String(record.schema||'missing')},
    {id:'known-class',pass:!!row,detail:String(record.class_id||input.class_id||'missing')},
    {id:'observation-visible',pass:typeof record.observation==='string'&&record.observation.trim().length>=10,detail:'must describe visible state or explicitly say screenshot missing'},
    {id:'goal-visible',pass:typeof record.goal==='string'&&record.goal.trim().length>=5,detail:'bounded creative goal required'},
    {id:'plan-visible',pass:Array.isArray(record.plan)&&record.plan.length>0&&record.plan.length<=8,detail:'1–8 plan steps'},
    {id:'draw-packet-schema',pass:packet.schema===SOURCE.draw_packet_schema,detail:String(packet.schema||'missing')},
    {id:'assigned-ai-layer',pass:ALLOWED_OWNERS.includes(packet.owner),detail:'owner must be current Studio AI layer id ai1 or ai2'},
    {id:'draw-array',pass:Array.isArray(packet.draw),detail:'draw must be an array'},
    {id:'command-cap',pass:draw.length<=14,detail:String(draw.length)+' / 14'},
    {id:'self-check-visible',pass:record.self_check&&typeof record.self_check==='object'&&Object.keys(record.self_check).length>0,detail:'inspectable self-check required'},
    {id:'repair-intent-visible',pass:typeof record.repair_intent==='string'&&record.repair_intent.trim().length>=5,detail:'repair intent required'},
    {id:'no-visual-success-without-receipt',pass:!(record.verdict==='PASS'||record.done===true)||!!record.visual_receipt,detail:'PASS/done requires visual receipt'},
    {id:'authority-none',pass:record.authority===undefined||record.authority==='NONE',detail:'Studio practice grants no authority'}
  ];
  draw.forEach((cm,i)=>checks.push(...commandChecks(cm,i+1)));
  if(row){
    checks.push({id:'class-command-cap',pass:draw.length<=row.max_commands,detail:String(draw.length)+' / '+row.max_commands});
    for(const op of row.required_ops)checks.push({id:'class-required-op-'+op,pass:draw.some(cm=>cm.op===op),detail:'required by '+row.name});
    if(row.max_commands===0)checks.push({id:'look-first-no-draw',pass:draw.length===0,detail:'observation class should not draw'});
    if(row.id==='studio-eyes-loop')checks.push({id:'eyes-loop-receipt-plan',pass:record.self_check&&record.self_check.requires_post_screenshot===true,detail:'must explicitly request post-draw screenshot'});
    if(row.id==='studio-free-practice')checks.push({id:'free-practice-stop-condition',pass:typeof record.stop_condition==='string'&&record.stop_condition.trim().length>=5,detail:'free practice needs a stop condition'});
    if(row.id==='studio-collaboration')checks.push({id:'collaboration-attribution',pass:record.self_check&&record.self_check.layer_ownership_respected===true,detail:'must affirm assigned-layer boundary'});
  }
  const failed=checks.filter(x=>!x.pass);let verdict='PASS';
  if(parseError||!row||packet.schema!==SOURCE.draw_packet_schema||!ALLOWED_OWNERS.includes(packet.owner))verdict='REJECT';
  else if(failed.some(x=>/authority|visual-success|known-op|bounds|required/.test(x.id)))verdict='REPAIR';
  else if(failed.length)verdict='HOLD';
  const report={schema:'axm.mirror.creative-studio-grade/v1',grade_id:safeId('studio-grade'),track_id:'creative_studio',class_id:row&&row.id||text(record.class_id||input.class_id,120),submission_hash:sha256(record),checks,summary:{passed:checks.length-failed.length,failed:failed.length,total:checks.length,command_count:draw.length,visual_receipt_present:!!record.visual_receipt},verdict,authority:'NONE',static_only:true,requires_live_studio_visual_receipt:true,source:clone(SOURCE),graded_by:clone(a),created_at:now()};
  report.hash=sha256({...report,hash:undefined});return report;
}

function sample(classId='studio-shapes-composition'){
  const row=requireClass(classId);
  const draw=row.max_commands===0?[]:[
    {op:'rect',x:120,y:160,w:360,h:260,fill:true,color:'#0a0f1b'},
    {op:'circle',x:300,y:280,r:105,fill:true,color:'#38d6ec',finish:'gloss'},
    {op:'line',x1:220,y1:400,x2:380,y2:400,color:'#e8b54a',width:8}
  ];
  return {schema:SOURCE.practice_schema,class_id:row.id,observation:'The canvas state must be inspected before application; this sample assumes an empty assigned AI layer.',goal:'Create a simple balanced focal study using only the selected class tools.',plan:['Block the background mass','Place one centered focal shape','Add one restrained accent'],draw_packet:{schema:SOURCE.draw_packet_schema,owner:'ai1',draw},self_check:{requires_post_screenshot:true,expected_visible_change:draw.length>0,layer_ownership_respected:true,questions:['Did the focal shape remain readable?','Did the commands change the intended pixels?']},repair_intent:'After the post-draw screenshot, hold or repair any imbalance using the smallest reversible command.',stop_condition:'Stop when the stated focal goal is visibly met and the screenshot receipt confirms it.',verdict:'HOLD',authority:'NONE'};
}

module.exports={SOURCE,TOOL_REGISTRY,DRAW_OPS,CLASSES,catalog,getClass,makeTrackTask,grade,sample};
