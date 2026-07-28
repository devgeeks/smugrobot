import escapeHtml from "escape-html";
import type { Episode } from "../db/episodes.js";
import { symptomLabel } from "../constants/symptoms.js";
import { TrendChart } from "./trend-chart.js";

export class StatsPanel {
  el: HTMLElement;
  #trendChart = new TrendChart();

  constructor() {
    this.el = document.createElement("div");
    this.el.className = "stats-panel";
  }

  render(episodes: Episode[]): void {
    this.el.innerHTML = `<h1 class="pane-title">Stats</h1>`;

    if (episodes.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "Log a migraine to see your stats.";
      this.el.appendChild(empty);
      return;
    }

    const now = new Date();
    const thisMonth = episodes.filter((e) => {
      const d = new Date(e.startTime);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });

    const avgIntensity =
      thisMonth.length > 0
        ? (thisMonth.reduce((sum, e) => sum + e.intensity, 0) / thisMonth.length).toFixed(1)
        : "—";

    const symptomCounts = new Map<string, number>();
    for (const e of episodes) {
      for (const s of e.symptoms) symptomCounts.set(s, (symptomCounts.get(s) ?? 0) + 1);
    }
    let topSymptom: string | null = null;
    let topCount = 0;
    for (const [symptom, count] of symptomCounts) {
      if (count > topCount) {
        topSymptom = symptom;
        topCount = count;
      }
    }

    const statsRow = document.createElement("div");
    statsRow.className = "stats-row";
    statsRow.innerHTML = `
      <div class="stat-tile">
        <span class="stat-tile-value">${thisMonth.length}</span>
        <span class="stat-tile-label">This month</span>
      </div>
      <div class="stat-tile">
        <span class="stat-tile-value">${avgIntensity}</span>
        <span class="stat-tile-label">Avg intensity</span>
      </div>
      <div class="stat-tile">
        <span class="stat-tile-value">${topSymptom ? escapeHtml(symptomLabel(topSymptom)) : "—"}</span>
        <span class="stat-tile-label">Most common</span>
      </div>
    `;
    this.el.appendChild(statsRow);

    const chartSection = document.createElement("div");
    chartSection.className = "stats-chart-section";
    const chartTitle = document.createElement("h2");
    chartTitle.className = "stats-chart-title";
    chartTitle.textContent = "Episodes per week";
    chartSection.appendChild(chartTitle);
    chartSection.appendChild(this.#trendChart.el);
    this.el.appendChild(chartSection);

    this.#trendChart.render(episodes);
  }
}
