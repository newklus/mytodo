# 로그인 시 MyTodo 프로덕션 서버(포트 3333)를 백그라운드로 자동 기동하는
# 작업 스케줄러 태스크(MyTodoServer)를 등록한다. 관리자 권한 불필요(현재 사용자 로그온 트리거).
#
# 중복 기동 방지: MultipleInstances=IgnoreNew로, 이미 서버가 도는 중이면 새로 안 띄운다.
# (게다가 next start가 포트 3333을 이미 점유한 상태면 두 번째 프로세스는 바로 실패하므로 이중 안전장치)
$ErrorActionPreference = "Stop"

$taskName = "MyTodoServer"
$scriptDir = $PSScriptRoot
$vbsPath = Join-Path $scriptDir "autostart-hidden.vbs"

$action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$vbsPath`""
$trigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERNAME"
$settings = New-ScheduledTaskSettingsSet `
  -MultipleInstances IgnoreNew `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings `
  -Description "MyTodo 프로덕션 서버를 로그인 시 자동 기동 (http://localhost:3333)" -Force | Out-Null

Write-Host "등록 완료: 다음 로그인부터 MyTodo 서버가 자동으로 뜹니다 (작업 이름: $taskName)"
Write-Host "지금 바로 테스트하려면: Start-ScheduledTask -TaskName '$taskName'"
Write-Host "제거하려면: autostart-uninstall.ps1 실행"
