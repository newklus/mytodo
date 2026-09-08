' 작업 스케줄러(MyTodoServer)가 wscript.exe로 이 파일을 실행한다.
' cmd 창을 그대로 띄우면 로그인할 때마다 콘솔 창이 보여서, WScript.Shell.Run의
' 세 번째 인자(WindowStyle=0=숨김)로 autostart-server.cmd를 백그라운드에서 돌린다.
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
shell.Run """" & scriptDir & "\autostart-server.cmd""", 0, False
