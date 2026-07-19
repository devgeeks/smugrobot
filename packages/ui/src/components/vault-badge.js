import { TOKEN_BRIDGE } from './token-bridge.js';

class VaultBadge extends HTMLElement {
  static observedAttributes = ['variant', 'dot'];

  connectedCallback() {
    if (!this.shadowRoot) this.#render();
  }

  attributeChangedCallback() {
    if (this.shadowRoot) this.#render();
  }

  #render() {
    const variant = this.getAttribute('variant') || 'default';
    const dot     = this.hasAttribute('dot');

    const colors = {
      default: `color: var(--text-secondary); background: var(--surface-overlay); border-color: var(--surface-border);`,
      success: `color: var(--cipher-text);  background: color-mix(in srgb, var(--cipher) 10%, transparent);  border-color: color-mix(in srgb, var(--cipher) 30%, transparent);`,
      warn:    `color: var(--warn-text);    background: color-mix(in srgb, var(--warn) 10%, transparent);    border-color: color-mix(in srgb, var(--warn) 30%, transparent);`,
      danger:  `color: var(--danger-text);  background: color-mix(in srgb, var(--danger) 10%, transparent);  border-color: color-mix(in srgb, var(--danger) 30%, transparent);`,
      info:    `color: var(--info-text);    background: color-mix(in srgb, var(--info) 10%, transparent);   border-color: color-mix(in srgb, var(--info) 30%, transparent);`,
    };

    const dotColors = {
      default: `background: var(--text-muted);`,
      success: `background: var(--cipher);`,
      warn:    `background: var(--warn);`,
      danger:  `background: var(--danger);`,
      info:    `background: var(--info);`,
    };

    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });

    this.shadowRoot.innerHTML = TOKEN_BRIDGE + `
      <style>
        :host { display: inline-flex; }
        .badge {
          display: inline-flex;
          align-items: center;
          gap: var(--sp-1);
          font-family: var(--font-mono);
          font-size: var(--text-xs);
          font-weight: 500;
          letter-spacing: 0.06em;
          padding: var(--sp-1) var(--sp-2);
          border-radius: var(--radius-full);
          border: 1px solid transparent;
          ${colors[variant] || colors.default}
        }
        .dot {
          width: 6px;
          height: 6px;
          border-radius: var(--radius-full);
          flex-shrink: 0;
          ${dotColors[variant] || dotColors.default}
        }
      </style>
      <span class="badge">
        ${dot ? '<span class="dot" aria-hidden="true"></span>' : ''}
        <slot></slot>
      </span>
    `;
  }
}

customElements.define('vault-badge', VaultBadge);

export { VaultBadge };
