# Finds the Claude Desktop window and prints its handle and rectangle (physical
# pixels) as one JSON line whenever they change, for main.js to follow.
# (main.js makes her window owned by Claude's: Windows only lets a window's own
# process do that.)
param([Int64]$ChanHwnd)

Add-Type @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class Follow {
  [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr ctx);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr h, int attr, out RECT r, int size);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr h);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll", EntryPoint = "SetWindowLongPtrW")] public static extern IntPtr SetOwner(IntPtr h, int index, IntPtr owner);
  [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW")] public static extern IntPtr GetLong(IntPtr h, int index);
  [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr h, int attr, out int v, int size);
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc fn, IntPtr l);

  // The Claude window to follow: of the visible, titled, unowned top-level
  // windows of the given processes, the largest one (minimised ones count too,
  // so that minimising is noticed rather than switching to another window).
  public static IntPtr Find(HashSet<uint> pids, IntPtr skip) {
    IntPtr best = IntPtr.Zero; long bestArea = -1;
    EnumWindows((h, l) => {
      uint pid; GetWindowThreadProcessId(h, out pid);
      if (h == skip || !pids.Contains(pid) || !IsWindowVisible(h)) return true;
      if (GetWindowTextLength(h) == 0 || GetLong(h, -8) != IntPtr.Zero) return true;
      int cloaked; DwmGetWindowAttribute(h, 14, out cloaked, 4);   // DWMWA_CLOAKED
      if (cloaked != 0) return true;
      RECT r; DwmGetWindowAttribute(h, 9, out r, 16);
      long area = IsIconic(h) ? 0 : (long)(r.Right - r.Left) * (r.Bottom - r.Top);
      if (area > bestArea) { best = h; bestArea = area; }
      return true;
    }, IntPtr.Zero);
    return best;
  }
}
"@

# Per-monitor DPI aware, so the rectangle is in real pixels.
[Follow]::SetThreadDpiAwarenessContext([IntPtr](-4)) | Out-Null

$chan = [IntPtr]$ChanHwnd
$last = ''

while ($true) {
  $pids = New-Object 'System.Collections.Generic.HashSet[uint32]'
  Get-Process -Name claude -ErrorAction SilentlyContinue | ForEach-Object { [void]$pids.Add([uint32]$_.Id) }
  $h = [Follow]::Find($pids, $chan)

  if ($h -eq [IntPtr]::Zero) {
    $line = '{"found":false}'
  } else {
    $r = New-Object Follow+RECT
    # DWMWA_EXTENDED_FRAME_BOUNDS (9): the visible frame, without the invisible resize border.
    [Follow]::DwmGetWindowAttribute($h, 9, [ref]$r, 16) | Out-Null
    $min = [Follow]::IsIconic($h)
    $line = '{{"found":true,"hwnd":{5},"minimized":{0},"x":{1},"y":{2},"width":{3},"height":{4}}}' -f `
      $min.ToString().ToLower(), $r.Left, $r.Top, ($r.Right - $r.Left), ($r.Bottom - $r.Top), $h.ToInt64()
  }

  if ($line -ne $last) {
    [Console]::Out.WriteLine($line)
    [Console]::Out.Flush()
    $last = $line
  }
  Start-Sleep -Milliseconds 250
}
