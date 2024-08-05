import SQLiteKV from "sqlitekv";
import { performance } from "perf_hooks";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

const COLORS = {
    BLUE: "\x1b[34m",
    CYAN: "\x1b[36m",
    GREEN: "\x1b[32m",
    YELLOW: "\x1b[33m",
    RED: "\x1b[31m",
    RESET: "\x1b[0m"
};

interface BenchmarkResult {
    operation: string;
    duration: number;
    qps: number;
    avgLatency: number;
    memoryDelta: number;
}

type KeyValuePair = [string, string];

// Default number of operations
const DEFAULT_QUERY_COUNT = 100;

class Benchmark {
    private db: SQLiteKV;
    private results: BenchmarkResult[] = [];

    constructor(private dbPath: string, private queryCount: number) {
        this.db = new SQLiteKV(dbPath, { autoCommit: true });
    }

    private generateRandomData(count: number): KeyValuePair[] {
        return Array(count)
            .fill(null)
            .map(
                (): KeyValuePair => [
                    Math.random().toString(36).substring(2, 15),
                    Math.random().toString(36).substring(2, 15)
                ]
            );
    }

    private generateLargeData(
        count: number,
        totalSize: number
    ): KeyValuePair[] {
        const avgSize = Math.floor(totalSize / count);
        return Array(count)
            .fill(null)
            .map(
                (): KeyValuePair => [
                    Math.random().toString(36).substring(2, 15),
                    "X".repeat(avgSize)
                ]
            );
    }

    private async runOperation(
        name: string,
        operation: (k: string, v: string) => Promise<any>,
        data: KeyValuePair[]
    ) {
        const startMemory = process.memoryUsage().rss;
        const start = performance.now();
        let totalLatency = 0;

        for (const [k, v] of data) {
            const opStart = performance.now();
            await operation(k, v);
            totalLatency += performance.now() - opStart;
        }

        const duration = performance.now() - start;
        const endMemory = process.memoryUsage().rss;

        this.results.push({
            operation: name,
            duration,
            qps: Math.floor(data.length / (duration / 1000)),
            avgLatency: totalLatency / data.length,
            memoryDelta: endMemory - startMemory
        });
    }

    private async runConcurrentOperation(
        name: string,
        operation: (k: string, v: string) => Promise<any>,
        data: KeyValuePair[]
    ) {
        const startMemory = process.memoryUsage().rss;
        const start = performance.now();

        await Promise.all(data.map(([k, v]) => operation(k, v)));

        const duration = performance.now() - start;
        const endMemory = process.memoryUsage().rss;

        this.results.push({
            operation: name,
            duration,
            qps: Math.floor(data.length / (duration / 1000)),
            avgLatency: duration / data.length,
            memoryDelta: endMemory - startMemory
        });
    }

    async runBenchmarks() {
        await this.db.init();

        const standardData = this.generateRandomData(this.queryCount);
        const largeDataCount = Math.min(10, Math.floor(this.queryCount / 10));
        const largeData = this.generateLargeData(
            largeDataCount,
            1024 * 1024 * largeDataCount
        );

        // Standard operations
        await this.runOperation(
            "SET",
            (k, v) => this.db.set(k, v),
            standardData
        );
        await this.runOperation("GET", (k) => this.db.get(k), standardData);
        await this.runOperation(
            "EXISTS",
            (k) => this.db.exists(k),
            standardData
        );
        await this.runOperation(
            "DELETE",
            (k) => this.db.delete(k),
            standardData
        );

        // Operations with expiry
        await this.runOperation(
            "SETEX",
            (k, v) => this.db.setex(k, 60, v),
            standardData
        );
        await this.runOperation("TTL", (k) => this.db.ttl(k), standardData);

        // Large data operations
        await this.runOperation(
            "SET (Large)",
            (k, v) => this.db.set(k, v),
            largeData
        );
        await this.runOperation(
            "GET (Large)",
            (k) => this.db.get(k),
            largeData
        );

        // Concurrent operations
        const concurrentData = this.generateRandomData(
            Math.min(50, Math.floor(this.queryCount / 2))
        );
        await this.runConcurrentOperation(
            "Concurrent SET",
            (k, v) => this.db.set(k, v),
            concurrentData
        );
        await this.runConcurrentOperation(
            "Concurrent GET",
            (k) => this.db.get(k),
            concurrentData
        );

        // Clean up
        await this.db.clear();
    }

    async close() {
        await this.db.close();
    }

    printResults() {
        console.log(
            COLORS.BLUE,
            "\n====== SQLiteKV Benchmark Results ======\n",
            COLORS.RESET
        );

        this.results.forEach((result) => {
            console.log(
                COLORS.CYAN,
                `Operation: ${result.operation}`,
                COLORS.RESET
            );
            console.log(`  Duration: ${result.duration.toFixed(2)} ms`);
            console.log(`  Queries/sec: ${result.qps}`);
            console.log(`  Avg Latency: ${result.avgLatency.toFixed(3)} ms`);
            console.log(
                `  Memory Delta: ${(result.memoryDelta / 1024 / 1024).toFixed(
                    2
                )} MB`
            );
            console.log();
        });

        console.log(
            COLORS.GREEN,
            "Benchmark completed successfully!",
            COLORS.RESET
        );
    }
}

async function main() {
    const argv = await yargs(hideBin(process.argv))
        .option("count", {
            alias: "c",
            description: "Number of operations to perform",
            type: "number"
        })
        .help()
        .alias("help", "h")
        .parse();

    const queryCount = argv.count || DEFAULT_QUERY_COUNT;
    const dbPath = path.join(os.tmpdir(), `sqlitekv_benchmark.sqlite`);

    console.log(
        COLORS.YELLOW,
        `Starting SQLiteKV benchmark with ${queryCount} operations`,
        COLORS.RESET
    );
    console.log(`Database path: ${dbPath}\n`);

    const benchmark = new Benchmark(dbPath, queryCount);

    try {
        await benchmark.runBenchmarks();
        benchmark.printResults();
    } catch (error) {
        console.error(COLORS.RED, "Benchmark failed:", error, COLORS.RESET);
    } finally {
        // Close the database
        await benchmark.close();

        // Clean up the temporary database file
        try {
            if (fs.existsSync(dbPath)) {
                await fs.promises.unlink(dbPath);
                console.log(
                    COLORS.GREEN,
                    "Temporary database file deleted successfully.",
                    COLORS.RESET
                );
            } else {
                console.log(
                    COLORS.YELLOW,
                    "Temporary database file was already deleted by SQLiteKV.",
                    COLORS.RESET
                );
            }
        } catch (error) {
            console.error(
                COLORS.RED,
                "Failed to delete temporary database file:",
                error,
                COLORS.RESET
            );
        }
    }
}

main().catch(console.error);
