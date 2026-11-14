'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const { execFileSync } = require('node:child_process');

const NOTES_START = '<!-- antigravity-chinese-release-notes:start -->';
const NOTES_END = '<!-- antigravity-chinese-release-notes:end -->';

const REQUIRED_PORTABLE_FILES = Object.freeze([
  'cli.js',
  'gui.ps1',
  'gui.cmd',
  '一键启动.cmd',
  'install.cmd',
  'restore.cmd',
  '启动汉化工具.exe',
  'package.json',
  'README.md',
  'LICENSE',
  'src/asar.js',
  'src/menu.js',
  'src/patcher.js',
  'src/runtime.js',
  'src/context-monitor.standalone.js',
  'dict/zh-CN.json',
  'gui/window.xaml',
  'assets/icon.ico'
]);

const FORBIDDEN_ARCHIVE_PREFIXES = Object.freeze([
  'node_modules/',
  'dist/',
  '.local/',
  '.git/',
  'test/',
  '.github/'
]);

const SEMVER_RE = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

function readPackageVersion(root) {
  const pkgPath = path.join(root, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const raw = typeof pkg.version === 'string' ? pkg.version.trim() : '';
  if (!raw || !SEMVER_RE.test(raw)) {
    throw new Error(`Missing or invalid version in ${pkgPath}: "${pkg.version}"`);
  }
  return raw;
}

function toWin32AssemblyVersion(version) {
  const clean = typeof version === 'string' ? version.trim() : '';
  if (!clean || !SEMVER_RE.test(clean)) {
    throw new Error(`Invalid semantic version: "${version}"`);
  }
  const core = clean.split(/[-+]/, 1)[0];
  const parts = core.split('.').map(Number);
  if (parts.length !== 3 || parts.some(n => !Number.isInteger(n) || n < 0 || n > 65535)) {
    throw new Error(`Version "${version}" cannot be converted to Win32 4-part assembly version`);
  }
  return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
}

function getSupportedRange(root) {
  const patcher = require(path.join(root, 'src', 'patcher.js'));
  const versions = Array.isArray(patcher.SUPPORTED_VERSIONS) ? patcher.SUPPORTED_VERSIONS : [];
  if (versions.length === 0) {
    throw new Error('src/patcher.js did not export SUPPORTED_VERSIONS');
  }
  return {
    min: versions[0],
    max: versions[versions.length - 1],
    versions
  };
}

function getDictionaryCount(root) {
  const dict = JSON.parse(fs.readFileSync(path.join(root, 'dict', 'zh-CN.json'), 'utf8'));
  return Object.keys(dict).length;
}

function normalizeTag(tag) {
  const clean = typeof tag === 'string' ? tag.trim() : '';
  if (!clean || /\s/.test(clean)) {
    throw new Error(`Invalid release tag: "${tag}"`);
  }
  return clean;
}

function verifyRepoConsistency(root, { expectedVersion, expectedTag } = {}) {
  const version = readPackageVersion(root);
  if (expectedVersion && expectedVersion !== version) {
    throw new Error(`Expected version "${expectedVersion}" does not match package.json "${version}"`);
  }
  if (expectedTag) {
    const cleanTag = normalizeTag(expectedTag);
    const tagVersion = cleanTag.startsWith('v') ? cleanTag.slice(1) : cleanTag;
    if (tagVersion !== version) {
      throw new Error(`Release tag "${cleanTag}" does not match package.json version "${version}"`);
    }
  }

  const range = getSupportedRange(root);
  const helpOut = execFileSync(process.execPath, [path.join(root, 'cli.js'), '--help'], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true
  });
  if (!helpOut.includes(version)) {
    throw new Error(`cli.js --help output missing package version "${version}"`);
  }
  if (!helpOut.includes(`${range.min} ~ ${range.max}`)) {
    throw new Error(`cli.js --help output missing supported client range "${range.min} ~ ${range.max}"`);
  }

  const readmePath = path.join(root, 'README.md');
  const readme = fs.readFileSync(readmePath, 'utf8');
  const expectedAsset = `antigravity-chinese-v${version}-portable.zip`;
  if (!readme.includes(expectedAsset)) {
    throw new Error(`README.md does not reference "${expectedAsset}"`);
  }
  if (!readme.includes(`${range.min} ~ ${range.max}`)) {
    throw new Error(`README.md does not reference supported client range "${range.min} ~ ${range.max}"`);
  }

  const dictCount = getDictionaryCount(root);
  return { version, range, dictCount, expectedAsset };
}

function parseChecksumsFile(bufferOrString) {
  const buf = Buffer.isBuffer(bufferOrString) ? bufferOrString : Buffer.from(bufferOrString, 'utf8');
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    throw new Error('checksums-sha256.txt must be UTF-8 without BOM');
  }
  const text = buf.toString('utf8');
  const map = new Map();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(/^([0-9a-f]{64})  ([^\r\n]+)$/);
    if (!match) {
      throw new Error(`Malformed SHA-256 checksum line: "${rawLine}"`);
    }
    map.set(match[2], match[1]);
  }
  return map;
}

function extractAndVerifyZip(zipPath, destDir) {
  const buf = fs.readFileSync(zipPath);
  const minEocd = Math.max(0, buf.length - 65557);
  let eocdOffset = -1;
  for (let i = buf.length - 22; i >= minEocd; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      const commentLen = buf.readUInt16LE(i + 20);
      if (i + 22 + commentLen === buf.length) {
        eocdOffset = i;
        break;
      }
    }
  }
  if (eocdOffset === -1) {
    throw new Error(`Invalid ZIP archive (missing EOCD): ${zipPath}`);
  }

  const totalEntries = buf.readUInt16LE(eocdOffset + 10);
  const cdOffset = buf.readUInt32LE(eocdOffset + 16);
  if (cdOffset + buf.readUInt32LE(eocdOffset + 12) > eocdOffset) {
    throw new Error(`Corrupt ZIP central directory bounds: ${zipPath}`);
  }

  const resolvedDest = path.resolve(destDir);
  fs.mkdirSync(resolvedDest, { recursive: true });
  const names = [];
  let pos = cdOffset;

  for (let i = 0; i < totalEntries; i++) {
    if (buf.readUInt32LE(pos) !== 0x02014b50) {
      throw new Error(`Corrupt ZIP central directory header at index ${i}`);
    }
    const method = buf.readUInt16LE(pos + 10);
    const expectedCrc = buf.readUInt32LE(pos + 16);
    const compSize = buf.readUInt32LE(pos + 20);
    const uncompSize = buf.readUInt32LE(pos + 24);
    const nameLen = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const commentLen = buf.readUInt16LE(pos + 32);
    const localHeaderOffset = buf.readUInt32LE(pos + 42);
    const entryName = buf.toString('utf8', pos + 46, pos + 46 + nameLen).replace(/\\/g, '/');
    pos += 46 + nameLen + extraLen + commentLen;

    if (entryName.startsWith('/') || /^[A-Za-z]:/.test(entryName) || entryName.split('/').includes('..')) {
      throw new Error(`Unsafe ZIP entry path: ${entryName}`);
    }
    names.push(entryName);

    if (buf.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
      throw new Error(`Corrupt ZIP local file header for "${entryName}"`);
    }
    const localNameLen = buf.readUInt16LE(localHeaderOffset + 26);
    const localExtraLen = buf.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    if (dataStart + compSize > cdOffset) {
      throw new Error(`Out-of-bounds ZIP payload for "${entryName}"`);
    }

    const compressed = buf.subarray(dataStart, dataStart + compSize);
    let raw;
    if (method === 0) raw = Buffer.from(compressed);
    else if (method === 8) raw = zlib.inflateRawSync(compressed);
    else throw new Error(`Unsupported ZIP compression method ${method} for "${entryName}"`);

    if (raw.length !== uncompSize) {
      throw new Error(`Size mismatch for "${entryName}": expected ${uncompSize}, got ${raw.length}`);
    }
    const actualCrc = zlib.crc32(raw) >>> 0;
    if (actualCrc !== expectedCrc) {
      throw new Error(`CRC-32 mismatch for "${entryName}": expected ${expectedCrc.toString(16)}, got ${actualCrc.toString(16)}`);
    }

    const outPath = path.resolve(resolvedDest, entryName);
    if (!outPath.startsWith(resolvedDest + path.sep) && outPath !== resolvedDest) {
      throw new Error(`ZIP path escapes target directory: ${entryName}`);
    }
    if (entryName.endsWith('/')) {
      fs.mkdirSync(outPath, { recursive: true });
    } else {
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, raw);
    }
  }
  return names;
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function verifyArchive({
  zipPath,
  checksumPath,
  expectedVersion,
  expectedRange,
  expectExecutableBinary = true
}) {
  if (!fs.existsSync(zipPath) || !fs.statSync(zipPath).isFile()) {
    throw new Error(`Missing release archive: ${zipPath}`);
  }
  const zipName = path.basename(zipPath);
  const actualSha = sha256File(zipPath);

  if (checksumPath) {
    if (!fs.existsSync(checksumPath)) {
      throw new Error(`Missing checksums file: ${checksumPath}`);
    }
    const checksums = parseChecksumsFile(fs.readFileSync(checksumPath));
    const listedSha = checksums.get(zipName);
    if (!listedSha) {
      throw new Error(`Checksum entry for "${zipName}" not found in ${checksumPath}`);
    }
    if (listedSha !== actualSha) {
      throw new Error(`SHA-256 mismatch for "${zipName}": expected ${listedSha}, got ${actualSha}`);
    }
  }

  const stageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-release-verify-'));
  try {
    const entries = extractAndVerifyZip(zipPath, stageDir);
    for (const prefix of FORBIDDEN_ARCHIVE_PREFIXES) {
      const bad = entries.find(name => name === prefix.slice(0, -1) || name.startsWith(prefix));
      if (bad) {
        throw new Error(`Forbidden entry packaged in release archive: ${bad}`);
      }
    }
    for (const rel of REQUIRED_PORTABLE_FILES) {
      const full = path.join(stageDir, rel);
      if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
        throw new Error(`Missing required file in release archive: ${rel}`);
      }
    }

    const extractedPkg = JSON.parse(fs.readFileSync(path.join(stageDir, 'package.json'), 'utf8'));
    if (extractedPkg.version !== expectedVersion) {
      throw new Error(`Extracted package.json version "${extractedPkg.version}" does not match expected "${expectedVersion}"`);
    }

    const exeBytes = fs.readFileSync(path.join(stageDir, '启动汉化工具.exe'));
    if (expectExecutableBinary && (exeBytes.length < 2 || exeBytes[0] !== 0x4d || exeBytes[1] !== 0x5a)) {
      throw new Error('启动汉化工具.exe in release archive is not a valid PE executable (missing MZ header)');
    }

    const cliOut = execFileSync(process.execPath, [path.join(stageDir, 'cli.js'), '--help'], {
      cwd: stageDir,
      encoding: 'utf8',
      windowsHide: true
    });
    if (!cliOut.includes(expectedVersion)) {
      throw new Error(`Extracted cli.js --help missing version "${expectedVersion}"`);
    }
    if (expectedRange && !cliOut.includes(`${expectedRange.min} ~ ${expectedRange.max}`)) {
      throw new Error(`Extracted cli.js --help missing range "${expectedRange.min} ~ ${expectedRange.max}"`);
    }

    return { zipName, sha256: actualSha, entryCount: entries.length, version: extractedPkg.version };
  } finally {
    fs.rmSync(stageDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
}

function extractChangelogSection(changelogText, version) {
  if (!changelogText || !version) return '';
  const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const lines = changelogText.replace(/\r\n/g, '\n').split('\n');
  const headingRe = new RegExp(`^##\\s+(?:\\[?v?${escaped}\\]?)(?:\\s|$|\\()`);
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (headingRe.test(lines[i])) {
      start = i + 1;
      break;
    }
  }
  if (start === -1) return '';
  let end = lines.length;
  for (let i = start; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join('\n').trim();
}

function buildReleaseNotes({
  version,
  minSupported,
  maxSupported,
  dictCount,
  zipName,
  sha256,
  changelogSection = ''
}) {
  const lines = [
    NOTES_START,
    '> [!IMPORTANT]',
    '> **平台兼容性特别说明（仅支持 Windows，不兼容 macOS / Linux）**  ',
    '> 本套件深度依赖 Windows 启动架构与 Win32 底层接口，**目前仅支持 Windows 10 / 11，完全不兼容 macOS / Linux 系统**。',
    '',
    `### Antigravity 本地汉化与增强套件 v${version}`,
    `- **认证客户端范围**：Antigravity \`${minSupported} ~ ${maxSupported}+\`（微版本自适应兼容）`,
    `- **内置精确词库**：\`${dictCount}\` 条（严格保护 Monaco 编辑器、终端与会话正文）`,
    `- **下载资产**：\`${zipName}\``,
    `- **SHA-256**：\`${sha256}\``,
    ''
  ];

  const section = changelogSection.trim();
  if (section) {
    lines.push('### 版本更新说明', '', section, '');
  }

  lines.push(
    '### 快速使用',
    `下载并解压 \`${zipName}\`，退出 Antigravity 后双击运行 \`启动汉化工具.exe\` 点击「一键启动 Antigravity」即可（需本机 Node.js 22.12+）。`,
    NOTES_END,
    ''
  );
  return lines.join('\n');
}

function upsertMarkerBlock(existingBody, newBlock, startMarker = NOTES_START, endMarker = NOTES_END) {
  const block = String(newBlock || '').trimEnd();
  const existing = String(existingBody || '');
  const sIdx = existing.indexOf(startMarker);
  const eIdx = existing.indexOf(endMarker);
  let next;
  if (sIdx !== -1 && eIdx !== -1 && eIdx >= sIdx) {
    next = existing.slice(0, sIdx) + block + existing.slice(eIdx + endMarker.length);
  } else if (existing.trim()) {
    next = block + '\n\n' + existing.trimStart();
  } else {
    next = block;
  }
  return next.trimEnd() + '\n';
}

function resolveReleaseMeta(root, { eventName = 'workflow_dispatch', refName = '', inputTag = '', prerelease = 'false' } = {}) {
  const pkgVersion = readPackageVersion(root);
  const tag = eventName === 'push'
    ? normalizeTag(refName)
    : normalizeTag((inputTag || '').trim() || `v${pkgVersion}`);
  verifyRepoConsistency(root, { expectedTag: tag });
  const isPrerelease = String(prerelease) === 'true' || tag.includes('-');
  return {
    tag,
    pkg_version: pkgVersion,
    assembly_version: toWin32AssemblyVersion(pkgVersion),
    prerelease: isPrerelease ? 'true' : 'false'
  };
}

function parseCliArgs(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = 'true';
      }
    } else {
      positional.push(token);
    }
  }
  return { cmd: positional[0] || '', flags };
}

if (require.main === module) {
  const { cmd, flags } = parseCliArgs(process.argv.slice(2));
  const root = path.resolve(flags.root || path.join(__dirname, '..'));

  if (cmd === 'verify-repo') {
    const res = verifyRepoConsistency(root, {
      expectedVersion: flags.version,
      expectedTag: flags.tag
    });
    console.log(`OK repo consistency: v${res.version} (Antigravity ${res.range.min} ~ ${res.range.max}, dict=${res.dictCount})`);
  } else if (cmd === 'verify-archive') {
    const version = flags.version || readPackageVersion(root);
    const range = getSupportedRange(root);
    const zipPath = path.resolve(flags.zip || path.join(root, 'dist', `antigravity-chinese-v${version}-portable.zip`));
    const checksumPath = path.resolve(flags.checksum || path.join(root, 'dist', 'checksums-sha256.txt'));
    const res = verifyArchive({
      zipPath,
      checksumPath,
      expectedVersion: version,
      expectedRange: range,
      expectExecutableBinary: flags['skip-exe-check'] !== 'true'
    });
    console.log(`OK archive verified: ${res.zipName} (${res.entryCount} entries, sha256=${res.sha256})`);
  } else if (cmd === 'assembly-version') {
    console.log(toWin32AssemblyVersion(flags.version || readPackageVersion(root)));
  } else if (cmd === 'resolve-meta') {
    const meta = resolveReleaseMeta(root, {
      eventName: flags.event || process.env.EVENT_NAME || 'workflow_dispatch',
      refName: flags.ref || process.env.REF_NAME || '',
      inputTag: flags['input-tag'] ?? process.env.INPUT_TAG ?? '',
      prerelease: flags.prerelease ?? process.env.INPUT_PRERELEASE ?? 'false'
    });
    for (const [k, v] of Object.entries(meta)) {
      console.log(`${k}=${v}`);
    }
  } else if (cmd === 'write-notes') {
    const version = flags.version || readPackageVersion(root);
    const range = getSupportedRange(root);
    const dictCount = getDictionaryCount(root);
    const zipPath = path.resolve(flags.zip || path.join(root, 'dist', `antigravity-chinese-v${version}-portable.zip`));
    const sha256 = flags.sha256 || sha256File(zipPath);
    const changelogPath = path.join(root, 'CHANGELOG.md');
    const changelogText = fs.existsSync(changelogPath) ? fs.readFileSync(changelogPath, 'utf8') : '';
    const changelogSection = extractChangelogSection(changelogText, version);
    const notes = buildReleaseNotes({
      version,
      minSupported: range.min,
      maxSupported: range.max,
      dictCount,
      zipName: path.basename(zipPath),
      sha256,
      changelogSection
    });
    if (!flags.out) throw new Error('--out is required for write-notes');
    fs.writeFileSync(path.resolve(flags.out), notes, 'utf8');
  } else if (cmd === 'upsert-notes') {
    if (!flags.notes || !flags.existing || !flags.out) {
      throw new Error('--notes, --existing, and --out are required for upsert-notes');
    }
    const merged = upsertMarkerBlock(
      fs.readFileSync(path.resolve(flags.existing), 'utf8'),
      fs.readFileSync(path.resolve(flags.notes), 'utf8')
    );
    fs.writeFileSync(path.resolve(flags.out), merged, 'utf8');
  } else {
    console.error('Usage: node scripts/release.js <verify-repo|verify-archive|assembly-version|resolve-meta|write-notes|upsert-notes>');
    process.exitCode = 1;
  }
}

module.exports = {
  NOTES_START,
  NOTES_END,
  REQUIRED_PORTABLE_FILES,
  FORBIDDEN_ARCHIVE_PREFIXES,
  readPackageVersion,
  toWin32AssemblyVersion,
  getSupportedRange,
  getDictionaryCount,
  verifyRepoConsistency,
  parseChecksumsFile,
  extractAndVerifyZip,
  verifyArchive,
  extractChangelogSection,
  buildReleaseNotes,
  upsertMarkerBlock,
  resolveReleaseMeta
};
