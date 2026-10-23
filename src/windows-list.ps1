$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public class CaptureWindows {
  public delegate bool Callback(IntPtr hwnd, IntPtr lparam);
  [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left, Top, Right, Bottom; }
  public class Entry { public string handle; public int x,y,width,height; }
  [DllImport("user32.dll")] static extern bool EnumWindows(Callback cb, IntPtr param);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hwnd);
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr hwnd);
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr hwnd, out Rect rect);
  [DllImport("user32.dll")] static extern IntPtr SetThreadDpiAwarenessContext(IntPtr value);
  [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr hwnd, int attribute, out Rect rect, int size);
  [DllImport("dwmapi.dll", EntryPoint="DwmGetWindowAttribute")] static extern int GetCloaked(IntPtr hwnd, int attribute, out int value, int size);
  public static List<Entry> List() {
    var result = new List<Entry>();
    var previous = SetThreadDpiAwarenessContext(new IntPtr(-4));
    try {
      EnumWindows((hwnd,param) => {
        int cloaked;
        if (!IsWindowVisible(hwnd) || IsIconic(hwnd) || (GetCloaked(hwnd,14,out cloaked,4)==0 && cloaked!=0)) return true;
        Rect rect;
        if (DwmGetWindowAttribute(hwnd,9,out rect,Marshal.SizeOf(typeof(Rect)))!=0 && !GetWindowRect(hwnd,out rect)) return true;
        if (rect.Right>rect.Left && rect.Bottom>rect.Top) result.Add(new Entry {handle=hwnd.ToInt64().ToString(),x=rect.Left,y=rect.Top,width=rect.Right-rect.Left,height=rect.Bottom-rect.Top});
        return true;
      },IntPtr.Zero);
    } finally { if(previous!=IntPtr.Zero) SetThreadDpiAwarenessContext(previous); }
    return result;
  }
}
'@
$items = @([CaptureWindows]::List())
ConvertTo-Json -InputObject $items -Compress
