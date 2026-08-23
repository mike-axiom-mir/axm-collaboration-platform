'use strict';

function validNumber(value, name) {
  if (!Number.isFinite(value)) throw new TypeError(name + ' must be finite');
  return String(value);
}

function escapeXml(value) {
  return String(value)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '\ufffd')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function renderCommand(command) {
  if (command.kind === 'rect') {
    const stroke = command.stroke ? ' stroke="' + escapeXml(command.stroke) + '" stroke-width="' + validNumber(command.strokeWidth, 'strokeWidth') + '"' : '';
    return '<rect id="' + escapeXml(command.commandId) + '" x="' + validNumber(command.x, 'x') + '" y="' + validNumber(command.y, 'y') +
      '" width="' + validNumber(command.width, 'width') + '" height="' + validNumber(command.height, 'height') +
      '" rx="' + validNumber(command.radius, 'radius') + '" fill="' + escapeXml(command.fill) + '"' + stroke + '/>';
  }
  if (command.kind === 'line') {
    return '<line id="' + escapeXml(command.commandId) + '" x1="' + validNumber(command.x1, 'x1') + '" y1="' + validNumber(command.y1, 'y1') +
      '" x2="' + validNumber(command.x2, 'x2') + '" y2="' + validNumber(command.y2, 'y2') + '" stroke="' + escapeXml(command.stroke) +
      '" stroke-width="' + validNumber(command.strokeWidth, 'strokeWidth') + '"/>';
  }
  if (command.kind === 'text') {
    return '<text id="' + escapeXml(command.commandId) + '" x="' + validNumber(command.x, 'x') + '" y="' + validNumber(command.y, 'y') +
      '" fill="' + escapeXml(command.fill) + '" font-family="' + escapeXml(command.fontFamily) + '" font-size="' +
      validNumber(command.fontSize, 'fontSize') + '" font-weight="' + validNumber(command.fontWeight, 'fontWeight') +
      '" letter-spacing="' + validNumber(command.letterSpacing, 'letterSpacing') + '">' + escapeXml(command.text) + '</text>';
  }
  throw new TypeError('unsupported display command: ' + command.kind);
}

function renderSvg(displayList, options) {
  options = options || {};
  if (!displayList || displayList.schema !== 'axm.web.display-list/v1') throw new TypeError('display list schema mismatch');
  const title = String(options.title || 'AXM Structure Browser snapshot');
  const description = 'Inert experimental AXM Structure View. Site rendering, navigation, network, and page code are held.';
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + validNumber(displayList.width, 'width') + '" height="' + validNumber(displayList.height, 'height') +
      '" viewBox="0 0 ' + validNumber(displayList.width, 'width') + ' ' + validNumber(displayList.height, 'height') +
      '" role="img" aria-labelledby="axm-title axm-description" data-source-digest="' + escapeXml(displayList.sourceDigest) +
      '" data-display-list-digest="' + escapeXml(displayList.displayListDigest) + '">',
    '<title id="axm-title">' + escapeXml(title) + '</title>',
    '<desc id="axm-description">' + escapeXml(description) + '</desc>',
    '<metadata>renderer=axm-svg-renderer/v1; active-content=false; external-resources=false</metadata>'
  ];
  displayList.commands.forEach(function (command) { lines.push(renderCommand(command)); });
  lines.push('</svg>');
  return lines.join('\n') + '\n';
}

module.exports = { escapeXml, renderCommand, renderSvg };
