'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const official = require('@electron/asar');
const asar = require('../src/asar');
const patcher = require('../src/patcher');

async function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'local-zh-life-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const source = path.join(dir, 'source');
  fs.mkdirSync(path.join(source, 'dist'), { recursive: true });
  const preload = Buffer.from('"use strict";\n// Synthetic preload for transaction testing.\n');
  fs.writeFileSync(path.join(source, 'dist', 'preload.js'), preload);
  fs.writeFileSync(path.join(source, 'package.json'), JSON.stringify({ name: 'antigravity', productName: 'Antigravity', version: '2.12.2', main: 'dist/main.js' }));
  const target = path.join(dir, 'app.asar');
  await official.createPackage(source, target);
  const hash = asar.sha256;
  // Only the synthetic preload is admitted by the fixture. Production allowlist stays immutable.
  t.mock.method(asar, 'sha256', data => Buffer.isBuffer(data) && data.equals(preload)
    ? 'f42381a56cc73aee978a1ea966e8b597959af80c98aba32d296740616810cce9' : hash(data));
  return { target, dir, before: fs.readFileSync(target) };
}

const stopped = () => {};

test('install is idempotent and restore is byte-identical, with valid persisted backup', async t => {
  const { target, before, dir } = await fixture(t);
  assert.equal(patcher.change(target, 'install', stopped).changed, true);
  const patched = fs.readFileSync(target);
  assert.notDeepEqual(patched, before);
  assert.equal(patcher.status(target).patched, true);
  assert.equal(patcher.change(target, 'install', stopped).changed, false);
  assert.deepEqual(fs.readFileSync(target), patched);
  assert.equal(fs.readdirSync(path.join(dir, '.antigravity-local-zh')).length, 2);
  assert.equal(patcher.change(target, 'restore', stopped).changed, true);
  assert.deepEqual(fs.readFileSync(target), before);
  assert.equal(patcher.change(target, 'restore', stopped).changed, false);
});

test('corrupt backup and missing records prevent restore without changing the client', async t => {
  const { target, dir } = await fixture(t);
  patcher.change(target, 'install', stopped);
  const before = fs.readFileSync(target);
  const backupDir = path.join(dir, '.antigravity-local-zh');
  const files = fs.readdirSync(backupDir);
  fs.appendFileSync(path.join(backupDir, files.find(name => name.endsWith('.asar'))), 'broken');
  assert.throws(() => patcher.change(target, 'restore', stopped), /SHA-256/);
  assert.deepEqual(fs.readFileSync(target), before);
  fs.unlinkSync(path.join(backupDir, files.find(name => name.endsWith('.json'))));
  assert.throws(() => patcher.change(target, 'restore', stopped));
  assert.deepEqual(fs.readFileSync(target), before);
});

test('unknown preload is rejected before backup creation', async t => {
  const { target, dir, before } = await fixture(t);
  fs.writeFileSync(target, asar.replace(before, 'dist/preload.js', Buffer.from('changed')));
  const changed = fs.readFileSync(target);
  assert.throws(() => patcher.change(target, 'install', stopped), /未审核/);
  assert.equal(fs.existsSync(path.join(dir, '.antigravity-local-zh')), false);
  assert.deepEqual(fs.readFileSync(target), changed);
});

test('process guard and concurrency lock block writes', async t => {
  const { target, dir, before } = await fixture(t);
  assert.throws(() => patcher.change(target, 'install', () => { throw new Error('running'); }), /running/);
  assert.deepEqual(fs.readFileSync(target), before);
  const lock = path.join(dir, '.antigravity-local-zh', 'operation.lock');
  fs.mkdirSync(lock, { recursive: true });
  assert.throws(() => patcher.change(target, 'install', stopped), /操作锁/);
  assert.deepEqual(fs.readFileSync(target), before);
});

test('late process start leaves original intact and cleans temporary file and lock', async t => {
  const { target, dir, before } = await fixture(t);
  let count = 0;
  assert.throws(() => patcher.change(target, 'install', () => { if (++count > 1) throw new Error('running'); }), /running/);
  assert.deepEqual(fs.readFileSync(target), before);
  assert.equal(fs.readdirSync(dir).some(name => name.endsWith('.tmp')), false);
  assert.equal(fs.existsSync(path.join(dir, '.antigravity-local-zh', 'operation.lock')), false);
});

test('upstream change during installation is not overwritten', async t => {
  const { target } = await fixture(t);
  let count = 0;
  assert.throws(() => patcher.change(target, 'install', () => {
    if (++count === 2) fs.writeFileSync(target, 'simulated upstream update');
  }), /发生变化/);
  assert.equal(fs.readFileSync(target, 'utf8'), 'simulated upstream update');
});

test('rename failure never deletes the live archive', async t => {
  const { target, before } = await fixture(t);
  t.mock.method(fs, 'renameSync', () => { throw new Error('EPERM simulated'); });
  assert.throws(() => patcher.change(target, 'install', stopped), /EPERM/);
  assert.deepEqual(fs.readFileSync(target), before);
});

test('real installed ASAR copy: official reader, complete metadata preservation, exact restore', {
  skip: !process.env.AG_TEST_ASAR
}, t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'local-zh-real-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const target = path.join(dir, 'app.asar');
  const before = fs.readFileSync(process.env.AG_TEST_ASAR);
  fs.writeFileSync(target, before);
  patcher.change(target, 'install', stopped);
  const after = fs.readFileSync(target);
  const original = asar.parse(before), patched = asar.parse(after);
  const source = official.extractFile(target, 'dist/preload.js').toString();
  assert.ok(source.includes(patcher.MARKER));
  assert.ok(source.startsWith(asar.read(original, 'dist/preload.js').toString()));
  patched.header.files.dist.files['preload.js'] = original.header.files.dist.files['preload.js'];
  assert.deepEqual(patched.header, original.header);
  assert.deepEqual(after.subarray(patched.start, patched.start + before.length - original.start), before.subarray(original.start));
  patcher.change(target, 'restore', stopped);
  assert.deepEqual(fs.readFileSync(target), before);
  assert.deepEqual(fs.readFileSync(process.env.AG_TEST_ASAR), before);
});
