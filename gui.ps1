param([string]$ClientPath = '')

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName PresentationFramework, PresentationCore, WindowsBase
$script:ProjectRoot = $PSScriptRoot
$script:Job = $null
$script:LastStatus = $null
$script:LastError = $null
$script:UpdatingPath = $false
$reader = [System.Xml.XmlReader]::Create((Join-Path $PSScriptRoot 'gui\window.xaml'))
try { $script:Window = [Windows.Markup.XamlReader]::Load($reader) } finally { $reader.Dispose() }
$script:Ui = @{}
foreach ($name in 'PathBox','BrowseButton','CheckButton','InstallButton','RestoreButton','LogBox','StatusDot','StatusTitle','StatusDetail','VersionLabel','ActivityLabel') {
    $script:Ui[$name] = $Window.FindName($name)
}
$Ui.PathBox.Text = $ClientPath

function Write-Activity([string]$Message) {
    $Ui.LogBox.AppendText(('[' + (Get-Date -Format 'HH:mm:ss') + '] ' + $Message + "`r`n"))
    $Ui.LogBox.ScrollToEnd()
}

function Set-Buttons {
    $idle = $null -eq $script:Job
    $Ui.PathBox.IsEnabled = $idle
    $Ui.BrowseButton.IsEnabled = $idle
    $Ui.CheckButton.IsEnabled = $idle
    $Ui.InstallButton.IsEnabled = $idle -and $null -ne $script:LastStatus -and $script:LastStatus.supported -and -not $script:LastStatus.patched
    $Ui.RestoreButton.IsEnabled = $idle -and $null -ne $script:LastStatus -and $script:LastStatus.patched
}

function Show-Failure([string]$Message) {
    $script:LastError = $Message
    $script:LastStatus = $null
    $Ui.StatusTitle.Text = '暂时无法操作'
    $Ui.StatusDot.Fill = '#B35B43'
    $Ui.StatusDetail.Text = $Message
    $Ui.VersionLabel.Text = '调整后点击“重新检查”'
    $Ui.ActivityLabel.Text = '需要处理'
    Write-Activity $Message
    Set-Buttons
}

function Quote-ProcessArgument([string]$Value) {
    # Windows CreateProcess quoting; no cmd.exe or PowerShell evaluation of user paths.
    return '"' + [regex]::Replace([regex]::Replace($Value, '(\\*)"', '$1$1\"'), '(\\+)$', '$1$1') + '"'
}

function Start-Operation([ValidateSet('status','check','install','restore')][string]$Command) {
    if ($null -ne $script:Job) { return }
    $script:LastError = $null
    try {
        $node = Get-Command node.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($null -eq $node) { throw '未找到 Node.js。请安装 Node.js 22.12 或更高版本，然后重新打开本窗口。' }
        $target = $Ui.PathBox.Text.Trim()
        if ($target -and [IO.Path]::GetFileName($target) -ieq 'Antigravity.exe') { $target = [IO.Path]::GetDirectoryName($target) }
        $arguments = (Quote-ProcessArgument (Join-Path $script:ProjectRoot 'cli.js')) + ' ' + $Command
        if ($target) { $arguments += ' --path ' + (Quote-ProcessArgument $target) }
        $info = New-Object Diagnostics.ProcessStartInfo
        $info.FileName = $node.Source
        $info.Arguments = $arguments
        $info.WorkingDirectory = $script:ProjectRoot
        $info.UseShellExecute = $false
        $info.CreateNoWindow = $true
        $info.RedirectStandardOutput = $true
        $info.RedirectStandardError = $true
        $info.StandardOutputEncoding = [Text.Encoding]::UTF8
        $info.StandardErrorEncoding = [Text.Encoding]::UTF8
        $child = New-Object Diagnostics.Process
        $child.StartInfo = $info
        try { [void]$child.Start() } catch { $child.Dispose(); throw }
        $script:Job = @{ Process = $child; Out = $child.StandardOutput.ReadToEndAsync(); Err = $child.StandardError.ReadToEndAsync(); Command = $Command }
        $labels = @{ status = '检查状态'; check = '检查环境'; install = '安装汉化'; restore = '恢复英文' }
        $Ui.StatusTitle.Text = $labels[$Command] + '…'
        $Ui.StatusDot.Fill = '#C59336'
        $Ui.StatusDetail.Text = '正在处理，请稍候。'
        $Ui.ActivityLabel.Text = '操作进行中'
        Write-Activity ('开始' + $labels[$Command])
        Set-Buttons
        $script:Timer.Start()
    } catch { Show-Failure $_.Exception.Message }
}

function Complete-Operation {
    if ($null -eq $script:Job) { return }
    $job = $script:Job
    if (-not $job.Process.HasExited -or -not $job.Out.IsCompleted -or -not $job.Err.IsCompleted) { return }
    $script:Timer.Stop()
    $script:Job = $null
    try {
        $stdout = $job.Out.GetAwaiter().GetResult()
        $stderr = $job.Err.GetAwaiter().GetResult()
        if ($job.Process.ExitCode -ne 0) {
            if (-not $stderr.Trim()) { $stderr = '操作失败，请检查客户端路径和目录写入权限。' }
            throw $stderr.Trim()
        }
        $result = $stdout | ConvertFrom-Json
        if (-not $result.target -or -not $result.state) { throw '客户端返回了无法识别的结果。' }
        Write-Activity $result.state
        if ($job.Command -in 'install','restore') {
            Start-Operation 'status'
            return
        }
        $script:LastStatus = $result
        $script:UpdatingPath = $true
        try { $Ui.PathBox.Text = $result.target } finally { $script:UpdatingPath = $false }
        $Ui.VersionLabel.Text = '客户端版本 ' + $result.version
        if ($result.patched) {
            $Ui.StatusTitle.Text = '已启用本地汉化'
            $Ui.StatusDetail.Text = '恢复备份校验有效。重新打开 Antigravity 即可使用。'
            $Ui.StatusDot.Fill = '#177A70'
        } elseif ($result.supported) {
            $Ui.StatusTitle.Text = '准备就绪，可以汉化'
            $Ui.StatusDetail.Text = '版本匹配。安装前会自动备份；恢复英文可还原安装前资源包。'
            $Ui.StatusDot.Fill = '#177A70'
        } else {
            $Ui.StatusTitle.Text = '当前版本暂不支持'
            $Ui.StatusDetail.Text = $result.state
            $Ui.StatusDot.Fill = '#B35B43'
        }
        $Ui.ActivityLabel.Text = '检查完成'
        Set-Buttons
    } catch { Show-Failure $_.Exception.Message } finally { $job.Process.Dispose() }
}

$script:Timer = New-Object Windows.Threading.DispatcherTimer
$Timer.Interval = [TimeSpan]::FromMilliseconds(100)
$Timer.Add_Tick({ Complete-Operation })
$Ui.CheckButton.Add_Click({ Start-Operation 'check' })
$Ui.InstallButton.Add_Click({ Start-Operation 'install' })
$Ui.RestoreButton.Add_Click({ Start-Operation 'restore' })
$Ui.BrowseButton.Add_Click({
    $dialog = New-Object Microsoft.Win32.OpenFileDialog
    $dialog.Title = '选择 Antigravity.exe 或 app.asar'
    $dialog.Filter = 'Antigravity 客户端|Antigravity.exe;app.asar'
    if ($dialog.ShowDialog($Window)) { $Ui.PathBox.Text = $dialog.FileName; Start-Operation 'status' }
})
$Ui.PathBox.Add_TextChanged({
    if ($script:UpdatingPath) { return }
    $script:LastStatus = $null
    $Ui.StatusTitle.Text = '位置已更改'
    $Ui.StatusDetail.Text = '点击“重新检查”，确认此位置的客户端状态。'
    $Ui.StatusDot.Fill = '#86969F'
    $Ui.VersionLabel.Text = '等待检查'
    Set-Buttons
})
$Window.Add_Closing({
    param($sender, $eventArgs)
    if ($null -ne $script:Job) { $eventArgs.Cancel = $true; $Ui.ActivityLabel.Text = '请等待当前操作完成后关闭' }
})
$Window.Add_Closed({ $script:Timer.Stop() })
$Window.Add_ContentRendered({ Start-Operation 'status' })
Write-Activity '窗口已打开。状态检查不会安装或恢复补丁。'

if ($MyInvocation.InvocationName -ne '.') { [void]$Window.ShowDialog() }
