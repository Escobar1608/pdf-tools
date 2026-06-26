@echo off
chcp 65001 >nul
cd /d "%~dp0backend"
if not exist venv\Scripts\python.exe (
    echo Primero ejecuta instalar.bat
    pause
    exit /b 1
)
echo ============================================
echo  PDF Tools - Servidor iniciado
echo  Local:       http://localhost:8000
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do echo  Red interna: http://%%a:8000
echo  ^(Ctrl+C para detener^)
echo ============================================
venv\Scripts\python -m uvicorn main:app --host 0.0.0.0 --port 8000
pause
