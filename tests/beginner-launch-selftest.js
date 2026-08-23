'use strict';

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const root = path.resolve(__dirname, '..');
let failures = 0;

function check(condition, label) {
  if (condition) console.log('PASS  ' + label);
  else {
    failures += 1;
    console.error('FAIL  ' + label);
  }
}

function read(name) {
  return fs.readFileSync(path.join(root, name), 'utf8');
}

const launcher = read('OPEN_AXM_WORKSHOP.cmd');
const compatibility = read('RUN_AXM_ALL.bat');
const readme = read('README.md');
const startHere = read('START_HERE.txt');
const server = read('server.js');
const bootstrap = read('scripts/bootstrap-windows-runtime.ps1');
const cleanLaunch = read('tests/windows-clean-launch-smoke.ps1');
const optionalVips = read('shared/asset-hands/optional-wasm-vips.js');
const jspdfLoader = read('shared/asset-hands/load-jspdf.js');
const optionalModule = read('shared/asset-hands/optional-node-module.js');
const candidateStager = read('scripts/stage-public-candidate.js');
const offlineVerifier = read('scripts/verify-offline-runtime.ps1');
const safeLauncher = read('OPEN_AXM_SAFE_MODE.cmd');
const offlineProof = read('PROVE_AXM_OFFLINE.cmd');
const gitAttributes = read('.gitattributes');

function availablePowerShell() {
  const candidates = process.platform === 'win32' ? ['powershell.exe', 'pwsh.exe'] : ['pwsh', 'powershell'];
  for (const executable of candidates) {
    const probe = childProcess.spawnSync(executable, ['-NoProfile', '-NonInteractive', '-Command', '$PSVersionTable.PSVersion.Major'], { encoding:'utf8', windowsHide:true });
    if (!probe.error && probe.status === 0) return executable;
  }
  return null;
}

check(/cd \/d "%~dp0"/i.test(launcher), 'launcher anchors itself to the extracted Workshop folder');
check(/runtime\\node\\node\.exe/i.test(launcher), 'launcher supports a bundled portable Node runtime');
check(/where node/i.test(launcher), 'launcher falls back to an installed Node runtime');
check(/bootstrap-windows-runtime\.ps1/i.test(launcher), 'launcher can bootstrap a private runtime when Node is absent');
check(/nodejs\.org/i.test(launcher) && /SHA-256/i.test(launcher), 'launcher discloses the first-run download and verification boundary');
check(/AXM_START_REPORT\.txt/i.test(launcher), 'launcher writes a plain-language failure report');
check(/if not exist "server\.js" goto :needs_extract/i.test(launcher), 'launcher detects being opened without the extracted Workshop');
check(/set "AXM_OPEN_TARGET=hub"/i.test(launcher) && /server\.js --open=%AXM_OPEN_TARGET%/i.test(launcher), 'normal launcher starts the Hub route through a confined target');
check(/AXM_OFFLINE_FIRST\.json/i.test(launcher) && /verify-offline-runtime\.ps1/i.test(launcher), 'offline candidate verifies its bundled runtime before launch');
check(/will not download or use a system runtime/i.test(launcher), 'offline candidate refuses download and system-runtime fallback');
check(/AXM_SAFE_MODE=1/i.test(safeLauncher) && /OPEN_AXM_WORKSHOP\.cmd/i.test(safeLauncher), 'safe-mode launcher reaches the verified front door with safe mode enabled');
check(/prove-windows-offline\.ps1/i.test(offlineProof), 'offline candidate exposes one-click local lifecycle proof');
check(/Get-FileHash/.test(offlineVerifier) && /RUNTIME_UNDECLARED_FILE/.test(offlineVerifier), 'offline verifier hashes declared runtime files and refuses additions');
check(/call "%~dp0OPEN_AXM_WORKSHOP\.cmd"/i.test(compatibility), 'legacy Run AXM All name reaches the beginner front door');
check(/GitHub.+shows its code/is.test(readme), 'README explains GitHub source preview behavior');
check(/Extract All/is.test(readme) && /OPEN_AXM_WORKSHOP\.cmd/is.test(readme), 'README gives extract-then-open instructions');
check(/Do not run[\s\S]*?launcher from[\s\S]*?inside the ZIP/i.test(startHere), 'plain-text start card protects against in-ZIP launch');
check(/No\s+administrator permission/i.test(readme) && /first bootstrap needs an internet connection/i.test(readme), 'README states the no-admin and first-run network boundary');
check(/24\.17\.0/.test(bootstrap) && /f2aa33b35b75aca5f3f7b85675a6f6423201053e9381911e64961f3bda2528ab/.test(bootstrap), 'bootstrap pins the Windows x64 Node.js archive and SHA-256');
check(/4957712f67fce55779cc794d9b4df9e0e802a18c841ad5a4e42f17be490e634d/.test(bootstrap), 'bootstrap pins the Windows ARM64 Node.js archive and SHA-256');
check(/System\.Security\.Cryptography\.SHA256/.test(bootstrap) && !/Get-FileHash/.test(bootstrap), 'bootstrap verifies SHA-256 without ambient PowerShell module auto-loading');
check(/Get-Command node\.exe/.test(cleanLaunch) && /api\/health/.test(cleanLaunch) && /AXM Public Candidate With Spaces/.test(cleanLaunch), 'clean-launch proof removes system Node, uses a spaced path, and polls real health');
check(/MODULE_NOT_FOUND/.test(optionalVips) && /return null/.test(optionalVips), 'optional raster runtime cannot crash the dependency-free core Hub');
check(/vendor\/jspdf\/jspdf\.umd\.min\.js/.test(jspdfLoader), 'dependency-free core can use the reviewed vendored jsPDF runtime');
check(/allowedMissingPackages/.test(optionalModule) && /MODULE_NOT_FOUND/.test(optionalModule), 'advanced package gaps remain bounded optional modules during core startup');
check(/Planner\.collectFiles/.test(candidateStager) && /destination already exists/.test(candidateStager), 'clean-launch proof stages the same public-policy inventory into a separate empty candidate');
check(/spawn\((['"])explorer\.exe\1,\s*\[url\]/.test(server), 'Windows browser opening avoids shell-built URL commands');
check(/shared\/cognitive-resource\/contracts\/\*\.json\s+text\s+eol=lf/.test(gitAttributes), 'digest-bound cognitive contracts stay LF-stable after a Windows Git checkout');

const powerShell = availablePowerShell();
for (const relative of ['scripts/bootstrap-windows-runtime.ps1', 'tests/windows-clean-launch-smoke.ps1']) {
  if (!powerShell) {
    console.log('SKIP  ' + relative + ' parse check needs a PowerShell runtime; the Windows clean-launch job remains authoritative');
    continue;
  }
  const absolute = path.join(root, relative).replace(/'/g, "''");
  const command = "$errors=$null;[void][System.Management.Automation.Language.Parser]::ParseFile('" + absolute + "',[ref]$null,[ref]$errors);if($errors.Count){$errors|ForEach-Object{$_.Message};exit 1}";
  const parsed = childProcess.spawnSync(powerShell, ['-NoProfile', '-NonInteractive', '-Command', command], { encoding:'utf8', windowsHide:true });
  check(parsed.status === 0, relative + ' parses as PowerShell');
}

if (failures) {
  console.error(`Beginner launch self-test failed: ${failures}`);
  process.exit(1);
}

console.log('Beginner launch self-test passed.');
