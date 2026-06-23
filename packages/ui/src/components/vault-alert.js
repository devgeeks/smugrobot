import { TOKEN_BRIDGE } from './token-bridge.js';

class VaultAlert extends HTMLElement {
  static observedAttributes = ['variant', 'title', 'dismissible'];

  connectedCallback() {
    if (!this.shadowRoot) this.#render();
  }

  attributeChangedCallback() {
    if (this.shadowRoot) this.#render();
  }

  #render() {
    const variant     = this.getAttribute('variant')     || 'info';
    const title       = this.getAttribute('title')       || '';
    const dismissible = this.hasAttribute('dismissible');

    const icons = { info: 'ℹ', success: '✓', warn: '⚠', danger: '✕' };
    const styles = {
      info:    `color: var(--info-text);    background: rgba(86,156,214,0.08);  border-color: rgba(86,156,214,0.3);`,
      success: `color: var(--cipher-text);  background: rgba(46,204,143,0.08);  border-color: rgba(46,204,143,0.3);`,
      warn:    `color: var(--warn-text);    background: rgba(232,168,56,0.08);  border-color: rgba(232,168,56,0.3);`,
      danger:  `color: var(--danger-text);  background: rgba(217,95,95,0.08);   border-color: rgba(217,95,95,0.3);`,
    };

    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });

    this.shadowRoot.innerHTML = TOKEN_BRIDGE + `
      <style>
        :host { display: block; }
        :host([hidden]) { display: none; }
        .alert {
          display: flex;
          gap: var(--sp-3);
          padding: var(--sp-3) var(--sp-4);
          border: 1px solid transparent;
          border-radius: var(--radius-md);
          font-family: var(--font-body);
          font-size: var(--text-sm);
          animation: slide-in var(--duration-slow) var(--ease-out);
          ${styles[variant] || styles.info}
        }
        @keyframes slide-in {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .icon {
          font-family: var(--font-mono);
          font-size: var(--text-base);
          flex-shrink: 0;
          line-height: 1.4;
        }
        .body { flex: 1; display: flex; flex-direction: column; gap: 2px; }
        .title {
          font-family: var(--font-mono);
          font-size: var(--text-sm);
          font-weight: 600;
          line-height: 1.3;
        }
        .message { color: var(--text-secondary); line-height: 1.5; }
        .dismiss {
          background: none;
          border: none;
          cursor: pointer;
          color: inherit;
          opacity: 0.6;
          font-size: var(--text-base);
          padding: 0;
          flex-shrink: 0;
          align-self: flex-start;
          line-height: 1;
          transition: opacity var(--duration-fast) var(--ease-out);
        }
        .dismiss:hover { opacity: 1; }
        .dismiss:focus-visible { outline: none; box-shadow: var(--focus-ring); border-radius: var(--radius-sm); }
      </style>
      <div class="alert" role="alert">
        <span class="icon" aria-hidden="true">${icons[variant] || icons.info}</span>
        <div class="body">
          ${title ? `<span class="title">${title}</span>` : ''}
          <span class="message"><slot></slot></span>
        </div>
        ${dismissible ? `<button class="dismiss" aria-label="Dismiss">✕</button>` : ''}
      </div>
    `;

    if (dismissible) {
      this.shadowRoot.querySelector('.dismiss').addEventListener('click', () => {
        this.setAttribute('hidden', '');
        this.dispatchEvent(new CustomEvent('vault-dismiss', { bubbles: true, composed: true }));
      });
    }
  }
}

customElements.define('vault-alert', VaultAlert);

export { VaultAlert };
