import { TOKEN_BRIDGE } from './token-bridge.js';

class VaultPopover extends HTMLElement {
  static observedAttributes = ['placement', 'open'];

  #outsideClick = null;
  #escapeKey    = null;
  #reposition   = null;

  connectedCallback() {
    if (!this.shadowRoot) this.#render();
  }

  attributeChangedCallback(name) {
    if (this.shadowRoot && name === 'open') this.#syncOpen();
  }

  disconnectedCallback() {
    this.#cleanup();
  }

  close() {
    this.removeAttribute('open');
  }

  #render() {
    this.attachShadow({ mode: 'open' });

    this.shadowRoot.innerHTML = TOKEN_BRIDGE + `
      <style>
        :host { display: inline-block; position: relative; }

        .panel {
          position: fixed;
          z-index: 200;
          background: var(--surface-overlay);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-md);
          min-width: 160px;
          font-family: var(--font-body);
          color: var(--text-primary);
        }

        .panel[hidden] { display: none; }

        .panel.animate {
          animation: popover-in var(--duration-normal) var(--ease-out) both;
        }

        @keyframes popover-in {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @media (prefers-reduced-motion: reduce) {
          .panel.animate { animation: none; }
        }
      </style>
      <slot name="trigger"></slot>
      <div class="panel" hidden role="dialog" aria-modal="false">
        <slot></slot>
      </div>
    `;

    // Mouse/touch presses are handled on pointerup rather than click: with
    // this many layers of slotted shadow DOM (listbox option > popover >
    // button), Firefox dispatches the click event with the wrong target
    // (an ancestor of the trigger) even though pointerup targets correctly.
    // pointerup still fires on release rather than press, so a press that's
    // dragged off the trigger before release is not treated as an
    // activation — same cancellable behavior "click" would give.
    // Keyboard/assistive-tech activation (Enter/Space) only ever dispatches
    // a click with no preceding pointerup, so it's still handled below —
    // detail === 0 distinguishes it from a real mouse click, avoiding a
    // double-toggle when both fire for an ordinary click.
    this.addEventListener('pointerup', this.#handleTriggerActivate);
    this.addEventListener('click', this.#handleTriggerActivate);
  }

  #handleTriggerActivate = (e) => {
    if (e.type === 'pointerup' && e.button !== 0) return;
    if (e.type === 'click' && e.detail !== 0) return;
    const triggerSlot = this.shadowRoot.querySelector('slot[name="trigger"]');
    const assigned = triggerSlot.assignedElements();
    const path = e.composedPath();
    if (assigned.some((el) => path.includes(el))) this.toggleAttribute('open');
  };

  #syncOpen() {
    const panel = this.shadowRoot.querySelector('.panel');
    const isOpen = this.hasAttribute('open');

    if (isOpen) {
      panel.removeAttribute('hidden');
      panel.classList.remove('animate');
      // Force reflow so animation re-triggers on each open
      void panel.offsetWidth;
      panel.classList.add('animate');
      this.#position();

      this.#reposition = () => this.#position();
      window.addEventListener('scroll', this.#reposition, { capture: true, passive: true });
      window.addEventListener('resize', this.#reposition, { passive: true });

      this.#outsideClick = (e) => {
        if (!this.contains(e.target) && !this.shadowRoot.contains(e.target)) {
          this.close();
        }
      };
      this.#escapeKey = (e) => {
        if (e.key === 'Escape') {
          this.close();
          const trigger = this.shadowRoot.querySelector('slot[name="trigger"]').assignedElements()[0];
          trigger?.focus();
        }
      };

      setTimeout(() => {
        document.addEventListener('pointerdown', this.#outsideClick);
        document.addEventListener('keydown', this.#escapeKey);
      }, 0);

      this.dispatchEvent(new CustomEvent('vault-open', { bubbles: true, composed: true }));
    } else {
      panel.setAttribute('hidden', '');
      this.#cleanup();
      this.dispatchEvent(new CustomEvent('vault-close', { bubbles: true, composed: true }));
    }
  }

  #position() {
    const panel       = this.shadowRoot.querySelector('.panel');
    const triggerSlot = this.shadowRoot.querySelector('slot[name="trigger"]');
    const trigger     = triggerSlot.assignedElements()[0];
    if (!trigger) return;

    const rect      = trigger.getBoundingClientRect();
    const placement = this.getAttribute('placement') || 'bottom-start';
    const gap       = 4;

    // Measure panel dimensions (temporarily un-hidden if needed)
    panel.style.visibility = 'hidden';
    panel.removeAttribute('hidden');
    const panelW = panel.offsetWidth;
    const panelH = panel.offsetHeight;
    panel.style.visibility = '';

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let [axis, align] = placement.split('-');

    // Flip axis if not enough room
    if (axis === 'bottom' && rect.bottom + gap + panelH > vh && rect.top - gap - panelH >= 0) {
      axis = 'top';
    } else if (axis === 'top' && rect.top - gap - panelH < 0 && rect.bottom + gap + panelH <= vh) {
      axis = 'bottom';
    }

    let top, left;

    if (axis === 'bottom') {
      top = rect.bottom + gap;
    } else {
      top = rect.top - gap - panelH;
    }

    if (align === 'start' || !align) {
      left = rect.left;
    } else if (align === 'end') {
      left = rect.right - panelW;
    } else {
      left = rect.left + rect.width / 2 - panelW / 2;
    }

    // Clamp to viewport with a small margin
    const margin = 8;
    left = Math.max(margin, Math.min(left, vw - panelW - margin));
    top  = Math.max(margin, Math.min(top,  vh - panelH - margin));

    panel.style.top  = `${top}px`;
    panel.style.left = `${left}px`;
  }

  #cleanup() {
    if (this.#outsideClick) {
      document.removeEventListener('pointerdown', this.#outsideClick);
      this.#outsideClick = null;
    }
    if (this.#escapeKey) {
      document.removeEventListener('keydown', this.#escapeKey);
      this.#escapeKey = null;
    }
    if (this.#reposition) {
      window.removeEventListener('scroll', this.#reposition, { capture: true });
      window.removeEventListener('resize', this.#reposition);
      this.#reposition = null;
    }
  }
}

customElements.define('vault-popover', VaultPopover);

export { VaultPopover };
