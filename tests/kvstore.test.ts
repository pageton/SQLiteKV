import { SQLiteKV } from "../src/kvstore";
import { SQLiteDatabase } from "../src/database";

jest.mock("../src/database");

describe("KVStore", () => {
    let db: SQLiteKV;
    let mockDb: jest.Mocked<SQLiteDatabase>;

    beforeEach(() => {
        db = new SQLiteKV();
        mockDb = db["db"] as jest.Mocked<SQLiteDatabase>;
    });

    test("set stores value", async () => {
        mockDb.set.mockResolvedValue(true);
        const result = await db.set("testKey", "testValue");
        expect(result).toBe(true);
        expect(mockDb.set).toHaveBeenCalledWith("testKey", "testValue", false);
    });

    test("setOneTime stores one-time value", async () => {
        mockDb.set.mockResolvedValue(true);
        const result = await db.set("testKey", "testValue", true);
        expect(result).toBe(true);
        expect(mockDb.set).toHaveBeenCalledWith("testKey", "testValue", true);
    });

    test("setex stores value with expiry", async () => {
        mockDb.setex.mockResolvedValue(true);
        const result = await db.setex("testKey", 60, "testValue");
        expect(result).toBe(true);
        expect(mockDb.setex).toHaveBeenCalledWith("testKey", 60, "testValue");
    });

    test("get retrieves value", async () => {
        mockDb.get.mockResolvedValue("value");
        const result = await db.get("key");
        expect(result).toBe("value");
        expect(mockDb.get).toHaveBeenCalledWith("key");
    });

    test("updateJson updates JSON value", async () => {
        mockDb.get.mockResolvedValue({ name: "John", age: 25 });
        const updateFn = (value: any) => ({ ...value, age: 30 });
        mockDb.set.mockResolvedValue(true);
        const result = await db.updateJson("testKey", updateFn);
        expect(result).toBe(true);
        expect(mockDb.set).toHaveBeenCalledWith(
            "testKey",
            { name: "John", age: 30 },
            false
        );
    });

    test("increment increases numeric value", async () => {
        mockDb.get.mockResolvedValue(5);
        const result = await db.increment("testKey", 3);
        expect(result).toBe(8);
        expect(mockDb.set).toHaveBeenCalledWith("testKey", 8, false);
    });

    test("mget retrieves multiple values", async () => {
        mockDb.get
            .mockResolvedValueOnce("value1")
            .mockResolvedValueOnce("value2");
        const result = await db.mget("key1", "key2");
        expect(result).toEqual(["value1", "value2"]);
    });
});
