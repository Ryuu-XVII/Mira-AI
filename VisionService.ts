import { ObjectDetector, type Detection } from '@mediapipe/tasks-vision';
import { useStore } from '../../state/useStore';

class VisionService {
    private objectDetector: ObjectDetector | null = null;
    private video: HTMLVideoElement | null = null;
    private stream: MediaStream | null = null;
    private lastVideoTime = -1;
    private isInitializing = false;
    private cachedDescription: string = "";
    private detectionInterval: any;

    public async initialize() {
        if (this.objectDetector || this.isInitializing) return;
        this.isInitializing = true;

        try {
            // [OFFLINE MODE] - Remote MediaPipe fetches are disabled.
            // You must place MediaPipe assets in public/models/vision/
            /*
            const vision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
            );

            this.objectDetector = await ObjectDetector.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite",
                    delegate: "GPU"
                },
                scoreThreshold: 0.5,
                runningMode: "VIDEO"
            });
            */

            console.warn("Vision Module: Offline - Remote fetches disabled.");
        } catch (e) {
            console.error("Vision Init Failed:", e);
        } finally {
            this.isInitializing = false;
        }
    }

    public async startCamera() {
        if (!this.objectDetector) await this.initialize();

        if (!this.video) {
            this.video = document.createElement('video');
            this.video.autoplay = true;
            this.video.playsInline = true;
        }

        if (!this.stream) {
            try {
                this.stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 640, height: 480, facingMode: "user" }
                });
                this.video.srcObject = this.stream;
                this.startContinuousDetection();
            } catch (e) {
                console.error("Camera access denied:", e);
                throw e;
            }
        }
    }

    private startContinuousDetection() {
        if (this.detectionInterval) clearInterval(this.detectionInterval);
        this.detectionInterval = setInterval(() => {
            // Skip detection if system is active to save GPU for LLM/TTS
            const status = useStore.getState().status;
            if (status === 'thinking' || status === 'speaking') return;
            this.updateDescription();
        }, 1500); // Relaxed interval
    }

    public stopCamera() {
        if (this.detectionInterval) clearInterval(this.detectionInterval);
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
    }

    public detect(): Detection[] {
        if (!this.objectDetector || !this.video || !this.stream) return [];

        if (this.video.currentTime !== this.lastVideoTime) {
            this.lastVideoTime = this.video.currentTime;
            const result = this.objectDetector.detectForVideo(this.video, performance.now());
            return result.detections;
        }
        return [];
    }

    private updateDescription() {
        const detections = this.detect();
        if (detections.length === 0) {
            this.cachedDescription = "I don't see anything clear right now.";
            return;
        }

        const counts: Record<string, number> = {};
        detections.forEach(d => {
            const name = d.categories[0].categoryName;
            counts[name] = (counts[name] || 0) + 1;
        });

        const distinct = Object.entries(counts).map(([name, count]) => {
            return count > 1 ? `${count} ${name}s` : `a ${name}`;
        });

        this.cachedDescription = `I can see: ${distinct.join(', ')}.`;
    }

    public getDetailedDescription(): string {
        return this.cachedDescription;
    }

    public captureFrame(): string | null {
        if (!this.video || !this.stream) return null;

        const canvas = document.createElement('canvas');
        canvas.width = 320; // Lower resolution for VRAM/Speed optimization
        canvas.height = 240;

        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        ctx.drawImage(this.video, 0, 0, 320, 240);
        // Using low quality jpeg to stay under VRAM and network limits
        return canvas.toDataURL('image/jpeg', 0.4);
    }
}

export const vision = new VisionService();
