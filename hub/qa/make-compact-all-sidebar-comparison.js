const sharp = require('sharp');

const qa = 'C:/axm workshop/hub/qa/';
const sourceTop = 'C:/Users/miket/AppData/Local/Temp/codex-clipboard-71fd8777-0d22-4b10-b46a-8b961d7628b7.png';
const sourceBottom = 'C:/Users/miket/AppData/Local/Temp/codex-clipboard-af0787b7-ceba-4b7d-a13a-de7e54af404e.png';
const finalTop = qa + 'compact-all-sidebar-final.png';
const finalBottom = qa + 'compact-all-sidebar-bottom-final.png';

async function panel(input, width, height, extract) {
  let image = sharp(input);
  if (extract) image = image.extract(extract);
  return image.resize(width, height, { fit: 'contain', background: '#07111b' }).png().toBuffer();
}

function label(text) {
  return Buffer.from(
    '<svg width="560" height="28" xmlns="http://www.w3.org/2000/svg">' +
    '<rect width="560" height="28" rx="7" fill="#0d1a27"/>' +
    '<text x="12" y="19" fill="#80e9e1" font-family="Arial" font-size="13" font-weight="700">' +
    text + '</text></svg>'
  );
}

(async () => {
  const sourceTopPanel = await panel(sourceTop, 560, 300);
  const finalTopPanel = await panel(finalTop, 560, 300, { left: 0, top: 55, width: 230, height: 360 });
  const sourceBottomPanel = await panel(sourceBottom, 560, 300);
  const finalBottomPanel = await panel(finalBottom, 560, 300, { left: 0, top: 395, width: 230, height: 325 });

  await sharp({ create: { width: 1180, height: 720, channels: 4, background: '#050a10' } })
    .composite([
      { input: label('SOURCE · fixed navigation rows'), left: 20, top: 16 },
      { input: label('IMPLEMENTED · one compact rail grammar'), left: 600, top: 16 },
      { input: sourceTopPanel, left: 20, top: 52 },
      { input: finalTopPanel, left: 600, top: 52 },
      { input: label('SOURCE · lower layer controls'), left: 20, top: 376 },
      { input: label('IMPLEMENTED · compact controls + bottom collapse'), left: 600, top: 376 },
      { input: sourceBottomPanel, left: 20, top: 412 },
      { input: finalBottomPanel, left: 600, top: 412 },
    ])
    .png()
    .toFile(qa + 'compact-all-sidebar-comparison.png');
})();
