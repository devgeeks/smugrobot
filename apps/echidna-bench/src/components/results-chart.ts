import type { BenchResult } from "../state/types.js";

const DATA_TYPE_LABELS: Record<string, string> = {
  json: "JSON blob",
  text: "Text document",
  image: "Image (binary)",
};

// Validated via the dataviz palette validator (categorical, 2 slots) against both
// the dark (#121413) and light (#F2F5F3) vault-ui surfaces — passes lightness band,
// chroma floor, CVD separation (deutan ΔE 54.7), and contrast in both modes.
const ENCRYPT_COLOR = "#1E9966";
const DECRYPT_COLOR = "#3D7DB8";

const BAR_WIDTH = 18;
const BAR_GAP = 2;
const GROUP_GAP = 20;
const CHART_HEIGHT = 220;
const AXIS_LABEL_HEIGHT = 20;
const Y_AXIS_WIDTH = 48;
const FACET_TITLE_HEIGHT = 24;

export class ResultsChart {
  el: HTMLElement;
  private tooltip: HTMLElement;

  constructor() {
    this.el = document.createElement("div");
    this.el.className = "results-chart";

    this.tooltip = document.createElement("div");
    this.tooltip.className = "chart-tooltip";
    this.tooltip.hidden = true;
    document.body.appendChild(this.tooltip);
  }

  render(results: BenchResult[]): void {
    this.el.innerHTML = "";
    if (results.length === 0) {
      this.el.hidden = true;
      return;
    }
    this.el.hidden = false;

    const byDataType = new Map<string, BenchResult[]>();
    for (const r of results) {
      const list = byDataType.get(r.dataType) ?? [];
      list.push(r);
      byDataType.set(r.dataType, list);
    }

    const maxThroughput = Math.max(
      1,
      ...results.flatMap((r) =>
        [r.encrypt.throughputMBs, r.decrypt.throughputMBs].filter(Number.isFinite),
      ),
    );
    const yMax = niceCeiling(maxThroughput);

    const legend = document.createElement("div");
    legend.className = "chart-legend";
    legend.innerHTML = `
      <span class="chart-legend-item"><span class="chart-swatch" style="background:${ENCRYPT_COLOR}"></span>Encrypt</span>
      <span class="chart-legend-item"><span class="chart-swatch" style="background:${DECRYPT_COLOR}"></span>Decrypt</span>
    `;
    this.el.appendChild(legend);

    const facets = document.createElement("div");
    facets.className = "chart-facets";
    for (const [dataType, group] of byDataType) {
      facets.appendChild(this.renderFacet(DATA_TYPE_LABELS[dataType] ?? dataType, group, yMax));
    }
    this.el.appendChild(facets);
  }

  private renderFacet(title: string, group: BenchResult[], yMax: number): HTMLElement {
    const groupWidth = BAR_WIDTH * 2 + BAR_GAP;
    const width = Y_AXIS_WIDTH + group.length * (groupWidth + GROUP_GAP);
    const height = FACET_TITLE_HEIGHT + CHART_HEIGHT + AXIS_LABEL_HEIGHT;
    const plotHeight = CHART_HEIGHT;

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("width", String(width));
    svg.setAttribute("height", String(height));
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", `${title} throughput by payload size`);

    const ns = "http://www.w3.org/2000/svg";

    const titleEl = document.createElementNS(ns, "text");
    titleEl.setAttribute("x", "0");
    titleEl.setAttribute("y", "14");
    titleEl.setAttribute("class", "chart-facet-title");
    titleEl.textContent = title;
    svg.appendChild(titleEl);

    const plotTop = FACET_TITLE_HEIGHT;
    const baselineY = plotTop + plotHeight;

    // Gridlines + y-axis ticks (0 and yMax, clean numbers).
    const ticks = [0, yMax / 2, yMax];
    for (const tick of ticks) {
      const y = baselineY - (tick / yMax) * plotHeight;
      const line = document.createElementNS(ns, "line");
      line.setAttribute("x1", String(Y_AXIS_WIDTH));
      line.setAttribute("x2", String(width));
      line.setAttribute("y1", String(y));
      line.setAttribute("y2", String(y));
      line.setAttribute("class", "chart-gridline");
      svg.appendChild(line);

      const label = document.createElementNS(ns, "text");
      label.setAttribute("x", String(Y_AXIS_WIDTH - 8));
      label.setAttribute("y", String(y + 4));
      label.setAttribute("text-anchor", "end");
      label.setAttribute("class", "chart-axis-label");
      label.textContent = `${Math.round(tick)}`;
      svg.appendChild(label);
    }

    group.forEach((result, i) => {
      const groupX = Y_AXIS_WIDTH + i * (groupWidth + GROUP_GAP);
      this.appendBar(svg, {
        x: groupX,
        baselineY,
        plotHeight,
        yMax,
        value: result.encrypt.throughputMBs,
        color: ENCRYPT_COLOR,
        tooltip: `${title} · ${result.sizeLabel} · Encrypt: ${formatValue(result.encrypt.throughputMBs)} MB/s`,
      });
      this.appendBar(svg, {
        x: groupX + BAR_WIDTH + BAR_GAP,
        baselineY,
        plotHeight,
        yMax,
        value: result.decrypt.throughputMBs,
        color: DECRYPT_COLOR,
        tooltip: `${title} · ${result.sizeLabel} · Decrypt: ${formatValue(result.decrypt.throughputMBs)} MB/s`,
      });

      const sizeLabel = document.createElementNS(ns, "text");
      sizeLabel.setAttribute("x", String(groupX + groupWidth / 2));
      sizeLabel.setAttribute("y", String(baselineY + AXIS_LABEL_HEIGHT - 4));
      sizeLabel.setAttribute("text-anchor", "middle");
      sizeLabel.setAttribute("class", "chart-axis-label");
      sizeLabel.textContent = result.sizeLabel;
      svg.appendChild(sizeLabel);
    });

    const wrap = document.createElement("div");
    wrap.className = "chart-facet";
    wrap.appendChild(svg);
    return wrap;
  }

  private appendBar(
    svg: SVGSVGElement,
    opts: {
      x: number;
      baselineY: number;
      plotHeight: number;
      yMax: number;
      value: number;
      color: string;
      tooltip: string;
    },
  ): void {
    const ns = "http://www.w3.org/2000/svg";
    const value = Number.isFinite(opts.value) ? opts.value : 0;
    const barHeight = Math.max(0, (value / opts.yMax) * opts.plotHeight);
    const y = opts.baselineY - barHeight;

    const rect = document.createElementNS(ns, "rect");
    rect.setAttribute("x", String(opts.x));
    rect.setAttribute("y", String(y));
    rect.setAttribute("width", String(BAR_WIDTH));
    rect.setAttribute("height", String(barHeight));
    rect.setAttribute("rx", "4");
    rect.setAttribute("fill", opts.color);
    rect.setAttribute("class", "chart-bar");

    rect.addEventListener("mouseenter", (e) => this.showTooltip(e as MouseEvent, opts.tooltip));
    rect.addEventListener("mousemove", (e) => this.showTooltip(e as MouseEvent, opts.tooltip));
    rect.addEventListener("mouseleave", () => this.hideTooltip());

    svg.appendChild(rect);
  }

  private showTooltip(e: MouseEvent, text: string): void {
    this.tooltip.textContent = text;
    this.tooltip.hidden = false;
    this.tooltip.style.left = `${e.clientX + 12}px`;
    this.tooltip.style.top = `${e.clientY + 12}px`;
  }

  private hideTooltip(): void {
    this.tooltip.hidden = true;
  }
}

function niceCeiling(value: number): number {
  const magnitude = Math.pow(10, Math.floor(Math.log10(Math.max(value, 1))));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

function formatValue(value: number): string {
  return Number.isFinite(value) ? value.toFixed(1) : "—";
}
