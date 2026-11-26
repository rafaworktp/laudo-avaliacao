@echo off
cd /d "%~dp0"
if "%ADMIN_PASSWORD%"=="" set ADMIN_PASSWORD=laudo123
echo.
echo  Painel: http://127.0.0.1:8787/index.html
echo  Senha:  %ADMIN_PASSWORD%
echo.
start "" cmd /c "timeout /t 2 >nul & start http://127.0.0.1:8787/index.html"
node server.js
pause
