'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const { execFileSync } = require('node:child_process');

const release = require('../scripts/release');
const patcher = require('../src/patcher');

const ROOT = path.resolve(__dirname, '..');

function makeTempDir(t, prefix = 'ag-rel-test-') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }));
  return dir;
}

function createZipBuffer(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const { name, data, deflate = false } of entries) {
    const raw = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = zlib.crc32(raw) >>> 0;
    const payload = deflate ? zlib.deflateRawSync(raw) : raw;
    const method = deflate ? 8 : 0;

    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(0x04034b50, 0);
    lfh.writeUInt16LE(20, 4);
    lfh.writeUInt16LE(0, 6);
    lfh.writeUInt16LE(method, 8);
    lfh.writeUInt32LE(crc, 14);
    lfh.writeUInt32LE(payload.length, 18);
    lfh.writeUInt32LE(raw.length, 22);
    lfh.writeUInt16LE(nameBuf.length, 26);

    const cdh = Buffer.alloc(46);
    cdh.writeUInt32LE(0x02014b50, 0);
    cdh.writeUInt16LE(20, 4);
    cdh.writeUInt16LE(20, 6);
    cdh.writeUInt16LE(method, 10);
    cdh.writeUInt32LE(crc, 16);
    cdh.writeUInt32LE(payload.length, 20);
    cdh.writeUInt32LE(raw.length, 24);
    cdh.writeUInt16LE(nameBuf.length, 28);
    cdh.writeUInt32LE(offset, 42);

    localParts.push(lfh, nameBuf, payload);
    centralParts.push(cdh, nameBuf);
    offset += lfh.length + nameBuf.length + payload.length;
  }

  const centralDir = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);

  return Buffer.concat([...localParts, centralDir, eocd]);
}

function buildValidPortableEntries({ version = release.readPackageVersion(ROOT), exeBytes = Buffer.from('MZfake-pe'), extra = [] } = {}) {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  pkg.version = version;

  const map = new Map();
  for (const rel of release.REQUIRED_PORTABLE_FILES) {
    if (rel === 'package.json') {
      map.set(rel, { name: rel, data: JSON.stringify(pkg, null, 2), deflate: true });
    } else if (rel === '启动汉化工具.exe') {
      map.set(rel, { name: rel, data: exeBytes, deflate: false });
    } else {
      map.set(rel, { name: rel, data: fs.readFileSync(path.join(ROOT, rel)), deflate: true });
    }
  }
  for (const item of extra) {
    map.set(item.name, item);
  }
  return Array.from(map.values());
}

function findGitBashBinary() {
  const candidates = [
    process.env.GIT_BASH_PATH,
    'C:\\Program Files\\Git\\bin\\bash.exe',
    'C:\\Program Files\\Git\\usr\\bin\\bash.exe'
  ].filter(Boolean);
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function toPosixPath(winPath) {
  const norm = path.resolve(winPath).replace(/\\/g, '/');
  const m = norm.match(/^([A-Za-z]):\/(.*)$/);
  return m ? `/${m[1].toLowerCase()}/${m[2]}` : norm;
}

function extractWorkflowBashSteps(yamlText) {
  const lines = yamlText.replace(/\r\n/g, '\n').split('\n');
  const steps = [];
  for (let i = 0; i < lines.length; i++) {
    const nameMatch = lines[i].match(/^\s*-\s+name:\s*(.+?)\s*$/);
    if (!nameMatch) continue;
    const stepName = nameMatch[1];
    let shell = '';
    let runStart = -1;
    let runIndent = 0;
    let j = i + 1;
    while (j < lines.length && !/^\s*-\s+name:\s*/.test(lines[j])) {
      const shMatch = lines[j].match(/^\s+shell:\s*(\S+)/);
      if (shMatch) shell = shMatch[1];
      const runMatch = lines[j].match(/^(\s+)run:\s*\|\s*$/);
      if (runMatch) {
        runStart = j + 1;
        runIndent = runMatch[1].length + 2;
        break;
      }
      j++;
    }
    if (shell === 'bash' && runStart !== -1) {
      const block = [];
      for (let k = runStart; k < lines.length; k++) {
        const line = lines[k];
        if (line.trim() === '') {
          block.push('');
          continue;
        }
        const indent = line.match(/^\s*/)[0].length;
        if (indent < runIndent) break;
        block.push(line.slice(runIndent));
      }
      steps.push({ name: stepName, script: block.join('\n').trimEnd() });
    }
  }
  return steps;
}

test('toWin32AssemblyVersion 正确转换标准与预发布版本号并拒绝非法格式', () => {
  assert.equal(release.toWin32AssemblyVersion('1.0.13'), '1.0.13.0');
  assert.equal(release.toWin32AssemblyVersion('2.4.9-rc.1+build.42'), '2.4.9.0');
  assert.throws(() => release.toWin32AssemblyVersion('abc'), /Invalid semantic version/);
  assert.throws(() => release.toWin32AssemblyVersion('1.2'), /Invalid semantic version/);
  assert.throws(() => release.toWin32AssemblyVersion('1.2.3.4'), /Invalid semantic version/);
  assert.throws(() => release.toWin32AssemblyVersion('70000.0.0'), /Win32 4-part assembly version/);
});

test('repo 版本一致性、CLI 帮助输出与 XAML 占位文案互认无漂移', () => {
  const res = release.verifyRepoConsistency(ROOT);
  assert.equal(res.version, release.readPackageVersion(ROOT));
  assert.equal(res.range.min, patcher.SUPPORTED_VERSIONS[0]);
  assert.equal(res.range.max, patcher.SUPPORTED_VERSIONS[patcher.SUPPORTED_VERSIONS.length - 1]);

  const helpOut = execFileSync(process.execPath, [path.join(ROOT, 'cli.js'), '--help'], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true
  });
  assert.match(helpOut, new RegExp(res.version.replace(/\./g, '\\.')));
  assert.match(helpOut, new RegExp(`${res.range.min.replace(/\./g, '\\.')} ~ ${res.range.max.replace(/\./g, '\\.')}`));

  const xaml = fs.readFileSync(path.join(ROOT, 'gui', 'window.xaml'), 'utf8');
  assert.doesNotMatch(xaml, /支持版本\s+2\.12\.2/);

  assert.throws(
    () => release.verifyRepoConsistency(ROOT, { expectedTag: 'v9.9.9' }),
    /does not match package\.json/
  );
});

test('verifyArchive 对合法归档解包运行 cli.js --help 并通过校验', t => {
  const tmp = makeTempDir(t, 'ag-zip-ok-');
  const version = release.readPackageVersion(ROOT);
  const range = release.getSupportedRange(ROOT);
  const zipName = `antigravity-chinese-v${version}-portable.zip`;
  const zipPath = path.join(tmp, zipName);
  const checksumPath = path.join(tmp, 'checksums-sha256.txt');

  const zipBuf = createZipBuffer(buildValidPortableEntries({ version }));
  fs.writeFileSync(zipPath, zipBuf);
  const sha = crypto.createHash('sha256').update(zipBuf).digest('hex');
  fs.writeFileSync(checksumPath, `${sha}  ${zipName}\n`, 'utf8');

  const verified = release.verifyArchive({
    zipPath,
    checksumPath,
    expectedVersion: version,
    expectedRange: range
  });
  assert.equal(verified.zipName, zipName);
  assert.equal(verified.sha256, sha);
  assert.equal(verified.version, version);
  assert.equal(verified.entryCount, release.REQUIRED_PORTABLE_FILES.length);
});

test('verifyArchive 与 parseChecksumsFile 拒绝 BOM、校验不匹配、缺文件、目录泄漏与非法 EXE', t => {
  const version = release.readPackageVersion(ROOT);
  const range = release.getSupportedRange(ROOT);
  const zipName = `antigravity-chinese-v${version}-portable.zip`;

  // 1. UTF-8 BOM
  assert.throws(
    () => release.parseChecksumsFile(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('a'.repeat(64) + '  x.zip\n')])),
    /UTF-8 without BOM/
  );

  // 2. Hash mismatch
  {
    const tmp = makeTempDir(t, 'ag-zip-hash-');
    const zipPath = path.join(tmp, zipName);
    const checksumPath = path.join(tmp, 'checksums-sha256.txt');
    fs.writeFileSync(zipPath, createZipBuffer(buildValidPortableEntries({ version })));
    fs.writeFileSync(checksumPath, `${'0'.repeat(64)}  ${zipName}\n`, 'utf8');
    assert.throws(
      () => release.verifyArchive({ zipPath, checksumPath, expectedVersion: version, expectedRange: range }),
      /SHA-256 mismatch/
    );
  }

  // 3. Missing required file
  {
    const tmp = makeTempDir(t, 'ag-zip-missing-');
    const zipPath = path.join(tmp, zipName);
    const entries = buildValidPortableEntries({ version }).filter(e => e.name !== 'dict/zh-CN.json');
    fs.writeFileSync(zipPath, createZipBuffer(entries));
    assert.throws(
      () => release.verifyArchive({ zipPath, expectedVersion: version, expectedRange: range }),
      /Missing required file.*dict\/zh-CN\.json/
    );
  }

  // 4. Forbidden leaked entries
  for (const leaked of ['node_modules/evil/index.js', 'dist/old.zip', 'test/secret.js', '.local/token.json']) {
    const tmp = makeTempDir(t, 'ag-zip-leak-');
    const zipPath = path.join(tmp, zipName);
    const entries = buildValidPortableEntries({
      version,
      extra: [{ name: leaked, data: 'leak', deflate: false }]
    });
    fs.writeFileSync(zipPath, createZipBuffer(entries));
    assert.throws(
      () => release.verifyArchive({ zipPath, expectedVersion: version, expectedRange: range }),
      /Forbidden entry packaged/
    );
  }

  // 5. Invalid PE header on EXE
  {
    const tmp = makeTempDir(t, 'ag-zip-pe-');
    const zipPath = path.join(tmp, zipName);
    fs.writeFileSync(zipPath, createZipBuffer(buildValidPortableEntries({ version, exeBytes: Buffer.from('NOT_PE') })));
    assert.throws(
      () => release.verifyArchive({ zipPath, expectedVersion: version, expectedRange: range }),
      /not a valid PE executable/
    );
  }

  // 6. Version drift inside archive
  {
    const tmp = makeTempDir(t, 'ag-zip-ver-');
    const zipPath = path.join(tmp, zipName);
    fs.writeFileSync(zipPath, createZipBuffer(buildValidPortableEntries({ version: '9.9.9' })));
    assert.throws(
      () => release.verifyArchive({ zipPath, expectedVersion: version, expectedRange: range }),
      /does not match expected/
    );
  }
});

test('CHANGELOG 提取、Windows 仅限声明与 marker 区块幂等更新安全可靠', () => {
  const version = release.readPackageVersion(ROOT);
  const changelog = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');
  const section = release.extractChangelogSection(changelog, version);
  assert.ok(section.length > 20, '当前版本应在 CHANGELOG.md 中存在非空段落');
  assert.doesNotMatch(section, /##\s+v1\.0\.12/);

  const notes = release.buildReleaseNotes({
    version,
    minSupported: patcher.SUPPORTED_VERSIONS[0],
    maxSupported: patcher.SUPPORTED_VERSIONS[patcher.SUPPORTED_VERSIONS.length - 1],
    dictCount: release.getDictionaryCount(ROOT),
    zipName: `antigravity-chinese-v${version}-portable.zip`,
    sha256: 'a'.repeat(64),
    changelogSection: section
  });
  assert.match(notes, /仅支持 Windows 10 \/ 11，完全不兼容 macOS \/ Linux/);
  assert.ok(notes.includes(release.NOTES_START) && notes.includes(release.NOTES_END));

  const trickyNotes = release.buildReleaseNotes({
    version,
    minSupported: '2.12.2',
    maxSupported: '2.32.1',
    dictCount: 1079,
    zipName: `antigravity-chinese-v${version}-portable.zip`,
    sha256: 'b'.repeat(64),
    changelogSection: '- 字面量美元符号防回归测试: $& $$ $1 $`'
  });
  const first = release.upsertMarkerBlock('## What\'s Changed\n* PR #1\n', trickyNotes);
  assert.match(first, /\$\& \$\$ \$1 \$`/);
  assert.match(first, /## What's Changed/);

  const second = release.upsertMarkerBlock(first, trickyNotes);
  assert.equal(second, first);
  assert.equal(second.split(release.NOTES_START).length - 1, 1);
  assert.equal(second.split(release.NOTES_END).length - 1, 1);

  const dispatchMeta = release.resolveReleaseMeta(ROOT, { eventName: 'workflow_dispatch' });
  assert.equal(dispatchMeta.tag, `v${version}`);
  assert.equal(dispatchMeta.prerelease, 'false');

  const preMeta = release.resolveReleaseMeta(ROOT, {
    eventName: 'workflow_dispatch',
    inputTag: `v${version}`,
    prerelease: 'true'
  });
  assert.equal(preMeta.prerelease, 'true');
});

test('Release 工作流配置、pack.ps1 语法与模拟 gh/git E2E 发布路径全部通过', t => {
  const wfPath = path.join(ROOT, '.github', 'workflows', 'release.yml');
  const wfText = fs.readFileSync(wfPath, 'utf8');

  assert.match(wfText, /tags:\s*\n\s*-\s*'v\*'/);
  assert.match(wfText, /workflow_dispatch:/);
  assert.match(wfText, /permissions:\s*\n\s*contents:\s*write/);
  assert.match(wfText, /runs-on:\s*windows-latest/);
  assert.match(wfText, /npm ci --ignore-scripts --no-audit --no-fund/);
  assert.match(wfText, /node scripts\/release\.js resolve-meta >> "\$GITHUB_OUTPUT"/);
  assert.match(wfText, /sha256sum -c checksums-sha256\.txt/);

  // PowerShell AST parse check on pack.ps1 when powershell.exe exists
  if (process.platform === 'win32') {
    const packPath = path.join(ROOT, 'pack.ps1').replace(/'/g, "''");
    execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `$err = $null; [void][System.Management.Automation.Language.Parser]::ParseFile('${packPath}', [ref]$null, [ref]$err); if ($err -and $err.Count -gt 0) { $err | ForEach-Object { Write-Error $_.Message }; exit 1 }`
      ],
      { encoding: 'utf8', windowsHide: true }
    );
  }

  const bashBin = findGitBashBinary();
  if (!bashBin) {
    return;
  }

  const bashSteps = extractWorkflowBashSteps(wfText);
  assert.equal(bashSteps.length, 3, 'release.yml 应包含 3 个 bash 步骤');
  const tmp = makeTempDir(t, 'ag-wf-e2e-');

  for (const [idx, step] of bashSteps.entries()) {
    assert.doesNotMatch(step.script, /\$\{\{/, `bash 步骤 ${step.name} 不应直接插值 GitHub 表达式`);
    const file = path.join(tmp, `step-${idx}.sh`);
    fs.writeFileSync(file, step.script + '\n', 'utf8');
    execFileSync(bashBin, ['-n', toPosixPath(file)], { encoding: 'utf8', windowsHide: true });
  }

  const publishStep = bashSteps.find(s => s.name === 'Publish GitHub Release');
  assert.ok(publishStep, '缺少 Publish GitHub Release 步骤');

  const workDir = path.join(tmp, 'repo');
  const mockBin = path.join(tmp, 'mock-bin');
  const stateDir = path.join(tmp, 'gh-state');
  fs.mkdirSync(path.join(workDir, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(workDir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(workDir, 'dict'), { recursive: true });
  fs.mkdirSync(path.join(workDir, 'dist'), { recursive: true });
  fs.mkdirSync(mockBin, { recursive: true });
  fs.mkdirSync(stateDir, { recursive: true });

  for (const rel of ['package.json', 'CHANGELOG.md', 'scripts/release.js', 'dict/zh-CN.json']) {
    fs.copyFileSync(path.join(ROOT, rel), path.join(workDir, rel));
  }
  fs.cpSync(path.join(ROOT, 'src'), path.join(workDir, 'src'), { recursive: true });

  const version = release.readPackageVersion(ROOT);
  const tag = `v${version}`;
  const zipName = `antigravity-chinese-v${version}-portable.zip`;
  const zipPath = path.join(workDir, 'dist', zipName);
  fs.writeFileSync(zipPath, 'mock-zip-bytes', 'utf8');
  const sha = crypto.createHash('sha256').update('mock-zip-bytes').digest('hex');
  fs.writeFileSync(path.join(workDir, 'dist', 'checksums-sha256.txt'), `${sha}  ${zipName}\n`, 'utf8');

  const ghScript = path.join(mockBin, 'gh');
  fs.writeFileSync(ghScript, `#!/usr/bin/env bash
set -euo pipefail
STATE_DIR="${toPosixPath(stateDir)}"
echo "gh $*" >> "$STATE_DIR/calls.log"
cmd="$1 $2"
shift 2 || true
case "$cmd" in
  "release view")
    tag="$1"; shift || true
    if [ ! -f "$STATE_DIR/release-$tag.body" ]; then
      exit 1
    fi
    if [[ " $* " == *" --jq "* ]]; then
      cat "$STATE_DIR/release-$tag.body"
    fi
    ;;
  "release create")
    tag="$1"; shift
    notes_file=""
    while [ $# -gt 0 ]; do
      case "$1" in
        --notes-file) notes_file="$2"; shift 2 ;;
        --title|--target) shift 2 ;;
        *) shift ;;
      esac
    done
    cp "$notes_file" "$STATE_DIR/release-$tag.body"
    printf "\\n## What's Changed\\n* Simulated PR by @tester\\n" >> "$STATE_DIR/release-$tag.body"
    ;;
  "release upload")
    ;;
  "release edit")
    tag="$1"; shift
    notes_file=""
    while [ $# -gt 0 ]; do
      case "$1" in
        --notes-file) notes_file="$2"; shift 2 ;;
        --title) shift 2 ;;
        *) shift ;;
      esac
    done
    cp "$notes_file" "$STATE_DIR/release-$tag.body"
    ;;
  *)
    echo "unexpected gh command: $cmd" >&2
    exit 2
    ;;
esac
`, { mode: 0o755 });

  const gitScript = path.join(mockBin, 'git');
  fs.writeFileSync(gitScript, `#!/usr/bin/env bash
exit 1
`, { mode: 0o755 });

  const publishScript = path.join(tmp, 'publish.sh');
  fs.writeFileSync(publishScript, publishStep.script + '\n', 'utf8');

  const env = {
    ...process.env,
    PATH: `${toPosixPath(mockBin)}:${toPosixPath(path.dirname(process.execPath))}:/usr/bin:/bin`,
    GH_TOKEN: 'dummy-token',
    RELEASE_TAG: tag,
    PKG_VERSION: version,
    ZIP_NAME: zipName,
    SHA256: sha,
    PRERELEASE: 'false',
    DEFAULT_BRANCH: 'main'
  };

  // Run 1: release does not exist -> creates release with --notes-file + --generate-notes + --target main
  execFileSync(bashBin, [toPosixPath(publishScript)], { cwd: workDir, env, encoding: 'utf8', windowsHide: true });
  const bodyAfterCreate = fs.readFileSync(path.join(stateDir, `release-${tag}.body`), 'utf8');
  assert.match(bodyAfterCreate, /仅支持 Windows 10 \/ 11/);
  assert.match(bodyAfterCreate, /Simulated PR by @tester/);

  // Run 2: release already exists -> clobber uploads & idempotently edits notes inside markers
  execFileSync(bashBin, [toPosixPath(publishScript)], { cwd: workDir, env, encoding: 'utf8', windowsHide: true });
  const bodyAfterEdit = fs.readFileSync(path.join(stateDir, `release-${tag}.body`), 'utf8');
  assert.equal(bodyAfterEdit.trim(), bodyAfterCreate.trim());

  const calls = fs.readFileSync(path.join(stateDir, 'calls.log'), 'utf8');
  assert.match(calls, /^gh release view/m);
  assert.match(calls, /^gh release create.*--target main/m);
  assert.match(calls, /^gh release upload.*--clobber/m);
  assert.match(calls, /^gh release edit/m);
});
