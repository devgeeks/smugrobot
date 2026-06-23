/**
 * vault.js — Vault UI web components
 *
 * Import order required by consuming apps:
 *   1. Google Fonts (IBM Plex Mono 400/500/600 + Inter 400/500/600)
 *   2. tokens/tokens.css
 *   3. tokens/base.css
 *   4. components/vault.js  (type="module")
 */

// CSS custom properties inherit through shadow DOM boundaries automatically.
// TOKEN_BRIDGE provides element-level reset so each shadow root starts clean.
const TOKEN_BRIDGE = `
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    :host { display: block; }
  </style>
`;

// ─────────────────────────────────────────────────────────────────────────────
// VaultTheme
// ─────────────────────────────────────────────────────────────────────────────

export const VaultTheme = {
  init() {
    const saved = localStorage.getItem('vault-theme');
    if (saved === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else if (saved === 'dark') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      // Follow OS preference
      if (window.matchMedia('(prefers-color-scheme: light)').matches) {
        document.documentElement.setAttribute('data-theme', 'light');
      }
    }
  },

  set(theme) {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('vault-theme', 'light');
    } else if (theme === 'dark') {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('vault-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.removeItem('vault-theme');
      if (window.matchMedia('(prefers-color-scheme: light)').matches) {
        document.documentElement.setAttribute('data-theme', 'light');
      }
    }
  },

  get() {
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// VaultButton
// ─────────────────────────────────────────────────────────────────────────────

class VaultButton extends HTMLElement {
  static observedAttributes = ['variant', 'size', 'disabled', 'loading'];

  connectedCallback() {
    if (!this.shadowRoot) this.#render();
  }

  attributeChangedCallback() {
    if (this.shadowRoot) this.#render();
  }

  #render() {
    const variant = this.getAttribute('variant') || 'primary';
    const size    = this.getAttribute('size')    || 'md';
    const disabled = this.hasAttribute('disabled');
    const loading  = this.hasAttribute('loading');

    const sizeStyles = {
      sm: `padding: var(--sp-1) var(--sp-3); font-size: var(--text-xs); gap: var(--sp-1);`,
      md: `padding: var(--sp-2) var(--sp-4); font-size: var(--text-sm); gap: var(--sp-2);`,
      lg: `padding: var(--sp-3) var(--sp-6); font-size: var(--text-base); gap: var(--sp-2);`,
    };

    const variantStyles = {
      primary:   `background: var(--cipher); color: var(--text-inverse); border-color: var(--cipher);`,
      secondary: `background: transparent; color: var(--text-primary); border-color: var(--surface-border);`,
      ghost:     `background: transparent; color: var(--text-primary); border-color: transparent;`,
      danger:    `background: var(--danger); color: #fff; border-color: var(--danger);`,
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
        :host { display: inline-block; }
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
        button:hover:not(:disabled) {
          ${hoverStyles[variant] || hoverStyles.primary}
        }
        button:active:not(:disabled) {
          transform: translateY(1px);
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

// ─────────────────────────────────────────────────────────────────────────────
// VaultInput
// ─────────────────────────────────────────────────────────────────────────────

class VaultInput extends HTMLElement {
  static observedAttributes = ['label', 'type', 'value', 'error', 'hint', 'prefix-icon', 'required', 'disabled', 'readonly'];

  connectedCallback() {
    if (!this.shadowRoot) this.#render();
  }

  attributeChangedCallback(name, _oldVal, newVal) {
    if (!this.shadowRoot) return;
    if (name === 'value') {
      const input = this.shadowRoot.querySelector('input');
      if (input && input.value !== newVal) input.value = newVal ?? '';
    } else {
      this.#render();
    }
  }

  get value() {
    return this.shadowRoot?.querySelector('input')?.value ?? this.getAttribute('value') ?? '';
  }

  set value(v) {
    this.setAttribute('value', v);
    const input = this.shadowRoot?.querySelector('input');
    if (input) input.value = v;
  }

  #render() {
    const label      = this.getAttribute('label')       || '';
    const type       = this.getAttribute('type')        || 'text';
    const value      = this.getAttribute('value')       || '';
    const error      = this.getAttribute('error')       || '';
    const hint       = this.getAttribute('hint')        || '';
    const prefixIcon = this.getAttribute('prefix-icon') || '';
    const required   = this.hasAttribute('required');
    const disabled   = this.hasAttribute('disabled');
    const readonly   = this.hasAttribute('readonly');

    const uid = `vi-${Math.random().toString(36).slice(2)}`;

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
          text-transform: uppercase;
          color: var(--text-secondary);
        }
        label .required { color: var(--danger-text); margin-left: var(--sp-1); }
        .wrap {
          display: flex;
          align-items: center;
          gap: 0;
          background: var(--surface-overlay);
          border: 1.5px solid ${error ? 'var(--danger)' : 'var(--surface-border)'};
          border-radius: var(--radius-md);
          transition: border-color var(--duration-normal) var(--ease-out), box-shadow var(--duration-normal) var(--ease-out);
        }
        .wrap:focus-within {
          border-color: ${error ? 'var(--danger)' : 'var(--cipher)'};
          box-shadow: ${error ? '0 0 0 2px rgba(217,95,95,0.25)' : '0 0 0 2px rgba(46,204,143,0.15)'};
        }
        .prefix {
          padding: 0 var(--sp-2) 0 var(--sp-3);
          font-family: var(--font-mono);
          font-size: var(--text-sm);
          color: var(--text-muted);
          flex-shrink: 0;
          user-select: none;
        }
        input {
          flex: 1;
          min-width: 0;
          background: transparent;
          border: none;
          outline: none;
          font-family: var(--font-body);
          font-size: var(--text-base);
          color: var(--text-primary);
          padding: var(--sp-2) var(--sp-3);
          ${prefixIcon ? 'padding-left: 0;' : ''}
        }
        input::placeholder { color: var(--text-muted); }
        input:disabled { opacity: 0.5; cursor: not-allowed; }
        .hint-text {
          font-family: var(--font-body);
          font-size: var(--text-xs);
          color: ${error ? 'var(--danger-text)' : 'var(--text-muted)'};
        }
      </style>
      <div class="field">
        ${label ? `<label for="${uid}">${label}${required ? '<span class="required" aria-hidden="true">*</span>' : ''}</label>` : ''}
        <div class="wrap">
          ${prefixIcon ? `<span class="prefix" aria-hidden="true">${prefixIcon}</span>` : ''}
          <input
            id="${uid}"
            type="${type}"
            value="${value.replace(/"/g, '&quot;')}"
            ${required  ? 'required'  : ''}
            ${disabled  ? 'disabled'  : ''}
            ${readonly  ? 'readonly'  : ''}
            ${error     ? `aria-invalid="true" aria-describedby="${uid}-hint"` : ''}
          />
        </div>
        ${error || hint ? `<span class="hint-text" id="${uid}-hint">${error || hint}</span>` : ''}
      </div>
    `;

    const input = this.shadowRoot.querySelector('input');
    input.addEventListener('input', () => {
      this.dispatchEvent(new CustomEvent('vault-input', {
        detail: { value: input.value },
        bubbles: true, composed: true,
      }));
    });
    input.addEventListener('change', () => {
      this.dispatchEvent(new CustomEvent('vault-change', {
        detail: { value: input.value },
        bubbles: true, composed: true,
      }));
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// VaultTextarea
// ─────────────────────────────────────────────────────────────────────────────

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
          text-transform: uppercase;
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

// ─────────────────────────────────────────────────────────────────────────────
// VaultBadge
// ─────────────────────────────────────────────────────────────────────────────

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
      success: `color: var(--cipher-text);  background: rgba(46,204,143,0.1);  border-color: rgba(46,204,143,0.3);`,
      warn:    `color: var(--warn-text);    background: rgba(232,168,56,0.1);  border-color: rgba(232,168,56,0.3);`,
      danger:  `color: var(--danger-text);  background: rgba(217,95,95,0.1);   border-color: rgba(217,95,95,0.3);`,
      info:    `color: var(--info-text);    background: rgba(86,156,214,0.1);  border-color: rgba(86,156,214,0.3);`,
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
          padding: 2px var(--sp-2);
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

// ─────────────────────────────────────────────────────────────────────────────
// VaultCard
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// VaultToggle
// ─────────────────────────────────────────────────────────────────────────────

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
    const thumbOffset = size === 'sm' ? '3px' : '4px';
    const thumbTranslate = size === 'sm' ? '14px' : '20px';

    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });

    this.shadowRoot.innerHTML = TOKEN_BRIDGE + `
      <style>
        :host { display: block; }
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

// ─────────────────────────────────────────────────────────────────────────────
// VaultSelect
// ─────────────────────────────────────────────────────────────────────────────

class VaultSelect extends HTMLElement {
  static observedAttributes = ['label', 'value', 'error', 'hint', 'required'];

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
    } else {
      this.#render();
      this.#syncOptions();
    }
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
    const error    = this.getAttribute('error')    || '';
    const hint     = this.getAttribute('hint')     || '';
    const required = this.hasAttribute('required');

    const uid = `vs-${Math.random().toString(36).slice(2)}`;

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
          text-transform: uppercase;
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
          box-shadow: ${error ? '0 0 0 2px rgba(217,95,95,0.25)' : '0 0 0 2px rgba(46,204,143,0.15)'};
        }
        select:focus-visible { outline: none; }
        select option { background: var(--surface-overlay); color: var(--text-primary); }
        .chevron {
          position: absolute;
          right: var(--sp-3);
          pointer-events: none;
          color: var(--text-muted);
          font-size: 10px;
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
          <select id="${uid}" ${required ? 'required' : ''} ${error ? `aria-invalid="true"` : ''}>
          </select>
          <span class="chevron" aria-hidden="true">▼</span>
        </div>
        ${error || hint ? `<span class="hint-text">${error || hint}</span>` : ''}
      </div>
    `;

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

// ─────────────────────────────────────────────────────────────────────────────
// VaultAlert
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// VaultSpinner
// ─────────────────────────────────────────────────────────────────────────────

class VaultSpinner extends HTMLElement {
  static observedAttributes = ['size', 'label'];

  connectedCallback() {
    if (!this.shadowRoot) this.#render();
  }

  attributeChangedCallback() {
    if (this.shadowRoot) this.#render();
  }

  #render() {
    const size  = this.getAttribute('size')  || 'md';
    const label = this.getAttribute('label') || 'Loading…';

    const sizes = { sm: '16px', md: '24px', lg: '40px' };
    const thickness = { sm: '2px', md: '2.5px', lg: '3px' };
    const dim = sizes[size] || sizes.md;
    const bw  = thickness[size] || thickness.md;

    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });

    this.shadowRoot.innerHTML = TOKEN_BRIDGE + `
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
        .sr-only {
          position: absolute; width: 1px; height: 1px;
          padding: 0; margin: -1px; overflow: hidden;
          clip: rect(0,0,0,0); white-space: nowrap; border: 0;
        }
      </style>
      <span class="spinner"></span>
      <span class="sr-only" role="status">${label}</span>
    `;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// VaultAvatar
// ─────────────────────────────────────────────────────────────────────────────

class VaultAvatar extends HTMLElement {
  static observedAttributes = ['name', 'src', 'size', 'status'];

  connectedCallback() {
    if (!this.shadowRoot) this.#render();
  }

  attributeChangedCallback() {
    if (this.shadowRoot) this.#render();
  }

  #initials(name) {
    return (name || '')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(w => w[0]?.toUpperCase() ?? '')
      .join('');
  }

  #render() {
    const name   = this.getAttribute('name')   || '';
    const src    = this.getAttribute('src')    || '';
    const size   = this.getAttribute('size')   || 'md';
    const status = this.getAttribute('status') || '';

    const dims = { sm: '32px', md: '40px', lg: '56px' };
    const fontSizes = { sm: 'var(--text-xs)', md: 'var(--text-sm)', lg: 'var(--text-base)' };
    const statusDims = { sm: '8px', md: '10px', lg: '14px' };
    const dim = dims[size] || dims.md;

    const statusColors = {
      online:  'var(--cipher)',
      offline: 'var(--text-muted)',
      away:    'var(--warn)',
      busy:    'var(--danger)',
    };

    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });

    this.shadowRoot.innerHTML = TOKEN_BRIDGE + `
      <style>
        :host { display: inline-flex; }
        .avatar {
          position: relative;
          width: ${dim};
          height: ${dim};
          border-radius: var(--radius-full);
          flex-shrink: 0;
        }
        .face {
          width: 100%;
          height: 100%;
          border-radius: var(--radius-full);
          overflow: hidden;
          background: var(--surface-overlay);
          border: 1.5px solid var(--surface-border);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-mono);
          font-size: ${fontSizes[size] || fontSizes.md};
          font-weight: 600;
          color: var(--text-secondary);
          user-select: none;
        }
        img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .status {
          position: absolute;
          bottom: 1px;
          right: 1px;
          width: ${statusDims[size] || statusDims.md};
          height: ${statusDims[size] || statusDims.md};
          border-radius: var(--radius-full);
          border: 2px solid var(--surface-base);
          background: ${statusColors[status] || 'transparent'};
        }
      </style>
      <span class="avatar" role="img" aria-label="${name || 'Avatar'}${status ? `, ${status}` : ''}">
        <span class="face">
          ${src
            ? `<img src="${src}" alt="${name}" />`
            : `<span aria-hidden="true">${this.#initials(name) || '?'}</span>`
          }
        </span>
        ${status ? `<span class="status" aria-hidden="true"></span>` : ''}
      </span>
    `;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Register all components
// ─────────────────────────────────────────────────────────────────────────────

customElements.define('vault-button',   VaultButton);
customElements.define('vault-input',    VaultInput);
customElements.define('vault-textarea', VaultTextarea);
customElements.define('vault-badge',    VaultBadge);
customElements.define('vault-card',     VaultCard);
customElements.define('vault-toggle',   VaultToggle);
customElements.define('vault-select',   VaultSelect);
customElements.define('vault-alert',    VaultAlert);
customElements.define('vault-spinner',  VaultSpinner);
customElements.define('vault-avatar',   VaultAvatar);
