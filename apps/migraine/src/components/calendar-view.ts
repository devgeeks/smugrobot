import escapeHtml from "escape-html";
import type { Episode } from "../db/episodes.js";
import { dayKey, dayKeyFromParts, parseDayKey, formatDateTime } from "../utils/time.js";
import { intensityColor, intensityBadgeVariant } from "../utils/intensity.js";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export class CalendarView {
  el: HTMLElement;
  onEdit: ((id: string) => void) | null = null;
  #episodes: Episode[] = [];
  #viewMonth: Date;
  #selectedDay: string | null = null;

  constructor() {
    this.el = document.createElement("div");
    this.el.className = "calendar-view";
    const now = new Date();
    this.#viewMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  render(episodes: Episode[]): void {
    this.#episodes = episodes;
    this.#selectedDay = null;
    this.#renderGrid();
  }

  #episodesByDay(): Map<string, Episode[]> {
    const map = new Map<string, Episode[]>();
    for (const e of this.#episodes) {
      const key = dayKey(e.startTime);
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    return map;
  }

  #renderGrid(): void {
    const byDay = this.#episodesByDay();
    const year = this.#viewMonth.getFullYear();
    const month = this.#viewMonth.getMonth();
    const monthLabel = this.#viewMonth.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
    const todayKey = dayKey(new Date().toISOString());

    const firstOfMonth = new Date(year, month, 1);
    const startOffset = (firstOfMonth.getDay() + 6) % 7; // 0 = Monday
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: string[] = [];
    for (let i = 0; i < startOffset; i++) {
      cells.push(`<div class="calendar-cell calendar-cell-empty"></div>`);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const key = dayKeyFromParts(year, month, day);
      const dayEpisodes = byDay.get(key) ?? [];
      const maxIntensity = dayEpisodes.reduce((max, e) => Math.max(max, e.intensity), 0);
      const isToday = key === todayKey;
      const countLabel =
        dayEpisodes.length > 0
          ? `, ${dayEpisodes.length} episode${dayEpisodes.length > 1 ? "s" : ""}`
          : "";
      cells.push(`
        <button
          type="button"
          class="calendar-cell${dayEpisodes.length ? " has-episode" : ""}${isToday ? " is-today" : ""}"
          data-day="${key}"
          ${dayEpisodes.length ? "" : "disabled"}
          aria-label="${day} ${escapeHtml(monthLabel)}${countLabel}"
        >
          <span class="calendar-cell-num">${day}</span>
          ${dayEpisodes.length ? `<span class="calendar-cell-dot" style="background: ${intensityColor(maxIntensity)}"></span>` : ""}
        </button>
      `);
    }

    const selectedEpisodes = this.#selectedDay ? (byDay.get(this.#selectedDay) ?? []) : [];

    this.el.innerHTML = `
      <div class="calendar-header">
        <h1 class="pane-title">Calendar</h1>
        <div class="pane-nav">
          <vault-button variant="ghost" size="sm" id="cal-prev" aria-label="Previous month">←</vault-button>
          <span class="pane-nav-label">${escapeHtml(monthLabel)}</span>
          <vault-button variant="ghost" size="sm" id="cal-next" aria-label="Next month">→</vault-button>
        </div>
      </div>
      <div class="calendar-weekdays">
        ${WEEKDAY_LABELS.map((d) => `<span>${d}</span>`).join("")}
      </div>
      <div class="calendar-grid">${cells.join("")}</div>
      ${
        this.#selectedDay
          ? `<div class="calendar-day-detail">
              <h2 class="calendar-day-detail-title">${escapeHtml(
                parseDayKey(this.#selectedDay).toLocaleDateString(undefined, {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                }),
              )}</h2>
              <ul class="calendar-day-detail-list">
                ${selectedEpisodes
                  .map(
                    (e) => `
                  <li>
                    <button type="button" class="calendar-day-detail-item" data-id="${e.id}">
                      <vault-badge variant="${intensityBadgeVariant(e.intensity)}">${e.intensity}/10</vault-badge>
                      <span>${escapeHtml(formatDateTime(e.startTime))}</span>
                    </button>
                  </li>
                `,
                  )
                  .join("")}
              </ul>
            </div>`
          : ""
      }
    `;

    this.el.querySelector("#cal-prev")?.addEventListener("click", () => {
      this.#viewMonth = new Date(year, month - 1, 1);
      this.#selectedDay = null;
      this.#renderGrid();
    });
    this.el.querySelector("#cal-next")?.addEventListener("click", () => {
      this.#viewMonth = new Date(year, month + 1, 1);
      this.#selectedDay = null;
      this.#renderGrid();
    });

    for (const cell of this.el.querySelectorAll<HTMLButtonElement>(".calendar-cell.has-episode")) {
      cell.addEventListener("click", () => {
        const key = cell.dataset["day"]!;
        this.#selectedDay = this.#selectedDay === key ? null : key;
        this.#renderGrid();
      });
    }

    for (const item of this.el.querySelectorAll<HTMLElement>(".calendar-day-detail-item")) {
      item.addEventListener("click", () => this.onEdit?.(item.dataset["id"]!));
    }
  }
}
