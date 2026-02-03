@echo off
REM Setup Windows Task Scheduler for TheHive Recurring Events
REM Run this script as Administrator

echo TheHive - Recurring Events Task Scheduler Setup
echo ==================================================
echo.

REM Get the script directory
set SCRIPT_DIR=%~dp0
set PROJECT_ROOT=%SCRIPT_DIR%..
set NODE_PATH=C:\Program Files\nodejs\node.exe
set TASK_NAME=TheHive-WeeklyEvents

echo Project root: %PROJECT_ROOT%
echo Node.js path: %NODE_PATH%
echo Task name: %TASK_NAME%
echo.

REM Check if running as admin
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This script must be run as Administrator!
    echo Right-click and select "Run as administrator"
    pause
    exit /b 1
)

echo Creating scheduled task...
echo.

REM Create task to run every Sunday at 11:00 PM
schtasks /create /tn "%TASK_NAME%" /tr "\"%NODE_PATH%\" \"%PROJECT_ROOT%\dist\scripts\generate-weekly-events.js\"" /sc weekly /d SUN /st 23:00 /f

if %errorLevel% equ 0 (
    echo Task created successfully!
    echo.
    echo Task details:
    echo   Name: %TASK_NAME%
    echo   Schedule: Every Sunday at 11:00 PM
    echo   Action: Generate weekly events
    echo.
    echo To view the task: schtasks /query /tn "%TASK_NAME%"
    echo To run manually: schtasks /run /tn "%TASK_NAME%"
    echo To delete: schtasks /delete /tn "%TASK_NAME%" /f
    echo.
) else (
    echo ERROR: Failed to create scheduled task
    echo Make sure you have administrator privileges
)

echo.
echo Alternative: Run manually with npm
echo   cd %PROJECT_ROOT%
echo   npm run events:generate
echo.

pause
