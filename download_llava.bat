@echo off
setlocal enabledelayedexpansion

mkdir models 2>nul
cd models

echo [MIRA] Downloading LLaVA v1.6 Vicuna 7B Components...

:download_model
echo [INFO] Downloading LLaVA 1.6 Main Model (Q4_K_M)...
curl -L -C - --retry 10 --retry-delay 5 -o llava-v1.6-7b.gguf "https://huggingface.co/cjpais/llava-1.6-vicuna-7b-gguf/resolve/main/llava-v1.6-vicuna-7b-Q4_K_M.gguf"
if %ERRORLEVEL% NEQ 0 (
    echo [RETRY] Main model download failed. Retrying in 10s...
    timeout /t 10
    goto download_model
)

:download_mmproj
echo [INFO] Downloading LLaVA 1.6 Vision mmproj...
curl -L -C - --retry 10 --retry-delay 5 -o llava-v1.6-7b-mmproj.gguf "https://huggingface.co/cjpais/llava-1.6-vicuna-7b-gguf/resolve/main/mmproj-model-f16.gguf"
if %ERRORLEVEL% NEQ 0 (
    echo [RETRY] mmproj download failed. Retrying in 10s...
    timeout /t 10
    goto download_mmproj
)

echo [SUCCESS] LLaVA v1.6 components ready.
pause
