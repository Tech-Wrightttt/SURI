@echo off
setlocal

rem Starts the SURI API and Next.js app in separate Command Prompt windows.
set "PROJECT_ROOT=%~dp0"
set "VENV_ACTIVATE=%PROJECT_ROOT%backend\venv\Scripts\activate.bat"

if not exist "%VENV_ACTIVATE%" (
    echo Could not find backend\venv\Scripts\activate.bat.
    exit /b 1
)

if not exist "%PROJECT_ROOT%frontend\package.json" (
    echo Could not find frontend\package.json. Run this file from the project root.
    exit /b 1
)

start "SURI Backend" /D "%PROJECT_ROOT%" cmd.exe /k "call ""%VENV_ACTIVATE%"" ^&^& uvicorn backend.main:app --reload"
start "SURI Frontend" /D "%PROJECT_ROOT%frontend" cmd.exe /k "npm run dev"

endlocal
