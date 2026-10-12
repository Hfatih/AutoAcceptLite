using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Globalization;
using System.IO;
using System.Reflection;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

[assembly: AssemblyTitle("AutoAccept Lite")]
[assembly: AssemblyDescription("AutoAccept Lite tray application")]
[assembly: AssemblyProduct("AutoAccept Lite")]
[assembly: AssemblyVersion("1.1.3.0")]
[assembly: AssemblyFileVersion("1.1.3.0")]

// Arayuz dili Windows goruntuleme diline gore secilir: Turkce ise Turkce, degilse Ingilizce.
internal static class Lang
{
    internal static readonly bool Turkish = CultureInfo.CurrentUICulture.TwoLetterISOLanguageName == "tr";
    internal static string T(string tr, string en) { return Turkish ? tr : en; }
}

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
                throw new FileNotFoundException(Lang.T("Uygulama dosyaları eksik. Kurulum EXE'sini yeniden çalıştırın.",
                    "Application files are missing. Run the setup EXE again."));
            if (args.Length == 1 && args[0] == "--check") return Check(node, entry);

            bool created;
            using (Mutex mutex = new Mutex(true, "Local\\AutoAcceptLite", out created))
            {
                if (!created)
                {
                    MessageBox.Show(Lang.T("AutoAccept Lite zaten bildirim alanında çalışıyor.",
                        "AutoAccept Lite is already running in the notification area."), "AutoAccept Lite",
                        MessageBoxButtons.OK, MessageBoxIcon.Information);
                    return 0;
                }
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                Application.Run(new TrayApplication(node, entry));
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
                throw new TimeoutException(Lang.T("Uygulama dosyası kontrolü zaman aşımına uğradı.",
                    "Application file check timed out."));
            }
            return process.ExitCode;
        }
    }

    private static string Quote(string path)
    {
        if (path.IndexOf('"') >= 0) throw new ArgumentException(Lang.T("Geçersiz dosya yolu.", "Invalid file path."));
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
            MessageBox.Show(Lang.T("Bu kullanıcı için AutoAccept Lite kurulumu bulunamadı.",
                "No AutoAccept Lite installation was found for this user."), "AutoAccept Lite", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return 0;
        }
        if (String.IsNullOrEmpty(command)) throw new InvalidDataException(Lang.T("Kaldırma kaydı eksik.", "The uninstall entry is missing."));
        string uninstall = command.Trim();
        if (uninstall.StartsWith("\""))
        {
            int end = uninstall.IndexOf('"', 1);
            if (end < 0) throw new InvalidDataException(Lang.T("Kaldırma kaydı geçersiz.", "The uninstall entry is invalid."));
            uninstall = uninstall.Substring(1, end - 1);
        }
        uninstall = Path.GetFullPath(uninstall);
        if (!String.Equals(Path.GetDirectoryName(uninstall).TrimEnd(Path.DirectorySeparatorChar),
            Path.GetFullPath(location).TrimEnd(Path.DirectorySeparatorChar), StringComparison.OrdinalIgnoreCase)
            || !Path.GetFileName(uninstall).StartsWith("unins", StringComparison.OrdinalIgnoreCase)
            || !String.Equals(Path.GetExtension(uninstall), ".exe", StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException(Lang.T("Kaldırma kaydı kurulum klasörünü göstermiyor.",
                "The uninstall entry does not point to the installation folder."));
        if (!File.Exists(uninstall))
            throw new FileNotFoundException(Lang.T("Kaldırma dosyası bulunamadı. Kurulum EXE'sini yeniden çalıştırın, sonra kaldırmayı tekrar deneyin.",
                "The uninstaller was not found. Run the setup EXE again, then retry the removal."));
        if (args.Length == 1 && args[0] == "--check") return 0;
        ProcessStartInfo info = new ProcessStartInfo(uninstall);
        bool silent = args.Length == 1 && args[0] == "--silent";
        if (silent) info.Arguments = "/VERYSILENT /SUPPRESSMSGBOXES /NORESTART";
        info.UseShellExecute = false;
        info.WorkingDirectory = Path.GetDirectoryName(uninstall);
        using (Process process = Process.Start(info))
        {
            if (!silent) return 0;
            if (!process.WaitForExit(45000)) throw new TimeoutException(Lang.T("Kaldırma işlemi zaman aşımına uğradı.", "The removal timed out."));
            return process.ExitCode;
        }
    }
#endif
}

#if !UNINSTALL
internal sealed class TrayApplication : ApplicationContext
{
    // Gunluk penceresinde tutulan en fazla satir; eskiler atilir.
    private const int MaxLines = 1000;
    private static readonly Regex Ansi = new Regex(@"\x1B\[[0-9;]*[A-Za-z]", RegexOptions.Compiled);

    private readonly string node;
    private readonly string entry;
    private readonly NotifyIcon tray;
    private readonly Form logWindow;
    private readonly RichTextBox logText;
    private readonly ToolStripMenuItem pauseItem;
    private readonly System.Windows.Forms.Timer refreshTimer;
    private readonly object gate = new object();
    private readonly Queue<string> lines = new Queue<string>();
    private bool dirty;
    private Process worker;
    private bool paused;
    private bool restarting;
    private bool closing;

    internal TrayApplication(string node, string entry)
    {
        this.node = node;
        this.entry = entry;

        logWindow = new Form();
        logWindow.Text = Lang.T("AutoAccept Lite - Günlük", "AutoAccept Lite - Log");
        logWindow.Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        logWindow.StartPosition = FormStartPosition.CenterScreen;
        logWindow.Size = new Size(760, 440);
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
        // Pencere hic gosterilmese de BeginInvoke calissin diye tutamac arayuz is parcaciginda olusturulur.
        IntPtr handle = logWindow.Handle;

        ContextMenuStrip menu = new ContextMenuStrip();
        ToolStripMenuItem showItem = new ToolStripMenuItem(Lang.T("Günlüğü göster", "Show log"));
        showItem.Click += delegate { ToggleLog(); };
        pauseItem = new ToolStripMenuItem();
        pauseItem.Click += delegate { TogglePause(); };
        ToolStripMenuItem restartItem = new ToolStripMenuItem(Lang.T("Motoru yeniden başlat", "Restart engine"));
        restartItem.Click += delegate { RestartWorker(); };
        ToolStripMenuItem exitItem = new ToolStripMenuItem(Lang.T("Çıkış", "Exit"));
        exitItem.Click += delegate { ExitApplication(); };
        menu.Items.Add(showItem);
        menu.Items.Add(pauseItem);
        menu.Items.Add(restartItem);
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add(exitItem);

        tray = new NotifyIcon();
        tray.Icon = logWindow.Icon;
        tray.ContextMenuStrip = menu;
        tray.Visible = true;
        tray.DoubleClick += delegate { ToggleLog(); };

        refreshTimer = new System.Windows.Forms.Timer();
        refreshTimer.Interval = 400;
        refreshTimer.Tick += delegate { RefreshLog(); };
        refreshTimer.Start();

        try
        {
            StartWorker();
            Push(Lang.T("AutoAccept Lite bildirim alanında başladı.", "AutoAccept Lite started in the notification area."));
            tray.ShowBalloonTip(2500, "AutoAccept Lite", Lang.T(
                "Arka planda çalışıyor. Simgeye sağ tıklayıp günlüğü gösterebilir veya duraklatabilirsiniz.",
                "Running in the background. Right-click the icon to show the log or pause."), ToolTipIcon.Info);
        }
        catch
        {
            tray.Visible = false;
            tray.Dispose();
            throw;
        }
    }

    private void StartWorker()
    {
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
        info.EnvironmentVariables["AUTOACCEPT_LANG"] = Lang.Turkish ? "tr" : "en";
        Process process = new Process();
        process.StartInfo = info;
        process.EnableRaisingEvents = true;
        process.OutputDataReceived += OnOutput;
        process.ErrorDataReceived += OnOutput;
        process.Exited += OnWorkerExit;
        process.Start();
        process.BeginOutputReadLine();
        process.BeginErrorReadLine();
        worker = process;
        paused = false;
        UpdateStatus();
    }

    private bool WorkerRunning()
    {
        Process process = worker;
        try { return process != null && !process.HasExited; } catch (InvalidOperationException) { return false; }
    }

    private void UpdateStatus()
    {
        string state = !WorkerRunning() ? Lang.T("motor durdu", "engine stopped")
            : paused ? Lang.T("duraklatıldı", "paused") : Lang.T("çalışıyor", "running");
        tray.Text = "AutoAccept Lite - " + state;
        pauseItem.Text = paused ? Lang.T("Devam et", "Resume") : Lang.T("Duraklat", "Pause");
    }

    // Motorun cikti is parcaciklarindan cagrilir. Arayuze DOKUNMAZ: okuyucu bir kez
    // bile beklerse boru dolar ve node motoru console.log icinde donup kalir.
    private void OnOutput(object sender, DataReceivedEventArgs e)
    {
        if (!String.IsNullOrEmpty(e.Data)) Push(Ansi.Replace(e.Data, ""));
    }

    private void Push(string value)
    {
        lock (gate)
        {
            lines.Enqueue(value);
            while (lines.Count > MaxLines) lines.Dequeue();
            dirty = true;
        }
    }

    private void RefreshLog()
    {
        if (!logWindow.Visible) return;
        string text;
        lock (gate)
        {
            if (!dirty) return;
            dirty = false;
            text = String.Join(Environment.NewLine, lines.ToArray());
        }
        logText.Text = text;
        logText.SelectionStart = logText.TextLength;
        logText.ScrollToCaret();
    }

    private void OnWorkerExit(object sender, EventArgs e)
    {
        Process process = (Process)sender;
        int code;
        try { code = process.ExitCode; } catch (InvalidOperationException) { code = -1; }
        Push(String.Format(Lang.T("Motor kapandı (kod {0}).", "Engine stopped (code {0})."), code));
        try
        {
            logWindow.BeginInvoke(new Action(delegate
            {
                if (closing || restarting || !ReferenceEquals(process, worker)) return;
                UpdateStatus();
                tray.ShowBalloonTip(3000, "AutoAccept Lite", Lang.T(
                    "Motor durdu. Ayrıntı için günlüğe bakın; menüden yeniden başlatabilirsiniz.",
                    "The engine stopped. See the log for details; you can restart it from the menu."), ToolTipIcon.Warning);
            }));
        }
        catch (InvalidOperationException) { }
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
        lock (gate) { dirty = true; }
        RefreshLog();
    }

    private void TogglePause()
    {
        if (!WorkerRunning()) return;
        try
        {
            worker.StandardInput.WriteLine("p");
            worker.StandardInput.Flush();
            paused = !paused;
            UpdateStatus();
        }
        catch (Exception error)
        {
            if (!(error is InvalidOperationException) && !(error is IOException)) throw;
            Push(Lang.T("Duraklatma komutu gönderilemedi.", "Could not send the pause command."));
        }
    }

    // Motora duzgun kapanmasini soyler (gozlemciyi sayfadan soker); yanit vermezse sonlandirir.
    private void StopWorker()
    {
        Process process = worker;
        if (process == null) return;
        try
        {
            if (process.HasExited) return;
            process.StandardInput.WriteLine("q");
            process.StandardInput.Flush();
            if (!process.WaitForExit(8000)) process.Kill();
        }
        catch { try { if (!process.HasExited) process.Kill(); } catch { } }
    }

    private void RestartWorker()
    {
        if (closing || restarting) return;
        restarting = true;
        Push(Lang.T("Motor yeniden başlatılıyor...", "Restarting the engine..."));
        ThreadPool.QueueUserWorkItem(delegate
        {
            StopWorker();
            try
            {
                logWindow.BeginInvoke(new Action(delegate
                {
                    restarting = false;
                    if (closing) return;
                    try { StartWorker(); }
                    catch (Exception error) { Push(error.Message); UpdateStatus(); }
                }));
            }
            catch (InvalidOperationException) { }
        });
    }

    private void ExitApplication()
    {
        if (closing) return;
        closing = true;
        tray.Visible = false;
        ThreadPool.QueueUserWorkItem(delegate
        {
            StopWorker();
            try { logWindow.BeginInvoke(new Action(ExitThread)); }
            catch (InvalidOperationException) { }
        });
    }

    protected override void ExitThreadCore()
    {
        closing = true;
        refreshTimer.Dispose();
        tray.Visible = false;
        tray.Dispose();
        if (worker != null)
        {
            try { if (!worker.HasExited) worker.Kill(); } catch { }
            worker.Dispose();
        }
        logWindow.Dispose();
        base.ExitThreadCore();
    }
}
#endif
