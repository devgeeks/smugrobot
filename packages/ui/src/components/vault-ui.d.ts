/**
 * TypeScript declarations for vault-ui web components.
 * Import this file in tsconfig.json `types` or reference it in your source:
 *   /// <reference types="@smugrobot/ui/components/vault-ui" />
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
  /** primary | secondary | ghost | danger. Default: primary */
  variant: string;
  /** sm | md | lg. Default: md */
  size: string;
  disabled: boolean;
  loading: boolean;
}

interface VaultInputElement extends HTMLElement {
  label: string;
  type: string;
  value: string;
  error: string;
  hint: string;
  /** Text rendered before the input field */
  prefixIcon: string;
  required: boolean;
  disabled: boolean;
  readonly: boolean;
  addEventListener(type: 'vault-input',  listener: (e: CustomEvent<VaultInputDetail>) => void, options?: boolean | AddEventListenerOptions): void;
  addEventListener(type: 'vault-change', listener: (e: CustomEvent<VaultChangeValueDetail>) => void, options?: boolean | AddEventListenerOptions): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
}

interface VaultTextareaElement extends HTMLElement {
  label: string;
  value: string;
  rows: string;
  maxlength: string;
  /** none | vertical | auto. Default: vertical */
  resize: string;
  error: string;
  hint: string;
  addEventListener(type: 'vault-input',  listener: (e: CustomEvent<VaultInputDetail>) => void, options?: boolean | AddEventListenerOptions): void;
  addEventListener(type: 'vault-change', listener: (e: CustomEvent<VaultChangeValueDetail>) => void, options?: boolean | AddEventListenerOptions): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
}

interface VaultBadgeElement extends HTMLElement {
  /** default | success | warn | danger | info. Default: default */
  variant: string;
  /** Show a status dot */
  dot: boolean;
}

interface VaultCardElement extends HTMLElement {
  /** sm | md | lg. Default: md */
  padding: string;
  border: boolean;
  elevated: boolean;
}

interface VaultToggleElement extends HTMLElement {
  checked: boolean;
  label: string;
  hint: string;
  /** sm | md. Default: md */
  size: string;
  disabled: boolean;
  addEventListener(type: 'vault-change', listener: (e: CustomEvent<VaultChangeCheckedDetail>) => void, options?: boolean | AddEventListenerOptions): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
}

interface VaultSelectElement extends HTMLElement {
  label: string;
  value: string;
  error: string;
  hint: string;
  required: boolean;
  addEventListener(type: 'vault-change', listener: (e: CustomEvent<VaultChangeValueDetail>) => void, options?: boolean | AddEventListenerOptions): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
}

interface VaultAlertElement extends HTMLElement {
  /** info | success | warn | danger. Default: info */
  variant: string;
  title: string;
  dismissible: boolean;
  addEventListener(type: 'vault-dismiss', listener: (e: CustomEvent<void>) => void, options?: boolean | AddEventListenerOptions): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
}

interface VaultSpinnerElement extends HTMLElement {
  /** sm | md | lg. Default: md */
  size: string;
  /** Screen-reader label. Default: "Loading…" */
  label: string;
}

interface VaultAvatarElement extends HTMLElement {
  name: string;
  src: string;
  /** sm | md | lg. Default: md */
  size: string;
  /** online | offline | away | busy */
  status: string;
}

interface VaultListboxOptionElement extends HTMLElement {
  value: string;
  selected: boolean;
  disabled: boolean;
}

interface VaultListboxElement extends HTMLElement {
  label: string;
  value: string;
  disabled: boolean;
  /** When present, clicking or keyboard-selecting an option updates value and sets [selected] on that option. */
  selectable: boolean;
  /** When present, removes the border, background, and border-radius so the listbox sits flush in a pane or container. */
  ghost: boolean;
  addEventListener(type: 'vault-change', listener: (e: CustomEvent<VaultListboxChangeDetail>) => void, options?: boolean | AddEventListenerOptions): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
}

interface VaultPopoverElement extends HTMLElement {
  /** bottom-start | bottom-end | bottom | top-start | top-end | top. Default: bottom-start */
  placement: string;
  open: boolean;
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
