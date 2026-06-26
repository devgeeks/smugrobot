import { dispatch, getState, subscribe } from '../state/store.js'
import { FolderPane } from '../components/folder-pane.js'
import { NoteList } from '../components/note-list.js'
import { EditorPane } from '../components/editor-pane.js'
import type { NoteMeta } from '../state/types.js'

let unsub: (() => void) | null = null
let timestampInterval: ReturnType<typeof setInterval> | null = null

export async function mountAppScreen(root: HTMLElement): Promise<void> {
  unsub?.()
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

  // Inject "← Folders" header into note list (NoteList has no header of its own)
  const noteListHeader = document.createElement('div')
  noteListHeader.className = 'pane-header'
  noteListHeader.innerHTML = `
    <button class="icon-btn mobile-nav-btn" aria-label="Back to folders">← Folders</button>
    <span class="pane-title">Notes</span>
    <div class="mobile-nav-btn mobile-note-list-actions">
      <vault-button variant="primary" size="md" class="mobile-new-note-btn">New Note</vault-button>
      <vault-button variant="secondary" size="md" class="mobile-lock-btn">Lock</vault-button>
    </div>
  `
  noteList.el.insertBefore(noteListHeader, noteList.el.firstChild)
  noteListHeader.querySelector('.mobile-nav-btn[aria-label]')!
    .addEventListener('click', () => setMobilePane('folders'))
  noteListHeader.querySelector('.mobile-new-note-btn')!
    .addEventListener('click', () => editorPane.createNote())
  noteListHeader.querySelector('.mobile-lock-btn')!
    .addEventListener('click', () => editorPane.lock())

  // Inject "← Notes" button at start of editor toolbar
  const backToNotesBtn = document.createElement('button')
  backToNotesBtn.className = 'icon-btn mobile-nav-btn'
  backToNotesBtn.setAttribute('aria-label', 'Back to notes')
  backToNotesBtn.textContent = '← Notes'
  const toolbar = editorPane.el.querySelector('.editor-toolbar')!
  toolbar.insertBefore(backToNotesBtn, toolbar.firstChild)
  backToNotesBtn.addEventListener('click', () => setMobilePane('list'))

  // Navigate on every note tap, including re-taps of the already-selected note.
  noteList.onNoteSelect = () => setMobilePane('editor')
  // ──────────────────────────────────────────────────────────

  await editorPane.mount()

  // Load initial data
  await loadFolders()
  await loadNotes(getState().selectedFolderId)

  const prevMobileState = {
    folderId: getState().selectedFolderId,
    noteId: getState().selectedNoteId,
  }

  unsub = subscribe(async () => {
    const state = getState()
    folderPane.render(state)
    noteList.render(state)
    editorPane.render(state)

    if (
      state.selectedNoteId !== null &&
      state.selectedNoteId !== editorPane.currentNoteId
    ) {
      await editorPane.loadNote(state.selectedNoteId)
    } else if (state.selectedNoteId === null && editorPane.currentNoteId !== null) {
      editorPane.clearNote()
    }

    // Auto-navigate on mobile when folder or note selection changes
    if (state.selectedFolderId !== prevMobileState.folderId) {
      prevMobileState.folderId = state.selectedFolderId
      setMobilePane('list')
    }
    if (state.selectedNoteId !== null && state.selectedNoteId !== prevMobileState.noteId) {
      prevMobileState.noteId = state.selectedNoteId
      setMobilePane('editor')
    }
    if (state.selectedNoteId === null) {
      prevMobileState.noteId = null
    }
  })

  // Reload notes when folder selection changes
  const prevState = { folderId: getState().selectedFolderId }
  subscribe(async () => {
    const state = getState()
    if (state.selectedFolderId !== prevState.folderId) {
      prevState.folderId = state.selectedFolderId
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
