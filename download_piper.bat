@echo off
setlocal

set PIPER_DIR=%~dp0bin\piper
set MODEL_DIR=%~dp0models\piper
set VOICE=en_US-kristin-medium

echo [PIPER] Creating directories...
if not exist "%PIPER_DIR%" mkdir "%PIPER_DIR%"
if not exist "%MODEL_DIR%" mkdir "%MODEL_DIR%"

echo [PIPER] Downloading Piper binary...
powershell -Command "Invoke-WebRequest -Uri 'https://github.com/rhasspy/piper/releases/latest/download/piper_windows_amd64.zip' -OutFile '%PIPER_DIR%\piper.zip'"
powershell -Command "Expand-Archive -Path '%PIPER_DIR%\piper.zip' -DestinationPath '%PIPER_DIR%' -Force"
del "%PIPER_DIR%\piper.zip"

echo [PIPER] Downloading voice model (%VOICE%)...
powershell -Command "Invoke-WebRequest -Uri 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/kristin/medium/en_US-kristin-medium.onnx' -OutFile '%MODEL_DIR%\%VOICE%.onnx'"
powershell -Command "Invoke-WebRequest -Uri 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/kristin/medium/en_US-kristin-medium.onnx.json' -OutFile '%MODEL_DIR%\%VOICE%.onnx.json'"

echo [PIPER] Setup complete!
pause
