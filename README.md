# SQLiteKV

SQLiteKV is a key-value store built on top of SQLite3. This project allows you to perform basic key-value operations with the additional power of SQLite3, making it suitable for applications requiring persistent, lightweight, and reliable storage.

## Features

-   Basic key-value operations: set, get, delete, exists, keys
-   Support for expiry times on keys
-   JSON export of the database
-   Loop operations for repetitive tasks
-   Transaction management
-   Flexible journal modes (WAL, DELETE, etc.)
-   In-memory, temporary, and disk-based storage options
-   Logger mode to track executed SQL queries

## Installation

You can install the package by running the following command with `npm`:

```sh
npm install sqlitekv
```

Or with `pnpm`:

```sh
pnpm install sqlitekv
```

## Usage

### Basic Setup

Here is an example of how to set up and use the SQLiteKV store:

```typescript
import SQLiteKV from "sqlitekv";

(async () => {
    try {
        // Initialize the database with configuration
        const db = new SQLiteKV("example.sqlite", {
            tableName: "example_table",
            autoCommit: true,
            journalMode: "WAL",
            enableLoopOperations: true,
            logQueries: true
        });

        // Perform some operations
        await db.set("key1", "value1");
        const value = await db.get("key1");
        console.log(`Retrieved value for key1: ${value}`);

        // Check if a key exists
        const exists = await db.exists("key1");
        console.log(`Key1 exists: ${exists}`);

        // Delete a key
        await db.delete("key1");
        console.log(`Key1 deleted`);

        // Export the database to JSON
        await db.convertToJson("export.json");
        console.log("Database exported to export.json");
    } catch (error) {
        console.error("Error initializing database:", error);
    }
})();
```

You can also initialize the database without passing the configuration object:

```typescript
import SQLiteKV from "sqlitekv";

(async () => {
    try {
        // Initialize the database with default settings
        const db = new SQLiteKV("example.sqlite");

        // Perform some operations
        await db.set("key1", "value1");
        const value = await db.get("key1");
        console.log(`Retrieved value for key1: ${value}`);

        // Check if a key exists
        const exists = await db.exists("key1");
        console.log(`Key1 exists: ${exists}`);

        // Delete a key
        await db.delete("key1");
        console.log(`Key1 deleted`);

        // Export the database to JSON
        await db.convertToJson("export.json");
        console.log("Database exported to export.json");
    } catch (error) {
        console.error("Error initializing database:", error);
    }
})();
```

### Loop Operations

If you need to perform a set of operations repeatedly, you can use the loop operations feature:

```typescript
const operations = async () => {
    const timestamp = new Date().toISOString();
    await db.set(`test_key_${timestamp}`, `test_value_${timestamp}`);
    console.log(
        `Set key: test_key_${timestamp} with value: test_value_${timestamp}`
    );
};

const iterations = 10;
await db.performLoopOperations(operations, iterations);
```

## Configuration Options

You can customize the behavior of SQLiteKV using the following configuration options:

-   `tableName`: The name of the table used for storing key-value pairs.
-   `autoCommit`: Whether to automatically commit transactions.
-   `journalMode`: The journal mode for SQLite (e.g., WAL, DELETE).
-   `sqliteMode`: The storage mode for SQLite (disk, memory, temp).
-   `logQueries`: Whether to log executed SQL queries.
-   `enableLoopOperations`: Whether to enable loop operations.

## Viewing the SQLite Database

You can view and interact with the SQLite database using an online viewer such as [SQLite Viewer](https://sqlite3.online/).

## Similar Projects

There is a similar project in Python, which you can check out here: [Kvsqlite](https://github.com/AYMENJD/Kvsqlite).

## License

This project is licensed under the MIT License.
