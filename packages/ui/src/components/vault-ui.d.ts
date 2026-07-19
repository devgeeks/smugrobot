/**
 * TypeScript declarations for vault-ui web components.
 * Import this file in tsconfig.json `types` or reference it in your source:
 *   /// <reference types="@smugrobot/ui/components/vault-ui" />
 *
 * Only `value` (input/textarea/select/listbox) and `checked` (toggle) are
 * real JS accessors — setting them updates the live element. Every other
 * config below is attribute-only: it's typed here so `el.getAttribute(...)`
 * and JSX/template usage get autocomplete, but `el.variant = 'danger'`
 * silently sets a plain object property and does nothing. Use
 * `el.setAttribute('variant', 'danger')` (or the HTML attribute) instead.
 */

export declare const VaultTheme: {
  /** Call once on boot — restores saved preference from localStorage. */
  init(): void;
  /** Set theme explicitly. Pass null to follow OS preference. */
  set(theme: 'light' | 'dark' | null): void;
  /** Returns the current active theme. */
  get(): 'light' | 'dark';
};

// ── Custom event detail types ──────────────────────────────────────────────

interface VaultInputDetail          { value: string }
interface VaultListboxChangeDetail  { value: string }
interface VaultChangeValueDetail  { value: string }
interface VaultChangeCheckedDetail { checked: boolean }

// ── Element interfaces ─────────────────────────────────────────────────────

interface VaultButtonElement extends HTMLElement {
  // variant, size, disabled, loading: attribute-only — see file header.
}

interface VaultInputElement extends HTMLElement {
  value: string;
  // label, type, error, hint, prefix-icon, required, disabled, readonly: attribute-only — see file header.
  addEventListener(type: 'vault-input',  listener: (e: CustomEvent<VaultInputDetail>) => void, options?: boolean | AddEventListenerOptions): void;
  addEventListener(type: 'vault-change', listener: (e: CustomEvent<VaultChangeValueDetail>) => void, options?: boolean | AddEventListenerOptions): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
}

interface VaultTextareaElement extends HTMLElement {
  value: string;
  // label, rows, maxlength, resize, error, hint: attribute-only — see file header.
  addEventListener(type: 'vault-input',  listener: (e: CustomEvent<VaultInputDetail>) => void, options?: boolean | AddEventListenerOptions): void;
  addEventListener(type: 'vault-change', listener: (e: CustomEvent<VaultChangeValueDetail>) => void, options?: boolean | AddEventListenerOptions): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
}

interface VaultBadgeElement extends HTMLElement {
  // variant, dot: attribute-only — see file header.
}

interface VaultCardElement extends HTMLElement {
  // padding, border, elevated: attribute-only — see file header.
}

interface VaultToggleElement extends HTMLElement {
  checked: boolean;
  // label, hint, size, disabled: attribute-only — see file header.
  addEventListener(type: 'vault-change', listener: (e: CustomEvent<VaultChangeCheckedDetail>) => void, options?: boolean | AddEventListenerOptions): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
}

interface VaultSelectElement extends HTMLElement {
  value: string;
  // label, error, hint, required: attribute-only — see file header.
  addEventListener(type: 'vault-change', listener: (e: CustomEvent<VaultChangeValueDetail>) => void, options?: boolean | AddEventListenerOptions): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
}

interface VaultAlertElement extends HTMLElement {
  // variant, title, dismissible: attribute-only — see file header.
  addEventListener(type: 'vault-dismiss', listener: (e: CustomEvent<void>) => void, options?: boolean | AddEventListenerOptions): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
}

interface VaultSpinnerElement extends HTMLElement {
  // size, label: attribute-only — see file header.
}

interface VaultAvatarElement extends HTMLElement {
  // name, src, size, status: attribute-only — see file header.
}

interface VaultListboxOptionElement extends HTMLElement {
  // value, selected, disabled: attribute-only — see file header.
}

interface VaultListboxElement extends HTMLElement {
  value: string;
  // label, disabled, selectable, ghost: attribute-only — see file header.
  addEventListener(type: 'vault-change', listener: (e: CustomEvent<VaultListboxChangeDetail>) => void, options?: boolean | AddEventListenerOptions): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
}

interface VaultPopoverElement extends HTMLElement {
  // placement, open: attribute-only — see file header.
  /** Programmatically close the popover and return focus to the trigger */
  close(): void;
  addEventListener(type: 'vault-open',  listener: (e: CustomEvent<void>) => void, options?: boolean | AddEventListenerOptions): void;
  addEventListener(type: 'vault-close', listener: (e: CustomEvent<void>) => void, options?: boolean | AddEventListenerOptions): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
}

// ── HTMLElementTagNameMap augmentation ────────────────────────────────────

declare global {
  interface HTMLElementTagNameMap {
    'vault-button':   VaultButtonElement;
    'vault-input':    VaultInputElement;
    'vault-textarea': VaultTextareaElement;
    'vault-badge':    VaultBadgeElement;
    'vault-card':     VaultCardElement;
    'vault-toggle':   VaultToggleElement;
    'vault-select':   VaultSelectElement;
    'vault-alert':    VaultAlertElement;
    'vault-spinner':  VaultSpinnerElement;
    'vault-avatar':   VaultAvatarElement;
    'vault-popover':         VaultPopoverElement;
    'vault-listbox':         VaultListboxElement;
    'vault-listbox-option':  VaultListboxOptionElement;
  }
}
