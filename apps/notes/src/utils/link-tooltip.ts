import { $prose } from '@milkdown/utils'
import { Plugin, PluginKey } from '@milkdown/prose/state'
import type { EditorView } from '@milkdown/prose/view'

const key = new PluginKey('link-tooltip')

function findLinkMark(
  view: EditorView
): { href: string; from: number; to: number } | null {
  const { state } = view
  const { from, to } = state.selection
  const linkType = state.schema.marks['link']
  if (!linkType) return null

  let result: { href: string; from: number; to: number } | null = null

  state.doc.nodesBetween(Math.max(0, from - 1), Math.min(to + 1, state.doc.content.size), (node, pos) => {
    if (result) return false
    const mark = node.marks.find((m) => m.type === linkType)
    if (!mark) return
    result = { href: mark.attrs['href'] as string, from: pos, to: pos + node.nodeSize }
  })

  return result
}

export const linkTooltip = $prose(() => {
  let popover: (HTMLElement & { close(): void }) | null = null
  let anchor: HTMLSpanElement | null = null
  let input: HTMLInputElement | null = null
  let currentHref = ''
  let linkRange: { from: number; to: number } | null = null

  function getPopover(): HTMLElement & { close(): void } {
    if (popover) return popover

    popover = document.createElement('vault-popover') as HTMLElement & { close(): void }
    popover.setAttribute('placement', 'bottom-start')

    anchor = document.createElement('span')
    anchor.setAttribute('slot', 'trigger')
    anchor.style.cssText = 'position:fixed;width:0;height:0;overflow:hidden;pointer-events:none;'

    const panel = document.createElement('div')
    panel.className = 'link-tooltip'

    input = document.createElement('input')
    input.type = 'url'
    input.className = 'link-tooltip-input'
    input.placeholder = 'https://'
    panel.appendChild(input)

    popover.appendChild(anchor)
    popover.appendChild(panel)
    document.body.appendChild(popover)
    return popover
  }

  function show(view: EditorView, href: string, from: number, to: number, selectAll = false): void {
    const p = getPopover()
    currentHref = href
    linkRange = { from, to }
    input!.value = href

    const coords = view.coordsAtPos(from)
    anchor!.style.top = `${coords.bottom}px`
    anchor!.style.left = `${coords.left}px`
    p.setAttribute('open', '')

    if (selectAll) {
      input!.focus()
      input!.select()
    }
    // Auto-show (selectAll=false) leaves focus in the editor so keyboard
    // navigation continues to work. Cmd+K explicitly requests focus.
  }

  function hide(): void {
    popover?.removeAttribute('open')
    linkRange = null
    currentHref = ''
  }

  function commit(view: EditorView): void {
    if (!linkRange) return
    const newHref = input!.value.trim()
    const { state } = view
    const linkType = state.schema.marks['link']
    if (!linkType) { hide(); return }

    if (!newHref) {
      // Remove the link mark if URL cleared
      const tr = state.tr.removeMark(linkRange.from, linkRange.to, linkType)
      view.dispatch(tr)
    } else if (newHref !== currentHref) {
      const tr = state.tr
        .removeMark(linkRange.from, linkRange.to, linkType)
        .addMark(linkRange.from, linkRange.to, linkType.create({ href: newHref }))
      view.dispatch(tr)
    }
    hide()
    view.focus()
  }

  return new Plugin({
    key,

    props: {
      handleKeyDown(view, event) {
        if (!(event.metaKey || event.ctrlKey) || event.key !== 'k') return false
        event.preventDefault()

        const { state } = view
        const { from, to, empty } = state.selection
        const linkType = state.schema.marks['link']
        if (!linkType) return true

        if (!empty && state.doc.rangeHasMark(from, to, linkType)) {
          // Toggle off: remove link from selection
          hide()
          view.dispatch(state.tr.removeMark(from, to, linkType))
        } else {
          const existing = findLinkMark(view)
          if (existing) {
            // Edit existing link (cursor inside, no selection)
            show(view, existing.href, existing.from, existing.to, true)
          } else if (!empty) {
            // Wrap selection in a new link, then focus URL input
            const tr = state.tr.addMark(from, to, linkType.create({ href: '' }))
            view.dispatch(tr)
            setTimeout(() => show(view, '', from, to, true), 0)
          }
        }
        return true
      },
    },

    view(editorView) {
      const p = getPopover()

      const handleKeydown = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          commit(editorView)
        }
        if (e.key === 'Escape') {
          hide()
          editorView.focus()
        }
      }

      // vault-close fires whenever the popover closes (Escape, outside click, or programmatic hide).
      // Don't call editorView.focus() here — that would re-trigger update() → show() → input.focus()
      // → blur → hide() → vault-close → editorView.focus() in a loop. Each close site handles
      // focus explicitly: commit() calls view.focus(), Escape is handled in handleKeydown above.
      const handleVaultClose = () => {
        linkRange = null
        currentHref = ''
      }

      p.addEventListener('keydown', handleKeydown)
      p.addEventListener('vault-close', handleVaultClose)

      return {
        update(view) {
          // Don't override an actively-focused input
          if (document.activeElement === input) return

          const link = findLinkMark(view)
          if (link) {
            if (link.href !== currentHref || !p.hasAttribute('open')) {
              show(view, link.href, link.from, link.to)
            }
          } else {
            hide()
          }
        },
        destroy() {
          p.removeEventListener('keydown', handleKeydown)
          p.removeEventListener('vault-close', handleVaultClose)
          popover?.remove()
          popover = null
          anchor = null
          input = null
        },
      }
    },
  })
})
