import { TOKEN_BRIDGE } from './token-bridge.js';

class VaultButton extends HTMLElement {
  static observedAttributes = ['variant', 'size', 'disabled', 'loading'];

  connectedCallback() {
    if (!this.shadowRoot) this.#render();
  }

  attributeChangedCallback() {
    if (this.shadowRoot) this.#render();
  }

  #render() {
    const variant  = this.getAttribute('variant') || 'primary';
    const size     = this.getAttribute('size')    || 'md';
    const disabled = this.hasAttribute('disabled');
    const loading  = this.hasAttribute('loading');

    const sizeStyles = {
      sm: `padding: var(--sp-1) var(--sp-3); font-size: var(--text-xs); gap: var(--sp-1);`,
      md: `padding: var(--sp-2) var(--sp-4); font-size: var(--text-sm); gap: var(--sp-2);`,
      lg: `padding: var(--sp-3) var(--sp-6); font-size: var(--text-base); gap: var(--sp-2);`,
    };

    const variantStyles = {
      primary:   `background: var(--cipher); color: var(--ink-950); border-color: var(--cipher);`,
      secondary: `background: transparent; color: var(--text-primary); border-color: var(--surface-border);`,
      ghost:     `background: transparent; color: var(--text-primary); border-color: transparent;`,
      danger:    `background: var(--danger-fill); color: var(--ink-50); border-color: var(--danger-fill);`,
    };

    const hoverStyles = {
      primary:   `background: var(--cipher-dim); border-color: var(--cipher-dim);`,
      secondary: `background: var(--surface-hover); border-color: var(--ink-400);`,
      ghost:     `background: var(--surface-hover); border-color: transparent;`,
      danger:    `background: var(--danger-dim); border-color: var(--danger-dim);`,
    };

    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });

    this.shadowRoot.innerHTML = TOKEN_BRIDGE + `
      <style>
        :host { display: inline-block; cursor: pointer; }
        :host([disabled]) { cursor: not-allowed; }
        button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-mono);
          font-weight: 500;
          letter-spacing: 0.04em;
          border: 1.5px solid transparent;
          border-radius: var(--radius-md);
          cursor: pointer;
          touch-action: manipulation;
          transition:
            background var(--duration-fast) var(--ease-out),
            border-color var(--duration-fast) var(--ease-out),
            box-shadow var(--duration-fast) var(--ease-out),
            opacity var(--duration-fast) var(--ease-out);
          position: relative;
          white-space: nowrap;
          ${sizeStyles[size] || sizeStyles.md}
          ${variantStyles[variant] || variantStyles.primary}
        }
        button:active:not(:disabled) {
          ${hoverStyles[variant] || hoverStyles.primary}
          transform: translateY(1px);
        }
        @media (hover: hover) {
          button:hover:not(:disabled) {
            ${hoverStyles[variant] || hoverStyles.primary}
          }
        }
        button:focus-visible {
          outline: none;
          box-shadow: var(--focus-ring);
        }
        button:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .spinner {
          width: 1em;
          height: 1em;
          border: 2px solid currentColor;
          border-top-color: transparent;
          border-radius: var(--radius-full);
          animation: spin 0.7s linear infinite;
          flex-shrink: 0;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .spinner { animation: none; border-top-color: currentColor; opacity: 0.5; }
        }
      </style>
      <button ${disabled || loading ? 'disabled' : ''} aria-busy="${loading}">
        ${loading ? '<span class="spinner" aria-hidden="true"></span>' : ''}
        <slot></slot>
      </button>
    `;
  }
}

customElements.define('vault-button', VaultButton);

export { VaultButton };
