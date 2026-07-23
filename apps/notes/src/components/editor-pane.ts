import {
  Editor,
  rootCtx,
  editorViewOptionsCtx,
  defaultValueCtx,
  editorViewCtx,
} from "@milkdown/core";
import { commonmark } from "@milkdown/preset-commonmark";
import { gfm } from "@milkdown/preset-gfm";
import { listener, listenerCtx } from "@milkdown/plugin-listener";
import { clipboard } from "@milkdown/plugin-clipboard";
import { history } from "@milkdown/plugin-history";
import { getMarkdown, replaceAll } from "@milkdown/utils";
import { linkTooltip } from "../utils/link-tooltip.js";
import type { AppState } from "../state/types.js";
import { dispatch, getState } from "../state/store.js";
import { deriveTitleFromMarkdown } from "../utils/markdown.js";
import { showToast } from "../utils/toast.js";
import { confirmDialog } from "../utils/dialog.js";
import { closeMenuAfterTap } from "../utils/menu.js";
import { generateId } from "../utils/id.js";
import { computeNoteList, computeNoteCounts } from "../utils/notes.js";
import type { NoteMeta } from "../state/types.js";

export class EditorPane {
  el: HTMLElement;
  private editor: Editor | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private saveInFlight: Promise<void> | null = null;
  private pendingMarkdown = "";
  private pendingSaveNoteId: string | null = null;
  private lastSavedMarkdown = "";
  /** True whenever pendingMarkdown/pendingSaveNoteId hold an edit that hasn't been durably saved yet. */
  private dirty = false;
  currentNoteId: string | null = null;
  onNoteDeleted?: () => void;
  private spinner!: HTMLElement;
  private milkdownHost!: HTMLElement;
  private emptyState!: HTMLElement;
  private noteMenu!: HTMLElement & { close(): void };

  constructor() {
    this.el = document.createElement("div");
    this.el.className = "editor-pane";
    this.el.innerHTML = `
      <div class="editor-toolbar">
        <div class="toolbar-right">
          <vault-spinner size="md" class="save-spinner" label="Saving…" hidden></vault-spinner>
          <vault-popover placement="bottom-end" class="note-menu" style="display: none">
            <vault-button slot="trigger" variant="ghost" size="md" class="note-menu-btn" aria-label="Note options">⋮</vault-button>
            <div class="note-menu-panel">
              <button class="menu-item" data-action="copy">Copy text</button>
              <button class="menu-item menu-item--danger" data-action="delete">Delete</button>
            </div>
          </vault-popover>
        </div>
      </div>
      <div class="milkdown-host"></div>
      <p class="editor-empty-state" hidden>Select a note, or create a new one.</p>
    `;

    this.spinner = this.el.querySelector(".save-spinner")!;
    this.milkdownHost = this.el.querySelector(".milkdown-host")!;
    this.emptyState = this.el.querySelector(".editor-empty-state")!;
    this.noteMenu = this.el.querySelector(".note-menu")!;

    this.noteMenu.addEventListener("click", (e) => e.stopPropagation());

    this.noteMenu.querySelector('[data-action="copy"]')!.addEventListener("click", () => {
      closeMenuAfterTap(this.noteMenu, () => {
        const content = this.getCurrentMarkdown();
        if (content) navigator.clipboard.writeText(content);
      });
    });

    this.noteMenu.querySelector('[data-action="delete"]')!.addEventListener("click", () => {
      closeMenuAfterTap(this.noteMenu, () => {
        const note = getState().notes.find((n) => n.id === this.currentNoteId);
        if (note) {
          confirmDeleteNote(note).then((deleted) => {
            if (deleted) this.onNoteDeleted?.();
          });
        }
      });
    });
  }

  async mount(): Promise<void> {
    this.editor = await Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, this.milkdownHost);
        ctx.set(editorViewOptionsCtx, { attributes: { "aria-label": "Note content" } });
        ctx.set(defaultValueCtx, "");
        ctx.get(listenerCtx).markdownUpdated((_ctx, markdown) => {
          this.pendingMarkdown = markdown;
          this.scheduleAutoSave(markdown);
        });
      })
      .use(commonmark)
      .use(gfm)
      .use(listener)
      .use(clipboard)
      .use(history)
      .use(linkTooltip)
      .create();

    this.milkdownHost.addEventListener("click", (e) => {
      const li = (e.target as Element).closest('li[data-item-type="task"]');
      if (!li) return;
      const liRect = li.getBoundingClientRect();
      // Only toggle when click lands in the ::before checkbox area (16px + 8px gap)
      if (e.clientX - liRect.left > 24) return;
      this.editor?.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const pos = view.posAtDOM(li, 0);
        const $pos = view.state.doc.resolve(pos);
        let depth = $pos.depth;
        while (depth > 0 && $pos.node(depth).type.name !== "list_item") depth--;
        const listItemNode = $pos.node(depth);
        const listItemPos = $pos.before(depth);
        const tr = view.state.tr.setNodeMarkup(listItemPos, undefined, {
          ...listItemNode.attrs,
          checked: !listItemNode.attrs.checked,
        });
        view.dispatch(tr);
      });
    });
  }

  render(state: AppState): void {
    this.spinner.style.display = state.isSaving ? "" : "none";
    this.noteMenu.style.display = state.selectedNoteId === null ? "none" : "";
    const empty = state.selectedNoteId === null;
    this.emptyState.hidden = !empty;
    this.milkdownHost.style.display = empty ? "none" : "";
  }

  async loadNote(noteId: string): Promise<void> {
    const store = getState().store;
    if (!store) return;
    this.currentNoteId = noteId;
    const content = await store.get(noteId);
    if (this.currentNoteId !== noteId) return;
    const md = content ?? "";
    this.pendingMarkdown = md;
    this.lastSavedMarkdown = md;
    // Reset dirty tracking for the newly loaded note
    this.dirty = false;
    this.pendingSaveNoteId = null;
    // flush=true rebuilds the EditorState from scratch instead of dispatching a
    // transaction, resetting the undo/redo history so Cmd+Z can't pull in a
    // previous note's content after switching notes.
    this.editor?.action(replaceAll(md, true));
  }

  clearNote(): void {
    this.currentNoteId = null;
    this.pendingMarkdown = "";
    this.editor?.action(replaceAll("", true)); // flush=true — see loadNote()
  }

  private scheduleAutoSave(markdown: string): void {
    if (!this.currentNoteId || markdown === this.lastSavedMarkdown) return;
    const noteId = this.currentNoteId;
    this.pendingSaveNoteId = noteId;
    this.pendingMarkdown = markdown;
    this.dirty = true;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    dispatch({ type: "NOTE_SAVE_START" });
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.saveInFlight = this.doSave(noteId, markdown).finally(() => {
        this.saveInFlight = null;
      });
    }, 800);
  }

  private async doSave(noteId: string, markdown: string): Promise<void> {
    const state = getState();
    if (!state.store) return;
    try {
      const title = deriveTitleFromMarkdown(markdown);
      const existingMeta = await state.store.getMeta(noteId);
      const meta = await state.store.set(noteId, markdown, {
        title,
        type: "note",
        folderId: existingMeta ? (existingMeta["folderId"] ?? null) : state.selectedFolderId,
      });
      if (noteId === this.currentNoteId) this.lastSavedMarkdown = markdown;
      // Only clear dirty if no newer edit arrived while this save was in flight.
      if (noteId === this.pendingSaveNoteId && markdown === this.pendingMarkdown) {
        this.dirty = false;
        this.pendingSaveNoteId = null;
      }
      dispatch({ type: "NOTE_SAVE_DONE", meta: meta as NoteMeta });
    } catch (err) {
      dispatch({ type: "NOTE_SAVE_FAILED" });
      showToast("Save failed — copy your text as a backup, just in case.", "danger");
      console.error("Note save failed:", err);
    }
  }

  /**
   * Retries until the last known edit is durably saved, not just until the
   * debounce timer has fired — a save that already failed once (dirty stays
   * true, saveTimer is already null) must still be retried before switching
   * notes or locking, or the edit is silently discarded.
   */
  async flushPendingSave(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (this.saveInFlight) await this.saveInFlight;
    if (this.dirty && this.pendingSaveNoteId) {
      const noteId = this.pendingSaveNoteId;
      const markdown = this.pendingMarkdown;
      await this.doSave(noteId, markdown);
    }
  }

  async lock(): Promise<void> {
    await this.flushPendingSave();
    showToast("Vault locked.", "success");
    dispatch({ type: "LOCKED" });
  }

  async createNote(): Promise<void> {
    const state = getState();
    if (!state.store) return;
    const id = generateId("note");
    const defaultContent = "# Untitled\n\n";
    try {
      await state.store.set(id, defaultContent, {
        title: "Untitled",
        type: "note",
        folderId: state.selectedFolderId,
      });
      // reload notes then select the new one
      const all = await state.store.list();
      const notes = computeNoteList(all, state.selectedFolderId);
      const updatedCounts = computeNoteCounts(all);
      this.currentNoteId = id;
      this.pendingMarkdown = defaultContent;
      this.lastSavedMarkdown = defaultContent;
      // NOTE_SELECTED first: app-screen's subscribe callback compares
      // selectedNoteId against editorPane.currentNoteId (already `id` above) on
      // every dispatch, so selecting before the NOTES_LOADED dispatch keeps
      // them in sync throughout instead of racing an intermediate state where
      // selectedNoteId is still the old value.
      dispatch({ type: "NOTE_SELECTED", noteId: id });
      dispatch({ type: "NOTES_LOADED", notes, noteCounts: updatedCounts });
      this.editor?.action(replaceAll(defaultContent, true)); // flush=true — see loadNote()
      this.editor?.action((ctx) => ctx.get(editorViewCtx).focus());
    } catch (err) {
      console.error("Note create failed:", err);
      showToast("Couldn't create a new note — try again.", "danger");
    }
  }

  getCurrentMarkdown(): string {
    return this.editor?.action(getMarkdown()) ?? "";
  }

  async destroy(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    await this.editor?.destroy();
    this.editor = null;
  }
}

/** Resolves true if the note was actually deleted, false if the user cancelled. */
async function confirmDeleteNote(note: NoteMeta): Promise<boolean> {
  const ok = await confirmDialog({
    title: "Delete note?",
    body: `"${note.title}" will be permanently deleted.`,
    confirmLabel: "Delete",
    danger: true,
  });
  if (!ok) return false;
  const store = getState().store;
  if (!store) return false;
  try {
    await store.delete(note.id);
  } catch (err) {
    console.error("Note delete failed:", err);
    showToast(`Couldn't delete "${note.title}" — try again.`, "danger");
    return false;
  }
  dispatch({ type: "NOTE_DELETED", noteId: note.id });
  showToast(`"${note.title}" was deleted.`, "info");
  return true;
}
