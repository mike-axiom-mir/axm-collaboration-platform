(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AXMAssetFinisher = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  var DESCRIPTOR = {
    schema: 'axm.asset-hand/v2', contract_version:'2.0', id: 'delivery-finisher', title: 'Asset Finishing Hand', version: '2.0.0', category: 'derivation', lifecycle_status:'beta',
    summary: 'Rasterizes a reviewed SVG source and asks the isolated local output engine for a verified PNG, JPEG or WebP derivative.',
    purpose:'Create a verified raster delivery derivative while preserving the editable vector result as its source.',operation_modes:['finish'],canvas_models:['raster-frame'],entry_surfaces:['finishing-panel'],mutability:'export',kinds:['*'],wildcard_kind_policy:'native',
    accepts: ['axm.asset-hand-result/v1', 'image/svg+xml'], produces: ['axm.asset-hand-delivery/v1', 'image/png', 'image/jpeg', 'image/webp'],
    input_types:[{mime:'application/json',format:'JSON',schema:'axm.asset-hand-result/v1',roles:['delivery-source'],required_for:['finish'],mutable:false,max_bytes:12000000}],
    output_types: [{mime:'image/png',format:'PNG',schema:'',role:'delivery',editable:false,deterministic:false,lossy:true,known_losses:['vector editability and semantic structure are rasterized']},{mime:'image/jpeg',format:'JPEG',schema:'',role:'delivery',editable:false,deterministic:false,lossy:true,known_losses:['vector editability, semantic structure and transparency are lost']},{mime:'image/webp',format:'WEBP',schema:'',role:'delivery',editable:false,deterministic:false,lossy:true,known_losses:['vector editability and semantic structure are rasterized']}],
    canvas_types: [{medium:'screen',units:['px'],colour_spaces:['srgb'],transparency_modes:['required','allowed','opaque'],behaviours:['static']},{medium:'ui',units:['px'],colour_spaces:['srgb'],transparency_modes:['required','allowed','opaque'],behaviours:['static']},{medium:'game-world',units:['px'],colour_spaces:['srgb'],transparency_modes:['required','allowed','opaque'],behaviours:['static']}],
    canvas_limits:{min_width:1,min_height:1,max_width:8192,max_height:8192,max_pixels:67108864},
    constraints_honoured: ['dimensions','dimensions.unit','colour.space','colour.transparency','behaviour.static'],
    editable_recipe_formats: ['axm.asset-finish-recipe/v1'], operations: { preview:true, validate:true, edit:false },emits_editable_source:false,supports_edit_operation:false,
    requires: ['canvas-2d', 'output:image.transform'], editable: false, deterministic: false, authority: 'derivative-inbox-only',
    engine: { name: 'Browser Canvas + AXM Output/wasm-vips', version: '1.0.0', execution: 'browser-and-isolated-node-worker' },
    required_permissions:{local_file_system:'none',network_domains:[]},network_policy:{mode:'none',domains:[]},host_compatibility:{dependencies:[{id:'axm-output',version:'v1'}]},implementation_status:'executable',safety_tier:'safe-local',portability:{interchange_formats:['image/png','image/jpeg','image/webp'],known_losses:['delivery raster is not the editable authoring master'],unsupported_features:['vector-preserving delivery'],fallbacks:[]},validation:{checks:['source SVG envelope','output worker receipt','format and MIME agreement']},rollback:{strategy:'discard-delivery-derivative'},observability:{receipts:['axm.output.receipt/v1']},evidence:[{claim:'The isolated Output service emits a digest-bearing completion receipt.',source_url:'local:shared/output',specification_version:'v1'}],tests:['asset-hands-selftest'],implementation_priority:'medium',
    limits: { maxDimension: 8192, formats: ['PNG', 'JPEG', 'WebP'], colourSpaces:['srgb'], automaticPublish: false }
  };
  function validateRequest(result, format, options) {
    options=options||{};
    var errors=[],canvas=result&&result.target_canvas||result&&result.brief&&result.brief.target_canvas;
    if (!result || result.schema !== 'axm.asset-hand-result/v1') errors.push('verified asset hand result required');
    if (!result || !result.technical || result.technical.pass !== true || !result.validation_receipt || result.validation_receipt.status !== 'PASS') errors.push('source result must carry a passing validation receipt');
    if (!canvas || canvas.schema !== 'axm.target-canvas/v1') errors.push('source result target canvas is missing');
    if (canvas && ['screen','ui','game-world'].indexOf(canvas.medium) < 0) errors.push('finisher only supports screen, UI and game-world canvases');
    if (canvas && (!canvas.dimensions || canvas.dimensions.unit !== 'px')) errors.push('finisher requires pixel dimensions');
    if (canvas && canvas.dimensions && (canvas.dimensions.width < 1 || canvas.dimensions.height < 1 || canvas.dimensions.width > 8192 || canvas.dimensions.height > 8192)) errors.push('target pixel dimensions exceed the 1..8192 finishing boundary');
    if (canvas && (!canvas.colour || canvas.colour.space !== 'srgb')) errors.push('finisher only claims sRGB raster delivery');
    if (canvas && (!Array.isArray(canvas.behaviour) || canvas.behaviour.length !== 1 || canvas.behaviour[0] !== 'static')) errors.push('finisher only supports static raster delivery');
    if (format === 'JPEG' && canvas && canvas.colour && canvas.colour.transparency !== 'opaque') errors.push('JPEG requires an opaque target canvas');
    try { source(result); } catch (error) { errors.push(String(error.message || error)); }
    return {pass:errors.length===0,errors:errors,target_canvas:canvas||null};
  }
  function source(result) {
    if (!result || result.schema !== 'axm.asset-hand-result/v1') throw new Error('verified asset hand result required');
    var artifact = (result.artifacts || []).find(function (item) { return item.format === 'SVG' && item.text; });
    if (!artifact) throw new Error('an SVG source artifact is required for finishing');
    return artifact;
  }
  function rasterize(result) {
    if (!root.document || !root.Image) return Promise.reject(new Error('browser canvas is unavailable'));
    var artifact = source(result), width = Math.max(1, Math.min(8192, artifact.width || result.brief.canvas.width)), height = Math.max(1, Math.min(8192, artifact.height || result.brief.canvas.height));
    return new Promise(function (resolve, reject) {
      var image = new Image(), url = URL.createObjectURL(new Blob([artifact.text], { type: 'image/svg+xml' }));
      image.onload = function () {
        try {
          var canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
          var context = canvas.getContext('2d'); context.clearRect(0, 0, width, height); context.drawImage(image, 0, 0, width, height);
          URL.revokeObjectURL(url); resolve({ dataUrl: canvas.toDataURL('image/png'), width: width, height: height, artifact: artifact });
        } catch (error) { URL.revokeObjectURL(url); reject(error); }
      };
      image.onerror = function () { URL.revokeObjectURL(url); reject(new Error('SVG source could not be rasterized')); };
      image.src = url;
    });
  }
  async function finish(result, format, options) {
    options = options || {};
    var output = options.output || root.AXMOutput, outputCore = options.outputCore || root.AXMOutputCore;
    if (!output || !outputCore) throw new Error('AXM Output service is unavailable');
    format = String(format || 'PNG').toUpperCase();
    if (['PNG', 'JPEG', 'WEBP'].indexOf(format) < 0) throw new Error('finishing format must be PNG, JPEG or WebP');
    var preflight=validateRequest(result,format,options);
    if(!preflight.pass)throw new Error('finishing request refused: '+preflight.errors.join('; '));
    if (format === 'WEBP') format = 'WebP';
    var raster = await rasterize(result);
    var job = { schema: outputCore.JOB_SCHEMA, kind: 'image.transform', name: result.brief.title, payload: { dataUrl: raster.dataUrl, format: format, width:preflight.target_canvas.dimensions.width, height:preflight.target_canvas.dimensions.height, quality: Number(options.quality) || 88, filename: result.brief.title }, actor: options.actor || { id: 'local-user', kind: 'human' } };
    var completed = await output.run(job, options);
    var createdAt=completed&&completed.receipt&&completed.receipt.completedAt||new Date().toISOString();
    return { schema: 'axm.asset-hand-delivery/v1', sourceResultId: result.id, sourceDigest: result.digest, target_canvas: preflight.target_canvas, target_canvas_original:result.target_canvas_original||preflight.target_canvas,canvas_transform_receipt:result.canvas_transform_receipt||null, sourceCreationRecipe: result.creation_recipe || null, sourceValidationReceipt: result.validation_receipt || null, creation_recipe:{schema:'axm.asset-finish-recipe/v1',hand:{id:DESCRIPTOR.id,version:DESCRIPTOR.version},operation:'finish',format:format,width:preflight.target_canvas.dimensions.width,height:preflight.target_canvas.dimensions.height,quality:Number(options.quality)||88,sourceResultId:result.id,sourceDigest:result.digest},validation_receipt:{schema:'axm.asset-validation-receipt/v1',status:'PASS',validator:{id:DESCRIPTOR.id,version:DESCRIPTOR.version},checks:[{name:'source-result-validation',pass:true},{name:'target-canvas-preflight',pass:true},{name:'output-worker-receipt',pass:!!(completed&&completed.receipt)}],createdAt:createdAt},provenance:{createdAt:createdAt,handId:DESCRIPTOR.id,handVersion:DESCRIPTOR.version,sourceResultId:result.id,sourceDigest:result.digest},hand: DESCRIPTOR, output: completed, receipt: completed.receipt, reviewState: 'INBOX' };
  }
  return { VERSION: '2.0.0', descriptor: function () { return JSON.parse(JSON.stringify(DESCRIPTOR)); }, source: source, validateRequest:validateRequest,rasterize: rasterize, finish: finish };
}));
