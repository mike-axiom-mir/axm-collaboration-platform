(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AXMStudioActions = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SCHEMA = 'axm.visual-action/v1';
  function action(id, title, family, level, summary, handler, contexts, requires, payload, aliases, bindings, options) {
    return Object.assign({
      schema:SCHEMA,
      id:id,
      title:title,
      family:family,
      level:level,
      summary:summary,
      handler:handler,
      contexts:contexts,
      requires:requires,
      payload:payload || {},
      aliases:aliases || [],
      bindings:bindings || [],
      destructive:false,
      reversible:true
    }, options || {});
  }

  function mode(id, title, summary, aliases) {
    return action('mode.' + id, title, 'mode', 'core', summary, 'studio.mode', ['studio'], ['studio.shell'], {mode:id}, aliases);
  }
  function canvas(id, title, family, level, summary, command, aliases, bindings, options, contexts) {
    return action(id, title, family, level, summary, 'studio.canvas', contexts || ['canvas'], ['studio.canvas'], {command:command}, aliases, bindings, options);
  }

  var ACTIONS = [
    mode('paint', 'Open Drawing & Painting', 'Switch to the layered paint workspace.', ['paint mode', 'draw', 'painting']),
    mode('vector', 'Open Vector Graphics', 'Switch to editable vector paths and scalable shapes.', ['vector mode', 'svg', 'paths']),
    mode('pixel', 'Open Pixel Art & Animation', 'Switch to pixel tools, frames, onion skin, and playback.', ['pixel mode', 'sprite', 'animation']),
    mode('photo', 'Open Photo & Compositing', 'Switch to image import, cut regions, layers, and retouching.', ['photo mode', 'collage', 'composite']),
    mode('pattern', 'Open Textures & Patterns', 'Switch to repeat, symmetry, and reusable surface tools.', ['pattern mode', 'texture']),
    mode('type', 'Open Typography', 'Switch to lettering, titles, and typographic composition.', ['type mode', 'text', 'lettering']),
    mode('layout', 'Open Graphic & Story Layout', 'Switch to page, comic, storyboard, and layout tools.', ['layout mode', 'graphic design', 'storyboard']),
    mode('uiux', 'Open UI/UX & Web Design', 'Switch to the human-first interface builder.', ['ui ux', 'web design', 'interface']),
    mode('skin', 'Open Skin Production', 'Switch to safety-gated AXM skin production.', ['skin', 'theme']),
    mode('pack', 'Open Asset Pack Production', 'Switch to reviewable asset packaging.', ['asset pack', 'package']),

    action('service.assets', 'Open Asset Vault', 'service', 'core', 'Find and import reusable visual assets without leaving Studio.', 'studio.service', ['studio'], ['studio.shell'], {service:'assets'}, ['library', 'asset browser']),
    action('service.creation-hands', 'Open Creation Hands', 'service', 'core', 'Choose a compatible modular maker and explicitly import its reviewed result.', 'studio.service', ['studio'], ['studio.shell'], {service:'hands'}, ['hands', 'generate asset', 'makers']),
    action('project.save-workspace', 'Save workspace', 'project', 'core', 'Save the Studio shell and request an artwork checkpoint.', 'studio.workspace', ['studio'], ['studio.shell', 'studio.canvas'], {command:'save-workspace'}, ['checkpoint', 'save work']),

    canvas('history.undo', 'Undo', 'history', 'core', 'Undo the latest editable change in the active canvas mode.', 'history.undo', ['step back', 'reverse'], [{keys:'Mod+Z', platform:'all', context:'canvas'}]),
    canvas('history.redo', 'Redo', 'history', 'core', 'Restore the latest undone editable change.', 'history.redo', ['step forward', 'restore'], [{keys:'Mod+Shift+Z', platform:'all', context:'canvas'}]),
    canvas('project.export-png', 'Export PNG', 'project', 'core', 'Download the visible composition as a transparent PNG.', 'project.export-png', ['download image', 'save png'], [{keys:'Mod+S', platform:'all', context:'canvas'}], {reversible:false}),
    canvas('project.save-file', 'Save editable project file', 'project', 'core', 'Download an editable Studio project checkpoint.', 'project.save-file', ['save project', 'backup project'], [{keys:'Mod+E', platform:'all', context:'canvas'}], {reversible:false}),
    canvas('project.load-file', 'Load project file', 'project', 'core', 'Choose a saved Studio project to continue editing.', 'project.load-file', ['open project', 'import project'], [], {reversible:false}),
    canvas('layer.add', 'Add layer', 'layer', 'core', 'Create a new editable layer with the selected owner and goal.', 'layer.add', ['new layer']),
    canvas('view.focus-canvas', 'Focus canvas', 'view', 'core', 'Hide side panels temporarily and give the artwork more room.', 'view.focus-canvas', ['canvas only', 'zen mode', 'fullscreen canvas']),
    canvas('view.toggle-all-tools', 'Show or focus tools', 'view', 'core', 'Toggle between the focused beginner tool set and the complete tool spine.', 'view.toggle-all-tools', ['show all tools', 'advanced tools', 'focus tools']),
    canvas('asset.import-image', 'Import image', 'project', 'core', 'Choose a local image and add it to the current composition.', 'asset.import-image', ['place image', 'open image']),

    canvas('tool.brush', 'Select Brush', 'tool', 'core', 'Paint continuous strokes on the active layer.', 'tool.brush', ['paintbrush']),
    canvas('tool.pencil', 'Select Pencil', 'tool', 'core', 'Draw crisp line work and pixel-friendly marks.', 'tool.pencil', ['pencil tool']),
    canvas('tool.eraser', 'Select Eraser', 'tool', 'core', 'Remove pixels from the active editable layer.', 'tool.eraser', ['erase']),
    canvas('tool.line', 'Select Line', 'tool', 'core', 'Draw a straight line between two points.', 'tool.line', ['line tool']),
    canvas('tool.rect', 'Select Rectangle', 'tool', 'core', 'Draw a rectangular shape.', 'tool.rect', ['rectangle', 'box']),
    canvas('tool.circle', 'Select Circle', 'tool', 'core', 'Draw a circular shape.', 'tool.circle', ['ellipse']),
    canvas('tool.fill', 'Select Fill', 'tool', 'core', 'Fill a connected area with the current color.', 'tool.fill', ['bucket', 'flood fill']),
    canvas('tool.gradient', 'Select Gradient', 'tool', 'core', 'Draw a color gradient across an area.', 'tool.gradient', ['gradient tool']),
    canvas('tool.pick', 'Select Color Picker', 'tool', 'core', 'Sample a color from the canvas.', 'tool.pick', ['eyedropper', 'sample color']),
    canvas('tool.text', 'Select Text', 'tool', 'core', 'Place editable-looking raster text on the active layer.', 'tool.text', ['type tool', 'add text']),

    canvas('project.export-2x', 'Export PNG at 2×', 'project', 'advanced', 'Download a double-resolution PNG.', 'project.export-2x', ['high resolution 2x'], [], {reversible:false}),
    canvas('project.export-3x', 'Export PNG at 3×', 'project', 'advanced', 'Download a triple-resolution PNG.', 'project.export-3x', ['high resolution 3x'], [], {reversible:false}),
    canvas('project.new', 'Start new project', 'project', 'advanced', 'Start from a clean project after an explicit confirmation.', 'project.new', ['new document', 'clear project'], [], {destructive:true, reversible:false}),
    canvas('layer.clear', 'Clear active layer', 'layer', 'advanced', 'Remove the active layer pixels after confirmation; Undo can restore them.', 'layer.clear', ['erase layer'], [], {destructive:true}),
    canvas('selection.copy-region', 'Copy region to asset', 'selection', 'advanced', 'Mark a rectangular region to capture without removing it.', 'selection.copy-region', ['copy selection', 'crop asset']),
    canvas('selection.cut-region', 'Cut region to asset', 'selection', 'advanced', 'Mark a rectangular region to capture and remove from the layer.', 'selection.cut-region', ['cut selection'], [], {destructive:true}),
    canvas('palette.previous', 'Previous palette', 'color', 'advanced', 'Cycle to the previous color palette.', 'palette.previous', ['previous colors']),
    canvas('palette.next', 'Next palette', 'color', 'advanced', 'Cycle to the next color palette.', 'palette.next', ['next colors']),
    canvas('palette.save-color', 'Save current color', 'color', 'advanced', 'Add the current color to My Colors.', 'palette.save-color', ['remember color']),
    canvas('wheel.presets', 'Open Presets wheel', 'service', 'advanced', 'Open reusable Studio presets.', 'wheel.presets', ['presets']),
    canvas('wheel.blueprints', 'Open Blueprints wheel', 'service', 'advanced', 'Open AI-drafted recipe blueprints.', 'wheel.blueprints', ['blueprints', 'recipes']),
    canvas('wheel.stickers', 'Open Stickers wheel', 'service', 'advanced', 'Open reusable sticker assets.', 'wheel.stickers', ['stickers']),

    canvas('tool.airbrush', 'Select Airbrush', 'tool', 'advanced', 'Paint soft atmospheric strokes.', 'tool.airbrush', ['spray']),
    canvas('tool.smudge', 'Select Smudge', 'tool', 'advanced', 'Blend nearby pixels on the active layer.', 'tool.smudge', ['blend tool']),
    canvas('tool.polygon', 'Select Polygon', 'tool', 'advanced', 'Draw a multi-sided shape.', 'tool.polygon', ['polygon tool']),
    canvas('tool.blur', 'Select Blur brush', 'tool', 'advanced', 'Softly blur a local area while painting.', 'tool.blur', ['blur tool']),
    canvas('tool.sharpen', 'Select Sharpen brush', 'tool', 'advanced', 'Increase local edge contrast while painting.', 'tool.sharpen', ['sharpen tool']),
    canvas('tool.dodge', 'Select Dodge', 'tool', 'advanced', 'Lighten a local area.', 'tool.dodge', ['lighten tool']),
    canvas('tool.burn', 'Select Burn', 'tool', 'advanced', 'Darken a local area.', 'tool.burn', ['darken tool']),

    canvas('finish.flat', 'Use Flat finish', 'finish', 'advanced', 'Draw new marks with a flat color finish.', 'finish.flat', ['flat style']),
    canvas('finish.gloss', 'Use Gloss finish', 'finish', 'advanced', 'Draw new marks with a glossy finish.', 'finish.gloss', ['glossy style']),
    canvas('finish.metallic', 'Use Metallic finish', 'finish', 'advanced', 'Draw new marks with a metallic finish.', 'finish.metallic', ['metal style']),
    canvas('symmetry.off', 'Turn symmetry off', 'symmetry', 'advanced', 'Draw a single unmirrored stroke.', 'symmetry.off', ['no symmetry']),
    canvas('symmetry.vertical', 'Use vertical symmetry', 'symmetry', 'advanced', 'Mirror new strokes across the vertical axis.', 'symmetry.vertical', ['mirror vertical']),
    canvas('symmetry.horizontal', 'Use horizontal symmetry', 'symmetry', 'advanced', 'Mirror new strokes across the horizontal axis.', 'symmetry.horizontal', ['mirror horizontal']),
    canvas('symmetry.quad', 'Use four-way symmetry', 'symmetry', 'advanced', 'Mirror new strokes across both axes.', 'symmetry.quad', ['quad symmetry']),
    canvas('symmetry.radial', 'Use radial symmetry', 'symmetry', 'advanced', 'Repeat new strokes around the canvas center.', 'symmetry.radial', ['kaleidoscope', 'radial mirror']),

    canvas('filter.blur', 'Apply Blur filter', 'filter', 'specialist', 'Blur the complete active layer; Undo remains available.', 'filter.blur', ['blur layer'], [], {}, ['canvas']),
    canvas('filter.sharpen', 'Apply Sharpen filter', 'filter', 'specialist', 'Sharpen the complete active layer; Undo remains available.', 'filter.sharpen', ['sharpen layer']),
    canvas('filter.brighten', 'Apply Brighten filter', 'filter', 'specialist', 'Brighten the complete active layer; Undo remains available.', 'filter.brighten', ['brighten layer']),
    canvas('filter.darken', 'Apply Darken filter', 'filter', 'specialist', 'Darken the complete active layer; Undo remains available.', 'filter.darken', ['darken layer']),
    canvas('filter.saturate', 'Apply Saturate filter', 'filter', 'specialist', 'Increase color saturation on the active layer.', 'filter.saturate', ['saturate layer']),
    canvas('filter.grey', 'Apply Greyscale filter', 'filter', 'specialist', 'Convert the active layer to greyscale.', 'filter.grey', ['black and white', 'grayscale']),
    canvas('filter.invert', 'Apply Invert filter', 'filter', 'specialist', 'Invert colors on the active layer.', 'filter.invert', ['negative']),
    canvas('filter.contrast', 'Apply Contrast filter', 'filter', 'specialist', 'Increase contrast on the active layer.', 'filter.contrast', ['contrast layer']),
    canvas('filter.warm', 'Apply Warm filter', 'filter', 'specialist', 'Shift the active layer toward warmer color.', 'filter.warm', ['warm colors']),
    canvas('filter.cool', 'Apply Cool filter', 'filter', 'specialist', 'Shift the active layer toward cooler color.', 'filter.cool', ['cool colors']),
    canvas('filter.polish', 'Apply Polish filter', 'filter', 'specialist', 'Apply the bounded crisp-edge finishing filter to the active layer.', 'filter.polish', ['polish finish', 'crisp edges']),

    canvas('vector.new-path', 'Start vector path', 'vector', 'specialist', 'Start a new editable point-by-point vector path.', 'vector.new-path', ['new path', 'pen path'], [], {}, ['vector']),
    canvas('vector.finish-path', 'Finish vector path', 'vector', 'specialist', 'Stop adding nodes and keep the vector path editable.', 'vector.finish-path', ['complete path'], [], {}, ['vector']),
    canvas('vector.toggle-close', 'Close or open vector path', 'vector', 'specialist', 'Toggle whether the selected path connects its last node to its first.', 'vector.toggle-close', ['close path', 'open path'], [], {}, ['vector']),
    canvas('vector.toggle-smooth', 'Toggle smooth vector path', 'vector', 'specialist', 'Toggle the selected path between smooth and straight segments.', 'vector.toggle-smooth', ['smooth path'], [], {}, ['vector']),
    canvas('vector.delete-node', 'Delete vector node', 'vector', 'specialist', 'Delete the selected vector node.', 'vector.delete-node', ['remove node'], [], {destructive:true}, ['vector']),
    canvas('vector.delete-path', 'Delete vector path', 'vector', 'specialist', 'Delete the selected vector path.', 'vector.delete-path', ['remove path'], [], {destructive:true}, ['vector']),
    canvas('vector.duplicate-path', 'Duplicate vector path', 'vector', 'specialist', 'Create an editable offset copy of the selected path.', 'vector.duplicate-path', ['copy path'], [], {}, ['vector']),

    canvas('animation.add-frame', 'Add animation frame', 'animation', 'specialist', 'Add a blank frame after preserving the active frame.', 'animation.add-frame', ['new frame'], [], {}, ['pixel']),
    canvas('animation.duplicate-frame', 'Duplicate animation frame', 'animation', 'specialist', 'Create an editable copy of the active frame.', 'animation.duplicate-frame', ['copy frame'], [], {}, ['pixel']),
    canvas('animation.delete-frame', 'Delete animation frame', 'animation', 'specialist', 'Delete the active frame after confirmation.', 'animation.delete-frame', ['remove frame'], [], {destructive:true, reversible:false}, ['pixel']),
    canvas('animation.play', 'Play animation', 'animation', 'specialist', 'Preview the timed frame sequence.', 'animation.play', ['preview animation'], [], {}, ['pixel']),
    canvas('animation.stop', 'Stop animation', 'animation', 'specialist', 'Stop frame playback.', 'animation.stop', ['pause animation'], [], {}, ['pixel']),
    canvas('animation.toggle-onion', 'Toggle onion skin', 'animation', 'specialist', 'Show or hide the previous frame as a drawing guide.', 'animation.toggle-onion', ['onion skin'], [], {}, ['pixel']),
    canvas('animation.export', 'Export spritesheet', 'animation', 'specialist', 'Download the animation spritesheet and timing map.', 'animation.export', ['spritesheet', 'export frames'], [], {reversible:false}, ['pixel'])
  ];

  return { SCHEMA:SCHEMA, ACTIONS:ACTIONS };
}));
