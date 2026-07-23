import { dispatch, getState, subscribe } from "../state/store.js";
import { createVault, openVault, saveKeyToSession } from "../db/vault.js";
import { EchidnaJsError } from "echidna.js";
import { showToast } from "../utils/toast.js";

function describeUnlockFailure(err: unknown): { message: string; wrongPassphrase: boolean } {
  if (err instanceof EchidnaJsError) {
    switch (err.code) {
      case "WRONG_KEY":
        return { message: "Wrong passphrase. Please try again.", wrongPassphrase: true };
      case "CORRUPT_BLOB":
      case "TAMPERED":
        return {
          message:
            "Your vault's data appears to be corrupted, not a passphrase problem — retrying won't help. Restore from a backup if you have one.",
          wrongPassphrase: false,
        };
      case "NEEDS_MIGRATION":
        return {
          message: "Your vault needs to finish an internal upgrade. Reload the page and try again.",
          wrongPassphrase: false,
        };
      case "VAULT_NOT_FOUND":
        return {
          message: "Your vault's setup data is missing or incomplete. Try reloading the page.",
          wrongPassphrase: false,
        };
      default:
        return {
          message: "Couldn't open your vault. Try again, or reload the page if it keeps happening.",
          wrongPassphrase: false,
        };
    }
  }
  if (err instanceof Error && err.message === "Vault not found") {
    return {
      message:
        "No vault was found in this browser's storage — it may have been cleared. Try reloading the page.",
      wrongPassphrase: false,
    };
  }
  if (err instanceof Error && err.message === "No adapter") {
    return {
      message: "Something went wrong starting the app. Please reload the page.",
      wrongPassphrase: false,
    };
  }
  if (typeof DOMException !== "undefined" && err instanceof DOMException) {
    if (err.name === "QuotaExceededError") {
      return {
        message:
          "Your browser's storage is full, so the vault can't be opened. Free up space and try again.",
        wrongPassphrase: false,
      };
    }
    if (err.name === "VersionError" || err.name === "InvalidStateError") {
      return {
        message:
          "Access to your vault's storage was blocked. Close other tabs with this app open and try again.",
        wrongPassphrase: false,
      };
    }
    return {
      message:
        "A browser storage error occurred while opening your vault. Reloading the page may help.",
      wrongPassphrase: false,
    };
  }
  return {
    message: "Couldn't open your vault due to an unexpected error. Try again, or reload the page.",
    wrongPassphrase: false,
  };
}

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
      console.error("Vault unlock failed:", err);
      const { message, wrongPassphrase } = describeUnlockFailure(err);
      if (wrongPassphrase) setInputError(passphraseInput, "Wrong passphrase.");
      showToast(message, "danger");
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
