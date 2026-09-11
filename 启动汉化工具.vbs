Option Explicit
Dim shell, files, root, script, powershell, result
Set shell = CreateObject("WScript.Shell")
Set files = CreateObject("Scripting.FileSystemObject")
root = files.GetParentFolderName(WScript.ScriptFullName)
script = files.BuildPath(root, "gui.ps1")
powershell = shell.ExpandEnvironmentStrings("%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe")
result = shell.Run("""" & powershell & """ -NoProfile -ExecutionPolicy Bypass -STA -WindowStyle Hidden -File """ & script & """", 0, True)
If result <> 0 Then MsgBox "The window could not start. Please run gui.cmd to view the error.", 48, "Antigravity Local"
