@echo off
REM Convenience-Starter für Windows.
REM Legt eine Virtual Environment an, installiert Dependencies und startet die App.
setlocal

cd /d "%~dp0"

if not exist ".venv" (
    echo Lege Virtual Environment an ...
    python -m venv .venv
    if errorlevel 1 goto :error
)

call .venv\Scripts\activate.bat

if not exist ".venv\.deps_installed" (
    echo Installiere Dependencies ...
    python -m pip install --upgrade pip
    pip install -r requirements.txt
    if errorlevel 1 goto :error
    echo. > .venv\.deps_installed
)

echo Starte Paletten Optimierer ...
python run_app.py
goto :eof

:error
echo.
echo Fehler beim Setup. Bitte Python 3.10+ installieren.
pause
exit /b 1
