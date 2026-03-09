import { useCallback, useEffect } from 'react';
import { useStore } from '../state/useStore';
import { brain } from '../services/brain/BrainService';
import { voice } from '../services/voice/VoiceService';
import { vision } from '../services/perception/VisionService';
import { memory } from '../services/memory/MemoryService';

let currentAbortController: AbortController | null = null;
let lastProcessTime = 0;

export const useMira = () => {
    const { status, actions } = useStore();

    const handleUserMetrics = useCallback(async (text: string) => {
        // Guard: Ignore if we just started processing (prevents double triggers for same question)
        const now = Date.now();
        if (now - lastProcessTime < 1000) return;
        if (!brain.isReady()) {
            console.warn("[MIRA-CORE] Skipping metrics: Brain not ready.");
            return;
        }
        lastProcessTime = now;

        // Abort previous generation if any
        if (currentAbortController) {
            currentAbortController.abort();
        }
        currentAbortController = new AbortController();

        // 1. Storage
        actions.addMessage('user', text);
        setTimeout(async () => {
            await memory.addFact(text, 'user');
        }, 0);

        // 2. Smart Perception Context
        const visionKeywords = ['see', 'look', 'find', 'view', 'watch', 'describe', 'camera', 'show', 'identify', 'what is this', 'who is this'];
        const userAsksToSee = visionKeywords.some(kw => text.toLowerCase().includes(kw));

        // Periodic vision sync (every 5 messages) or when asked
        const messageCount = useStore.getState().messages.length;
        const shouldCapture = userAsksToSee || (messageCount % 10 === 0);

        const frame = shouldCapture ? vision.captureFrame() : null;
        const visionContext = frame
            ? "Sensors Active: Analyzing high-resolution frame."
            : (userAsksToSee ? "Sensors Warm: User asked to see, but no frame captured yet." : vision.getDetailedDescription());

        console.log("Brain Context:", { hasFrame: !!frame, userAsksToSee });

        // 3. Construct Enrichment Block
        const contextBlock = `
[ENVIRONMENTAL DATA]
Visual Analysis: ${visionContext || "Sensors clear."}
`;

        try {
            // 2. Start brain processing immediately with captured frame
            let spokenLength = 0;
            const richInput = `${contextBlock}\nUser Request: ${text}`;

            const response = await brain.processStreamingInput(
                richInput,
                (chunk) => {
                    const cleanChunk = chunk.replace(/\[\[EXEC:\s*(.*?)\s*\]\]/g, '');
                    actions.updateLastMessage(cleanChunk);

                    const newText = cleanChunk.substring(spokenLength);
                    const sentenceBoundaryRegex = /[.!?]+(?=\s|$)/g;
                    let match;
                    let lastMatchIndex = -1;
                    let sentenceCount = 0;

                    while ((match = sentenceBoundaryRegex.exec(newText)) !== null) {
                        lastMatchIndex = match.index + match[0].length;
                        sentenceCount++;
                    }

                    const shouldSpeak = (
                        sentenceCount >= 1 ||
                        newText.length >= 40
                    );

                    if (lastMatchIndex !== -1 && shouldSpeak) {
                        const textToSpeak = newText.substring(0, lastMatchIndex).trim();

                        if (/[a-zA-Z0-9]/.test(textToSpeak)) {
                            voice.speakChunk(textToSpeak);
                            window.electron?.sendOutput?.(textToSpeak);
                        }

                        spokenLength += lastMatchIndex;
                    }
                },
                frame,
                currentAbortController.signal
            );

            // Speak any trailing text
            const remainingText = response.substring(spokenLength);
            if (remainingText.trim()) {
                voice.speakChunk(remainingText);
                window.electron?.sendOutput?.(remainingText);
            }

            // Store response asynchronously
            setTimeout(async () => {
                await memory.addFact(response, 'system');
            }, 0);

            if (status !== 'idle') {
                useStore.getState().actions.setStatus('listening');
                voice.startListening();
            }

        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.log("Mira: Generation aborted by new input.");
                return;
            }
            console.error("Mira Process Error:", error);
            actions.setStatus('idle');
            voice.speak("I'm having trouble processing that.");
        } finally {
            if (currentAbortController?.signal.aborted === false) {
                // Not cleaned up by new one? 
            }
        }
    }, [actions, status]);

    const startExperience = useCallback(async () => {
        console.log("[MIRA-CORE] ========================================");
        console.log("[MIRA-CORE] startExperience() CALLED");
        console.log("[MIRA-CORE] ========================================");

        try {
            console.log("[MIRA-CORE] Step 1: Starting services initialization...");
            console.log("[MIRA-CORE] - Initializing Brain...");
            await brain.initialize();
            console.log("[MIRA-CORE] ✓ Brain Initialized");

            console.log("[MIRA-CORE] - Initializing Voice...");
            await voice.initialize();
            console.log("[MIRA-CORE] ✓ Voice Initialized");

            console.log("[MIRA-CORE] - Initializing Memory...");
            await memory.initialize();
            console.log("[MIRA-CORE] ✓ Memory Initialized");

            console.log("[MIRA-CORE] Step 2: Requesting camera permissions...");
            await vision.startCamera();
            console.log("[MIRA-CORE] ✓ Camera started");

            console.log("[MIRA-CORE] Step 3: Starting voice listening...");
            await voice.startListening();
            console.log("[MIRA-CORE] ✓ Voice listening started");

            // Hook up the voice callback
            voice.onResult = handleUserMetrics;

            console.log("[MIRA-CORE] Step 4: Setting status to listening...");
            actions.setStatus('listening');
            (window as any).electron?.sendState?.('status', 'listening');
            console.log("[MIRA-CORE] ✓ Status set to listening");

            // --- AUTO GREETING (Since Electron onFaceReady is gone) ---
            if (useStore.getState().messages.length === 0) {
                const greeting = "Systems online. I am Mira. Identify yourself.";
                console.log("[MIRA-CORE] Preparing greeting:", greeting);
                actions.addMessage('assistant', greeting); // Show in UI

                // Small delay to ensure AudioContext is fully resumed and UI is ready
                setTimeout(async () => {
                    await voice.speak(greeting);
                }, 500);
            }

            console.log("[MIRA-CORE] ========================================");
            console.log("[MIRA-CORE] ✓✓✓ ALL SYSTEMS ONLINE ✓✓✓");
            console.log("[MIRA-CORE] ========================================");

        } catch (e) {
            console.error("[MIRA-CORE] ✗✗✗ FATAL ERROR ✗✗✗");
            console.error("[MIRA-CORE] Failed to start experience:", e);
            console.error("[MIRA-CORE] Error details:", e);
        }
    }, [handleUserMetrics, actions]);

    // Event Listeners
    useEffect(() => {
        const electron = (window as any).electron;
        if (electron) {
            if (electron.onProcessInput) {
                electron.onProcessInput((text: any) => {
                    console.log("Headless Input:", text);
                    handleUserMetrics(text);
                });
            }

            if (electron.onTestVoice) {
                electron.onTestVoice(() => {
                    console.log("Diagnostic Voice Test Triggered.");
                    voice.speak("Vocal chords operational. Signal confirmed.");
                });
            }

            if (electron.onFaceReady) {
                electron.onFaceReady(async () => {
                    try {
                        console.log("[MIRA-CORE] ========================================");
                        console.log("[MIRA-CORE] FACE-READY HANDSHAKE RECEIVED");
                        console.log("[MIRA-CORE] ========================================");

                        // Force audio context resumption
                        console.log("[MIRA-CORE] Resuming audio context...");
                        await voice.resumeAudio();
                        console.log("[MIRA-CORE] ✓ Audio context resumed");

                        if (useStore.getState().messages.length === 0) {
                            const greeting = "Systems online. I am Mira. Identify yourself.";
                            console.log("[MIRA-CORE] Preparing greeting:", greeting);
                            actions.addMessage('assistant', greeting);

                            console.log("[MIRA-CORE] Speaking greeting...");
                            await voice.speak(greeting);
                            console.log("[MIRA-CORE] ✓ Greeting spoken");

                            console.log("[MIRA-CORE] Starting voice listening...");
                            voice.startListening();
                            console.log("[MIRA-CORE] ✓ Voice listening started");
                        }

                        console.log("[MIRA-CORE] ========================================");
                        console.log("[MIRA-CORE] ✓✓✓ HANDSHAKE COMPLETE ✓✓✓");
                        console.log("[MIRA-CORE] ========================================");
                    } catch (error) {
                        console.error("[MIRA-CORE] ✗✗✗ HANDSHAKE FAILED ✗✗✗");
                        console.error("[MIRA-CORE] Error:", error);
                        console.error("[MIRA-CORE] Stack:", (error as Error).stack);
                    }
                });
            }
        }
    }, [handleUserMetrics, actions]);

    return {
        startExperience
    };
};
