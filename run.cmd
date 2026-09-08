@echo off
REM 실사용용 실행 스크립트. dev.cmd(next dev)와 달리 프로덕션 빌드로 띄운다.
REM 개발 서버는 요청마다 라우트를 컴파일하고 최적화를 끈 React를 쓰기 때문에
REM 같은 화면이라도 훨씬 느리다. 평소에 앱을 "쓸" 때는 이 스크립트를 쓸 것.
setlocal
set PATH=C:\Program Files\nodejs;%PATH%
cd /d "%~dp0"

call npm run build
if errorlevel 1 (
  echo.
  echo [!] 빌드 실패 - 위 오류를 확인하세요.
  pause
  exit /b 1
)

echo.
echo MyTodo: http://localhost:3000
call npm start
