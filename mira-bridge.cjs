const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { KokoroTTS } = require('kokoro-js');

const BRIDGE_PORT = 3002;
const OLLAMA_PORT = 11434;

// Global State
let modelLoaded = false;
let isModelLoading = false;
let lastLogLine = "Waiting for request...";
let kokoro = null;

async function initializeTTS() {
    if (kokoro) return;
    log('Initializing Kokoro TTS Engine...');
    try {
        // Paths are relative to the project root
        const modelPath = path.join(__dirname, '..', 'public', 'models', 'kokoro');
        kokoro = await KokoroTTS.from_pretrained(modelPath, {
            dtype: "fp16", // Faster inference on modern CPUs
            device: "cpu"
        });
        // Pre-warm the engine by generating a tiny silent chunk
        await kokoro.generate(".", { voice: 'af_bella', speed: 1.15 });
        log('Kokoro TTS Engine READY and WARMED.');
    } catch (err) {
        log(`TTS Init Error: ${err.message}`);
    }
}

/**
 * Encodes Float32Array PCM into a valid WAV Buffer (16-bit, Mono, 24kHz)
 */
function encodeWav(samples, sampleRate = 24000) {
    const buffer = Buffer.alloc(44 + samples.length * 2);
    /* RIFF identifier */ buffer.write('RIFF', 0);
    /* file length */ buffer.writeUInt32LE(36 + samples.length * 2, 4);
    /* RIFF type */ buffer.write('WAVE', 8);
    /* format chunk identifier */ buffer.write('fmt ', 12);
    /* format chunk length */ buffer.writeUInt32LE(16, 16);
    /* sample format (raw) */ buffer.writeUInt16LE(1, 20);
    /* channel count */ buffer.writeUInt16LE(1, 22);
    /* sample rate */ buffer.writeUInt32LE(sampleRate, 24);
    /* byte rate (sample rate * block align) */ buffer.writeUInt32LE(sampleRate * 2, 28);
    /* block align (channel count * bytes per sample) */ buffer.writeUInt16LE(2, 32);
    /* bits per sample */ buffer.writeUInt16LE(16, 34);
    /* data chunk identifier */ buffer.write('data', 36);
    /* data chunk length */ buffer.writeUInt32LE(samples.length * 2, 40);

    for (let i = 0; i < samples.length; i++) {
        let s = Math.max(-1, Math.min(1, samples[i]));
        buffer.writeInt16LE(s < 0 ? s * 0x8000 : s * 0x7FFF, 44 + i * 2);
    }
    return buffer;
}

const ttsQueue = []; // Queue of text segments to be generated
const audioQueue = []; // Queue of generated WAV buffers ready for playback
let isTtsGenerating = false;
let audioHost = null;
let currentBufferIdx = 0;
let isFirstSegment = true; // For Adaptive Buffering

function initializeAudioHost() {
    if (audioHost) return;
    log('Initializing Persistent Audio Host (V11 Recovery)...');
    // Start shell with -NoProfile and -NonInteractive for speed
    audioHost = spawn('powershell', ['-noprofile', '-noninteractive', '-Command', '-'], { stdio: ['pipe', 'inherit', 'inherit'] });
    // Pre-load the SoundPlayer type
    audioHost.stdin.write('[void][System.Reflection.Assembly]::LoadWithPartialName("System.Media")\n');
}

function trimSilence(pcmData, threshold = 0.005) { // V10: Lower threshold for soft word starts
    let start = 0;
    while (start < pcmData.length && Math.abs(pcmData[start]) < threshold) start++;
    let end = pcmData.length - 1;
    while (end > start && Math.abs(pcmData[end]) < threshold) end--;
    return pcmData.slice(start, end + 1);
}

async function processTtsGeneration() {
    if (isTtsGenerating || ttsQueue.length === 0) return;
    isTtsGenerating = true;
    const text = ttsQueue.shift();

    const genStart = Date.now();
    try {
        if (!kokoro) await initializeTTS();

        const audio = await kokoro.generate(text, { voice: 'af_bella', speed: 1.15 });

        // V9: Trim silence to prevent gaps between segments
        const trimmedAudio = trimSilence(audio.audio);
        const wavBuffer = encodeWav(trimmedAudio, 24000);

        const genDuration = Date.now() - genStart;
        log(`[GenTime: ${genDuration}ms] Generated: "${text.substring(0, 20)}..."`);

        audioQueue.push({ text, buffer: wavBuffer });

        // Start playing if idle
        processAudioQueue();

        isTtsGenerating = false;
        processTtsGeneration();
    } catch (e) {
        log(`TTS Generation Error: ${e.message}`);
        isTtsGenerating = false;
        processTtsGeneration();
    }
}

async function processAudioQueue() {
    // V12: Path-Safe Proactive Command Queue. Absolute reliability focus.
    if (audioQueue.length === 0) return;

    const { text, buffer } = audioQueue.shift();
    const playStart = Date.now();

    try {
        if (!audioHost) initializeAudioHost();

        // Alternating buffers (A, B, C) to allow writing while playing previous
        const bufferLabels = ['A', 'B', 'C'];
        currentBufferIdx = (currentBufferIdx % 3) + 1;
        const label = bufferLabels[currentBufferIdx - 1];
        const tempPath = path.join(__dirname, `mira_voice_${label}.wav`);

        // V12 CRITICAL: Enforce forward-slashes for PowerShell stdin
        const safePath = tempPath.replace(/\\/g, '/');

        fs.writeFileSync(tempPath, buffer);

        // Send direct PlaySync command to PowerShell stdin. 
        // V16: Robust one-liner to avoid variable interpolation issues.
        const playCmd = `(New-Object System.Media.SoundPlayer "${safePath}").PlaySync(); rm "${safePath}" -ErrorAction SilentlyContinue;\n`;
        audioHost.stdin.write(playCmd);

        log(`[Handoff: ${Date.now() - playStart}ms] Sent to PS-Engine: "${text.substring(0, 20)}..."`);

        if (audioQueue.length > 0) {
            processAudioQueue();
        }

    } catch (e) {
        log(`Host Playback Error: ${e.message}`);
    }
}

function speakHost(text) {
    if (!text.trim() || text.length < 2) return;

    // V10 Prosody Focus: Only split at terminal punctuation unless buffer is massive (250)
    const limit = isFirstSegment ? 25 : 250;
    if (text.length > limit && ttsQueue.length === 0 && audioQueue.length === 0) {
        const splitIdx = text.match(/[.!?]/);
        if (splitIdx && splitIdx.index > 20 && splitIdx.index < (limit - 10)) {
            const part1 = text.substring(0, splitIdx.index + 1);
            const part2 = text.substring(splitIdx.index + 1);
            ttsQueue.push(part1);
            ttsQueue.push(part2);
            log(`Smart Split: [${part1}] | [${part2}]`);
        } else {
            ttsQueue.push(text);
        }
    } else {
        ttsQueue.push(text);
    }

    processTtsGeneration();
}

function log(msg) {
    console.log(`[Mira Bridge] ${msg}`);
}

async function initializeBrain() {
    log('Ollama engine active. Ready to process vision requests.');
    modelLoaded = true;
    isModelLoading = false;
}

function checkServerHealth() {
    http.get(`http://127.0.0.1:${OLLAMA_PORT}/api/tags`, (res) => {
        if (res.statusCode === 200) {
            modelLoaded = true;
            log('Ollama Health Check SUCCESS.');
        }
    }).on('error', () => {
        log('Ollama not responding on port 11434.');
    });
}

const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.wasm': 'application/wasm'
};

function serveStatic(req, res) {
    let filePath = req.url === '/' ? '/index.html' : req.url;
    // Strip query strings
    filePath = filePath.split('?')[0];

    const fullPath = path.join(__dirname, '..', 'dist_flutter', filePath);

    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        const ext = path.extname(fullPath).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
        fs.createReadStream(fullPath).pipe(res);
        return true;
    }
    return false;
}

const server = http.createServer(async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === 'OPTIONS') {
        res.writeHead(204); res.end(); return;
    }

    // Try serving static files first (Flutter UI)
    if (req.method === 'GET' && serveStatic(req, res)) {
        return;
    }

    if (req.url === '/health' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', modelLoaded, isModelLoading }));
        return;
    }

    if ((req.url === '/init-status' || req.url === '/status') && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            isModelLoading,
            modelLoaded,
            miraReady: modelLoaded && !!kokoro,
            status: modelLoaded ? 'idle' : 'booting',
            message: lastLogLine,
            ttsReady: !!kokoro
        }));
        return;
    }

    if ((req.url === '/init-model' || req.url === '/initialize') && req.method === 'POST') {
        try {
            if (!modelLoaded) initializeBrain(); // Start in background

            // Automated System Greeting
            setTimeout(() => {
                speakHost("Neural Link Established. Mira System Online. How can I assist you today?");
            }, 500);

            res.writeHead(200);
            res.end(JSON.stringify({ status: 'initializing' }));
        } catch (err) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    if (req.url === '/speak-host' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const { text } = JSON.parse(body);
                log(`Manual Host Speak: "${text.substring(0, 30)}..."`);
                speakHost(text);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'queued' }));
            } catch (err) {
                res.writeHead(500);
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    if (req.url === '/tts' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                if (!kokoro) await initializeTTS();
                const { text, voice = 'af_bella' } = JSON.parse(body);
                log(`Generating TTS for: "${text.substring(0, 30)}..."`);

                const audio = await kokoro.generate(text, {
                    voice: voice,
                    speed: 1.15
                });

                // Send the specific slice of the buffer belonging to the audio data
                const buffer = Buffer.from(audio.audio.buffer, audio.audio.byteOffset, audio.audio.byteLength);
                res.writeHead(200, {
                    'Content-Type': 'application/octet-stream',
                    'Content-Length': buffer.length
                });
                res.end(buffer);
            } catch (err) {
                log(`TTS Error: ${err.message}`);
                res.writeHead(500);
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    if (req.url === '/shutdown' && req.method === 'POST') {
        log('Shutdown request received. Terminating Ollama and bridge...');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: "Shutting down..." }));

        // Stop Ollama to free VRAM, then exit bridge
        setTimeout(() => {
            const { exec } = require('child_process');
            exec('taskkill /F /IM ollama.exe /T', (err) => {
                if (err) log('Ollama already stopped or not found');
                log('Exit sequence complete.');
                process.exit(0);
            });
        }, 1000);
        return;
    }

    if (req.url === '/init-model' && req.method === 'POST') {
        try {
            if (!modelLoaded) await initializeBrain();
            res.writeHead(200);
            res.end(JSON.stringify({ status: 'ready' }));
        } catch (err) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    if (req.method === 'POST' && req.url === '/chat') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                if (!modelLoaded) {
                    res.writeHead(503);
                    res.end(JSON.stringify({ error: "Brain not ready" }));
                    return;
                }

                const { messages } = JSON.parse(body);
                isFirstSegment = true; // New Response Start

                const startTime = Date.now();
                // Proxy to Ollama OpenAI-compatible API
                const proxyReq = http.request({
                    hostname: '127.0.0.1',
                    port: OLLAMA_PORT,
                    path: '/v1/chat/completions',
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                }, (proxyRes) => {
                    if (proxyRes.statusCode !== 200) {
                        let errorData = '';
                        proxyRes.on('data', d => errorData += d);
                        proxyRes.on('end', () => {
                            log(`Ollama Error (${proxyRes.statusCode}): ${errorData}`);
                            res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
                            res.end(errorData);
                        });
                        return;
                    }

                    res.writeHead(proxyRes.statusCode, { 'Content-Type': 'text/plain' });

                    let buffer = '';
                    let sentenceBuffer = '';
                    isFirstSegment = true; // V13: Reset for every new message for instant start
                    proxyRes.on('data', (chunk) => {
                        buffer += chunk.toString();
                        let lines = buffer.split('\n');
                        buffer = lines.pop(); // Keep last incomplete line

                        for (let line of lines) {
                            line = line.trim();
                            if (!line || !line.startsWith('data: ')) continue;
                            const dataStr = line.replace('data: ', '');

                            if (dataStr === '[DONE]') continue;

                            try {
                                const json = JSON.parse(dataStr);
                                const content = json.choices?.[0]?.delta?.content;
                                if (content) {
                                    res.write(content);

                                    // Direct Voice Trigger Logic
                                    sentenceBuffer += content;
                                    // V10 Prosody Trigger: 250 char safety ceiling
                                    const triggerLimit = isFirstSegment ? 25 : 250;
                                    const match = sentenceBuffer.match(/[.!?\n]+(?=\s|$)/);
                                    const isBufferLarge = sentenceBuffer.length > triggerLimit;

                                    if (match || isBufferLarge) {
                                        // Terminal Match takes precedence. Only fallback to space if buffer is massive.
                                        const endIdx = match ? match.index + match[0].length :
                                            (isBufferLarge ? sentenceBuffer.lastIndexOf(' ') + 1 : -1);

                                        if (endIdx > 2) {
                                            const sentence = sentenceBuffer.substring(0, endIdx).trim();
                                            sentenceBuffer = sentenceBuffer.substring(endIdx);
                                            isFirstSegment = false; // Next one will be longer for prosody
                                            speakHost(sentence);
                                        }
                                    }
                                }
                            } catch (e) {
                                // Ignore non-JSON or partial chunks
                            }
                        }
                    });

                    proxyRes.on('end', () => {
                        // Flush any remaining text in sentence buffer
                        if (sentenceBuffer.trim().length > 0) speakHost(sentenceBuffer);

                        const duration = (Date.now() - startTime) / 1000;
                        log(`Response streamed in ${duration.toFixed(2)}s`);
                        res.end();
                    });
                });

                proxyReq.on('error', (e) => {
                    log(`Proxy Request Error: ${e.message}`);
                    if (!res.headersSent) {
                        res.writeHead(500);
                        res.end(JSON.stringify({ error: e.message }));
                    } else {
                        res.end();
                    }
                });

                // Log request summary (avoid logging full base64)
                const hasImage = messages.some(m => Array.isArray(m.content) && m.content.some(c => c.type === 'image_url'));
                log(`Forwarding Chat Request. Multimodal: ${hasImage}`);

                // Ensure "Mira" Identity is enforced
                const systemPrompt = {
                    role: "system",
                    content: "You are Mira, a high-performance futuristic AI assistant. Your name is Mira. You are technical, sharp, and helpful. Never call yourself Navi. Your responses should be concise and efficient."
                };

                // Inject system prompt if missing or at the top
                const cleanedMessages = messages.filter(m => m.role !== 'system');
                const finalMessages = [systemPrompt, ...cleanedMessages];

                // Hyper-Tuned 11B Vision Architecture: Persistent intelligence with zero swapping lag
                const isMultimodal = finalMessages.some(m => Array.isArray(m.content) && m.content.some(c => c.type === 'image_url'));
                const targetModel = "llama3.2-vision";

                log(`Forwarding Chat Request. Model: ${targetModel} (Multimodal: ${isMultimodal})`);

                const outgoingPayload = JSON.stringify({
                    model: targetModel,
                    messages: finalMessages,
                    stream: true,
                    temperature: 0.5,
                    max_tokens: isMultimodal ? 80 : 250,
                    options: {
                        num_ctx: 1024,
                        f16_kv: true,
                        num_thread: 6, // V10 Balanced: Substantial headroom for prosody-aware TTS
                        repeat_penalty: 1.1,
                        num_gpu: -1 // Full GPU acceleration
                    }
                });

                proxyReq.write(outgoingPayload);
                proxyReq.end();

            } catch (err) {
                res.writeHead(500); res.end();
            }
        });
        return;
    }
    res.writeHead(404); res.end();
});

server.listen(BRIDGE_PORT, async () => {
    log(`-------------------------------------------`);
    log(`MIRA BRIDGE (ORCHESTRATOR) - PORT ${BRIDGE_PORT}`);
    log(`Ollama Engine: Port ${OLLAMA_PORT}`);
    log(`-------------------------------------------`);

    // Auto-init TTS and Audio Host on startup
    initializeTTS();
    initializeAudioHost();
});

// Cleanup on exit
process.on('SIGINT', () => {
    process.exit();
});
