@echo off
chcp 65001 > nul
title GPS Sequence - Satelitski pregledovalnik
cd /d "%~dp0"

echo ==================================================
echo   Zaganjam GPS Sequence satelitski pregledovalnik...
echo   Naslov: http://localhost:8050
echo ==================================================

python server.py
if errorlevel 1 (
    echo.
    echo Napaka pri zagonu strežnika.
    pause
)
