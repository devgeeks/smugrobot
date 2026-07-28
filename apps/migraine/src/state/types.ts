import type { DocStore, StorageAdapter } from "echidna.js";
import type { Episode } from "../db/episodes.js";

export type Screen = "loading" | "unlock" | "app";
export type Tab = "history" | "calendar" | "stats";

export interface AppState {
  screen: Screen;
  vaultExists: boolean;
  adapter: StorageAdapter | null;
  store: DocStore | null;
  episodes: Episode[];
  activeTab: Tab;
  /** True while the full-screen log/edit form is showing, over whichever tab is active. */
  isLogging: boolean;
  /** Episode being edited, or null for a fresh entry. Only meaningful while isLogging. */
  editingEpisodeId: string | null;
}

export type Action =
  | { type: "VAULT_DETECTED"; exists: boolean; adapter: StorageAdapter }
  | { type: "UNLOCKED"; store: DocStore }
  | { type: "EPISODES_LOADED"; episodes: Episode[] }
  | { type: "TAB_CHANGED"; tab: Tab }
  | { type: "START_LOGGING"; episodeId: string | null }
  | { type: "STOP_LOGGING" }
  | { type: "LOCKED" };
