'use strict';

function readJson(req, limit) {
  const max = Number(limit || 1024 * 1024);
  return new Promise(function (resolve, reject) {
    let size = 0;
    const chunks = [];
    req.on('data', function (chunk) {
      size += chunk.length;
      if (size > max) {
        reject(Object.assign(new Error('request body too large'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', function () {
      if (!chunks.length) return resolve({});
      try {
        const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('JSON object required');
        resolve(value);
      } catch (error) {
        reject(Object.assign(new Error('invalid JSON body: ' + error.message), { statusCode: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function requiredString(body, field) {
  const value = String(body && body[field] || '').trim();
  if (!value) throw Object.assign(new Error(field + ' required'), { statusCode: 400 });
  return value;
}

module.exports = { readJson, requiredString };
