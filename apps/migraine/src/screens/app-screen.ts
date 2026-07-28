import { dispatch, getState, subscribe } from "../state/store.js";
import { listEpisodes, deleteEpisode } from "../db/episodes.js";
import { confirmDialog } from "../utils/dialog.js";
import { showToast } from "../utils/toast.js";
import { dayKey } from "../utils/time.js";
import { TabBar } from "../components/tab-bar.js";
import { FabButton } from "../components/fab-button.js";
import { LogForm } from "../components/log-form.js";
import { HistoryList } from "../components/history-list.js";
import { CalendarView } from "../components/calendar-view.js";
import { StatsPanel } from "../components/stats-panel.js";
import type { Tab } from "../state/types.js";

let unsub: (() => void) | null = null;

function exportData(): void {
  const episodes = getState().episodes;
  const payload = {
    exportedAt: new Date().toISOString(),
    episodeCount: episodes.length,
    episodes,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `migraine-log-${dayKey(new Date().toISOString())}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function mountAppScreen(root: HTMLElement): Promise<void> {
  unsub?.();
  root.innerHTML = "";

  const header = document.createElement("div");
  header.className = "app-header";
  header.innerHTML = `
    <span class="app-header-logo">Migraines</span>
    <div class="app-header-actions">
      <vault-button variant="secondary" size="md" class="app-header-export-btn">Export</vault-button>
      <vault-button variant="secondary" size="md" class="app-header-lock-btn">Lock</vault-button>
    </div>
  `;
  root.appendChild(header);

  const main = document.createElement("div");
  main.className = "app-main";
  root.appendChild(main);

  const tabBar = new TabBar();
  const fab = new FabButton();
  const logForm = new LogForm();
  const historyList = new HistoryList();
  const calendarView = new CalendarView();
  const statsPanel = new StatsPanel();

  const exportBtn = header.querySelector(".app-header-export-btn")!;
  exportBtn.addEventListener("click", async () => {
    if (getState().episodes.length === 0) {
      showToast("No data to export yet.", "info");
      return;
    }
    const ok = await confirmDialog({
      title: "Export your data?",
      body: "This creates a plaintext file with all your migraine data, decrypted. Store it somewhere safe.",
      confirmLabel: "Export",
    });
    if (!ok) return;
    exportData();
    showToast("Data exported.", "success");
  });

  const lockBtn = header.querySelector(".app-header-lock-btn")!;
  lockBtn.addEventListener("click", async () => {
    const ok = await confirmDialog({
      title: "Lock vault?",
      body: "You'll need your passphrase to unlock it again.",
      confirmLabel: "Lock",
    });
    if (!ok) return;
    dispatch({ type: "LOCKED" });
  });

  tabBar.onTabSelect = (tab: Tab) => dispatch({ type: "TAB_CHANGED", tab });
  fab.onClick = () => dispatch({ type: "START_LOGGING", episodeId: null });

  async function reloadEpisodes(): Promise<void> {
    const store = getState().store;
    if (!store) return;
    const episodes = await listEpisodes(store);
    dispatch({ type: "EPISODES_LOADED", episodes });
  }

  logForm.onSaved = async () => {
    await reloadEpisodes();
    dispatch({ type: "STOP_LOGGING" });
    showToast("Episode saved.", "success");
  };
  logForm.onCancel = () => dispatch({ type: "STOP_LOGGING" });

  const editEpisode = (id: string) => dispatch({ type: "START_LOGGING", episodeId: id });
  const deleteEpisodeWithConfirm = async (id: string) => {
    const ok = await confirmDialog({
      title: "Delete this episode?",
      body: "This can't be undone.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    const store = getState().store;
    if (!store) return;
    await deleteEpisode(store, id);
    await reloadEpisodes();
    showToast("Episode deleted.", "success");
  };

  historyList.onEdit = editEpisode;
  historyList.onDelete = deleteEpisodeWithConfirm;
  calendarView.onEdit = editEpisode;

  function renderScreen(): void {
    const state = getState();
    main.innerHTML = "";
    main.classList.toggle("is-logging", state.isLogging);

    if (state.isLogging) {
      // Full-screen takeover: no tab bar, no FAB — just the header (still
      // mounted above) and the form, with its own sticky Save/Cancel bar.
      tabBar.el.remove();
      fab.el.remove();
      const editing = state.episodes.find((e) => e.id === state.editingEpisodeId) ?? null;
      logForm.render(editing);
      main.appendChild(logForm.el);
      return;
    }

    root.appendChild(tabBar.el);
    root.appendChild(fab.el);
    tabBar.render(state.activeTab);

    if (state.activeTab === "history") {
      historyList.render(state.episodes);
      main.appendChild(historyList.el);
    } else if (state.activeTab === "calendar") {
      calendarView.render(state.episodes);
      main.appendChild(calendarView.el);
    } else if (state.activeTab === "stats") {
      statsPanel.render(state.episodes);
      main.appendChild(statsPanel.el);
    }
  }

  await reloadEpisodes();
  renderScreen();

  unsub = subscribe(renderScreen);
}

export function unmountAppScreen(): void {
  unsub?.();
  unsub = null;
}
