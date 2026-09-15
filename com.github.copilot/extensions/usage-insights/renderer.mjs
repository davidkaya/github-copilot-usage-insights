export function dailyTokenLevel(value, maximum) {
    const amount = Number(value);
    const max = Number(maximum);
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(max) || max <= 0) {
        return 0;
    }
    const ratio = amount / max;
    if (ratio <= 0.25) {
        return 1;
    }
    if (ratio <= 0.5) {
        return 2;
    }
    if (ratio <= 0.75) {
        return 3;
    }
    return 4;
}

function dailyDateParts(date) {
    const [year, month, day] = String(date).split("-").map(Number);
    return { day, month, year };
}

function dailyDateFromKey(date) {
    const { day, month, year } = dailyDateParts(date);
    return new Date(year, month - 1, day);
}

function monthLabelForDate(date) {
    const { month, year } = dailyDateParts(date);
    const monthName = new Intl.DateTimeFormat(undefined, { month: "short" }).format(
        new Date(year, month - 1, 1),
    );
    return month === 1 ? `${monthName} ${String(year).slice(-2)}` : monthName;
}

export function buildCalendarSizing(inlineSize, weekCount, focusPadding = 4) {
    const width = Number(inlineSize);
    const columns = Math.max(0, Math.floor(Number(weekCount) || 0));
    const edgePadding = Number.isFinite(Number(focusPadding))
        ? Math.max(0, Number(focusPadding))
        : 4;
    const availableWidth = Number.isFinite(width)
        ? Math.max(0, width - edgePadding * 2)
        : 0;
    const maximumWidth = columns * 12 + Math.max(0, columns - 1) * 3;
    const scale = maximumWidth
        ? Math.min(1, availableWidth / maximumWidth)
        : 0;
    const cell = 12 * scale;
    const gap = columns > 1 ? 3 * scale : 0;
    const contentWidth = columns * cell + Math.max(0, columns - 1) * gap;
    return {
        availableWidth,
        cell,
        contentWidth,
        edgePadding,
        gap,
        maximumWidth,
        pitch: cell + gap,
        scale,
    };
}

export function buildCalendarLayout(
    days = [],
    { cell = 12, gap = 3, availableWidth = Infinity, labelWidths = {} } = {},
) {
    if (!days.length) {
        return {
            cells: [],
            firstWeekday: 0,
            leadingPadding: 0,
            monthLabels: [],
            trailingPadding: 0,
            weekCount: 0,
        };
    }

    const cellSize = Math.max(0, Number(cell) || 0);
    const gapSize = Math.max(0, Number(gap) || 0);
    const pitch = cellSize + gapSize;
    const labelEnd = Number.isFinite(Number(availableWidth))
        ? Math.max(0, Number(availableWidth))
        : Infinity;
    const firstWeekday = Number(days[0].weekday) || 0;
    const weekCount = Math.ceil((firstWeekday + days.length) / 7);
    const cells = days.map((day, index) => {
        const slot = firstWeekday + index;
        return {
            ...day,
            column: Math.floor(slot / 7),
            index,
            row: slot % 7,
        };
    });

    const monthLabels = [];
    let nextAvailableX = -1;
    let previousMonth;
    for (const cell of cells) {
        const monthKey = cell.date.slice(0, 7);
        if (monthKey === previousMonth) {
            continue;
        }
        previousMonth = monthKey;
        const label = monthLabelForDate(cell.date);
        const measuredWidth = Number(labelWidths[label] ?? labelWidths["*"]);
        const labelWidth = Number.isFinite(measuredWidth)
            ? Math.max(0, measuredWidth)
            : label.length * 7;
        const left = cell.column * pitch;
        if (left < nextAvailableX || left + labelWidth > labelEnd) {
            continue;
        }
        monthLabels.push({
            column: cell.column,
            date: cell.date,
            label,
            left,
            width: labelWidth,
        });
        nextAvailableX = left + labelWidth;
    }

    return {
        cells,
        firstWeekday,
        leadingPadding: firstWeekday,
        monthLabels,
        trailingPadding: weekCount * 7 - firstWeekday - days.length,
        weekCount,
    };
}

export function dailyTokenNavigation(days, index, key, { ctrlKey = false } = {}) {
    if (!Array.isArray(days) || !days.length || index < 0 || index >= days.length) {
        return null;
    }
    if (ctrlKey && key === "Home") {
        return 0;
    }
    if (ctrlKey && key === "End") {
        return days.length - 1;
    }

    const layout = buildCalendarLayout(days);
    const slot = layout.firstWeekday + index;
    const column = Math.floor(slot / 7);
    let target;
    switch (key) {
        case "ArrowLeft":
            target = index - 7;
            break;
        case "ArrowRight":
            target = index + 7;
            break;
        case "ArrowUp":
            target = index - 1;
            break;
        case "ArrowDown":
            target = index + 1;
            break;
        case "Home":
            target = column * 7 - layout.firstWeekday;
            break;
        case "End":
            target = column * 7 + 6 - layout.firstWeekday;
            break;
        default:
            return null;
    }
    return Math.max(0, Math.min(days.length - 1, target));
}

const dailyCalendarBrowserHelpers = [
    dailyTokenLevel,
    dailyDateParts,
    dailyDateFromKey,
    monthLabelForDate,
    buildCalendarSizing,
    buildCalendarLayout,
    dailyTokenNavigation,
]
    .map((helper) => helper.toString())
    .join("\n\n");

function safeJson(value) {
    return JSON.stringify(value).replaceAll("<", "\\u003c");
}

export function renderDashboardHtml({ instanceId, defaults, initialData }) {
    const initial = safeJson({ ...defaults, instanceId });
    const bootstrap = safeJson(initialData || null);
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Usage Insights</title>
  <style>
    :root {
      color-scheme: light dark;
      --accent: var(--true-color-blue, #3b82f6);
      --accent-muted: var(--true-color-blue-muted, #172554);
      --danger: var(--true-color-red, #ef6a6a);
      --danger-muted: var(--true-color-red-muted, #3b161a);
      --canvas: var(--background-color-default, #0d1117);
      --text: var(--text-color-default, #f0f3f6);
      --muted: var(--text-color-muted, #9da7b3);
      --rule: var(--border-color-default, #30363d);
      --row: color-mix(in srgb, var(--canvas) 91%, var(--text) 9%);
      --row-hover: color-mix(in srgb, var(--canvas) 88%, var(--accent) 12%);
      --track: color-mix(in srgb, var(--text) 8%, transparent);
      --blue: var(--accent);
      --amber: #76551c;
      --teal: #3f747b;
      --slate: #667080;
      --red: #c75c5c;
      --violet: #6b63d8;
      --heatmap-0: color-mix(in srgb, var(--text) 8%, transparent);
      --heatmap-1: #b9dfbf;
      --heatmap-2: #80bd8c;
      --heatmap-3: #4b9d61;
      --heatmap-4: #2f7d46;
    }

    * { box-sizing: border-box; }

    html {
      background: var(--canvas);
      scrollbar-color: var(--muted) transparent;
    }

    body {
      margin: 0;
      background: var(--canvas);
      color: var(--text);
      font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
      font-size: var(--text-body-medium, 14px);
      line-height: var(--leading-body-medium, 20px);
      font-variant-numeric: tabular-nums lining-nums;
    }

    ::selection {
      background: var(--accent);
      color: var(--color-white, #fff);
    }

    button { font: inherit; }

    button:focus-visible {
      outline: 2px solid var(--color-focus-outline, var(--accent));
      outline-offset: 2px;
    }

    .shell {
      min-height: 100vh;
      border-left: 1px solid var(--rule);
      border-right: 1px solid var(--rule);
    }

    .summary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
      min-height: 70px;
      padding: 18px 22px;
      border-bottom: 1px solid var(--rule);
    }

    .summary h1 {
      margin: 0;
      font-size: var(--text-title-small, 16px);
      line-height: var(--leading-title-small, 22px);
      font-weight: var(--font-weight-semibold, 600);
      letter-spacing: -.01em;
    }

    .summary h1 strong { color: var(--accent); }

    .summary-meta {
      display: block;
      max-width: 72vw;
      margin-top: 3px;
      overflow: hidden;
      color: var(--muted);
      font-size: var(--text-body-small, 12px);
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .header-actions {
      display: flex;
      align-items: center;
      flex: 0 0 auto;
      gap: 10px;
    }

    .live {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      color: var(--muted);
      font-size: var(--text-body-small, 12px);
    }

    .live::before {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--accent);
      content: "";
    }

    .loading .live::before { animation: pulse 1.1s ease-in-out infinite; }

    .button {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 30px;
      border: 1px solid var(--rule);
      border-radius: 8px;
      padding: 4px 10px;
      background: transparent;
      color: var(--text);
      font-size: var(--text-body-small, 12px);
      cursor: pointer;
    }

    .button:hover { background: var(--row-hover); }
    .button[hidden] { display: none; }

    .button svg {
      width: 13px;
      height: 13px;
      stroke: currentColor;
    }

    .section {
      padding: 20px 22px;
      border-bottom: 1px solid var(--rule);
    }

    .section.flush { padding-inline: 0; }

    .section-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
      margin-bottom: 14px;
    }

    .section-head h2 {
      margin: 0;
      font-size: var(--text-title-small, 16px);
      line-height: var(--leading-title-small, 22px);
      font-weight: var(--font-weight-semibold, 600);
      letter-spacing: -.01em;
    }

    .section-head h2 span {
      color: var(--muted);
      font-weight: 400;
    }

    .section-head p {
      margin: 0;
      color: var(--muted);
      font-size: var(--text-body-small, 12px);
    }

    .color-0 { background: var(--amber); }
    .color-1 { background: var(--slate); }
    .color-2 { background: var(--teal); }
    .color-3 { background: var(--blue); }
    .color-4 { background: var(--red); }
    .color-5 { background: var(--violet); }

    .daily-scope {
      margin-top: 3px;
    }

    .daily-summary {
      display: flex;
      align-items: baseline;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 4px 12px;
      color: var(--muted);
      font-size: var(--text-body-small, 12px);
      text-align: right;
    }

    .daily-summary strong {
      color: var(--text);
      font-size: var(--text-title-small, 16px);
      font-weight: var(--font-weight-semibold, 600);
    }

    .daily-summary span {
      white-space: nowrap;
    }

    .daily-status {
      margin: -3px 0 12px;
      color: var(--muted);
      font-size: var(--text-body-small, 12px);
    }

    .daily-status[data-state="stale"],
    .daily-status[data-state="unavailable"] {
      color: var(--danger);
    }

    .daily-calendar-layout {
      --daily-cell: 12px;
      --daily-gap: 3px;
      --daily-pitch: calc(var(--daily-cell) + var(--daily-gap));
      --daily-focus-padding: 4px;
      --daily-content-width: 100%;
      display: grid;
      grid-template-columns: 28px minmax(0, 1fr);
      gap: 10px;
      min-width: 0;
    }

    .daily-weekday-labels {
      display: grid;
      grid-template-rows: 18px auto;
      row-gap: 0;
      align-items: start;
      padding-top: 1px;
      color: var(--muted);
      font-size: 10px;
      line-height: 1;
      text-align: right;
    }

    .daily-weekday-grid {
      display: grid;
      grid-template-rows: repeat(7, var(--daily-cell));
      row-gap: var(--daily-gap);
      align-items: center;
    }

    .daily-weekday-labels span {
      min-height: var(--daily-cell);
      line-height: var(--daily-cell);
    }

    .daily-calendar-track {
      min-width: 0;
      overflow: visible;
      padding: 1px var(--daily-focus-padding) 7px;
    }

    .daily-calendar-inner {
      width: 100%;
      min-width: 0;
    }

    .daily-month-labels {
      position: relative;
      height: 18px;
      width: var(--daily-content-width);
      color: var(--muted);
      font-size: 10px;
      line-height: 14px;
      white-space: nowrap;
    }

    .daily-month-label {
      position: absolute;
      top: 0;
      white-space: nowrap;
    }

    .daily-grid {
      display: grid;
      grid-template-rows: repeat(7, var(--daily-cell));
      row-gap: var(--daily-gap);
      width: var(--daily-content-width);
      min-width: 0;
    }

    .daily-grid-row {
      display: grid;
      grid-template-columns: repeat(var(--daily-week-count), var(--daily-cell));
      column-gap: var(--daily-gap);
      width: var(--daily-content-width);
      min-width: 0;
    }

    .daily-grid-cell {
      display: grid;
      place-items: center;
      width: var(--daily-cell);
      height: var(--daily-cell);
    }

    .daily-day-button {
      width: var(--daily-cell);
      height: var(--daily-cell);
      min-width: var(--daily-cell);
      border: 1px solid transparent;
      border-radius: 3px;
      padding: 0;
      background: var(--heatmap-0);
      color: transparent;
      cursor: pointer;
    }

    .daily-day-button:hover {
      border-color: color-mix(in srgb, var(--text) 38%, transparent);
    }

    .daily-day-button[data-level="0"] { background: var(--heatmap-0); }
    .daily-day-button[data-level="1"] { background: var(--heatmap-1); }
    .daily-day-button[data-level="2"] { background: var(--heatmap-2); }
    .daily-day-button[data-level="3"] { background: var(--heatmap-3); }
    .daily-day-button[data-level="4"] { background: var(--heatmap-4); }

    .daily-day-button[data-selected="true"] {
      border-color: var(--text);
      box-shadow: 0 0 0 1px var(--canvas);
    }

    .daily-day-button[tabindex="0"] {
      outline: 1px solid color-mix(in srgb, var(--accent) 72%, transparent);
      outline-offset: 2px;
    }

    .daily-day-button:focus-visible {
      outline: 2px solid var(--color-focus-outline, var(--accent));
      outline-offset: 3px;
    }

    .daily-detail {
      display: grid;
      gap: 10px;
      min-height: 92px;
      margin-top: 14px;
      padding: 12px 14px;
      border-radius: 10px;
      background: var(--row);
    }

    .daily-detail-heading {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 14px;
      min-width: 0;
    }

    .daily-detail-heading strong {
      min-width: 0;
      overflow-wrap: anywhere;
      word-break: break-word;
    }

    .daily-detail-heading span {
      color: var(--muted);
      min-width: 0;
      overflow-wrap: anywhere;
      word-break: break-word;
    }

    .daily-detail-copy {
      margin: 0;
      color: var(--muted);
      font-size: var(--text-body-small, 12px);
    }

    .daily-detail-list {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 6px 18px;
      margin: 0;
      min-width: 0;
    }

    .daily-detail-item {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;
      min-width: 0;
      color: var(--muted);
      font-size: var(--text-body-small, 12px);
    }

    .daily-detail-item dt,
    .daily-detail-item dd {
      margin: 0;
      min-width: 0;
      max-width: 100%;
      overflow-wrap: anywhere;
      word-break: break-word;
    }

    .daily-detail-item dt {
      flex: 1 1 8rem;
    }

    .daily-detail-item dd {
      flex: 0 1 auto;
      color: var(--text);
      font-variant-numeric: tabular-nums;
      text-align: right;
    }

    @media (max-width: 420px) {
      .daily-detail-list {
        grid-template-columns: minmax(0, 1fr);
      }
    }

    .daily-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
      margin-top: 14px;
      color: var(--muted);
      font-size: var(--text-body-small, 12px);
    }

    .daily-legend {
      display: inline-flex;
      align-items: center;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 5px;
    }

    .daily-legend-label {
      margin-inline: 2px 3px;
    }

    .daily-legend-swatch {
      width: 12px;
      height: 12px;
      border: 1px solid color-mix(in srgb, var(--text) 10%, transparent);
      border-radius: 3px;
    }

    .daily-legend-swatch[data-level="0"] { background: var(--heatmap-0); }
    .daily-legend-swatch[data-level="1"] { background: var(--heatmap-1); }
    .daily-legend-swatch[data-level="2"] { background: var(--heatmap-2); }
    .daily-legend-swatch[data-level="3"] { background: var(--heatmap-3); }
    .daily-legend-swatch[data-level="4"] { background: var(--heatmap-4); }

    .daily-unavailable {
      min-height: 106px;
      padding: 30px 18px;
      border-radius: 10px;
      background: var(--row);
      color: var(--muted);
      text-align: center;
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --heatmap-1: #183b28;
        --heatmap-2: #21643a;
        --heatmap-3: #2d8a4d;
        --heatmap-4: #42b866;
      }
    }

    .collapsible {
      width: 100%;
      border: 0;
      padding: 0;
      background: transparent;
      color: inherit;
      text-align: left;
      cursor: pointer;
    }

    .collapsible .chevron {
      display: inline-block;
      margin-right: 8px;
      color: var(--muted);
      transform: rotate(90deg);
    }

    .collapsible[aria-expanded="false"] .chevron { transform: rotate(0); }

    .chart {
      position: relative;
      height: 230px;
      margin-top: 12px;
    }

    .chart svg {
      display: block;
      width: 100%;
      height: 200px;
      overflow: visible;
    }

    .chart-grid {
      stroke: var(--rule);
      stroke-width: 1;
      vector-effect: non-scaling-stroke;
    }

    .chart-line {
      fill: none;
      stroke: var(--accent);
      stroke-width: 2;
      vector-effect: non-scaling-stroke;
    }

    .chart-area { fill: color-mix(in srgb, var(--accent) 19%, transparent); }
    .chart-dot { fill: var(--accent); }

    .chart-label {
      fill: var(--muted);
      font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
      font-size: 12px;
    }

    .chart-times {
      display: flex;
      justify-content: space-between;
      padding: 0 0 0 56px;
      color: var(--muted);
      font-size: var(--text-body-small, 12px);
    }

    .active-call {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      min-height: 48px;
      margin-top: 14px;
      padding: 10px 16px;
      border-radius: 12px;
      background: var(--row);
    }

    .active-call span:first-child {
      display: inline-flex;
      align-items: center;
      gap: 10px;
    }

    .activity-mark {
      display: grid;
      grid-template-columns: repeat(2, 3px);
      gap: 3px;
      width: 9px;
    }

    .activity-mark i {
      width: 3px;
      height: 3px;
      border-radius: 50%;
      background: var(--muted);
    }

    .active-call time { color: var(--muted); }

    .segmented {
      display: inline-flex;
      padding: 2px;
      border-radius: 10px;
      background: var(--row);
    }

    .segmented button {
      border: 0;
      border-radius: 8px;
      padding: 6px 11px;
      background: transparent;
      color: var(--muted);
      font-size: var(--text-body-small, 12px);
      font-weight: var(--font-weight-semibold, 600);
      cursor: pointer;
    }

    .segmented button:hover { color: var(--text); }

    .segmented button[aria-pressed="true"] {
      border: 1px solid var(--rule);
      padding: 5px 10px;
      background: var(--canvas);
      color: var(--text);
    }

    .bar-list {
      display: grid;
      gap: 18px;
    }

    .bar-row { min-width: 0; }

    .bar-label {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 7px;
    }

    .bar-label span:last-child {
      color: var(--muted);
      white-space: nowrap;
    }

    .bar-track {
      height: 8px;
      overflow: hidden;
      border-radius: 999px;
      background: var(--track);
    }

    .bar-fill {
      width: 100%;
      height: 100%;
      border-radius: inherit;
      transform-origin: left center;
    }

    .agent-detail {
      display: block;
      margin-top: 3px;
      color: var(--muted);
      font-size: var(--text-body-small, 12px);
    }

    .history-summary {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      margin: 0 -22px 20px;
      border-top: 1px solid var(--rule);
      border-bottom: 1px solid var(--rule);
      background: var(--row);
    }

    .history-stat {
      min-width: 0;
      padding: 12px 18px;
    }

    .history-stat + .history-stat { border-left: 1px solid var(--rule); }

    .history-stat strong {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .history-stat span {
      display: block;
      margin-top: 2px;
      color: var(--muted);
      font-size: var(--text-body-small, 12px);
    }

    .session-list {
      margin-inline: -22px;
      border-top: 1px solid var(--rule);
    }

    .session-button {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: 18px;
      width: 100%;
      min-height: 52px;
      border: 0;
      border-bottom: 1px solid var(--rule);
      padding: 9px 22px;
      background: transparent;
      color: inherit;
      text-align: left;
      cursor: pointer;
    }

    .session-button:hover { background: var(--row-hover); }

    .session-name {
      display: block;
      overflow: hidden;
      font-weight: var(--font-weight-semibold, 600);
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .session-meta {
      display: block;
      margin-top: 2px;
      overflow: hidden;
      color: var(--muted);
      font-size: var(--text-body-small, 12px);
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .session-cost {
      color: var(--muted);
      white-space: nowrap;
    }

    .empty {
      padding: 28px 22px;
      color: var(--muted);
      text-align: center;
    }

    .error {
      margin: 14px 22px;
      padding: 10px 12px;
      border: 1px solid color-mix(in srgb, var(--danger) 45%, var(--rule));
      border-radius: 8px;
      background: var(--danger-muted);
      color: var(--danger);
    }

    .footer {
      display: flex;
      justify-content: space-between;
      gap: 18px;
      padding: 16px 22px 24px;
      color: var(--muted);
      font-size: var(--text-body-small, 12px);
    }

    @keyframes pulse {
      50% { opacity: .35; }
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: .01ms !important;
        animation-iteration-count: 1 !important;
        scroll-behavior: auto !important;
      }
    }

    @media (max-width: 720px) {
      .summary, .section { padding-inline: 16px; }
      .history-summary, .session-list { margin-inline: -16px; }
      .history-stat { padding-inline: 12px; }
      .session-button { padding-inline: 16px; }
      .section-head { align-items: flex-start; }
    }

    @media (max-width: 560px) {
      .summary { align-items: flex-start; }
      .summary-meta { max-width: 58vw; }
      .live { font-size: 0; }
      .history-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .history-stat:nth-child(3) { border-left: 0; }
      .history-stat:nth-child(n+3) { border-top: 1px solid var(--rule); }
      .section-head { flex-direction: column; }
      .daily-summary { justify-content: flex-start; text-align: left; }
      .daily-footer { align-items: flex-start; flex-direction: column; }
      .daily-legend { justify-content: flex-start; }
      .chart { height: 210px; }
      .chart svg { height: 180px; }
    }

    @media (max-width: 400px) {
      .button span { display: none; }
      .history-summary { grid-template-columns: 1fr; }
      .history-stat + .history-stat { border-left: 0; border-top: 1px solid var(--rule); }
      .daily-detail-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .footer { flex-direction: column; }
    }
  </style>
</head>
<body>
<!--
THESIS: A native GHCP telemetry view for model usage, not a separate analytics dashboard.
OWN-WORLD: Flat dark surfaces, section dividers, dense labels, thin tracks, restrained Rampa-backed color.
STORY: Read total spend, follow cumulative credits, then compare agents, token categories, and session history.
FIRST VIEWPORT: Session cost header and the cumulative usage chart, followed immediately by per-agent rollups.
FORM: Direct extension of the native Insights canvas shown by the user; seed key ghcp-insights-telemetry-v3.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
-->
  <main class="shell loading" id="app">
    <header class="summary">
      <div>
        <h1>Session usage: <strong id="headerCredits">—</strong> AI credits · <span id="headerCalls">—</span> calls</h1>
        <span class="summary-meta" id="sessionTitle">Loading session...</span>
      </div>
      <div class="header-actions">
        <button class="button" id="backButton" type="button" aria-label="Return to current session" hidden>
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M6.5 3.5 2 8l4.5 4.5M2.5 8H14" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>Current session</span>
        </button>
        <span class="live" id="liveStatus" aria-live="polite">Live</span>
      </div>
    </header>

    <section class="section" aria-labelledby="creditsHeading">
      <div class="section-head">
        <h2 id="creditsHeading">
          <button class="collapsible" id="chartToggle" type="button" aria-expanded="true">
            <span class="chevron" aria-hidden="true">›</span>AI credits · <span id="chartCredits">—</span>
          </button>
        </h2>
      </div>
      <div id="chartContent">
        <div class="chart" id="creditChart"></div>
        <div class="active-call">
          <span>
            <span class="activity-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
            <span id="latestCallLabel">Latest model call</span>
          </span>
          <time id="latestCallDuration">—</time>
        </div>
      </div>
    </section>

    <section class="section" aria-labelledby="agentUsageHeading">
      <div class="section-head">
        <h2 id="agentUsageHeading">Usage by agent</h2>
        <div class="segmented" id="agentMetricControl" role="group" aria-label="Agent metric">
          <button type="button" data-metric="credits" aria-pressed="true">AI credits</button>
          <button type="button" data-metric="tokens" aria-pressed="false">Tokens</button>
        </div>
      </div>
      <div class="bar-list" id="agentBars"></div>
    </section>

    <section class="section" aria-labelledby="tokensHeading">
      <div class="section-head">
        <h2 id="tokensHeading">Token breakdown</h2>
        <p id="tokenTotal">— total tokens</p>
      </div>
      <div class="bar-list" id="tokenBars"></div>
    </section>

    <section class="section" aria-labelledby="dailyTokensHeading">
      <div class="section-head">
        <div>
          <h2 id="dailyTokensHeading">Daily token usage</h2>
          <p class="daily-scope" id="dailyTokensScope">All local sessions · Past 365 days · Local time</p>
        </div>
        <div class="daily-summary" aria-label="Daily token usage summary">
          <strong id="dailyTokensTotal">—</strong>
          <span>tokens</span>
          <span>·</span>
          <span id="dailyTokensActive">— active days</span>
        </div>
      </div>
      <p class="daily-status" id="dailyStatus" data-state="loading">Loading daily token usage...</p>
      <div id="dailyCalendarContent">
        <div class="daily-calendar-layout" id="dailyCalendarLayout">
          <div class="daily-weekday-labels" aria-hidden="true">
            <span></span>
            <div class="daily-weekday-grid">
              <span>Sun</span>
              <span></span>
              <span>Mon</span>
              <span></span>
              <span>Wed</span>
              <span></span>
              <span>Fri</span>
            </div>
          </div>
          <div class="daily-calendar-track" id="dailyCalendarTrack">
            <div class="daily-calendar-inner" id="dailyCalendarInner">
              <div class="daily-month-labels" id="dailyMonthLabels" aria-hidden="true"></div>
              <div class="daily-grid" id="dailyGrid" role="grid" aria-label="Daily token usage calendar"></div>
            </div>
          </div>
        </div>
        <div class="daily-detail" id="dailyDetail" role="region" aria-label="Selected day details">
          <div class="daily-detail-heading">
            <strong id="dailyDetailDate">Today</strong>
            <span id="dailyDetailTotal">— tokens</span>
          </div>
          <p class="daily-detail-copy" id="dailyDetailCopy">Loading daily token usage...</p>
          <dl class="daily-detail-list" id="dailyDetailList"></dl>
        </div>
        <div class="daily-footer">
          <span>Input + output tokens</span>
          <div class="daily-legend" id="dailyLegend" aria-label="Intensity relative to the busiest day"></div>
        </div>
        <div id="dailyAnnouncement" aria-live="polite" aria-atomic="true" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;"></div>
      </div>
      <div class="daily-unavailable" id="dailyUnavailable" hidden></div>
    </section>

    <section class="section" aria-labelledby="historyHeading">
      <div class="section-head">
        <div>
          <h2 id="historyHeading">Session history</h2>
          <p id="rangeLabel">Recent locally recorded usage</p>
        </div>
        <div class="segmented" id="rangeControl" role="group" aria-label="History range"></div>
      </div>
      <div class="history-summary">
        <div class="history-stat"><strong id="rangeCredits">—</strong><span>AI credits</span></div>
        <div class="history-stat"><strong id="rangeSessions">—</strong><span>Sessions</span></div>
        <div class="history-stat"><strong id="rootCredits">—</strong><span>Root agents</span></div>
        <div class="history-stat"><strong id="subagentCredits">—</strong><span>Sub-agents</span></div>
      </div>
      <div class="section-head">
        <h2>Highest-cost sessions</h2>
        <p>Select one to inspect its agent breakdown</p>
      </div>
      <div class="session-list" id="sessionList"></div>
    </section>

    <div class="error" id="errorState" role="alert" hidden></div>

    <footer class="footer">
      <span>Read-only · local Copilot usage data</span>
      <span id="updatedAt">Not updated yet</span>
    </footer>
  </main>

  <script>
    const initial = ${initial};
    const bootstrap = ${bootstrap};
    const state = {
      agentMetric: 'credits',
      range: initial.range || '7d',
      sessionId: initial.sessionId || '',
      loading: false,
      latestData: null,
      dailyData: null,
      dailySelectedDate: null,
      dailyFocusedDate: null,
      dailyPreviewDate: null,
      dailyLayout: null,
      dailyLayoutSignature: '',
      dailyCellByDate: new Map(),
      dailyDayByDate: new Map(),
    };

    const SVG_NS = 'http://www.w3.org/2000/svg';
    const app = document.getElementById('app');
    const errorState = document.getElementById('errorState');
    const backButton = document.getElementById('backButton');
    const chartToggle = document.getElementById('chartToggle');
    const chartContent = document.getElementById('chartContent');
    const numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
    const exactNumberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
    const compactFormat = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 2 });
    const creditFormat = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 });
    const dailyDateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'long' });
    const dailyCalendarContent = document.getElementById('dailyCalendarContent');
    const dailyCalendarLayout = document.getElementById('dailyCalendarLayout');
    const dailyCalendarTrack = document.getElementById('dailyCalendarTrack');
    const dailyGrid = document.getElementById('dailyGrid');
    const dailyMonthLabels = document.getElementById('dailyMonthLabels');
    const dailyStatus = document.getElementById('dailyStatus');
    const dailyUnavailable = document.getElementById('dailyUnavailable');
    const dailyAnnouncement = document.getElementById('dailyAnnouncement');

    /* shared daily calendar helpers */
    ${dailyCalendarBrowserHelpers}
    /* end shared daily calendar helpers */

    function formatNumber(value) {
      const amount = Number(value || 0);
      return amount >= 100000 ? compactFormat.format(amount) : numberFormat.format(amount);
    }

    function formatCredits(value) {
      return creditFormat.format(Number(value || 0));
    }

    function formatDuration(value, compact = false) {
      const ms = Math.max(0, Number(value || 0));
      const seconds = Math.floor(ms / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      if (ms < 1000) return Math.max(1, Math.round(ms)) + 'ms';
      if (hours) return hours + 'h ' + (minutes % 60) + 'm';
      if (minutes) return minutes + 'm ' + (compact ? '' : (seconds % 60) + 's').trim();
      return Math.max(1, seconds) + 's';
    }

    function text(id, value) {
      document.getElementById(id).textContent = value;
    }

    function element(tag, className, content) {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (content !== undefined) node.textContent = content;
      return node;
    }

    function svgElement(tag, attributes = {}) {
      const node = document.createElementNS(SVG_NS, tag);
      for (const [name, value] of Object.entries(attributes)) {
        node.setAttribute(name, String(value));
      }
      return node;
    }

    function renderCreditChart(selected) {
      const host = document.getElementById('creditChart');
      host.replaceChildren();
      const calls = selected.timeline.calls;
      if (!calls.length) {
        host.append(element('div', 'empty', 'No credit activity has been recorded yet.'));
        text('latestCallLabel', 'Latest model call');
        text('latestCallDuration', '—');
        return;
      }

      const width = 1000;
      const height = 190;
      const left = 54;
      const top = 10;
      const right = 10;
      const bottom = 18;
      const plotWidth = width - left - right;
      const plotHeight = height - top - bottom;
      const total = calls.reduce((sum, call) => sum + call.aiCredits, 0);
      const scaleTotal = Math.max(total, Number.EPSILON);
      let cumulative = 0;
      const points = calls.map((call) => {
        cumulative += call.aiCredits;
        const x = left + (call.endedAtMs - selected.timeline.startedAtMs) / selected.timeline.durationMs * plotWidth;
        const y = top + plotHeight - cumulative / scaleTotal * plotHeight;
        return { x, y };
      });

      const svg = svgElement('svg', {
        viewBox: '0 0 ' + width + ' ' + height,
        role: 'img',
        'aria-label': 'Cumulative AI credit usage over the selected session',
      });

      for (const ratio of [0, .25, .5, .75, 1]) {
        const y = top + plotHeight - ratio * plotHeight;
        svg.append(svgElement('line', { class: 'chart-grid', x1: left, x2: width - right, y1: y, y2: y }));
        const label = svgElement('text', { class: 'chart-label', x: 0, y: y + 4 });
        label.textContent = formatCredits(total * ratio);
        svg.append(label);
      }

      for (const ratio of [.25, .5, .75]) {
        const x = left + ratio * plotWidth;
        svg.append(svgElement('line', { class: 'chart-grid', x1: x, x2: x, y1: top, y2: top + plotHeight }));
      }

      const linePath = points.map((point, index) => (index ? 'L' : 'M') + point.x.toFixed(2) + ' ' + point.y.toFixed(2)).join(' ');
      const areaPath = linePath + ' L' + points.at(-1).x.toFixed(2) + ' ' + (top + plotHeight) + ' L' + points[0].x.toFixed(2) + ' ' + (top + plotHeight) + ' Z';
      svg.append(svgElement('path', { class: 'chart-area', d: areaPath }));
      svg.append(svgElement('path', { class: 'chart-line', d: linePath }));

      const pointStep = Math.max(1, Math.ceil(points.length / 52));
      points.forEach((point, index) => {
        if (index % pointStep === 0 || index === points.length - 1) {
          svg.append(svgElement('circle', { class: 'chart-dot', cx: point.x, cy: point.y, r: 3 }));
        }
      });

      host.append(svg);
      const times = element('div', 'chart-times');
      times.append(element('time', '', new Date(selected.timeline.startedAt).toLocaleTimeString()));
      times.append(element('time', '', new Date(selected.timeline.endedAt).toLocaleTimeString()));
      host.append(times);

      const latest = calls.at(-1);
      text('latestCallLabel', latest.model || 'Latest model call');
      text('latestCallDuration', formatDuration(latest.durationMs));
    }

    function renderAgentBars(selected) {
      const host = document.getElementById('agentBars');
      host.replaceChildren();
      if (!selected.agents.length) {
        host.append(element('div', 'empty', 'No per-agent usage has been recorded yet.'));
        return;
      }

      const values = selected.agents.map((agent) => {
        const tokens = agent.inputTokens + agent.outputTokens;
        return { agent, value: state.agentMetric === 'credits' ? agent.aiCredits : tokens };
      });
      const maximum = Math.max(...values.map((entry) => entry.value), Number.EPSILON);

      values.forEach((entry, index) => {
        const row = element('div', 'bar-row');
        const label = element('div', 'bar-label');
        const left = document.createElement('span');
        left.append(element('span', '', entry.agent.displayName));
        left.append(element('span', 'agent-detail', [
          entry.agent.models.join(', '),
          entry.agent.calls + ' calls',
        ].filter(Boolean).join(' · ')));
        label.append(left);
        label.append(element('span', '', state.agentMetric === 'credits'
          ? formatCredits(entry.value) + ' AI credits'
          : formatNumber(entry.value) + ' tokens'));
        row.append(label);
        const track = element('div', 'bar-track');
        const fill = element('div', 'bar-fill color-' + (index % 6));
        fill.style.transform = 'scaleX(' + entry.value / maximum + ')';
        track.append(fill);
        row.append(track);
        host.append(row);
      });
    }

    function renderTokenBars(totals) {
      const host = document.getElementById('tokenBars');
      host.replaceChildren();
      const values = [
        { label: 'Input', value: totals.inputTokens, color: 1 },
        { label: 'Cache read', value: totals.cacheReadTokens, color: 2 },
        { label: 'Cache write', value: totals.cacheWriteTokens, color: 0 },
        { label: 'Output', value: totals.outputTokens, color: 3 },
        { label: 'Reasoning', value: totals.reasoningTokens, color: 5 },
      ];
      const maximum = Math.max(...values.map((entry) => entry.value), Number.EPSILON);
      const total = totals.inputTokens + totals.outputTokens;
      text('tokenTotal', formatNumber(total) + ' total tokens');

      for (const entry of values) {
        const row = element('div', 'bar-row');
        const label = element('div', 'bar-label');
        label.append(element('span', '', entry.label));
        label.append(element('span', '', formatNumber(entry.value)));
        row.append(label);
        const track = element('div', 'bar-track');
        const fill = element('div', 'bar-fill color-' + entry.color);
        fill.style.transform = 'scaleX(' + entry.value / maximum + ')';
        track.append(fill);
        row.append(track);
        host.append(row);
      }
    }

    function dailyExactNumber(value) {
      return exactNumberFormat.format(Number(value || 0));
    }

    function dailyAccessibleName(day) {
      return dailyDateFormat.format(dailyDateFromKey(day.date)) + ': ' +
        dailyExactNumber(day.totalTokens) + ' tokens; ' +
        dailyExactNumber(day.calls) + ' calls';
    }

    function dailyDayCopy(day) {
      if (day.totalTokens > 0) {
        return 'Input + output make up total tokens. Reasoning and cache values are reported separately.';
      }
      if (day.calls > 0) {
        return 'Calls were recorded, but no input or output tokens were recorded.';
      }
      return 'No recorded token usage.';
    }

    function setDailyStatus(message, stateName) {
      dailyStatus.textContent = message || '';
      dailyStatus.hidden = !message;
      if (stateName) dailyStatus.dataset.state = stateName;
      else delete dailyStatus.dataset.state;
    }

    function renderDailyDetails(day, announce) {
      if (!day) return;
      const todayLabel = state.dailyData && day.date === state.dailyData.endDate ? ' · Today' : '';
      text('dailyDetailDate', dailyDateFormat.format(dailyDateFromKey(day.date)) + todayLabel);
      text('dailyDetailTotal', dailyExactNumber(day.totalTokens) + ' tokens');
      text('dailyDetailCopy', dailyDayCopy(day));
      const list = document.getElementById('dailyDetailList');
      list.replaceChildren();
      [
        ['Input', day.inputTokens],
        ['Output', day.outputTokens],
        ['Reasoning (reported separately)', day.reasoningTokens],
        ['Cache read (reported separately)', day.cacheReadTokens],
        ['Cache write (reported separately)', day.cacheWriteTokens],
        ['Calls', day.calls],
      ].forEach((entry) => {
        const item = element('div', 'daily-detail-item');
        item.append(element('dt', '', entry[0]));
        item.append(element('dd', '', dailyExactNumber(entry[1])));
        list.append(item);
      });
      if (announce) {
        dailyAnnouncement.textContent = dailyAccessibleName(day);
      }
    }

    function renderDailyLegend(maximum) {
      const legend = document.getElementById('dailyLegend');
      legend.replaceChildren();
      legend.append(element('span', 'daily-legend-label', 'Less'));
      const bounds = [
        'No recorded token usage (0 tokens)',
        'More than 0 and up to 25% of busiest day (' + dailyExactNumber(Number(maximum || 0) * .25) + ' tokens)',
        'More than 25% and up to 50% of busiest day (' + dailyExactNumber(Number(maximum || 0) * .5) + ' tokens)',
        'More than 50% and up to 75% of busiest day (' + dailyExactNumber(Number(maximum || 0) * .75) + ' tokens)',
        'More than 75% of busiest day (maximum ' + dailyExactNumber(maximum) + ' tokens)',
      ];
      bounds.forEach((label, level) => {
        const swatch = element('span', 'daily-legend-swatch');
        swatch.dataset.level = String(level);
        swatch.setAttribute('role', 'img');
        swatch.setAttribute('aria-label', label);
        swatch.title = label;
        legend.append(swatch);
      });
      legend.append(element('span', 'daily-legend-label', 'More'));
    }

    function updateDailyButton(button, day, maximum) {
      if (!button) return;
      button.dataset.level = String(dailyTokenLevel(day.totalTokens, maximum));
      button.dataset.selected = String(day.date === state.dailySelectedDate);
      button.tabIndex = day.date === state.dailyFocusedDate ? 0 : -1;
      button.setAttribute('aria-label', dailyAccessibleName(day));
      button.title = dailyAccessibleName(day);
    }

    function previewDailyDate(date) {
      if (!state.dailyDayByDate.has(date)) return;
      state.dailyPreviewDate = date;
      renderDailyDetails(state.dailyDayByDate.get(date), false);
    }

    function clearDailyPreview() {
      if (!state.dailyPreviewDate) return;
      state.dailyPreviewDate = null;
      renderDailyDetails(state.dailyDayByDate.get(state.dailySelectedDate), false);
    }

    function commitDailyDate(date) {
      const day = state.dailyDayByDate.get(date);
      if (!day) return;
      state.dailySelectedDate = date;
      state.dailyPreviewDate = null;
      for (const [candidateDate, button] of state.dailyCellByDate) {
        button.dataset.selected = String(candidateDate === date);
      }
      renderDailyDetails(day, true);
    }

    function focusDailyDate(date, focus = true) {
      const button = state.dailyCellByDate.get(date);
      if (!button) return;
      state.dailyFocusedDate = date;
      for (const [candidateDate, candidateButton] of state.dailyCellByDate) {
        candidateButton.tabIndex = candidateDate === date ? 0 : -1;
      }
      if (focus) {
        button.focus({ preventScroll: true });
      }
    }

    function attachDailyButtonEvents(button) {
      button.addEventListener('mouseenter', () => previewDailyDate(button.dataset.date));
      button.addEventListener('focus', () => {
        state.dailyFocusedDate = button.dataset.date;
        previewDailyDate(button.dataset.date);
        for (const [date, candidate] of state.dailyCellByDate) {
          candidate.tabIndex = date === state.dailyFocusedDate ? 0 : -1;
        }
      });
      button.addEventListener('click', () => commitDailyDate(button.dataset.date));
      button.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          commitDailyDate(button.dataset.date);
          return;
        }
        const days = state.dailyData?.days || [];
        const index = days.findIndex((day) => day.date === button.dataset.date);
        const target = dailyTokenNavigation(days, index, event.key, {
          ctrlKey: event.ctrlKey || event.metaKey,
        });
        if (target === null) return;
        event.preventDefault();
        focusDailyDate(days[target].date);
      });
    }

    function measureDailyMonthLabelWidths(days) {
      const widths = {};
      const measured = new Set();
      dailyMonthLabels.replaceChildren();
      for (const day of days) {
        const labelText = monthLabelForDate(day.date);
        if (measured.has(labelText)) continue;
        measured.add(labelText);
        const probe = element('span', 'daily-month-label', labelText);
        probe.style.left = '0px';
        probe.style.visibility = 'hidden';
        dailyMonthLabels.append(probe);
        const width = probe.getBoundingClientRect().width;
        widths[labelText] = width > 0 ? width : labelText.length * 7;
        probe.remove();
      }
      return widths;
    }

    function renderDailyMonthLabels(labels) {
      dailyMonthLabels.replaceChildren();
      for (const month of labels) {
        const label = element('span', 'daily-month-label', month.label);
        label.style.left = month.left + 'px';
        dailyMonthLabels.append(label);
      }
    }

    function resizeDailyCalendar() {
      if (!state.dailyData || !state.dailyLayout) return;
      const styles = getComputedStyle(dailyCalendarLayout);
      const focusPadding = Number.parseFloat(
        styles.getPropertyValue('--daily-focus-padding'),
      ) || 0;
      const sizing = buildCalendarSizing(
        dailyCalendarTrack.clientWidth,
        state.dailyLayout.weekCount,
        focusPadding,
      );
      dailyCalendarLayout.style.setProperty('--daily-cell', sizing.cell + 'px');
      dailyCalendarLayout.style.setProperty('--daily-gap', sizing.gap + 'px');
      dailyCalendarLayout.style.setProperty('--daily-pitch', sizing.pitch + 'px');
      dailyCalendarLayout.style.setProperty('--daily-content-width', sizing.contentWidth + 'px');
      const sizedLayout = buildCalendarLayout(state.dailyData.days, {
        availableWidth: sizing.contentWidth,
        cell: sizing.cell,
        gap: sizing.gap,
        labelWidths: measureDailyMonthLabelWidths(state.dailyData.days),
      });
      renderDailyMonthLabels(sizedLayout.monthLabels);
    }

    function buildDailyCalendar(layout, days) {
      state.dailyCellByDate = new Map();
      renderDailyMonthLabels([]);
      dailyGrid.replaceChildren();
      dailyCalendarLayout.style.setProperty('--daily-week-count', String(layout.weekCount));
      dailyGrid.setAttribute('aria-rowcount', '7');
      dailyGrid.setAttribute('aria-colcount', String(layout.weekCount));

      for (let rowIndex = 0; rowIndex < 7; rowIndex += 1) {
        const row = element('div', 'daily-grid-row');
        row.setAttribute('role', 'row');
        row.setAttribute('aria-rowindex', String(rowIndex + 1));
        for (let column = 0; column < layout.weekCount; column += 1) {
          const cell = element('div', 'daily-grid-cell');
          cell.setAttribute('role', 'gridcell');
          cell.setAttribute('aria-colindex', String(column + 1));
          const index = column * 7 + rowIndex - layout.firstWeekday;
          if (index >= 0 && index < days.length) {
            const day = days[index];
            const button = element('button', 'daily-day-button');
            button.type = 'button';
            button.dataset.date = day.date;
            attachDailyButtonEvents(button);
            cell.append(button);
            state.dailyCellByDate.set(day.date, button);
          } else {
            cell.setAttribute('aria-hidden', 'true');
          }
          row.append(cell);
        }
        dailyGrid.append(row);
      }
    }

    function renderDailyTokens(dailyTokens) {
      if (!dailyTokens || !Array.isArray(dailyTokens.days)) {
        if (!state.dailyData) {
          dailyCalendarContent.hidden = true;
          dailyUnavailable.hidden = false;
          dailyUnavailable.textContent = 'Daily token usage is unavailable.';
          text('dailyTokensTotal', '—');
          text('dailyTokensActive', '— active days');
          setDailyStatus('', '');
        } else {
          setDailyStatus('Daily token usage is unavailable; showing the last successful data.', 'unavailable');
        }
        return;
      }
      const days = dailyTokens.days;
      const layout = buildCalendarLayout(days);
      const calendarHadFocus = dailyCalendarContent.contains(document.activeElement);
      const signature = dailyTokens.startDate + '|' + dailyTokens.endDate + '|' + layout.weekCount;
      if (signature !== state.dailyLayoutSignature) {
        buildDailyCalendar(layout, days);
        state.dailyLayoutSignature = signature;
      }

      state.dailyData = dailyTokens;
      state.dailyLayout = layout;
      state.dailyDayByDate = new Map(days.map((day) => [day.date, day]));
      if (!state.dailySelectedDate || !state.dailyDayByDate.has(state.dailySelectedDate)) {
        state.dailySelectedDate = dailyTokens.endDate;
      }
      if (!state.dailyFocusedDate || !state.dailyDayByDate.has(state.dailyFocusedDate)) {
        state.dailyFocusedDate = dailyTokens.endDate;
      }
      if (state.dailyPreviewDate && !state.dailyDayByDate.has(state.dailyPreviewDate)) {
        state.dailyPreviewDate = null;
      }

      dailyCalendarContent.hidden = false;
      dailyUnavailable.hidden = true;
      resizeDailyCalendar();
      for (const day of days) {
        updateDailyButton(state.dailyCellByDate.get(day.date), day, dailyTokens.maxDailyTokens);
      }
      text('dailyTokensTotal', formatNumber(dailyTokens.totalTokens));
      text('dailyTokensActive', formatNumber(dailyTokens.activeDays) + ' active days');
      text('dailyTokensScope', 'All local sessions · Past 365 days · ' + (dailyTokens.timeZone || 'Local time'));
      renderDailyLegend(dailyTokens.maxDailyTokens);
      renderDailyDetails(
        state.dailyDayByDate.get(state.dailyPreviewDate || state.dailySelectedDate),
        false,
      );
      if (dailyTokens.totalTokens === 0) {
        setDailyStatus('No token usage recorded in the past 365 days.', 'empty');
      } else {
        setDailyStatus('', '');
      }
      if (calendarHadFocus) {
        state.dailyCellByDate.get(state.dailyFocusedDate)?.focus({ preventScroll: true });
      }
    }

    function markDailyStale(error) {
      if (state.dailyData) {
        setDailyStatus(
          'Daily token usage is unavailable; showing the last successful data.',
          'stale',
        );
      } else {
        dailyCalendarContent.hidden = true;
        dailyUnavailable.hidden = false;
        dailyUnavailable.textContent = 'Daily token usage is unavailable: ' +
          (error instanceof Error ? error.message : 'Unable to load daily usage.');
        setDailyStatus('Daily token usage is unavailable.', 'unavailable');
      }
    }

    function renderRangeControl(data) {
      const control = document.getElementById('rangeControl');
      control.replaceChildren();
      for (const range of data.ranges) {
        const button = element('button', '', range.id === 'all' ? 'All' : range.id);
        button.type = 'button';
        button.setAttribute('aria-pressed', String(range.id === state.range));
        button.title = range.label;
        button.addEventListener('click', () => {
          if (state.range !== range.id) {
            state.range = range.id;
            load();
          }
        });
        control.append(button);
      }
    }

    function renderHistory(range) {
      const split = new Map(range.split.map((entry) => [entry.segment, entry]));
      text('rangeCredits', formatCredits(range.totals.aiCredits));
      text('rangeSessions', formatNumber(range.totals.sessions));
      text('rootCredits', formatCredits(split.get('root')?.aiCredits || 0));
      text('subagentCredits', formatCredits(split.get('subagents')?.aiCredits || 0));
      text('rangeLabel', range.label + ' · ' + formatNumber(range.totals.calls) + ' calls');

      const list = document.getElementById('sessionList');
      list.replaceChildren();
      if (!range.topSessions.length) {
        list.append(element('div', 'empty', 'No usage was recorded in this range.'));
        return;
      }

      for (const item of range.topSessions) {
        const button = element('button', 'session-button');
        button.type = 'button';
        button.title = 'Inspect ' + item.title;
        button.addEventListener('click', () => {
          state.sessionId = item.id;
          load();
          window.scrollTo({ top: 0 });
        });
        const labels = document.createElement('span');
        labels.append(element('span', 'session-name', item.title));
        labels.append(element('span', 'session-meta', [item.repository, item.model, formatNumber(item.calls) + ' calls'].filter(Boolean).join(' · ')));
        button.append(labels);
        button.append(element('span', 'session-cost', formatCredits(item.aiCredits) + ' credits'));
        list.append(button);
      }
    }

    function render(data) {
      state.latestData = data;
      const selected = data.selected;
      const totals = selected.totals;
      text('headerCredits', formatCredits(totals.aiCredits));
      text('headerCalls', formatNumber(totals.calls));
      text('sessionTitle', [selected.info.title, selected.info.repository, selected.info.model].filter(Boolean).join(' · '));
      text('chartCredits', formatCredits(totals.aiCredits));
      text('liveStatus', selected.isCurrent ? 'Live' : 'History');
      text('updatedAt', 'Updated ' + new Date(data.generatedAt).toLocaleTimeString());
      backButton.hidden = selected.isCurrent;

      renderCreditChart(selected);
      renderAgentBars(selected);
      renderTokenBars(totals);
      renderDailyTokens(data.dailyTokens);
      renderRangeControl(data);
      renderHistory(data.range);
    }

    let loadController;

    async function load() {
      loadController?.abort();
      const controller = new AbortController();
      loadController = controller;
      state.loading = true;
      app.classList.add('loading');
      errorState.hidden = true;
      try {
        const params = new URLSearchParams({
          range: state.range,
          token: initial.capabilityToken,
        });
        if (state.sessionId) params.set('sessionId', state.sessionId);
        const response = await fetch('/api/stats?' + params.toString(), {
          cache: 'no-store',
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to load session metrics.');
        render(data);
      } catch (error) {
        if (controller.signal.aborted) return;
        errorState.textContent = error instanceof Error ? error.message : 'Unable to load session metrics.';
        errorState.hidden = false;
        markDailyStale(error);
        text('liveStatus', 'Unavailable');
      } finally {
        if (loadController === controller) {
          state.loading = false;
          app.classList.remove('loading');
        }
      }
    }

    backButton.addEventListener('click', () => {
      state.sessionId = state.latestData?.currentSessionId || '';
      load();
    });

    chartToggle.addEventListener('click', () => {
      const expanded = chartToggle.getAttribute('aria-expanded') === 'true';
      chartToggle.setAttribute('aria-expanded', String(!expanded));
      chartContent.hidden = expanded;
    });

    document.getElementById('agentMetricControl').addEventListener('click', (event) => {
      const button = event.target.closest('button[data-metric]');
      if (!button || button.dataset.metric === state.agentMetric) return;
      state.agentMetric = button.dataset.metric;
      for (const candidate of event.currentTarget.querySelectorAll('button')) {
        candidate.setAttribute('aria-pressed', String(candidate === button));
      }
      if (state.latestData) renderAgentBars(state.latestData.selected);
    });

    const dailyCalendarResizeObserver = typeof ResizeObserver === 'function'
      ? new ResizeObserver(() => resizeDailyCalendar())
      : null;
    dailyCalendarResizeObserver?.observe(dailyCalendarTrack);
    dailyCalendarTrack.addEventListener('mouseleave', clearDailyPreview);
    dailyCalendarContent.addEventListener('focusout', (event) => {
      if (!event.relatedTarget || !dailyGrid.contains(event.relatedTarget)) {
        clearDailyPreview();
      }
    });

    const events = new EventSource('/events?token=' + encodeURIComponent(initial.capabilityToken));
    let refreshTimer;
    events.addEventListener('refresh', () => {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(load, 180);
    });
    events.onerror = () => {
      text('liveStatus', 'Reconnecting');
    };

    if (bootstrap) {
      render(bootstrap);
      app.classList.remove('loading');
    } else {
      load();
    }
    setInterval(load, 5000);
  </script>
</body>
</html>`;
}
