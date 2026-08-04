import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(ROOT, 'catalog', 'default-catalog.json');
const outputPath = path.join(ROOT, 'src', 'catalog', 'catalog.generated.js');

const sourceText = fs.readFileSync(sourcePath, 'utf8');
let catalog;
try {
  catalog = JSON.parse(sourceText);
} catch (error) {
  throw new Error(`Cannot generate catalog JavaScript: ${sourcePath} is not valid JSON. ${error.message}`);
}

if (!catalog || catalog.schema !== 'axm.visual-catalog/1' || !Array.isArray(catalog.modules)) {
  throw new Error('Cannot generate catalog JavaScript: canonical catalog has an unexpected shape.');
}

const serialized = JSON.stringify(catalog).replaceAll('</script>', '<\\/script>');
const output = `/* Generated from catalog/default-catalog.json. Do not hand edit. */\n(function(root,factory){const value=factory();if(typeof module!=="undefined"&&module.exports){module.exports=value;}else{root.AXM_DEFAULT_CATALOG=value;}})(typeof globalThis!=="undefined"?globalThis:this,function(){return ${serialized};});\n`;

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, output);
console.log(`Generated ${path.relative(ROOT, outputPath)} from ${path.relative(ROOT, sourcePath)} (${catalog.modules.length} modules).`);
