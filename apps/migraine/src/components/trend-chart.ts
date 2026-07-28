import type { Episode } from "../db/episodes.js";
import { weekKey } from "../utils/time.js";

const WEEKS = 12;
const BAR_WIDTH = 20;
const BAR_GAP = 10;
const CHART_HEIGHT = 140;
const AXIS_LABEL_HEIGHT = 20;
const Y_AXIS_WIDTH = 24;

function niceCeiling(value: number): number {
  const magnitude = Math.pow(10, Math.floor(Math.log10(Math.max(value, 1))));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

interface WeekBucket {
  key: string;
  label: string;
  count: number;
}

function buildWeekBuckets(episodes: Episode[]): WeekBucket[] {
  const startOfThisWeek = new Date();
  startOfThisWeek.setHours(0, 0, 0, 0);
  const dow = (startOfThisWeek.getDay() + 6) % 7; // 0 = Monday
  startOfThisWeek.setDate(startOfThisWeek.getDate() - dow);

  const buckets: WeekBucket[] = [];
  for (let i = WEEKS - 1; i >= 0; i--) {
    const weekStart = new Date(startOfThisWeek);
    weekStart.setDate(weekStart.getDate() - i * 7);
    const key = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, "0")}-${String(weekStart.getDate()).padStart(2, "0")}`;
    const label = weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    buckets.push({ key, label, count: 0 });
  }

  const byKey = new Map(buckets.map((b) => [b.key, b]));
  for (const e of episodes) {
    const bucket = byKey.get(weekKey(e.startTime));
    if (bucket) bucket.count++;
  }
  return buckets;
}

/** Single-series SVG bar chart: episode count per week, last 12 weeks. */
export class TrendChart {
  el: HTMLElement;
  #tooltip: HTMLElement;

  constructor() {
    this.el = document.createElement("div");
    this.el.className = "trend-chart";

    this.#tooltip = document.createElement("div");
    this.#tooltip.className = "chart-tooltip";
    this.#tooltip.hidden = true;
    document.body.appendChild(this.#tooltip);
  }

  render(episodes: Episode[]): void {
    this.el.innerHTML = "";

    const buckets = buildWeekBuckets(episodes);
    const maxCount = Math.max(1, ...buckets.map((b) => b.count));
    const yMax = niceCeiling(maxCount);

    const width = Y_AXIS_WIDTH + buckets.length * (BAR_WIDTH + BAR_GAP);
    const height = CHART_HEIGHT + AXIS_LABEL_HEIGHT;
    const baselineY = CHART_HEIGHT;

    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("width", String(width));
    svg.setAttribute("height", String(height));
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", `Episodes per week, last ${WEEKS} weeks`);

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
      const x = Y_AXIS_WIDTH + i * (BAR_WIDTH + BAR_GAP);
      const barHeight = Math.max(0, (bucket.count / yMax) * CHART_HEIGHT);
      const y = baselineY - barHeight;

      const rect = document.createElementNS(ns, "rect");
      rect.setAttribute("x", String(x));
      rect.setAttribute("y", String(y));
      rect.setAttribute("width", String(BAR_WIDTH));
      rect.setAttribute("height", String(barHeight));
      rect.setAttribute("rx", "4");
      rect.setAttribute("class", "trend-chart-bar");

      const tooltipText = `Week of ${bucket.label} · ${bucket.count} episode${bucket.count === 1 ? "" : "s"}`;
      rect.addEventListener("mouseenter", (e) => this.#showTooltip(e as MouseEvent, tooltipText));
      rect.addEventListener("mousemove", (e) => this.#showTooltip(e as MouseEvent, tooltipText));
      rect.addEventListener("mouseleave", () => this.#hideTooltip());
      svg.appendChild(rect);

      // Every third label to avoid crowding 12 narrow weekly columns.
      if (i % 3 === 0) {
        const label = document.createElementNS(ns, "text");
        label.setAttribute("x", String(x + BAR_WIDTH / 2));
        label.setAttribute("y", String(baselineY + AXIS_LABEL_HEIGHT - 4));
        label.setAttribute("text-anchor", "middle");
        label.setAttribute("class", "chart-axis-label");
        label.textContent = bucket.label;
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
