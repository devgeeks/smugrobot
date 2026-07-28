import type { Episode } from "../db/episodes.js";
import { dayKeyFromParts, dayKey } from "../utils/time.js";
import { intensityColor } from "../utils/intensity.js";

const BAR_GAP = 4;
const CHART_HEIGHT = 160;
const AXIS_LABEL_HEIGHT = 20;
const Y_AXIS_WIDTH = 24;
const LABEL_EVERY = 5; // avoid crowding up to 31 narrow daily columns

function niceCeiling(value: number): number {
  const magnitude = Math.pow(10, Math.floor(Math.log10(Math.max(value, 1))));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

interface DayBucket {
  day: number;
  count: number;
  maxIntensity: number;
}

/** Bar chart: episodes per day for one navigable month, bar color keyed to that day's peak intensity. */
export class TrendChart {
  el: HTMLElement;
  #tooltip: HTMLElement;
  #episodes: Episode[] = [];
  #viewMonth: Date;

  constructor() {
    this.el = document.createElement("div");
    this.el.className = "trend-chart";
    const now = new Date();
    this.#viewMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    this.#tooltip = document.createElement("div");
    this.#tooltip.className = "chart-tooltip";
    this.#tooltip.hidden = true;
    document.body.appendChild(this.#tooltip);
  }

  render(episodes: Episode[]): void {
    this.#episodes = episodes;
    this.#renderChart();
  }

  #shiftMonth(deltaMonths: number): void {
    this.#viewMonth = new Date(
      this.#viewMonth.getFullYear(),
      this.#viewMonth.getMonth() + deltaMonths,
      1,
    );
    this.#renderChart();
  }

  #buildDayBuckets(): DayBucket[] {
    const year = this.#viewMonth.getFullYear();
    const month = this.#viewMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const byDay = new Map<string, Episode[]>();
    for (const e of this.#episodes) {
      const key = dayKey(e.startTime);
      const list = byDay.get(key) ?? [];
      list.push(e);
      byDay.set(key, list);
    }

    const buckets: DayBucket[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const key = dayKeyFromParts(year, month, day);
      const dayEpisodes = byDay.get(key) ?? [];
      const maxIntensity = dayEpisodes.reduce((max, e) => Math.max(max, e.intensity), 0);
      buckets.push({ day, count: dayEpisodes.length, maxIntensity });
    }
    return buckets;
  }

  #renderChart(): void {
    this.el.innerHTML = "";

    const monthLabel = this.#viewMonth.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });

    const nav = document.createElement("div");
    nav.className = "stats-chart-header";
    nav.innerHTML = `
      <h2 class="stats-chart-title">Daily episodes</h2>
      <div class="pane-nav">
        <vault-button variant="ghost" size="sm" id="trend-prev" aria-label="Previous month">←</vault-button>
        <span class="pane-nav-label">${monthLabel}</span>
        <vault-button variant="ghost" size="sm" id="trend-next" aria-label="Next month">→</vault-button>
      </div>
    `;
    nav.querySelector("#trend-prev")!.addEventListener("click", () => this.#shiftMonth(-1));
    nav.querySelector("#trend-next")!.addEventListener("click", () => this.#shiftMonth(1));
    this.el.appendChild(nav);

    const legend = document.createElement("div");
    legend.className = "trend-chart-legend";
    legend.innerHTML = `
      <span class="trend-chart-legend-item"><span class="trend-chart-legend-dot" style="background: ${intensityColor(1)}"></span>Mild (1–4)</span>
      <span class="trend-chart-legend-item"><span class="trend-chart-legend-dot" style="background: ${intensityColor(5)}"></span>Moderate (5–7)</span>
      <span class="trend-chart-legend-item"><span class="trend-chart-legend-dot" style="background: ${intensityColor(8)}"></span>Severe (8–10)</span>
    `;
    this.el.appendChild(legend);

    const buckets = this.#buildDayBuckets();

    const maxCount = Math.max(1, ...buckets.map((b) => b.count));
    const yMax = niceCeiling(maxCount);

    // Fixed logical column width (not viewport pixels — the svg scales via
    // CSS) sized so ~31 columns still read as bars rather than hairlines.
    const columnWidth = 13;
    const width = Y_AXIS_WIDTH + buckets.length * columnWidth;
    const height = CHART_HEIGHT + AXIS_LABEL_HEIGHT;
    const baselineY = CHART_HEIGHT;
    const barWidthPx = columnWidth - BAR_GAP;

    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("class", "trend-chart-svg");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", `Episodes per day, ${monthLabel}`);

    const ticks = [0, yMax / 2, yMax];
    for (const tick of ticks) {
      const y = baselineY - (tick / yMax) * CHART_HEIGHT;

      const line = document.createElementNS(ns, "line");
      line.setAttribute("x1", String(Y_AXIS_WIDTH));
      line.setAttribute("x2", String(width));
      line.setAttribute("y1", String(y));
      line.setAttribute("y2", String(y));
      line.setAttribute("class", "chart-gridline");
      svg.appendChild(line);

      const label = document.createElementNS(ns, "text");
      label.setAttribute("x", String(Y_AXIS_WIDTH - 6));
      label.setAttribute("y", String(y + 4));
      label.setAttribute("text-anchor", "end");
      label.setAttribute("class", "chart-axis-label");
      label.textContent = `${Math.round(tick)}`;
      svg.appendChild(label);
    }

    buckets.forEach((bucket, i) => {
      const x = Y_AXIS_WIDTH + i * columnWidth;
      const barHeight = Math.max(0, (bucket.count / yMax) * CHART_HEIGHT);
      const y = baselineY - barHeight;

      if (bucket.count > 0) {
        const rect = document.createElementNS(ns, "rect");
        rect.setAttribute("x", String(x));
        rect.setAttribute("y", String(y));
        rect.setAttribute("width", String(barWidthPx));
        rect.setAttribute("height", String(barHeight));
        rect.setAttribute("rx", "2");
        rect.setAttribute("fill", intensityColor(bucket.maxIntensity));

        const tooltipText = `${monthLabel.split(" ")[0]} ${bucket.day} · ${bucket.count} episode${bucket.count === 1 ? "" : "s"}, up to ${bucket.maxIntensity}/10`;
        rect.addEventListener("mouseenter", (e) => this.#showTooltip(e as MouseEvent, tooltipText));
        rect.addEventListener("mousemove", (e) => this.#showTooltip(e as MouseEvent, tooltipText));
        rect.addEventListener("mouseleave", () => this.#hideTooltip());
        svg.appendChild(rect);
      }

      if (i % LABEL_EVERY === 0) {
        const label = document.createElementNS(ns, "text");
        label.setAttribute("x", String(x + barWidthPx / 2));
        label.setAttribute("y", String(baselineY + AXIS_LABEL_HEIGHT - 4));
        label.setAttribute("text-anchor", "middle");
        label.setAttribute("class", "chart-axis-label");
        label.textContent = String(bucket.day);
        svg.appendChild(label);
      }
    });

    this.el.appendChild(svg);
  }

  #showTooltip(e: MouseEvent, text: string): void {
    this.#tooltip.textContent = text;
    this.#tooltip.hidden = false;
    this.#tooltip.style.left = `${e.clientX + 12}px`;
    this.#tooltip.style.top = `${e.clientY + 12}px`;
  }

  #hideTooltip(): void {
    this.#tooltip.hidden = true;
  }
}
