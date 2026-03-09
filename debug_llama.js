const { getLlama } = require("node-llama-cpp");

(async () => {
    try {
        const llama = await getLlama();
        console.log("Keys on llama instance:", Object.keys(llama));
        console.log("Is LlamaChatSession on llama?", !!llama.LlamaChatSession);

        // Check imports
        const mod = await import("node-llama-cpp");
        console.log("Module exports:", Object.keys(mod));
    } catch (e) {
        console.error(e);
    }
})();
