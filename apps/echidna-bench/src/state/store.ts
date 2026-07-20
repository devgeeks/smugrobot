import type { AppState, Action } from "./types.js";

const initial: AppState = {
  config: {
    dataTypes: ["json", "text", "image"],
    sizes: [1_024, 100_000, 1_000_000, 10_000_000],
    adapter: "indexeddb",
    keySource: "passphrase",
    iterations: 5,
  },
  running: false,
  results: [],
  kdfTiming: null,
  error: null,
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "RUN_STARTED":
      return { ...state, running: true, results: [], kdfTiming: null, error: null };
    case "RESULT_ADDED":
      return { ...state, results: [...state.results, action.result] };
    case "KDF_TIMING":
      return { ...state, kdfTiming: action.result };
    case "RUN_COMPLETE":
      return { ...state, running: false };
    case "RUN_FAILED":
      return { ...state, running: false, error: action.message };
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
