import { TOKEN_BRIDGE } from "./token-bridge.js";

class VaultInput extends HTMLElement {
  static observedAttributes = [
    "label",
    "aria-label",
    "type",
    "value",
    "error",
    "hint",
    "prefix-icon",
    "required",
    "disabled",
    "readonly",
  ];

  connectedCallback() {
    if (!this.shadowRoot) this.#render();
  }

  attributeChangedCallback(name, _oldVal, newVal) {
    if (!this.shadowRoot) return;
    const input = this.shadowRoot.querySelector("input");
    if (name === "value") {
      if (input && input.value !== newVal) input.value = newVal ?? "";
      return;
    }
    const hadFocus = input && this.shadowRoot.activeElement === input;
    const selStart = hadFocus ? input.selectionStart : null;
    const selEnd = hadFocus ? input.selectionEnd : null;
    this.#render();
    if (hadFocus) {
      const newInput = this.shadowRoot.querySelector("input");
      newInput.focus();
      try {
        newInput.setSelectionRange(selStart, selEnd);
      } catch {
        /* unsupported for this input type */
      }
    }
  }

  get value() {
    return this.shadowRoot?.querySelector("input")?.value ?? this.getAttribute("value") ?? "";
  }

  set value(v) {
    this.setAttribute("value", v);
    const input = this.shadowRoot?.querySelector("input");
    if (input) input.value = v;
  }

  #render() {
    const label = this.getAttribute("label") || "";
    const ariaLabel = this.getAttribute("aria-label") || "";
    const type = this.getAttribute("type") || "text";
    const value = this.getAttribute("value") || "";
    const error = this.getAttribute("error") || "";
    const hint = this.getAttribute("hint") || "";
    const prefixIcon = this.getAttribute("prefix-icon") || "";
    const required = this.hasAttribute("required");
    const disabled = this.hasAttribute("disabled");
    const readonly = this.hasAttribute("readonly");

    const uid = `vi-${Math.random().toString(36).slice(2)}`;

    if (!this.shadowRoot) this.attachShadow({ mode: "open" });

    this.shadowRoot.innerHTML =
      TOKEN_BRIDGE +
      `
      <style>
        :host { display: block; }
        .field { display: flex; flex-direction: column; gap: var(--sp-1); }
        label {
          font-family: var(--font-mono);
          font-size: var(--text-xs);
          font-weight: 500;
          letter-spacing: 0.08em;
          color: var(--text-secondary);
        }
        label .required { color: var(--danger-text); margin-left: var(--sp-1); }
        .wrap {
          display: flex;
          align-items: center;
          gap: 0;
          background: var(--surface-overlay);
          border: 1.5px solid ${error ? "var(--danger)" : "var(--surface-border)"};
          border-radius: var(--radius-md);
          transition: border-color var(--duration-normal) var(--ease-out), box-shadow var(--duration-normal) var(--ease-out);
        }
        .wrap:focus-within {
          border-color: ${error ? "var(--danger)" : "var(--cipher)"};
          box-shadow: ${error ? "0 0 0 2px color-mix(in srgb, var(--danger) 25%, transparent)" : "0 0 0 2px color-mix(in srgb, var(--cipher) 15%, transparent)"};
        }
        .prefix {
          padding: 0 var(--sp-2) 0 var(--sp-3);
          font-family: var(--font-mono);
          font-size: var(--text-sm);
          color: var(--text-muted);
          flex-shrink: 0;
          user-select: none;
        }
        input {
          flex: 1;
          min-width: 0;
          background: transparent;
          border: none;
          outline: none;
          font-family: var(--font-body);
          font-size: var(--text-base);
          color: var(--text-primary);
          padding: var(--sp-2) var(--sp-3);
          ${prefixIcon ? "padding-left: 0;" : ""}
        }
        input::placeholder { color: var(--text-muted); }
        input:disabled { opacity: 0.5; cursor: not-allowed; }
        .hint-text {
          font-family: var(--font-body);
          font-size: var(--text-xs);
          color: ${error ? "var(--danger-text)" : "var(--text-muted)"};
        }
      </style>
      <div class="field">
        ${label ? `<label for="${uid}">${label}${required ? '<span class="required" aria-hidden="true">*</span>' : ""}</label>` : ""}
        <div class="wrap">
          ${prefixIcon ? `<span class="prefix" aria-hidden="true">${prefixIcon}</span>` : ""}
          <input
            id="${uid}"
            type="${type}"
            value="${value.replace(/"/g, "&quot;")}"
            ${required ? "required" : ""}
            ${disabled ? "disabled" : ""}
            ${readonly ? "readonly" : ""}
            ${error ? `aria-invalid="true" aria-describedby="${uid}-hint"` : ""}
            ${!label && ariaLabel ? `aria-label="${ariaLabel.replace(/"/g, "&quot;")}"` : ""}
          />
        </div>
        ${error || hint ? `<span class="hint-text" id="${uid}-hint">${error || hint}</span>` : ""}
      </div>
    `;

    if (!label && !ariaLabel) {
      console.warn(
        "[vault-input] Missing accessible name — set a `label` or `aria-label` attribute.",
      );
    }

    const input = this.shadowRoot.querySelector("input");
    input.addEventListener("input", () => {
      this.dispatchEvent(
        new CustomEvent("vault-input", {
          detail: { value: input.value },
          bubbles: true,
          composed: true,
        }),
      );
    });
    input.addEventListener("change", () => {
      this.dispatchEvent(
        new CustomEvent("vault-change", {
          detail: { value: input.value },
          bubbles: true,
          composed: true,
        }),
      );
    });
  }
}

customElements.define("vault-input", VaultInput);

export { VaultInput };
