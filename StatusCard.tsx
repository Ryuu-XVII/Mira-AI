import React from 'react';
import { type BrainState } from '../../services/brain/BrainService';

interface StatusCardProps {
    brainState: BrainState;
    voiceStatus: string;
    voiceProgress: number;
    hasGPU: boolean | null;
    gpuError: string | null;
    onStart: () => void;
    showInitialButton: boolean;
}

export const StatusCard: React.FC<StatusCardProps> = ({
    brainState,
    voiceStatus,
    voiceProgress,
    hasGPU,
    gpuError,
    onStart,
    showInitialButton
}) => {
    if (hasGPU === false) {
        return (
            <div style={{
                color: '#FF4444',
                marginBottom: '1rem',
                border: '1px solid rgba(255,68,68,0.3)',
                padding: '1rem',
                background: 'rgba(50,0,0,0.3)',
                borderRadius: '8px',
                fontSize: '0.8rem'
            }}>
                <strong>WEBGPU ERROR</strong><br />
                <div style={{ opacity: 0.8, marginTop: '0.4rem' }}>
                    {gpuError || "No high-performance adapter found."}
                </div>
            </div>
        );
    }

    if (showInitialButton) {
        return (
            <button
                onClick={onStart}
                style={{
                    background: '#FFC000',
                    border: 'none',
                    color: '#000',
                    padding: '1rem 2rem',
                    fontSize: '0.9rem',
                    letterSpacing: '2px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    borderRadius: '2px',
                    boxShadow: '0 4px 0 #CC9900',
                    transition: 'all 0.1s ease',
                    margin: '1rem 0',
                    width: '100%'
                }}
                onMouseDown={(e) => (e.currentTarget.style.transform = 'translateY(2px)', e.currentTarget.style.boxShadow = '0 2px 0 #CC9900')}
                onMouseUp={(e) => (e.currentTarget.style.transform = 'translateY(0px)', e.currentTarget.style.boxShadow = '0 4px 0 #CC9900')}
            >
                ESTABLISH_NEURAL_LINK
            </button>
        );
    }

    if (brainState.isLoading || voiceStatus === 'loading') {
        return (
            <div className="matte-card" style={{
                padding: '1.2rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.8rem',
                borderLeft: '4px solid #FFC000'
            }}>
                <div style={{ color: '#FFC000', letterSpacing: '2px', fontWeight: 900, fontSize: '0.7rem' }}>
                    {brainState.isLoading ? 'KRNL_BOOT_SEQ' : 'VOC_SYNTH_SEQ'}
                </div>

                <div style={{ fontSize: '0.65rem', color: '#666', fontFamily: 'monospace' }}>
                    {brainState.isLoading ? brainState.progress : `DOWNLOADING_DATA_${voiceProgress}%`}
                </div>

                <div style={{ height: '4px', width: '100%', background: '#0a0a0a', borderRadius: '0px', overflow: 'hidden' }}>
                    <div style={{
                        height: '100%',
                        width: brainState.isLoading ? '100%' : `${voiceProgress}%`,
                        background: '#FFC000',
                        transition: 'width 0.3s',
                        animation: brainState.isLoading ? 'teleport 1s infinite linear' : 'none'
                    }} />
                </div>
                <style>{`
                    @keyframes teleport {
                        0% { transform: translateX(-100%); }
                        100% { transform: translateX(100%); }
                    }
                `}</style>
            </div>
        );
    }

    return null;
};
