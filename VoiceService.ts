import { useStore } from '../../state/useStore';

console.log("[VOICE] Script Load: Configuring Voice Service...");

// ... existing types ...
interface SpeechRecognitionEvent extends Event {
    results: {
        length: number;
        [index: number]: {
            length: number;
            isFinal: boolean;
            [index: number]: {
                transcript: string;
            };
        };
    };
    error: any;
}

interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    lang: string;
    interimResults: boolean;
    onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
    onend: ((this: SpeechRecognition, ev: Event) => any) | null;
    onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
    onerror: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
    start(): void;
    stop(): void;
}

// Extend Window to include webkit prefix
interface WindowWithSpeech extends Window {
    SpeechRecognition?: { new(): SpeechRecognition };
    webkitSpeechRecognition?: { new(): SpeechRecognition };
    webkitAudioContext?: { new(): AudioContext };
}

class VoiceService {
    private recognition: any = null;
    private audioContext: AudioContext | null = null;
    private analyser: AnalyserNode | null = null;
    private dataArray: Uint8Array | null = null;
    private microphone: MediaStreamAudioSourceNode | null = null;
    private isProcessing = false;
    private micStream: MediaStream | null = null;

    // Callbacks
    public onResult: ((text: string) => void) | null = null;

    constructor() {
        console.log("[VOICE] Service Constructor Started.");
        this.initializeSpeechRecognition();
        console.log("[VOICE] Service Constructor Finished.");
    }

    private getAudioContext(): AudioContext {
        if (!this.audioContext) {
            const win = window as unknown as WindowWithSpeech;
            const AudioContextRef = window.AudioContext || win.webkitAudioContext;
            // Force 24000 for direct match with Kokoro output
            this.audioContext = new AudioContextRef({ sampleRate: 24000 });
            console.log("[VOICE] AudioContext created at 24000Hz.");
        }
        return this.audioContext;
    }

    public async resumeAudio() {
        const ctx = this.getAudioContext();
        if (ctx.state === 'suspended') {
            await ctx.resume();
            console.log("[VOICE] Audio Context Resumed.");
        }
    }

    public async initialize() {
        // No longer need to load local Kokoro engine
        const { actions } = useStore.getState();
        actions.setVoiceStatus('loading');
        console.log("[VOICE] Connecting to Backend Neural Voice Engine...");
        (window as any).electron?.sendState?.('init-progress', "Syncing Vocal Synths...");

        try {
            const res = await fetch('http://localhost:3002/health');
            if (!res.ok) throw new Error("Bridge unreachable");

            console.log("[VOICE] Neural Voice established via Bridge.");
            actions.setVoiceStatus('ready');
        } catch (err) {
            console.error("[VOICE-INIT-ERROR] Bridge connection failed:", err);
            actions.setVoiceStatus('ready');
        }
    }

    private initializeSpeechRecognition() {
        // ... (keep existing recognition logic)
        const win = window as unknown as WindowWithSpeech;
        const SpeechRecognitionRef = win.SpeechRecognition || win.webkitSpeechRecognition;

        if (SpeechRecognitionRef) {
            console.log("[VOICE] Initializing Speech Recognition Engine...");
            this.recognition = new SpeechRecognitionRef();
            this.recognition.continuous = false; // We restart manually for control
            this.recognition.lang = 'en-US';
            this.recognition.interimResults = true; // Enable interim for visual feedback

            this.recognition.onstart = () => {
                console.log("[VOICE] Mic Active: Listening...");
                const currentStatus = useStore.getState().status;
                if (currentStatus === 'idle' || currentStatus === 'booting') {
                    useStore.getState().actions.setStatus('listening');
                    useStore.getState().actions.setSttReady(true);
                    (window as any).electron?.sendState?.('status', 'listening');
                }
            };

            this.recognition.onend = () => {
                const status = useStore.getState().status;
                console.log(`[VOICE] Recognition Engine closed. Status: ${status}`);
                // Always restart to ensure continuous listening
                console.log("[VOICE] Restarting Speech Recognition...");
                try {
                    this.recognition?.start();
                    // Ensure we're back in listening mode if idle
                    if (status === 'idle') {
                        useStore.getState().actions.setStatus('listening');
                    }
                } catch (e) {
                    console.warn("[VOICE] STT Restart throttled or failed:", e);
                }
            };

            this.recognition.onresult = (event: SpeechRecognitionEvent) => {
                const results = event.results;
                const result = results[results.length - 1];
                const text = result[0].transcript;
                const isFinal = result.isFinal;
                console.log(`[VOICE-RECOG] Result: "${text}" (final=${isFinal})`);

                if (!isFinal) {
                    (window as any).electron?.sendState?.('status', 'hearing');
                    return;
                }

                if (text.trim().length > 0) {
                    console.log(`[VOICE] Final Result Received: "${text}"`);
                    this.cancelAllSpeech();
                    if (this.onResult) this.onResult(text);
                }
            };

            this.recognition.onerror = (err: any) => {
                console.error("[VOICE] SpeechRecognition Error:", err.error, err.message);
                if (err.error === 'not-allowed') {
                    console.error("[VOICE] Microphone permission denied.");
                }
                if (err.error === 'network') {
                    console.warn("[VOICE] STT Network error - this is expected if offline, but Web Speech usually works.");
                }
            };
        } else {
            console.error("[VOICE] SpeechRecognition API not supported in this browser.");
        }
    }

    public async startListening() {
        console.log("[VOICE] Attempting to start Web Speech API...");
        try {
            await this.startAudioAnalysis(); // Visuals
            this.recognition?.start();
        } catch (e) {
            console.error("[VOICE] STT Start Failed:", e);
        }
    }

    public stopListening() {
        this.recognition?.stop();
        this.stopAudioAnalysis();
    }

    public async speak(text: string): Promise<void> {
        // Direct Host Voice Output: Manual Trigger for Greeting/System talk
        if (!text.trim()) return;

        try {
            fetch('http://localhost:3002/speak-host', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });
        } catch (e) {
            console.error("[VOICE] Manual Host Speak Failed:", e);
        }

        this.simulateVocalEnergy();
    }

    public speakChunk(text: string) {
        if (!text.trim()) return;
        this.simulateVocalEnergy();
    }

    private simulateVocalEnergy() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        const { actions } = useStore.getState();
        actions.setStatus('speaking');
        (window as any).electron?.sendState?.('status', 'speaking');

        // Simulate a "pulse" of audio energy for the orb animation
        let frames = 0;
        const pulse = () => {
            if (frames > 45) { // Approx 0.75s pulse per sentence segment
                this.isProcessing = false;
                actions.setAudioLevel(0);
                return;
            }
            const level = 0.4 + Math.random() * 0.4;
            actions.setAudioLevel(level);
            frames++;
            requestAnimationFrame(pulse);
        };
        pulse();
    }


    public cancelAllSpeech() {
        // Don't transition to idle if we were in speaks? Actually, yes, better to reset.
        if (useStore.getState().status === 'speaking') {
            useStore.getState().actions.setStatus('listening');
            (window as any).electron?.sendState?.('status', 'listening');
        }
    }

    private async startAudioAnalysis() {
        if (this.micStream) {
            console.log("[VOICE] Reusing existing microphone stream.");
            this.setupAnalyserWithStream(this.micStream);
            return;
        }

        console.log("[VOICE] Starting Audio Analysis (Visualizer)...");
        try {
            console.log("[VOICE] Requesting microphone access...");
            this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            console.log("[VOICE] Microphone access granted.");
            this.setupAnalyserWithStream(this.micStream);
        } catch (err) {
            console.error("[VOICE] Microphone access denied:", err);
        }
    }

    private setupAnalyserWithStream(stream: MediaStream) {
        const ctx = this.getAudioContext();
        this.microphone = ctx.createMediaStreamSource(stream);
        if (!this.analyser) {
            this.analyser = ctx.createAnalyser();
            this.analyser.fftSize = 256;
        }
        this.microphone.connect(this.analyser);
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyzeLoop();
        useStore.getState().actions.setAudioReady(true);
    }

    private stopAudioAnalysis() {
        if (this.microphone) {
            this.microphone.disconnect();
            this.microphone = null;
        }
    }

    private analyzeLoop = () => {
        if (!this.analyser || !this.dataArray) return;

        requestAnimationFrame(this.analyzeLoop);
        this.analyser.getByteFrequencyData(this.dataArray as any);

        let sum = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
            sum += this.dataArray[i];
        }
        const average = sum / this.dataArray.length;
        const level = Math.min(average / 100, 1);
        useStore.getState().actions.setAudioLevel(level);
        if (level > 0.1) {
            (window as any).electron?.sendState?.('audio-level', level);
        }
    };
}

export const voice = new VoiceService();
