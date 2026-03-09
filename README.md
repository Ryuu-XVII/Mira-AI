Mira AI is a cutting-edge, fully local AI assistant featuring a stunning, interactive 3D particle interface and true multi-modal capabilities. Designed for ultimate privacy and performance, Mira runs entirely on your local hardware without relying on cloud services.

✨ Key Features
100% Local Processing: Privacy-first architecture. All interactions, inferences, and data processing happen entirely on your machine.
Futuristic UI: A visually striking React + Three.js & Flutter frontend featuring an interactive neural particle field and a responsive "Neural Orb" status indicator.
Multi-Modal AI:
Text/Chat: Powered by advanced local LLMs via node-llama-cpp and web-llm.
Vision: Native computer vision capabilities using @mediapipe/tasks-vision and LLaVA models to "see" and understand your environment.
Voice: High-quality, local Text-to-Speech (TTS) driven by kokoro-js and Piper.
Desktop Integrated: Built as a seamless desktop experience with transparent window support and easy one-click launch scripts.
🚀 Tech Stack
Frontend: React 19, Vite, Three.js (@react-three/fiber, @react-three/drei), Zustand (State Management), TailwindCSS/Vanilla CSS.
Desktop Shell: Flutter (mira_flutter module) for native OS integration and advanced windowing effects.
Backend / Bridge: Node.js Express server acting as the high-performance local bridge (
mira-bridge.cjs
).
AI Engines: Node-Llama-CPP, Web-LLM, Kokoro JS, MediaPipe.
🛠️ Getting Started
Enable Developer Mode in your OS settings (required for Flutter integration).
Install dependencies: npm install
Download required models via the provided 
.bat
 scripts (e.g., 
download_gguf.bat
, 
download_voice.bat
).
Run the application: 
.\run_mira.bat
Mira's bridge backend and futuristic UI will launch automatically. Access the web interface at http://localhost:5173 or through the native desktop window.
