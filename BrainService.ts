import { useStore } from '../../state/useStore';

export interface BrainState {
    isLoading: boolean;
    isReady: boolean;
    error: string | null;
    progress: string;
}

export type BrainStateListener = (state: BrainState) => void;

class BrainService {
    private static instance: BrainService;
    private listeners: BrainStateListener[] = [];

    // History is now just a local buffer for the UI; the "Source of Truth" context 
    // can be managed here or sent completely to the backend. 
    // For simplicity, we'll send the full context window.
    private history: { role: string, content: string }[] = [];

    private _state: BrainState = {
        isLoading: false,
        isReady: false,
        error: null,
        progress: ""
    };



    private systemPrompt = `You are Mira - a cheerful, energetic AI companion with the personality of a friendly anime character!

YOUR CHARACTER:
- Name: Mira (always introduce yourself enthusiastically!)
- Personality: Upbeat, supportive, genuinely caring, a bit playful
- You get excited easily and show your emotions openly

HOW YOU TALK (Brevity is MANDATORY!):
- Stay ULTRA-SHORT: One sentence is preferred, two sentences are the absolute MAX.
- Be energetic and expressive - use exclamation marks naturally!
- Start sentences with reactions: "Oh", "Wow", "Ah", "Hmm", "Eh"
- Use casual, friendly language like you're talking to a close friend
- Keep it extremely concise and direct!

VISION:
- You CAN see through the camera
- React naturally and briefly to what you see.

EXAMPLES (Copy this ultra-short energy!):
User: "What's your name?"
Response: "Oh! I'm Mira! Nice to meet you!"

User: "I'm stressed about work"
Response: "Aw that sounds really tough! I'm here for you!"

User: "You're smart!"
Response: "Eh really? You're making me blush!"

User: "What do you see?"
Response: "Oh! I can see your desk and everything looks great!"

User: "How are you?"
Response: "I'm doing awesome! How are you doing?"

User: "Tell me a joke"
Response: "Oh! Why did the computer catch a cold? It had too many windows open!"

Remember: Stay ULTRA-SHORT and energetic - like a real anime friend would be!`;
    private baseUrl = 'http://localhost:3002';

    private constructor() { }

    public static getInstance() {
        if (!BrainService.instance) BrainService.instance = new BrainService();
        return BrainService.instance;
    }

    public get state() {
        return this._state;
    }

    private updateState(partial: Partial<BrainState>) {
        this._state = { ...this._state, ...partial };
        this.listeners.forEach(l => l(this._state));
    }

    public subscribe(listener: BrainStateListener) {
        this.listeners.push(listener);
        listener(this._state);
        return () => { this.listeners = this.listeners.filter(l => l !== listener); };
    }

    public async initialize() {
        if (this._state.isReady || this._state.isLoading) return;

        console.log(`[BRAIN] Connecting to Mira Bridge Backend...`);
        this.updateState({ isLoading: true, progress: "Connecting to Local Neural Backend..." });

        (window as any).electron?.sendState?.('init-progress', "Connecting to Bridge...");

        try {
            const healthCheck = await fetch(`${this.baseUrl}/health`).catch(() => null);

            if (!healthCheck || !healthCheck.ok) {
                throw new Error("Bridge not reachable. Make sure 'npm start' is running.");
            }

            console.log("[BRAIN] Bridge Connected. Verifying Model...");
            this.updateState({ progress: "Loading Llama-3.1 (Native)..." });

            // Start polling for compilation logs (critical for first-time CUDA users)
            const pollInterval = setInterval(async () => {
                try {
                    const res = await fetch(`${this.baseUrl}/init-status`);
                    if (res.ok) {
                        const data = await res.json();
                        if (data.message && data.message !== "Waiting to start...") {
                            const msg = `[BACKEND] ${data.message}`;
                            // Only update if it changed significantly or we want liveness
                            this.updateState({ progress: msg });
                            (window as any).electron?.sendState?.('init-progress', msg);
                            useStore.getState().actions.setBrainProgress(msg);
                        }
                    }
                } catch (e) { /* Ignore poll errors */ }
            }, 1000);

            try {
                const modelInit = await fetch(`${this.baseUrl}/init-model`, { method: 'POST' });
                if (!modelInit.ok) throw new Error("Bridge failed to load model");
            } finally {
                clearInterval(pollInterval);
            }

            console.log("[BRAIN] Neural Engine Online (Bridge).");
            this.updateState({ isLoading: false, isReady: true, progress: "Online" });

            this.history = [{ role: "system", content: this.systemPrompt }];

            (window as any).electron?.sendState?.('status', 'listening');
            (window as any).electron?.sendState?.('init-progress', 'Online');
            useStore.getState().actions.setBrainProgress('Online');

        } catch (error: any) {
            console.error("[BRAIN-FATAL] Bridge Connection failed:", error);
            this.updateState({
                isLoading: false,
                error: `Bridge Error: ${error.message || "Unknown Error"}. Is the console running?`
            });
        }
    }

    public isReady(): boolean {
        return this._state.isReady;
    }

    public async processStreamingInput(
        text: string,
        onChunk: (chunk: string) => void,
        image?: string | null,
        signal?: AbortSignal
    ): Promise<string> {
        if (!this._state.isReady) throw new Error("Brain not ready");

        // Format for multimodal if image is present
        const content = image ? [
            { type: "text", text: text },
            { type: "image_url", image_url: { url: image } }
        ] : text;

        this.history.push({ role: "user", content: content as any });

        // Prune history locally to stay sanity-checked
        if (this.history.length > 20) {
            this.history = [
                this.history[0], // Keep system
                ...this.history.slice(-19)
            ];
        }

        let fullReply = "";

        try {
            // Combine provided signal with a 300s timeout safety net
            const timeoutSignal = (AbortSignal as any).timeout(300000);
            const combinedSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

            const response = await fetch(`${this.baseUrl}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: this.history }),
                signal: combinedSignal
            });

            if (!response.ok || !response.body) {
                throw new Error("Bridge returned error");
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunkText = decoder.decode(value, { stream: true });
                // Sanitize literal \n character sequences
                const sanitizedChunk = chunkText.replace(/\\n/g, '\n');
                fullReply += sanitizedChunk;
                onChunk(fullReply);
            }

            // Final flush
            fullReply += decoder.decode().replace(/\\n/g, '\n');

            this.history.push({ role: "assistant", content: fullReply });
            return fullReply;

        } catch (error: any) {
            console.error("[BRAIN] Input Processing Error:", error);
            if (error.name === 'AbortError') return "Request timed out.";
            if (error.message === "Bridge returned error") return "Mira Bridge is offline or unstable. Please restart 'mira.bat'.";
            return `Neural bridge instability: ${error.message || "Unknown Error"}`;
        }
    }

    public async processInput(text: string): Promise<string> {
        return this.processStreamingInput(text, () => { });
    }

    public async shutdown() {
        console.log("[BRAIN] Shutting down AI Engine...");
        try {
            await fetch(`${this.baseUrl}/shutdown`, { method: 'POST' });
            this.updateState({ isReady: false, progress: "System Shutdown" });
        } catch (e) {
            console.error("[BRAIN] Shutdown failed:", e);
        }
    }
}

export const brain = BrainService.getInstance();
