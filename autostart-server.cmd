@echo off
REM 로그인 시 작업 스케줄러(MyTodoServer 태스크)가 이 스크립트를 백그라운드로 실행한다.
REM run.cmd와 달리 매번 다시 빌드하지 않는다 — 이미 빌드가 있으면 그걸 그대로 기동해서
REM 로그인 직후 지연을 줄인다. 빌드가 없을 때(최초 1회 등)만 새로 빌드한다.
setlocal
set PATH=C:\Program Files\nodejs;%PATH%
cd /d "%~dp0"

if not exist ".next\BUILD_ID" (
  call npm run build
)

call npm start
