(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AXMColourCodec = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var VERSION = '1.0.0';
  var SRGB_PROFILE_BASE64 = 'AAAB4GxjbXMEIAAAbW50clJHQiBYWVogB+IAAwAUAAkADgAdYWNzcE1TRlQAAAAAc2F3c2N0cmwAAAAAAAAAAAAAAAAAAPbWAAEAAAAA0y1oYW5keem/Vlo+AbaDI4VVRvdPqgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKZGVzYwAAAPwAAAAkY3BydAAAASAAAAAid3RwdAAAAUQAAAAUY2hhZAAAAVgAAAAsclhZWgAAAYQAAAAUZ1hZWgAAAZgAAAAUYlhZWgAAAawAAAAUclRSQwAAAcAAAAAgZ1RSQwAAAcAAAAAgYlRSQwAAAcAAAAAgbWx1YwAAAAAAAAABAAAADGVuVVMAAAAIAAAAHABzAFIARwBCbWx1YwAAAAAAAAABAAAADGVuVVMAAAAGAAAAHABDAEMAMAAAWFlaIAAAAAAAAPbWAAEAAAAA0y1zZjMyAAAAAAABDD8AAAXd///zJgAAB5AAAP2S///7of///aIAAAPcAADAcVhZWiAAAAAAAABvoAAAOPIAAAOPWFlaIAAAAAAAAGKWAAC3iQAAGNpYWVogAAAAAAAAJKAAAA+FAAC2xHBhcmEAAAAAAAMAAAACZmkAAPKnAAANWQAAE9AAAApb';
  var P3_PROFILE_BASE64 = 'AAAB4GxjbXMEIAAAbW50clJHQiBYWVogB+IAAwAUAAkADgAdYWNzcE1TRlQAAAAAc2F3c2N0cmwAAAAAAAAAAAAAAAAAAPbWAAEAAAAA0y1oYW5kguKocouKP/clPrmS7iTWrgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKZGVzYwAAAPwAAAAkY3BydAAAASAAAAAid3RwdAAAAUQAAAAUY2hhZAAAAVgAAAAsclhZWgAAAYQAAAAUZ1hZWgAAAZgAAAAUYlhZWgAAAawAAAAUclRSQwAAAcAAAAAgZ1RSQwAAAcAAAAAgYlRSQwAAAcAAAAAgbWx1YwAAAAAAAAABAAAADGVuVVMAAAAIAAAAHABzAFAAMwBDbWx1YwAAAAAAAAABAAAADGVuVVMAAAAGAAAAHABDAEMAMAAAWFlaIAAAAAAAAPbWAAEAAAAA0y1zZjMyAAAAAAABDEIAAAXe///zJQAAB5MAAP2Q///7of///k4AAAOaAADAFFhZWiAAAAAAAACD3wAAPb8AAAAAWFlaIAAAAAAAAEq/AACxNwAACrVYWVogAAAAAAAAKDgAABEKAADIeHBhcmEAAAAAAAMAAAACZmkAAPKnAAANWQAAE9AAAApb';
  var PROFILE_HASHES = {
    srgb: 'c56e1685d888f5edb92fe07f2750f387f8fe8e91b32ff8fb0b56bfbbb9458353',
    'display-p3': '231752984cd4a5278e1b8d2390fe496767d4511fc81f54e1a5c69ae9ab4c42b5'
  };
  var SRGB_TO_XYZ = [
    [0.4123907992659595, 0.3575843393838780, 0.1804807884018343],
    [0.2126390058715104, 0.7151686787677560, 0.0721923153607337],
    [0.0193308187155919, 0.1191947797946260, 0.9505321522496607]
  ];
  var XYZ_TO_SRGB = [
    [3.2409699419045226, -1.537383177570094, -0.4986107602930034],
    [-0.9692436362808796, 1.8759675015077202, 0.0415550574071756],
    [0.0556300796969937, -0.2039769588889765, 1.0569715142428786]
  ];
  var P3_TO_XYZ = [
    [0.4865709486482162, 0.2656676931690931, 0.1982172852343625],
    [0.2289745640697488, 0.6917385218365064, 0.0792869140937450],
    [0.0000000000000000, 0.0451133818589026, 1.0439443689009760]
  ];
  var XYZ_TO_P3 = [
    [2.4934969119414250, -0.9313836179191239, -0.4027107844507168],
    [-0.8294889695615747, 1.7626640603183463, 0.0236246858419436],
    [0.0358458302437845, -0.0761723892680418, 0.9568845240076872]
  ];

  function decodeBase64(value) {
    if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(value, 'base64'));
    var binary=atob(value), out=new Uint8Array(binary.length);
    for(var i=0;i<binary.length;i+=1)out[i]=binary.charCodeAt(i);
    return out;
  }
  function copy(bytes) { return new Uint8Array(bytes); }
  function readU32(bytes, offset) { return ((bytes[offset]<<24)|(bytes[offset+1]<<16)|(bytes[offset+2]<<8)|bytes[offset+3])>>>0; }
  function writeU32(bytes, offset, value) { bytes[offset]=(value>>>24)&255;bytes[offset+1]=(value>>>16)&255;bytes[offset+2]=(value>>>8)&255;bytes[offset+3]=value&255; }
  function signature(bytes, offset) { return String.fromCharCode(bytes[offset],bytes[offset+1],bytes[offset+2],bytes[offset+3]); }
  function fixed(bytes, offset) { var value=readU32(bytes,offset);if(value&0x80000000)value=value-0x100000000;return value/65536; }
  function clamp(value) { return Math.max(0,Math.min(1,value)); }
  function matrix(matrixValue, vector) {
    return matrixValue.map(function(row){return row[0]*vector[0]+row[1]*vector[1]+row[2]*vector[2];});
  }
  function linearize(value) { value=clamp(value);return value<=0.04045?value/12.92:Math.pow((value+0.055)/1.055,2.4); }
  function encodeSrgb(value) { value=clamp(value);return value<=0.0031308?12.92*value:1.055*Math.pow(value,1/2.4)-0.055; }
  function mluc(bytes, offset, size) {
    if(signature(bytes,offset)!=='mluc'||size<28)return '';
    var count=readU32(bytes,offset+8),recordSize=readU32(bytes,offset+12);
    if(!count||recordSize<12||offset+16+recordSize>offset+size)return '';
    var length=readU32(bytes,offset+20),relative=readU32(bytes,offset+24),start=offset+relative;
    if(start+length>offset+size)return '';
    var out='';for(var i=0;i+1<length;i+=2)out+=String.fromCharCode((bytes[start+i]<<8)|bytes[start+i+1]);return out;
  }
  function profileDescription(bytes, tag) {
    if(!tag)return '';
    if(tag.type==='mluc')return mluc(bytes,tag.offset,tag.size);
    if(tag.type==='desc'&&tag.size>=12){var length=readU32(bytes,tag.offset+8);if(length<1||12+length>tag.size)return '';var out='';for(var i=0;i<length-1;i+=1){var code=bytes[tag.offset+12+i];if(code>=32&&code<=126)out+=String.fromCharCode(code);}return out;}
    return '';
  }
  function parseIcc(bytes) {
    var errors=[],warnings=[],tags=[],tagMap={},declared=0;
    if(!(bytes instanceof Uint8Array)||bytes.length<132)return{pass:false,errors:['ICC profile is missing or shorter than its header'],warnings:warnings,tags:tags};
    declared=readU32(bytes,0);
    if(declared!==bytes.length)errors.push('ICC declared size does not match payload');
    if(signature(bytes,36)!=='acsp')errors.push('ICC acsp signature missing');
    var count=readU32(bytes,128);
    if(count>128||132+count*12>bytes.length)errors.push('ICC tag table exceeds bounded profile limits');
    if(!errors.length)for(var i=0;i<count;i+=1){
      var entry=132+i*12,name=signature(bytes,entry),offset=readU32(bytes,entry+4),size=readU32(bytes,entry+8),type=offset+4<=bytes.length?signature(bytes,offset):'';
      if(offset%4!==0)errors.push(name+' tag is not four-byte aligned');
      if(size<8||offset<132+count*12||offset+size>bytes.length)errors.push(name+' tag range is invalid');
      var tag={signature:name,offset:offset,size:size,type:type};tags.push(tag);tagMap[name]=tag;
    }
    var ranges=tags.slice().sort(function(a,b){return a.offset-b.offset||a.size-b.size;});
    for(var r=1;r<ranges.length;r+=1)if(ranges[r].offset<ranges[r-1].offset+ranges[r-1].size&&!(ranges[r].offset===ranges[r-1].offset&&ranges[r].size===ranges[r-1].size))errors.push('ICC tag payloads overlap');
    var colourSpace=signature(bytes,16),pcs=signature(bytes,20);
    if(colourSpace==='RGB ')['wtpt','rXYZ','gXYZ','bXYZ','rTRC','gTRC','bTRC'].forEach(function(name){if(!tagMap[name])errors.push('ICC RGB profile is missing '+name);});
    function xyz(name){var tag=tagMap[name];return tag&&tag.type==='XYZ '?[fixed(bytes,tag.offset+8),fixed(bytes,tag.offset+12),fixed(bytes,tag.offset+16)]:null;}
    function curve(name){var tag=tagMap[name];if(!tag)return null;if(tag.type==='para')return{type:'parametric',functionType:(bytes[tag.offset+8]<<8)|bytes[tag.offset+9],gamma:fixed(bytes,tag.offset+12)};if(tag.type==='curv')return{type:'curve',count:readU32(bytes,tag.offset+8)};return{type:tag.type};}
    var description=profileDescription(bytes,tagMap.desc);
    return{
      pass:!errors.length,errors:errors,warnings:warnings,size:bytes.length,declaredSize:declared,
      version:[bytes[8],bytes[9]>>4].join('.'),deviceClass:signature(bytes,12),colourSpace:colourSpace.trim(),pcs:pcs.trim(),
      renderingIntent:readU32(bytes,64),description:description,tags:tags,
      primaries:{red:xyz('rXYZ'),green:xyz('gXYZ'),blue:xyz('bXYZ'),white:xyz('wtpt')},
      curves:{red:curve('rTRC'),green:curve('gTRC'),blue:curve('bTRC')}
    };
  }
  function linearSrgbProfile() {
    var source=decodeBase64(SRGB_PROFILE_BASE64),out=new Uint8Array(464);out.set(source.subarray(0,448));writeU32(out,0,out.length);
    for(var i=84;i<100;i+=1)out[i]=0;
    out[280]=0;out[281]=108;out[282]=0;out[283]=82;out[284]=0;out[285]=71;out[286]=0;out[287]=66;
    var count=readU32(out,128);
    for(var t=0;t<count;t+=1){var entry=132+t*12,name=signature(out,entry);if(name==='rTRC'||name==='gTRC'||name==='bTRC')writeU32(out,entry+8,16);}
    out.set([112,97,114,97,0,0,0,0,0,0,0,0,0,1,0,0],448);
    return out;
  }
  var PROFILES={
    srgb:{name:'AXM sRGB IEC-like compact profile',bytes:decodeBase64(SRGB_PROFILE_BASE64),sha256:PROFILE_HASHES.srgb,source:'libvips 8.18.3 profile_load(srgb) / LittleCMS 2.19.1'},
    'display-p3':{name:'AXM Display P3 compact profile',bytes:decodeBase64(P3_PROFILE_BASE64),sha256:PROFILE_HASHES['display-p3'],source:'libvips 8.18.3 profile_load(p3) / LittleCMS 2.19.1'},
    'linear-srgb':{name:'AXM linear-light sRGB matrix profile',bytes:linearSrgbProfile(),sha256:null,source:'AXM bounded derivative of the compact sRGB matrix profile with unity TRCs'}
  };
  Object.keys(PROFILES).forEach(function(name){var parsed=parseIcc(PROFILES[name].bytes);if(!parsed.pass)throw new Error(name+' ICC profile failed self-validation: '+parsed.errors.join(', '));PROFILES[name].inspection=parsed;});

  function profile(space) {
    var item=PROFILES[String(space||'').toLowerCase()];
    if(!item)throw new Error('unsupported colour profile '+space);
    return{name:item.name,bytes:copy(item.bytes),sha256:item.sha256,source:item.source,inspection:JSON.parse(JSON.stringify(item.inspection))};
  }
  function identifyProfile(bytes) {
    var names=Object.keys(PROFILES);
    for(var i=0;i<names.length;i+=1){var candidate=PROFILES[names[i]].bytes;if(bytes instanceof Uint8Array&&bytes.length===candidate.length){var same=true;for(var j=0;j<bytes.length;j+=1)if(bytes[j]!==candidate[j]){same=false;break;}if(same)return names[i];}}
    return null;
  }
  function fromSrgb(rgb, targetSpace) {
    var linear=rgb.map(linearize);
    if(targetSpace==='linear-srgb')return linear;
    if(targetSpace==='srgb')return rgb.map(clamp);
    if(targetSpace==='display-p3')return matrix(XYZ_TO_P3,matrix(SRGB_TO_XYZ,linear)).map(encodeSrgb);
    throw new Error('unsupported target colour space '+targetSpace);
  }
  function toSrgb(rgb, sourceSpace) {
    if(sourceSpace==='srgb')return rgb.map(clamp);
    if(sourceSpace==='linear-srgb')return rgb.map(encodeSrgb);
    if(sourceSpace==='display-p3')return matrix(XYZ_TO_SRGB,matrix(P3_TO_XYZ,rgb.map(linearize))).map(encodeSrgb);
    throw new Error('unsupported source colour space '+sourceSpace);
  }
  function convertRgba(samples, sourceBitDepth, sourceSpace, targetSpace, targetBitDepth) {
    sourceBitDepth=sourceBitDepth===16?16:8;targetBitDepth=targetBitDepth===8?8:16;
    var sourceMax=sourceBitDepth===16?65535:255,targetMax=targetBitDepth===16?65535:255,
      Output=targetBitDepth===16?Uint16Array:Uint8Array,out=new Output(samples.length),clipped=0;
    for(var i=0;i<samples.length;i+=4){
      var rgb=[samples[i]/sourceMax,samples[i+1]/sourceMax,samples[i+2]/sourceMax],converted;
      if(sourceSpace===targetSpace)converted=rgb;else converted=fromSrgb(toSrgb(rgb,sourceSpace),targetSpace);
      for(var c=0;c<3;c+=1){if(converted[c]<0||converted[c]>1)clipped+=1;out[i+c]=Math.round(clamp(converted[c])*targetMax);}
      out[i+3]=Math.round(samples[i+3]/sourceMax*targetMax);
    }
    return{rgba:out,sourceSpace:sourceSpace,targetSpace:targetSpace,sourceBitDepth:sourceBitDepth,targetBitDepth:targetBitDepth,clippedChannels:clipped};
  }
  function targetSamplesToPreview(samples, bitDepth, space) {
    var max=bitDepth===16?65535:255,out=new Uint8Array(samples.length),clipped=0;
    for(var i=0;i<samples.length;i+=4){var converted=toSrgb([samples[i]/max,samples[i+1]/max,samples[i+2]/max],space);for(var c=0;c<3;c+=1){if(converted[c]<0||converted[c]>1)clipped+=1;out[i+c]=Math.round(clamp(converted[c])*255);}out[i+3]=Math.round(samples[i+3]/max*255);}
    return{rgba:out,clippedChannels:clipped};
  }

  return{
    VERSION:VERSION,
    PROFILE_HASHES:PROFILE_HASHES,
    parseIcc:parseIcc,
    profile:profile,
    identifyProfile:identifyProfile,
    fromSrgb:fromSrgb,
    toSrgb:toSrgb,
    convertRgba:convertRgba,
    targetSamplesToPreview:targetSamplesToPreview,
    matrices:{srgbToXyz:SRGB_TO_XYZ,xyzToSrgb:XYZ_TO_SRGB,p3ToXyz:P3_TO_XYZ,xyzToP3:XYZ_TO_P3}
  };
}));
