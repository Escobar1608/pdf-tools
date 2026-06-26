@echo off
chcp 65001 >nul
echo ============================================
echo  PDF Tools - Instalacion (solo una vez)
echo ============================================
cd /d "%~dp0backend"
echo Creando entorno virtual...
python -m venv venv
if errorlevel 1 (
    echo ERROR: No se encontro Python. Instalalo desde python.org marcando "Add python.exe to PATH".
    pause
    exit /b 1
)
echo Instalando dependencias...
venv\Scripts\pip install -r requirements.txt
if errorlevel 1 (
    echo ERROR: Fallo la instalacion de dependencias. Revisa conexion a internet o proxy.
    pause
    exit /b 1
)
echo.
echo Instalacion completada. Usa ejecutar.bat para iniciar el servidor.
pause
