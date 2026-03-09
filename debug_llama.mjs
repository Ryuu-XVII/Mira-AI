import { getLlama } from "node-llama-cpp";

(async () => {
    try {
        console.log("Attempting to load CUDA backend...");
        const llama = await getLlama({ gpu: "cuda" });
        console.log("CUDA Loaded. Supports GPU:", llama._supportsGpuOffloading);
        console.log("Build Type:", llama._buildType);
        console.log("CMake Options:", llama._cmakeOptions);

    } catch (e) {
        console.error(e);
    }
})();
