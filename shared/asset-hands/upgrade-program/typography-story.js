'use strict';

const U = require('./foundation-utils');

const PARAGRAPH_SCHEMA = 'axm.production-paragraph/v1';
const STORY_SCHEMA = 'axm.multipage-story/v1';

function directionFor(text, declared) {
  if (declared && declared !== 'auto') return declared;
  return /[\u0590-\u08ff]/.test(text) ? 'rtl' : 'ltr';
}

function layoutParagraph(spec) {
  spec = U.clone(spec || {});
  const text = U.text(spec.text, 1000000, 'paragraph text'); const width = U.finite(spec.width, 'paragraph width'); const fontSize = U.finite(spec.font_size, 'font size'); const lineHeight = U.finite(spec.line_height, 'line height');
  U.ensure(width > 0 && fontSize > 0 && lineHeight >= fontSize, 'paragraph dimensions invalid');
  const locale = U.text(spec.locale || 'und', 40, 'paragraph locale'); const direction = directionFor(text, spec.direction || 'auto');
  const segments = typeof Intl.Segmenter === 'function' ? Array.from(new Intl.Segmenter(locale, { granularity: 'word' }).segment(text), (item) => item.segment) : text.split(/(\s+)/);
  const advances = spec.shaping_receipt && Array.isArray(spec.shaping_receipt.cluster_advances) ? spec.shaping_receipt.cluster_advances : null;
  let advanceIndex = 0;
  function measure(segment) {
    if (!advances) return Array.from(segment).length * fontSize * 0.58;
    const count = Array.from(segment).length; let total = 0; for (let index = 0; index < count; index += 1) total += U.finite(advances[advanceIndex++] == null ? fontSize * 0.58 : advances[advanceIndex - 1], 'glyph advance'); return total;
  }
  const lines = []; let current = ''; let currentWidth = 0;
  for (const segment of segments) {
    const segmentWidth = measure(segment);
    if (current && currentWidth + segmentWidth > width) { lines.push({ text: current.trimEnd(), advance: currentWidth }); current = ''; currentWidth = 0; }
    if (segmentWidth > width && !/^\s+$/.test(segment)) {
      for (const character of Array.from(segment)) { const charWidth = advances ? fontSize * 0.58 : measure(character); if (current && currentWidth + charWidth > width) { lines.push({ text: current, advance: currentWidth }); current = ''; currentWidth = 0; } current += character; currentWidth += charWidth; }
    } else { current += segment; currentWidth += segmentWidth; }
  }
  if (current || !lines.length) lines.push({ text: current.trimEnd(), advance: currentWidth });
  const missingGlyphs = U.clone(spec.shaping_receipt && spec.shaping_receipt.missing_glyphs || []);
  const shaperPass = spec.shaping_receipt && spec.shaping_receipt.status === 'PASS' && /harfbuzz/i.test(spec.shaping_receipt.engine || '') && !missingGlyphs.length;
  const subsetPass = spec.subset_receipt && spec.subset_receipt.status === 'PASS' && Array.from(text).every((character) => /\s/.test(character) || spec.subset_receipt.codepoints.includes(character.codePointAt(0)));
  const variableAxes = U.clone(spec.variable_axes || {});
  const result = {
    schema: PARAGRAPH_SCHEMA, version: '1.0.0', id: U.text(spec.id, 100, 'paragraph id'), text, locale, direction, width, font_size: fontSize, line_height: lineHeight, alignment: U.text(spec.alignment || 'start', 20, 'paragraph alignment'),
    lines, height: lines.length * lineHeight, logical_text_digest: U.sha256(text), shaping_receipt_digest: spec.shaping_receipt && spec.shaping_receipt.digest || null, subset_receipt_digest: spec.subset_receipt && spec.subset_receipt.digest || null,
    missing_glyphs: missingGlyphs, variable_axes: variableAxes, text_path: spec.text_path ? U.clone(spec.text_path) : null,
    status: shaperPass && subsetPass && lines.every((line) => line.advance <= width + 1e-6) ? 'PASS' : 'TEST_ONLY',
    warnings: shaperPass ? [] : ['production status requires a digest-bound HarfBuzz shaping receipt'],
  };
  result.digest = U.sha256(result); return result;
}

function textPathSvg(paragraph, pathData, width, height) {
  U.ensure(paragraph && paragraph.schema === PARAGRAPH_SCHEMA, 'production paragraph required');
  pathData = U.text(pathData, 100000, 'text path data');
  const text = paragraph.text.replace(/[<>&]/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[character]));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${U.finite(width, 'text path width')} ${U.finite(height, 'text path height')}"><defs><path id="text-path" d="${pathData.replace(/"/g, '&quot;')}"/></defs><text font-size="${paragraph.font_size}" direction="${paragraph.direction}"><textPath href="#text-path">${text}</textPath></text></svg>`;
}

function createStory(spec) {
  spec = U.clone(spec || {});
  const page = { width: U.finite(spec.page && spec.page.width, 'page width'), height: U.finite(spec.page && spec.page.height, 'page height'), margin_top: U.finite(spec.page && spec.page.margin_top, 'page top margin'), margin_right: U.finite(spec.page && spec.page.margin_right, 'page right margin'), margin_bottom: U.finite(spec.page && spec.page.margin_bottom, 'page bottom margin'), margin_left: U.finite(spec.page && spec.page.margin_left, 'page left margin'), unit: U.text(spec.page && spec.page.unit, 20, 'page unit') };
  U.ensure(page.width > page.margin_left + page.margin_right && page.height > page.margin_top + page.margin_bottom, 'story page margins leave no content area');
  const contentHeight = page.height - page.margin_top - page.margin_bottom;
  const blocks = U.boundedArray(spec.blocks, 1, 100000, 'story blocks').map((block, index) => ({ id: U.text(block.id || 'block-' + index, 100, 'story block id'), kind: U.text(block.kind, 30, 'story block kind'), logical_order: index, height: U.finite(block.height, 'story block height'), content: U.clone(block.content), keep_with_next: block.keep_with_next === true, footnotes: U.clone(block.footnotes || []) }));
  U.ensure(blocks.every((block) => block.height > 0 && block.height <= contentHeight), 'story block exceeds page content height');
  const pages = []; let current = { number: 1, used_height: 0, blocks: [], footnotes: [], master: U.clone(spec.master || {}) };
  function pushPage() { pages.push(current); current = { number: pages.length + 1, used_height: 0, blocks: [], footnotes: [], master: U.clone(spec.master || {}) }; }
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index]; const footnoteHeight = block.footnotes.reduce((sum, item) => sum + U.finite(item.height, 'footnote height'), 0); const nextHeight = block.keep_with_next && blocks[index + 1] ? blocks[index + 1].height : 0;
    if (current.blocks.length && current.used_height + block.height + footnoteHeight + nextHeight > contentHeight) pushPage();
    current.blocks.push(block); current.footnotes.push(...block.footnotes); current.used_height += block.height + footnoteHeight;
  }
  if (current.blocks.length) pushPage();
  const readingOrder = pages.flatMap((item) => item.blocks.map((block) => block.id));
  U.ensure(readingOrder.length === blocks.length && new Set(readingOrder).size === blocks.length, 'story flow lost or duplicated blocks');
  const pageSvgs = pages.map((item) => {
    let y = page.margin_top; const body = item.blocks.map((block) => { const label = String(block.content && block.content.text || block.kind).replace(/[<>&]/g, ''); const svg = `<g data-block="${block.id}"><rect x="${page.margin_left}" y="${y}" width="${page.width - page.margin_left - page.margin_right}" height="${block.height}" fill="none" stroke="#ccd"/><text x="${page.margin_left + 4}" y="${y + 14}">${label}</text></g>`; y += block.height; return svg; }).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${page.width} ${page.height}" role="img" aria-label="Page ${item.number}">${body}<text x="${page.width / 2}" y="${page.height - page.margin_bottom / 2}" text-anchor="middle">${item.number}</text></svg>`;
  });
  let imposition = null;
  if (spec.imposition === 'booklet') {
    const padded = pages.map((item) => item.number); while (padded.length % 4) padded.push(null); const sheets = [];
    for (let index = 0; index < padded.length / 2; index += 2) { const left = padded.length - 1 - index; sheets.push({ front: [padded[left], padded[index]], back: [padded[index + 1], padded[left - 1]] }); }
    imposition = { kind: 'booklet', padded_pages: padded.length, sheets };
  }
  const validator = spec.accessibility_validator_receipt;
  const story = { schema: STORY_SCHEMA, version: '1.0.0', id: U.text(spec.id, 100, 'story id'), page, pages, page_svgs: pageSvgs, reading_order: readingOrder, imposition, structures: { tables: blocks.filter((item) => item.kind === 'table').map((item) => item.id), footnotes: blocks.flatMap((item) => item.footnotes.map((note) => note.id)) }, status: validator && validator.status === 'PASS' ? 'PASS' : validator && validator.status === 'MISSING_SUBSTRATE' ? 'TECHNICAL_PASS_MISSING_EXTERNAL_ACCESSIBILITY_VALIDATOR' : 'TECHNICAL_PASS_EXTERNAL_ACCESSIBILITY_REVIEW_REQUIRED' };
  story.digest = U.sha256(story); return story;
}

module.exports = { PARAGRAPH_SCHEMA, STORY_SCHEMA, layoutParagraph, textPathSvg, createStory };
