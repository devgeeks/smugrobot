import type { DocStore, StorageAdapter } from "echidna.js";
import type { Episode } from "../db/episodes.js";

export type Screen = "loading" | "unlock" | "app";
export type Tab = "log" | "history" | "calendar" | "stats";

export interface AppState {
  screen: Screen;
  vaultExists: boolean;
  adapter: StorageAdapter | null;
  store: DocStore | null;
  episodes: Episode[];
  activeTab: Tab;
  /** Episode being edited in the Log tab, or null for a fresh entry. */
  editingEpisodeId: string | null;
}

export type Action =
  | { type: "VAULT_DETECTED"; exists: boolean; adapter: StorageAdapter }
  | { type: "UNLOCKED"; store: DocStore }
  | { type: "EPISODES_LOADED"; episodes: Episode[] }
  | { type: "TAB_CHANGED"; tab: Tab }
  | { type: "EDIT_EPISODE"; episodeId: string | null }
  | { type: "LOCKED" };
