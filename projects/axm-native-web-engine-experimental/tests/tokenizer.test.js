'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Tokenizer = require('../src/tokenizer');

test('tokenizer preserves raw text and decodes the declared entity subset', function () {
  const html = '<p title="A &amp; B">A &lt; B &#x1f680;</p>';
  const result = Tokenizer.tokenize(html, { sourceDigest: 'a'.repeat(64) });
  assert.equal(result.schema, 'axm.web.token-stream/v1');
  assert.equal(result.tokens[0].type, 'startTag');
  assert.equal(result.tokens[0].attributes[0].value, 'A & B');
  assert.equal(result.tokens[1].raw, 'A &lt; B &#x1f680;');
  assert.equal(result.tokens[1].data, 'A < B 🚀');
  assert.equal(result.tokens[2].type, 'endTag');
  assert.match(result.tokenDigest, /^[a-f0-9]{64}$/);
});

test('script content is raw text and is never tokenized as executable markup', function () {
  const html = '<script>if (1 < 2) globalThis.BAD = true;</script><p>safe</p>';
  const result = Tokenizer.tokenize(html, { sourceDigest: 'b'.repeat(64) });
  const scriptText = result.tokens.find(function (token) { return token.rawTextContext === 'script'; });
  assert.ok(scriptText);
  assert.equal(scriptText.data, 'if (1 < 2) globalThis.BAD = true;');
  assert.equal(result.tokens.filter(function (token) { return token.type === 'startTag' && token.name === 'p'; }).length, 1);
});

test('raw-text close matching keeps Unicode offsets and requires a tag-name boundary', function () {
  const html = '<script>İ</script-not-a-close><p>still raw</p></ScRiPt><p>safe</p>';
  const result = Tokenizer.tokenize(html, { sourceDigest: 'f'.repeat(64) });
  const scriptText = result.tokens.find(function (token) { return token.rawTextContext === 'script'; });
  assert.ok(scriptText);
  assert.equal(scriptText.data, 'İ</script-not-a-close><p>still raw</p>');
  assert.equal(scriptText.sourceSpan.end, html.indexOf('</ScRiPt>'));
  assert.equal(result.tokens.filter(function (token) { return token.type === 'endTag' && token.name === 'script'; }).length, 1);
  assert.equal(result.tokens.filter(function (token) { return token.type === 'startTag' && token.name === 'p'; }).length, 1);
});

test('duplicate attributes are visible and the first value is retained', function () {
  const result = Tokenizer.tokenize('<p a="first" a="second">x</p>', { sourceDigest: 'c'.repeat(64) });
  assert.equal(result.tokens[0].attributes.length, 1);
  assert.equal(result.tokens[0].attributes[0].value, 'first');
  assert.ok(result.warnings.some(function (warning) { return warning.code === 'DUPLICATE_ATTRIBUTE_IGNORED'; }));
});

test('token and attribute limits fail visibly', function () {
  assert.throws(function () {
    Tokenizer.tokenize('<p>x</p>', { sourceDigest: 'd'.repeat(64), maxTokens: 1 });
  }, function (error) { return error.code === 'TOKEN_COUNT_LIMIT'; });
  assert.throws(function () {
    Tokenizer.tokenize('<p a b>z</p>', { sourceDigest: 'e'.repeat(64), maxAttributes: 1 });
  }, function (error) { return error.code === 'ATTRIBUTE_COUNT_LIMIT'; });
});
