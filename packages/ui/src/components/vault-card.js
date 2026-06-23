import { TOKEN_BRIDGE } from './token-bridge.js';

class VaultCard extends HTMLElement {
  static observedAttributes = ['padding', 'border', 'elevated'];

  connectedCallback() {
    if (!this.shadowRoot) this.#render();
  }

  attributeChangedCallback() {
    if (this.shadowRoot) this.#render();
  }

  #render() {
    const padding  = this.getAttribute('padding') || 'md';
    const border   = this.hasAttribute('border');
    const elevated = this.hasAttribute('elevated');

    const paddings = {
      sm: 'var(--sp-3)',
      md: 'var(--sp-4)',
      lg: 'var(--sp-6)',
    };

    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });

    this.shadowRoot.innerHTML = TOKEN_BRIDGE + `
      <style>
        :host { display: block; }
        .card {
          background: var(--surface-raised);
          border-radius: var(--radius-lg);
          padding: ${paddings[padding] || paddings.md};
          ${border ? 'border: 1px solid var(--surface-border);' : 'border: 1px solid transparent;'}
          ${elevated ? 'box-shadow: var(--shadow-md);' : ''}
          transition: box-shadow var(--duration-normal) var(--ease-out);
        }
      </style>
      <div class="card" part="card">
        <slot></slot>
      </div>
    `;
  }
}

customElements.define('vault-card', VaultCard);

export { VaultCard };
