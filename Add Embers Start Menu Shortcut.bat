@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "PS_SCRIPT=%SCRIPT_DIR%scripts\create-start-menu-shortcut.ps1"

if not exist "%PS_SCRIPT%" (
  echo Could not find shortcut script at: %PS_SCRIPT%
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%PS_SCRIPT%"
if errorlevel 1 (
  echo Failed to create Start Menu shortcut.
  pause
  exit /b 1
)

echo.
echo Shortcut created successfully. You can now launch Embers from the Start Menu.
pause
