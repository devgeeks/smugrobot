import type { DocMeta, DocStore, StorageAdapter } from "echidna.js";

export type Screen = "loading" | "unlock" | "app";

export interface FolderMeta extends DocMeta {
  type: "folder";
  parentId: string | null;
}

export interface NoteMeta extends DocMeta {
  type: "note";
  folderId: string | null;
}

export interface AppState {
  screen: Screen;
  vaultExists: boolean;
  adapter: StorageAdapter | null;
  store: DocStore | null;
  unlockError: string | null;
  folders: FolderMeta[];
  selectedFolderId: string | null;
  notes: NoteMeta[];
  selectedNoteId: string | null;
  isSaving: boolean;
  noteCounts: Record<string, number>;
}

export type Action =
  | { type: "VAULT_DETECTED"; exists: boolean; adapter: StorageAdapter }
  | { type: "UNLOCK_ERROR"; message: string }
  | { type: "UNLOCKED"; store: DocStore }
  | { type: "FOLDERS_LOADED"; folders: FolderMeta[] }
  | { type: "FOLDER_SELECTED"; folderId: string | null }
  | { type: "NOTES_LOADED"; notes: NoteMeta[]; noteCounts: Record<string, number> }
  | { type: "NOTE_SELECTED"; noteId: string }
  | { type: "NOTE_SAVE_START" }
  | { type: "NOTE_SAVE_DONE"; meta: NoteMeta }
  | { type: "NOTE_SAVE_FAILED" }
  | { type: "NOTE_DELETED"; noteId: string }
  | { type: "FOLDER_CREATED"; folder: FolderMeta }
  | { type: "FOLDER_RENAMED"; folder: FolderMeta }
  | { type: "FOLDER_DELETED"; folderId: string }
  | { type: "LOCKED" };
