import type { AppState, NoteMeta } from '../state/types.js'
import { dispatch } from '../state/store.js'
import { formatRelativeTime } from '../utils/time.js'

export class NoteList {
  el: HTMLElement
  onNoteSelect?: (noteId: string) => void
  onNewNote?: () => void
  private titleEl: HTMLElement
  private prevNotes: NoteMeta[] = []
  private prevSelected: string | null = null

  constructor() {
    this.el = document.createElement('div')
    this.el.className = 'note-list'
    this.el.innerHTML = `
      <div class="pane-header">
        <vault-button variant="primary" size="md" class="new-note-btn">New note</vault-button>
        <span class="pane-title">All notes</span>
      </div>
      <div class="note-list-inner">
        <vault-listbox selectable ghost aria-label="Notes"></vault-listbox>
      </div>
    `
    this.titleEl = this.el.querySelector('.pane-title')!
    this.el.querySelector('.new-note-btn')!.addEventListener('click', () => this.onNewNote?.())
    this.el.querySelector('vault-listbox')!.addEventListener('vault-change', (e: Event) => {
      const { value } = (e as CustomEvent<{ value: string }>).detail
      this.onNoteSelect?.(value)
      dispatch({ type: 'NOTE_SELECTED', noteId: value })
    })
  }

  render(state: AppState): void {
    this.titleEl.textContent =
      state.selectedFolderId === null
        ? 'All notes'
        : state.folders.find((f) => f.id === state.selectedFolderId)?.title ?? 'All notes'

    if (state.notes === this.prevNotes && state.selectedNoteId === this.prevSelected)
      return

    const listbox = this.el.querySelector('vault-listbox')! as HTMLElement

    if (state.notes !== this.prevNotes) {
      this.prevNotes = state.notes
      this.renderList(state.notes, listbox)
    }

    this.prevSelected = state.selectedNoteId
    const onMobile = window.matchMedia('(max-width: 1024px)').matches
    listbox.setAttribute('value', onMobile ? '' : (state.selectedNoteId ?? ''))
  }

  refreshTimestamps(): void {
    this.el.querySelectorAll<HTMLElement>('.note-time').forEach((el) => {
      const ts = Number(el.dataset['ts'])
      if (ts) el.textContent = formatRelativeTime(ts)
    })
  }

  private renderList(notes: NoteMeta[], listbox: Element): void {
    listbox.innerHTML = ''

    if (notes.length === 0) {
      listbox.innerHTML = `<p class="note-list-empty">No notes yet</p>`
      return
    }

    for (const note of notes) {
      listbox.appendChild(this.renderRow(note))
    }
  }

  private renderRow(note: NoteMeta): HTMLElement {
    const option = document.createElement('vault-listbox-option')
    option.setAttribute('value', note.id)

    const content = document.createElement('div')
    content.className = 'note-row-content'

    const main = document.createElement('div')
    main.className = 'note-row-main'

    const title = document.createElement('div')
    title.className = 'note-title'
    title.textContent = note.title

    const meta = document.createElement('div')
    meta.className = 'note-meta'

    const time = document.createElement('span')
    time.className = 'note-time'
    time.dataset['ts'] = String(note.updatedAt)
    time.textContent = formatRelativeTime(note.updatedAt)

    meta.appendChild(time)
    main.appendChild(title)
    main.appendChild(meta)
    content.appendChild(main)
    option.appendChild(content)

    return option as HTMLElement
  }
}

