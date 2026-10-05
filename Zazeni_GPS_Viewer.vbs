Set WshShell = CreateObject("WScript.Shell")
strCurrentDir = "c:\Users\galza\Documents\nameščeni programi\Moji\GPS Sequence"
WshShell.CurrentDirectory = strCurrentDir
WshShell.Run "pythonw.exe """ & strCurrentDir & "\desktop\server.py""", 0, False
WScript.Sleep 400
WshShell.Run "http://localhost:8050/"
