import { dispatch, getState, subscribe } from '../state/store.js'
import { FolderPane } from '../components/folder-pane.js'
import { NoteList } from '../components/note-list.js'
import { EditorPane } from '../components/editor-pane.js'
import { confirmDialog } from '../utils/dialog.js'
import type { NoteMeta } from '../state/types.js'

let unsub: (() => void) | null = null
let unsubFolderLoad: (() => void) | null = null
let timestampInterval: ReturnType<typeof setInterval> | null = null
let activeEditorPane: EditorPane | null = null

export async function mountAppScreen(root: HTMLElement): Promise<void> {
  unsub?.()
  unsubFolderLoad?.()
  if (timestampInterval) clearInterval(timestampInterval)
  await activeEditorPane?.destroy()
  activeEditorPane = null

  root.innerHTML = ''

  const header = document.createElement('div')
  header.className = 'app-header'
  header.innerHTML = `
    <span class="app-header-logo">Notes</span>
    <vault-button variant="secondary" size="md" class="app-header-lock-btn">Lock</vault-button>
  `
  root.appendChild(header)

  const layout = document.createElement('div')
  layout.className = 'app-layout'
  root.appendChild(layout)

  const folderPane = new FolderPane()
  const noteList = new NoteList()
  const editorPane = new EditorPane()

  layout.appendChild(folderPane.el)
  layout.appendChild(noteList.el)
  layout.appendChild(editorPane.el)

  const headerLockBtn = header.querySelector('.app-header-lock-btn')!
  headerLockBtn.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Lock vault?',
      body: "You'll need your passphrase to unlock it again.",
      confirmLabel: 'Lock',
    })
    if (!ok) return
    headerLockBtn.setAttribute('loading', '')
    await editorPane.lock()
    headerLockBtn.removeAttribute('loading')
  })

  // ── Mobile single-pane navigation ─────────────────────────
  const PANE_ORDER = ['folders', 'list', 'editor'] as const
  let mobilePaneVisible: 'folders' | 'list' | 'editor' = 'list'
  function setMobilePane(pane: typeof mobilePaneVisible, options: { moveFocus?: boolean } = {}): void {
    const direction = PANE_ORDER.indexOf(pane) >= PANE_ORDER.indexOf(mobilePaneVisible) ? 1 : -1
    layout.style.setProperty('--pane-slide-direction', String(direction))
    mobilePaneVisible = pane
    layout.dataset['mobilePane'] = pane

    if (options.moveFocus) {
      // The pane we just hid may contain the currently focused element (e.g.
      // the button that triggered this navigation); move focus into the pane
      // that's now visible instead of letting it fall back to <body>.
      if (pane === 'editor') {
        backToNotesBtn.focus()
      } else {
        const paneEl = pane === 'folders' ? folderPane.el : noteList.el
        const heading = paneEl.querySelector('.pane-title') as HTMLElement | null
        heading?.setAttribute('tabindex', '-1')
        heading?.focus()
      }
    }
  }
  setMobilePane('list')

  // Inject mobile-only nav buttons into the NoteList's existing pane-header
  const noteListHeader = noteList.el.querySelector('.pane-header')!

  const backToFoldersBtn = document.createElement('button')
  backToFoldersBtn.className = 'icon-btn mobile-nav-btn'
  backToFoldersBtn.setAttribute('aria-label', 'Back to folders')
  backToFoldersBtn.textContent = '← Folders'
  noteListHeader.insertBefore(backToFoldersBtn, noteListHeader.firstChild)
  backToFoldersBtn.addEventListener('click', () => setMobilePane('folders', { moveFocus: true }))

  noteList.onNewNote = () => editorPane.createNote()

  // Inject "← Notes" button at start of editor toolbar
  const backToNotesBtn = document.createElement('button')
  backToNotesBtn.className = 'icon-btn mobile-nav-btn'
  backToNotesBtn.setAttribute('aria-label', 'Back to notes')
  backToNotesBtn.textContent = '← Notes'
  const toolbar = editorPane.el.querySelector('.editor-toolbar')!
  toolbar.insertBefore(backToNotesBtn, toolbar.firstChild)
  backToNotesBtn.addEventListener('click', () => setMobilePane('list', { moveFocus: true }))

  // Navigate on every tap, including re-taps of the already-selected item.
  folderPane.onFolderSelect = () => setMobilePane('list', { moveFocus: true })
  noteList.onNoteSelect = () => setMobilePane('editor', { moveFocus: true })
  editorPane.onNoteDeleted = () => setMobilePane('list', { moveFocus: true })
  // ──────────────────────────────────────────────────────────

  activeEditorPane = editorPane
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
      const noteId = state.selectedNoteId
      await editorPane.flushPendingSave()
      // A later dispatch (e.g. createNote's NOTES_LOADED followed immediately
      // by NOTE_SELECTED) may have already resolved selectedNoteId to
      // something else while this async continuation was suspended on the
      // await above — re-check against fresh state before acting on the
      // stale snapshot captured at the top of this callback.
      if (getState().selectedNoteId === noteId) await editorPane.loadNote(noteId)
    } else if (state.selectedNoteId === null && editorPane.currentNoteId !== null) {
      await editorPane.flushPendingSave()
      if (getState().selectedNoteId === null) editorPane.clearNote()
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
  void activeEditorPane?.destroy()
  activeEditorPane = null
}

export async function loadFolders(): Promise<void> {
  const store = getState().store
  if (!store) return
  const all = await store.list()
  const folders = all.filter((m) => m['type'] === 'folder') as ReturnType<typeof getState>['folders']
  dispatch({ type: 'FOLDERS_LOADED', folders })
}

export async function loadNotes(folderId: string | null): Promise<void> {
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
