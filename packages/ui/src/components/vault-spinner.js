import { TOKEN_BRIDGE } from "./token-bridge.js";

class VaultSpinner extends HTMLElement {
  static observedAttributes = ["size", "label"];

  connectedCallback() {
    if (!this.shadowRoot) this.#render();
  }

  attributeChangedCallback() {
    if (this.shadowRoot) this.#render();
  }

  #render() {
    const size = this.getAttribute("size") || "md";
    const label = this.getAttribute("label") || "Loading…";

    const sizes = { sm: "16px", md: "24px", lg: "40px" };
    const thickness = { sm: "2px", md: "2.5px", lg: "3px" };
    const dim = sizes[size] || sizes.md;
    const bw = thickness[size] || thickness.md;

    if (!this.shadowRoot) this.attachShadow({ mode: "open" });

    this.shadowRoot.innerHTML =
      TOKEN_BRIDGE +
      `
      <style>
        :host { display: inline-flex; align-items: center; justify-content: center; }
        .spinner {
          width: ${dim};
          height: ${dim};
          border: ${bw} solid var(--surface-border);
          border-top-color: var(--cipher);
          border-radius: var(--radius-full);
          animation: spin 0.7s linear infinite;
          flex-shrink: 0;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) {
          .spinner { animation: none; border-top-color: var(--cipher); opacity: 0.7; }
        }
      </style>
      <span class="spinner"></span>
      <span class="sr-only" role="status">${label}</span>
    `;
  }
}

customElements.define("vault-spinner", VaultSpinner);

export { VaultSpinner };
