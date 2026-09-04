# GitHub Copilot Usage Insights

A GitHub Copilot extension canvas for inspecting local session usage:

- AI credits and cumulative usage over time
- input, output, reasoning, and cache-read tokens
- root-agent and per-sub-agent rollups
- model-call counts and durations
- recent and all-session aggregates
- highest-cost local sessions with drill-down

The interface follows the native GitHub Copilot Insights visual language and refreshes while the canvas is open.

## Privacy

All metrics are read locally from Copilot's session data. The extension:

- binds its renderer to `127.0.0.1`
- opens the local session databases read-only
- does not send usage data to an external service

## Install

In GitHub Copilot, use **Install extension from repository** with:

```text
https://github.com/davidkaya/github-copilot-usage-insights/tree/main
```

Or clone it manually into your user extensions directory:

```powershell
git clone https://github.com/davidkaya/github-copilot-usage-insights.git "$HOME\.copilot\extensions\github-copilot-usage-insights"
```

Reload extensions, then ask Copilot to open the **Usage insights** canvas.

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

- `extension.mjs` — canvas declaration, loopback server, actions, and refresh events
- `stats.mjs` — read-only SQLite aggregation and sub-agent metadata resolution
- `renderer.mjs` — responsive, theme-aware HTML renderer

The extension intentionally has no `package.json`: `@github/copilot-sdk` is resolved by the Copilot extension runtime, and SQLite uses Node.js's built-in `node:sqlite` module.

## Requirements

- GitHub Copilot with extension canvas support
- a runtime version that provides `node:sqlite`
- local Copilot session data containing `assistant_usage_events`

## Development

Install or clone the repository as a user extension, edit the `.mjs` files, and reload extensions. Avoid writing to stdout from extension code because stdout is reserved for JSON-RPC.
