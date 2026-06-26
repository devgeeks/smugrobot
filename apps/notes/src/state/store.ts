import type { AppState, Action } from './types.js'

const initial: AppState = {
  screen: 'loading',
  vaultExists: false,
  adapter: null,
  store: null,
  unlockError: null,
  folders: [],
  selectedFolderId: null,
  notes: [],
  selectedNoteId: null,
  isSaving: false,
  noteCounts: {},
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'VAULT_DETECTED':
      return {
        ...state,
        screen: 'unlock',
        vaultExists: action.exists,
        adapter: action.adapter,
      }
    case 'UNLOCK_ERROR':
      return { ...state, unlockError: action.message }
    case 'UNLOCKED':
      return {
        ...state,
        screen: 'app',
        store: action.store,
        unlockError: null,
      }
    case 'FOLDERS_LOADED':
      return { ...state, folders: action.folders }
    case 'FOLDER_SELECTED':
      return {
        ...state,
        selectedFolderId: action.folderId,
        selectedNoteId: null,
        notes: action.folderId !== state.selectedFolderId ? [] : state.notes,
      }
    case 'NOTES_LOADED':
      return { ...state, notes: action.notes, noteCounts: action.noteCounts }
    case 'NOTE_SELECTED':
      return { ...state, selectedNoteId: action.noteId }
    case 'NOTE_SAVE_START':
      return { ...state, isSaving: true }
    case 'NOTE_SAVE_DONE':
      return {
        ...state,
        isSaving: false,
        notes: state.notes.map((n) =>
          n.id === action.meta.id ? action.meta : n
        ),
      }
    case 'NOTE_DELETED':
      return {
        ...state,
        notes: state.notes.filter((n) => n.id !== action.noteId),
        selectedNoteId:
          state.selectedNoteId === action.noteId ? null : state.selectedNoteId,
      }
    case 'FOLDER_CREATED':
      return { ...state, folders: [...state.folders, action.folder] }
    case 'LOCKED':
      return { ...initial, screen: 'unlock', vaultExists: true, adapter: state.adapter }
    default:
      return state
  }
}

type Listener = () => void

let state = initial
const listeners = new Set<Listener>()

export function getState(): AppState {
  return state
}

export function dispatch(action: Action): void {
  state = reducer(state, action)
  for (const fn of listeners) fn()
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
