import { TOKEN_BRIDGE } from './token-bridge.js';

class VaultTextarea extends HTMLElement {
  static observedAttributes = ['label', 'value', 'rows', 'maxlength', 'resize', 'error', 'hint'];

  connectedCallback() {
    if (!this.shadowRoot) this.#render();
  }

  attributeChangedCallback(name, _oldVal, newVal) {
    if (!this.shadowRoot) return;
    if (name === 'value') {
      const ta = this.shadowRoot.querySelector('textarea');
      if (ta && ta.value !== newVal) { ta.value = newVal ?? ''; this.#autoResize(ta); }
    } else {
      this.#render();
    }
  }

  get value() {
    return this.shadowRoot?.querySelector('textarea')?.value ?? this.getAttribute('value') ?? '';
  }

  set value(v) {
    this.setAttribute('value', v);
    const ta = this.shadowRoot?.querySelector('textarea');
    if (ta) { ta.value = v; this.#autoResize(ta); }
  }

  #autoResize(ta) {
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
  }

  #render() {
    const label     = this.getAttribute('label')     || '';
    const value     = this.getAttribute('value')     || '';
    const rows      = this.getAttribute('rows')      || '4';
    const maxlength = this.getAttribute('maxlength') || '';
    const resize    = this.getAttribute('resize')    || 'vertical';
    const error     = this.getAttribute('error')     || '';
    const hint      = this.getAttribute('hint')      || '';

    const resizeCss = resize === 'none' ? 'none' : resize === 'auto' ? 'none' : 'vertical';
    const uid = `vta-${Math.random().toString(36).slice(2)}`;

    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });

    this.shadowRoot.innerHTML = TOKEN_BRIDGE + `
      <style>
        :host { display: block; }
        .field { display: flex; flex-direction: column; gap: var(--sp-1); }
        label {
          font-family: var(--font-mono);
          font-size: var(--text-xs);
          font-weight: 500;
          letter-spacing: 0.08em;
          color: var(--text-secondary);
        }
        textarea {
          display: block;
          width: 100%;
          background: var(--surface-overlay);
          border: 1.5px solid ${error ? 'var(--danger)' : 'var(--surface-border)'};
          border-radius: var(--radius-md);
          color: var(--text-primary);
          font-family: var(--font-body);
          font-size: var(--text-base);
          line-height: 1.5;
          padding: var(--sp-2) var(--sp-3);
          resize: ${resizeCss};
          outline: none;
          transition: border-color var(--duration-normal) var(--ease-out), box-shadow var(--duration-normal) var(--ease-out);
        }
        textarea::placeholder { color: var(--text-muted); }
        textarea:focus {
          border-color: ${error ? 'var(--danger)' : 'var(--cipher)'};
          box-shadow: ${error ? '0 0 0 2px rgba(217,95,95,0.25)' : '0 0 0 2px rgba(46,204,143,0.15)'};
        }
        textarea:focus-visible { outline: none; }
        .hint-text {
          font-family: var(--font-body);
          font-size: var(--text-xs);
          color: ${error ? 'var(--danger-text)' : 'var(--text-muted)'};
        }
        .footer { display: flex; justify-content: space-between; align-items: baseline; }
        .counter { font-family: var(--font-mono); font-size: var(--text-xs); color: var(--text-muted); }
      </style>
      <div class="field">
        ${label ? `<label for="${uid}">${label}</label>` : ''}
        <textarea
          id="${uid}"
          rows="${rows}"
          ${maxlength ? `maxlength="${maxlength}"` : ''}
          ${error ? `aria-invalid="true" aria-describedby="${uid}-hint"` : ''}
        >${value.replace(/</g, '&lt;')}</textarea>
        <div class="footer">
          ${error || hint ? `<span class="hint-text" id="${uid}-hint">${error || hint}</span>` : '<span></span>'}
          ${maxlength ? `<span class="counter" aria-live="polite"></span>` : ''}
        </div>
      </div>
    `;

    const ta      = this.shadowRoot.querySelector('textarea');
    const counter = this.shadowRoot.querySelector('.counter');

    const updateCounter = () => {
      if (counter && maxlength) {
        counter.textContent = `${ta.value.length} / ${maxlength}`;
      }
    };

    if (resize === 'auto') this.#autoResize(ta);
    updateCounter();

    ta.addEventListener('input', () => {
      if (resize === 'auto') this.#autoResize(ta);
      updateCounter();
      this.dispatchEvent(new CustomEvent('vault-input', {
        detail: { value: ta.value },
        bubbles: true, composed: true,
      }));
    });
    ta.addEventListener('change', () => {
      this.dispatchEvent(new CustomEvent('vault-change', {
        detail: { value: ta.value },
        bubbles: true, composed: true,
      }));
    });
  }
}

customElements.define('vault-textarea', VaultTextarea);

export { VaultTextarea };
