import { Editor, rootCtx, editorViewOptionsCtx, defaultValueCtx, editorViewCtx } from '@milkdown/core'
import { commonmark } from '@milkdown/preset-commonmark'
import { gfm } from '@milkdown/preset-gfm'
import { listener, listenerCtx } from '@milkdown/plugin-listener'
import { clipboard } from '@milkdown/plugin-clipboard'
import { getMarkdown, replaceAll } from '@milkdown/utils'
import { linkTooltip } from '../utils/link-tooltip.js'
import type { AppState } from '../state/types.js'
import { dispatch, getState } from '../state/store.js'
import { deriveTitleFromMarkdown } from '../utils/markdown.js'
import { showToast } from '../utils/toast.js'
import type { NoteMeta } from '../state/types.js'

export class EditorPane {
  el: HTMLElement
  private editor: Editor | null = null
  private saveTimer: ReturnType<typeof setTimeout> | null = null
  private pendingMarkdown = ''
  private lastSavedMarkdown = ''
  currentNoteId: string | null = null
  private lockBtn!: HTMLElement
  private spinner!: HTMLElement
  private milkdownHost!: HTMLElement
  private noteMenu!: HTMLElement & { close(): void }

  constructor() {
    this.el = document.createElement('div')
    this.el.className = 'editor-pane'
    this.el.innerHTML = `
      <div class="editor-toolbar">
        <div class="toolbar-right">
          <vault-spinner size="md" class="save-spinner" label="Saving…" hidden></vault-spinner>
          <vault-popover placement="bottom-end" class="note-menu" style="display: none">
            <vault-button slot="trigger" variant="ghost" size="md" class="note-menu-btn" aria-label="Note options">⋮</vault-button>
            <div class="note-menu-panel">
              <button class="menu-item" data-action="copy">Copy text</button>
              <button class="menu-item menu-item--danger" data-action="delete">Delete</button>
            </div>
          </vault-popover>
          <vault-button variant="secondary" size="md" class="lock-btn">Lock</vault-button>
        </div>
      </div>
      <div class="milkdown-host"></div>
    `

    this.lockBtn = this.el.querySelector('.lock-btn')!
    this.spinner = this.el.querySelector('.save-spinner')!
    this.milkdownHost = this.el.querySelector('.milkdown-host')!
    this.noteMenu = this.el.querySelector('.note-menu')!

    this.lockBtn.addEventListener('click', () => this.lock())
    this.noteMenu.addEventListener('click', (e) => e.stopPropagation())

    this.noteMenu.querySelector('[data-action="copy"]')!.addEventListener('click', () => {
      this.noteMenu.close()
      const content = this.getCurrentMarkdown()
      if (content) navigator.clipboard.writeText(content)
    })

    this.noteMenu.querySelector('[data-action="delete"]')!.addEventListener('click', () => {
      this.noteMenu.close()
      const note = getState().notes.find((n) => n.id === this.currentNoteId)
      if (note) confirmDeleteNote(note)
    })
  }

  async mount(): Promise<void> {
    this.editor = await Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, this.milkdownHost)
        ctx.set(editorViewOptionsCtx, { attributes: { 'aria-label': 'Note content' } })
        ctx.set(defaultValueCtx, '')
        ctx.get(listenerCtx).markdownUpdated((_ctx, markdown) => {
          this.pendingMarkdown = markdown
          this.scheduleAutoSave(markdown)
        })
      })
      .use(commonmark)
      .use(gfm)
      .use(listener)
      .use(clipboard)
      .use(linkTooltip)
      .create()

    this.milkdownHost.addEventListener('click', (e) => {
      const li = (e.target as Element).closest('li[data-item-type="task"]')
      if (!li) return
      const liRect = li.getBoundingClientRect()
      // Only toggle when click lands in the ::before checkbox area (16px + 8px gap)
      if (e.clientX - liRect.left > 24) return
      this.editor?.action((ctx) => {
        const view = ctx.get(editorViewCtx)
        const pos = view.posAtDOM(li, 0)
        const $pos = view.state.doc.resolve(pos)
        let depth = $pos.depth
        while (depth > 0 && $pos.node(depth).type.name !== 'list_item') depth--
        const listItemNode = $pos.node(depth)
        const listItemPos = $pos.before(depth)
        const tr = view.state.tr.setNodeMarkup(listItemPos, undefined, {
          ...listItemNode.attrs,
          checked: !listItemNode.attrs.checked,
        })
        view.dispatch(tr)
      })
    })
  }

  render(state: AppState): void {
    this.spinner.style.display = state.isSaving ? '' : 'none'
    this.noteMenu.style.display = state.selectedNoteId === null ? 'none' : ''
  }

  async loadNote(noteId: string): Promise<void> {
    const store = getState().store
    if (!store) return
    this.currentNoteId = noteId
    const content = await store.get(noteId)
    const md = content ?? ''
    this.pendingMarkdown = md
    this.lastSavedMarkdown = md
    this.editor?.action(replaceAll(md))
  }

  clearNote(): void {
    this.currentNoteId = null
    this.pendingMarkdown = ''
    this.editor?.action(replaceAll(''))
  }

  private scheduleAutoSave(markdown: string): void {
    if (!this.currentNoteId || markdown === this.lastSavedMarkdown) return
    if (this.saveTimer) clearTimeout(this.saveTimer)
    dispatch({ type: 'NOTE_SAVE_START' })
    this.saveTimer = setTimeout(() => this.doSave(markdown), 800)
  }

  private async doSave(markdown: string): Promise<void> {
    const noteId = this.currentNoteId
    if (!noteId) return
    const state = getState()
    if (!state.store) return
    const title = deriveTitleFromMarkdown(markdown)
    const existingMeta = await state.store.getMeta(noteId)
    const meta = await state.store.set(noteId, markdown, {
      title,
      type: 'note',
      folderId: existingMeta ? (existingMeta['folderId'] ?? null) : state.selectedFolderId,
    })
    this.lastSavedMarkdown = markdown
    dispatch({ type: 'NOTE_SAVE_DONE', meta: meta as NoteMeta })
  }

  async flushPendingSave(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
      this.saveTimer = null
      await this.doSave(this.pendingMarkdown)
    }
  }

  async lock(): Promise<void> {
    this.lockBtn.setAttribute('loading', '')
    await this.flushPendingSave()
    this.lockBtn.removeAttribute('loading')
    showToast('Vault locked.', 'success')
    dispatch({ type: 'LOCKED' })
  }

  async createNote(): Promise<void> {
    const state = getState()
    if (!state.store) return
    const id = 'note-' + Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('')
    const defaultContent = '# Untitled\n\n'
    await state.store.set(id, defaultContent, {
      title: 'Untitled',
      type: 'note',
      folderId: state.selectedFolderId,
    })
    // reload notes then select the new one
    const all = await state.store.list()
    const notes = (all.filter(
      (m) => m['type'] === 'note' && ((m['folderId'] ?? null) === state.selectedFolderId)
    ) as NoteMeta[]).sort((a, b) => b.updatedAt - a.updatedAt)
    const noteCounts = getState().noteCounts
    const key = (state.selectedFolderId ?? '') as string
    const updatedCounts = { ...noteCounts, [key]: notes.length }
    this.currentNoteId = id
    this.pendingMarkdown = defaultContent
    dispatch({ type: 'NOTES_LOADED', notes, noteCounts: updatedCounts })
    dispatch({ type: 'NOTE_SELECTED', noteId: id })
    this.editor?.action(replaceAll(defaultContent))
  }

  getCurrentMarkdown(): string {
    return this.editor?.action(getMarkdown()) ?? ''
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
