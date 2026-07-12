'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const studioDir = path.join(root, 'tools', 'studio');
const html = fs.readFileSync(path.join(studioDir, 'index.html'), 'utf8');
const foundation = fs.readFileSync(path.join(studioDir, 'axm-foundation.js'), 'utf8')
  .replace(/<\/script/gi, '<\\/script');

const bundled = html.replace(
  '<script src="axm-foundation.js"></script>',
  '<script>\n' + foundation + '\n</script>'
);

fs.writeFileSync(path.join(__dirname, 'axm-studio-cloud.html'), bundled);
console.log('built cloud-test/axm-studio-cloud.html (' + bundled.length + ' chars)');
