import { dispatch, getState, subscribe } from "../state/store.js";
import { createVault, openVault, saveKeyToSession } from "../db/vault.js";
import { EchidnaJsError } from "echidna.js";
import { showToast } from "../utils/toast.js";

export function mountUnlockScreen(root: HTMLElement): () => void {
  const state = getState();
  root.innerHTML = "";

  const wrap = document.createElement("div");
  wrap.className = "unlock-wrap";

  const creating = !state.vaultExists;
  wrap.innerHTML = `
    <div class="unlock-card-wrap">
      <vault-card border class="unlock-card">
        <div class="unlock-logo">Notes</div>
        <h1 class="unlock-heading">${creating ? "Create a master passphrase" : "Enter your passphrase"}</h1>
        <p class="unlock-sub">${
          creating
            ? "Your notes will be encrypted with this passphrase. Don't lose it — it cannot be recovered."
            : "Enter your passphrase to unlock your notes."
        }</p>
        <div class="unlock-fields">
          <vault-input
            id="passphrase-input"
            type="password"
            label="Passphrase"
            required
            autocomplete="${creating ? "new-password" : "current-password"}"
          ></vault-input>
          ${
            creating
              ? `<vault-input
            id="confirm-input"
            type="password"
            label="Confirm passphrase"
            required
            autocomplete="new-password"
          ></vault-input>`
              : ""
          }
        </div>
        <vault-button variant="primary" id="unlock-btn" class="unlock-submit">
          ${creating ? "Create vault" : "Unlock"}
        </vault-button>
      </vault-card>
      <div id="kdf-progress" class="kdf-progress">
        <span class="kdf-progress-label" aria-live="polite">Unlocking private notes…</span>
        <div class="kdf-progress-track">
          <div class="kdf-progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"></div>
        </div>
      </div>
    </div>
  `;

  root.appendChild(wrap);

  const btn = wrap.querySelector("#unlock-btn") as HTMLElement;
  const passphraseInput = wrap.querySelector("#passphrase-input") as HTMLElement & {
    value: string;
  };
  const confirmInput = wrap.querySelector("#confirm-input") as
    (HTMLElement & { value: string }) | null;
  const progressWrap = wrap.querySelector("#kdf-progress") as HTMLElement;
  const progressBar = wrap.querySelector(".kdf-progress-bar") as HTMLElement;
  const progressLabel = wrap.querySelector(".kdf-progress-label") as HTMLElement;

  (passphraseInput as HTMLElement & { shadowRoot: ShadowRoot | null }).shadowRoot
    ?.querySelector("input")
    ?.focus();

  // vault-input re-renders on any attribute change, resetting the native input value
  // to the 'value' attribute. Sync 'value' first so the typed text is preserved.
  const setInputError = (el: HTMLElement & { value: string }, msg: string) => {
    el.value = el.value;
    el.setAttribute("error", msg);
  };

  passphraseInput.addEventListener("vault-input", () => passphraseInput.removeAttribute("error"));
  confirmInput?.addEventListener("vault-input", () => confirmInput.removeAttribute("error"));

  // Announced text updates in 10% steps so screen readers get periodic
  // progress without an announcement on every single percentage point.
  let lastAnnouncedPct = -1;
  const updateProgress = (pct: number, message: string) => {
    progressBar.style.width = `${pct}%`;
    progressBar.setAttribute("aria-valuenow", String(pct));
    const step = Math.floor(pct / 10) * 10;
    if (step !== lastAnnouncedPct) {
      lastAnnouncedPct = step;
      progressLabel.textContent = message;
    }
  };

  const doUnlock = async () => {
    const passphrase: string = (passphraseInput as unknown as { value: string }).value ?? "";
    if (!passphrase) {
      setInputError(passphraseInput, "Please enter your passphrase.");
      return;
    }

    if (creating) {
      if (passphrase.length < 8) {
        setInputError(passphraseInput, "Passphrase must be at least 8 characters.");
        return;
      }
      const confirm: string = (confirmInput as unknown as { value: string } | null)?.value ?? "";
      if (passphrase !== confirm) {
        if (confirmInput) setInputError(confirmInput, "Passphrases do not match.");
        return;
      }
    }

    btn.setAttribute("loading", "");
    btn.setAttribute("disabled", "");
    lastAnnouncedPct = -1;
    updateProgress(0, creating ? "Encrypting your vault…" : "Unlocking private notes…");
    progressWrap.classList.add("visible");

    try {
      const currentState = getState();
      if (!currentState.adapter) throw new Error("No adapter");
      let store;
      if (creating) {
        store = await createVault(currentState.adapter, passphrase, (p) => {
          const pct = Math.round(p * 100);
          updateProgress(pct, `Encrypting your vault… ${pct}%`);
        });
      } else {
        const result = await openVault(
          currentState.adapter,
          passphrase,
          (p) => {
            const pct = Math.round(p * 100);
            updateProgress(pct, `Unlocking private notes… ${pct}%`);
          },
          () => {
            // One-time upgrade from the legacy 0.1.0 vault format. migrate() has
            // no progress signal, so fill the bar and swap the label.
            updateProgress(100, "Upgrading your notes…");
          },
        );
        store = result.store;
        saveKeyToSession(result.key);
      }
      dispatch({ type: "UNLOCKED", store });
    } catch (err) {
      if (err instanceof EchidnaJsError && err.code === "WRONG_KEY") {
        setInputError(passphraseInput, "Wrong passphrase.");
        showToast("Wrong passphrase. Please try again.", "danger");
      } else {
        showToast("Failed to open vault. Please try again.", "danger");
      }
    } finally {
      btn.removeAttribute("loading");
      btn.removeAttribute("disabled");
      progressWrap.classList.remove("visible");
      progressBar.style.width = "0%";
      progressBar.setAttribute("aria-valuenow", "0");
    }
  };

  btn.addEventListener("click", doUnlock);

  wrap.addEventListener("keydown", (e: Event) => {
    if ((e as KeyboardEvent).key === "Enter") doUnlock();
  });

  return subscribe(() => {
    /* keep subscription alive for screen transitions */
  });
}
