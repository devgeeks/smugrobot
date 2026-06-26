import { Editor, rootCtx, defaultValueCtx } from '@milkdown/core'
import { commonmark } from '@milkdown/preset-commonmark'
import { listener, listenerCtx } from '@milkdown/plugin-listener'
import { getMarkdown, replaceAll } from '@milkdown/utils'
import type { AppState } from '../state/types.js'
import { dispatch, getState } from '../state/store.js'
import { deriveTitleFromMarkdown } from '../utils/markdown.js'
import type { NoteMeta } from '../state/types.js'

export class EditorPane {
  el: HTMLElement
  private editor: Editor | null = null
  private saveTimer: ReturnType<typeof setTimeout> | null = null
  private pendingMarkdown = ''
  currentNoteId: string | null = null
  onPreviewReady: ((noteId: string, content: string) => void) | null = null

  private newNoteBtn!: HTMLElement
  private lockBtn!: HTMLElement
  private spinner!: HTMLElement
  private milkdownHost!: HTMLElement

  constructor() {
    this.el = document.createElement('div')
    this.el.className = 'editor-pane'
    this.el.innerHTML = `
      <div class="editor-toolbar">
        <vault-button variant="primary" size="sm" class="new-note-btn">New Note</vault-button>
        <vault-button variant="secondary" size="sm" class="lock-btn">Lock</vault-button>
        <vault-spinner size="sm" class="save-spinner" label="Saving" style="display:none"></vault-spinner>
      </div>
      <div class="milkdown-host"></div>
    `

    this.newNoteBtn = this.el.querySelector('.new-note-btn')!
    this.lockBtn = this.el.querySelector('.lock-btn')!
    this.spinner = this.el.querySelector('.save-spinner')!
    this.milkdownHost = this.el.querySelector('.milkdown-host')!

    this.newNoteBtn.addEventListener('click', () => this.createNote())
    this.lockBtn.addEventListener('click', async () => {
      await this.flushPendingSave()
      dispatch({ type: 'LOCKED' })
    })
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
    if (this.onPreviewReady) this.onPreviewReady(noteId, md)
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

  private async createNote(): Promise<void> {
    const state = getState()
    if (!state.store) return
    const id = 'note-' + crypto.randomUUID()
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
    dispatch({ type: 'NOTES_LOADED', notes })
    dispatch({ type: 'NOTE_SELECTED', noteId: id })
    this.currentNoteId = id
    this.pendingMarkdown = defaultContent
    this.editor?.action(replaceAll(defaultContent))
  }

  getCurrentMarkdown(): string {
    return this.editor?.action(getMarkdown()) ?? ''
  }
}
