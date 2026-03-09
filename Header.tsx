import React from 'react';

interface HeaderProps {
    status: string;
    gpuName: string;
}

export const Header: React.FC<HeaderProps> = ({ status, gpuName }) => {
    return (
        <div className="matte-card" style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem',
            border: 'none',
            borderBottom: '2px solid #FFC000',
            marginBottom: '1rem'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '2px',
                    background: status === 'booting' ? '#444' : (status === 'error' ? '#FF4444' : '#FFC000'),
                    boxShadow: status === 'idle' ? '0 0 10px #FFC000' : 'none'
                }} />
                <div>
                    <h1 style={{
                        margin: 0,
                        fontSize: '0.9rem',
                        opacity: 1,
                        letterSpacing: '3px',
                        fontWeight: 800,
                        color: '#FFF'
                    }}>MIRA_SYSTEM_OS</h1>
                    <div style={{ fontSize: '0.6rem', color: '#FFC000', opacity: 0.8, fontWeight: 'bold' }}>
                        CORE_STATUS: {status.toUpperCase()}
                    </div>
                </div>
            </div>

            <div style={{ fontSize: '0.6rem', color: '#666', textAlign: 'right', fontWeight: 'bold' }}>
                LOCAL_NODE_01<br />
                {gpuName.split(' ')[0]}
            </div>
        </div>
    );
};
