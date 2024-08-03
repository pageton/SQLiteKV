import sqlite3 from "sqlite3";
import { open, Database } from "sqlite";
import fs from "fs/promises";
import path from "path";
import { ValueType, JournalMode, SQLiteMode, Row } from "./types";

export class SQLiteDatabase {
    private db: Database | null = null;
    private tableName: string;
    private autoCommit: boolean;
    private inTransaction: boolean = false;
    private dbPath: string;
    private journalMode: JournalMode;
    private sqliteMode: SQLiteMode;
    private logQueries?: boolean;

    constructor(
        private dbFilename: string = "database.sqlite",
        tableName: string = "kv_store",
        autoCommit: boolean = true,
        journalMode: JournalMode = "WAL",
        sqliteMode: SQLiteMode = "disk",
        logQueries: boolean = false
    ) {
        this.tableName = tableName;
        this.autoCommit = autoCommit;
        this.journalMode = journalMode;
        this.sqliteMode = sqliteMode;
        this.dbPath = this.getDbPathByMode(dbFilename, sqliteMode);
        this.logQueries = logQueries;
    }

    private getDbPathByMode(dbFilename: string, mode: SQLiteMode): string {
        switch (mode) {
            case "memory":
                return ":memory:";
            case "temp":
                return path.join(process.cwd(), "temp.sqlite");
            case "disk":
            default:
                return path.join(process.cwd(), dbFilename);
        }
    }

    private logQuery(query: string, params: any[]): void {
        if (this.logQueries) {
            const formattedParams = params.map((param) =>
                JSON.stringify(param)
            );
            let formattedQuery = query;
            formattedParams.forEach((param) => {
                formattedQuery = formattedQuery.replace("?", param);
            });
            console.log(`Executing Query: ${formattedQuery}`);
        }
    }

    async init(): Promise<void> {
        if (this.db) {
            return;
        }
        if (this.sqliteMode === "disk") {
            await this.ensureDirectoryExists(path.dirname(this.dbPath));
        }
        this.db = await open({
            filename: this.dbPath,
            driver: sqlite3.Database
        });
        await this.createTable();
        await this.setJournalMode(this.journalMode);
    }

    private async createTable(): Promise<void> {
        if (!this.db) {
            throw new Error("Database not initialized");
        }
        const query = `CREATE TABLE IF NOT EXISTS ${this.tableName} (
            key TEXT PRIMARY KEY,
            value TEXT,
            expiry INTEGER,
            one_time INTEGER DEFAULT 0
        )`;
        await this.db.run(query);
    }

    public async setJournalMode(mode: JournalMode): Promise<void> {
        if (!this.db) {
            throw new Error("Database not initialized");
        }

        const query = `PRAGMA journal_mode = ${mode.toUpperCase()};`;
        await this.db.run(query);

        const result = await this.db.get("PRAGMA journal_mode;");
        const currentMode = result?.["journal_mode"];
    }

    getDbPath(): string {
        return this.dbPath;
    }

    getDbFilename(): string {
        return this.dbFilename;
    }

    getTableName(): string {
        return this.tableName;
    }

    public async getJournalMode(): Promise<JournalMode> {
        if (!this.db) {
            throw new Error("Database not initialized");
        }
        const query = "PRAGMA journal_mode;";
        const result = await this.db.get(query);
        return result?.["journal_mode"] as JournalMode;
    }

    async set(
        key: string,
        value: ValueType,
        oneTime: boolean = false
    ): Promise<boolean> {
        return this.setWithExpiry(key, value, null, oneTime);
    }

    async setex(
        key: string,
        seconds: number,
        value: ValueType
    ): Promise<boolean> {
        const expiry = Date.now() + seconds * 1000;
        return this.setWithExpiry(key, value, expiry, false);
    }

    private async setWithExpiry(
        key: string,
        value: ValueType,
        expiry: number | null,
        oneTime: boolean
    ): Promise<boolean> {
        if (!this.db) {
            throw new Error("Database not initialized");
        }

        const existingValue = await this.get(key);
        let newValue: ValueType;

        if (existingValue !== null) {
            if (typeof value === "string") {
                newValue = value;
            } else if (Array.isArray(existingValue) && Array.isArray(value)) {
                newValue = existingValue.concat(value);
            } else if (
                typeof existingValue === "object" &&
                typeof value === "object"
            ) {
                newValue = { ...existingValue, ...value };
            } else {
                newValue = value;
            }
        } else {
            newValue = value;
        }

        const jsonValue = JSON.stringify(newValue);
        const query = `INSERT OR REPLACE INTO ${this.tableName} (key, value, expiry, one_time) VALUES (?, ?, ?, ?)`;
        const params = [key, jsonValue, expiry, oneTime ? 1 : 0];
        this.logQuery(query, params);
        await this.db.run(query, params);
        if (this.autoCommit && !this.inTransaction) {
            await this.commitTransaction();
        }
        return true;
    }

    async get(key: string): Promise<ValueType | null> {
        if (!this.db) {
            return null;
        }
        const query = `SELECT value, expiry, one_time FROM ${this.tableName} WHERE key = ?`;
        const params = [key];
        this.logQuery(query, params);
        const result = await this.db.get(query, params);

        if (!result || !result.value) {
            return null;
        }

        if (
            result.expiry &&
            typeof result.expiry === "number" &&
            result.expiry < Date.now()
        ) {
            await this.delete(key);
            return null;
        }

        if (result.one_time && result.one_time === 1) {
            await this.delete(key);
        }

        return JSON.parse(result.value);
    }

    async delete(key: string): Promise<boolean> {
        if (!this.db) {
            throw new Error("Database not initialized");
        }
        const query = `DELETE FROM ${this.tableName} WHERE key = ?`;
        const params = [key];
        this.logQuery(query, params);
        const result = await this.db.run(query, params);
        if (this.autoCommit && !this.inTransaction) {
            await this.commitTransaction();
        }
        return result && result.changes !== undefined
            ? result.changes > 0
            : false;
    }

    async exists(key: string): Promise<boolean> {
        if (!this.db) {
            throw new Error("Database not initialized");
        }
        const query = `SELECT 1 FROM ${this.tableName} WHERE key = ?`;
        const params = [key];
        this.logQuery(query, params);
        const result = await this.db.get(query, params);
        return result !== undefined;
    }

    async keys(pattern?: string): Promise<string[]> {
        if (!this.db) {
            throw new Error("Database not initialized");
        }

        let query = `SELECT key FROM ${this.tableName}`;
        const params: any[] = [];

        if (pattern) {
            query += ` WHERE key LIKE ?`;
            params.push(pattern.replace(/%/g, "\\%").replace(/_/g, "\\_"));
        }

        const result = await this.db.all(query, params);
        return result.map((row: Row) => row.key);
    }

    async convertToJson(jsonFilePath?: string): Promise<boolean> {
        if (!this.db) {
            throw new Error("Database not initialized");
        }
        const query = `SELECT key, value FROM ${this.tableName}`;
        const result = await this.db.all(query);
        const jsonObject: { [key: string]: ValueType } = {};
        result.forEach((row: Row) => {
            const key = row.key;
            const value = JSON.parse(row.value);
            jsonObject[key] = value;
        });

        const jsonString = JSON.stringify(jsonObject, null, 2);
        const filePath =
            jsonFilePath || path.join(process.cwd(), "database_export.json");

        try {
            await fs.writeFile(filePath, jsonString);
            return true;
        } catch (error) {
            return false;
        }
    }

    async close(): Promise<void> {
        if (!this.db) {
            throw new Error("Database not initialized");
        }
        this.logQuery("CLOSE DATABASE", []);
        await this.db.close();
        this.db = null;
    }

    private async ensureDirectoryExists(dirPath: string): Promise<void> {
        try {
            await fs.mkdir(dirPath, { recursive: true });
        } catch (err: unknown) {
            if ((err as NodeJS.ErrnoException).code !== "EEXIST") {
                throw err;
            }
        }
    }

    async beginTransaction(): Promise<void> {
        if (!this.db) {
            throw new Error("Database not initialized");
        }
        const query = "BEGIN TRANSACTION";
        this.logQuery(query, []);
        await this.db.run(query);
        this.inTransaction = true;
    }

    async commitTransaction(): Promise<void> {
        if (!this.db) {
            throw new Error("Database not initialized");
        }
        if (this.inTransaction) {
            const query = "COMMIT";
            this.logQuery(query, []);
            await this.db.run(query);
            this.inTransaction = false;
        }
    }

    async ttl(key: string): Promise<number | null> {
        if (!this.db) {
            return null;
        }
        const query = `SELECT expiry FROM ${this.tableName} WHERE key = ?`;
        const params = [key];
        this.logQuery(query, params);
        const result = await this.db.get(query, params);

        if (!result || !result.expiry) {
            return null;
        }

        if (typeof result.expiry === "number") {
            const timeLeft = result.expiry - Date.now();
            return Math.max(timeLeft, 0);
        } else {
            return null;
        }
    }

    async clear(): Promise<void> {
        if (!this.db) {
            throw new Error("Database not initialized");
        }
        const query = `DELETE FROM ${this.tableName}`;
        this.logQuery(query, []);
        await this.db.run(query);
    }

    async getInfo(): Promise<{
        journalMode: JournalMode;
        dbPath: string;
        dbFilename: string;
        tableName: string;
        dbSize: number;
        keysCount: number;
    } | null> {
        if (!this.db) {
            return null;
        }
        const journalMode = await this.getJournalMode();
        const dbSize = (await fs.stat(this.dbPath)).size;
        const keysCount = (await this.keys()).length;

        return {
            journalMode,
            dbPath: this.dbPath,
            dbFilename: this.dbFilename,
            tableName: this.tableName,
            dbSize,
            keysCount
        };
    }

    async checkJournalFile(): Promise<boolean> {
        const journalPath = this.dbPath + "-journal";
        try {
            await fs.access(journalPath);
            return true;
        } catch {
            return false;
        }
    }

    async performLoopOperations(
        operations: () => Promise<void>,
        iterations: number
    ): Promise<void> {
        if (!this.db) {
            throw new Error("Database not initialized");
        }
        for (let i = 0; i < iterations; i++) {
            await operations();
        }
    }
}
