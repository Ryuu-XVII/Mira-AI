import { getLlama } from "node-llama-cpp";

(async () => {
    try {
        const llama = await getLlama({ gpu: "vulkan" });

        console.log("GPU Backend Type:", llama._gpu);

        const modelPath = "models/llama-3.1-8b.gguf";
        const { GgufInsights } = await import("node-llama-cpp");
        const insights = await GgufInsights.from(modelPath);

        const req = insights.estimateVramRequirement({ gpuLayers: 33 });
        console.log("Model VRAM required (est):", req);

        if (llama._vramOrchestrator) {
            console.log("VRAM Orchestrator Info:", await llama._vramOrchestrator._getMemoryState());
        }


    } catch (e) {
        console.error(e);
    }
})();
