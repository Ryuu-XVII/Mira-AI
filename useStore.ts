import { create } from 'zustand';

export type AppStatus = 'idle' | 'listening' | 'thinking' | 'speaking' | 'booting';
export type VoiceStatus = 'idle' | 'loading' | 'ready' | 'error';

interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
}

interface AppState {
    status: AppStatus;
    voiceStatus: VoiceStatus;
    voiceProgress: number;
    brainProgress: string;
    audioReady: boolean;
    sttReady: boolean;
    messages: Message[];
    audioLevel: number;
    actions: {
        setStatus: (status: AppStatus) => void;
        setVoiceStatus: (status: VoiceStatus) => void;
        setVoiceProgress: (progress: number) => void;
        setBrainProgress: (progress: string) => void;
        setAudioReady: (ready: boolean) => void;
        setSttReady: (ready: boolean) => void;
        addMessage: (role: 'user' | 'assistant' | 'system', content: string) => void;
        updateLastMessage: (content: string) => void;
        updateMessage: (id: string, content: string) => void;
        setAudioLevel: (level: number) => void;
    };
}

export const useStore = create<AppState>((set) => ({
    status: 'booting',
    voiceStatus: 'idle',
    voiceProgress: 0,
    brainProgress: '',
    audioReady: false,
    sttReady: false,
    messages: [],
    audioLevel: 0,
    actions: {
        setStatus: (status) => set({ status }),
        setVoiceStatus: (status) => set({ voiceStatus: status }),
        setVoiceProgress: (progress) => set({ voiceProgress: progress }),
        setBrainProgress: (progress) => set({ brainProgress: progress }),
        setAudioReady: (ready) => set({ audioReady: ready }),
        setSttReady: (ready) => set({ sttReady: ready }),
        addMessage: (role, content) => set((state) => ({
            messages: [...state.messages, {
                id: Math.random().toString(36).substring(7),
                role,
                content,
                timestamp: Date.now()
            }]
        })),
        updateLastMessage: (content) => set((state) => {
            const lastMsg = state.messages[state.messages.length - 1];
            if (!lastMsg) return state;

            const newMessages = [...state.messages];
            newMessages[newMessages.length - 1] = { ...lastMsg, content };
            return { messages: newMessages };
        }),
        updateMessage: (id, content) => set((state) => ({
            messages: state.messages.map(m => m.id === id ? { ...m, content } : m)
        })),
        setAudioLevel: (level) => set({ audioLevel: level }),
    }
}));
