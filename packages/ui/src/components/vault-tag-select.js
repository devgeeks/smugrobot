import { TOKEN_BRIDGE } from "./token-bridge.js";

class VaultTagSelectOption extends HTMLElement {
  static observedAttributes = ["value"];

  connectedCallback() {
    this.style.display = "none";
  }

  get value() {
    return this.getAttribute("value") ?? "";
  }
  set value(v) {
    this.setAttribute("value", v);
  }
}

class VaultTagSelect extends HTMLElement {
  static observedAttributes = ["label", "aria-label", "hint", "disabled"];

  // `value` is a real getter/setter only (an array), not an attribute — see
  // the class comment. #selected holds every currently-selected tag; #custom
  // holds the subset of #selected that isn't backed by a preset option, so it
  // renders removable and survives even if it's later set via the property.
  #selected = new Set();
  #custom = new Set();
  #observer = null;

  connectedCallback() {
    if (!this.shadowRoot) this.#render();
    this.#watchOptions();
  }

  disconnectedCallback() {
    this.#observer?.disconnect();
  }

  attributeChangedCallback() {
    if (this.shadowRoot) this.#render();
  }

  get value() {
    return [...this.#selected];
  }

  set value(v) {
    const values = Array.isArray(v) ? v : [];
    const presetValues = new Set(this.#presets().map((o) => o.value));
    this.#selected = new Set(values);
    this.#custom = new Set(values.filter((val) => !presetValues.has(val)));
    if (this.shadowRoot) this.#render();
  }

  #presets() {
    return [...this.querySelectorAll("vault-tag-select-option")].map((el) => ({
      value: el.value,
      label: el.textContent.trim() || el.value,
    }));
  }

  #watchOptions() {
    this.#observer = new MutationObserver(() => {
      if (this.shadowRoot) this.#render();
    });
    this.#observer.observe(this, { childList: true });
  }

  #emitChange() {
    this.dispatchEvent(
      new CustomEvent("vault-change", {
        detail: { value: [...this.#selected] },
        bubbles: true,
        composed: true,
      }),
    );
  }

  #togglePreset(value) {
    if (this.#selected.has(value)) {
      this.#selected.delete(value);
    } else {
      this.#selected.add(value);
    }
    this.#render();
    this.#emitChange();
  }

  #removeCustom(value) {
    this.#selected.delete(value);
    this.#custom.delete(value);
    this.#render();
    this.#emitChange();
  }

  #addCustom(raw) {
    const label = raw.trim();
    if (!label) return;
    const presetMatch = this.#presets().find((o) => o.value.toLowerCase() === label.toLowerCase());
    const value = presetMatch ? presetMatch.value : label;
    if (!presetMatch) this.#custom.add(value);
    this.#selected.add(value);
    this.#render();
    this.#emitChange();
  }

  #render() {
    const label = this.getAttribute("label") || "";
    const ariaLabel = this.getAttribute("aria-label") || "";
    const hint = this.getAttribute("hint") || "";
    const disabled = this.hasAttribute("disabled");
    const uid = `vts-${Math.random().toString(36).slice(2)}`;

    const presets = this.#presets();
    const customOnly = [...this.#custom].filter((v) => !presets.some((p) => p.value === v));

    if (!this.shadowRoot) this.attachShadow({ mode: "open" });

    this.shadowRoot.innerHTML =
      TOKEN_BRIDGE +
      `
      <style>
        :host { display: block; }
        .field { display: flex; flex-direction: column; gap: var(--sp-2); }
        label {
          font-family: var(--font-mono);
          font-size: var(--text-xs);
          font-weight: 500;
          letter-spacing: 0.08em;
          color: var(--text-secondary);
        }
        .chips {
          display: flex;
          flex-wrap: wrap;
          gap: var(--sp-2);
        }
        .chip {
          display: inline-flex;
          align-items: center;
          gap: var(--sp-1);
          font-family: var(--font-body);
          font-size: var(--text-sm);
          padding: var(--sp-2) var(--sp-3);
          min-height: var(--sp-10);
          border-radius: var(--radius-full);
          border: 1.5px solid var(--surface-border);
          background: var(--surface-overlay);
          color: var(--text-primary);
          cursor: ${disabled ? "not-allowed" : "pointer"};
          transition:
            background var(--duration-fast) var(--ease-out),
            border-color var(--duration-fast) var(--ease-out),
            color var(--duration-fast) var(--ease-out);
        }
        .chip[aria-pressed="true"] {
          border-color: var(--cipher);
          background: color-mix(in srgb, var(--cipher) 16%, var(--surface-overlay));
          color: var(--cipher-text);
        }
        .chip:focus-visible {
          outline: none;
          box-shadow: var(--focus-ring);
        }
        .chip:disabled { opacity: 0.5; }
        .chip-remove {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: var(--sp-4);
          height: var(--sp-4);
          border-radius: var(--radius-full);
          border: none;
          background: transparent;
          color: inherit;
          font-size: var(--text-base);
          line-height: 1;
          cursor: pointer;
          padding: 0;
        }
        .chip-remove:focus-visible {
          outline: none;
          box-shadow: var(--focus-ring);
        }
        .add-row {
          display: flex;
          gap: var(--sp-2);
        }
        .add-input {
          flex: 1;
          min-width: 0;
          min-height: var(--sp-10);
          background: var(--surface-overlay);
          border: 1.5px solid var(--surface-border);
          border-radius: var(--radius-md);
          padding: var(--sp-2) var(--sp-3);
          font-family: var(--font-body);
          font-size: var(--text-base);
          color: var(--text-primary);
        }
        .add-input::placeholder { color: var(--text-muted); }
        .add-input:focus-visible {
          outline: none;
          border-color: var(--cipher);
          box-shadow: 0 0 0 2px color-mix(in srgb, var(--cipher) 15%, transparent);
        }
        .add-btn {
          font-family: var(--font-mono);
          font-size: var(--text-sm);
          font-weight: 500;
          padding: 0 var(--sp-4);
          min-height: var(--sp-10);
          border-radius: var(--radius-md);
          border: 1.5px solid var(--surface-border);
          background: var(--surface-raised);
          color: var(--text-primary);
          cursor: pointer;
          transition: border-color var(--duration-fast) var(--ease-out);
        }
        .add-btn:hover { border-color: var(--ink-400); }
        .add-btn:focus-visible {
          outline: none;
          box-shadow: var(--focus-ring);
        }
        .hint-text {
          font-family: var(--font-body);
          font-size: var(--text-xs);
          color: var(--text-muted);
        }
      </style>
      <div class="field">
        ${label ? `<label id="${uid}-label">${label}</label>` : ""}
        <div
          class="chips"
          role="group"
          ${label ? `aria-labelledby="${uid}-label"` : ariaLabel ? `aria-label="${ariaLabel.replace(/"/g, "&quot;")}"` : ""}
        >
          ${presets
            .map(
              (opt) => `
            <button
              type="button"
              class="chip"
              data-kind="preset"
              data-value="${opt.value.replace(/"/g, "&quot;")}"
              aria-pressed="${this.#selected.has(opt.value)}"
              ${disabled ? "disabled" : ""}
            >${opt.label}</button>
          `,
            )
            .join("")}
          ${customOnly
            .map(
              (value) => `
            <span class="chip" data-kind="custom" aria-pressed="true">
              ${value}
              <button
                type="button"
                class="chip-remove"
                data-remove="${value.replace(/"/g, "&quot;")}"
                aria-label="Remove ${value.replace(/"/g, "&quot;")}"
                ${disabled ? "disabled" : ""}
              >×</button>
            </span>
          `,
            )
            .join("")}
        </div>
        <div class="add-row">
          <input
            type="text"
            class="add-input"
            placeholder="Add a tag"
            aria-label="Add a custom tag"
            ${disabled ? "disabled" : ""}
          />
          <button type="button" class="add-btn" ${disabled ? "disabled" : ""}>Add</button>
        </div>
        ${hint ? `<span class="hint-text">${hint}</span>` : ""}
      </div>
    `;

    if (!label && !ariaLabel) {
      console.warn(
        "[vault-tag-select] Missing accessible name — set a `label` or `aria-label` attribute.",
      );
    }

    if (disabled) return;

    for (const btn of this.shadowRoot.querySelectorAll('.chip[data-kind="preset"]')) {
      btn.addEventListener("click", () => this.#togglePreset(btn.dataset.value));
    }
    for (const btn of this.shadowRoot.querySelectorAll(".chip-remove")) {
      btn.addEventListener("click", () => this.#removeCustom(btn.dataset.remove));
    }

    const input = this.shadowRoot.querySelector(".add-input");
    const addBtn = this.shadowRoot.querySelector(".add-btn");
    const commit = () => {
      this.#addCustom(input.value);
      input.value = "";
      input.focus();
    };
    addBtn.addEventListener("click", commit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commit();
      }
    });
  }
}

customElements.define("vault-tag-select-option", VaultTagSelectOption);
customElements.define("vault-tag-select", VaultTagSelect);

export { VaultTagSelect, VaultTagSelectOption };
