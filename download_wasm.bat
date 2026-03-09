@echo off
echo ============================================
echo MIRA - Downloading Model WASM Binaries
echo ============================================
echo.
echo This will download ~4GB of data. Make sure you have:
echo - A stable internet connection
echo - At least 5GB of free disk space
echo.
pause

echo.
echo [1/2] Downloading Llama 3.1 8B WASM (~3.5GB)...
powershell -Command "& {$ProgressPreference = 'SilentlyContinue'; Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_80/Llama-3_1-8B-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm' -OutFile 'public\models\Llama-3.1-8B-Instruct-q4f16_1-MLC\library.wasm' -UseBasicParsing}"

if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to download Llama 3.1 8B WASM
    pause
    exit /b 1
)

echo [SUCCESS] Llama 3.1 8B WASM downloaded
echo.

echo [2/2] Downloading Llama 3.2 1B WASM (~500MB)...
powershell -Command "& {$ProgressPreference = 'SilentlyContinue'; Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_80/Llama-3.2-1B-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm' -OutFile 'public\models\Llama-3.2-1B-Instruct-q4f16_1-MLC\library.wasm' -UseBasicParsing}"

if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to download Llama 3.2 1B WASM
    pause
    exit /b 1
)

echo [SUCCESS] Llama 3.2 1B WASM downloaded
echo.
echo ============================================
echo ALL WASM BINARIES DOWNLOADED SUCCESSFULLY
echo ============================================
echo.
echo You can now run: npm start
echo.
pause
