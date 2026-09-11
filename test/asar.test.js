'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const official = require('@electron/asar');
const ours = require('../src/asar');

test('official ASAR reader accepts replacement and preserves other files and unpacked entries', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'local-zh-asar-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const source = path.join(dir, 'source');
  fs.mkdirSync(source);
  fs.writeFileSync(path.join(source, 'preload.js'), 'old');
  fs.writeFileSync(path.join(source, 'other.txt'), 'untouched');
  fs.writeFileSync(path.join(source, 'native.node'), Buffer.from([0, 255, 3, 4]));
  const input = path.join(dir, 'input.asar');
  await official.createPackageWithOptions(source, input, { unpack: '*.node' });
  const before = fs.readFileSync(input);
  const data = Buffer.from('中文补丁\n'.repeat(100000));
  const after = ours.replace(before, 'preload.js', data);
  const output = path.join(dir, 'output.asar');
  fs.writeFileSync(output, after);
  assert.deepEqual(official.extractFile(output, 'preload.js'), data);
  assert.equal(official.extractFile(output, 'other.txt').toString(), 'untouched');
  const a = ours.parse(before), b = ours.parse(after);
  assert.deepEqual(b.header.files['native.node'], a.header.files['native.node']);
  assert.deepEqual(b.header.files['other.txt'], a.header.files['other.txt']);
  assert.deepEqual(after.subarray(b.start, b.start + before.length - a.start), before.subarray(a.start));
  assert.deepEqual(ours.read(b, 'preload.js'), data);
  assert.throws(() => ours.read(a, 'native.node'), /不支持/);
  const corrupt = Buffer.from(after);
  corrupt[corrupt.length - 1] ^= 1;
  assert.throws(() => ours.read(ours.parse(corrupt), 'preload.js'), /完整性/);
});

test('malformed ASAR headers and out of bounds entries are rejected', () => {
  for (const size of [0, 4, 15, 16, 100]) assert.throws(() => ours.parse(Buffer.alloc(size)));
  const a = { header: { files: { bad: { size: 5, offset: '9007199254740992' } } }, buffer: Buffer.alloc(32), start: 16 };
  assert.throws(() => ours.read(a, 'bad'), /越界/);
  assert.throws(() => ours.read(a, 'missing'), /缺少/);
});
