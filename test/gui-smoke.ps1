param([Parameter(Mandatory=$true)][string]$SourceAsar, [string]$ScreenshotPath)
$ErrorActionPreference = 'Stop'
$project = Split-Path $PSScriptRoot -Parent
$source = (Resolve-Path -LiteralPath $SourceAsar).Path
$sourceHash = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash
$tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$testDir = Join-Path $tempRoot ('local-zh-ui-' + [guid]::NewGuid().ToString('N') + ' 空格 & 测试')
[void](New-Item -ItemType Directory -Path $testDir)
$target = Join-Path $testDir 'app.asar'
Copy-Item -LiteralPath $source -Destination $target

function Assert-Ui([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw $Message }
}
function Pump-Ui {
    $Window.Dispatcher.Invoke([Windows.Threading.DispatcherPriority]::Background, [Action]{})
    Start-Sleep -Milliseconds 30
}
function Wait-Ui {
    $deadline = (Get-Date).AddSeconds(20)
    do {
        Pump-Ui
        if ((Get-Date) -gt $deadline) { throw 'GUI operation timed out' }
    } while ($null -ne $script:Job)
}
function Click-Ui([string]$Name) {
    $Ui[$Name].RaiseEvent((New-Object Windows.RoutedEventArgs([Windows.Controls.Button]::ClickEvent)))
    Wait-Ui
}

try {
    . (Join-Path $project 'gui.ps1') -ClientPath $target
    $Window.Show()
    Pump-Ui
    Wait-Ui
    Assert-Ui ($null -eq $script:LastError) ('Initial check failed: ' + $script:LastError)
    Assert-Ui ($Ui.InstallButton.IsEnabled -and -not $Ui.RestoreButton.IsEnabled) 'Initial button state incorrect'
    Start-Operation 'install'
    Assert-Ui (-not $Ui.CheckButton.IsEnabled -and -not $Ui.PathBox.IsEnabled) 'Busy state permits concurrent edits'
    $Window.Close()
    Assert-Ui $Window.IsVisible 'Busy operation could be interrupted by closing window'
    Wait-Ui
    Assert-Ui ($null -eq $script:LastError) ('Install failed: ' + $script:LastError)
    Assert-Ui ($script:LastStatus.patched -and $Ui.RestoreButton.IsEnabled -and -not $Ui.InstallButton.IsEnabled) 'Installed state incorrect'
    Click-Ui 'RestoreButton'
    Assert-Ui ($null -eq $script:LastError) ('Restore failed: ' + $script:LastError)
    Assert-Ui ($Ui.InstallButton.IsEnabled -and -not $Ui.RestoreButton.IsEnabled) 'Restored button state incorrect'
    Assert-Ui ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash -eq $sourceHash) 'Restored file differs from source'
    $Ui.PathBox.Text = Join-Path $testDir 'missing.asar'
    Assert-Ui (-not $Ui.InstallButton.IsEnabled -and -not $Ui.RestoreButton.IsEnabled) 'Path edit left stale write buttons enabled'
    Click-Ui 'CheckButton'
    Assert-Ui ($null -ne $script:LastError -and $Ui.CheckButton.IsEnabled -and -not $Ui.InstallButton.IsEnabled) 'Error state incorrect'
    $Ui.PathBox.Text = $target
    Click-Ui 'CheckButton'
    Assert-Ui ($null -eq $script:LastError -and $Ui.InstallButton.IsEnabled) 'Retry did not recover'
    $savedPath = $env:PATH
    try {
        $env:PATH = ''
        Click-Ui 'CheckButton'
        Assert-Ui ($script:LastError -like '*Node.js*' -and -not $Ui.InstallButton.IsEnabled) 'Missing Node state incorrect'
    } finally { $env:PATH = $savedPath }
    Click-Ui 'CheckButton'
    Assert-Ui ($null -eq $script:LastError) 'Final check failed'
    if ($ScreenshotPath) {
        $Window.UpdateLayout()
        $bitmap = New-Object Windows.Media.Imaging.RenderTargetBitmap([int]$Window.ActualWidth, [int]$Window.ActualHeight, 96, 96, [Windows.Media.PixelFormats]::Pbgra32)
        $bitmap.Render($Window)
        $encoder = New-Object Windows.Media.Imaging.PngBitmapEncoder
        $encoder.Frames.Add([Windows.Media.Imaging.BitmapFrame]::Create($bitmap))
        $stream = [IO.File]::Create([IO.Path]::GetFullPath($ScreenshotPath))
        try { $encoder.Save($stream) } finally { $stream.Dispose() }
    }
    Assert-Ui ((Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash -eq $sourceHash) 'Source archive changed'
    Write-Output 'PASS: live WPF startup, install, restore, busy/close protection, error/retry, missing Node, Unicode/space/ampersand path, source unchanged.'
} finally {
    if ($null -ne $Window -and $null -eq $script:Job) { $Window.Close() }
    $resolvedTestDir = [IO.Path]::GetFullPath($testDir)
    if ($null -eq $script:Job -and $resolvedTestDir.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase) -and
        [IO.Path]::GetFileName($resolvedTestDir).StartsWith('local-zh-ui-')) {
        Remove-Item -LiteralPath $resolvedTestDir -Recurse -Force
    }
}
