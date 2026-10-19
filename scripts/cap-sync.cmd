@echo off
set PATH=C:\Users\hussi\AppData\Local\nvm\v20.18.0;%PATH%
echo Building B's Mart Web Assets and Syncing Capacitor...
call npm run build
if %ERRORLEVEL% NEQ 0 exit /b %ERRORLEVEL%
call npx cap sync
