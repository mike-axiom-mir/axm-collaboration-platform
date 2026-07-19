(function (root, factory) {
  var node = typeof module === 'object' && module.exports;
  var api = factory(root, node ? {
    basisFactory: require('./vendor/basis-universal/basis_encoder.js'),
    path: require('path'),
    wasmDirectory: __dirname + '/vendor/basis-universal'
  } : null);
  if (node) module.exports = api;
  if (root) root.AXMKTX2Codec = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (root, nodeRuntime) {
  'use strict';

  var VERSION = '1.0.0';
  var BASIS_VERSION = '2.10-final-snapshot';
  var BASIS_COMMIT = '1aab02ba2df16ad873229030ea191ea8c10e3fc9';
  var IDENTIFIER = [0xab,0x4b,0x54,0x58,0x20,0x32,0x30,0xbb,0x0d,0x0a,0x1a,0x0a];
  var basisModule = null, basisPromise = null;

  function asBytes(value) {
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    throw new Error('KTX2 bytes must be a Uint8Array or ArrayBuffer');
  }
  function base64(bytes) {
    bytes = asBytes(bytes);
    if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
    var binary = '', step = 32768;
    for (var offset=0; offset<bytes.length; offset+=step) binary += String.fromCharCode.apply(null, bytes.subarray(offset, Math.min(bytes.length, offset+step)));
    return btoa(binary);
  }
  function dataUrl(mime, bytes) { return 'data:' + mime + ';base64,' + base64(bytes); }
  function bytesFromDataUrl(value, expectedMime) {
    var match = /^data:([^;,]+);base64,([a-z0-9+/=]+)$/i.exec(String(value || ''));
    if (!match) throw new Error('source artifact must use a base64 data URL');
    if (expectedMime && match[1].toLowerCase() !== String(expectedMime).toLowerCase()) throw new Error('source data URL MIME does not match ' + expectedMime);
    if (match[2].length > 24000000) throw new Error('source data URL exceeds the 18 MB codec boundary');
    if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(match[2], 'base64'));
    var binary = atob(match[2]), bytes = new Uint8Array(binary.length);
    for (var index=0; index<binary.length; index+=1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }
  function u64(view, offset, errors, label) {
    var low=view.getUint32(offset,true), high=view.getUint32(offset+4,true);
    if (high > 0x1fffff) { errors.push(label + ' exceeds safe JavaScript integer range'); return Number.MAX_SAFE_INTEGER; }
    return high*4294967296+low;
  }
  function range(errors, regions, label, offset, length, bytesLength, required) {
    if (!length) { if (required) errors.push(label + ' is required'); return; }
    if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0 || offset+length > bytesLength) { errors.push(label + ' exceeds the KTX2 container'); return; }
    regions.push({label:label,offset:offset,length:length,end:offset+length});
  }
  function inspect(value) {
    var bytes=asBytes(value), errors=[], warnings=[], levels=[], regions=[];
    if (bytes.length < 104) return {pass:false,errors:['KTX2 container is shorter than a one-level header'],warnings:warnings,byteLength:bytes.length,levels:levels};
    for (var marker=0; marker<IDENTIFIER.length; marker+=1) if (bytes[marker]!==IDENTIFIER[marker]) { errors.push('KTX2 identifier mismatch'); break; }
    var view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength), vkFormat=view.getUint32(12,true), typeSize=view.getUint32(16,true), width=view.getUint32(20,true), height=view.getUint32(24,true), depth=view.getUint32(28,true), layerCount=view.getUint32(32,true), faceCount=view.getUint32(36,true), levelCount=view.getUint32(40,true), scheme=view.getUint32(44,true), dfdOffset=view.getUint32(48,true), dfdLength=view.getUint32(52,true), kvdOffset=view.getUint32(56,true), kvdLength=view.getUint32(60,true), sgdOffset=u64(view,64,errors,'supercompression global data offset'), sgdLength=u64(view,72,errors,'supercompression global data length');
    if (!width || !height) errors.push('KTX2 2D dimensions must be positive');
    if (depth!==0) errors.push('this hand validates 2D KTX2 textures only');
    if (layerCount!==0) errors.push('texture arrays are outside this hand');
    if (faceCount!==1) errors.push('this hand validates one-face textures only');
    if (!levelCount || levelCount>32) errors.push('KTX2 level count must be 1..32');
    if ([0,1,2,3].indexOf(scheme)<0) errors.push('unknown KTX2 supercompression scheme');
    if (scheme===1 && vkFormat!==0) errors.push('BasisLZ KTX2 must declare vkFormat 0');
    if (typeSize!==1) errors.push('Basis texture typeSize must be 1');
    var indexEnd=80+levelCount*24;
    if (indexEnd>bytes.length) errors.push('KTX2 level index exceeds the container');
    range(errors,regions,'data format descriptor',dfdOffset,dfdLength,bytes.length,true);
    range(errors,regions,'key/value data',kvdOffset,kvdLength,bytes.length,false);
    range(errors,regions,'supercompression global data',sgdOffset,sgdLength,bytes.length,scheme===1);
    for (var level=0; level<levelCount && 80+(level+1)*24<=bytes.length; level+=1) {
      var itemOffset=80+level*24, byteOffset=u64(view,itemOffset,errors,'level '+level+' byte offset'), byteLength=u64(view,itemOffset+8,errors,'level '+level+' byte length'), uncompressedLength=u64(view,itemOffset+16,errors,'level '+level+' uncompressed length');
      if (!byteLength) errors.push('level '+level+' has no payload');
      range(errors,regions,'level '+level,byteOffset,byteLength,bytes.length,true);
      levels.push({index:level,width:Math.max(1,width>>level),height:Math.max(1,height>>level),byteOffset:byteOffset,byteLength:byteLength,uncompressedByteLength:uncompressedLength});
    }
    if (dfdOffset<indexEnd) errors.push('data format descriptor overlaps the header or level index');
    regions.sort(function(a,b){return a.offset-b.offset||a.end-b.end;});
    for (var regionIndex=1; regionIndex<regions.length; regionIndex+=1) if (regions[regionIndex].offset<regions[regionIndex-1].end) errors.push(regions[regionIndex-1].label+' overlaps '+regions[regionIndex].label);
    var fullLevels=width&&height?Math.floor(Math.log(Math.max(width,height))/Math.LN2)+1:0;
    if (levelCount>fullLevels) errors.push('level count exceeds the complete mip chain');
    if (scheme===0) warnings.push('texture is KTX2 but not supercompressed');
    return {pass:!errors.length,errors:errors,warnings:warnings,identifier:'KTX 2.0',byteLength:bytes.length,vkFormat:vkFormat,typeSize:typeSize,width:width,height:height,depth:depth,layerCount:layerCount,faceCount:faceCount,levelCount:levelCount,supercompressionScheme:scheme,supercompressionName:['none','BasisLZ','Zstandard','ZLIB'][scheme]||'unknown',dfd:{offset:dfdOffset,length:dfdLength},kvd:{offset:kvdOffset,length:kvdLength},sgd:{offset:sgdOffset,length:sgdLength},levels:levels};
  }
  function ready() {
    if (basisModule) return Promise.resolve(basisModule);
    if (!basisPromise) {
      var basisFactory=nodeRuntime?nodeRuntime.basisFactory:root.BASIS;
      if (typeof basisFactory!=='function') return Promise.reject(new Error('Pinned Basis Universal encoder module is unavailable'));
      var options={print:function(){},printErr:function(){}};
      if (nodeRuntime) options.locateFile=function(filename){return nodeRuntime.path.join(nodeRuntime.wasmDirectory,filename);};
      basisPromise=basisFactory(options).then(function(module){module.initializeBasis();basisModule=module;return module;});
    }
    return basisPromise;
  }
  function dimensionsFromPng(bytes) {
    bytes=asBytes(bytes);
    var signature=[137,80,78,71,13,10,26,10];
    if (bytes.length<24 || signature.some(function(value,index){return bytes[index]!==value;})) throw new Error('PNG source signature is invalid');
    var view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    return {width:view.getUint32(16,false),height:view.getUint32(20,false)};
  }
  function mipPlan(width,height,maximum) {
    var full=Math.floor(Math.log(Math.max(width,height))/Math.LN2)+1;
    var levels=maximum==null?full:Math.max(1,Math.min(full,Math.round(Number(maximum)||1)));
    var shift=levels-1, smallest=Math.max(1,Math.max(Math.max(1,width>>shift),Math.max(1,height>>shift)));
    return {requestedMaximum:maximum==null?null:Number(maximum),fullLevels:full,levels:levels,smallestDimension:smallest,generate:levels>1};
  }
  async function moduleInspection(value, includePixels) {
    var bytes=asBytes(value), module=await ready(), file=new module.KTX2File(bytes), result={pass:false,errors:[]}, rgba=null;
    try {
      if (!file.isValid()) { result.errors.push('Basis Universal rejected the KTX2 container'); return result; }
      result.width=file.getWidth();result.height=file.getHeight();result.levelCount=file.getLevels();result.faces=file.getFaces();result.layers=file.getLayers();result.hasAlpha=file.getHasAlpha();result.isSrgb=file.isSRGB();result.isEtc1s=file.isETC1S();result.isUastc=file.isUASTC();result.basisTextureFormat=file.getBasisTexFormat();result.dfdTransferFunction=file.getDFDTransferFunc();result.dfdColourModel=file.getDFDColorModel();
      if (!file.startTranscoding()) { result.errors.push('Basis Universal could not start transcoding'); return result; }
      var format=module.transcoder_texture_format.cTFRGBA32.value, size=file.getImageTranscodedSizeInBytes(0,0,0,format);
      if (size!==result.width*result.height*4) { result.errors.push('decoded RGBA size does not match level 0 dimensions'); return result; }
      rgba=new Uint8Array(size);
      if (!file.transcodeImage(rgba,0,0,0,format,0,-1,-1)) { result.errors.push('Basis Universal could not transcode level 0 to RGBA32'); return result; }
      result.decodedByteLength=rgba.length;result.pass=true;
      if (includePixels) result.rgba=rgba;
      return result;
    } finally { try{file.close();}catch(error){} try{file.delete();}catch(error){} }
  }
  async function validate(value, options) {
    var structural=inspect(value), moduleResult=structural.pass?await moduleInspection(value,options&&options.includePixels):{pass:false,errors:['module validation skipped because structural validation failed']};
    var errors=structural.errors.concat(moduleResult.errors||[]);
    return {pass:structural.pass&&moduleResult.pass,errors:errors,structural:structural,module:moduleResult};
  }
  async function encodeSource(source, width, height, options) {
    options=options||{};width=Math.round(Number(width));height=Math.round(Number(height));
    if (!(width>=4&&height>=4&&width<=1024&&height<=1024)) throw new Error('Basis KTX2 dimensions must be 4..1024 pixels');
    var module=await ready(), encoder=new module.BasisEncoder(), plan=mipPlan(width,height,options.maxMipLevels), quality=Math.max(1,Math.min(255,Math.round(Number(options.quality)||160))), effort=Math.max(0,Math.min(6,Math.round(Number(options.effort)||2))), outputLimit=Math.max(1048576,Math.min(33554432,Math.round(Number(options.outputAllocationBytes)||Math.max(2097152,width*height*6)))), output=new Uint8Array(outputLimit), encodedLength=0;
    try {
      encoder.controlThreading(false,1);
      encoder.setCreateKTX2File(true);
      encoder.setFormatMode(module.basis_tex_format.cETC1S.value);
      encoder.setQualityLevel(quality);
      encoder.setETC1SCompressionLevel(effort);
      encoder.setPerceptual(options.colourSpace==='srgb');
      encoder.setKTX2AndBasisSRGBTransferFunc(options.colourSpace==='srgb');
      encoder.setMipSRGB(options.colourSpace==='srgb');
      encoder.setCheckForAlpha(true);
      encoder.setForceAlpha(options.transparency==='required');
      encoder.setMipGen(plan.generate);
      encoder.setMipSmallestDimension(plan.smallestDimension);
      encoder.setMipWrapping(options.tileable===true);
      encoder.setYFlip(false);
      if (source.kind==='rgba') encoder.setSliceSourceImage(0,asBytes(source.bytes),width,height,module.ldr_image_type.cRGBA32.value);
      else encoder.setSliceSourceImage(0,asBytes(source.bytes),0,0,module.ldr_image_type.cPNGImage.value);
      encodedLength=encoder.encode(output);
      if (!encodedLength) throw new Error('Basis Universal encoding failed or exceeded the bounded output allocation');
    } finally { try{encoder.delete();}catch(error){} }
    var bytes=output.slice(0,encodedLength), validation=await validate(bytes,{includePixels:false});
    if (!validation.pass) throw new Error('KTX2 validation failed: '+validation.errors.join(', '));
    if (validation.structural.supercompressionScheme!==1 || !validation.module.isEtc1s) throw new Error('encoder did not produce ETC1S BasisLZ supercompression');
    return {mime:'image/ktx2',format:'KTX2',bytes:bytes,byteLength:bytes.length,dataUrl:dataUrl('image/ktx2',bytes),width:width,height:height,quality:quality,effort:effort,mipPlan:plan,validation:validation};
  }
  async function encodeRgba(width,height,rgba,options) {
    rgba=asBytes(rgba);
    if (rgba.length!==Math.round(width)*Math.round(height)*4) throw new Error('RGBA byte length does not match target dimensions');
    return encodeSource({kind:'rgba',bytes:rgba},width,height,options);
  }
  async function encodePng(pngBytes,options) {
    pngBytes=asBytes(pngBytes);var dimensions=dimensionsFromPng(pngBytes);
    return encodeSource({kind:'png',bytes:pngBytes},dimensions.width,dimensions.height,options);
  }

  return {VERSION:VERSION,BASIS_VERSION:BASIS_VERSION,BASIS_COMMIT:BASIS_COMMIT,ready:ready,inspect:inspect,validate:validate,moduleInspection:moduleInspection,encodeRgba:encodeRgba,encodePng:encodePng,mipPlan:mipPlan,bytesFromDataUrl:bytesFromDataUrl,dataUrl:dataUrl,dimensionsFromPng:dimensionsFromPng};
}));
