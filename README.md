# Usage Insights

A GitHub Copilot canvas extension for inspecting local session usage:

- current and historical AI-credit totals
- input, output, reasoning, cache-read, and cache-write tokens
- root-agent and per-sub-agent rollups
- model-call counts and durations
- recent and all-session aggregates
- highest-cost local sessions with in-canvas drill-down
- a GitHub contribution-style daily token heatmap for the past 365 local calendar days

The interface follows GitHub Copilot's native visual language and refreshes while
the canvas is open.

## Daily token usage

The **Daily token usage** calendar is global to the local Copilot data. It
includes root-agent and sub-agent usage from every locally recorded session,
regardless of the selected session or the **Session history** range. The window
contains exactly 365 local calendar dates, including today, and the local
timezone name is shown beside the scope.

Daily totals are **input tokens + output tokens**. Reasoning, cache-read, and
cache-write values are shown separately in the selected-day details and are not
added to that total. Empty cells mean no locally recorded token usage for that
date; they do not claim that cloud or unavailable history is complete. The
calendar's green intensity is relative to the busiest day in the displayed
365-day window. Select or focus a date to inspect its exact values, including
calls. The full Sunday-first, seven-row calendar stays in one strip at every
supported width by scaling its square cells and gaps to the available space;
it does not require horizontal scrolling.

## Privacy

All metrics are read locally from Copilot's session data. The extension:

- binds its renderer to `127.0.0.1`
- requires a per-instance capability token on every local HTTP and SSE route
- opens the local session databases read-only
- does not send usage data to an external service
- keeps historical session drill-down inside the canvas

## Install

After the plugin is approved for the Awesome Copilot marketplace, install it
with:

```text
copilot plugin install usage-insights@awesome-copilot
```

The package follows the Agent Plugins v1 layout and exposes the **Usage
Insights** canvas extension through `com.github.copilot`.

## Canvas actions

### `refresh`

Returns current metrics for an optional history range or selected session.

```json
{
  "range": "7d",
  "sessionId": "optional-session-id"
}
```

Supported ranges are `24h`, `7d`, `30d`, and `all`.

### `inspect_session`

Returns overall and per-agent metrics for one local session.

```json
{
  "sessionId": "required-session-id",
  "range": "7d"
}
```

## Structure

- `plugin.json` - Agent Plugins v1 metadata and canvas logo
- `com.github.copilot/extensions/usage-insights/extension.mjs` - canvas declaration, loopback server, actions, and refresh events
- `com.github.copilot/extensions/usage-insights/stats.mjs` - read-only SQLite aggregation and sub-agent metadata resolution
- `com.github.copilot/extensions/usage-insights/renderer.mjs` - responsive, theme-aware HTML renderer

The plugin intentionally has no `package.json`: `@github/copilot-sdk` is
resolved by the Copilot extension runtime, and SQLite uses Node.js's built-in
`node:sqlite` module.

## Requirements

- GitHub Copilot with extension canvas support
- a runtime version that provides `node:sqlite`
- local Copilot session data containing `assistant_usage_events`

## Development

Edit the `.mjs` files under
`com.github.copilot/extensions/usage-insights/` and reinstall the plugin when
testing package changes. Avoid writing to stdout from extension code because
stdout is reserved for JSON-RPC.

Run the focused unit and renderer checks from the repository root:

```powershell
node --test .\com.github.copilot\extensions\usage-insights\stats.test.mjs .\com.github.copilot\extensions\usage-insights\renderer.test.mjs
```
