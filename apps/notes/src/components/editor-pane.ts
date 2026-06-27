import { Editor, rootCtx, defaultValueCtx } from '@milkdown/core'
import { commonmark } from '@milkdown/preset-commonmark'
import { listener, listenerCtx } from '@milkdown/plugin-listener'
import { clipboard } from '@milkdown/plugin-clipboard'
import { getMarkdown, replaceAll } from '@milkdown/utils'
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
  currentNoteId: string | null = null
  private lockBtn!: HTMLElement
  private spinner!: HTMLElement
  private milkdownHost!: HTMLElement

  constructor() {
    this.el = document.createElement('div')
    this.el.className = 'editor-pane'
    this.el.innerHTML = `
      <div class="editor-toolbar">
        <div class="toolbar-right">
          <vault-spinner size="md" class="save-spinner" label="Saving" style="display:none"></vault-spinner>
          <vault-button variant="secondary" size="md" class="lock-btn">Lock</vault-button>
        </div>
      </div>
      <div class="milkdown-host"></div>
    `

    this.lockBtn = this.el.querySelector('.lock-btn')!
    this.spinner = this.el.querySelector('.save-spinner')!
    this.milkdownHost = this.el.querySelector('.milkdown-host')!

    this.lockBtn.addEventListener('click', () => this.lock())
  }

  async mount(): Promise<void> {
    this.editor = await Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, this.milkdownHost)
        ctx.set(defaultValueCtx, '')
        ctx.get(listenerCtx).markdownUpdated((_ctx, markdown) => {
          this.pendingMarkdown = markdown
          this.scheduleAutoSave(markdown)
        })
      })
      .use(commonmark)
      .use(listener)
      .use(clipboard)
      .create()
  }

  render(state: AppState): void {
    this.spinner.style.display = state.isSaving ? 'inline-flex' : 'none'
  }

  async loadNote(noteId: string): Promise<void> {
    const store = getState().store
    if (!store) return
    this.currentNoteId = noteId
    const content = await store.get(noteId)
    const md = content ?? ''
    this.pendingMarkdown = md
    this.editor?.action(replaceAll(md))
  }

  clearNote(): void {
    this.currentNoteId = null
    this.pendingMarkdown = ''
    this.editor?.action(replaceAll(''))
  }

  private scheduleAutoSave(markdown: string): void {
    if (!this.currentNoteId) return
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
    const meta = await state.store.set(noteId, markdown, {
      title,
      type: 'note',
      folderId: state.selectedFolderId,
    })
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
    await this.flushPendingSave()
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
