import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(ROOT, 'styles', 'runtime.css');
const outputPath = path.join(ROOT, 'src', 'app', 'runtime-css.generated.js');

const css = fs.readFileSync(sourcePath, 'utf8');
if (!css.trim()) throw new Error('Cannot generate runtime CSS JavaScript: canonical stylesheet is empty.');

const serialized = JSON.stringify(css).replaceAll('</script>', '<\\/script>');
const output = `/* Generated from styles/runtime.css. Do not hand edit. */\n(function(root){root.AXM_RUNTIME_CSS=${serialized};})(typeof globalThis!=="undefined"?globalThis:window);\n`;

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, output);
console.log(`Generated ${path.relative(ROOT, outputPath)} from ${path.relative(ROOT, sourcePath)} (${Buffer.byteLength(css)} CSS bytes).`);
