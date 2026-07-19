'use strict';

const Atlas = require('./atlas');

function clamp(value){return Math.max(0,Math.min(255,Math.round(value)));}
function rgb(hex){const value=parseInt(String(hex||'#808080').slice(1),16);return[(value>>16)&255,(value>>8)&255,value&255];}
function hex(values){return'#'+values.map(value=>clamp(value).toString(16).padStart(2,'0')).join('');}
function mapPalette(profile, transform){const copy=JSON.parse(JSON.stringify(profile));Object.keys(copy.palette).forEach(name=>{copy.palette[name]=hex(transform(rgb(copy.palette[name]),name));});return copy;}

const VARIANTS=[
  {id:'day',title:'Clear Day',transform:(c)=>c},
  {id:'dusk',title:'Warm Dusk',transform:(c,name)=>name==='emissive'?[255,183,76]:[c[0]*.88+28,c[1]*.72+12,c[2]*.68+16]},
  {id:'night',title:'City Night',transform:(c,name)=>name==='emissive'?[255,205,96]:name==='glass'?[42,80,112]:[c[0]*.35,c[1]*.42,c[2]*.55+8]},
  {id:'rain',title:'Cool Rain',transform:(c,name)=>{if(name==='emissive')return[236,190,90];const grey=(c[0]+c[1]+c[2])/3;return[grey*.26+c[0]*.45,grey*.32+c[1]*.48,grey*.42+c[2]*.52];}}
];

function create(profile,seed,baseAtlas){return VARIANTS.map((variant,index)=>{const variantProfile=index===0?JSON.parse(JSON.stringify(profile)):mapPalette(profile,variant.transform),atlas=index===0&&baseAtlas?baseAtlas:Atlas.create(variantProfile,seed+'-'+variant.id);return{id:variant.id,title:variant.title,path:index===0?'textures/urban-atlas.png':'textures/variants/'+variant.id+'/urban-atlas.png',preview:index===0?'previews/asset-contact-sheet.png':'previews/style-'+variant.id+'-contact-sheet.png',profile:variantProfile,atlas};});}

module.exports={VARIANTS,create,mapPalette};
