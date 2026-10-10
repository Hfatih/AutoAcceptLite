@echo off
title AutoAccept Lite - Antigravity
cd /d "%~dp0"
node index.js
if errorlevel 1 (
    echo.
    echo Hata olustu. Node.js kurulu mu? "node -v" ile kontrol et.
    pause
)
