import type { AppState, FolderMeta } from '../state/types.js'
import { dispatch, getState } from '../state/store.js'

export class FolderPane {
  el: HTMLElement
  private prevFolders: FolderMeta[] = []
  private prevSelected: string | null = null
  private prevCounts: Record<string, number> = {}

  constructor() {
    this.el = document.createElement('div')
    this.el.className = 'folder-pane'
    this.el.innerHTML = `
      <div class="pane-header">
        <span class="pane-title">Folders</span>
        <vault-button variant="secondary" size="md" class="add-folder-btn">Add folder</vault-button>
      </div>
      <nav class="folder-tree" aria-label="Folders"></nav>
    `
    this.el.querySelector('.add-folder-btn')!.addEventListener('click', () =>
      this.promptNewFolder()
    )
  }

  render(state: AppState): void {
    if (
      state.folders === this.prevFolders &&
      state.selectedFolderId === this.prevSelected &&
      state.noteCounts === this.prevCounts
    )
      return
    this.prevFolders = state.folders
    this.prevSelected = state.selectedFolderId
    this.prevCounts = state.noteCounts
    this.renderTree(state.folders, state.selectedFolderId, state.noteCounts)
  }

  private renderTree(folders: FolderMeta[], selectedId: string | null, noteCounts: Record<string, number>): void {
    const nav = this.el.querySelector('.folder-tree')!
    nav.innerHTML = ''

    const allNotes = document.createElement('button')
    allNotes.className = 'folder-item' + (selectedId === null ? ' folder-item--active' : '')
    allNotes.textContent = 'All notes'
    allNotes.addEventListener('click', () =>
      dispatch({ type: 'FOLDER_SELECTED', folderId: null })
    )
    nav.appendChild(allNotes)

    for (const folder of folders) {
      const btn = document.createElement('button')
      btn.className = 'folder-item' + (selectedId === folder.id ? ' folder-item--active' : '')
      if ((noteCounts[folder.id] ?? 0) === 0) btn.classList.add('folder-item--empty')
      btn.dataset['id'] = folder.id
      btn.textContent = folder.title
      btn.addEventListener('click', () =>
        dispatch({ type: 'FOLDER_SELECTED', folderId: folder.id })
      )
      nav.appendChild(btn)
    }
  }

  private promptNewFolder(): void {
    const nav = this.el.querySelector('.folder-tree')!
    const input = document.createElement('input')
    input.className = 'folder-inline-input'
    input.placeholder = 'Folder name'

    const commit = async () => {
      const name = input.value.trim()
      input.remove()
      if (!name) return
      const store = getState().store
      if (!store) return
      const id = 'folder-' + Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('')
      const meta = await store.set(id, '', {
        title: name,
        type: 'folder',
        parentId: null,
      })
      dispatch({
        type: 'FOLDER_CREATED',
        folder: meta as FolderMeta,
      })
    }

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') commit()
      if (e.key === 'Escape') input.remove()
    })
    input.addEventListener('blur', commit)

    nav.appendChild(input)
    input.focus()
  }
}
