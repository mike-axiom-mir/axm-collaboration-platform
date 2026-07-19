const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));

const checks = [];
const check = (name, condition) => {
  checks.push({ name, ok: Boolean(condition) });
};

const html = read("site/index.html");
const css = read("site/styles.css");
const workflow = read(".github/workflows/pages.yml");

check("static entry exists", exists("site/index.html"));
check("static stylesheet exists", exists("site/styles.css"));
check("brand mark exists", exists("site/assets/axm-mark.svg"));
check("Jekyll is disabled", exists("site/.nojekyll"));
check("page has one primary heading", (html.match(/<h1\b/gi) || []).length === 1);
check("page declares its local-runtime boundary", /page is only its public doorway/i.test(html));
check("page links to the complete main-branch ZIP", /axm-collaboration-platform\/archive\/refs\/heads\/main\.zip/.test(html));
check("page does not hard-code a module count", !/\b\d+\s+(?:tool\s+)?modules\b/i.test(html));
check("internal navigation targets exist", [...html.matchAll(/href="#([^"]+)"/g)].every(([, id]) => new RegExp(`id=["']${id}["']`).test(html)));
check("responsive rules are present", /@media\s*\(/.test(css));
check("Pages deploys only from main", /branches:\s*\[main\]/.test(workflow));
check("Pages artifact is limited to the static site", /path:\s*site\b/.test(workflow));
check("official Pages actions are used", ["actions/configure-pages@v5", "actions/upload-pages-artifact@v3", "actions/deploy-pages@v4"].every((action) => workflow.includes(action)));

for (const result of checks) {
  console.log(`${result.ok ? "PASS" : "FAIL"} ${result.name}`);
}

const failures = checks.filter((result) => !result.ok);
if (failures.length) {
  console.error(`Public site self-test failed: ${failures.length} check(s).`);
  process.exit(1);
}

console.log(`Public site self-test passed: ${checks.length}/${checks.length}.`);
