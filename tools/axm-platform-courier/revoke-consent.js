#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const file = path.join(root, 'state', 'axm-platform-courier', 'consent.json');
if (fs.existsSync(file)) fs.unlinkSync(file);
console.log('AXM Platform Courier consent revoked.');
