'use strict';

const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');

const SCRIPT = path.join(__dirname, 'package-workshop.ps1');
const ROOT = path.resolve(__dirname, '..', '..');
const OUTPUT_DIR = path.join(ROOT, 'exports', 'workshop-packages');
let active = false;

function list() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  return fs.readdirSync(OUTPUT_DIR, { withFileTypes: true })
    .filter(item => item.isFile() && /\.(?:zip|REFUSED\.json)$/i.test(item.name))
    .map(item => {
      const file = path.join(OUTPUT_DIR, item.name);
      const stat = fs.statSync(file);
      let restoreTest = null;
      if (/\.zip$/i.test(item.name)) {
        const reportPath = path.join(OUTPUT_DIR, item.name.replace(/\.zip$/i, '.RESTORE_TEST.json'));
        try {
          const report = JSON.parse(fs.readFileSync(reportPath, 'utf8').replace(/^\uFEFF/, ''));
          restoreTest = report.ok === true ? 'pass' : 'fail';
        } catch (e) { restoreTest = 'untested'; }
      }
      return {
        name: item.name,
        bytes: stat.size,
        modified_at: stat.mtime.toISOString(),
        kind: /\.zip$/i.test(item.name) ? 'package' : 'refusal-report',
        restore_test: restoreTest,
        url: '/exports/workshop-packages/' + encodeURIComponent(item.name)
      };
    })
    .sort((a, b) => b.modified_at.localeCompare(a.modified_at));
}

function create(options) {
  options = options || {};
  const mode = options.mode === 'public' ? 'public' : options.mode === 'full' ? 'full' : null;
  if (!mode) return Promise.reject(new Error('mode must be full or public'));
  if (active) return Promise.reject(new Error('a workshop package is already being built'));
  if (!fs.existsSync(SCRIPT)) return Promise.reject(new Error('packager script missing'));
  active = true;
  return new Promise((resolve, reject) => {
    const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', SCRIPT, '-Mode', mode, '-KeepCopy', options.keep_copy ? 'true' : 'false'];
    const child = childProcess.spawn('powershell.exe', args, { cwd: ROOT, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => { try { child.kill(); } catch (e) {} }, 10 * 60 * 1000);
    child.stdout.on('data', chunk => { stdout += chunk; if (stdout.length > 1024 * 1024) stdout = stdout.slice(-1024 * 1024); });
    child.stderr.on('data', chunk => { stderr += chunk; if (stderr.length > 256 * 1024) stderr = stderr.slice(-256 * 1024); });
    child.once('error', error => { clearTimeout(timer); active = false; reject(error); });
    child.once('exit', code => {
      clearTimeout(timer);
      active = false;
      if (code !== 0) return reject(new Error((stderr || stdout || ('packager exited ' + code)).trim().slice(-4000)));
      const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
      try { resolve(JSON.parse(lines[lines.length - 1] || '{}')); }
      catch (error) { reject(new Error('packager returned invalid result: ' + stdout.slice(-1000))); }
    });
  });
}

module.exports = { create, list, isActive: () => active, outputDir: OUTPUT_DIR };
