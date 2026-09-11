'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { Script } = require('node:vm');
const asar = require('./asar');
const runtime = require('./runtime');
const dictionary = require('../dict/zh-CN.json');
const MARKER = 'ANTIGRAVITY_LOCAL_ZH_V1';
const PRELOAD = 'dist/preload.js';
const SUPPORTED = { '2.12.2': 'f42381a56cc73aee978a1ea966e8b597959af80c98aba32d296740616810cce9' };

function locate(custom) {
  if (process.platform !== 'win32') throw new Error('首版只支持 Windows');
  const candidates = custom ? [path.resolve(custom)] : [
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'antigravity'),
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'antigravity')
  ];
  for (let candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    if (fs.statSync(candidate).isDirectory()) candidate = path.join(candidate, 'resources', 'app.asar');
    if (!fs.existsSync(candidate)) continue;
    if (fs.lstatSync(candidate).isSymbolicLink() || !fs.statSync(candidate).isFile()) {
      throw new Error('拒绝链接或非普通文件');
    }
    return fs.realpathSync(candidate);
  }
  throw new Error('未找到 Antigravity；可使用 --path 指定安装目录或 app.asar 文件');
}

function assertStopped() {
  // execFileSync uses argument arrays, never shell-built commands. Detection errors fail closed.
  const output = execFileSync(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tasklist.exe'),
    ['/FI', 'IMAGENAME eq Antigravity.exe', '/FO', 'CSV', '/NH'], { encoding: 'utf8', windowsHide: true });
  if (/"Antigravity\.exe"/i.test(output)) throw new Error('请保存工作并手动退出 Antigravity 后重试');
}

function inspect(buffer) {
  const archive = asar.parse(buffer);
  const pkg = JSON.parse(asar.read(archive, 'package.json').toString('utf8'));
  if (pkg.name !== 'antigravity' || pkg.productName !== 'Antigravity' || pkg.main !== 'dist/main.js') {
    throw new Error('目标不是支持的 Antigravity 桌面客户端');
  }
  const preload = asar.read(archive, PRELOAD);
  const source = preload.toString('utf8');
  return { version: pkg.version, hash: asar.sha256(buffer),
    patched: source.includes(MARKER),
    supported: SUPPORTED[pkg.version] === asar.sha256(preload) };
}

function build(buffer) {
  const info = inspect(buffer);
  if (info.patched) throw new Error('目标已包含本工具补丁');
  if (!info.supported) throw new Error(`未审核的客户端版本或 preload 已修改 (${info.version})，拒绝写入`);
  for (const [key, value] of Object.entries(dictionary)) {
    if (!key.trim() || key !== key.trim() || typeof value !== 'string' || !value.trim()) {
      throw new Error('词库包含无效条目');
    }
  }
  const before = asar.read(asar.parse(buffer), PRELOAD);
  const addition = `\n;/* ${MARKER} */\ntry { (${runtime.toString()})(window, ${JSON.stringify(dictionary)}); } catch (error) { console.error('[local-zh]', error); }\n`;
  const after = Buffer.concat([before, Buffer.from(addition)]);
  new Script(after.toString('utf8'), { filename: PRELOAD });
  const output = asar.replace(buffer, PRELOAD, after);
  if (!asar.read(asar.parse(output), PRELOAD).equals(after)) throw new Error('输出校验失败');
  return output;
}

function regular(file) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`拒绝非普通文件: ${file}`);
  return stat;
}

function backupDir(target, create = false) {
  const dir = path.join(path.dirname(target), '.antigravity-local-zh');
  if (create && !fs.existsSync(dir)) fs.mkdirSync(dir);
  if (fs.existsSync(dir)) {
    const stat = fs.lstatSync(dir);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('备份目录不能是链接或普通文件');
  }
  return dir;
}

function readBackup(dir, info) {
  const recordPath = path.join(dir, `${info.hash}.json`);
  regular(recordPath);
  const record = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
  if (record.schema !== 1 || record.patched !== info.hash || !/^[a-f0-9]{64}$/.test(record.original)) {
    throw new Error('备份记录不匹配');
  }
  const backup = path.join(dir, `${record.original}.asar`);
  regular(backup);
  const bytes = fs.readFileSync(backup);
  if (asar.sha256(bytes) !== record.original) throw new Error('备份 SHA-256 校验失败');
  const original = inspect(bytes);
  if (original.patched || !original.supported || original.version !== info.version) throw new Error('备份版本不匹配');
  return bytes;
}

function writeExclusive(file, data, mode) {
  const fd = fs.openSync(file, 'wx', mode);
  try { fs.writeFileSync(fd, data); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}

function keepBackup(file, data) {
  if (fs.existsSync(file)) {
    regular(file);
    if (!fs.readFileSync(file).equals(data)) throw new Error(`现有备份内容冲突: ${file}`);
  } else writeExclusive(file, data);
}

function swap(target, before, after, guard) {
  const mode = regular(target).mode;
  const temporary = path.join(path.dirname(target), `.local-zh-${randomUUID()}.tmp`);
  try {
    writeExclusive(temporary, after, mode);
    if (!fs.readFileSync(temporary).equals(after)) throw new Error('临时文件写入校验失败');
    guard();
    regular(target);
    if (!fs.readFileSync(target).equals(before)) throw new Error('目标在操作期间发生变化，拒绝覆盖');
    // Rename over the destination; never delete the live archive first.
    fs.renameSync(temporary, target);
    if (!fs.readFileSync(target).equals(after)) throw new Error('替换后校验失败；请保留备份目录进行恢复');
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

function status(target) {
  regular(target);
  const info = inspect(fs.readFileSync(target));
  if (info.patched) readBackup(backupDir(target), info);
  return { ...info, state: info.patched ? '已汉化，恢复备份有效' : info.supported ? '未汉化，可安装' : '未知版本或已修改，拒绝安装' };
}

function change(target, action, guard = assertStopped) {
  if (!['install', 'restore'].includes(action)) throw new Error('未知操作');
  guard();
  regular(target);
  const before = fs.readFileSync(target);
  const info = inspect(before);
  // Prepare and validate before creating any files beside the application.
  if (action === 'restore' && !info.patched) return { changed: false, state: '没有本工具补丁，无需恢复' };
  if (action === 'install' && info.patched) {
    readBackup(backupDir(target), info);
    return { changed: false, state: '已安装；更新本工具请先恢复再安装' };
  }
  const after = action === 'install' ? build(before) : readBackup(backupDir(target), info);
  const dir = backupDir(target, true);
  const lock = path.join(dir, 'operation.lock');
  try { fs.mkdirSync(lock); } catch (error) {
    if (error.code === 'EEXIST') throw new Error('存在操作锁；请确认没有另一安装进程，异常退出后参阅 README 恢复');
    throw error;
  }
  try {
    if (action === 'install') {
      keepBackup(path.join(dir, `${info.hash}.asar`), before);
      const hash = asar.sha256(after);
      const record = Buffer.from(JSON.stringify({ schema: 1, original: info.hash, patched: hash,
        version: info.version, toolVersion: '0.1.0' }, null, 2) + '\n');
      keepBackup(path.join(dir, `${hash}.json`), record);
      readBackup(dir, { ...info, hash });
    }
    swap(target, before, after, guard);
    return { changed: true, state: action === 'install' ? '已安装本地汉化补丁' : '已逐字节恢复安装前资源包',
      sha256: asar.sha256(after) };
  } finally { fs.rmdirSync(lock); }
}

module.exports = { locate, assertStopped, inspect, build, status, change, MARKER };
