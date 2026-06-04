@echo off
echo FridgeTok - מפעיל שרת מקומי...
cd /d "%~dp0"
start "" "http://localhost:8080/index-standalone.html"
python -m http.server 8080
pause
