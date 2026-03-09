import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

interface MiraDB extends DBSchema {
    facts: {
        key: string;
        value: {
            content: string;
            timestamp: number;
            source: 'user' | 'observation' | 'system';
        };
        indexes: { 'by-timestamp': number };
    };
    preferences: {
        key: string;
        value: any;
    };
}

class MemoryService {
    private db: IDBPDatabase<MiraDB> | null = null;
    private dbName = 'mira-memory-v1';

    public async initialize() {
        if (this.db) return;

        this.db = await openDB<MiraDB>(this.dbName, 2, {
            upgrade(db) {
                const factsStore = db.createObjectStore('facts', { keyPath: 'id', autoIncrement: true });
                factsStore.createIndex('by-timestamp', 'timestamp');

                db.createObjectStore('preferences', { keyPath: 'key' });
            },
        });
    }

    public async addFact(content: string, source: 'user' | 'observation' | 'system' = 'user') {
        if (!this.db) await this.initialize();
        await this.db?.add('facts', {
            content,
            timestamp: Date.now(),
            source
        } as any);
    }

    public async getRecentFacts(limit = 10): Promise<string[]> {
        if (!this.db) await this.initialize();
        // Simple implementation: get all and slice (optimization needed for production)
        const facts = await this.db?.getAllFromIndex('facts', 'by-timestamp');
        if (!facts) return [];
        return facts.slice(-limit).map(f => f.content);
    }

    // Simple mock semantic search (keyword matching)
    public async recall(query: string): Promise<string[]> {
        if (!this.db) await this.initialize();
        let allFacts = await this.db?.getAll('facts');
        if (!allFacts) return [];

        // Limit search to last 200 facts to prevent main thread blocking
        if (allFacts.length > 200) {
            allFacts = allFacts.slice(-200);
        }

        const keywords = query.toLowerCase().split(' ').filter(w => w.length > 3);
        if (keywords.length === 0) return [];

        return allFacts
            .filter(f => keywords.some(k => f.content.toLowerCase().includes(k)))
            .map(f => f.content)
            .reverse() // Most recent first
            .slice(0, 5); // Only return top 5 relevant
    }

    public async setPreference(key: string, value: any) {
        if (!this.db) await this.initialize();
        await this.db?.put('preferences', { key, value });
    }

    public async getPreference(key: string) {
        if (!this.db) await this.initialize();
        const res = await this.db?.get('preferences', key);
        return res?.value;
    }
}

export const memory = new MemoryService();
