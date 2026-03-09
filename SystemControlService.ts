// Type definition for Electron Bridge
declare global {
    interface Window {
        electron?: {
            system: {
                execute: (command: string, args: string[]) => Promise<any>;
            };
            onProcessInput?: (callback: (text: string) => void) => void;
            sendOutput?: (text: string) => void;
        }
    }
}

export class SystemControlService {
    private bridgeUrl = "http://localhost:3001/execute";

    public async executeCommand(command: string, args: string[]): Promise<boolean> {
        // 1. Try Native Electron Bridge
        if (window.electron) {
            try {
                console.log(`System [Native]: Requesting execution of ${command}`, args);
                await window.electron.system.execute(command, args);
                return true;
            } catch (error) {
                console.error("System [Native]: Execution failed:", error);
                return false;
            }
        }

        // 2. Fallback to Legacy HTTP Bridge
        try {
            console.log(`System [HTTP]: Requesting execution of ${command} with`, args);
            const response = await fetch(this.bridgeUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command, args })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("System [HTTP]: Bridge execution failed:", errorData.error);
                return false;
            }

            return true;
        } catch (error) {
            console.error("System: Bridge connection failed. Is the bridge server running?");
            return false;
        }
    }
}

export const systemControl = new SystemControlService();
