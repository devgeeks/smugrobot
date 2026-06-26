import type { AppState, NoteMeta } from '../state/types.js'
import { dispatch, getState } from '../state/store.js'
import { formatRelativeTime } from '../utils/time.js'
import { previewFromMarkdown } from '../utils/markdown.js'

export class NoteList {
  el: HTMLElement
  private prevNotes: NoteMeta[] = []
  private prevSelected: string | null = null
  private previewCache = new Map<string, string>()

  constructor() {
    this.el = document.createElement('div')
    this.el.className = 'note-list'
    this.el.innerHTML = `<div class="note-list-inner"></div>`
  }

  cachePreview(noteId: string, content: string): void {
    this.previewCache.set(noteId, previewFromMarkdown(content))
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

    const preview = this.previewCache.get(note.id) ?? ''

    row.innerHTML = `
      <div class="note-row-main">
        <div class="note-title">${escapeHtml(note.title)}</div>
        <div class="note-preview">${escapeHtml(preview)}</div>
        <div class="note-meta">
          <span class="note-time" data-ts="${note.updatedAt}">${formatRelativeTime(note.updatedAt)}</span>
        </div>
      </div>
      <button class="note-menu-btn" aria-label="Note options" title="Options">⋮</button>
    `

    row.querySelector('.note-row-main')!.addEventListener('click', () => {
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
    document.querySelector('.note-menu-popover')?.remove()

    const popover = document.createElement('div')
    popover.className = 'note-menu-popover'
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

    popover.querySelector('[data-action="delete"]')!.addEventListener('click', async () => {
      popover.remove()
      const store = getState().store
      if (!store) return
      await store.delete(note.id)
      this.previewCache.delete(note.id)
      dispatch({ type: 'NOTE_DELETED', noteId: note.id })
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

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
