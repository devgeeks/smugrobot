import type { AppState, FolderMeta } from '../state/types.js'
import { dispatch, getState } from '../state/store.js'

interface FolderNode {
  meta: FolderMeta
  children: FolderNode[]
}

function buildTree(folders: FolderMeta[], parentId: string | null): FolderNode[] {
  return folders
    .filter((f) => (f['parentId'] ?? null) === parentId)
    .map((meta) => ({ meta, children: buildTree(folders, meta.id) }))
}

export class FolderPane {
  el: HTMLElement
  private prevFolders: FolderMeta[] = []
  private prevSelected: string | null = null

  constructor() {
    this.el = document.createElement('div')
    this.el.className = 'folder-pane'
    this.el.innerHTML = `
      <div class="pane-header">
        <span class="pane-title">Folders</span>
        <button class="icon-btn new-folder-btn" title="New folder" aria-label="New folder">+</button>
      </div>
      <nav class="folder-tree" aria-label="Folders"></nav>
    `
    this.el.querySelector('.new-folder-btn')!.addEventListener('click', () =>
      this.promptNewFolder(null)
    )
  }

  render(state: AppState): void {
    if (
      state.folders === this.prevFolders &&
      state.selectedFolderId === this.prevSelected
    )
      return
    this.prevFolders = state.folders
    this.prevSelected = state.selectedFolderId
    this.renderTree(state.folders, state.selectedFolderId)
  }

  private renderTree(folders: FolderMeta[], selectedId: string | null): void {
    const nav = this.el.querySelector('.folder-tree')!
    nav.innerHTML = ''

    const allNotes = document.createElement('button')
    allNotes.className = 'folder-item' + (selectedId === null ? ' folder-item--active' : '')
    allNotes.textContent = 'All Notes'
    allNotes.addEventListener('click', () =>
      dispatch({ type: 'FOLDER_SELECTED', folderId: null })
    )
    nav.appendChild(allNotes)

    const tree = buildTree(folders, null)
    for (const node of tree) {
      nav.appendChild(this.renderNode(node, selectedId))
    }
  }

  private renderNode(node: FolderNode, selectedId: string | null): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = 'folder-node'

    const btn = document.createElement('button')
    btn.className =
      'folder-item' + (selectedId === node.meta.id ? ' folder-item--active' : '')
    btn.dataset['id'] = node.meta.id

    const hasChildren = node.children.length > 0
    btn.innerHTML = `
      <span class="folder-arrow">${hasChildren ? '▾' : ' '}</span>
      <span class="folder-name">${escapeHtml(node.meta.title)}</span>
    `
    btn.addEventListener('click', () =>
      dispatch({ type: 'FOLDER_SELECTED', folderId: node.meta.id })
    )

    const addSubBtn = document.createElement('button')
    addSubBtn.className = 'icon-btn folder-add-sub'
    addSubBtn.title = 'New subfolder'
    addSubBtn.textContent = '+'
    addSubBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      this.promptNewFolder(node.meta.id)
    })
    btn.appendChild(addSubBtn)

    wrap.appendChild(btn)

    if (hasChildren) {
      const childList = document.createElement('div')
      childList.className = 'folder-children'
      for (const child of node.children) {
        childList.appendChild(this.renderNode(child, selectedId))
      }
      wrap.appendChild(childList)
    }

    return wrap
  }

  private promptNewFolder(parentId: string | null): void {
    const nav = this.el.querySelector('.folder-tree')!
    const input = document.createElement('input')
    input.className = 'folder-inline-input'
    input.placeholder = 'Folder name'
    input.style.paddingLeft = parentId ? 'var(--sp-8)' : 'var(--sp-4)'

    const commit = async () => {
      const name = input.value.trim()
      input.remove()
      if (!name) return
      const store = getState().store
      if (!store) return
      const id = 'folder-' + crypto.randomUUID()
      const meta = await store.set(id, '', {
        title: name,
        type: 'folder',
        parentId,
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

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
