(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AXMStudioCore = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var FORMAT = 'axm.studio.workspace/v2';
  var MODES = [
    { id:'paint', group:'Make', title:'Drawing & Painting', short:'Paint', route:'canvas', goal:'paint', tool:'brush', icon:'brush', description:'Layered drawing, painting, colour, finish and AI-assisted marks.' },
    { id:'vector', group:'Make', title:'Vector Graphics', short:'Vector', route:'canvas', goal:'line', tool:'line', icon:'vector', description:'Clean shapes, paths, line work, icons and scalable visual systems.' },
    { id:'pixel', group:'Make', title:'Pixel Art & Animation', short:'Pixel', route:'canvas', goal:'line', tool:'pencil', icon:'pixel', description:'Crisp pixel work, sprites, frames and atlas-ready assets.' },
    { id:'photo', group:'Make', title:'Photo, Collage & Compositing', short:'Photo', route:'canvas', goal:'retouch', tool:'pick', icon:'photo', description:'Import images, cut regions, composite layers and finish artwork.' },
    { id:'pattern', group:'Make', title:'Textures & Patterns', short:'Pattern', route:'canvas', goal:'background', tool:'gradient', icon:'pattern', description:'Textures, repeats, symmetry, backgrounds and reusable surfaces.' },
    { id:'type', group:'Design', title:'Typography & Type Design', short:'Type', route:'canvas', goal:'line', tool:'text', icon:'type', description:'Lettering, typographic composition, titles and readable type assets.' },
    { id:'layout', group:'Design', title:'Graphic Design & Story Layout', short:'Layout', route:'canvas', goal:'creative', tool:'rect', icon:'layout', description:'Page layout, graphic design, comics, manga and storyboards.' },
    { id:'uiux', group:'Interface', title:'UI/UX & Web Design', short:'UI/UX', route:'uiux', icon:'uiux', description:'Human needs, flows, interface design, responsive previews and safe handoff.' },
    { id:'skin', group:'Interface', title:'Skin Production', short:'Skins', route:'skin', icon:'skin', description:'Complete AXM skins, design slots, readability gates and theme packs.' },
    { id:'pack', group:'Produce', title:'Asset Pack Production', short:'Packs', route:'pack', icon:'pack', description:'Package selected assets into reviewable packs and template shells.' }
  ];

  function now() { return new Date().toISOString(); }
  function byId(id) { return MODES.find(function (m) { return m.id === id; }) || MODES[0]; }
  function baseState() { return { format:FORMAT, mode:'paint', projectName:'Untitled studio project', createdAt:now(), updatedAt:now() }; }
  function normalize(raw) {
    var base = baseState(); raw = raw || {};
    return {
      format: FORMAT,
      mode: byId(raw.mode).id,
      projectName: String(raw.projectName || base.projectName).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 100) || base.projectName,
      createdAt: String(raw.createdAt || base.createdAt).slice(0, 40),
      updatedAt: String(raw.updatedAt || base.updatedAt).slice(0, 40)
    };
  }
  function groups() {
    return MODES.reduce(function (out, mode) {
      var found = out.find(function (g) { return g.name === mode.group; });
      if (!found) { found = { name:mode.group, modes:[] }; out.push(found); }
      found.modes.push(mode); return out;
    }, []);
  }
  function canvasModes() { return MODES.filter(function (m) { return m.route === 'canvas'; }).map(function (m) { return m.id; }); }
  return { FORMAT:FORMAT, MODES:MODES, byId:byId, groups:groups, baseState:baseState, normalize:normalize, canvasModes:canvasModes };
}));
