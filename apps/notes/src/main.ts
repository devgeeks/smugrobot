import '@smugrobot/ui/tokens/fonts.css'
import '@smugrobot/ui/tokens/tokens.css'
import '@smugrobot/ui/tokens/base.css'
import '@smugrobot/ui/components/vault.js'
import './styles/app.css'
import { VaultTheme } from '@smugrobot/ui/components/vault-theme.js'
import { detectVault } from './db/vault.js'
import { dispatch, getState, subscribe } from './state/store.js'
import { mountUnlockScreen } from './screens/unlock-screen.js'
import { mountAppScreen, unmountAppScreen } from './screens/app-screen.js'

VaultTheme.init()

const root = document.getElementById('app')!

let currentScreen = ''

subscribe(async () => {
  const state = getState()
  if (state.screen === currentScreen) return
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
    dispatch({ type: 'VAULT_DETECTED', exists, adapter })
  } catch (err) {
    console.error('Failed to initialise vault adapter:', err)
  }
}

boot()
