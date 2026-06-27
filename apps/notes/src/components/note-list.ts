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
      <div class="note-list-inner"></div>
    `
    this.el.querySelector('.new-note-btn')!.addEventListener('click', () => this.onNewNote?.())
  }

  render(state: AppState): void {
    if (
      state.notes === this.prevNotes &&
      state.selectedNoteId === this.prevSelected
    )
      return
    this.prevNotes = state.notes
    this.prevSelected = state.selectedNoteId
    this.renderList(state.notes, state.selectedNoteId)
  }

  refreshTimestamps(): void {
    this.el.querySelectorAll<HTMLElement>('.note-time').forEach((el) => {
      const ts = Number(el.dataset['ts'])
      if (ts) el.textContent = formatRelativeTime(ts)
    })
  }

  private renderList(notes: NoteMeta[], selectedId: string | null): void {
    const inner = this.el.querySelector('.note-list-inner')!
    inner.innerHTML = ''

    if (notes.length === 0) {
      inner.innerHTML = `<p class="note-list-empty">No notes yet</p>`
      return
    }

    for (const note of notes) {
      inner.appendChild(this.renderRow(note, selectedId))
    }
  }

  private renderRow(note: NoteMeta, selectedId: string | null): HTMLElement {
    const row = document.createElement('div')
    row.className = 'note-row' + (selectedId === note.id ? ' note-row--active' : '')
    row.dataset['id'] = note.id

    row.innerHTML = `
      <button type="button" class="note-row-main">
        <div class="note-title">${escapeHtml(note.title)}</div>
        <div class="note-meta">
          <span class="note-time" data-ts="${note.updatedAt}">${formatRelativeTime(note.updatedAt)}</span>
        </div>
      </button>
      <button class="note-menu-btn" aria-label="Note options" title="Options">⋮</button>
    `

    row.querySelector('.note-row-main')!.addEventListener('click', () => {
      this.onNoteSelect?.(note.id)
      dispatch({ type: 'NOTE_SELECTED', noteId: note.id })
    })

    const menuBtn = row.querySelector('.note-menu-btn')!
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      this.openMenu(note, menuBtn as HTMLElement)
    })

    return row
  }

  private openMenu(note: NoteMeta, anchor: HTMLElement): void {
    const existing = document.querySelector<HTMLElement>('.note-menu-popover')
    if (existing) {
      existing.remove()
      if (existing.dataset['noteId'] === note.id) return
    }

    const popover = document.createElement('div')
    popover.className = 'note-menu-popover'
    popover.dataset['noteId'] = note.id
    popover.innerHTML = `
      <button class="menu-item" data-action="copy">Copy text</button>
      <button class="menu-item menu-item--danger" data-action="delete">Delete</button>
    `

    const rect = anchor.getBoundingClientRect()
    popover.style.top = `${rect.bottom + 4}px`
    popover.style.left = `${rect.left - 120}px`
    document.body.appendChild(popover)

    popover.querySelector('[data-action="copy"]')!.addEventListener('click', async () => {
      popover.remove()
      const store = getState().store
      if (!store) return
      const content = await store.get(note.id)
      if (content) navigator.clipboard.writeText(content)
    })

    popover.querySelector('[data-action="delete"]')!.addEventListener('click', () => {
      popover.remove()
      confirmDeleteNote(note)
    })

    const close = (e: Event) => {
      if (!popover.contains(e.target as Node)) {
        popover.remove()
        document.removeEventListener('click', close)
      }
    }
    setTimeout(() => document.addEventListener('click', close), 0)
  }
}

function confirmDeleteNote(note: NoteMeta): void {
  const overlay = document.createElement('div')
  overlay.className = 'dialog-overlay'
  overlay.innerHTML = `
    <vault-card border elevated class="dialog-card">
      <p class="dialog-title">Delete note?</p>
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
