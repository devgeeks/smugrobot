import { TOKEN_BRIDGE } from "./token-bridge.js";

let _optionId = 0;

class VaultListboxOption extends HTMLElement {
  static observedAttributes = ["value", "selected", "disabled", "active"];

  connectedCallback() {
    if (!this.id) this.id = `vlo-${++_optionId}`;
    this.setAttribute("role", "option");
    this.#syncAria();
    if (!this.shadowRoot) this.#render();
  }

  attributeChangedCallback() {
    this.#syncAria();
    if (!this.shadowRoot) this.#render(); // markup/styles are attribute-independent; :host([...]) selectors handle the rest
  }

  #syncAria() {
    this.setAttribute("aria-selected", this.hasAttribute("selected") ? "true" : "false");
    if (this.hasAttribute("disabled")) {
      this.setAttribute("aria-disabled", "true");
    } else {
      this.removeAttribute("aria-disabled");
    }
  }

  #render() {
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });

    this.shadowRoot.innerHTML =
      TOKEN_BRIDGE +
      `
      <style>
        :host {
          display: block;
          padding: var(--sp-3) var(--sp-4);
          padding-left: var(--sp-4);
          font-family: var(--font-body);
          font-size: var(--text-base);
          color: var(--text-primary);
          cursor: pointer;
          border-left: 2px solid transparent;
          transition:
            background    var(--duration-fast) var(--ease-out),
            border-color  var(--duration-fast) var(--ease-out),
            color         var(--duration-fast) var(--ease-out);
          user-select: none;
        }

        :host([disabled]) {
          opacity: 0.4;
          cursor: not-allowed;
          pointer-events: none;
        }

        :host(:not([disabled]):hover) {
          background: var(--surface-hover);
        }

        :host([active]) {
          background: var(--surface-hover);
          border-left-color: var(--cipher);
          padding-left: calc(var(--sp-4) - 2px);
        }

        :host([selected]) {
          color: var(--text-accent);
        }

        :host([selected]:not([active])) {
          border-left-color: var(--cipher);
          opacity: 0.75;
        }

        :host([selected][active]) {
          opacity: 1;
        }
      </style>
      <slot></slot>
    `;
  }
}

class VaultListbox extends HTMLElement {
  static observedAttributes = ["label", "value", "disabled", "selectable", "ghost"];

  #observer = null;

  #handleKeydown = (e) => {
    if (this.hasAttribute("disabled")) return;
    const opts = this.#enabledOptions();
    if (!opts.length) return;

    const active = this.#activeOption();
    const idx = active ? opts.indexOf(active) : -1;

    let next = null;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      next = opts[idx + 1] ?? opts[0];
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      next = idx > 0 ? opts[idx - 1] : opts[opts.length - 1];
    } else if (e.key === "Home") {
      e.preventDefault();
      next = opts[0];
    } else if (e.key === "End") {
      e.preventDefault();
      next = opts[opts.length - 1];
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (active) this.#select(active);
    }

    if (next) this.#setActive(next);
  };

  #handlePointerdown = (e) => {
    if (this.hasAttribute("disabled")) return;
    const opt = e.composedPath().find((el) => el.tagName?.toLowerCase() === "vault-listbox-option");
    if (opt && !opt.hasAttribute("disabled")) this.#setActive(opt);
  };

  #handleClick = (e) => {
    if (this.hasAttribute("disabled")) return;
    const opt = e.composedPath().find((el) => el.tagName?.toLowerCase() === "vault-listbox-option");
    if (opt && !opt.hasAttribute("disabled")) {
      this.#select(opt);
      if (!this.hasAttribute("selectable")) this.#setActive(null);
    }
  };

  connectedCallback() {
    this.setAttribute("role", "listbox");
    if (!this.hasAttribute("tabindex")) this.setAttribute("tabindex", "0");
    this.#syncAccessibleName();
    if (!this.shadowRoot) this.#render();
    this.#watchOptions();
    this.#syncValue();
    this.addEventListener("keydown", this.#handleKeydown);
    this.addEventListener("pointerdown", this.#handlePointerdown);
    this.addEventListener("click", this.#handleClick);
  }

  disconnectedCallback() {
    this.#observer?.disconnect();
    this.removeEventListener("keydown", this.#handleKeydown);
    this.removeEventListener("pointerdown", this.#handlePointerdown);
    this.removeEventListener("click", this.#handleClick);
  }

  attributeChangedCallback(name) {
    if (!this.shadowRoot) return;
    if (name === "value") {
      this.#syncValue();
    } else if (name === "label") {
      this.#syncLabel();
      this.#syncAccessibleName();
    } else if (name === "disabled") {
      this.#syncDisabled();
    }
  }

  get value() {
    return this.getAttribute("value") ?? "";
  }
  set value(v) {
    this.setAttribute("value", v);
  }

  #allOptions() {
    return [...this.querySelectorAll("vault-listbox-option")];
  }

  #enabledOptions() {
    return this.#allOptions().filter((o) => !o.hasAttribute("disabled"));
  }

  #activeOption() {
    return this.querySelector("vault-listbox-option[active]");
  }

  #setActive(opt) {
    for (const o of this.#allOptions()) o.removeAttribute("active");
    if (opt) {
      opt.setAttribute("active", "");
      this.setAttribute("aria-activedescendant", opt.id);
      opt.scrollIntoView({ block: "nearest" });
    } else {
      this.removeAttribute("aria-activedescendant");
    }
  }

  #select(opt) {
    const value = opt.getAttribute("value") ?? "";
    if (this.hasAttribute("selectable")) {
      this.setAttribute("value", value);
      this.#syncValue();
    }
    this.dispatchEvent(
      new CustomEvent("vault-change", {
        detail: { value },
        bubbles: true,
        composed: true,
      }),
    );
  }

  #syncValue() {
    const value = this.getAttribute("value") ?? "";
    let matched = null;
    for (const opt of this.#allOptions()) {
      const match = opt.getAttribute("value") === value && value !== "";
      if (match) {
        opt.setAttribute("selected", "");
        opt.setAttribute("aria-selected", "true");
        matched = opt;
      } else {
        opt.removeAttribute("selected");
        opt.setAttribute("aria-selected", "false");
      }
    }
    if (this.hasAttribute("selectable")) this.#setActive(matched);
  }

  #syncAccessibleName() {
    const label = this.getAttribute("label") || "";
    const ariaLabel = this.getAttribute("aria-label") || "";
    if (label) {
      this.setAttribute("aria-label", label);
    } else if (!ariaLabel) {
      console.warn(
        "[vault-listbox] Missing accessible name — set a `label` or `aria-label` attribute.",
      );
    }
  }

  #syncLabel() {
    const label = this.shadowRoot?.querySelector(".label");
    const newLabel = this.getAttribute("label") || "";
    if (label) {
      label.textContent = newLabel;
      label.hidden = !newLabel;
    }
  }

  #syncDisabled() {
    if (this.hasAttribute("disabled")) {
      this.setAttribute("aria-disabled", "true");
      this.setAttribute("tabindex", "-1");
    } else {
      this.removeAttribute("aria-disabled");
      this.setAttribute("tabindex", "0");
    }
  }

  #watchOptions() {
    this.#observer = new MutationObserver(() => this.#syncValue());
    this.#observer.observe(this, { childList: true });
  }

  #render() {
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });

    const label = this.getAttribute("label") || "";

    this.shadowRoot.innerHTML =
      TOKEN_BRIDGE +
      `
      <style>
        :host {
          display: block;
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          background: var(--surface-raised);
          overflow: hidden;
        }
        :host(:focus-visible) {
          outline: none;
          box-shadow: var(--focus-ring);
        }
        :host([ghost]) {
          border: none;
          background: transparent;
          border-radius: 0;
        }
        :host([disabled]) {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .label {
          display: block;
          font-family: var(--font-mono);
          font-size: var(--text-xs);
          font-weight: 500;
          letter-spacing: 0.08em;
          color: var(--text-secondary);
          padding: var(--sp-3) var(--sp-4) var(--sp-2);
          border-bottom: 1px solid var(--surface-border);
        }
        .label[hidden] { display: none; }
        .list { overflow-y: auto; }
      </style>
      <span class="label"${!label ? " hidden" : ""}>${label}</span>
      <div class="list" role="presentation">
        <slot></slot>
      </div>
    `;
  }
}

customElements.define("vault-listbox-option", VaultListboxOption);
customElements.define("vault-listbox", VaultListbox);

export { VaultListbox, VaultListboxOption };
