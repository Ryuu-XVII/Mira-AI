@echo off
setlocal enabledelayedexpansion

mkdir models 2>nul
cd models

echo [MIRA] Downloading Llama 3.2 11B Vision Components...

:download_model
echo [INFO] Downloading/Resuming Main Model GGUF (approx 7.9GB)...
curl -L -C - --retry 10 --retry-delay 5 -o llama-3.2-11b-vision.gguf "https://huggingface.co/leafspark/Llama-3.2-11B-Vision-Instruct-GGUF/resolve/main/Llama-3.2-11B-Vision-Instruct.Q4_K_M.gguf"
if %ERRORLEVEL% NEQ 0 (
    echo [RETRY] Main model download failed. Retrying in 10s...
    timeout /t 10
    goto download_model
)

:download_mmproj
echo [INFO] Downloading/Resuming Vision mmproj...
curl -L -C - --retry 10 --retry-delay 5 -o llama-3.2-11b-vision-mmproj.gguf "https://huggingface.co/leafspark/Llama-3.2-11B-Vision-Instruct-GGUF/resolve/main/Llama-3.2-11B-Vision-Instruct-mmproj.f16.gguf"
if %ERRORLEVEL% NEQ 0 (
    echo [RETRY] mmproj download failed. Retrying in 10s...
    timeout /t 10
    goto download_mmproj
)

echo [SUCCESS] Llama 3.2 11B Vision components ready.
pause
