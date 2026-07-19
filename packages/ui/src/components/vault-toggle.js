import { TOKEN_BRIDGE } from './token-bridge.js';

class VaultToggle extends HTMLElement {
  static observedAttributes = ['checked', 'label', 'aria-label', 'hint', 'size', 'disabled'];

  connectedCallback() {
    if (!this.shadowRoot) this.#render();
  }

  attributeChangedCallback() {
    if (!this.shadowRoot) return;
    const input = this.shadowRoot.querySelector('input');
    const hadFocus = input && this.shadowRoot.activeElement === input;
    this.#render();
    if (hadFocus) this.shadowRoot.querySelector('input').focus();
  }

  get checked() { return this.hasAttribute('checked'); }
  set checked(v) { v ? this.setAttribute('checked', '') : this.removeAttribute('checked'); }

  #render() {
    const checked  = this.hasAttribute('checked');
    const label    = this.getAttribute('label')   || '';
    const ariaLabel = this.getAttribute('aria-label') || '';
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
          background: var(--ink-50);
          box-shadow: var(--shadow-sm);
          transition: left var(--duration-normal) var(--ease-out);
        }
        input:focus-visible ~ .track-wrap .track {
          box-shadow: var(--focus-ring);
        }
        .track-wrap { position: relative; display: inline-flex; }
        .text { display: flex; flex-direction: column; gap: var(--sp-1); }
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
        <input type="checkbox" class="sr-only" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''} role="switch" aria-checked="${checked}" ${!label && ariaLabel ? `aria-label="${ariaLabel.replace(/"/g, '&quot;')}"` : ''} />
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

    if (!label && !ariaLabel) {
      console.warn('[vault-toggle] Missing accessible name — set a `label` or `aria-label` attribute.');
    }

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
