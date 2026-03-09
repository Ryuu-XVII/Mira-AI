
const BRIDGE_LOG_URL = 'http://localhost:3001/log';
async function remoteLog(type: string, message: string, details?: any) {
    try {
        await fetch(BRIDGE_LOG_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            mode: 'no-cors',
            body: JSON.stringify({ type, message, details })
        });
    } catch (e) { }
}

const originalFetch = fetch;
(self as any).fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : (input as Request).url;
    if (url.includes(':3001/log')) return originalFetch(input, init);
    remoteLog('WORKER-FETCH-REQ', `Fetching: ${url}`);
    try {
        const response = await originalFetch(input, init);
        const contentType = response.headers.get('content-type') || '';
        const size = parseInt(response.headers.get('content-length') || '0');

        if (contentType.includes('text/html') || (size > 0 && size < 5000)) {
            const logResponse = response.clone();
            const text = await logResponse.text();
            if (text.trim().startsWith('<!doctype') || text.trim().startsWith('<html')) {
                remoteLog('WORKER-FETCH-WARN', `HTML instead of data: ${url}`, { peek: text.substring(0, 300) });
            } else {
                remoteLog('WORKER-FETCH-OK', `Data: ${url} (${text.length} bytes)`);
            }
        } else {
            remoteLog('WORKER-FETCH-OK-SILENT', `Binary/Large: ${url} (${size} bytes)`);
        }
        return response;
    } catch (error: any) {
        remoteLog('WORKER-FETCH-ERROR', `Failed: ${url}`, { error: error.message });
        throw error;
    }
};

import { WebWorkerMLCEngineHandler } from "@mlc-ai/web-llm";

console.log("[BRAIN-WORKER] Worker thread spawned with diagnostics.");
remoteLog('INFO', "Brain Worker diagnostics initialized.");

// Standard WebLLM handler - let it manage the engine instance internally
const handler = new WebWorkerMLCEngineHandler();

self.onmessage = (msg) => {
    handler.onmessage(msg);
};
