import '@smugrobot/ui/tokens/fonts.css'
import '@smugrobot/ui/tokens/tokens.css'
import '@smugrobot/ui/tokens/base.css'
import '@smugrobot/ui/components/vault.js'
import './styles/app.css'
import { VaultTheme } from '@smugrobot/ui/components/vault-theme.js'
import {
  detectVault,
  openVaultFromKey,
  loadKeyFromSession,
  clearSessionKey,
} from './db/vault.js'
import { dispatch, getState, subscribe } from './state/store.js'
import { mountUnlockScreen } from './screens/unlock-screen.js'
import { mountAppScreen, unmountAppScreen } from './screens/app-screen.js'

if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    for (const reg of regs) reg.unregister()
  })
  if ('caches' in window) {
    caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)))
  }
}

VaultTheme.init()

const versionBadge = document.createElement('div')
versionBadge.className = 'app-version-badge'
versionBadge.textContent = `v${__APP_VERSION__}`
document.body.appendChild(versionBadge)

const root = document.getElementById('app')!

// Shown until detectVault() resolves and boot() dispatches the first real
// screen transition — otherwise a slow IndexedDB open leaves a blank page.
root.innerHTML = `<div class="app-loading"><vault-spinner size="lg" label="Loading…"></vault-spinner></div>`

let currentScreen = ''

subscribe(async () => {
  const state = getState()
  if (state.screen === currentScreen) return

  // Transitioning away from app → clear cached session key
  if (currentScreen === 'app' && state.screen === 'unlock') {
    clearSessionKey()
  }

  currentScreen = state.screen

  if (state.screen === 'unlock') {
    unmountAppScreen()
    mountUnlockScreen(root)
  } else if (state.screen === 'app') {
    await mountAppScreen(root)
  }
})

async function boot() {
  try {
    const { adapter, exists } = await detectVault()

    // Fast path: resume from sessionStorage key (no KDF wait)
    if (exists) {
      const cachedKey = loadKeyFromSession()
      if (cachedKey) {
        try {
          const store = await openVaultFromKey(adapter, cachedKey)
          dispatch({ type: 'VAULT_DETECTED', exists, adapter })
          dispatch({ type: 'UNLOCKED', store })
          return
        } catch {
          // Key invalid or vault changed — fall through to passphrase screen
        }
      }
    }

    dispatch({ type: 'VAULT_DETECTED', exists, adapter })
  } catch (err) {
    console.error('Failed to initialise vault adapter:', err)
  }
}

boot()
