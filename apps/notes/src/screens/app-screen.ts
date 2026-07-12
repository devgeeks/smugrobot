import { dispatch, getState, subscribe } from '../state/store.js'
import { FolderPane } from '../components/folder-pane.js'
import { NoteList } from '../components/note-list.js'
import { EditorPane } from '../components/editor-pane.js'
import type { NoteMeta } from '../state/types.js'

let unsub: (() => void) | null = null
let unsubFolderLoad: (() => void) | null = null
let timestampInterval: ReturnType<typeof setInterval> | null = null

export async function mountAppScreen(root: HTMLElement): Promise<void> {
  unsub?.()
  unsubFolderLoad?.()
  if (timestampInterval) clearInterval(timestampInterval)

  root.innerHTML = ''

  const layout = document.createElement('div')
  layout.className = 'app-layout'
  root.appendChild(layout)

  const folderPane = new FolderPane()
  const noteList = new NoteList()
  const editorPane = new EditorPane()

  layout.appendChild(folderPane.el)
  layout.appendChild(noteList.el)
  layout.appendChild(editorPane.el)

  // ── Mobile single-pane navigation ─────────────────────────
  const PANE_ORDER = ['folders', 'list', 'editor'] as const
  let mobilePaneVisible: 'folders' | 'list' | 'editor' = 'list'
  function setMobilePane(pane: typeof mobilePaneVisible): void {
    const direction = PANE_ORDER.indexOf(pane) >= PANE_ORDER.indexOf(mobilePaneVisible) ? 1 : -1
    layout.style.setProperty('--pane-slide-direction', String(direction))
    mobilePaneVisible = pane
    layout.dataset['mobilePane'] = pane
  }
  setMobilePane('list')

  // Inject mobile-only nav buttons into the NoteList's existing pane-header
  const noteListHeader = noteList.el.querySelector('.pane-header')!

  const backToFoldersBtn = document.createElement('button')
  backToFoldersBtn.className = 'icon-btn mobile-nav-btn'
  backToFoldersBtn.setAttribute('aria-label', 'Back to folders')
  backToFoldersBtn.textContent = '← Folders'
  noteListHeader.insertBefore(backToFoldersBtn, noteListHeader.firstChild)
  backToFoldersBtn.addEventListener('click', () => setMobilePane('folders'))

  const noteListLockBtn = document.createElement('vault-button')
  noteListLockBtn.setAttribute('variant', 'secondary')
  noteListLockBtn.setAttribute('size', 'md')
  noteListLockBtn.className = 'mobile-nav-btn'
  noteListLockBtn.textContent = 'Lock'
  noteListHeader.appendChild(noteListLockBtn)
  noteListLockBtn.addEventListener('click', () => editorPane.lock())

  noteList.onNewNote = () => editorPane.createNote()

  // Inject "← Notes" button at start of editor toolbar
  const backToNotesBtn = document.createElement('button')
  backToNotesBtn.className = 'icon-btn mobile-nav-btn'
  backToNotesBtn.setAttribute('aria-label', 'Back to notes')
  backToNotesBtn.textContent = '← Notes'
  const toolbar = editorPane.el.querySelector('.editor-toolbar')!
  toolbar.insertBefore(backToNotesBtn, toolbar.firstChild)
  backToNotesBtn.addEventListener('click', () => setMobilePane('list'))

  // Navigate on every tap, including re-taps of the already-selected item.
  folderPane.onFolderSelect = () => setMobilePane('list')
  noteList.onNoteSelect = () => setMobilePane('editor')
  // ──────────────────────────────────────────────────────────

  await editorPane.mount()

  // Load initial data
  await loadFolders()
  await loadNotes(getState().selectedFolderId)

  unsub = subscribe(async () => {
    const state = getState()
    folderPane.render(state)
    noteList.render(state)
    editorPane.render(state)

    if (
      state.selectedNoteId !== null &&
      state.selectedNoteId !== editorPane.currentNoteId
    ) {
      await editorPane.flushPendingSave()
      await editorPane.loadNote(state.selectedNoteId)
    } else if (state.selectedNoteId === null && editorPane.currentNoteId !== null) {
      await editorPane.flushPendingSave()
      editorPane.clearNote()
    }
  })

  // Reload notes when folder selection changes
  const prevFolderId = { value: getState().selectedFolderId }
  unsubFolderLoad = subscribe(async () => {
    const state = getState()
    if (state.selectedFolderId !== prevFolderId.value) {
      prevFolderId.value = state.selectedFolderId
      await loadNotes(state.selectedFolderId)
    }
  })

  timestampInterval = setInterval(() => {
    noteList.refreshTimestamps()
  }, 60_000)

  // initial render
  folderPane.render(getState())
  noteList.render(getState())
  editorPane.render(getState())
}

export function unmountAppScreen(): void {
  unsub?.()
  unsub = null
  unsubFolderLoad?.()
  unsubFolderLoad = null
  if (timestampInterval) {
    clearInterval(timestampInterval)
    timestampInterval = null
  }
}

async function loadFolders(): Promise<void> {
  const store = getState().store
  if (!store) return
  const all = await store.list()
  const folders = all.filter((m) => m['type'] === 'folder') as ReturnType<typeof getState>['folders']
  dispatch({ type: 'FOLDERS_LOADED', folders })
}

async function loadNotes(folderId: string | null): Promise<void> {
  const store = getState().store
  if (!store) return
  const all = await store.list()
  const notes = (
    all.filter(
      (m) => m['type'] === 'note' && (folderId === null || (m['folderId'] ?? null) === folderId)
    ) as NoteMeta[]
  ).sort((a, b) => b.updatedAt - a.updatedAt)
  const noteCounts: Record<string, number> = {}
  for (const m of all) {
    if (m['type'] === 'note') {
      const key = (m['folderId'] as string | null) ?? ''
      noteCounts[key] = (noteCounts[key] ?? 0) + 1
    }
  }
  dispatch({ type: 'NOTES_LOADED', notes, noteCounts })
}
