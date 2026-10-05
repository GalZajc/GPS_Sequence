@echo off
chcp 65001 > nul
title GPS Sequence - Satelitski pregledovalnik
cd /d "%~dp0"

echo ==================================================
echo   Zaganjam GPS Sequence satelitski pregledovalnik...
echo ==================================================

start "" "http://localhost:8050"
python server.py

pause
