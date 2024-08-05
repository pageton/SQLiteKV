import { SQLiteDatabase } from "./database";
import {
    ValueType,
    IKVStore,
    JsonUpdateFunction,
    JournalMode,
    SQLiteMode
} from "./types";

export class SQLiteKV implements IKVStore {
    private db: SQLiteDatabase;
    private initPromise: Promise<void>;

    constructor(
        dbFilename: string = "database.sqlite",
        configOrTableName?:
            | string
            | {
                  tableName?: string;
                  autoCommit?: boolean;
                  journalMode?: JournalMode;
                  sqliteMode?: SQLiteMode;
                  logQueries?: boolean;
              }
    ) {
        let config: {
            tableName?: string;
            autoCommit?: boolean;
            journalMode?: JournalMode;
            sqliteMode?: SQLiteMode;
            logQueries?: boolean;
        } = {};

        if (typeof configOrTableName === "string") {
            config.tableName = configOrTableName;
        } else if (typeof configOrTableName === "object") {
            config = configOrTableName;
        }

        const tableName = config.tableName ?? "kv_store";
        const autoCommit = config.autoCommit ?? true;
        const journalMode = config.journalMode ?? "WAL";
        const sqliteMode = config.sqliteMode ?? "disk";
        const logQueries = config.logQueries ?? false;

        this.db = new SQLiteDatabase(
            dbFilename,
            tableName,
            autoCommit,
            journalMode,
            sqliteMode,
            logQueries
        );
        this.initPromise = this.init();
    }
    getAll(): Promise<{ [key: string]: ValueType }> {
        throw new Error("Method not implemented.");
    }

    async convertToJson(jsonFilePath?: string): Promise<boolean> {
        await this.ensureInitialized();
        return this.db.convertToJson(jsonFilePath);
    }
    public async init(): Promise<void> {
        await this.db.init();
    }

    private async ensureInitialized(): Promise<void> {
        await this.initPromise;
    }

    async set(
        key: string,
        value: ValueType,
        oneTime: boolean = false
    ): Promise<boolean> {
        await this.ensureInitialized();
        return this.db.set(key, value, oneTime);
    }

    async setex(
        key: string,
        seconds: number,
        value: ValueType,
        oneTime: boolean = false
    ): Promise<boolean> {
        await this.ensureInitialized();
        return this.db.setex(key, seconds, value, oneTime);
    }

    async get(key: string): Promise<ValueType | null> {
        await this.ensureInitialized();
        return this.db.get(key);
    }

    async delete(key: string): Promise<boolean> {
        await this.ensureInitialized();
        return this.db.delete(key);
    }

    async exists(key: string): Promise<boolean> {
        await this.ensureInitialized();
        return this.db.exists(key);
    }

    async keys(pattern?: string): Promise<string[]> {
        await this.ensureInitialized();
        return this.db.keys(pattern);
    }

    async close(): Promise<Uint8Array> {
        await this.ensureInitialized();
        await this.db.close();
        return new Uint8Array(0);
    }
    async clear(): Promise<boolean> {
        await this.ensureInitialized();
        await this.db.clear();
        return true;
    }

    async size(): Promise<number> {
        await this.ensureInitialized();
        const keys = await this.keys();
        return keys.length;
    }

    async increment(key: string, amount: number = 1): Promise<number | null> {
        await this.ensureInitialized();
        const value = await this.get(key);
        if (typeof value === "number") {
            const newValue = value + amount;
            await this.set(key, newValue);
            return newValue;
        }
        return null;
    }

    async mget(...keys: string[]): Promise<ValueType[]> {
        await this.ensureInitialized();
        const values = await Promise.all(keys.map((key) => this.get(key)));
        return values.filter((value): value is ValueType => value !== null);
    }

    async beginTransaction(): Promise<void> {
        await this.ensureInitialized();
        await this.db.beginTransaction();
    }

    async commitTransaction(): Promise<void> {
        await this.ensureInitialized();
        await this.db.commitTransaction();
    }

    async ttl(key: string): Promise<number | null> {
        await this.ensureInitialized();
        return this.db.ttl(key);
    }

    async setJournalMode(mode: JournalMode): Promise<void> {
        await this.ensureInitialized();
        await this.db.setJournalMode(mode);
    }

    async getJournalMode(): Promise<JournalMode> {
        await this.ensureInitialized();
        return this.db.getJournalMode();
    }
}
