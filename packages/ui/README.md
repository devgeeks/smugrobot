# Vault UI

Privacy-focused component library. Zero dependencies. Pure Web Components + CSS custom properties.

Dark by default. Fully accessible. Every component works in any framework or plain HTML.

**Repository:** [github.com/devgeeks/smugrobot](https://github.com/devgeeks/smugrobot/tree/main/packages/ui) · [Issues](https://github.com/devgeeks/smugrobot/issues)

---

## Contents

- [Install](#install)
- [Quick start](#quick-start)
- [Components](#components)
  - [vault-button](#vault-button)
  - [vault-input](#vault-input)
  - [vault-textarea](#vault-textarea)
  - [vault-badge](#vault-badge)
  - [vault-card](#vault-card)
  - [vault-toggle](#vault-toggle)
  - [vault-select](#vault-select)
  - [vault-alert](#vault-alert)
  - [vault-spinner](#vault-spinner)
  - [vault-avatar](#vault-avatar)
  - [vault-popover](#vault-popover)
- [Design tokens](#design-tokens)
- [Theme switching](#theme-switching)
- [Custom components](#custom-components)
- [TypeScript](#typescript)
- [Style guide](#style-guide)
- [Claude Code skill](#claude-code-skill)

---

## Install

The package is private to this monorepo. Reference it by name in any sibling package:

```json
{
  "dependencies": {
    "@smugrobot/ui": "*"
  }
}
```

---

## Quick start

Load these four resources in order — sequence matters:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <!-- 1. Fonts -->
  <link rel="stylesheet" href="node_modules/@smugrobot/ui/src/tokens/fonts.css">
  <!-- 2. Design tokens -->
  <link rel="stylesheet" href="node_modules/@smugrobot/ui/src/tokens/tokens.css">
  <!-- 3. Base reset + utilities -->
  <link rel="stylesheet" href="node_modules/@smugrobot/ui/src/tokens/base.css">
</head>
<body>

  <vault-card border>
    <vault-input label="Passphrase" type="password" required></vault-input>
    <vault-button variant="primary">Unlock vault</vault-button>
  </vault-card>

  <!-- 4. Components (must be type="module") -->
  <script type="module" src="node_modules/@smugrobot/ui/src/components/vault.js"></script>
  <script type="module">
    import { VaultTheme } from '@smugrobot/ui/components/vault.js';
    VaultTheme.init(); // restore saved theme preference
  </script>
</body>
</html>
```

Theme is controlled by `data-theme="light"` on `<html>`. Default is dark.

---

## Components

### vault-button

```html
<vault-button variant="primary" size="md">Label</vault-button>
```

| Attribute | Values | Default | Notes |
|---|---|---|---|
| `variant` | `primary` `secondary` `ghost` `danger` | `primary` | Use `danger` only for destructive, irreversible actions |
| `size` | `sm` `md` `lg` | `md` | |
| `disabled` | boolean | — | |
| `loading` | boolean | — | Disables the button and shows a spinner |

```html
<vault-button variant="primary">Unlock</vault-button>
<vault-button variant="secondary">Cancel</vault-button>
<vault-button variant="ghost" size="sm">Edit</vault-button>
<vault-button variant="danger" loading>Deleting…</vault-button>
<vault-button variant="primary" disabled>Unavailable</vault-button>
```

---

### vault-input

```html
<vault-input label="Email" type="email" required></vault-input>
```

| Attribute | Notes |
|---|---|
| `label` | Rendered as a mono uppercase label above the field |
| `type` | Any native input type. Default: `text` |
| `value` | Reflected to/from the inner `<input>` |
| `error` | Shown instead of hint; turns border red; sets `aria-invalid` |
| `hint` | Helper text. Hidden when `error` is set |
| `prefix-icon` | Short text/character rendered before the cursor — e.g. `$`, `@`, `https://` |
| `required` `disabled` `readonly` | Forwarded to the native input |

**Events**

| Event | Detail | When |
|---|---|---|
| `vault-input` | `{ value: string }` | Every keystroke |
| `vault-change` | `{ value: string }` | On blur / commit |

```html
<vault-input label="Amount" prefix-icon="$" type="number"></vault-input>
<vault-input label="Passphrase" type="password" hint="Min 12 characters"></vault-input>
<vault-input label="Username" error="Already taken" value="tommy"></vault-input>
```

```js
document.querySelector('vault-input').addEventListener('vault-change', e => {
  console.log(e.detail.value);
});
```

---

### vault-textarea

```html
<vault-textarea label="Notes" rows="4"></vault-textarea>
```

| Attribute | Notes |
|---|---|
| `label` | Mono uppercase label |
| `value` | Reflected to/from the inner `<textarea>` |
| `rows` | Initial visible row count. Default: `4` |
| `maxlength` | Shows a live `n / max` counter when set |
| `resize` | `none` `vertical` `auto`. Default: `vertical`. `auto` grows as the user types |
| `error` `hint` | Same as `vault-input` |

Fires the same `vault-input` and `vault-change` events as `vault-input`.

```html
<vault-textarea label="Body" resize="auto" hint="Stored encrypted"></vault-textarea>
<vault-textarea label="Summary" maxlength="280" rows="3"></vault-textarea>
```

---

### vault-badge

Inline status label. Always pair color with a text label — never use color alone to convey meaning.

```html
<vault-badge variant="success" dot>Encrypted</vault-badge>
```

| Attribute | Values | Default |
|---|---|---|
| `variant` | `default` `success` `warn` `danger` `info` | `default` |
| `dot` | boolean — prepends a status dot | — |

```html
<vault-badge variant="default">Draft</vault-badge>
<vault-badge variant="success" dot>Verified</vault-badge>
<vault-badge variant="warn" dot>Expiring soon</vault-badge>
<vault-badge variant="danger">Revoked</vault-badge>
<vault-badge variant="info" dot>Syncing</vault-badge>
```

---

### vault-card

Layout container. Use as a surface for grouping related content.

```html
<vault-card padding="md" border>
  <!-- content -->
</vault-card>
```

| Attribute | Values | Default | Notes |
|---|---|---|---|
| `padding` | `sm` `md` `lg` | `md` | 12 / 16 / 24px |
| `border` | boolean | — | Add when the card sits on a raised surface |
| `elevated` | boolean | — | Adds `--shadow-md`. Use for modal-like prominence |

---

### vault-toggle

Boolean switch with ARIA `role="switch"`.

```html
<vault-toggle label="Auto-lock" hint="Lock after 15 minutes of inactivity" checked></vault-toggle>
```

| Attribute | Values | Default |
|---|---|---|
| `label` | string | — |
| `hint` | string — secondary description below the label | — |
| `size` | `sm` `md` | `md` |
| `checked` | boolean | — |
| `disabled` | boolean | — |

**Events**

| Event | Detail | When |
|---|---|---|
| `vault-change` | `{ checked: boolean }` | On toggle |

```js
document.querySelector('vault-toggle').addEventListener('vault-change', e => {
  console.log(e.detail.checked); // boolean
});
```

---

### vault-select

Dropdown wrapping a native `<select>`. Children are plain `<option>` tags in the light DOM.

```html
<vault-select label="KDF algorithm" value="scrypt">
  <option value="scrypt">scrypt (recommended)</option>
  <option value="pbkdf2">PBKDF2</option>
</vault-select>
```

| Attribute | Notes |
|---|---|
| `label` | Mono uppercase label |
| `value` | Currently selected value |
| `error` `hint` | Same as `vault-input` |
| `required` | Forwarded to the native `<select>` |

`<option>` children are synced via `MutationObserver` — add or remove them at any time.

**Events**

| Event | Detail | When |
|---|---|---|
| `vault-change` | `{ value: string }` | On selection change |

---

### vault-alert

Contextual message. Slides in on render. Always includes a visible icon alongside the variant color.

```html
<vault-alert variant="danger" title="Decryption failed" dismissible>
  Wrong passphrase or corrupted vault.
</vault-alert>
```

| Attribute | Values | Default |
|---|---|---|
| `variant` | `info` `success` `warn` `danger` | `info` |
| `title` | string — bold heading line | — |
| `dismissible` | boolean — adds a close button | — |

Dismiss sets `[hidden]` on the element and fires `vault-dismiss`:

```js
document.querySelector('vault-alert').addEventListener('vault-dismiss', () => {
  // element is now hidden
});
```

---

### vault-spinner

Loading indicator with a screen-reader status announcement.

```html
<vault-spinner size="md" label="Unlocking vault…"></vault-spinner>
```

| Attribute | Values | Default |
|---|---|---|
| `size` | `sm` (16px) `md` (24px) `lg` (40px) | `md` |
| `label` | Screen-reader text (`role="status"`) | `Loading…` |

Animation is suppressed under `prefers-reduced-motion`.

---

### vault-avatar

User or entity avatar. Falls back to initials (max 2 chars) when no `src` is set.

```html
<vault-avatar name="Ada Lovelace" size="md" status="online"></vault-avatar>
<vault-avatar name="Ada Lovelace" src="/avatars/ada.jpg" size="lg"></vault-avatar>
```

| Attribute | Values | Default |
|---|---|---|
| `name` | string — used for initials and `aria-label` | — |
| `src` | image URL | — |
| `size` | `sm` (32px) `md` (40px) `lg` (56px) | `md` |
| `status` | `online` `offline` `away` `busy` | — |

Status dot colors: `online` → cipher-green, `away` → warn, `busy` → danger, `offline` → muted. Shape also differs per status (filled circle, filled square, dashed ring, solid ring) so state doesn't depend on color perception alone.

---

### vault-popover

Positioned panel anchored to a trigger element. Repositions on scroll/resize, closes on outside click or Escape, and respects `prefers-reduced-motion`.

```html
<vault-popover placement="bottom-start">
  <vault-button slot="trigger" variant="secondary">Options</vault-button>
  <div>Panel content</div>
</vault-popover>
```

| Attribute | Values | Default | Notes |
|---|---|---|---|
| `placement` | `top` `bottom` `top-start` `top-end` `bottom-start` `bottom-end` | `bottom-start` | Flips to the opposite axis automatically if there isn't room |
| `open` | boolean | — | Reflects open/closed state; toggle it or call `.close()` |

Put the trigger element in `slot="trigger"`; everything else becomes the panel content.

**Events**

| Event | Detail | When |
|---|---|---|
| `vault-open` | — | Panel opens |
| `vault-close` | — | Panel closes (outside click, Escape, or `.close()`) |

```js
const popover = document.querySelector('vault-popover');
popover.addEventListener('vault-close', () => {
  // panel is now closed
});
```

---

## Design tokens

All tokens are CSS custom properties defined in `src/tokens/tokens.css`. Shadow DOM inherits them automatically — never hardcode hex values.

### Colors

```css
/* Accent — for backgrounds, borders, fills, glows */
var(--cipher)       /* #2ECC8F — trust, verified, active */
var(--warn)         /* #E8A838 */
var(--danger)       /* #D95F5F */
var(--info)         /* #569CD6 */

/* Accent text — WCAG-safe; use for all readable text that conveys status */
var(--cipher-text)  /* dark: #2ECC8F · light: #0F5735 (8.62:1 AAA) */
var(--warn-text)    /* dark: #E8A838 · light: #5C3E0A (9.77:1 AAA) */
var(--danger-text)  /* dark: #D95F5F · light: #C0392B (5.44:1 AA)  */
var(--info-text)    /* dark: #569CD6 · light: #1A5FA8 (6.47:1 AA)  */
```

### Semantic surfaces and text

```css
var(--surface-base)     /* page background */
var(--surface-raised)   /* cards, panels */
var(--surface-overlay)  /* inputs, dropdowns, modals */
var(--surface-border)   /* all borders */
var(--surface-hover)    /* hover backgrounds */

var(--text-primary)     /* body text */
var(--text-secondary)   /* labels, descriptions */
var(--text-muted)       /* placeholders, hints, timestamps */
var(--text-accent)      /* = --cipher-text */
var(--text-inverse)     /* text on --cipher backgrounds */
```

### Spacing

4px base grid. All padding, margin, and gap must use these tokens.

```css
--sp-1: 4px    --sp-2: 8px    --sp-3: 12px   --sp-4: 16px
--sp-5: 20px   --sp-6: 24px   --sp-8: 32px   --sp-10: 40px
--sp-12: 48px  --sp-16: 64px
```

### Typography

```css
var(--font-mono)   /* Geist Mono — headings, labels, code, badges, buttons */
var(--font-body)   /* Geist Sans — prose, input values, descriptions        */
```

### Other

```css
/* Radius — max --radius-lg on non-circular shapes */
var(--radius-sm) var(--radius-md) var(--radius-lg) var(--radius-full)

/* Motion — all respect prefers-reduced-motion */
var(--duration-fast) var(--duration-normal) var(--duration-slow)
var(--ease-out) var(--ease-in) var(--ease-inout)

/* Focus — always use this, never outline */
var(--focus-ring)   /* double ring: surface gap + cipher border */

/* Shadows */
var(--shadow-sm) var(--shadow-md) var(--shadow-lg) var(--shadow-accent)
```

---

## Theme switching

```js
import { VaultTheme } from '@smugrobot/ui/components/vault.js';

VaultTheme.init();        // call once on boot — restores saved preference
VaultTheme.set('dark');   // force dark
VaultTheme.set('light');  // force light
VaultTheme.set(null);     // follow OS preference
VaultTheme.get();         // returns 'dark' | 'light'
```

Internally sets/removes `data-theme="light"` on `<html>` and persists to `localStorage`.

---

## Custom components

When you need a component not in the library, follow this pattern:

```js
// Import TOKEN_BRIDGE from vault.js or copy the pattern
const TOKEN_BRIDGE = `
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    :host { display: block; }
  </style>
`;

class VaultMyThing extends HTMLElement {
  static observedAttributes = ['label', 'value'];

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
        .my-thing {
          background:    var(--surface-raised);
          border:        1px solid var(--surface-border);
          border-radius: var(--radius-md);
          padding:       var(--sp-4);
          font-family:   var(--font-body);
          color:         var(--text-primary);
          transition:    border-color var(--duration-normal) var(--ease-out);
        }
        .my-thing:focus-visible {
          outline: none;
          box-shadow: var(--focus-ring);
        }
        /* Labels always use this style */
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

    // Dispatch events with composed: true so they pierce shadow boundaries
    this.shadowRoot.querySelector('.my-thing').addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('vault-change', {
        detail: { value: 'example' },
        bubbles: true,
        composed: true,
      }));
    });
  }
}

customElements.define('vault-my-thing', VaultMyThing);
```

**After adding a new component:**
1. Add the class + `customElements.define` to `src/components/vault.js`
2. Add the element interface and `HTMLElementTagNameMap` entry to `src/components/vault-ui.d.ts`
3. Add a section to `style-guide.html` showing all variants

---

## TypeScript

Import types in your TypeScript files:

```ts
/// <reference path="node_modules/@smugrobot/ui/src/components/vault-ui.d.ts" />
```

Or add to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "types": []
  },
  "files": [
    "node_modules/@smugrobot/ui/src/components/vault-ui.d.ts"
  ]
}
```

This augments `HTMLElementTagNameMap` so `querySelector('vault-input')` returns the correctly typed `VaultInputElement`.

---

## Style guide

Open `style-guide.html` in a browser for a live reference of every component in all variants, design token swatches, the full type scale, spacing scale, and design decision rationale.

```sh
npm run styleguide
```

Serves the package via `npx serve` at `http://localhost:3900/style-guide/`. No build step required.

---

## Claude Code skill

A Claude Code skill is included at `.claude/skills/vault-ui/SKILL.md`. When active, it gives Claude full knowledge of the component API, design token reference, and all design rules — so it can build screens, create new components, and review code for rule violations without needing to search the codebase first.

### In this monorepo

The skill is already installed at the repo root (`.claude/skills/vault-ui/`) and scoped to this package (`.claude/skills/vault-ui/` inside `packages/ui/`). It activates automatically when you invoke it.

### Usage

```
/vault-ui build a login form with a passphrase input and an unlock button
/vault-ui create a new vault-progress component
/vault-ui review this component for design rule violations
/vault-ui which component should I use for an inline status label?
```

### Installing in another project

Copy the skill directory into your project's `.claude/skills/` folder:

```sh
cp -r packages/ui/.claude/skills/vault-ui path/to/your/project/.claude/skills/
```

Then invoke it with `/vault-ui` in any Claude Code session inside that project.

### What the skill knows

- Full attribute and event API for all 11 components
- Complete design token reference (colors, spacing, typography, radius, motion, focus)
- All design rules (color usage, font roles, spacing constraints, WCAG requirements)
- The new component template pattern
- Post-creation checklist (vault.js → vault-ui.d.ts → style-guide.html)
