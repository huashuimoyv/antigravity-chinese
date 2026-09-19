# pack.ps1 - 构建 EXE 启动器并打包 Release 压缩包
# 用法: powershell -ExecutionPolicy Bypass -File pack.ps1 [-Version 0.2.2]
param([string]$Version = '')

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

# ---------- 读取版本号 ----------
if (-not $Version) {
    $pkg = Get-Content (Join-Path $root 'package.json') -Raw | ConvertFrom-Json
    $Version = $pkg.version
}
Write-Host "版本: $Version"

# ---------- 编译 EXE 启动器 ----------
Write-Host "`n[1/4] 编译 EXE 启动器..."
$csc = 'C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe'
if (-not (Test-Path $csc)) { throw "找不到 csc.exe，请确认 .NET Framework 4 已安装" }
$exeDest = Join-Path $root '启动汉化工具.exe'
& $csc /target:winexe /platform:anycpu /utf8output `
    /out:$exeDest `
    /reference:System.Windows.Forms.dll `
    /reference:System.dll `
    (Join-Path $root 'launcher\Program.cs') | Out-String -Stream | Write-Host
if ($LASTEXITCODE -ne 0) { throw "EXE 编译失败" }
Write-Host "OK: $exeDest"

# ---------- 准备输出目录 ----------
$distDir = Join-Path $root 'dist'
if (-not (Test-Path $distDir)) { New-Item $distDir -ItemType Directory | Out-Null }

# ---------- 打包 Portable (无 Node) ----------
Write-Host "`n[2/4] 打包 Portable..."
$portableZip = Join-Path $distDir "antigravity-chinese-v${Version}-portable.zip"
if (Test-Path $portableZip) { Remove-Item $portableZip }
$tmpPortable = Join-Path $env:TEMP "ag-portable-$Version"
if (Test-Path $tmpPortable) { Remove-Item $tmpPortable -Recurse }
New-Item $tmpPortable -ItemType Directory | Out-Null

$portableFiles = @(
    'cli.js', 'gui.ps1', 'gui.cmd', 'install.cmd', 'restore.cmd',
    '启动汉化工具.exe', 'package.json', 'README.md', 'LICENSE'
)
foreach ($f in $portableFiles) {
    $src = Join-Path $root $f
    if (Test-Path $src) { Copy-Item $src $tmpPortable }
}
Copy-Item (Join-Path $root 'src')  (Join-Path $tmpPortable 'src')  -Recurse
Copy-Item (Join-Path $root 'dict') (Join-Path $tmpPortable 'dict') -Recurse
Copy-Item (Join-Path $root 'gui')  (Join-Path $tmpPortable 'gui')  -Recurse

Compress-Archive -Path "$tmpPortable\*" -DestinationPath $portableZip
Remove-Item $tmpPortable -Recurse
$portableSize = (Get-Item $portableZip).Length
Write-Host ("OK: {0} ({1:N0} KB)" -f (Split-Path $portableZip -Leaf), ($portableSize/1KB))

# ---------- 打包 Standalone (含 Node) ----------
Write-Host "`n[3/4] 打包 Standalone..."
$binDir = Join-Path $root 'bin'
if (-not (Test-Path $binDir)) {
    Write-Warning "bin\ 目录不存在，跳过 Standalone 打包。请先运行 scripts/download-node.ps1 下载便携 Node。"
} else {
    $standaloneZip = Join-Path $distDir "antigravity-chinese-v${Version}-standalone.zip"
    if (Test-Path $standaloneZip) { Remove-Item $standaloneZip }
    $tmpStandalone = Join-Path $env:TEMP "ag-standalone-$Version"
    if (Test-Path $tmpStandalone) { Remove-Item $tmpStandalone -Recurse }
    New-Item $tmpStandalone -ItemType Directory | Out-Null

    foreach ($f in $portableFiles) {
        $src = Join-Path $root $f
        if (Test-Path $src) { Copy-Item $src $tmpStandalone }
    }
    Copy-Item (Join-Path $root 'src')  (Join-Path $tmpStandalone 'src')  -Recurse
    Copy-Item (Join-Path $root 'dict') (Join-Path $tmpStandalone 'dict') -Recurse
    Copy-Item (Join-Path $root 'gui')  (Join-Path $tmpStandalone 'gui')  -Recurse
    Copy-Item $binDir (Join-Path $tmpStandalone 'bin') -Recurse

    Compress-Archive -Path "$tmpStandalone\*" -DestinationPath $standaloneZip
    Remove-Item $tmpStandalone -Recurse
    $standaloneSize = (Get-Item $standaloneZip).Length
    Write-Host ("OK: {0} ({1:N0} KB)" -f (Split-Path $standaloneZip -Leaf), ($standaloneSize/1KB))
}

# ---------- 生成 SHA-256 校验文件 ----------
Write-Host "`n[4/4] 生成 SHA-256 校验..."
$checksumFile = Join-Path $distDir 'checksums-sha256.txt'
$lines = @()
foreach ($zip in Get-ChildItem $distDir -Filter "antigravity-chinese-v${Version}-*.zip") {
    $hash = (Get-FileHash $zip.FullName -Algorithm SHA256).Hash.ToLower()
    $lines += "$hash  $($zip.Name)"
    Write-Host "$hash  $($zip.Name)"
}
$lines | Set-Content $checksumFile -Encoding UTF8
Write-Host "OK: checksums-sha256.txt"

Write-Host "`n===== 打包完成 ====="
Write-Host "输出目录: $distDir"
