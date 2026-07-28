import { TOKEN_BRIDGE } from "./token-bridge.js";

class VaultSlider extends HTMLElement {
  static observedAttributes = [
    "value",
    "min",
    "max",
    "step",
    "label",
    "aria-label",
    "hint",
    "disabled",
  ];

  connectedCallback() {
    if (!this.shadowRoot) this.#render();
  }

  attributeChangedCallback(name, _oldVal, newVal) {
    if (!this.shadowRoot) return;
    const input = this.shadowRoot.querySelector("input");
    if (name === "value") {
      if (input && input.value !== newVal) {
        input.value = newVal ?? input.min;
        this.#syncFill(input);
        this.#syncValueDisplay(input.value);
      }
      return;
    }
    const hadFocus = input && this.shadowRoot.activeElement === input;
    this.#render();
    if (hadFocus) this.shadowRoot.querySelector("input").focus();
  }

  get value() {
    const input = this.shadowRoot?.querySelector("input");
    if (input) return Number(input.value);
    return Number(this.getAttribute("value") ?? this.getAttribute("min") ?? 0);
  }

  set value(v) {
    this.setAttribute("value", String(v));
    const input = this.shadowRoot?.querySelector("input");
    if (input) {
      input.value = String(v);
      this.#syncFill(input);
      this.#syncValueDisplay(input.value);
    }
  }

  #syncFill(input) {
    const min = Number(input.min || 0);
    const max = Number(input.max || 100);
    const pct = max > min ? ((Number(input.value) - min) / (max - min)) * 100 : 0;
    input.style.setProperty("--fill-pct", `${Math.max(0, Math.min(100, pct))}%`);
  }

  #syncValueDisplay(value) {
    const display = this.shadowRoot.querySelector(".value-pill");
    if (display) display.textContent = value;
  }

  #render() {
    const label = this.getAttribute("label") || "";
    const ariaLabel = this.getAttribute("aria-label") || "";
    const min = this.getAttribute("min") ?? "0";
    const max = this.getAttribute("max") ?? "100";
    const step = this.getAttribute("step") ?? "1";
    const value = this.getAttribute("value") ?? min;
    const hint = this.getAttribute("hint") || "";
    const disabled = this.hasAttribute("disabled");

    const uid = `vs-${Math.random().toString(36).slice(2)}`;

    if (!this.shadowRoot) this.attachShadow({ mode: "open" });

    this.shadowRoot.innerHTML =
      TOKEN_BRIDGE +
      `
      <style>
        :host { display: block; }
        .field { display: flex; flex-direction: column; gap: var(--sp-2); }
        .label-row {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: var(--sp-2);
        }
        label {
          font-family: var(--font-mono);
          font-size: var(--text-xs);
          font-weight: 500;
          letter-spacing: 0.08em;
          color: var(--text-secondary);
        }
        .value-pill {
          font-family: var(--font-mono);
          font-size: var(--text-sm);
          font-weight: 500;
          color: var(--text-accent);
          min-width: 1.5em;
          text-align: right;
        }
        .track-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }
        input[type="range"] {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: var(--sp-10);
          margin: 0;
          background: transparent;
          cursor: ${disabled ? "not-allowed" : "pointer"};
          --fill-pct: 0%;
        }
        input[type="range"]:disabled { cursor: not-allowed; }

        input[type="range"]::-webkit-slider-runnable-track {
          height: 4px;
          border-radius: var(--radius-full);
          background: linear-gradient(
            to right,
            var(--cipher) 0%,
            var(--cipher) var(--fill-pct),
            var(--surface-border) var(--fill-pct),
            var(--surface-border) 100%
          );
        }
        input[type="range"]::-moz-range-track {
          height: 4px;
          border-radius: var(--radius-full);
          background: var(--surface-border);
        }
        input[type="range"]::-moz-range-progress {
          height: 4px;
          border-radius: var(--radius-full);
          background: var(--cipher);
        }

        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: var(--sp-5);
          height: var(--sp-5);
          margin-top: -8px;
          border-radius: var(--radius-full);
          background: var(--cipher);
          border: 3px solid var(--surface-base);
          box-shadow: var(--shadow-sm);
          transition: transform var(--duration-fast) var(--ease-out);
        }
        input[type="range"]::-moz-range-thumb {
          width: var(--sp-5);
          height: var(--sp-5);
          border: 3px solid var(--surface-base);
          border-radius: var(--radius-full);
          background: var(--cipher);
          box-shadow: var(--shadow-sm);
          transition: transform var(--duration-fast) var(--ease-out);
        }
        input[type="range"]:active::-webkit-slider-thumb { transform: scale(1.15); }
        input[type="range"]:active::-moz-range-thumb { transform: scale(1.15); }

        input[type="range"]:focus-visible { outline: none; }
        input[type="range"]:focus-visible::-webkit-slider-thumb { box-shadow: var(--focus-ring); }
        input[type="range"]:focus-visible::-moz-range-thumb { box-shadow: var(--focus-ring); }

        input[type="range"]:disabled::-webkit-slider-thumb { opacity: 0.5; }
        input[type="range"]:disabled::-moz-range-thumb { opacity: 0.5; }
        input[type="range"]:disabled::-webkit-slider-runnable-track { opacity: 0.5; }

        .scale-labels {
          display: flex;
          justify-content: space-between;
          font-family: var(--font-mono);
          font-size: var(--text-xs);
          color: var(--text-muted);
        }
        .hint-text {
          font-family: var(--font-body);
          font-size: var(--text-xs);
          color: var(--text-muted);
        }
      </style>
      <div class="field">
        <div class="label-row">
          ${label ? `<label for="${uid}">${label}</label>` : "<span></span>"}
          <span class="value-pill" aria-hidden="true">${value}</span>
        </div>
        <div class="track-wrap">
          <input
            id="${uid}"
            type="range"
            min="${min}"
            max="${max}"
            step="${step}"
            value="${value}"
            ${disabled ? "disabled" : ""}
            ${!label && ariaLabel ? `aria-label="${ariaLabel.replace(/"/g, "&quot;")}"` : ""}
          />
        </div>
        <div class="scale-labels" aria-hidden="true">
          <span>${min}</span>
          <span>${max}</span>
        </div>
        ${hint ? `<span class="hint-text">${hint}</span>` : ""}
      </div>
    `;

    if (!label && !ariaLabel) {
      console.warn(
        "[vault-slider] Missing accessible name — set a `label` or `aria-label` attribute.",
      );
    }

    const input = this.shadowRoot.querySelector("input");
    this.#syncFill(input);

    input.addEventListener("input", () => {
      this.#syncFill(input);
      this.#syncValueDisplay(input.value);
      this.dispatchEvent(
        new CustomEvent("vault-input", {
          detail: { value: Number(input.value) },
          bubbles: true,
          composed: true,
        }),
      );
    });
    input.addEventListener("change", () => {
      this.setAttribute("value", input.value);
      this.dispatchEvent(
        new CustomEvent("vault-change", {
          detail: { value: Number(input.value) },
          bubbles: true,
          composed: true,
        }),
      );
    });
  }
}

customElements.define("vault-slider", VaultSlider);

export { VaultSlider };
