import type { Tab } from "../state/types.js";

const TABS: { id: Tab; label: string }[] = [
  { id: "log", label: "Log" },
  { id: "history", label: "History" },
  { id: "calendar", label: "Calendar" },
  { id: "stats", label: "Stats" },
];

export class TabBar {
  el: HTMLElement;
  onTabSelect: ((tab: Tab) => void) | null = null;

  constructor() {
    this.el = document.createElement("nav");
    this.el.className = "tab-bar";
    this.el.setAttribute("aria-label", "Sections");
    this.el.innerHTML = TABS.map(
      (t) => `<button type="button" class="tab-bar-btn" data-tab="${t.id}">${t.label}</button>`,
    ).join("");

    for (const btn of this.el.querySelectorAll<HTMLButtonElement>(".tab-bar-btn")) {
      btn.addEventListener("click", () => {
        const tab = btn.dataset["tab"] as Tab;
        this.onTabSelect?.(tab);
      });
    }
  }

  render(activeTab: Tab): void {
    for (const btn of this.el.querySelectorAll<HTMLButtonElement>(".tab-bar-btn")) {
      const isActive = btn.dataset["tab"] === activeTab;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-current", isActive ? "page" : "false");
    }
  }
}
