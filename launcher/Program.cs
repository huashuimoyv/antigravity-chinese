using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;
using System.Reflection;

[assembly: AssemblyTitle("Antigravity 汉化工具")]
[assembly: AssemblyDescription("Antigravity 中文汉化 GUI 启动器")]
[assembly: AssemblyVersion("1.0.0.0")]
[assembly: AssemblyFileVersion("1.0.0.0")]

class Launcher
{
    [STAThread]
    static void Main()
    {
        string dir = Path.GetDirectoryName(
            System.Reflection.Assembly.GetExecutingAssembly().Location);

        string ps1 = Path.Combine(dir, "gui.ps1");

        if (!File.Exists(ps1))
        {
            MessageBox.Show(
                "找不到 gui.ps1，请确保启动工具与项目文件在同一目录中。",
                "Antigravity 汉化工具",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
            return;
        }

        // Build powershell.exe arguments
        string args = string.Format(
            "-NoProfile -ExecutionPolicy Bypass -STA -WindowStyle Hidden -File \"{0}\"",
            ps1);

        var psi = new ProcessStartInfo
        {
            FileName = "powershell.exe",
            Arguments = args,
            UseShellExecute = false,
            CreateNoWindow = true,
            WorkingDirectory = dir
        };

        try
        {
            Process proc = Process.Start(psi);
            proc.WaitForExit();
            if (proc.ExitCode != 0)
            {
                MessageBox.Show(
                    "界面启动失败，请双击 gui.cmd 查看详细错误信息。",
                    "Antigravity 汉化工具",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
            }
        }
        catch (Exception ex)
        {
            MessageBox.Show(
                "无法启动 PowerShell：" + ex.Message,
                "Antigravity 汉化工具",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
        }
    }
}
