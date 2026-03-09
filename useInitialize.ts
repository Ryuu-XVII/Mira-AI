import { useState, useEffect, useCallback } from 'react';
import { brain, type BrainState } from '../services/brain/BrainService';
import { useStore } from '../state/useStore';
import { useMira } from './useMira';

export const useInitialize = () => {
    const { status, voiceStatus, actions } = useStore();
    const { startExperience } = useMira();
    const [brainState, setBrainState] = useState<BrainState>(brain.state);

    useEffect(() => {
        const unsub = brain.subscribe((s: BrainState) => {
            setBrainState(s);
            if (s.error) {
                actions.addMessage('system', `SYSTEM FAILURE: ${s.error}`);
            }
        });
        return unsub;
    }, [actions]);

    useEffect(() => {
        if (brainState.isLoading || voiceStatus === 'loading') {
            if (status !== 'booting') actions.setStatus('booting');
        } else if (brainState.isReady && voiceStatus === 'ready' && status === 'booting') {
            actions.setStatus('idle');
        }
    }, [brainState.isLoading, brainState.isReady, voiceStatus, status, actions]);

    const handleStart = useCallback(async () => {
        try {
            await startExperience();
        } catch (e) {
            console.error("[INIT] Failed:", e);
            actions.addMessage('system', `Initialization Failed: ${e}`);
        }
    }, [startExperience, actions]);

    useEffect(() => {
        // Auto-start in Electron Headless mode
        if (window.electron) {
            handleStart();
        }
    }, [handleStart]);

    return {
        brainState,
        handleStart,
        isSystemReady: brainState.isReady && voiceStatus === 'ready'
    };
};
