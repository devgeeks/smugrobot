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
      await editorPane.loadNote(state.selectedNoteId)
    } else if (state.selectedNoteId === null && editorPane.currentNoteId !== null) {
      editorPane.clearNote()
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
      (m) => m['type'] === 'note' && ((m['folderId'] ?? null) === folderId)
    ) as NoteMeta[]
  ).sort((a, b) => b.updatedAt - a.updatedAt)
  dispatch({ type: 'NOTES_LOADED', notes })
}
