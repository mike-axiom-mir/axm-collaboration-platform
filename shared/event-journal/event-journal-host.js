'use strict';

const fs = require('fs');
const path = require('path');
const Core = require('./event-journal-core');

function read(file) {
  if (!fs.existsSync(file)) return [];
  const text = fs.readFileSync(file, 'utf8');
  if (!text) return [];
  const lines = text.split('\n');
  if (lines[lines.length - 1] !== '') throw new Core.JournalError('INCOMPLETE_JOURNAL_TAIL', 'Journal does not end at a complete record boundary');
  lines.pop();
  const rows = lines.map((line, index) => {
    try { return JSON.parse(line); }
    catch (error) { throw new Core.JournalError('INVALID_JOURNAL_JSON', `Journal line ${index + 1} is invalid JSON: ${error.message}`); }
  });
  Core.verify(rows);
  return rows;
}

function append(file, eventValue) {
  file = path.resolve(file);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const lock = `${file}.lock`;
  let lockFd;
  try { lockFd = fs.openSync(lock, 'wx'); }
  catch (error) { throw new Core.JournalError('JOURNAL_BUSY', `Journal lock could not be acquired: ${error.message}`); }
  try {
    const rows = read(file);
    const previous = rows.length ? rows[rows.length - 1].recordHash : null;
    const next = Core.record(eventValue, rows.length, previous);
    const fd = fs.openSync(file, 'a');
    try { fs.writeFileSync(fd, Core.canonical(next) + '\n'); fs.fsyncSync(fd); }
    finally { fs.closeSync(fd); }
    return next;
  } finally {
    fs.closeSync(lockFd);
    fs.unlinkSync(lock);
  }
}

module.exports = { read, append };
