import escapeHtml from "escape-html";

/** vault-button/vault-input's native control lives in shadow DOM; the host isn't focusable directly. */
function focusVaultButton(el: Element): void {
  (el as HTMLElement & { shadowRoot: ShadowRoot | null }).shadowRoot
    ?.querySelector("button")
    ?.focus();
}

function focusVaultInput(el: Element): void {
  (el as HTMLElement & { shadowRoot: ShadowRoot | null }).shadowRoot
    ?.querySelector("input")
    ?.focus();
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
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

/** A11y-correct single-field text prompt. Resolves the trimmed value, or null on cancel/Escape/backdrop/empty. */
export function promptDialog(opts: {
  title: string;
  label: string;
  initialValue?: string;
  confirmLabel: string;
  cancelLabel?: string;
}): Promise<string | null> {
  return new Promise((resolve) => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const titleId = "dialog-title-" + Math.random().toString(36).slice(2);
    const bodyHtml = `<vault-input label="${escapeAttr(opts.label)}" value="${escapeAttr(opts.initialValue ?? "")}"></vault-input>`;
    const overlay = createOverlay(
      titleId,
      opts.title,
      bodyHtml,
      opts.confirmLabel,
      opts.cancelLabel ?? "Cancel",
      false,
    );
    document.body.appendChild(overlay);

    const input = overlay.querySelector("vault-input") as HTMLElement & { value: string };
    focusVaultInput(input);

    const finish = (result: string | null) => {
      document.removeEventListener("keydown", onKey);
      overlay.remove();
      previouslyFocused?.focus();
      resolve(result);
    };

    overlay.querySelector(".dialog-cancel")!.addEventListener("click", () => finish(null));
    overlay.querySelector(".dialog-confirm")!.addEventListener("click", () => {
      // Read directly from the input element to avoid stale closure variable
      finish(input.value.trim() || null);
    });
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) finish(null);
    });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish(null);
      if (e.key === "Enter") finish(input.value.trim() || null);
    };
    document.addEventListener("keydown", onKey);
  });
}
