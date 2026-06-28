import type { AppState, FolderMeta } from '../state/types.js'
import { dispatch, getState } from '../state/store.js'

export class FolderPane {
  el: HTMLElement
  onFolderSelect?: () => void
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

    const listbox = document.createElement('vault-listbox')
    listbox.setAttribute('selectable', '')
    listbox.setAttribute('ghost', '')
    listbox.setAttribute('value', selectedId ?? '__all__')

    const allOpt = document.createElement('vault-listbox-option')
    allOpt.setAttribute('value', '__all__')
    const allLabel = document.createElement('span')
    allLabel.className = 'folder-label'
    allLabel.textContent = 'All notes'
    allOpt.appendChild(allLabel)
    listbox.appendChild(allOpt)

    for (const folder of folders) {
      const opt = document.createElement('vault-listbox-option')
      opt.setAttribute('value', folder.id)
      if ((noteCounts[folder.id] ?? 0) === 0) opt.setAttribute('data-empty', '')
      const label = document.createElement('span')
      label.className = 'folder-label'
      label.textContent = folder.title
      opt.appendChild(label)
      listbox.appendChild(opt)
    }

    listbox.addEventListener('vault-change', (e) => {
      const value = (e as CustomEvent<{ value: string }>).detail.value
      const folderId = value === '__all__' ? null : value
      this.onFolderSelect?.()
      dispatch({ type: 'FOLDER_SELECTED', folderId })
    })

    nav.appendChild(listbox)
  }

  private promptNewFolder(): void {
    const nav = this.el.querySelector('.folder-tree')!
    const vaultInput = document.createElement('vault-input')
    vaultInput.setAttribute('label', 'Folder name')

    let currentValue = ''
    let committed = false

    const commit = async () => {
      if (committed) return
      committed = true
      const name = currentValue.trim()
      vaultInput.remove()
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

    vaultInput.addEventListener('vault-input', (e) => {
      currentValue = (e as CustomEvent<{ value: string }>).detail.value
    })
    vaultInput.addEventListener('vault-change', (e) => {
      currentValue = (e as CustomEvent<{ value: string }>).detail.value
      commit()
    })
    vaultInput.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter') commit()
      if ((e as KeyboardEvent).key === 'Escape') vaultInput.remove()
    })

    nav.appendChild(vaultInput)
    vaultInput.focus()
  }
}
