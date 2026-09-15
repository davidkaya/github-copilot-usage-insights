import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, test } from "node:test";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import {
    buildDailyTokenUsage,
    createDailyTokenWindow,
    localDateKey,
    UsageInsightsStore,
} from "./stats.mjs";

let fixtureRoot;
let writableDb;
let store;

function setupFixture(rows = []) {
    fixtureRoot = mkdtempSync(join(process.cwd(), ".daily-token-test-"));
    writableDb = new DatabaseSync(join(fixtureRoot, "session-store.db"));
    writableDb.exec(`
        CREATE TABLE sessions (
            id TEXT PRIMARY KEY,
            summary TEXT,
            repository TEXT,
            branch TEXT,
            cwd TEXT,
            created_at TEXT,
            updated_at TEXT
        );
        CREATE TABLE assistant_usage_events (
            id INTEGER PRIMARY KEY,
            session_id TEXT,
            agent_id TEXT,
            model TEXT,
            input_tokens INTEGER,
            output_tokens INTEGER,
            reasoning_tokens INTEGER,
            cache_read_tokens INTEGER,
            cache_write_tokens INTEGER,
            total_nano_aiu INTEGER,
            duration_ms INTEGER,
            initiator TEXT,
            created_at TEXT
        );
    `);
    writableDb.prepare(`
        INSERT INTO sessions (id, summary, repository, branch, cwd, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
        "session-root",
        "Root session",
        "owner/repo",
        "main",
        fixtureRoot,
        "2026-01-01T00:00:00.000Z",
        "2026-01-01T00:00:00.000Z",
    );
    writableDb.prepare(`
        INSERT INTO sessions (id, summary, repository, branch, cwd, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
        "session-other",
        "Other session",
        "owner/repo",
        "main",
        fixtureRoot,
        "2026-01-01T00:00:00.000Z",
        "2026-01-01T00:00:00.000Z",
    );
    const insert = writableDb.prepare(`
        INSERT INTO assistant_usage_events (
            session_id, agent_id, model, input_tokens, output_tokens,
            reasoning_tokens, cache_read_tokens, cache_write_tokens,
            total_nano_aiu, duration_ms, initiator, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const row of rows) {
        insert.run(
            row.session_id || "session-root",
            row.agent_id || "",
            row.model || "model",
            row.input_tokens ?? null,
            row.output_tokens ?? null,
            row.reasoning_tokens ?? null,
            row.cache_read_tokens ?? null,
            row.cache_write_tokens ?? null,
            row.total_nano_aiu ?? 1,
            row.duration_ms ?? 1,
            row.initiator || "test",
            row.created_at,
        );
    }
    store = new UsageInsightsStore(fixtureRoot);
    return { insert, writableDb };
}

afterEach(() => {
    store?.sessionDb.close();
    writableDb?.close();
    store = undefined;
    writableDb = undefined;
    if (fixtureRoot) {
        rmSync(fixtureRoot, { force: true, recursive: true });
        fixtureRoot = undefined;
    }
});

describe("daily token calendar helpers", () => {
    test("creates exactly 365 ascending local calendar dates including today", () => {
        const now = new Date(2024, 2, 1, 12, 30, 0, 123);
        const window = createDailyTokenWindow(now);
        assert.equal(window.dayCount, 365);
        assert.equal(window.startDate, "2023-03-03");
        assert.equal(window.endDate, "2024-03-01");

        const usage = buildDailyTokenUsage([], now);
        assert.equal(usage.days.length, 365);
        assert.equal(new Set(usage.days.map((day) => day.date)).size, 365);
        assert.equal(usage.days[0].date, window.startDate);
        assert.equal(usage.days.at(-1).date, window.endDate);
        assert.deepEqual(
            usage.days.map((day) => day.date),
            usage.days.map((day) => day.date).sort(),
        );
    });

    test("zero-fills days and keeps cache/reasoning separate from input plus output", () => {
        const now = new Date(2026, 8, 15, 12);
        const usage = buildDailyTokenUsage(
            [
                {
                    cache_read_tokens: 100,
                    cache_write_tokens: 50,
                    created_at: new Date(2026, 8, 14, 9).toISOString(),
                    input_tokens: 10,
                    output_tokens: 20,
                    reasoning_tokens: 70,
                },
                {
                    created_at: new Date(2026, 8, 14, 10).toISOString(),
                    input_tokens: null,
                    output_tokens: 5,
                    reasoning_tokens: null,
                },
                {
                    created_at: new Date(2026, 8, 15, 12).toISOString(),
                    input_tokens: 0,
                    output_tokens: 0,
                    reasoning_tokens: 12,
                },
            ],
            now,
        );
        const yesterday = usage.days.find((day) => day.date === localDateKey(new Date(2026, 8, 14)));
        const today = usage.days.at(-1);

        assert.deepEqual(yesterday, {
            calls: 2,
            cacheReadTokens: 100,
            cacheWriteTokens: 50,
            date: yesterday.date,
            inputTokens: 10,
            outputTokens: 25,
            reasoningTokens: 70,
            totalTokens: 35,
            weekday: yesterday.weekday,
        });
        assert.equal(today.calls, 1);
        assert.equal(today.totalTokens, 0);
        assert.equal(usage.totalTokens, 35);
        assert.equal(usage.activeDays, 1);
        assert.equal(usage.maxDailyTokens, 35);
    });

    test("excludes events outside the captured instant and rejects invalid timestamps", () => {
        const now = new Date(2026, 8, 15, 12);
        const usage = buildDailyTokenUsage(
            [
                {
                    created_at: new Date(2025, 8, 15, 12).toISOString(),
                    input_tokens: 100,
                    output_tokens: 1,
                },
                {
                    created_at: now.toISOString(),
                    input_tokens: 3,
                    output_tokens: 4,
                },
                {
                    created_at: new Date(2026, 8, 15, 12, 0, 0, 2).toISOString(),
                    input_tokens: 99,
                    output_tokens: 99,
                },
            ],
            now,
        );
        assert.equal(usage.days.at(-1).totalTokens, 7);
        assert.throws(
            () => buildDailyTokenUsage([{ created_at: "not-a-timestamp" }], now),
            /Invalid usage event timestamp/,
        );
    });

    test("buckets repeated DST-hour instants by the local date in isolated timezone processes", () => {
        const moduleUrl = pathToFileURL(
            join(process.cwd(), "com.github.copilot", "extensions", "usage-insights", "stats.mjs"),
        ).href;
        const zones = [
            ["UTC", ["UTC"]],
            ["America/New_York", ["America/New_York"]],
            ["Asia/Kolkata", ["Asia/Kolkata", "Asia/Calcutta"]],
        ];
        for (const [zone, resolvedZones] of zones) {
            const child = spawnSync(
                process.execPath,
                [
                    "--input-type=module",
                    "-e",
                    `
                        import { buildDailyTokenUsage } from ${JSON.stringify(moduleUrl)};
                        const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
                        if (!${JSON.stringify(resolvedZones)}.includes(resolved)) {
                            throw new Error("Unexpected timezone: " + resolved);
                        }
                        const usage = buildDailyTokenUsage([
                            { created_at: "2024-11-03T05:30:00.000Z", input_tokens: 1, output_tokens: 2 },
                            { created_at: "2024-11-03T06:30:00.000Z", input_tokens: 3, output_tokens: 4 }
                        ], new Date("2024-11-03T18:00:00.000Z"));
                        console.log(JSON.stringify({
                            date: usage.endDate,
                            total: usage.days.at(-1).totalTokens,
                            calls: usage.days.at(-1).calls
                        }));
                    `,
                ],
                {
                    encoding: "utf8",
                    env: { ...process.env, TZ: zone },
                },
            );
            assert.equal(child.status, 0, child.stderr);
            assert.deepEqual(JSON.parse(child.stdout.trim()), {
                calls: 2,
                date: "2024-11-03",
                total: 10,
            });
        }
    });
});

describe("daily token store aggregation", () => {
    test("is independent of selected session and history range", () => {
        const now = new Date(2026, 8, 15, 12);
        setupFixture([
            {
                created_at: new Date(2026, 8, 14, 9).toISOString(),
                input_tokens: 10,
                output_tokens: 5,
                session_id: "session-root",
            },
            {
                created_at: new Date(2026, 8, 13, 9).toISOString(),
                input_tokens: 20,
                output_tokens: 5,
                session_id: "session-other",
            },
        ]);
        const first = store.buildDashboard({
            agentMetadata: new Map(),
            currentRuntime: undefined,
            currentSessionId: "session-root",
            now,
            range: "7d",
            selectedSessionId: "session-root",
        });
        const second = store.buildDashboard({
            agentMetadata: new Map(),
            currentRuntime: undefined,
            currentSessionId: "session-root",
            now,
            range: "all",
            selectedSessionId: "session-other",
        });
        assert.deepEqual(second.dailyTokens, first.dailyTokens);
        assert.equal(first.dailyTokens.totalTokens, 40);
        assert.equal(first.dailyTokens.days.at(-1).totalTokens, 0);
    });

    test("reuses a fresh cache, invalidates on data_version, and expires for future events", () => {
        const now = new Date(2026, 8, 15, 12);
        const future = new Date(now.getTime() + 4000);
        setupFixture([
            {
                created_at: future.toISOString(),
                input_tokens: 9,
                output_tokens: 1,
            },
        ]);

        const first = store.getDailyTokens(now);
        const hit = store.getDailyTokens(new Date(now.getTime() + 1000));
        assert.strictEqual(hit, first);
        assert.equal(first.totalTokens, 0);

        writableDb.prepare(`
            INSERT INTO assistant_usage_events (
                session_id, input_tokens, output_tokens, total_nano_aiu, duration_ms, created_at
            ) VALUES (?, ?, ?, ?, ?, ?)
        `).run("session-root", 4, 6, 1, 1, new Date(now.getTime() + 1000).toISOString());
        const invalidated = store.getDailyTokens(new Date(now.getTime() + 1000));
        assert.notStrictEqual(invalidated, first);
        assert.equal(invalidated.totalTokens, 10);

        const expired = store.getDailyTokens(new Date(now.getTime() + 6000));
        assert.equal(expired.totalTokens, 20);
    });

    test("opens the source database read-only and does not alter its schema", () => {
        setupFixture();
        const before = writableDb
            .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
            .all()
            .map((row) => row.name);
        store.getDailyTokens(new Date(2026, 8, 15, 12));
        const after = writableDb
            .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
            .all()
            .map((row) => row.name);
        assert.deepEqual(after, before);
        assert.throws(
            () => store.sessionDb.exec("CREATE TABLE should_not_exist (id INTEGER)"),
            /readonly|read-only/i,
        );
    });
});
