@echo off
setlocal
cd /d "%~dp0"

set "AI_DIR=%~dp0ai-service"
set "API_DIR=%~dp0api-server"
set "DASHBOARD_DIR=%~dp0dashboard"

if not exist "%AI_DIR%" (
  echo AI service folder not found.
  exit /b 1
)

if not exist "%API_DIR%" (
  echo API server folder not found.
  exit /b 1
)

if not exist "%DASHBOARD_DIR%" (
  echo Dashboard folder not found.
  exit /b 1
)

set "TF_ENABLE_ONEDNN_OPTS=0"

start "SasviAkka AI Service" cmd /k "cd /d "%AI_DIR%" && python app.py"
start "SasviAkka API Server" cmd /k "cd /d "%API_DIR%" && npm start"
start "SasviAkka Dashboard" cmd /k "cd /d "%DASHBOARD_DIR%" && npm run dev"

echo All services started.
echo AI Service: http://127.0.0.1:5001
echo API Server: http://127.0.0.1:5000
echo Dashboard: http://127.0.0.1:5173
pause
