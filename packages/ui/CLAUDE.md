# Vault UI — Design System

Privacy-focused component library. Zero dependencies. Pure Web Components + CSS custom properties.

## File structure

```
vault-ui/
├── src/
│   ├── tokens/
│   │   ├── tokens.css   ← all design tokens (CSS custom properties)
│   │   └── base.css     ← reset, typography, utility classes
│   └── components/
│       └── vault.js     ← all web components + VaultTheme helper
└── CLAUDE.md
```

Every app using this library must import in this order:
1. `src/tokens/fonts.css`
2. `src/tokens/tokens.css`
3. `src/tokens/base.css`
4. `src/components/vault.js` (as `type="module"`)

Theme is controlled by `data-theme="light"` on `<html>`. Default is dark.

---

## Components

All components are native custom elements. Zero framework required.

| Tag | Key attributes |
|---|---|
| `<vault-button>` | `variant` (primary\|secondary\|ghost\|danger), `size` (sm\|md\|lg), `disabled`, `loading` |
| `<vault-input>` | `label`, `aria-label`, `type`, `value`, `error`, `hint`, `prefix-icon`, `required`, `disabled`, `readonly` |
| `<vault-textarea>` | `label`, `aria-label`, `value`, `rows`, `maxlength`, `resize` (none\|vertical\|auto), `error`, `hint` |
| `<vault-badge>` | `variant` (default\|success\|warn\|danger\|info), `dot` |
| `<vault-card>` | `padding` (sm\|md\|lg), `border`, `elevated` |
| `<vault-toggle>` | `checked`, `label`, `aria-label`, `hint`, `size` (sm\|md), `disabled` |
| `<vault-select>` | `label`, `aria-label`, `value`, `error`, `hint`, `required` — children are native `<option>` tags |
| `<vault-alert>` | `variant` (info\|success\|warn\|danger), `title`, `dismissible` |
| `<vault-spinner>` | `size` (sm\|md\|lg), `label` (sr-only text) |
| `<vault-avatar>` | `name`, `src`, `size` (sm\|md\|lg), `status` (online\|offline\|away\|busy) |
| `<vault-listbox>` | `label`, `aria-label`, `value`, `disabled`, `selectable`, `ghost` — children are `<vault-listbox-option value="…">` |

All components emit custom events that bubble through shadow DOM (`composed: true`):
- `vault-input` — `{ value: string }` — fires on every keystroke
- `vault-change` — `{ value: string }` or `{ checked: boolean }` — fires on commit/blur

---

## Design tokens

All tokens are CSS custom properties. Shadow DOM inherits them automatically — never hardcode hex values in components.

### Color palette

```
--ink-950: #0D0F0E   surface-base (dark)
--ink-900: #141817   surface-raised (dark)
--ink-800: #1C2020   surface-overlay (dark)
--ink-700: #252B2A   surface-border (dark)
--ink-600: #303938
--ink-500: #7C8A87   text-muted (dark) — 5.35:1 on ink-950
--ink-400: #687270   text-muted (light), UI borders — 4.52:1 on ink-50
--ink-300: #8E9A98   text-secondary (dark)
--ink-100: #CDD4D1
--ink-50:  #F2F5F3   surface-base (light)

--cipher:     #2ECC8F   primary accent (dark bg use: borders, fills, glows)
--cipher-dim: #1E9966   pressed state
--warn:       #E8A838   caution (dark bg use)
--warn-dim:   #C08020
--danger:      #D95F5F   error/risk (dark bg use: borders, tints, icons)
--danger-fill: #C44040   error/risk for solid button fills (white text: 4.81:1 AA)
--danger-dim:  #B03E3E   pressed/hover state
--info:       #569CD6   informational (dark bg use)
```

### WCAG-compliant text tokens

The vivid accent colors above fail WCAG AA on light backgrounds. Always use the `-text` variants for readable text — they automatically switch via `[data-theme="light"]`:

| Token | Dark value | Light value | Light ratio |
|---|---|---|---|
| `--cipher-text` | `#2ECC8F` | `#0F5735` | 8.62:1 AAA |
| `--warn-text` | `#E8A838` | `#5C3E0A` | 9.77:1 AAA |
| `--danger-text` | `#EE6666` | `#C0392B` | 5.15:1 AA / 5.44:1 AA |
| `--info-text` | `#569CD6` | `#1A5FA8` | 6.47:1 AA |

Rule: use `--cipher` for backgrounds/borders/glows. Use `--cipher-text` for any readable text.

### Semantic tokens (use these in components, not raw ink values)

```
--surface-base      background of the page
--surface-raised    cards, panels
--surface-overlay   inputs, dropdowns, modals
--surface-border    all borders
--surface-hover     hover backgrounds

--text-primary      body text
--text-secondary    labels, descriptions
--text-muted        placeholders, hints, timestamps
--text-inverse      text on --cipher backgrounds
--text-accent       = --cipher-text (link-like emphasis)
```

### Spacing (4px base grid — always use these, never arbitrary px values)

```
--sp-1: 4px   --sp-2: 8px   --sp-3: 12px  --sp-4: 16px
--sp-5: 20px  --sp-6: 24px  --sp-8: 32px  --sp-10: 40px
--sp-12: 48px --sp-16: 64px
```

### Typography

```
--font-mono: 'Geist Mono', monospace   → headings, labels, code, metadata
--font-body: 'Geist', system-ui, sans  → prose, input values, descriptions

--text-xs: 0.70rem    --text-sm: 0.8125rem  --text-base: 0.9375rem
--text-lg: 1.0625rem  --text-xl: 1.25rem    --text-2xl: 1.5rem
--text-3xl: 1.875rem  --text-4xl: 2.25rem
```

Labels use `--font-mono` at `--text-xs`, `font-weight: 500`, `letter-spacing: 0.08em`.

### Radius

```
--radius-sm: 4px   --radius-md: 8px   --radius-lg: 12px   --radius-full: 9999px
```

Max `--radius-lg` for non-circular shapes. Pillls and avatars use `--radius-full`.

### Motion

```
--duration-fast: 100ms    micro-interactions (hover, press)
--duration-normal: 175ms  state changes (focus, toggle, expand)
--duration-slow: 300ms    entrances, alerts

--ease-out:   cubic-bezier(0.0, 0.0, 0.2, 1)   default for all transitions
--ease-in:    cubic-bezier(0.4, 0.0, 1.0, 1)
--ease-inout: cubic-bezier(0.4, 0.0, 0.2, 1)
```

### Focus & shadows

```
--focus-ring: 0 0 0 2px var(--surface-base), 0 0 0 4px var(--cipher)

--shadow-sm   --shadow-md   --shadow-lg   --shadow-accent
```

---

## Rules — always follow these

**Color**
- Never hardcode hex values. Always use tokens.
- Use `--cipher` for backgrounds, borders, fills, glows.
- Use `--cipher-text` (and `--warn-text`, `--danger-text`, `--info-text`) for all readable text that conveys status.
- `--cipher` signals trust and verified state only — never use it decoratively.

**Typography**
- `--font-mono` for all headings, field labels, code, badges, button text, metadata.
- `--font-body` for all prose, input values, descriptions, alert body text.

**Spacing**
- All padding, margin, gap must use `--sp-*` tokens. Never use arbitrary px/rem values.

**Borders & radius**
- All borders: `1px solid var(--surface-border)` or `1.5px solid` for inputs/buttons.
- Never exceed `--radius-lg` (12px) on non-circular elements.

**Focus**
- Every interactive element must have `:focus-visible` with `box-shadow: var(--focus-ring)`.
- Never use `outline` for focus — always `box-shadow`.

**Motion**
- Every transition must respect `prefers-reduced-motion` (already handled in `tokens.css`).
- Use `var(--ease-out)` by default.
- Only animate properties that communicate a state change. No decorative animation.

**WCAG**
- All text must meet WCAG AA minimum 4.5:1 contrast ratio.
- All UI components and graphical objects must meet 3:1 (e.g. borders, icons).
- Never use colour alone to convey meaning — pair with an icon or label.
- Every `<vault-input>`, `<vault-textarea>`, `<vault-select>`, `<vault-toggle>`, and `<vault-listbox>` must have an accessible name — set `label` (preferred, visible) or `aria-label` (visually hidden, e.g. an icon-only field, or a listbox already paired with a visible heading elsewhere on the page). Never ship one with neither. Each component logs a `console.warn` in dev when both are missing; treat that warning as a build-blocking bug, not noise.

**Grammar**
- All labels, button text, headings, and UI copy must use sentence case (e.g. "Add folder", "New note", "Delete note?").
- Never use title case or ALL CAPS in UI text.
- Never apply `text-transform: uppercase` in CSS — not in components, not in page-level styles.

**New components**
- Extend `HTMLElement`. Use Shadow DOM (`attachShadow({ mode: 'open' })`).
- Inject `TOKEN_BRIDGE` (copy the pattern from `vault.js`) so all `--*` tokens work inside shadow DOM.
- Register with `customElements.define('vault-my-thing', MyThing)` at the bottom of `vault.js`.
- Emit events with `{ bubbles: true, composed: true }` so they pierce shadow boundaries.
- Add TypeScript types to `vault-ui.d.ts`.

---

## Theme switching

```js
import { VaultTheme } from './src/components/vault.js';

VaultTheme.init();           // call once on boot — restores saved preference
VaultTheme.set('dark');
VaultTheme.set('light');
VaultTheme.set(null);        // follow OS preference
VaultTheme.get();            // returns 'dark' | 'light'
```

Internally this sets/removes `data-theme="light"` on `<html>` and persists to `localStorage`.

---

## Listening to events

```js
// Any component — events bubble out of shadow DOM
document.querySelector('vault-input').addEventListener('vault-change', e => {
  console.log(e.detail.value);   // string
});

document.querySelector('vault-toggle').addEventListener('vault-change', e => {
  console.log(e.detail.checked); // boolean
});

document.querySelector('vault-select').addEventListener('vault-change', e => {
  console.log(e.detail.value);   // string
});
```

---

## Minimal working example

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My App</title>
  <link rel="stylesheet" href="vault-ui/src/tokens/fonts.css">
  <link rel="stylesheet" href="vault-ui/src/tokens/tokens.css">
  <link rel="stylesheet" href="vault-ui/src/tokens/base.css">
</head>
<body>
  <vault-card>
    <vault-input label="Passphrase" type="password" required></vault-input>
    <vault-button variant="primary">Unlock</vault-button>
  </vault-card>
  <script type="module" src="vault-ui/src/components/vault.js"></script>
  <script type="module">
    import { VaultTheme } from './vault-ui/src/components/vault.js';
    VaultTheme.init();
  </script>
</body>
</html>
```

---

## Custom component template

When building a one-off component that isn't in the library, follow this pattern exactly:

```css
.my-component {
  background:    var(--surface-raised);
  border:        1px solid var(--surface-border);
  border-radius: var(--radius-md);
  padding:       var(--sp-4);
  font-family:   var(--font-body);
  color:         var(--text-primary);
  transition:    border-color var(--duration-normal) var(--ease-out);
}

.my-component:hover {
  border-color: var(--ink-400);
}

.my-component:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

/* Labels always look like this */
.my-component__label {
  font-family:    var(--font-mono);
  font-size:      var(--text-xs);
  font-weight:    500;
  letter-spacing: 0.08em;
  color:          var(--text-secondary);
}
```
