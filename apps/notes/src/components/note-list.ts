import type { AppState, NoteMeta } from '../state/types.js'
import { dispatch, getState } from '../state/store.js'
import { formatRelativeTime } from '../utils/time.js'
import { showToast } from '../utils/toast.js'

export class NoteList {
  el: HTMLElement
  onNoteSelect?: (noteId: string) => void
  onNewNote?: () => void
  private prevNotes: NoteMeta[] = []
  private prevSelected: string | null = null

  constructor() {
    this.el = document.createElement('div')
    this.el.className = 'note-list'
    this.el.innerHTML = `
      <div class="pane-header">
        <span class="pane-title">Notes</span>
        <vault-button variant="primary" size="md" class="new-note-btn">New note</vault-button>
      </div>
      <div class="note-list-inner">
        <vault-listbox selectable ghost></vault-listbox>
      </div>
    `
    this.el.querySelector('.new-note-btn')!.addEventListener('click', () => this.onNewNote?.())
    this.el.querySelector('vault-listbox')!.addEventListener('vault-change', (e: Event) => {
      const { value } = (e as CustomEvent<{ value: string }>).detail
      this.onNoteSelect?.(value)
      dispatch({ type: 'NOTE_SELECTED', noteId: value })
    })
  }

  render(state: AppState): void {
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

    option.innerHTML = `
      <div class="note-row-content">
        <div class="note-row-main">
          <div class="note-title">${escapeHtml(note.title)}</div>
          <div class="note-meta">
            <span class="note-time" data-ts="${note.updatedAt}">${formatRelativeTime(note.updatedAt)}</span>
          </div>
        </div>
        <vault-popover placement="bottom-end">
          <vault-button slot="trigger" variant="ghost" size="md" class="note-menu-btn" aria-label="Note options">⋮</vault-button>
          <div class="note-menu-panel">
            <button class="menu-item" data-action="copy">Copy text</button>
            <button class="menu-item menu-item--danger" data-action="delete">Delete</button>
          </div>
        </vault-popover>
      </div>
    `

    const popover = option.querySelector('vault-popover') as HTMLElement & { close(): void }
    popover.addEventListener('click', (e) => e.stopPropagation())

    option.querySelector('[data-action="copy"]')!.addEventListener('click', async () => {
      popover.close()
      const store = getState().store
      if (!store) return
      const content = await store.get(note.id)
      if (content) navigator.clipboard.writeText(content)
    })

    option.querySelector('[data-action="delete"]')!.addEventListener('click', () => {
      popover.close()
      confirmDeleteNote(note)
    })

    return option as HTMLElement
  }
}

function confirmDeleteNote(note: NoteMeta): void {
  const overlay = document.createElement('div')
  overlay.className = 'dialog-overlay'
  overlay.innerHTML = `
    <vault-card border elevated class="dialog-card">
      <h2 class="dialog-title">Delete note?</h2>
      <p class="dialog-body">"${escapeHtml(note.title)}" will be permanently deleted.</p>
      <div class="dialog-actions">
        <vault-button variant="secondary" size="md" class="dialog-cancel">Cancel</vault-button>
        <vault-button variant="danger" size="md" class="dialog-confirm">Delete</vault-button>
      </div>
    </vault-card>
  `
  document.body.appendChild(overlay)

  const close = () => overlay.remove()

  overlay.querySelector('.dialog-cancel')!.addEventListener('click', close)
  overlay.querySelector('.dialog-confirm')!.addEventListener('click', async () => {
    close()
    const store = getState().store
    if (!store) return
    await store.delete(note.id)
    dispatch({ type: 'NOTE_DELETED', noteId: note.id })
    showToast(`"${note.title}" was deleted.`, 'info')
  })

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close()
  })

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey) }
  }
  document.addEventListener('keydown', onKey)
}


function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
