---
name: vault-ui
description: Use this skill when the user asks to build UI, create screens, add components, style elements, or implement anything visual using the vault-ui design system in this project. Also use it when the user asks to create a new vault-ui component, review component code for design rule violations, or asks questions about which component or token to use.
version: 0.1.0
---

# Vault UI — Design System Skill

You are building UI for the Vault UI design system. This is a zero-dependency Web Components library living at `packages/ui/`. All components are in `packages/ui/src/components/vault.js`. Design tokens are in `packages/ui/src/tokens/tokens.css`.

Read `packages/ui/CLAUDE.md` now if you haven't already — it is the authoritative reference. What follows is a practical working guide.

---

## Import checklist

Every page using vault-ui must load these in order:

```html
<link rel="stylesheet" href="path/to/tokens/fonts.css">
<link rel="stylesheet" href="path/to/tokens/tokens.css">
<link rel="stylesheet" href="path/to/tokens/base.css">
<script type="module" src="path/to/components/vault.js"></script>
```

For theme support, call `VaultTheme.init()` once on boot:

```js
import { VaultTheme } from './components/vault.js';
VaultTheme.init(); // restores saved preference; defaults to dark
```

---

## Component API

### `<vault-button>`
```html
<vault-button variant="primary|secondary|ghost|danger" size="sm|md|lg" disabled loading>
  Label
</vault-button>
```
- `variant` default: `primary`. Use `danger` only for destructive, irreversible actions.
- `loading` disables the button and shows a spinner. Use while awaiting async operations.
- Fires native `click`. No custom events.

### `<vault-input>`
```html
<vault-input
  label="Field label"
  type="text|password|email|number|…"
  value="…"
  error="Error message"
  hint="Helper text"
  prefix-icon="$"
  required disabled readonly>
</vault-input>
```
- `error` takes priority over `hint`. Sets `aria-invalid` automatically.
- `prefix-icon` is inline text/character before the cursor — good for `$`, `@`, `https://`.
- Events: `vault-input` `{ value }` every keystroke; `vault-change` `{ value }` on blur/commit.

### `<vault-textarea>`
```html
<vault-textarea label="…" value="…" rows="4" maxlength="500" resize="none|vertical|auto" error="…" hint="…">
</vault-textarea>
```
- `resize="auto"` grows the element as the user types — never shows a scrollbar.
- `maxlength` shows a live `n / max` counter bottom-right.
- Same events as `vault-input`.

### `<vault-badge>`
```html
<vault-badge variant="default|success|warn|danger|info" dot>Label</vault-badge>
```
- Always include a text label alongside color. Never rely on color alone.
- `dot` adds a status dot before the text.

### `<vault-card>`
```html
<vault-card padding="sm|md|lg" border elevated>
  <!-- any content -->
</vault-card>
```
- Default: no border, no shadow. Add `border` when the card sits on a raised surface.
- `elevated` adds `--shadow-md`. Use for modal-like prominence.

### `<vault-toggle>`
```html
<vault-toggle label="…" hint="…" size="sm|md" checked disabled></vault-toggle>
```
- Uses `role="switch"` + `aria-checked`. Fully keyboard accessible.
- Event: `vault-change` `{ checked: boolean }`.

### `<vault-select>`
```html
<vault-select label="…" value="scrypt" error="…" hint="…" required>
  <option value="scrypt">scrypt (recommended)</option>
  <option value="pbkdf2">PBKDF2</option>
</vault-select>
```
- `<option>` children live in the light DOM — add/remove them any time.
- Event: `vault-change` `{ value: string }`.

### `<vault-alert>`
```html
<vault-alert variant="info|success|warn|danger" title="…" dismissible>
  Body text here.
</vault-alert>
```
- Slides in on render. `dismissible` adds a close button.
- Dismiss sets `[hidden]` on the element and fires `vault-dismiss`.

### `<vault-spinner>`
```html
<vault-spinner size="sm|md|lg" label="Loading…"></vault-spinner>
```
- `label` is sr-only (`role="status"`). Always set a meaningful label.

### `<vault-avatar>`
```html
<vault-avatar name="Ada Lovelace" src="/avatars/ada.jpg" size="sm|md|lg" status="online|offline|away|busy">
</vault-avatar>
```
- Falls back to initials (max 2 chars) when `src` is absent or fails to load.
- `status` dot colors: online → cipher, away → warn, busy → danger, offline → muted.

---

## Event listening pattern

All events bubble out of shadow DOM (`composed: true`). Listen on the element or any ancestor:

```js
document.querySelector('vault-input').addEventListener('vault-input', e => {
  console.log(e.detail.value);      // every keystroke
});
document.querySelector('vault-input').addEventListener('vault-change', e => {
  console.log(e.detail.value);      // on blur / commit
});
document.querySelector('vault-toggle').addEventListener('vault-change', e => {
  console.log(e.detail.checked);    // boolean
});
document.querySelector('vault-select').addEventListener('vault-change', e => {
  console.log(e.detail.value);
});
document.querySelector('vault-alert').addEventListener('vault-dismiss', () => {
  // alert is now hidden
});
```

---

## Token quick reference

Use these in any page-level CSS or custom components. Never hardcode hex values.

**Surfaces (dark → light automatically)**
```css
var(--surface-base)     /* page background */
var(--surface-raised)   /* cards, panels */
var(--surface-overlay)  /* inputs, dropdowns */
var(--surface-border)   /* all borders */
var(--surface-hover)    /* hover backgrounds */
```

**Text**
```css
var(--text-primary)     /* body text */
var(--text-secondary)   /* labels, descriptions */
var(--text-muted)       /* placeholders, hints */
var(--text-accent)      /* = --cipher-text, link-like */
var(--text-inverse)     /* text on --cipher backgrounds */
```

**Accents — use the right token for the right job**
```css
/* For backgrounds, borders, fills, glows: */
var(--cipher)      var(--warn)      var(--danger)      var(--info)

/* For readable text (WCAG-safe, auto-adapts in light mode): */
var(--cipher-text) var(--warn-text) var(--danger-text) var(--info-text)
```

**Spacing (4px grid — always use these)**
```css
var(--sp-1)  /* 4px */   var(--sp-2)  /* 8px */   var(--sp-3)  /* 12px */
var(--sp-4)  /* 16px */  var(--sp-6)  /* 24px */  var(--sp-8)  /* 32px */
var(--sp-10) /* 40px */  var(--sp-12) /* 48px */  var(--sp-16) /* 64px */
```

**Typography**
```css
var(--font-mono)   /* Geist Mono — headings, labels, code, badges, buttons */
var(--font-body)   /* Geist Sans — prose, input values, descriptions */
```

**Motion (all respect prefers-reduced-motion)**
```css
var(--duration-fast)   /* 100ms — hover, press */
var(--duration-normal) /* 175ms — focus, toggle */
var(--duration-slow)   /* 300ms — entrance, alert */
var(--ease-out)        /* default for all transitions */
```

**Radius**
```css
var(--radius-sm)    /* 4px */   var(--radius-md)   /* 8px */
var(--radius-lg)    /* 12px — max for non-circular shapes */
var(--radius-full)  /* 9999px — pills, avatars */
```

---

## Label style — all field labels must look exactly like this

```css
font-family:    var(--font-mono);
font-size:      var(--text-xs);
font-weight:    500;
letter-spacing: 0.08em;
color:          var(--text-secondary);
```

---

## Rules — enforce these on every output

| Category | Rule |
|---|---|
| Color | Never hardcode hex. Always use tokens. |
| Color | `--cipher` for backgrounds / borders / fills / glows. `--cipher-text` for readable text. |
| Color | `--cipher` signals trust / verified state only. Never decorative. |
| Color | Never convey meaning with color alone — pair with icon or label. |
| Typography | `--font-mono` for headings, labels, code, badges, button text, metadata. |
| Typography | `--font-body` for prose, input values, descriptions, alert body. |
| Spacing | All padding/margin/gap must use `--sp-*`. No arbitrary px/rem. |
| Borders | `1px solid var(--surface-border)` or `1.5px solid` for interactive elements. |
| Radius | Never exceed `--radius-lg` (12px) on non-circular elements. |
| Focus | Every interactive element: `:focus-visible { outline: none; box-shadow: var(--focus-ring); }` |
| Motion | Every transition must use `var(--ease-out)` and a `--duration-*` token. |
| Motion | Only animate properties that communicate state change. No decorative animation. |
| WCAG | All text ≥ 4.5:1. All UI components / graphical objects ≥ 3:1. |

---

## Building new custom components

When the user needs a component not in the library, follow this pattern exactly:

```js
class VaultMyThing extends HTMLElement {
  static observedAttributes = ['attr-one', 'attr-two'];

  connectedCallback() {
    if (!this.shadowRoot) this.#render();
  }

  attributeChangedCallback() {
    if (this.shadowRoot) this.#render();
  }

  #render() {
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });

    this.shadowRoot.innerHTML = TOKEN_BRIDGE + `
      <style>
        /* Token bridge already sets box-sizing and :host { display: block } */
        .my-thing {
          background:    var(--surface-raised);
          border:        1px solid var(--surface-border);
          border-radius: var(--radius-md);
          padding:       var(--sp-4);
          font-family:   var(--font-body);
          color:         var(--text-primary);
          transition:    border-color var(--duration-normal) var(--ease-out);
        }
        .my-thing:hover {
          border-color: var(--ink-400);
        }
        .my-thing:focus-visible {
          outline: none;
          box-shadow: var(--focus-ring);
        }
        .my-thing__label {
          font-family:    var(--font-mono);
          font-size:      var(--text-xs);
          font-weight:    500;
          letter-spacing: 0.08em;
          color:          var(--text-secondary);
        }
      </style>
      <div class="my-thing">
        <slot></slot>
      </div>
    `;

    // Dispatch events with { bubbles: true, composed: true }
  }
}

customElements.define('vault-my-thing', VaultMyThing);
```

**After adding a new component:**
1. Create `packages/ui/src/components/vault-my-thing.js` following the template above — import TOKEN_BRIDGE, define the class, call `customElements.define`, export the class.
2. Add the export to `packages/ui/src/components/vault.js` (the barrel).
3. Add TypeScript types to `packages/ui/src/components/vault-ui.d.ts` — both the element interface and the `HTMLElementTagNameMap` augmentation.
4. Add a section to `packages/ui/style-guide/index.html` showing all variants.

---

## How to approach requests

**"Build me a [screen/form/page]"**
1. Choose the right vault-ui components for each element.
2. Use semantic HTML structure around the components.
3. Apply spacing with `--sp-*` tokens in page-level CSS, not inline.
4. Wire events to any needed logic.
5. Verify every interactive element has a visible focus state.

**"Create a new [component name] component"**
1. Check whether an existing component covers the need with different attributes.
2. If genuinely new, follow the new component template above.
3. Use only `--*` tokens — no hardcoded values anywhere.
4. Write the TypeScript declaration and style guide entry before finishing.

**"Review this component / code"**
Scan for violations of the rules table above. Report each one as: rule broken → specific line/value → what it should be instead.

**"Which component / token should I use for X?"**
Recommend the most specific option that fits. If between two components, explain the semantic difference (e.g. `vault-badge` vs `vault-alert` — badges are inline status labels; alerts are page-level messages that need to be read immediately).
