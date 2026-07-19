'use strict';

const fs = require('fs');
const path = require('path');

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

check(/cd \/d "%~dp0"/i.test(launcher), 'launcher anchors itself to the extracted Workshop folder');
check(/runtime\\node\\node\.exe/i.test(launcher), 'launcher supports a bundled portable Node runtime');
check(/where node/i.test(launcher), 'launcher falls back to an installed Node runtime');
check(/if not exist "server\.js" goto :needs_extract/i.test(launcher), 'launcher detects being opened without the extracted Workshop');
check(/server\.js --open=hub/i.test(launcher), 'launcher starts the Hub route');
check(/call "%~dp0OPEN_AXM_WORKSHOP\.cmd"/i.test(compatibility), 'legacy Run AXM All name reaches the beginner front door');
check(/GitHub.+shows its code/is.test(readme), 'README explains GitHub source preview behavior');
check(/Extract All/is.test(readme) && /OPEN_AXM_WORKSHOP\.cmd/is.test(readme), 'README gives extract-then-open instructions');
check(/Do not run the launcher from inside the ZIP/is.test(startHere), 'plain-text start card protects against in-ZIP launch');
check(/spawn\((['"])explorer\.exe\1,\s*\[url\]/.test(server), 'Windows browser opening avoids shell-built URL commands');

if (failures) {
  console.error(`Beginner launch self-test failed: ${failures}`);
  process.exit(1);
}

console.log('Beginner launch self-test passed.');
