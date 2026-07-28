import escapeHtml from "escape-html";

/** vault-button's native control lives in shadow DOM; the host isn't focusable directly. */
function focusVaultButton(el: Element): void {
  (el as HTMLElement & { shadowRoot: ShadowRoot | null }).shadowRoot
    ?.querySelector("button")
    ?.focus();
}

function createOverlay(
  titleId: string,
  titleText: string,
  bodyHtml: string,
  confirmLabel: string,
  cancelLabel: string,
  danger: boolean,
): HTMLElement {
  const overlay = document.createElement("div");
  overlay.className = "dialog-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", titleId);
  overlay.innerHTML = `
    <vault-card border elevated class="dialog-card">
      <h2 class="dialog-title" id="${titleId}">${titleText}</h2>
      ${bodyHtml}
      <div class="dialog-actions">
        <vault-button variant="secondary" size="md" class="dialog-cancel">${cancelLabel}</vault-button>
        <vault-button variant="${danger ? "danger" : "primary"}" size="md" class="dialog-confirm">${confirmLabel}</vault-button>
      </div>
    </vault-card>
  `;
  return overlay;
}

/** A11y-correct yes/no confirmation dialog. Resolves true on confirm, false on cancel/Escape/backdrop click. */
export function confirmDialog(opts: {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
}): Promise<boolean> {
  return new Promise((resolve) => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const titleId = "dialog-title-" + Math.random().toString(36).slice(2);
    const overlay = createOverlay(
      titleId,
      opts.title,
      `<p class="dialog-body">${escapeHtml(opts.body)}</p>`,
      opts.confirmLabel,
      opts.cancelLabel ?? "Cancel",
      opts.danger ?? false,
    );
    document.body.appendChild(overlay);

    const cancelBtn = overlay.querySelector(".dialog-cancel")!;
    focusVaultButton(cancelBtn);

    const finish = (result: boolean) => {
      document.removeEventListener("keydown", onKey);
      overlay.remove();
      previouslyFocused?.focus();
      resolve(result);
    };

    cancelBtn.addEventListener("click", () => finish(false));
    overlay.querySelector(".dialog-confirm")!.addEventListener("click", () => finish(true));
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) finish(false);
    });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish(false);
    };
    document.addEventListener("keydown", onKey);
  });
}
