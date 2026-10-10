using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

[assembly: AssemblyTitle("AutoAccept Lite")]
[assembly: AssemblyDescription("AutoAccept Lite bildirim alani uygulamasi")]
[assembly: AssemblyVersion("1.1.0.0")]
[assembly: AssemblyFileVersion("1.1.0.0")]

internal static class Launcher
{
    [STAThread]
    private static int Main(string[] args)
    {
        try
        {
#if UNINSTALL
            return Uninstall(args);
#else
            string root = AppDomain.CurrentDomain.BaseDirectory;
            string node = Path.Combine(root, "runtime", "node.exe");
            string entry = Path.Combine(root, "app", "index.js");
            if (!File.Exists(node) || !File.Exists(entry))
                throw new FileNotFoundException("Uygulama dosyalari eksik. Kurulum EXE'sini yeniden calistirin.");
            if (args.Length == 1 && args[0] == "--check") return Check(node, entry);

            bool created;
            using (Mutex mutex = new Mutex(true, "Local\\AutoAcceptLite", out created))
            {
                if (!created)
                {
                    MessageBox.Show("AutoAccept Lite zaten bildirim alaninda calisiyor.", "AutoAccept Lite",
                        MessageBoxButtons.OK, MessageBoxIcon.Information);
                    return 0;
                }
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                Application.Run(new TrayApplication(node, entry, root));
                mutex.ReleaseMutex();
            }
            return 0;
#endif
        }
        catch (Exception error)
        {
            MessageBox.Show(error.Message, "AutoAccept Lite", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 1;
        }
    }

    private static int Check(string node, string entry)
    {
        ProcessStartInfo info = new ProcessStartInfo(node, "--check " + Quote(entry));
        info.WorkingDirectory = Path.GetDirectoryName(entry);
        info.UseShellExecute = false;
        info.CreateNoWindow = true;
        using (Process process = Process.Start(info))
        {
            if (!process.WaitForExit(15000))
            {
                process.Kill();
                throw new TimeoutException("Uygulama dosyasi kontrolu zaman asimina ugradi.");
            }
            return process.ExitCode;
        }
    }

    private static string Quote(string path)
    {
        if (path.IndexOf('"') >= 0) throw new ArgumentException("Gecersiz dosya yolu.");
        return "\"" + path + "\"";
    }

#if UNINSTALL
    private static int Uninstall(string[] args)
    {
        string location = null;
        string command = null;
        foreach (RegistryView view in new[] { RegistryView.Registry32, RegistryView.Registry64 })
        {
            using (RegistryKey user = RegistryKey.OpenBaseKey(RegistryHive.CurrentUser, view))
            using (RegistryKey key = user.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\AutoAcceptLite_is1"))
            {
                if (key != null)
                {
                    location = key.GetValue("InstallLocation") as string;
                    command = key.GetValue("UninstallString") as string;
                }
            }
            if (!String.IsNullOrEmpty(location)) break;
        }
        if (String.IsNullOrEmpty(location))
        {
            if (args.Length == 1 && args[0] == "--check") return 2;
            MessageBox.Show("Bu kullanici icin AutoAccept Lite kurulumu bulunamadi.", "AutoAccept Lite", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return 0;
        }
        if (String.IsNullOrEmpty(command)) throw new InvalidDataException("Kaldirma kaydi eksik.");
        string uninstall = command.Trim();
        if (uninstall.StartsWith("\""))
        {
            int end = uninstall.IndexOf('"', 1);
            if (end < 0) throw new InvalidDataException("Kaldirma kaydi gecersiz.");
            uninstall = uninstall.Substring(1, end - 1);
        }
        uninstall = Path.GetFullPath(uninstall);
        if (!String.Equals(Path.GetDirectoryName(uninstall).TrimEnd(Path.DirectorySeparatorChar),
            Path.GetFullPath(location).TrimEnd(Path.DirectorySeparatorChar), StringComparison.OrdinalIgnoreCase)
            || !Path.GetFileName(uninstall).StartsWith("unins", StringComparison.OrdinalIgnoreCase)
            || !String.Equals(Path.GetExtension(uninstall), ".exe", StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException("Kaldirma kaydi kurulum klasorunu gostermiyor.");
        if (!File.Exists(uninstall))
            throw new FileNotFoundException("Kaldirma dosyasi bulunamadi. Kurulum EXE'sini yeniden calistirin, sonra kaldirmayi tekrar deneyin.");
        if (args.Length == 1 && args[0] == "--check") return 0;
        ProcessStartInfo info = new ProcessStartInfo(uninstall);
        bool silent = args.Length == 1 && args[0] == "--silent";
        if (silent) info.Arguments = "/VERYSILENT /SUPPRESSMSGBOXES /NORESTART";
        info.UseShellExecute = false;
        info.WorkingDirectory = Path.GetDirectoryName(uninstall);
        using (Process process = Process.Start(info))
        {
            if (!silent) return 0;
            if (!process.WaitForExit(45000)) throw new TimeoutException("Kaldirma islemi zaman asimina ugradi.");
            return process.ExitCode;
        }
    }
#endif
}

#if !UNINSTALL
internal sealed class TrayApplication : ApplicationContext
{
    private readonly Process worker;
    private readonly NotifyIcon tray;
    private readonly Form logWindow;
    private readonly RichTextBox logText;
    private readonly ToolStripMenuItem pauseItem;
    private bool paused;
    private bool closing;

    internal TrayApplication(string node, string entry, string root)
    {
        logWindow = new Form();
        logWindow.Text = "AutoAccept Lite - Terminal";
        logWindow.StartPosition = FormStartPosition.CenterScreen;
        logWindow.Size = new Size(760, 440);
        logWindow.MinimizeBox = true;
        logWindow.MaximizeBox = true;
        logText = new RichTextBox();
        logText.Dock = DockStyle.Fill;
        logText.ReadOnly = true;
        logText.BackColor = Color.FromArgb(16, 30, 45);
        logText.ForeColor = Color.FromArgb(230, 245, 242);
        logText.Font = new Font("Consolas", 10.0f);
        logWindow.Controls.Add(logText);
        logWindow.FormClosing += delegate(object sender, FormClosingEventArgs e)
        {
            if (!closing) { e.Cancel = true; logWindow.Hide(); }
        };

        ContextMenuStrip menu = new ContextMenuStrip();
        ToolStripMenuItem showItem = new ToolStripMenuItem("Terminali goster");
        showItem.Click += delegate { ToggleLog(); };
        pauseItem = new ToolStripMenuItem("Duraklat");
        pauseItem.Click += delegate { TogglePause(); };
        ToolStripMenuItem exitItem = new ToolStripMenuItem("Cikis");
        exitItem.Click += delegate { ExitApplication(); };
        menu.Items.Add(showItem);
        menu.Items.Add(pauseItem);
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add(exitItem);

        tray = new NotifyIcon();
        tray.Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        tray.Text = "AutoAccept Lite - calisiyor";
        tray.ContextMenuStrip = menu;
        tray.Visible = true;
        tray.DoubleClick += delegate { ToggleLog(); };

        ProcessStartInfo info = new ProcessStartInfo(node, "\"" + entry + "\"");
        info.WorkingDirectory = Path.GetDirectoryName(entry);
        info.UseShellExecute = false;
        info.CreateNoWindow = true;
        info.RedirectStandardInput = true;
        info.RedirectStandardOutput = true;
        info.RedirectStandardError = true;
        info.StandardOutputEncoding = Encoding.UTF8;
        info.StandardErrorEncoding = Encoding.UTF8;
        info.EnvironmentVariables["AUTOACCEPT_TRAY"] = "1";
        worker = new Process();
        worker.StartInfo = info;
        worker.EnableRaisingEvents = true;
        worker.OutputDataReceived += OnOutput;
        worker.ErrorDataReceived += OnOutput;
        worker.Exited += OnWorkerExit;
        try
        {
            worker.Start();
            worker.BeginOutputReadLine();
            worker.BeginErrorReadLine();
            Append("AutoAccept Lite bildirim alaninda basladi.");
            tray.ShowBalloonTip(2500, "AutoAccept Lite", "Arka planda calisiyor. Menuden terminali gosterebilir veya duraklatabilirsiniz.", ToolTipIcon.Info);
        }
        catch
        {
            tray.Visible = false;
            tray.Dispose();
            throw;
        }
    }

    private void OnOutput(object sender, DataReceivedEventArgs e)
    {
        if (!String.IsNullOrEmpty(e.Data)) Append(e.Data);
    }

    private void Append(string value)
    {
        if (logWindow.IsDisposed) return;
        if (logWindow.InvokeRequired)
        {
            try { logWindow.BeginInvoke(new Action<string>(Append), value); } catch (InvalidOperationException) { }
            return;
        }
        logText.AppendText(value + Environment.NewLine);
        logText.SelectionStart = logText.TextLength;
        logText.ScrollToCaret();
    }

    private void OnWorkerExit(object sender, EventArgs e)
    {
        Append("AutoAccept Lite motoru kapandi (kod " + worker.ExitCode + "). Tray ikonundan Cikis'i secebilirsiniz.");
        if (!closing && tray.Visible)
            tray.ShowBalloonTip(3000, "AutoAccept Lite", "Motor kapandi. Gunluk penceresinden hata ayrintilarini gorebilirsiniz.", ToolTipIcon.Warning);
    }

    private void ToggleLog()
    {
        if (logWindow.Visible)
        {
            logWindow.Hide();
            return;
        }
        logWindow.Show();
        logWindow.WindowState = FormWindowState.Normal;
        logWindow.Activate();
    }

    private void TogglePause()
    {
        if (worker.HasExited) return;
        try
        {
            worker.StandardInput.WriteLine("p");
            worker.StandardInput.Flush();
            paused = !paused;
            pauseItem.Text = paused ? "Devam et" : "Duraklat";
        }
        catch (InvalidOperationException) { Append("Duraklatma komutu gonderilemedi."); }
    }

    private void ExitApplication()
    {
        if (closing) return;
        closing = true;
        tray.Visible = false;
        ThreadPool.QueueUserWorkItem(delegate
        {
            try
            {
                if (!worker.HasExited)
                {
                    worker.StandardInput.WriteLine("q");
                    worker.StandardInput.Flush();
                    if (!worker.WaitForExit(8000)) worker.Kill();
                }
            }
            catch { try { if (!worker.HasExited) worker.Kill(); } catch { } }
            try { logWindow.BeginInvoke(new Action(delegate { logWindow.Close(); ExitThread(); })); }
            catch { }
        });
    }

    protected override void ExitThreadCore()
    {
        closing = true;
        tray.Visible = false;
        tray.Dispose();
        if (!worker.HasExited) { try { worker.Kill(); } catch { } }
        worker.Dispose();
        logWindow.Dispose();
        base.ExitThreadCore();
    }
}
#endif
