import { $prose } from "@milkdown/utils";
import { Plugin, PluginKey } from "@milkdown/prose/state";
import type { EditorView } from "@milkdown/prose/view";
import { sanitizeHref } from "./url.js";

const key = new PluginKey("link-tooltip");

function findLinkMark(view: EditorView): { href: string; from: number; to: number } | null {
  const { state } = view;
  const { from, to } = state.selection;
  const linkType = state.schema.marks["link"];
  if (!linkType) return null;

  let result: { href: string; from: number; to: number } | null = null;

  state.doc.nodesBetween(
    Math.max(0, from - 1),
    Math.min(to + 1, state.doc.content.size),
    (node, pos) => {
      if (result) return false;
      const mark = node.marks.find((m) => m.type === linkType);
      if (!mark) return;
      result = { href: mark.attrs["href"] as string, from: pos, to: pos + node.nodeSize };
    },
  );

  return result;
}

export const linkTooltip = $prose(() => {
  let tooltip: HTMLDivElement | null = null;
  let input: HTMLInputElement | null = null;
  let currentHref = "";
  let linkRange: { from: number; to: number } | null = null;

  function getTooltip(): HTMLDivElement {
    if (tooltip) return tooltip;
    tooltip = document.createElement("div");
    tooltip.className = "link-tooltip";
    tooltip.style.display = "none";

    input = document.createElement("input");
    input.type = "url";
    input.className = "link-tooltip-input";
    input.placeholder = "https://";

    tooltip.appendChild(input);
    document.body.appendChild(tooltip);
    return tooltip;
  }

  function show(view: EditorView, href: string, from: number, to: number, selectAll = false): void {
    const t = getTooltip();
    currentHref = href;
    linkRange = { from, to };
    input!.value = href;
    input!.classList.remove("link-tooltip-input-error");

    const coords = view.coordsAtPos(from);
    t.style.display = "flex";
    t.style.top = `${coords.bottom + 6}px`;
    t.style.left = `${coords.left}px`;

    if (selectAll) {
      input!.focus();
      input!.select();
    } else {
      input!.focus();
    }
  }

  function hide(): void {
    if (tooltip) tooltip.style.display = "none";
    linkRange = null;
    currentHref = "";
  }

  function commit(view: EditorView): void {
    if (!linkRange) return;
    const newHref = input!.value.trim();
    const { state } = view;
    const linkType = state.schema.marks["link"];
    if (!linkType) {
      hide();
      return;
    }

    if (!newHref) {
      // Remove the link mark if URL cleared
      const tr = state.tr.removeMark(linkRange.from, linkRange.to, linkType);
      view.dispatch(tr);
    } else {
      const safeHref = sanitizeHref(newHref);
      if (!safeHref) {
        input!.classList.add("link-tooltip-input-error");
        return;
      }
      if (safeHref !== currentHref) {
        const tr = state.tr
          .removeMark(linkRange.from, linkRange.to, linkType)
          .addMark(linkRange.from, linkRange.to, linkType.create({ href: safeHref }));
        view.dispatch(tr);
      }
    }
    hide();
    view.focus();
  }

  return new Plugin({
    key,

    appendTransaction(transactions, _oldState, newState) {
      if (!transactions.some((tr) => tr.docChanged)) return null;

      const linkType = newState.schema.marks["link"];
      if (!linkType) return null;

      let tr: typeof newState.tr | null = null;
      newState.doc.descendants((node, pos) => {
        const mark = node.marks.find((m) => m.type === linkType);
        if (!mark) return;
        const href = mark.attrs["href"] as string;
        if (sanitizeHref(href)) return;
        tr = (tr ?? newState.tr).removeMark(pos, pos + node.nodeSize, linkType);
      });
      return tr;
    },

    props: {
      handleKeyDown(view, event) {
        if (!(event.metaKey || event.ctrlKey) || event.key !== "k") return false;
        event.preventDefault();

        const { state } = view;
        const { from, to, empty } = state.selection;
        const linkType = state.schema.marks["link"];
        if (!linkType) return true;

        if (!empty && state.doc.rangeHasMark(from, to, linkType)) {
          // Toggle off: remove link from selection
          hide();
          view.dispatch(state.tr.removeMark(from, to, linkType));
        } else {
          const existing = findLinkMark(view);
          if (existing) {
            // Edit existing link (cursor inside, no selection)
            show(view, existing.href, existing.from, existing.to, true);
          } else if (!empty) {
            // Wrap selection in a new link, then focus URL input
            const tr = state.tr.addMark(from, to, linkType.create({ href: "" }));
            view.dispatch(tr);
            setTimeout(() => show(view, "", from, to, true), 0);
          }
        }
        return true;
      },
    },

    view(editorView) {
      const t = getTooltip();

      const handleKeydown = (e: KeyboardEvent) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit(editorView);
        }
        if (e.key === "Escape") {
          hide();
          editorView.focus();
        }
      };

      const handleFocusout = () => {
        setTimeout(() => {
          if (!t.contains(document.activeElement)) hide();
        }, 150);
      };

      t.addEventListener("keydown", handleKeydown);
      t.addEventListener("focusout", handleFocusout);

      return {
        update(view) {
          // Don't override an actively-focused tooltip
          if (t.contains(document.activeElement)) return;

          // Only auto-show for a collapsed cursor inside the link; a range
          // selection spanning into/across a link should remain selectable.
          if (!view.state.selection.empty) {
            hide();
            return;
          }

          const link = findLinkMark(view);
          if (link) {
            if (link.href !== currentHref || t.style.display === "none") {
              show(view, link.href, link.from, link.to);
            }
          } else {
            hide();
          }
        },
        destroy() {
          t.removeEventListener("keydown", handleKeydown);
          t.removeEventListener("focusout", handleFocusout);
          tooltip?.remove();
          tooltip = null;
          input = null;
        },
      };
    },
  });
});
