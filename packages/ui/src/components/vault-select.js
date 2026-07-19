import { TOKEN_BRIDGE } from './token-bridge.js';

class VaultSelect extends HTMLElement {
  static observedAttributes = ['label', 'aria-label', 'value', 'error', 'hint', 'required'];

  #select = null;
  #observer = null;

  connectedCallback() {
    if (!this.shadowRoot) this.#render();
    this.#watchOptions();
  }

  disconnectedCallback() {
    this.#observer?.disconnect();
  }

  attributeChangedCallback(name, _oldVal, newVal) {
    if (!this.shadowRoot) return;
    if (name === 'value') {
      if (this.#select) this.#select.value = newVal ?? '';
      return;
    }
    const hadFocus = this.#select && this.shadowRoot.activeElement === this.#select;
    this.#render();
    this.#syncOptions();
    if (hadFocus) this.#select.focus();
  }

  get value() { return this.#select?.value ?? this.getAttribute('value') ?? ''; }
  set value(v) {
    this.setAttribute('value', v);
    if (this.#select) this.#select.value = v;
  }

  #watchOptions() {
    this.#observer = new MutationObserver(() => this.#syncOptions());
    this.#observer.observe(this, { childList: true, subtree: true });
    this.#syncOptions();
  }

  #syncOptions() {
    if (!this.#select) return;
    const opts = [...this.querySelectorAll('option')];
    const current = this.#select.value;
    this.#select.innerHTML = '';
    for (const opt of opts) {
      this.#select.appendChild(opt.cloneNode(true));
    }
    this.#select.value = this.getAttribute('value') ?? current;
  }

  #render() {
    const label    = this.getAttribute('label')    || '';
    const ariaLabel = this.getAttribute('aria-label') || '';
    const error    = this.getAttribute('error')    || '';
    const hint     = this.getAttribute('hint')     || '';
    const required = this.hasAttribute('required');

    const uid = `vs-${Math.random().toString(36).slice(2)}`;

    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });

    this.shadowRoot.innerHTML = TOKEN_BRIDGE + `
      <style>
        :host { display: block; cursor: pointer; }
        .field { display: flex; flex-direction: column; gap: var(--sp-1); }
        label {
          font-family: var(--font-mono);
          font-size: var(--text-xs);
          font-weight: 500;
          letter-spacing: 0.08em;
          color: var(--text-secondary);
        }
        label .required { color: var(--danger-text); margin-left: var(--sp-1); }
        .wrap {
          position: relative;
          display: flex;
          align-items: center;
        }
        select {
          width: 100%;
          appearance: none;
          background: var(--surface-overlay);
          border: 1.5px solid ${error ? 'var(--danger)' : 'var(--surface-border)'};
          border-radius: var(--radius-md);
          color: var(--text-primary);
          font-family: var(--font-body);
          font-size: var(--text-base);
          padding: var(--sp-2) var(--sp-8) var(--sp-2) var(--sp-3);
          outline: none;
          cursor: pointer;
          transition: border-color var(--duration-normal) var(--ease-out), box-shadow var(--duration-normal) var(--ease-out);
        }
        select:focus {
          border-color: ${error ? 'var(--danger)' : 'var(--cipher)'};
          box-shadow: ${error ? '0 0 0 2px color-mix(in srgb, var(--danger) 25%, transparent)' : '0 0 0 2px color-mix(in srgb, var(--cipher) 15%, transparent)'};
        }
        select:focus-visible { outline: none; }
        select option { background: var(--surface-overlay); color: var(--text-primary); }
        .chevron {
          position: absolute;
          right: var(--sp-3);
          pointer-events: none;
          color: var(--text-muted);
          font-size: var(--text-xs);
        }
        .hint-text {
          font-family: var(--font-body);
          font-size: var(--text-xs);
          color: ${error ? 'var(--danger-text)' : 'var(--text-muted)'};
        }
      </style>
      <div class="field">
        ${label ? `<label for="${uid}">${label}${required ? '<span class="required" aria-hidden="true">*</span>' : ''}</label>` : ''}
        <div class="wrap">
          <select id="${uid}" ${required ? 'required' : ''} ${error ? `aria-invalid="true"` : ''} ${!label && ariaLabel ? `aria-label="${ariaLabel.replace(/"/g, '&quot;')}"` : ''}>
          </select>
          <span class="chevron" aria-hidden="true">▼</span>
        </div>
        ${error || hint ? `<span class="hint-text">${error || hint}</span>` : ''}
      </div>
    `;

    if (!label && !ariaLabel) {
      console.warn('[vault-select] Missing accessible name — set a `label` or `aria-label` attribute.');
    }

    this.#select = this.shadowRoot.querySelector('select');
    this.#select.addEventListener('change', () => {
      this.setAttribute('value', this.#select.value);
      this.dispatchEvent(new CustomEvent('vault-change', {
        detail: { value: this.#select.value },
        bubbles: true, composed: true,
      }));
    });
  }
}

customElements.define('vault-select', VaultSelect);

export { VaultSelect };
