import type { AppState, Action } from "./types.js";

const initial: AppState = {
  screen: "loading",
  vaultExists: false,
  adapter: null,
  store: null,
  episodes: [],
  activeTab: "history",
  isLogging: false,
  editingEpisodeId: null,
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "VAULT_DETECTED":
      return {
        ...state,
        screen: "unlock",
        vaultExists: action.exists,
        adapter: action.adapter,
      };
    case "UNLOCKED":
      return { ...state, screen: "app", store: action.store };
    case "EPISODES_LOADED":
      return { ...state, episodes: action.episodes };
    case "TAB_CHANGED":
      return { ...state, activeTab: action.tab };
    case "START_LOGGING":
      return { ...state, isLogging: true, editingEpisodeId: action.episodeId };
    case "STOP_LOGGING":
      return { ...state, isLogging: false, editingEpisodeId: null };
    case "LOCKED":
      return { ...initial, screen: "unlock", vaultExists: true, adapter: state.adapter };
    default:
      return state;
  }
}

type Listener = () => void;

let state = initial;
const listeners = new Set<Listener>();

export function getState(): AppState {
  return state;
}

export function dispatch(action: Action): void {
  state = reducer(state, action);
  for (const fn of listeners) fn();
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
