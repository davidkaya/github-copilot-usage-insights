import assert from "node:assert/strict";
import vm from "node:vm";
import { describe, test } from "node:test";
import {
    buildCalendarLayout,
    buildCalendarSizing,
    dailyTokenLevel,
    dailyTokenNavigation,
    renderDashboardHtml,
} from "./renderer.mjs";

function makeDays(count = 365, start = new Date(2025, 8, 15)) {
    const days = [];
    const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    for (let index = 0; index < count; index += 1) {
        const date = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
        days.push({
            calls: index === count - 1 ? 2 : 0,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
            date,
            inputTokens: index === count - 1 ? 25 : 0,
            outputTokens: index === count - 1 ? 15 : 0,
            reasoningTokens: 4,
            totalTokens: index === count - 1 ? 40 : 0,
            weekday: cursor.getDay(),
        });
        cursor.setDate(cursor.getDate() + 1);
    }
    return days;
}

function syntheticDashboard(days = makeDays()) {
    return {
        aiCreditScale: 1_000_000_000,
        currentSessionId: "session-root",
        dailyTokens: {
            activeDays: 1,
            dayCount: 365,
            days,
            endDate: days.at(-1).date,
            maxDailyTokens: 40,
            metric: "input-output",
            startDate: days[0].date,
            timeZone: "UTC",
            totalTokens: 40,
        },
        generatedAt: "2026-09-15T12:00:00.000Z",
        range: {
            id: "7d",
            label: "Last 7 days",
            models: [],
            split: [],
            topSessions: [],
            totals: {
                aiCredits: 0,
                calls: 0,
                sessions: 0,
            },
        },
        ranges: [{ id: "7d", label: "Last 7 days" }],
        selected: {
            agents: [],
            info: { title: "Root session" },
            isCurrent: true,
            models: [],
            timeline: { calls: [] },
            totals: {
                aiCredits: 0,
                calls: 0,
                inputTokens: 0,
                outputTokens: 0,
                reasoningTokens: 0,
                cacheReadTokens: 0,
                cacheWriteTokens: 0,
            },
        },
    };
}

function shippedDailyHelpers() {
    const html = renderDashboardHtml({
        defaults: {
            capabilityToken: "capability-token",
            range: "7d",
            sessionId: "",
        },
        initialData: syntheticDashboard(),
        instanceId: "usage-insights-test",
    });
    const source = html.match(
        /\/\* shared daily calendar helpers \*\/([\s\S]*?)\/\* end shared daily calendar helpers \*\//,
    )?.[1];
    assert.ok(source);
    return vm.runInNewContext(
        `${source}\n({ buildCalendarLayout, buildCalendarSizing, dailyTokenLevel, dailyTokenNavigation })`,
    );
}

describe("daily calendar renderer helpers", () => {
    test("uses the four relative intensity quartiles", () => {
        assert.equal(dailyTokenLevel(0, 100), 0);
        assert.equal(dailyTokenLevel(1, 100), 1);
        assert.equal(dailyTokenLevel(25, 100), 1);
        assert.equal(dailyTokenLevel(26, 100), 2);
        assert.equal(dailyTokenLevel(50, 100), 2);
        assert.equal(dailyTokenLevel(51, 100), 3);
        assert.equal(dailyTokenLevel(75, 100), 3);
        assert.equal(dailyTokenLevel(76, 100), 4);
        assert.equal(dailyTokenLevel(100, 100), 4);
        assert.equal(dailyTokenLevel(10, 0), 0);
    });

    test("aligns dates into Sunday-first week columns and suppresses overlapping month labels", () => {
        const days = makeDays(365, new Date(2025, 8, 6));
        const layout = buildCalendarLayout(days);
        assert.equal(layout.firstWeekday, 6);
        assert.equal(layout.weekCount, 53);
        assert.equal(layout.leadingPadding, 6);
        assert.equal(layout.trailingPadding, 0);
        assert.equal(layout.cells[0].column, 0);
        assert.equal(layout.cells[0].row, 6);
        assert.ok(layout.monthLabels.length > 1);
        for (let index = 1; index < layout.monthLabels.length; index += 1) {
            assert.ok(layout.monthLabels[index].column > layout.monthLabels[index - 1].column);
        }

        const longerWindow = buildCalendarLayout(makeDays(366, new Date(2025, 8, 6)));
        assert.equal(longerWindow.weekCount, 54);
    });

    test("keeps keyboard navigation inside real dates and visual weeks", () => {
        const days = makeDays(365, new Date(2025, 8, 6));
        assert.equal(dailyTokenNavigation(days, 10, "ArrowRight"), 17);
        assert.equal(dailyTokenNavigation(days, 10, "ArrowDown"), 11);
        assert.equal(dailyTokenNavigation(days, 10, "Home"), 8);
        assert.equal(dailyTokenNavigation(days, 10, "End"), 14);
        assert.equal(dailyTokenNavigation(days, 0, "ArrowLeft"), 0);
        assert.equal(dailyTokenNavigation(days, 0, "Home", { ctrlKey: true }), 0);
        assert.equal(dailyTokenNavigation(days, 10, "End", { ctrlKey: true }), 364);
    });

    test("fits every day in a seven-row strip at narrow and wide widths", () => {
        const days = makeDays(365, new Date(2025, 8, 6));
        const layout = buildCalendarLayout(days);
        assert.equal(layout.cells.length, days.length);
        assert.equal(new Set(layout.cells.map((cell) => cell.date)).size, days.length);

        for (const viewportWidth of [320, 400, 560, 600, 1100]) {
            const inlineSize = viewportWidth - 44 - 28 - 10;
            const sizing = buildCalendarSizing(inlineSize, layout.weekCount);
            const stripWidth = layout.weekCount * sizing.cell +
                (layout.weekCount - 1) * sizing.gap;
            assert.ok(sizing.cell > 0);
            assert.ok(sizing.cell <= 12);
            assert.ok(sizing.gap <= 3);
            assert.equal(sizing.pitch, sizing.cell + sizing.gap);
            assert.ok(Math.abs(stripWidth - sizing.contentWidth) < 1e-9);
            assert.ok(sizing.contentWidth + sizing.edgePadding * 2 <= inlineSize + 1e-9);
        }
    });

    test("suppresses overlapping and clipped month labels using sized text bounds", () => {
        const days = makeDays(365, new Date(2025, 8, 6));
        const sizing = buildCalendarSizing(400, 53);
        const layout = buildCalendarLayout(days, {
            availableWidth: sizing.contentWidth,
            cell: sizing.cell,
            gap: sizing.gap,
            labelWidths: { "*": 28 },
        });
        let previousEnd = 0;
        for (const month of layout.monthLabels) {
            assert.ok(month.left >= previousEnd);
            assert.ok(month.left + month.width <= sizing.contentWidth + 1e-9);
            previousEnd = month.left + month.width;
        }
        assert.ok(layout.monthLabels.length > 0);
        assert.ok(layout.monthLabels.length < 13);

        const clipped = buildCalendarLayout(days, {
            availableWidth: sizing.contentWidth,
            cell: sizing.cell,
            gap: sizing.gap,
            labelWidths: { "*": sizing.contentWidth + 1 },
        });
        assert.equal(clipped.monthLabels.length, 0);
    });

    test("ships the same helper behavior in the generated browser script", () => {
        const days = makeDays(365, new Date(2025, 8, 6));
        const shipped = shippedDailyHelpers();
        assert.equal(shipped.dailyTokenLevel(76, 100), dailyTokenLevel(76, 100));
        assert.equal(
            shipped.buildCalendarSizing(320, 53).cell,
            buildCalendarSizing(320, 53).cell,
        );
        assert.deepEqual(
            JSON.parse(JSON.stringify(shipped.buildCalendarLayout(days))),
            buildCalendarLayout(days),
        );
        assert.equal(
            shipped.dailyTokenNavigation(days, 10, "End", { ctrlKey: true }),
            dailyTokenNavigation(days, 10, "End", { ctrlKey: true }),
        );
    });
});

describe("dashboard renderer integration", () => {
    test("places daily token usage before session history and bootstraps a complete payload", () => {
        const html = renderDashboardHtml({
            defaults: {
                capabilityToken: "capability-token",
                range: "7d",
                sessionId: "",
            },
            initialData: syntheticDashboard(),
            instanceId: "usage-insights-test",
        });
        assert.ok(html.indexOf("id=\"dailyTokensHeading\"") < html.indexOf("id=\"historyHeading\""));
        assert.match(html, /Daily token usage/);
        assert.match(html, /dailyTokens/);
        assert.match(html, /All local sessions/);
        assert.match(html, /Input \+ output tokens/);
        assert.match(html, /daily-day-button/);
        assert.match(html, /ResizeObserver/);
        assert.doesNotMatch(html, /daily-scroll|Scroll daily token usage calendar|scrollLeft/);
    });

    test("parses the generated inline browser script", () => {
        const html = renderDashboardHtml({
            defaults: {
                capabilityToken: "capability-token",
                range: "7d",
                sessionId: "",
            },
            initialData: syntheticDashboard(),
            instanceId: "usage-insights-test",
        });
        const script = html.match(/<script>\s*([\s\S]*?)\s*<\/script>/)?.[1];
        assert.ok(script);
        assert.doesNotThrow(() => new vm.Script(script));
    });
});
