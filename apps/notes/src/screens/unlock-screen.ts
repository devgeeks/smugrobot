import { dispatch, getState, subscribe } from '../state/store.js'
import { createVault, openVault } from '../db/vault.js'
import { EchidnaJsError } from 'echidna.js'

export function mountUnlockScreen(root: HTMLElement): () => void {
  const state = getState()
  root.innerHTML = ''

  const wrap = document.createElement('div')
  wrap.className = 'unlock-wrap'

  const creating = !state.vaultExists
  wrap.innerHTML = `
    <vault-card border class="unlock-card">
      <div class="unlock-logo">Notes</div>
      <h1 class="unlock-heading">${creating ? 'Create a master passphrase' : 'Enter your passphrase'}</h1>
      <p class="unlock-sub">${creating
        ? 'Your notes will be encrypted with this passphrase. Don\'t lose it — it cannot be recovered.'
        : 'Enter your passphrase to unlock your notes.'
      }</p>
      <div id="unlock-alert-slot"></div>
      <div class="unlock-fields">
        <vault-input
          id="passphrase-input"
          type="password"
          label="Passphrase"
          required
          autocomplete="${creating ? 'new-password' : 'current-password'}"
        ></vault-input>
        ${creating ? `<vault-input
          id="confirm-input"
          type="password"
          label="Confirm passphrase"
          required
          autocomplete="new-password"
        ></vault-input>` : ''}
      </div>
      <vault-button variant="primary" id="unlock-btn" class="unlock-submit">
        ${creating ? 'Create vault' : 'Unlock'}
      </vault-button>
    </vault-card>
  `

  root.appendChild(wrap)

  const btn = wrap.querySelector('#unlock-btn') as HTMLElement
  const passphraseInput = wrap.querySelector('#passphrase-input') as HTMLElement & { value: string }
  const confirmInput = wrap.querySelector('#confirm-input') as (HTMLElement & { value: string }) | null
  const alertSlot = wrap.querySelector('#unlock-alert-slot')!

  const showError = (msg: string) => {
    alertSlot.innerHTML = `<vault-alert variant="danger">${escapeHtml(msg)}</vault-alert>`
  }

  const clearError = () => {
    alertSlot.innerHTML = ''
  }

  passphraseInput.addEventListener('vault-input', clearError)
  confirmInput?.addEventListener('vault-input', clearError)

  const doUnlock = async () => {
    const passphrase: string = (passphraseInput as unknown as { value: string }).value ?? ''
    if (!passphrase) {
      showError('Please enter your passphrase.')
      return
    }

    if (creating) {
      const confirm: string = (confirmInput as unknown as { value: string } | null)?.value ?? ''
      if (passphrase !== confirm) {
        showError('Passphrases do not match.')
        return
      }
    }

    btn.setAttribute('loading', '')
    btn.setAttribute('disabled', '')
    clearError()

    try {
      const currentState = getState()
      if (!currentState.adapter) throw new Error('No adapter')
      const store = creating
        ? await createVault(currentState.adapter, passphrase)
        : await openVault(currentState.adapter, passphrase)
      dispatch({ type: 'UNLOCKED', store })
    } catch (err) {
      if (err instanceof EchidnaJsError && err.code === 'WRONG_KEY') {
        dispatch({ type: 'UNLOCK_ERROR', message: 'Wrong passphrase. Please try again.' })
      } else {
        dispatch({ type: 'UNLOCK_ERROR', message: 'Failed to open vault. Please try again.' })
      }
    } finally {
      btn.removeAttribute('loading')
      btn.removeAttribute('disabled')
    }
  }

  btn.addEventListener('click', doUnlock)

  wrap.addEventListener('keydown', (e: Event) => {
    if ((e as KeyboardEvent).key === 'Enter') doUnlock()
  })

  // Re-render error from state
  const unsub = subscribe(() => {
    const s = getState()
    if (s.unlockError) showError(s.unlockError)
  })

  return unsub
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
