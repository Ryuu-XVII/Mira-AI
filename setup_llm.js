const fs = require('fs');
const path = require('path');
const https = require('https');

const MODELS = [
    {
        id: "Llama-3.1-8B-Instruct-q4f16_1-MLC",
        url: "https://huggingface.co/mlc-ai/Llama-3.1-8B-Instruct-q4f16_1-MLC/resolve/main/",
        wasm: "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0.2.48/Llama-3.1-8B-Instruct-q4f16_1-MLC-webgpu.wasm",
        shards: 107
    },
    {
        id: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
        url: "https://huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-q4f16_1-MLC/resolve/main/",
        wasm: "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0.2.48/Llama-3.2-1B-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm",
        shards: 21
    }
];

const STATIC_FILES = [
    "mlc-chat-config.json",
    "ndarray-cache.json",
    "tokenizer.json",
    "tokenizer_config.json"
];

async function downloadFile(url, dest) {
    if (fs.existsSync(dest)) {
        const stats = fs.statSync(dest);
        // Overwrite if it's a 404 placeholder (usually a few bytes or a specific small HTML string)
        if (stats.size > 1000 || dest.endsWith('.json')) {
            // Check if it's actually 404 content even if large (unlikely but possible)
            const head = fs.readFileSync(dest, { encoding: 'utf8', flag: 'r' }).slice(0, 50);
            if (!head.includes('404: Not Found') && !head.includes('<!DOCTYPE html>')) {
                return;
            }
        }
    }

    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                let redirectUrl = response.headers.location;
                if (!redirectUrl.startsWith('http')) {
                    const parsedUrl = new URL(url);
                    redirectUrl = `${parsedUrl.protocol}//${parsedUrl.host}${redirectUrl}`;
                }
                file.close();
                return downloadFile(redirectUrl, dest).then(resolve).catch(reject);
            }

            if (response.statusCode >= 400) {
                file.close();
                fs.unlinkSync(dest);
                // Create a clear placeholder so we know it failed
                fs.writeFileSync(dest, `FAILED: ${response.statusCode} for ${url}`);
                console.log(`\n[ERROR] ${response.statusCode} for ${url}`);
                resolve(); // Don't crash, just log
                return;
            }

            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            file.close();
            fs.unlink(dest, () => { });
            reject(err);
        });
    });
}

async function setup() {
    console.log("-----------------------------------------");
    console.log(" MIRA - PERMANENT NEURAL SETUP ");
    console.log("-----------------------------------------");

    for (const model of MODELS) {
        const modelDir = path.join(__dirname, '../public/models', model.id);
        if (!fs.existsSync(modelDir)) fs.mkdirSync(modelDir, { recursive: true });

        console.log(`\n[NEURAL] Preparing model: ${model.id}`);

        for (const f of STATIC_FILES) {
            process.stdout.write(`  - Fetching ${f}... `);
            await downloadFile(model.url + f, path.join(modelDir, f));
            console.log("DONE");
        }

        console.log(`  - Fetching library.wasm...`);
        await downloadFile(model.wasm, path.join(modelDir, 'library.wasm'));
        console.log("  - library.wasm DONE");

        console.log(`  - Fetching weights (${model.shards + 1} shards)...`);
        for (let i = 0; i <= model.shards; i++) {
            const shardName = `params_shard_${i}.bin`;
            const dest = path.join(modelDir, shardName);

            // Re-run download logic (it will skip valid large files)
            await downloadFile(model.url + shardName, dest);
            process.stdout.write(`.`);
        }
        console.log(`\n[SUCCESS] ${model.id} is offline and ready.`);
    }

    console.log("\n-----------------------------------------");
    console.log(" ALL SYSTEMS PERMANENTLY STORED ");
    console.log(" Mira will now load instantly from disk. ");
    console.log("-----------------------------------------");
}

setup().catch(console.error);
