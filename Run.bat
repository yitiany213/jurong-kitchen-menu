@echo off
cd /d "%~dp0"
start "" http://localhost:8780
echo Jurong Kitchen menu running at http://localhost:8780  (phones on the same Wi-Fi: http://THIS-PC-IP:8780)
python -m http.server 8780 --bind 0.0.0.0
