import { TOKEN_BRIDGE } from './token-bridge.js';

class VaultToggle extends HTMLElement {
  static observedAttributes = ['checked', 'label', 'hint', 'size', 'disabled'];

  connectedCallback() {
    if (!this.shadowRoot) this.#render();
  }

  attributeChangedCallback() {
    if (this.shadowRoot) this.#render();
  }

  get checked() { return this.hasAttribute('checked'); }
  set checked(v) { v ? this.setAttribute('checked', '') : this.removeAttribute('checked'); }

  #render() {
    const checked  = this.hasAttribute('checked');
    const label    = this.getAttribute('label')   || '';
    const hint     = this.getAttribute('hint')    || '';
    const size     = this.getAttribute('size')    || 'md';
    const disabled = this.hasAttribute('disabled');

    const trackW = size === 'sm' ? '32px' : '44px';
    const trackH = size === 'sm' ? '18px' : '24px';
    const thumbS = size === 'sm' ? '12px' : '16px';
    const thumbOffset   = size === 'sm' ? '3px' : '4px';
    const thumbTranslate = size === 'sm' ? '14px' : '20px';

    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });

    this.shadowRoot.innerHTML = TOKEN_BRIDGE + `
      <style>
        :host { display: block; cursor: pointer; }
        :host([disabled]) { cursor: not-allowed; }
        .toggle-row {
          display: flex;
          align-items: flex-start;
          gap: var(--sp-3);
          cursor: ${disabled ? 'not-allowed' : 'pointer'};
          opacity: ${disabled ? '0.5' : '1'};
        }
        .track {
          flex-shrink: 0;
          width: ${trackW};
          height: ${trackH};
          border-radius: var(--radius-full);
          background: ${checked ? 'var(--cipher)' : 'var(--surface-border)'};
          position: relative;
          transition: background var(--duration-normal) var(--ease-out);
        }
        .thumb {
          position: absolute;
          top: ${thumbOffset};
          left: ${checked ? thumbTranslate : thumbOffset};
          width: ${thumbS};
          height: ${thumbS};
          border-radius: var(--radius-full);
          background: #fff;
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
          transition: left var(--duration-normal) var(--ease-out);
        }
        input[type="checkbox"] {
          position: absolute;
          width: 1px; height: 1px;
          padding: 0; margin: -1px;
          overflow: hidden; clip: rect(0,0,0,0);
          white-space: nowrap; border: 0;
        }
        input:focus-visible ~ .track-wrap .track {
          box-shadow: var(--focus-ring);
        }
        .track-wrap { position: relative; display: inline-flex; }
        .text { display: flex; flex-direction: column; gap: 2px; }
        .label-text {
          font-family: var(--font-mono);
          font-size: var(--text-sm);
          font-weight: 500;
          color: var(--text-primary);
          line-height: 1.3;
        }
        .hint-text {
          font-family: var(--font-body);
          font-size: var(--text-xs);
          color: var(--text-muted);
        }
      </style>
      <label class="toggle-row">
        <input type="checkbox" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''} role="switch" aria-checked="${checked}" />
        <span class="track-wrap">
          <span class="track"><span class="thumb"></span></span>
        </span>
        ${label || hint ? `
          <span class="text">
            ${label ? `<span class="label-text">${label}</span>` : ''}
            ${hint  ? `<span class="hint-text">${hint}</span>`   : ''}
          </span>` : ''}
      </label>
    `;

    const input = this.shadowRoot.querySelector('input');
    input.addEventListener('change', () => {
      if (input.checked) {
        this.setAttribute('checked', '');
      } else {
        this.removeAttribute('checked');
      }
      this.dispatchEvent(new CustomEvent('vault-change', {
        detail: { checked: input.checked },
        bubbles: true, composed: true,
      }));
    });
  }
}

customElements.define('vault-toggle', VaultToggle);

export { VaultToggle };
