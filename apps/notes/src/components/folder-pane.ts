import type { AppState, FolderMeta } from "../state/types.js";
import { dispatch, getState } from "../state/store.js";
import { loadFolders, loadNotes } from "../screens/app-screen.js";
import { confirmDialog, promptDialog } from "../utils/dialog.js";
import { closeMenuAfterTap } from "../utils/menu.js";
import { showToast } from "../utils/toast.js";
import { generateId } from "../utils/id.js";

export class FolderPane {
  el: HTMLElement;
  onFolderSelect?: () => void;
  private prevFolders: FolderMeta[] = [];
  private prevSelected: string | null = null;
  private prevCounts: Record<string, number> = {};

  constructor() {
    this.el = document.createElement("div");
    this.el.className = "folder-pane";
    this.el.innerHTML = `
      <div class="pane-header">
        <vault-button variant="secondary" size="md" class="add-folder-btn">Add folder</vault-button>
        <span class="pane-title">Folders</span>
      </div>
      <nav class="folder-tree" aria-label="Folders"></nav>
    `;
    this.el
      .querySelector(".add-folder-btn")!
      .addEventListener("click", () => this.promptNewFolder());
  }

  render(state: AppState): void {
    if (
      state.folders === this.prevFolders &&
      state.selectedFolderId === this.prevSelected &&
      state.noteCounts === this.prevCounts
    )
      return;
    this.prevFolders = state.folders;
    this.prevSelected = state.selectedFolderId;
    this.prevCounts = state.noteCounts;
    this.renderTree(state.folders, state.selectedFolderId, state.noteCounts);
  }

  private renderTree(
    folders: FolderMeta[],
    selectedId: string | null,
    noteCounts: Record<string, number>,
  ): void {
    const nav = this.el.querySelector(".folder-tree")!;
    nav.innerHTML = "";

    const listbox = document.createElement("vault-listbox");
    listbox.setAttribute("selectable", "");
    listbox.setAttribute("ghost", "");
    listbox.setAttribute("aria-label", "Folders");
    listbox.value = selectedId ?? "__all__";

    const activeValue = selectedId ?? "__all__";

    const allOpt = document.createElement("vault-listbox-option");
    allOpt.value = "__all__";
    if (activeValue === "__all__") allOpt.setAttribute("active", "");
    const allLabel = document.createElement("span");
    allLabel.className = "folder-label";
    allLabel.textContent = "All notes";
    allOpt.appendChild(allLabel);
    listbox.appendChild(allOpt);

    for (const folder of folders) {
      const empty = (noteCounts[folder.id] ?? 0) === 0;
      listbox.appendChild(this.renderFolderRow(folder, activeValue === folder.id, empty));
    }

    listbox.addEventListener("vault-change", (e) => {
      const value = (e as CustomEvent<{ value: string }>).detail.value;
      const folderId = value === "__all__" ? null : value;
      this.onFolderSelect?.();
      dispatch({ type: "FOLDER_SELECTED", folderId });
    });

    nav.appendChild(listbox);
  }

  private renderFolderRow(folder: FolderMeta, active: boolean, empty: boolean): HTMLElement {
    const opt = document.createElement("vault-listbox-option");
    opt.value = folder.id;
    if (active) opt.setAttribute("active", "");
    if (empty) opt.setAttribute("data-empty", "");

    const row = document.createElement("div");
    row.className = "folder-row-content";

    const label = document.createElement("span");
    label.className = "folder-label";
    label.textContent = folder.title;
    row.appendChild(label);
    row.appendChild(this.renderFolderMenu(folder));

    opt.appendChild(row);
    return opt;
  }

  private renderFolderMenu(folder: FolderMeta): HTMLElement {
    const menu = document.createElement("vault-popover") as HTMLElement & { close(): void };
    menu.className = "folder-menu";
    menu.setAttribute("placement", "bottom-end");
    menu.innerHTML = `
      <vault-button slot="trigger" variant="ghost" size="md" class="folder-menu-btn" aria-label="Folder options">⋮</vault-button>
      <div class="folder-menu-panel">
        <button class="menu-item" data-action="rename">Rename</button>
        <button class="menu-item menu-item--danger" data-action="delete">Delete</button>
      </div>
    `;
    // Keep clicks/presses on the menu from also reaching the listbox's own
    // pointerdown/click handlers, which would select or re-activate this
    // option instead of (or as well as) operating the menu.
    menu.addEventListener("pointerdown", (e) => e.stopPropagation());
    menu.addEventListener("click", (e) => e.stopPropagation());
    menu.querySelector('[data-action="rename"]')!.addEventListener("click", () => {
      closeMenuAfterTap(menu, () => this.renameFolder(folder));
    });
    menu.querySelector('[data-action="delete"]')!.addEventListener("click", () => {
      closeMenuAfterTap(menu, () => this.deleteFolder(folder));
    });
    return menu;
  }

  private async renameFolder(folder: FolderMeta): Promise<void> {
    const name = await promptDialog({
      title: "Rename folder",
      label: "Folder name",
      initialValue: folder.title,
      confirmLabel: "Rename",
    });
    if (!name || name === folder.title) return;
    const store = getState().store;
    if (!store) return;
    const meta = await store.updateMeta(folder.id, { title: name });
    dispatch({ type: "FOLDER_RENAMED", folder: meta as FolderMeta });
  }

  private async deleteFolder(folder: FolderMeta): Promise<void> {
    const ok = await confirmDialog({
      title: "Delete folder?",
      body: `"${folder.title}" will be deleted. Notes inside it will move to "All notes".`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    const store = getState().store;
    if (!store) return;

    const all = await store.list();
    const notesToMove = all.filter(
      (m) => m["type"] === "note" && (m["folderId"] ?? null) === folder.id,
    );
    try {
      for (const noteMeta of notesToMove) {
        await store.updateMeta(noteMeta.id, { folderId: null });
      }
      await store.delete(folder.id);
    } catch (err) {
      showToast("Failed to delete folder. Notes may not have been moved.", "danger");
      console.error("Folder delete failed:", err);
      return;
    }

    dispatch({ type: "FOLDER_DELETED", folderId: folder.id });
    await loadFolders();
    await loadNotes(getState().selectedFolderId);
    showToast(`"${folder.title}" was deleted.`, "info");
  }

  private promptNewFolder(): void {
    const nav = this.el.querySelector(".folder-tree")!;
    const vaultInput = document.createElement("vault-input");
    vaultInput.setAttribute("label", "Folder name");

    let currentValue = "";
    let committed = false;

    const commit = async () => {
      if (committed) return;
      committed = true;
      const name = currentValue.trim();
      vaultInput.remove();
      if (!name) return;
      const store = getState().store;
      if (!store) return;
      const id = generateId("folder");
      const meta = await store.set(id, "", {
        title: name,
        type: "folder",
        parentId: null,
      });
      dispatch({
        type: "FOLDER_CREATED",
        folder: meta as FolderMeta,
      });
    };

    vaultInput.addEventListener("vault-input", (e) => {
      currentValue = (e as CustomEvent<{ value: string }>).detail.value;
    });
    vaultInput.addEventListener("vault-change", (e) => {
      currentValue = (e as CustomEvent<{ value: string }>).detail.value;
      commit();
    });
    vaultInput.addEventListener("keydown", (e) => {
      if ((e as KeyboardEvent).key === "Enter") commit();
      if ((e as KeyboardEvent).key === "Escape") vaultInput.remove();
    });

    nav.appendChild(vaultInput);
    vaultInput.focus();
  }
}
