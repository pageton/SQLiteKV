// interface
export interface OperationResult {
    success: boolean;
    message?: string;
}

export interface GetResult extends OperationResult {
    value: ValueType | null;
}

export interface KeysResult extends OperationResult {
    keys: string[];
}

export interface ConvertToJsonResult extends OperationResult {
    jsonString?: string;
    filePath?: string;
}

export interface CloseResult extends OperationResult {
    exportedData?: Uint8Array;
}

export interface ISQLiteDatabase {
    init(): Promise<void>;
    set(key: string, value: ValueType, oneTime?: boolean): Promise<boolean>;
    setex(
        key: string,
        seconds: number,
        value: ValueType,
        oneTime?: boolean
    ): Promise<boolean>;
    get(key: string): Promise<ValueType | null>;
    delete(key: string): Promise<boolean>;
    exists(key: string): Promise<boolean>;
    keys(): Promise<string[]>;
    convertToJson(jsonFilePath?: string): Promise<boolean>;
    close(): Promise<Uint8Array>;
    beginTransaction(): Promise<void>;
    commitTransaction(): Promise<void>;
}

export interface IKVStore extends ISQLiteDatabase {
    getAll(): Promise<{ [key: string]: ValueType }>;
    clear(): Promise<boolean>;
    size(): Promise<number>;
    updateJson(
        key: string,
        updateFunction: JsonUpdateFunction
    ): Promise<boolean>;
    increment(key: string, amount?: number): Promise<number | null>;
    mget(...keys: string[]): Promise<(ValueType | null)[]>;
}

export interface DatabaseConfig {
    dbFilename?: string;
    tableName?: string;
    autoCommit?: boolean;
    journalMode?: JournalMode;
    sqliteMode?: SQLiteMode;
    enableLoopOperations?: boolean;
    logQueries?: boolean;
}

export interface DatabaseInfo {
    databasePath: string;
    databaseName: string;
    tableName: string;
    numberOfKeys: number;
    sizeInBytes: number;
    sizeInMB: string;
    journalMode: string;
    lastModified: Date;
}

export interface Row {
    key: string;
    value: string;
}

// types

export type JournalMode =
    | "DELETE"
    | "TRUNCATE"
    | "PERSIST"
    | "MEMORY"
    | "WAL"
    | "OFF";

export type SQLiteMode = "disk" | "memory" | "temp";

export type ValueType = string | number | boolean | object | any[];

export type JsonUpdateFunction = (value: object) => object;
