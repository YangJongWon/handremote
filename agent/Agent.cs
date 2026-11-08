// handremote agent: lists, fits, captures and drives the PC's windows for the phone.
//
// Hosted by Windows PowerShell 5.1 (agent/win-agent.ps1 compiles this with Add-Type, so
// the language is C# 5: no string interpolation, no ?., no out var). It speaks JSON lines:
// one request {"id":n,"op":"...",...} per line in, one response {"id":n,"ok":true,...} out.
//
// Two modes:
//   stdio  the user's own agent, started by the handremote server (same user, same rights)
//   pipe   the SYSTEM helper's agent, started into the console session by Launcher; serves a
//          named pipe that only SYSTEM and the installing user may open, and follows the
//          input desktop (Default, or Winlogon for UAC prompts and the lock screen).
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.IO.Pipes;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;

namespace HandRemote
{
	public static class Native
	{
		public delegate bool EnumWindowsProc(IntPtr hwnd, IntPtr lParam);

		[StructLayout(LayoutKind.Sequential)]
		public struct RECT { public int Left, Top, Right, Bottom; }

		[StructLayout(LayoutKind.Sequential)]
		public struct POINT { public int X, Y; }

		[StructLayout(LayoutKind.Sequential)]
		public struct WINDOWPLACEMENT
		{
			public int length, flags, showCmd;
			public POINT ptMinPosition, ptMaxPosition;
			public RECT rcNormalPosition;
		}

		[StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
		public struct MONITORINFO
		{
			public int cbSize;
			public RECT rcMonitor, rcWork;
			public int dwFlags;
		}

		[StructLayout(LayoutKind.Sequential)]
		public struct MOUSEINPUT { public int dx, dy, mouseData, dwFlags, time; public IntPtr dwExtraInfo; }

		[StructLayout(LayoutKind.Sequential)]
		public struct KEYBDINPUT { public ushort wVk, wScan; public int dwFlags, time; public IntPtr dwExtraInfo; }

		[StructLayout(LayoutKind.Explicit)]
		public struct INPUTUNION
		{
			[FieldOffset(0)] public MOUSEINPUT mi;
			[FieldOffset(0)] public KEYBDINPUT ki;
		}

		[StructLayout(LayoutKind.Sequential)]
		public struct INPUT { public int type; public INPUTUNION u; }

		[DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr lParam);
		[DllImport("user32.dll")] public static extern bool IsWindow(IntPtr hwnd);
		[DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hwnd);
		[DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hwnd);
		[DllImport("user32.dll")] public static extern bool IsZoomed(IntPtr hwnd);
		[DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr hwnd, StringBuilder sb, int max);
		[DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetClassName(IntPtr hwnd, StringBuilder sb, int max);
		[DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr hwnd, int index);
		[DllImport("user32.dll")] public static extern IntPtr GetWindow(IntPtr hwnd, int cmd);
		[DllImport("user32.dll")] public static extern int GetWindowThreadProcessId(IntPtr hwnd, out int pid);
		[DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hwnd, out RECT r);
		[DllImport("user32.dll")] public static extern bool GetWindowPlacement(IntPtr hwnd, ref WINDOWPLACEMENT p);
		[DllImport("user32.dll")] public static extern bool SetWindowPlacement(IntPtr hwnd, ref WINDOWPLACEMENT p);
		[DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hwnd, IntPtr after, int x, int y, int w, int h, int flags);
		[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hwnd, int cmd);
		[DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern IntPtr CreateWindowEx(int ex, string cls, string name, int style, int x, int y, int w, int h, IntPtr parent, IntPtr menu, IntPtr inst, IntPtr param);
		[DllImport("user32.dll")] public static extern bool DestroyWindow(IntPtr hwnd);
		[DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hwnd, IntPtr hdc, int flags);
		[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
		[DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(POINT p);
		[DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr hwnd, int flags);
		[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hwnd);
		[DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr hwnd);
		[DllImport("user32.dll")] public static extern bool AttachThreadInput(int a, int b, bool attach);
		[DllImport("kernel32.dll")] public static extern int GetCurrentThreadId();
		[DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
		[DllImport("user32.dll", SetLastError = true)] public static extern int SendInput(int n, INPUT[] inputs, int size);
		[DllImport("user32.dll")] public static extern IntPtr MonitorFromWindow(IntPtr hwnd, int flags);
		[DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern bool GetMonitorInfo(IntPtr mon, ref MONITORINFO mi);
		[DllImport("user32.dll")] public static extern int GetDpiForWindow(IntPtr hwnd);
		[DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr ctx);
		[DllImport("user32.dll")] public static extern int GetSystemMetrics(int index);
		[DllImport("user32.dll")] public static extern IntPtr GetDC(IntPtr hwnd);
		[DllImport("user32.dll")] public static extern int ReleaseDC(IntPtr hwnd, IntPtr hdc);
		[DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern IntPtr FindWindow(string cls, string title);
		[DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern IntPtr FindWindowEx(IntPtr parent, IntPtr after, string cls, string title);
		[DllImport("user32.dll")] public static extern IntPtr SendMessageTimeout(IntPtr hwnd, int msg, IntPtr w, IntPtr l, int flags, int timeout, out IntPtr result);
		[DllImport("user32.dll", EntryPoint = "GetClassLongPtrW")] public static extern IntPtr GetClassLongPtr(IntPtr hwnd, int index);
		[DllImport("user32.dll", SetLastError = true)] public static extern IntPtr OpenInputDesktop(int flags, bool inherit, int access);
		[DllImport("user32.dll", SetLastError = true)] public static extern bool SetThreadDesktop(IntPtr hdesk);
		[DllImport("user32.dll")] public static extern bool CloseDesktop(IntPtr hdesk);
		[DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern bool GetUserObjectInformation(IntPtr obj, int index, StringBuilder sb, int len, out int needed);
		[DllImport("gdi32.dll")] public static extern bool BitBlt(IntPtr dst, int x, int y, int w, int h, IntPtr src, int sx, int sy, int rop);
		[DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr hwnd, int attr, out RECT r, int size);
		[DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr hwnd, int attr, out int v, int size);
		[DllImport("kernel32.dll")] public static extern IntPtr OpenProcess(int access, bool inherit, int pid);
		[DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr h);
		[DllImport("kernel32.dll", CharSet = CharSet.Unicode)] public static extern bool QueryFullProcessImageName(IntPtr h, int flags, StringBuilder sb, ref int size);
		[DllImport("kernel32.dll")] public static extern bool GetProcessTimes(IntPtr h, out long creation, out long exit, out long kernel, out long user);
		[DllImport("psapi.dll")] public static extern bool GetProcessMemoryInfo(IntPtr h, out PROCESS_MEMORY_COUNTERS c, int cb);
		[DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int InternalGetWindowText(IntPtr hwnd, StringBuilder sb, int max);
		[StructLayout(LayoutKind.Sequential)]
		public struct PROCESS_MEMORY_COUNTERS { public int cb, PageFaultCount; public IntPtr PeakWorkingSetSize, WorkingSetSize, QuotaPeakPagedPoolUsage, QuotaPagedPoolUsage, QuotaPeakNonPagedPoolUsage, QuotaNonPagedPoolUsage, PagefileUsage, PeakPagefileUsage; }
		[DllImport("advapi32.dll", SetLastError = true)] public static extern bool OpenProcessToken(IntPtr process, int access, out IntPtr token);
		[DllImport("advapi32.dll", SetLastError = true)] public static extern bool GetTokenInformation(IntPtr token, int cls, out int value, int len, out int ret);
		[DllImport("sas.dll")] public static extern void SendSAS(bool asUser);

		public const int GWL_STYLE = -16, GWL_EXSTYLE = -20;
		public const int WS_THICKFRAME = 0x40000, WS_EX_TOOLWINDOW = 0x80, WS_EX_APPWINDOW = 0x40000, WS_EX_TOPMOST = 0x8, WS_EX_TRANSPARENT = 0x20, WS_EX_NOACTIVATE = 0x8000000;
		public const int GW_OWNER = 4;
		public const int SW_RESTORE = 9;
		public const int SWP_NOZORDER = 0x4, SWP_NOACTIVATE = 0x10, SWP_NOSIZE = 0x1, SWP_NOMOVE = 0x2, SWP_SHOWWINDOW = 0x40;
		public const int DWMWA_EXTENDED_FRAME_BOUNDS = 9, DWMWA_CLOAKED = 14;
		public const int PW_RENDERFULLCONTENT = 2;
		public const int INPUT_MOUSE = 0, INPUT_KEYBOARD = 1;
		public const int MOUSEEVENTF_LEFTDOWN = 0x2, MOUSEEVENTF_LEFTUP = 0x4, MOUSEEVENTF_RIGHTDOWN = 0x8, MOUSEEVENTF_RIGHTUP = 0x10, MOUSEEVENTF_WHEEL = 0x800, MOUSEEVENTF_HWHEEL = 0x1000;
		public const int KEYEVENTF_EXTENDEDKEY = 0x1, KEYEVENTF_KEYUP = 0x2, KEYEVENTF_UNICODE = 0x4;
		public const int PROCESS_QUERY_LIMITED_INFORMATION = 0x1000, TOKEN_QUERY = 0x8, TokenElevation = 20;
		public const int WM_GETICON = 0x7F, GCLP_HICONSM = -34, GCLP_HICON = -14, SMTO_ABORTIFHUNG = 0x2;
		public static readonly IntPtr DPI_PER_MONITOR_V2 = new IntPtr(-4);
	}

	public class Agent
	{
		public const string Version = "1";
		readonly JavaScriptSerializer json = new JavaScriptSerializer { MaxJsonLength = int.MaxValue };
		readonly bool system;
		readonly Dictionary<int, KeyValuePair<DateTime, TimeSpan>> cpuSeen = new Dictionary<int, KeyValuePair<DateTime, TimeSpan>>();
		readonly HashSet<int> ownPids = new HashSet<int>();
		IntPtr desktop = IntPtr.Zero;
		string desktopName = "Default";

		Agent(bool system)
		{
			this.system = system;
			ownPids.Add(Process.GetCurrentProcess().Id);
		}

		// ------------------------------------------------------------------ hosting

		/// <summary>The user's agent: requests on stdin, responses on stdout.</summary>
		public static void RunStdio(int parentPid)
		{
			// Started hidden (STARTF_USESHOWWINDOW + SW_HIDE), Windows applies SW_HIDE to this
			// process's first ShowWindow or SetWindowPlacement, whichever window it is for: that
			// would hide the first window the phone gives back its size. A throwaway window takes it.
			IntPtr dummy = Native.CreateWindowEx(0, "STATIC", "", 0, 0, 0, 1, 1, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero);
			if (dummy != IntPtr.Zero) { Native.ShowWindow(dummy, 0); Native.DestroyWindow(dummy); }
			var agent = new Agent(false);
			if (parentPid > 0) agent.ownPids.Add(parentPid);
			var input = new StreamReader(Console.OpenStandardInput(), new UTF8Encoding(false));
			var output = new StreamWriter(Console.OpenStandardOutput(), new UTF8Encoding(false));
			output.AutoFlush = true;
			// The worker thread is the one that changes DPI awareness and (for the helper) the desktop.
			var t = new Thread(delegate () { agent.Serve(input, output); });
			t.Start();
			t.Join();
		}

		/// <summary>The SYSTEM helper's agent: one named pipe for SYSTEM and the installing user.</summary>
		public static void RunPipe(string pipeName, string secretFile, string userSid)
		{
			var security = new PipeSecurity();
			security.AddAccessRule(new PipeAccessRule(new SecurityIdentifier(WellKnownSidType.LocalSystemSid, null), PipeAccessRights.FullControl, AccessControlType.Allow));
			security.AddAccessRule(new PipeAccessRule(new SecurityIdentifier(userSid), PipeAccessRights.ReadWrite, AccessControlType.Allow));
			while (true)
			{
				string secret = File.ReadAllText(secretFile).Trim();
				using (var pipe = new NamedPipeServerStream(pipeName, PipeDirection.InOut, 1, PipeTransmissionMode.Byte, PipeOptions.None, 1 << 16, 1 << 16, security))
				{
					pipe.WaitForConnection();
					var input = new StreamReader(pipe, new UTF8Encoding(false));
					var output = new StreamWriter(pipe, new UTF8Encoding(false));
					output.AutoFlush = true;
					var agent = new Agent(true);
					var t = new Thread(delegate ()
					{
						try
						{
							string first = input.ReadLine();
							var hello = first == null ? null : agent.json.Deserialize<Dictionary<string, object>>(first);
							if (hello == null || !hello.ContainsKey("secret") || !SameSecret(Convert.ToString(hello["secret"]), secret))
							{
								output.WriteLine("{\"ok\":false,\"error\":\"denied\"}");
								return;
							}
							output.WriteLine("{\"ok\":true}");
							agent.Serve(input, output);
						}
						catch (IOException) { }
					});
					t.Start();
					t.Join();
				}
			}
		}

		static bool SameSecret(string a, string b)
		{
			if (a == null || b == null || a.Length != b.Length || b.Length < 16) return false;
			int diff = 0;
			for (int i = 0; i < a.Length; i++) diff |= a[i] ^ b[i];
			return diff == 0;
		}

		void Serve(TextReader input, TextWriter output)
		{
			Native.SetThreadDpiAwarenessContext(Native.DPI_PER_MONITOR_V2);
			string line;
			while ((line = input.ReadLine()) != null)
			{
				if (line.Length == 0) continue;
				object id = null;
				Dictionary<string, object> res;
				try
				{
					var req = json.Deserialize<Dictionary<string, object>>(line);
					req.TryGetValue("id", out id);
					if (system) FollowInputDesktop();
					res = Handle(req);
				}
				catch (Exception e)
				{
					res = new Dictionary<string, object>();
					res["ok"] = false;
					res["error"] = e.Message;
				}
				res["id"] = id;
				if (!res.ContainsKey("ok")) res["ok"] = true;
				output.WriteLine(Ascii(json.Serialize(res)));
			}
		}

		/// <summary>JSON with every non-ASCII character escaped, whatever the pipe's encoding.</summary>
		static string Ascii(string s)
		{
			var sb = new StringBuilder(s.Length);
			foreach (char c in s)
			{
				if (c < 128) sb.Append(c);
				else sb.Append("\\u").Append(((int)c).ToString("x4"));
			}
			return sb.ToString();
		}

		/// <summary>The helper works on whatever desktop takes input now: Default, or Winlogon.</summary>
		void FollowInputDesktop()
		{
			const int GENERIC_ALL = 0x10000000;
			IntPtr d = Native.OpenInputDesktop(0, false, GENERIC_ALL);
			if (d == IntPtr.Zero) return;
			if (!Native.SetThreadDesktop(d)) { Native.CloseDesktop(d); return; }
			if (desktop != IntPtr.Zero) Native.CloseDesktop(desktop);
			desktop = d;
			var sb = new StringBuilder(64);
			int needed;
			desktopName = Native.GetUserObjectInformation(d, 2, sb, sb.Capacity * 2, out needed) ? sb.ToString() : "?";
		}

		// ------------------------------------------------------------------ requests

		static int Int(Dictionary<string, object> r, string k, int def)
		{
			object v;
			return r.TryGetValue(k, out v) && v != null ? Convert.ToInt32(v) : def;
		}

		static long Long(Dictionary<string, object> r, string k)
		{
			object v;
			return r.TryGetValue(k, out v) && v != null ? Convert.ToInt64(v) : 0;
		}

		static double Dbl(Dictionary<string, object> r, string k, double def)
		{
			object v;
			return r.TryGetValue(k, out v) && v != null ? Convert.ToDouble(v) : def;
		}

		static string Str(Dictionary<string, object> r, string k)
		{
			object v;
			return r.TryGetValue(k, out v) && v != null ? Convert.ToString(v) : null;
		}

		Dictionary<string, object> Handle(Dictionary<string, object> r)
		{
			string op = Str(r, "op");
			IntPtr hwnd = new IntPtr(Long(r, "hwnd"));
			var res = new Dictionary<string, object>();
			switch (op)
			{
				case "hello":
					res["version"] = Version;
					res["pid"] = Process.GetCurrentProcess().Id;
					res["system"] = system;
					res["elevated"] = IsElevated(Process.GetCurrentProcess().Id);
					res["desktop"] = desktopName;
					return res;
				case "desktop":
					res["desktop"] = desktopName;
					return res;
				case "list":
					res["windows"] = ListWindows();
					res["desktop"] = desktopName;
					return res;
				case "icon":
					res["png"] = Icon(hwnd);
					return res;
				case "fit":
					return Fit(hwnd, Int(r, "w", 390), Int(r, "h", 780));
				case "restore":
					res["ok"] = Restore(hwnd, Str(r, "saved"));
					return res;
				case "frame":
					return Frame(hwnd, Int(r, "q", 70), Long(r, "crc"));
				case "mouse":
					Mouse(hwnd, Str(r, "t"), Dbl(r, "fx", 0.5), Dbl(r, "fy", 0.5), Int(r, "dy", 0), Int(r, "dx", 0));
					return res;
				case "text":
					Activate(hwnd);
					TypeText(Str(r, "s") ?? "");
					return res;
				case "key":
					Activate(hwnd);
					Key(Int(r, "vk", 0), Str(r, "mods") ?? "");
					return res;
				case "tray":
					res["items"] = Tray.List();
					return res;
				case "trayClick":
					return TrayClick(Str(r, "item"), Str(r, "button") == "right");
				case "proc":
					return ProcInfo(Int(r, "pid", 0));
				case "names":
					object pids;
					r.TryGetValue("pids", out pids);
					return Names(pids);
				case "sas":
					if (!system) throw new InvalidOperationException("only the SYSTEM helper can send Ctrl+Alt+Del");
					Native.SendSAS(false);
					return res;
				default:
					throw new ArgumentException("unknown op " + op);
			}
		}

		// ------------------------------------------------------------------ windows

		static readonly HashSet<string> ShellClasses = new HashSet<string>(new[] {
			"Progman", "WorkerW", "Shell_TrayWnd", "Shell_SecondaryTrayWnd", "NotifyIconOverflowWindow",
			"Windows.UI.Core.CoreWindow", "IME", "MSCTFIME UI", "tooltips_class32", "#32768", "SysShadow",
			"ForegroundStaging", "MultitaskingViewFrame", "EdgeUiInputTopWndClass", "TaskListThumbnailWnd",
			"Internet Explorer_Hidden", "Shell_InputSwitchTopLevelWindow", "XamlExplorerHostIslandWindow",
			"TopLevelWindowForOverflowXamlIsland", "Windows.Internal.Shell.TabProxyWindow", "PseudoConsoleWindow"
		});

		/// <summary>The title, read without a message to the window (a hung app cannot stall the list).</summary>
		static string Text(IntPtr hwnd)
		{
			var sb = new StringBuilder(512);
			Native.InternalGetWindowText(hwnd, sb, sb.Capacity);
			return sb.ToString();
		}

		static string ClassOf(IntPtr hwnd)
		{
			var sb = new StringBuilder(256);
			Native.GetClassName(hwnd, sb, sb.Capacity);
			return sb.ToString();
		}

		static bool Cloaked(IntPtr hwnd)
		{
			int v;
			return Native.DwmGetWindowAttribute(hwnd, Native.DWMWA_CLOAKED, out v, 4) == 0 && v != 0;
		}

		/// <summary>The visible bounds: the window rectangle without Windows 10's invisible resize borders.</summary>
		public static Native.RECT Bounds(IntPtr hwnd)
		{
			Native.RECT r;
			if (Native.DwmGetWindowAttribute(hwnd, Native.DWMWA_EXTENDED_FRAME_BOUNDS, out r, Marshal.SizeOf(typeof(Native.RECT))) != 0)
				Native.GetWindowRect(hwnd, out r);
			return r;
		}

		static string ProcessPath(int pid)
		{
			IntPtr h = Native.OpenProcess(Native.PROCESS_QUERY_LIMITED_INFORMATION, false, pid);
			if (h == IntPtr.Zero) return null;
			try
			{
				var sb = new StringBuilder(1024);
				int size = sb.Capacity;
				return Native.QueryFullProcessImageName(h, 0, sb, ref size) ? sb.ToString() : null;
			}
			finally { Native.CloseHandle(h); }
		}

		/// <summary>Elevated, or otherwise out of reach of this agent's input (Windows blocks it: UIPI).</summary>
		static bool IsElevated(int pid)
		{
			IntPtr h = Native.OpenProcess(Native.PROCESS_QUERY_LIMITED_INFORMATION, false, pid);
			if (h == IntPtr.Zero) return true;
			try
			{
				IntPtr token;
				if (!Native.OpenProcessToken(h, Native.TOKEN_QUERY, out token)) return true;
				try
				{
					int elevated, ret;
					return Native.GetTokenInformation(token, Native.TokenElevation, out elevated, 4, out ret) && elevated != 0;
				}
				finally { Native.CloseHandle(token); }
			}
			finally { Native.CloseHandle(h); }
		}

		bool? selfElevated;
		bool SelfElevated()
		{
			if (selfElevated == null) selfElevated = IsElevated(Process.GetCurrentProcess().Id);
			return selfElevated.Value;
		}

		List<object> ListWindows()
		{
			var list = new List<object>();
			var seenPids = new HashSet<int>();
			bool selfElevated = SelfElevated();
			Native.EnumWindows(delegate (IntPtr hwnd, IntPtr l)
			{
				if (!Native.IsWindowVisible(hwnd) || Cloaked(hwnd)) return true;
				string cls = ClassOf(hwnd);
				if (ShellClasses.Contains(cls)) return true;
				int pid;
				Native.GetWindowThreadProcessId(hwnd, out pid);
				if (ownPids.Contains(pid)) return true;
				int ex = Native.GetWindowLong(hwnd, Native.GWL_EXSTYLE);
				int style = Native.GetWindowLong(hwnd, Native.GWL_STYLE);
				if ((ex & Native.WS_EX_TRANSPARENT) != 0) return true; // click-through overlays
				bool minimized = Native.IsIconic(hwnd);
				var b = Bounds(hwnd);
				int w = b.Right - b.Left, h = b.Bottom - b.Top;
				if (!minimized && (w < 40 || h < 24)) return true;
				string title = Text(hwnd);
				bool tool = (ex & Native.WS_EX_TOOLWINDOW) != 0 && (ex & Native.WS_EX_APPWINDOW) == 0;
				string kind;
				if (!tool && title.Length > 0) kind = "app";
				else if (!minimized && w >= 40 && h >= 40) kind = "widget";
				else return true;
				string path = ProcessPath(pid);
				var win = new Dictionary<string, object>();
				win["hwnd"] = hwnd.ToInt64();
				win["title"] = title;
				win["cls"] = cls;
				win["pid"] = pid;
				win["proc"] = path == null ? "" : Path.GetFileNameWithoutExtension(path);
				win["path"] = path ?? "";
				win["kind"] = kind;
				win["min"] = minimized;
				win["max"] = Native.IsZoomed(hwnd);
				win["topmost"] = (ex & Native.WS_EX_TOPMOST) != 0;
				win["resizable"] = (style & Native.WS_THICKFRAME) != 0;
				win["fg"] = Native.GetForegroundWindow() == hwnd;
				win["w"] = w;
				win["h"] = h;
				// The user's agent cannot drive elevated windows; the SYSTEM helper can.
				win["elevated"] = !selfElevated && !system && IsElevated(pid);
				AddUsage(win, pid, seenPids);
				list.Add(win);
				return true;
			}, IntPtr.Zero);
			return list;
		}

		/// <summary>CPU (since the last list) and memory, through a process handle: no process snapshot.</summary>
		void AddUsage(Dictionary<string, object> win, int pid, HashSet<int> seen)
		{
			IntPtr h = Native.OpenProcess(Native.PROCESS_QUERY_LIMITED_INFORMATION | 0x10, false, pid); // | PROCESS_VM_READ
			if (h == IntPtr.Zero) h = Native.OpenProcess(Native.PROCESS_QUERY_LIMITED_INFORMATION, false, pid);
			if (h == IntPtr.Zero) return;
			try
			{
				Native.PROCESS_MEMORY_COUNTERS mc;
				if (Native.GetProcessMemoryInfo(h, out mc, Marshal.SizeOf(typeof(Native.PROCESS_MEMORY_COUNTERS)))) win["mem"] = mc.WorkingSetSize.ToInt64();
				long c, e, k, u;
				if (!Native.GetProcessTimes(h, out c, out e, out k, out u)) return;
				DateTime now = DateTime.UtcNow;
				TimeSpan cpu = TimeSpan.FromTicks(k + u);
				KeyValuePair<DateTime, TimeSpan> last;
				if (cpuSeen.TryGetValue(pid, out last) && (now - last.Key).TotalMilliseconds > 200)
				{
					double pct = (cpu - last.Value).TotalMilliseconds / (now - last.Key).TotalMilliseconds / Environment.ProcessorCount * 100;
					win["cpu"] = Math.Round(Math.Max(0, pct), 1);
				}
				if (!seen.Contains(pid)) cpuSeen[pid] = new KeyValuePair<DateTime, TimeSpan>(now, cpu);
				seen.Add(pid);
			}
			finally { Native.CloseHandle(h); }
		}

		/// <summary>Executable names for process ids (the servers' list), without a process snapshot.</summary>
		static Dictionary<string, object> Names(object pids)
		{
			var res = new Dictionary<string, object>();
			var names = new Dictionary<string, object>();
			var list = pids as System.Collections.IEnumerable;
			if (list != null)
				foreach (object o in list)
				{
					int pid = Convert.ToInt32(o);
					string path = ProcessPath(pid);
					if (path != null) names[pid.ToString()] = Path.GetFileNameWithoutExtension(path);
				}
			res["names"] = names;
			return res;
		}

		static string Icon(IntPtr hwnd)
		{
			IntPtr hicon;
			Native.SendMessageTimeout(hwnd, Native.WM_GETICON, new IntPtr(2), IntPtr.Zero, Native.SMTO_ABORTIFHUNG, 200, out hicon); // ICON_SMALL2
			if (hicon == IntPtr.Zero) Native.SendMessageTimeout(hwnd, Native.WM_GETICON, new IntPtr(0), IntPtr.Zero, Native.SMTO_ABORTIFHUNG, 200, out hicon);
			if (hicon == IntPtr.Zero) hicon = Native.GetClassLongPtr(hwnd, Native.GCLP_HICONSM);
			if (hicon == IntPtr.Zero) Native.SendMessageTimeout(hwnd, Native.WM_GETICON, new IntPtr(1), IntPtr.Zero, Native.SMTO_ABORTIFHUNG, 200, out hicon);
			if (hicon == IntPtr.Zero) hicon = Native.GetClassLongPtr(hwnd, Native.GCLP_HICON);
			if (hicon == IntPtr.Zero) return null;
			try
			{
				using (var icon = System.Drawing.Icon.FromHandle(hicon))
				using (var bmp = icon.ToBitmap())
				using (var ms = new MemoryStream())
				{
					bmp.Save(ms, ImageFormat.Png);
					return Convert.ToBase64String(ms.ToArray());
				}
			}
			catch (Exception) { return null; }
		}

		static string SavePlacement(IntPtr hwnd)
		{
			var p = new Native.WINDOWPLACEMENT();
			p.length = Marshal.SizeOf(p);
			Native.GetWindowPlacement(hwnd, ref p);
			var n = p.rcNormalPosition;
			return string.Join(",", new[] { p.flags, p.showCmd, n.Left, n.Top, n.Right, n.Bottom, p.ptMinPosition.X, p.ptMinPosition.Y, p.ptMaxPosition.X, p.ptMaxPosition.Y });
		}

		static bool Restore(IntPtr hwnd, string saved)
		{
			if (!Native.IsWindow(hwnd) || string.IsNullOrEmpty(saved)) return false;
			var v = saved.Split(',');
			if (v.Length < 10) return false;
			var p = new Native.WINDOWPLACEMENT();
			p.length = Marshal.SizeOf(p);
			p.flags = int.Parse(v[0]);
			p.showCmd = int.Parse(v[1]);
			p.rcNormalPosition.Left = int.Parse(v[2]);
			p.rcNormalPosition.Top = int.Parse(v[3]);
			p.rcNormalPosition.Right = int.Parse(v[4]);
			p.rcNormalPosition.Bottom = int.Parse(v[5]);
			p.ptMinPosition.X = int.Parse(v[6]);
			p.ptMinPosition.Y = int.Parse(v[7]);
			p.ptMaxPosition.X = int.Parse(v[8]);
			p.ptMaxPosition.Y = int.Parse(v[9]);
			// Restoring a window to minimized would leave the PC as the phone found it, but
			// the phone may have just un-minimized it to work in it: keep it shown then.
			if (p.showCmd == 2 || p.showCmd == 6 || p.showCmd == 7) p.showCmd = 2;
			bool wasVisible = Native.IsWindowVisible(hwnd);
			bool ok = Native.SetWindowPlacement(hwnd, ref p);
			KeepVisible(hwnd, wasVisible);
			return ok;
		}

		/// <summary>A window that was on screen stays on screen, whatever Windows made of the call.</summary>
		static void KeepVisible(IntPtr hwnd, bool wasVisible)
		{
			if (wasVisible && !Native.IsWindowVisible(hwnd)) Native.ShowWindow(hwnd, 4); // SW_SHOWNOACTIVATE
		}

		/// <summary>
		/// Lays the window out for the phone: its visible frame becomes the phone's viewport
		/// (CSS px × the window's DPI scale), so the app reflows instead of shrinking. A window
		/// that cannot be resized, or would not fit the monitor, keeps or caps its size.
		/// </summary>
		Dictionary<string, object> Fit(IntPtr hwnd, int cssW, int cssH)
		{
			if (!Native.IsWindow(hwnd)) throw new ArgumentException("window closed");
			var res = new Dictionary<string, object>();
			res["saved"] = SavePlacement(hwnd);
			if (Native.IsIconic(hwnd) || Native.IsZoomed(hwnd))
			{
				Native.ShowWindow(hwnd, Native.SW_RESTORE);
				KeepVisible(hwnd, true);
			}
			int style = Native.GetWindowLong(hwnd, Native.GWL_STYLE);
			bool resizable = (style & Native.WS_THICKFRAME) != 0;
			res["resized"] = false;
			if (resizable && cssW > 0 && cssH > 0)
			{
				double scale = Math.Max(1, Native.GetDpiForWindow(hwnd)) / 96.0;
				var mi = new Native.MONITORINFO();
				mi.cbSize = Marshal.SizeOf(mi);
				Native.GetMonitorInfo(Native.MonitorFromWindow(hwnd, 2), ref mi);
				int workW = mi.rcWork.Right - mi.rcWork.Left, workH = mi.rcWork.Bottom - mi.rcWork.Top;
				double w = cssW * scale, h = cssH * scale;
				double cap = Math.Min(1, Math.Min(workW / w, workH / h));
				w *= cap;
				h *= cap;
				Native.RECT outer, frame = Bounds(hwnd);
				Native.GetWindowRect(hwnd, out outer);
				// The invisible borders Windows adds around the visible frame.
				int padL = frame.Left - outer.Left, padT = frame.Top - outer.Top, padR = outer.Right - frame.Right, padB = outer.Bottom - frame.Bottom;
				int x = Math.Max(mi.rcWork.Left, Math.Min(frame.Left, mi.rcWork.Right - (int)w));
				int y = Math.Max(mi.rcWork.Top, Math.Min(frame.Top, mi.rcWork.Bottom - (int)h));
				Native.SetWindowPos(hwnd, IntPtr.Zero, x - padL, y - padT, (int)w + padL + padR, (int)h + padT + padB, Native.SWP_NOZORDER | Native.SWP_NOACTIVATE);
				res["resized"] = true;
			}
			var b = Bounds(hwnd);
			res["w"] = b.Right - b.Left;
			res["h"] = b.Bottom - b.Top;
			return res;
		}

		// ------------------------------------------------------------------ capture

		static ImageCodecInfo jpegCodec;

		static ImageCodecInfo Jpeg()
		{
			if (jpegCodec != null) return jpegCodec;
			foreach (var c in ImageCodecInfo.GetImageEncoders()) if (c.MimeType == "image/jpeg") jpegCodec = c;
			return jpegCodec;
		}

		/// <summary>
		/// One JPEG of the window (hwnd 0: the whole primary screen of the input desktop), or
		/// { same: true } when nothing changed since the frame whose checksum is `crc`.
		/// </summary>
		Dictionary<string, object> Frame(IntPtr hwnd, int quality, long crc)
		{
			var res = new Dictionary<string, object>();
			Bitmap bmp;
			if (hwnd == IntPtr.Zero) bmp = CaptureScreen();
			else
			{
				if (!Native.IsWindow(hwnd)) throw new ArgumentException("window closed");
				bmp = CaptureWindow(hwnd);
			}
			using (bmp)
			{
				long sum = Checksum(bmp);
				res["crc"] = sum;
				res["w"] = bmp.Width;
				res["h"] = bmp.Height;
				res["desktop"] = desktopName;
				if (sum == crc) { res["same"] = true; return res; }
				using (var ms = new MemoryStream())
				{
					var ps = new EncoderParameters(1);
					ps.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, (long)Math.Max(20, Math.Min(95, quality)));
					bmp.Save(ms, Jpeg(), ps);
					res["jpeg"] = Convert.ToBase64String(ms.ToArray());
				}
			}
			return res;
		}

		static Bitmap CaptureWindow(IntPtr hwnd)
		{
			Native.RECT outer, frame = Bounds(hwnd);
			Native.GetWindowRect(hwnd, out outer);
			int ow = Math.Max(1, outer.Right - outer.Left), oh = Math.Max(1, outer.Bottom - outer.Top);
			int fw = Math.Max(1, frame.Right - frame.Left), fh = Math.Max(1, frame.Bottom - frame.Top);
			var full = new Bitmap(ow, oh, PixelFormat.Format32bppRgb);
			bool printed;
			using (var g = Graphics.FromImage(full))
			{
				IntPtr hdc = g.GetHdc();
				printed = Native.PrintWindow(hwnd, hdc, Native.PW_RENDERFULLCONTENT);
				g.ReleaseHdc(hdc);
			}
			if (!printed)
			{
				// Some windows refuse PrintWindow: copy what the screen shows there instead.
				full.Dispose();
				return CaptureRect(frame.Left, frame.Top, fw, fh);
			}
			var crop = new Rectangle(frame.Left - outer.Left, frame.Top - outer.Top, fw, fh);
			crop.Intersect(new Rectangle(0, 0, ow, oh));
			if (crop.Width <= 0 || crop.Height <= 0) return full;
			var bmp = full.Clone(crop, PixelFormat.Format32bppRgb);
			full.Dispose();
			return bmp;
		}

		static Bitmap CaptureScreen()
		{
			return CaptureRect(0, 0, Native.GetSystemMetrics(0), Native.GetSystemMetrics(1));
		}

		static Bitmap CaptureRect(int x, int y, int w, int h)
		{
			var bmp = new Bitmap(Math.Max(1, w), Math.Max(1, h), PixelFormat.Format32bppRgb);
			using (var g = Graphics.FromImage(bmp))
			{
				IntPtr dst = g.GetHdc();
				IntPtr src = Native.GetDC(IntPtr.Zero);
				Native.BitBlt(dst, 0, 0, w, h, src, x, y, 0x00CC0020 | 0x40000000); // SRCCOPY | CAPTUREBLT
				Native.ReleaseDC(IntPtr.Zero, src);
				g.ReleaseHdc(dst);
			}
			return bmp;
		}

		static long Checksum(Bitmap bmp)
		{
			var data = bmp.LockBits(new Rectangle(0, 0, bmp.Width, bmp.Height), ImageLockMode.ReadOnly, PixelFormat.Format32bppRgb);
			try
			{
				int n = data.Stride * data.Height / 4;
				var px = new int[n];
				Marshal.Copy(data.Scan0, px, 0, n);
				unchecked
				{
					long h = 1469598103934665603L;
					for (int i = 0; i < n; i++) h = (h ^ px[i]) * 1099511628211L;
					return (h ^ bmp.Width ^ ((long)bmp.Height << 20)) & 0x1FFFFFFFFFFFFFL; // fits a JS number
				}
			}
			finally { bmp.UnlockBits(data); }
		}

		// ------------------------------------------------------------------ input

		/// <summary>The window, or one of its own dialogs or popups, has the keyboard now.</summary>
		static bool HasFocus(IntPtr hwnd)
		{
			IntPtr fg = Native.GetForegroundWindow();
			for (int i = 0; fg != IntPtr.Zero && i < 8; i++)
			{
				if (fg == hwnd) return true;
				fg = Native.GetWindow(fg, Native.GW_OWNER);
			}
			int a, b;
			Native.GetWindowThreadProcessId(Native.GetForegroundWindow(), out a);
			Native.GetWindowThreadProcessId(hwnd, out b);
			return a == b && ClassOf(Native.GetForegroundWindow()) == "#32768";
		}

		/// <summary>
		/// Brings the window to the front so the input that follows lands in it, and refuses
		/// (throws, sending nothing) when Windows keeps another window in front: input sent
		/// anyway would go to whatever window the PC has in front.
		/// </summary>
		static void Activate(IntPtr hwnd)
		{
			if (hwnd == IntPtr.Zero) return; // the whole screen (secure desktop): input goes where it points
			if (!Native.IsWindow(hwnd)) throw new ArgumentException("window closed");
			if (ClassOf(hwnd) == "#32768") return; // a popup menu takes input without focus
			if (HasFocus(hwnd)) return;
			if (Native.IsIconic(hwnd)) Native.ShowWindow(hwnd, Native.SW_RESTORE);
			for (int attempt = 0; attempt < 3 && !HasFocus(hwnd); attempt++)
			{
				// Windows refuses the foreground to a background process, except while Alt is
				// held down. A key that means nothing (VK 0xFF) before Alt is let go keeps the
				// window from opening its menu bar on the lone Alt release.
				int pid;
				int fgThread = Native.GetWindowThreadProcessId(Native.GetForegroundWindow(), out pid);
				int me = Native.GetCurrentThreadId();
				bool attached = fgThread != 0 && fgThread != me && Native.AttachThreadInput(me, fgThread, true);
				Send(KeyIn(0x12, 0, 0));
				Native.BringWindowToTop(hwnd);
				Native.SetForegroundWindow(hwnd);
				Send(KeyIn(0xFF, 0, 0), KeyIn(0xFF, 0, Native.KEYEVENTF_KEYUP), KeyIn(0x12, 0, Native.KEYEVENTF_KEYUP));
				if (attached) Native.AttachThreadInput(me, fgThread, false);
				Thread.Sleep(40 + attempt * 60);
			}
			if (!HasFocus(hwnd)) throw new InvalidOperationException("not-front: Windows kept another window in front, so nothing was sent");
		}

		/// <summary>The point belongs to the window (not to another window covering it).</summary>
		static bool PointIsOn(IntPtr hwnd, int x, int y)
		{
			var p = new Native.POINT();
			p.X = x;
			p.Y = y;
			IntPtr at = Native.GetAncestor(Native.WindowFromPoint(p), 2); // GA_ROOT
			if (at == hwnd) return true;
			for (IntPtr o = Native.GetWindow(at, Native.GW_OWNER); o != IntPtr.Zero; o = Native.GetWindow(o, Native.GW_OWNER))
				if (o == hwnd) return true;
			return false;
		}

		static void Send(params Native.INPUT[] inputs)
		{
			Native.SendInput(inputs.Length, inputs, Marshal.SizeOf(typeof(Native.INPUT)));
		}

		static Native.INPUT MouseIn(int flags, int data)
		{
			var i = new Native.INPUT();
			i.type = Native.INPUT_MOUSE;
			i.u.mi.dwFlags = flags;
			i.u.mi.mouseData = data;
			return i;
		}

		static Native.INPUT KeyIn(ushort vk, ushort scan, int flags)
		{
			var i = new Native.INPUT();
			i.type = Native.INPUT_KEYBOARD;
			i.u.ki.wVk = vk;
			i.u.ki.wScan = scan;
			i.u.ki.dwFlags = flags;
			return i;
		}

		/// <summary>t: click, right, double, down, move, up, wheel. fx/fy: where, as a fraction of the frame.</summary>
		static void Mouse(IntPtr hwnd, string t, double fx, double fy, int dy, int dx)
		{
			Native.RECT b;
			if (hwnd == IntPtr.Zero) { b.Left = 0; b.Top = 0; b.Right = Native.GetSystemMetrics(0); b.Bottom = Native.GetSystemMetrics(1); }
			else b = Bounds(hwnd);
			int x = b.Left + (int)Math.Round(Math.Max(0, Math.Min(1, fx)) * (b.Right - b.Left - 1));
			int y = b.Top + (int)Math.Round(Math.Max(0, Math.Min(1, fy)) * (b.Bottom - b.Top - 1));
			if (t != "move" && t != "up") Activate(hwnd);
			// Another window (always on top, a toast) may still cover that spot: never click it instead.
			if (hwnd != IntPtr.Zero && t != "up" && !PointIsOn(hwnd, x, y))
				throw new InvalidOperationException("covered: another window covers that spot on the PC, so nothing was sent");
			Native.SetCursorPos(x, y);
			switch (t)
			{
				case "click": Send(MouseIn(Native.MOUSEEVENTF_LEFTDOWN, 0), MouseIn(Native.MOUSEEVENTF_LEFTUP, 0)); break;
				case "double": Send(MouseIn(Native.MOUSEEVENTF_LEFTDOWN, 0), MouseIn(Native.MOUSEEVENTF_LEFTUP, 0), MouseIn(Native.MOUSEEVENTF_LEFTDOWN, 0), MouseIn(Native.MOUSEEVENTF_LEFTUP, 0)); break;
				case "right": Send(MouseIn(Native.MOUSEEVENTF_RIGHTDOWN, 0), MouseIn(Native.MOUSEEVENTF_RIGHTUP, 0)); break;
				case "down": Send(MouseIn(Native.MOUSEEVENTF_LEFTDOWN, 0)); break;
				case "up": Send(MouseIn(Native.MOUSEEVENTF_LEFTUP, 0)); break;
				case "move": break;
				case "wheel":
					if (dy != 0) Send(MouseIn(Native.MOUSEEVENTF_WHEEL, dy));
					if (dx != 0) Send(MouseIn(Native.MOUSEEVENTF_HWHEEL, dx));
					break;
				default: throw new ArgumentException("unknown mouse action " + t);
			}
		}

		/// <summary>Text as Unicode key events: any script, no keyboard layout or IME involved.</summary>
		static void TypeText(string s)
		{
			var list = new List<Native.INPUT>();
			foreach (char c in s.Replace("\r\n", "\n"))
			{
				if (c == '\n')
				{
					list.Add(KeyIn(0x0D, 0, 0));
					list.Add(KeyIn(0x0D, 0, Native.KEYEVENTF_KEYUP));
					continue;
				}
				list.Add(KeyIn(0, c, Native.KEYEVENTF_UNICODE));
				list.Add(KeyIn(0, c, Native.KEYEVENTF_UNICODE | Native.KEYEVENTF_KEYUP));
			}
			if (list.Count > 0) Send(list.ToArray());
		}

		static readonly HashSet<int> Extended = new HashSet<int>(new[] { 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, 0x2D, 0x2E, 0x5B, 0x5C, 0x6F, 0x90 });

		/// <summary>A virtual key with modifiers ("ctrl,shift,alt,win").</summary>
		static void Key(int vk, string mods)
		{
			var mod = new List<ushort>();
			foreach (var m in mods.Split(','))
			{
				if (m == "ctrl") mod.Add(0x11);
				else if (m == "shift") mod.Add(0x10);
				else if (m == "alt") mod.Add(0x12);
				else if (m == "win") mod.Add(0x5B);
			}
			var list = new List<Native.INPUT>();
			foreach (var m in mod) list.Add(KeyIn(m, 0, m == 0x5B ? Native.KEYEVENTF_EXTENDEDKEY : 0));
			if (vk != 0)
			{
				int ext = Extended.Contains(vk) ? Native.KEYEVENTF_EXTENDEDKEY : 0;
				list.Add(KeyIn((ushort)vk, 0, ext));
				list.Add(KeyIn((ushort)vk, 0, ext | Native.KEYEVENTF_KEYUP));
			}
			for (int i = mod.Count - 1; i >= 0; i--) list.Add(KeyIn(mod[i], 0, Native.KEYEVENTF_KEYUP | (mod[i] == 0x5B ? Native.KEYEVENTF_EXTENDEDKEY : 0)));
			if (list.Count > 0) Send(list.ToArray());
		}

		// ------------------------------------------------------------------ tray

		/// <summary>Clicks a tray icon and returns the window it opened (a menu or a flyout), if any.</summary>
		Dictionary<string, object> TrayClick(string item, bool right)
		{
			var before = new HashSet<long>();
			Native.EnumWindows(delegate (IntPtr h, IntPtr l) { if (Native.IsWindowVisible(h)) before.Add(h.ToInt64()); return true; }, IntPtr.Zero);
			IntPtr fgBefore = Native.GetForegroundWindow();
			var pt = Tray.Locate(item);
			if (pt == null) throw new ArgumentException("tray icon not found");
			Native.SetCursorPos(pt.Value.X, pt.Value.Y);
			if (right) Send(MouseIn(Native.MOUSEEVENTF_RIGHTDOWN, 0), MouseIn(Native.MOUSEEVENTF_RIGHTUP, 0));
			else Send(MouseIn(Native.MOUSEEVENTF_LEFTDOWN, 0), MouseIn(Native.MOUSEEVENTF_LEFTUP, 0));
			IntPtr opened = IntPtr.Zero;
			for (int i = 0; i < 12 && opened == IntPtr.Zero; i++)
			{
				Thread.Sleep(100);
				Native.EnumWindows(delegate (IntPtr h, IntPtr l)
				{
					if (opened != IntPtr.Zero || !Native.IsWindowVisible(h) || before.Contains(h.ToInt64()) || Cloaked(h)) return true;
					var b = Bounds(h);
					if (b.Right - b.Left < 20 || b.Bottom - b.Top < 20) return true;
					string cls = ClassOf(h);
					if (cls == "tooltips_class32" || cls == "SysShadow") return true;
					opened = h;
					return true;
				}, IntPtr.Zero);
				if (opened == IntPtr.Zero)
				{
					IntPtr fg = Native.GetForegroundWindow();
					if (fg != fgBefore && fg != IntPtr.Zero && !ShellClasses.Contains(ClassOf(fg)) && i >= 3) opened = fg;
				}
			}
			var res = new Dictionary<string, object>();
			res["opened"] = opened.ToInt64();
			if (opened != IntPtr.Zero)
			{
				res["title"] = Text(opened);
				res["cls"] = ClassOf(opened);
			}
			return res;
		}

		// ------------------------------------------------------------------ processes

		static Dictionary<string, object> ProcInfo(int pid)
		{
			var res = new Dictionary<string, object>();
			res["pid"] = pid;
			res["path"] = ProcessPath(pid) ?? "";
			try
			{
				using (var p = Process.GetProcessById(pid))
				{
					res["name"] = p.ProcessName;
					res["mem"] = p.WorkingSet64;
					try { res["start"] = p.StartTime.ToUniversalTime().ToString("o"); } catch (Exception) { }
				}
			}
			catch (Exception) { res["gone"] = true; }
			try
			{
				using (var s = new System.Management.ManagementObjectSearcher("SELECT CommandLine FROM Win32_Process WHERE ProcessId=" + pid))
				foreach (System.Management.ManagementObject o in s.Get())
				{
					res["cmd"] = Convert.ToString(o["CommandLine"]);
					o.Dispose();
				}
			}
			catch (Exception) { }
			return res;
		}
	}

	/// <summary>The notification area through UI Automation: Windows 10 toolbars, Windows 11 buttons.</summary>
	public static class Tray
	{
		static List<KeyValuePair<string, System.Windows.Automation.AutomationElement>> Items()
		{
			var found = new List<KeyValuePair<string, System.Windows.Automation.AutomationElement>>();
			var cond = System.Windows.Automation.Condition.TrueCondition;
			IntPtr tray = Native.FindWindow("Shell_TrayWnd", null);
			if (tray == IntPtr.Zero) return found;
			// Windows 10: Shell_TrayWnd > TrayNotifyWnd > SysPager > ToolbarWindow32, and the overflow window's toolbar.
			IntPtr notify = Native.FindWindowEx(tray, IntPtr.Zero, "TrayNotifyWnd", null);
			IntPtr pager = notify == IntPtr.Zero ? IntPtr.Zero : Native.FindWindowEx(notify, IntPtr.Zero, "SysPager", null);
			IntPtr promoted = pager == IntPtr.Zero ? IntPtr.Zero : Native.FindWindowEx(pager, IntPtr.Zero, "ToolbarWindow32", null);
			IntPtr overflowWnd = Native.FindWindow("NotifyIconOverflowWindow", null);
			IntPtr overflow = overflowWnd == IntPtr.Zero ? IntPtr.Zero : Native.FindWindowEx(overflowWnd, IntPtr.Zero, "ToolbarWindow32", null);
			if (promoted != IntPtr.Zero || overflow != IntPtr.Zero)
			{
				if (promoted != IntPtr.Zero)
				{
					int i = 0;
					foreach (System.Windows.Automation.AutomationElement e in System.Windows.Automation.AutomationElement.FromHandle(promoted).FindAll(System.Windows.Automation.TreeScope.Children, cond))
						found.Add(new KeyValuePair<string, System.Windows.Automation.AutomationElement>("p" + (i++), e));
				}
				if (overflow != IntPtr.Zero)
				{
					int i = 0;
					foreach (System.Windows.Automation.AutomationElement e in System.Windows.Automation.AutomationElement.FromHandle(overflow).FindAll(System.Windows.Automation.TreeScope.Children, cond))
						found.Add(new KeyValuePair<string, System.Windows.Automation.AutomationElement>("o" + (i++), e));
				}
				return found;
			}
			// Windows 11: XAML buttons somewhere under the taskbar.
			int n = 0;
			var buttons = System.Windows.Automation.AutomationElement.FromHandle(tray).FindAll(System.Windows.Automation.TreeScope.Descendants,
				new System.Windows.Automation.PropertyCondition(System.Windows.Automation.AutomationElement.ControlTypeProperty, System.Windows.Automation.ControlType.Button));
			foreach (System.Windows.Automation.AutomationElement e in buttons)
			{
				string cls = e.Current.ClassName ?? "";
				string aid = e.Current.AutomationId ?? "";
				if (cls.IndexOf("SystemTray", StringComparison.OrdinalIgnoreCase) >= 0 || aid.StartsWith("NotifyItemIcon", StringComparison.OrdinalIgnoreCase))
					found.Add(new KeyValuePair<string, System.Windows.Automation.AutomationElement>("x" + (n++), e));
			}
			return found;
		}

		public static List<object> List()
		{
			var list = new List<object>();
			foreach (var kv in Items())
			{
				string name;
				try { name = kv.Value.Current.Name; } catch (Exception) { continue; }
				if (string.IsNullOrEmpty(name)) continue;
				var item = new Dictionary<string, object>();
				item["item"] = kv.Key + ":" + name;
				item["name"] = name;
				item["hidden"] = kv.Key.StartsWith("o");
				list.Add(item);
			}
			return list;
		}

		/// <summary>Where to click the icon; an icon in the overflow opens the overflow first.</summary>
		public static Native.POINT? Locate(string item)
		{
			if (item == null) return null;
			for (int attempt = 0; attempt < 2; attempt++)
			{
				foreach (var kv in Items())
				{
					string name;
					try { name = kv.Value.Current.Name; } catch (Exception) { continue; }
					if (kv.Key + ":" + name != item && !(name == item.Substring(item.IndexOf(':') + 1) && kv.Key[0] == item[0])) continue;
					var r = kv.Value.Current.BoundingRectangle;
					if (!r.IsEmpty && r.Width > 0 && !kv.Value.Current.IsOffscreen)
					{
						var p = new Native.POINT();
						p.X = (int)(r.Left + r.Width / 2);
						p.Y = (int)(r.Top + r.Height / 2);
						return p;
					}
					if (kv.Key.StartsWith("o") && attempt == 0) OpenOverflow();
					break;
				}
				Thread.Sleep(350);
			}
			return null;
		}

		static void OpenOverflow()
		{
			IntPtr tray = Native.FindWindow("Shell_TrayWnd", null);
			IntPtr notify = Native.FindWindowEx(tray, IntPtr.Zero, "TrayNotifyWnd", null);
			IntPtr chevron = Native.FindWindowEx(notify, IntPtr.Zero, "Button", null);
			if (chevron == IntPtr.Zero) return;
			object pattern;
			var el = System.Windows.Automation.AutomationElement.FromHandle(chevron);
			if (el.TryGetCurrentPattern(System.Windows.Automation.InvokePattern.Pattern, out pattern))
				((System.Windows.Automation.InvokePattern)pattern).Invoke();
		}
	}

	/// <summary>
	/// The SYSTEM helper's launcher (a startup task in session 0): keeps one agent running in
	/// the active console session with the SYSTEM token, so it can reach the secure desktop.
	/// </summary>
	public static class Launcher
	{
		[StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
		struct STARTUPINFO
		{
			public int cb;
			public string lpReserved, lpDesktop, lpTitle;
			public int dwX, dwY, dwXSize, dwYSize, dwXCountChars, dwYCountChars, dwFillAttribute, dwFlags;
			public short wShowWindow, cbReserved2;
			public IntPtr lpReserved2, hStdInput, hStdOutput, hStdError;
		}

		[StructLayout(LayoutKind.Sequential)]
		struct PROCESS_INFORMATION { public IntPtr hProcess, hThread; public int dwProcessId, dwThreadId; }

		[StructLayout(LayoutKind.Sequential, Pack = 4)]
		struct LUID_AND_ATTRIBUTES { public long Luid; public int Attributes; }

		[StructLayout(LayoutKind.Sequential, Pack = 4)]
		struct TOKEN_PRIVILEGES { public int Count; public LUID_AND_ATTRIBUTES Privilege; }

		[DllImport("kernel32.dll")] static extern int WTSGetActiveConsoleSessionId();
		[DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
		[DllImport("advapi32.dll", SetLastError = true)] static extern bool OpenProcessToken(IntPtr p, int access, out IntPtr token);
		[DllImport("advapi32.dll", SetLastError = true)] static extern bool DuplicateTokenEx(IntPtr token, int access, IntPtr attrs, int level, int type, out IntPtr dup);
		[DllImport("advapi32.dll", SetLastError = true)] static extern bool SetTokenInformation(IntPtr token, int cls, ref int value, int len);
		[DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)] static extern bool LookupPrivilegeValue(string system, string name, out long luid);
		[DllImport("advapi32.dll", SetLastError = true)] static extern bool AdjustTokenPrivileges(IntPtr token, bool disableAll, ref TOKEN_PRIVILEGES p, int len, IntPtr prev, IntPtr ret);
		[DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
		static extern bool CreateProcessAsUser(IntPtr token, string app, string cmd, IntPtr pa, IntPtr ta, bool inherit, int flags, IntPtr env, string dir, ref STARTUPINFO si, out PROCESS_INFORMATION pi);
		[DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
		[DllImport("kernel32.dll")] static extern bool TerminateProcess(IntPtr h, int code);
		[DllImport("kernel32.dll")] static extern int WaitForSingleObject(IntPtr h, int ms);

		static void Enable(IntPtr token, string name)
		{
			long luid;
			if (!LookupPrivilegeValue(null, name, out luid)) return;
			var tp = new TOKEN_PRIVILEGES();
			tp.Count = 1;
			tp.Privilege.Luid = luid;
			tp.Privilege.Attributes = 2; // SE_PRIVILEGE_ENABLED
			AdjustTokenPrivileges(token, false, ref tp, Marshal.SizeOf(tp), IntPtr.Zero, IntPtr.Zero);
		}

		static IntPtr Spawn(string cmd, int session)
		{
			IntPtr self, dup;
			if (!OpenProcessToken(GetCurrentProcess(), 0xF01FF, out self)) throw new Win32Exception();
			try
			{
				Enable(self, "SeTcbPrivilege");
				Enable(self, "SeAssignPrimaryTokenPrivilege");
				Enable(self, "SeIncreaseQuotaPrivilege");
				if (!DuplicateTokenEx(self, 0xF01FF, IntPtr.Zero, 2, 1, out dup)) throw new Win32Exception(); // SecurityImpersonation, TokenPrimary
			}
			finally { CloseHandle(self); }
			try
			{
				if (!SetTokenInformation(dup, 12, ref session, 4)) throw new Win32Exception(); // TokenSessionId
				var si = new STARTUPINFO();
				si.cb = Marshal.SizeOf(si);
				si.lpDesktop = "winsta0\\default";
				PROCESS_INFORMATION pi;
				if (!CreateProcessAsUser(dup, null, cmd, IntPtr.Zero, IntPtr.Zero, false, 0x08000000 | 0x00000400, IntPtr.Zero, null, ref si, out pi)) // CREATE_NO_WINDOW | CREATE_UNICODE_ENVIRONMENT
					throw new Win32Exception();
				CloseHandle(pi.hThread);
				return pi.hProcess;
			}
			finally { CloseHandle(dup); }
		}

		public static void Run(string agentCmd, string logFile)
		{
			IntPtr child = IntPtr.Zero;
			int childSession = -1;
			while (true)
			{
				try
				{
					int session = WTSGetActiveConsoleSessionId();
					bool alive = child != IntPtr.Zero && WaitForSingleObject(child, 0) != 0;
					if (session != -1 && session != 0 && (!alive || session != childSession))
					{
						if (child != IntPtr.Zero) { TerminateProcess(child, 0); CloseHandle(child); child = IntPtr.Zero; }
						child = Spawn(agentCmd, session);
						childSession = session;
						File.AppendAllText(logFile, DateTime.Now.ToString("s") + " agent started in session " + session + "\r\n");
					}
				}
				catch (Exception e)
				{
					try { File.AppendAllText(logFile, DateTime.Now.ToString("s") + " " + e.Message + "\r\n"); } catch (Exception) { }
				}
				Thread.Sleep(2000);
			}
		}
	}
}
