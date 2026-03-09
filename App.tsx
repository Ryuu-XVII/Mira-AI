import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { ParticleField } from './components/Visuals/ParticleField';
import { useStore, type AppStatus } from './state/useStore';
import React from 'react';

// New Modular Imports
import { useGPU } from './hooks/useGPU';
import { useInitialize } from './hooks/useInitialize';
import { Header } from './components/Overlay/Header';
import { StatusCard } from './components/Overlay/StatusCard';
import { ControlDeck } from './components/Overlay/ControlDeck';

// Extract Scene (Now centered with HUD alignment)
const Scene = React.memo(({ status }: { status: AppStatus }) => {
  return (
    <div style={{ position: 'absolute', width: '100%', height: '100%', zIndex: 0, background: '#080808' }}>
      <Canvas
        camera={{ position: [0, 0, 5], fov: 60 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, stencil: false, depth: true }}
      >
        <fog attach="fog" args={['#080808', 5, 20]} />
        <ambientLight intensity={0.5} />
        <ParticleField />
        <EffectComposer multisampling={4}>
          <Bloom luminanceThreshold={0.1} luminanceSmoothing={0.9} height={300} intensity={1.2} />
        </EffectComposer>
        <OrbitControls
          enableZoom={false}
          autoRotate
          autoRotateSpeed={status === 'thinking' ? 2 : 0.5}
        />
      </Canvas>
    </div>
  );
});

const MessageTerminal = React.memo(({ messages }: { messages: any[] }) => {
  return (
    <div className="terminal" style={{
      width: '100%',
      flex: 1,
      display: 'flex',
      flexDirection: 'column-reverse',
      gap: '1rem',
      overflowY: 'auto',
      paddingRight: '12px',
      scrollbarWidth: 'thin',
    }}>
      {messages.slice().reverse().map((msg) => (
        <div key={msg.id} className="matte-card" style={{
          padding: '0.8rem',
          textAlign: msg.role === 'user' ? 'right' : 'left',
          border: msg.role === 'assistant' ? '1px solid #FFC000' : '1px solid #222',
          background: msg.role === 'user' ? '#1a1a1a' : '#121212',
          borderRadius: '2px',
          color: msg.role === 'assistant' ? '#FFF' : '#aaa',
          fontSize: '0.8rem',
          lineHeight: '1.5'
        }}>
          <span className="hud-text" style={{
            fontSize: '0.55rem',
            opacity: 0.5,
            display: 'block',
            marginBottom: '4px',
            color: msg.role === 'assistant' ? '#FFC000' : '#888'
          }}>
            {msg.role} // TSTAMP_{new Date().toLocaleTimeString().replace(/\s/g, '_')}
          </span>
          {msg.content}
        </div>
      ))}
    </div>
  );
});

function App() {
  const { status, messages, voiceStatus, voiceProgress } = useStore();
  const { gpuName, hasGPU, gpuError } = useGPU();
  const { brainState, handleStart } = useInitialize();

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: '#080808',
      overflow: 'hidden',
      display: 'flex',
      color: 'white',
      fontFamily: "'Outfit', sans-serif"
    }}>
      {/* 1. LEFT: Control Deck */}
      <ControlDeck />

      {/* 2. CENTER: The Soul (Main Viewport) */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <Scene status={status} />

        {/* HUD Overlay for Center */}
        <div style={{ position: 'absolute', bottom: '2rem', left: '2rem', pointerEvents: 'none' }}>
          <div className="hud-text" style={{ color: '#FFC000', fontSize: '0.8rem' }}>MIRA_V0.1.0_PROTOTYPE</div>
          <div style={{ fontSize: '0.6rem', opacity: 0.3 }}>SECURE_CONNECTION_ESTABLISHED</div>
        </div>
      </div>

      {/* 3. RIGHT: Information Sidebar */}
      <div style={{
        width: '380px',
        height: '100%',
        zIndex: 10,
        background: '#0a0a0a',
        borderLeft: '1px solid #222',
        display: 'flex',
        flexDirection: 'column',
        padding: '1.5rem',
        boxSizing: 'border-box'
      }}>
        <Header status={status} gpuName={gpuName} />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem', overflow: 'hidden' }}>
          <StatusCard
            brainState={brainState}
            voiceStatus={voiceStatus}
            voiceProgress={voiceProgress}
            hasGPU={hasGPU}
            gpuError={gpuError}
            onStart={handleStart}
            showInitialButton={!brainState.isReady && voiceStatus === 'idle' && !brainState.isLoading}
          />

          {/* Feed Region */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.8rem',
            overflow: 'hidden'
          }}>
            <div className="hud-text" style={{ opacity: 0.4, borderBottom: '1px solid #222', paddingBottom: '0.5rem' }}>
              NEURAL_FEED_STREAM
            </div>
            <MessageTerminal messages={messages} />
          </div>

          {/* Footer diagnostic */}
          <div style={{
            marginTop: 'auto',
            padding: '1rem',
            background: '#050505',
            border: '1px solid #111',
            borderRadius: '2px',
            fontSize: '0.6rem',
            fontFamily: 'monospace',
            color: '#444'
          }}>
            SYSTEM_ID: MIRA_ALPHA_BETA_99<br />
            ENCRYPTION_LAYER: 7_SOLID<br />
            LINK_STABILITY: 99.8%
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
