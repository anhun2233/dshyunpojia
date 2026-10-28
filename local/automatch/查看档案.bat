@echo off
chcp 65001 >nul
set "PS=powershell"
where pwsh >nul 2>&1
if not errorlevel 1 set "PS=pwsh"
"%PS%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0switch.ps1" -List
pause
