import React from 'react';
import { useStore } from '../../state/useStore';

import { brain } from '../../services/brain/BrainService';

export const ControlDeck: React.FC = () => {
    const { status } = useStore();

    return (
        <div className="matte-card" style={{
            width: '280px',
            height: '100%',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
            borderRight: '1px solid #222'
        }}>
            <div className="hud-text" style={{ color: '#FFC000', borderBottom: '1px solid #333', paddingBottom: '0.5rem' }}>
                SYSTEM MONITOR
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <TelemetryRow label="CPU_CORE" value="8_ACTIVE" />
                <TelemetryRow label="THR_LOAD" value="OPTIMAL" color="#00FF00" />
                <TelemetryRow label="LATENCY" value="180ms" />
                <TelemetryRow label="BUFFER" value="PIPELINED" color="#FFC000" />
            </div>

            {/* Shutdown Region */}
            <div style={{ padding: '1rem', background: 'rgba(255,0,0,0.05)', border: '1px solid rgba(255,0,0,0.2)', borderRadius: '2px' }}>
                <div className="hud-text" style={{ color: '#FF4444', marginBottom: '0.8rem', fontSize: '0.6rem' }}>CRITICAL_CONTROLS</div>
                <button
                    onClick={() => brain.shutdown()}
                    style={{
                        width: '100%',
                        background: '#FF4444',
                        border: 'none',
                        color: '#FFF',
                        padding: '0.6rem',
                        fontSize: '0.7rem',
                        fontWeight: 'bold',
                        letterSpacing: '2px',
                        cursor: 'pointer',
                        borderRadius: '2px',
                        boxShadow: '0 4px 0 #990000'
                    }}
                    onMouseDown={(e) => (e.currentTarget.style.transform = 'translateY(2px)', e.currentTarget.style.boxShadow = '0 2px 0 #990000')}
                    onMouseUp={(e) => (e.currentTarget.style.transform = 'translateY(0px)', e.currentTarget.style.boxShadow = '0 4px 0 #990000')}
                >
                    SHUTDOWN_KRNL
                </button>
            </div>

            <div style={{ marginTop: 'auto' }}>
                <div className="hud-text" style={{ opacity: 0.4, marginBottom: '0.5rem' }}>SENSOR_LINK</div>
                <div style={{
                    padding: '1rem',
                    background: '#0a0a0a',
                    border: '1px solid #222',
                    borderRadius: '4px',
                    fontSize: '0.6rem',
                    fontFamily: 'monospace',
                    color: '#666'
                }}>
                    {status === 'speaking' ? '> RECORDING_ACTIVE...' : '> SCANNING_ENV...'}
                </div>
            </div>
        </div>
    );
};

const TelemetryRow: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color = '#aaa' }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', fontFamily: 'monospace' }}>
        <span style={{ opacity: 0.4 }}>{label}</span>
        <span style={{ color }}>{value}</span>
    </div>
);
