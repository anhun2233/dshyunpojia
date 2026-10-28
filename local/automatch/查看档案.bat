@echo off
chcp 65001 >nul
set "PS=powershell"
where pwsh >nul 2>&1
if not errorlevel 1 (
  set "PS=pwsh"
) else (
  echo 建议安装 PowerShell 7，否则中文可能乱码；安装命令：winget install Microsoft.PowerShell
  echo.
)
"%PS%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0switch.ps1" -List
pause
