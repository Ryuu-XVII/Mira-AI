import { useState, useEffect } from 'react';

export const useGPU = () => {
    const [hasGPU, setHasGPU] = useState<boolean | null>(null);
    const [gpuName, setGpuName] = useState<string>("Detecting...");
    const [gpuError, setGpuError] = useState<string | null>(null);

    useEffect(() => {
        const initGPU = async () => {
            if (!("gpu" in navigator)) {
                setHasGPU(false);
                setGpuError("WebGPU is not supported by this browser.");
                return;
            }

            try {
                let adapter = await (navigator as any).gpu.requestAdapter({ powerPreference: 'high-performance' });
                if (!adapter) adapter = await (navigator as any).gpu.requestAdapter();

                if (adapter) {
                    setHasGPU(true);
                    let name = "WebGPU Adapter (Active)";
                    try {
                        if ('info' in adapter) {
                            const info = (adapter as any).info;
                            name = info.device || info.description || name;
                        } else if ('requestAdapterInfo' in adapter) {
                            const info = await (adapter as any).requestAdapterInfo();
                            name = info.device || info.description || name;
                        }
                    } catch (e) {
                        console.warn("Failed to get adapter info:", e);
                    }
                    setGpuName(name);
                    setGpuError(null);
                } else {
                    setHasGPU(false);
                    setGpuName("No WebGPU Adapter");
                    setGpuError("No WebGPU adapter found.");
                }
            } catch (e) {
                console.error("GPU Init Error:", e);
                setHasGPU(false);
                setGpuError(`WebGPU failure: ${e instanceof Error ? e.message : String(e)}`);
            }
        };

        initGPU();
    }, []);

    return { hasGPU, gpuName, gpuError };
};
