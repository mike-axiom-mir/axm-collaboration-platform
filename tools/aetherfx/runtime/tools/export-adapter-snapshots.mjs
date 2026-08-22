import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const context = vm.createContext({
  console,
  structuredClone,
  TextEncoder,
  crypto: globalThis.crypto,
  setTimeout,
  clearTimeout,
  performance: { now: () => Date.now() }
});
context.globalThis = context;
context.window = context;
for (const rel of [
  'src/core/namespace.js',
  'src/catalog/catalog.generated.js',
  'src/core/registry.js',
  'src/core/validator.js',
  'src/core/composer.js',
  'src/core/intent.js'
]) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), context, { filename: rel });
}

const registry = new context.AXM.ModuleRegistry(context.AXM_DEFAULT_CATALOG);
const composer = new context.AXM.Composer(registry, { render() {} });
const outDir = path.join(ROOT, 'dist', 'adapters');
fs.mkdirSync(outDir, { recursive: true });

for (const file of ['cinematic-glass-stage.axmrecipe.json', 'prismatic-product-card.axmrecipe.json']) {
  const recipe = JSON.parse(fs.readFileSync(path.join(ROOT, 'examples', 'recipes', file), 'utf8'));
  const compiled = composer.compile(recipe);
  if (!compiled.report.valid) throw new Error(JSON.stringify(compiled.report.errors));
  const slug = file.replace('.axmrecipe.json', '');
  const mood = registry.mood(compiled.recipe.globals.mood) || {};
  const intent = context.AXM.Intent.create(compiled, registry, {
    target: 'generic-game-contract',
    generatedAt: '2026-07-28T00:00:00.000Z'
  });
  fs.writeFileSync(path.join(outDir, `${slug}.visual-intent.json`), `${JSON.stringify(intent, null, 2)}\n`);
  fs.writeFileSync(
    path.join(outDir, `${slug}.support.json`),
    `${JSON.stringify(context.AXM.Intent.targetReport(compiled, registry, 'generic-game-contract', { generatedAt: '2026-07-28T00:00:00.000Z' }), null, 2)}\n`
  );

  const css = `/* AXM AetherFX adapter token snapshot — ${compiled.recipe.name} */
:root{
  --axm-accent:${mood.accent};
  --axm-accent-2:${mood.accent2};
  --axm-warm:${mood.warm};
  --axm-bg:${mood.bg};
  --axm-intensity:${compiled.recipe.globals.intensity};
  --axm-depth:${compiled.recipe.globals.depth};
  --axm-motion:${compiled.recipe.globals.motion};
}
`;
  fs.writeFileSync(path.join(outDir, `${slug}.tokens.css`), css);

  const godot = `; AXM AetherFX starter Theme resource approximation
; This carries global tokens only; native operations must map the support report explicitly.
[gd_resource type="Theme" format=3]

[resource]
default_font_size = 16
Color/constants/axm_accent = Color("${mood.accent}")
Color/constants/axm_accent_2 = Color("${mood.accent2}")
Color/constants/axm_background = Color("${mood.bg}")
`;
  fs.writeFileSync(path.join(outDir, `${slug}.godot-theme.tres`), godot);

  const uss = `/* AXM AetherFX Unity UI Toolkit starter approximation.
   Visual operations still require an explicit native material/animation adapter. */
:root{--axm-accent:${mood.accent};--axm-accent-2:${mood.accent2};--axm-bg:${mood.bg};}
.axm-surface{background-color:${mood.bg};border-color:${mood.accent};border-width:1px;border-radius:18px;}
`;
  fs.writeFileSync(path.join(outDir, `${slug}.unity-theme.uss`), uss);
}

console.log('Generated canonical adapter intents and explicit support reports for 2 verified recipes.');
