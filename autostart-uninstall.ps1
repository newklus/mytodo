# autostart-install.ps1가 등록한 로그인 자동기동 태스크(MyTodoServer)를 제거한다.
# 이미 떠 있는 서버 프로세스는 건드리지 않는다 — 다음 로그인부터 자동으로 안 켜지게만 한다.
$ErrorActionPreference = "Stop"

$taskName = "MyTodoServer"

if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
  Write-Host "제거 완료: 로그인 자동기동이 해제됐습니다 ($taskName)"
} else {
  Write-Host "등록된 작업이 없습니다 ($taskName) — 이미 제거된 상태입니다"
}
