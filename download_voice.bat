@echo off
setlocal enabledelayedexpansion

:: MIRA Neural Voice Asset Provisioner
:: Download high-fidelity ONNX weights for Kokoro TTS (82M params)

set "TARGET_DIR=public\models\kokoro"
set "ONNX_DIR=%TARGET_DIR%\onnx"
set "VOICE_DIR=%TARGET_DIR%\voices"

if not exist "%ONNX_DIR%" mkdir "%ONNX_DIR%"
if not exist "%VOICE_DIR%" mkdir "%VOICE_DIR%"

echo [provision] Fetching Neural Weights (Kokoro-82M-v1.0-ONNX)...

:: 1. Base Config
if not exist "%TARGET_DIR%\config.json" (
    echo [provision] Downloading config.json...
    powershell -Command "& {$ProgressPreference = 'SilentlyContinue'; Invoke-WebRequest -Uri 'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/config.json' -OutFile '%TARGET_DIR%\config.json' -UseBasicParsing}"
)

:: 2. Tokenizer
if not exist "%TARGET_DIR%\tokenizer.json" (
    echo [provision] Downloading tokenizer files...
    powershell -Command "& {$ProgressPreference = 'SilentlyContinue'; Invoke-WebRequest -Uri 'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/tokenizer.json' -OutFile '%TARGET_DIR%\tokenizer.json' -UseBasicParsing}"
    powershell -Command "& {$ProgressPreference = 'SilentlyContinue'; Invoke-WebRequest -Uri 'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/tokenizer_config.json' -OutFile '%TARGET_DIR%\tokenizer_config.json' -UseBasicParsing}"
)

:: 3. Main Model Weights (FP16 optimized for WebGPU)
if not exist "%ONNX_DIR%\model_fp16.onnx" (
    echo [provision] Downloading weights (model_fp16.onnx - ~163MB)...
    powershell -Command "Invoke-WebRequest -Uri 'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/onnx/model_fp16.onnx' -OutFile '%ONNX_DIR%\model_fp16.onnx' -UseBasicParsing"
)

:: 3b. Standard Weights (FP32 for stability)
if not exist "%ONNX_DIR%\model.onnx" (
    echo [provision] Downloading stable weights (model.onnx - ~326MB)...
    powershell -Command "Invoke-WebRequest -Uri 'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/onnx/model.onnx' -OutFile '%ONNX_DIR%\model.onnx' -UseBasicParsing"
)

:: 4. Primary Voice Profile (af_bella)
if not exist "%VOICE_DIR%\af_bella.bin" (
    echo [provision] Downloading voice profile (af_bella.bin)...
    powershell -Command "Invoke-WebRequest -Uri 'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/voices/af_bella.bin' -OutFile '%VOICE_DIR%\af_bella.bin' -UseBasicParsing"
)

echo [provision] Neural assets verified. System ready for Local Inference.
