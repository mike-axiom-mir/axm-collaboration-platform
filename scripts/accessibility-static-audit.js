#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const toolsRoot = path.join(root, 'tools');

function strip(value) {
  return String(value || '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&[a-z0-9#]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}

function attr(tag, name) {
  const match = String(tag).match(new RegExp('\\s' + name + '\\s*=\\s*(["\'])([\\s\\S]*?)\\1', 'i'));
  return match ? match[2] : null;
}

function finding(severity, code, file, detail) { return { severity, code, file, detail }; }

function auditMarkup(html, relative) {
  const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  const findings = [];
  if (!/<html\b[^>]*\blang\s*=/i.test(markup)) findings.push(finding('ERROR', 'HTML_LANG_MISSING', relative, 'html element has no lang attribute'));
  if (!/<meta\b[^>]*\bname\s*=\s*["']viewport["']/i.test(markup)) findings.push(finding('ERROR', 'VIEWPORT_MISSING', relative, 'responsive viewport meta is absent'));
  for (const match of markup.matchAll(/<img\b[^>]*>/gi)) if (attr(match[0], 'alt') == null) findings.push(finding('ERROR', 'IMAGE_ALT_MISSING', relative, match[0].slice(0, 180)));
  for (const match of markup.matchAll(/<iframe\b[^>]*>/gi)) if (!attr(match[0], 'title')) findings.push(finding('ERROR', 'IFRAME_TITLE_MISSING', relative, match[0].slice(0, 180)));
  for (const match of markup.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)) {
    const tag = '<button' + match[1] + '>', label = attr(tag, 'aria-label') || attr(tag, 'title') || strip(match[2]);
    if (!label) findings.push(finding('ERROR', 'BUTTON_NAME_MISSING', relative, tag.slice(0, 180)));
  }
  const labels = new Set(Array.from(markup.matchAll(/<label\b[^>]*\bfor\s*=\s*(["'])(.*?)\1/gi), match => match[2]));
  const implicitControls = new Set();
  for (const label of markup.matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>/gi)) {
    const controls = Array.from(label[1].matchAll(/<(?:input|select|textarea)\b[^>]*>/gi));
    if (controls.length === 1) {
      const control = controls[0], id = attr(control[0], 'id');
      if (id) labels.add(id);
      implicitControls.add(label.index + label[0].indexOf('>') + 1 + control.index);
    }
  }
  for (const match of markup.matchAll(/<(input|select|textarea)\b[^>]*>/gi)) {
    const tag = match[0], type = String(attr(tag, 'type') || '').toLowerCase();
    if (type === 'hidden' || type === 'button' || type === 'submit') continue;
    const id = attr(tag, 'id'), name = attr(tag, 'aria-label') || attr(tag, 'aria-labelledby') || attr(tag, 'title');
    if (!name && !(id && labels.has(id)) && !implicitControls.has(match.index)) findings.push(finding('ERROR', 'FORM_NAME_MISSING', relative, tag.slice(0, 180)));
  }
  for (const match of markup.matchAll(/<(div|span|section|article|li)\b([^>]*)\bonclick\s*=/gi)) {
    const tag = match[0], role = attr(tag, 'role'), tabIndex = attr(tag, 'tabindex');
    if (!role || tabIndex == null) findings.push(finding('ERROR', 'POINTER_ONLY_INLINE_CONTROL', relative, tag.slice(0, 180)));
  }
  return findings;
}

function auditHtml(file) {
  const relative = path.relative(root, file).split(path.sep).join('/');
  return auditMarkup(fs.readFileSync(file, 'utf8'), relative);
}

function buildReport() {
  const files = fs.readdirSync(toolsRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('_'))
    .map(entry => path.join(toolsRoot, entry.name, 'index.html'))
    .filter(file => fs.existsSync(file))
    .sort((a, b) => a.localeCompare(b));
  const findings = files.flatMap(auditHtml);
  return {
    schema: 'axm.accessibility-static-audit/v1',
    generatedAt: new Date().toISOString(),
    scope: 'direct tools/*/index.html only',
    summary: { files: files.length, definiteFindings: findings.length, filesWithFindings: new Set(findings.map(row => row.file)).size },
    findings,
    notProven: ['rendered contrast ratio', 'computed font size', 'computed target size', 'complete keyboard journey', 'screen-reader usability', 'motion and audio alternatives'],
    truth: { staticAuditOnly: true, visualApproval: false, accessibilityComplianceClaimed: false }
  };
}

function run() {
  const report = buildReport(), outputDir = path.join(root, 'exports');
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'accessibility-static-audit.json'), JSON.stringify(report, null, 2) + '\n');
  console.log('accessibility static audit: ' + report.summary.files + ' files · ' + report.summary.definiteFindings + ' definite finding(s) in ' + report.summary.filesWithFindings + ' file(s)');
  if (report.findings.length) process.exitCode = 1;
  return report;
}

if (require.main === module) run();
module.exports = { auditMarkup, auditHtml, buildReport, run };
