@echo off
title KivuSense - Lancement
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0LANCER_KIVUSENSE.ps1"
if errorlevel 1 (
  echo.
  echo Le lancement a rencontre une erreur. Lisez le message ci-dessus.
  pause
)
