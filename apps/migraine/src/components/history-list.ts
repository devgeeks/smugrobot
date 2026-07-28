import escapeHtml from "escape-html";
import type { Episode } from "../db/episodes.js";
import { formatDateTime, formatDuration } from "../utils/time.js";
import { symptomLabel } from "../constants/symptoms.js";

export class HistoryList {
  el: HTMLElement;
  onEdit: ((id: string) => void) | null = null;
  onDelete: ((id: string) => void) | null = null;

  constructor() {
    this.el = document.createElement("div");
    this.el.className = "history-list";
  }

  render(episodes: Episode[]): void {
    if (episodes.length === 0) {
      this.el.innerHTML = `
        <h1 class="pane-title">History</h1>
        <p class="empty-state">No episodes logged yet. Tap + to add one.</p>
      `;
      return;
    }

    this.el.innerHTML = `
      <h1 class="pane-title">History</h1>
      <ul class="history-rows">
        ${episodes.map((e) => this.#renderRow(e)).join("")}
      </ul>
    `;

    for (const row of this.el.querySelectorAll<HTMLElement>(".history-row")) {
      const id = row.dataset["id"]!;
      row.querySelector(".history-row-edit")?.addEventListener("click", () => this.onEdit?.(id));
      row
        .querySelector(".history-row-delete")
        ?.addEventListener("click", () => this.onDelete?.(id));
    }
  }

  #renderRow(e: Episode): string {
    const duration = formatDuration(e.startTime, e.endTime);
    const topSymptom = e.symptoms[0];
    const badgeVariant = e.intensity >= 8 ? "danger" : e.intensity >= 5 ? "warn" : "default";
    const dateLabel = formatDateTime(e.startTime);
    return `
      <li class="history-row" data-id="${e.id}">
        <button type="button" class="history-row-edit">
          <span class="history-row-date">${escapeHtml(dateLabel)}</span>
          <span class="history-row-meta">
            <vault-badge variant="${badgeVariant}">${e.intensity}/10</vault-badge>
            <span class="history-row-duration">${duration ?? "Ongoing"}</span>
            ${
              topSymptom
                ? `<span class="history-row-symptom">${escapeHtml(symptomLabel(topSymptom))}${e.symptoms.length > 1 ? ` +${e.symptoms.length - 1}` : ""}</span>`
                : ""
            }
          </span>
        </button>
        <button
          type="button"
          class="history-row-delete"
          aria-label="Delete episode from ${escapeHtml(dateLabel)}"
        >×</button>
      </li>
    `;
  }
}
