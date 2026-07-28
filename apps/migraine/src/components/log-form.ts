import { getState } from "../state/store.js";
import { saveEpisode } from "../db/episodes.js";
import { showToast } from "../utils/toast.js";
import { nowForDatetimeLocal, toDatetimeLocalValue } from "../utils/time.js";
import { PRESET_SYMPTOMS } from "../constants/symptoms.js";
import type { Episode } from "../db/episodes.js";

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

export class LogForm {
  el: HTMLElement;
  onSaved: (() => void) | null = null;
  onCancel: (() => void) | null = null;
  #editingId: string | null = null;

  constructor() {
    this.el = document.createElement("div");
    this.el.className = "log-form";
  }

  render(editing: Episode | null): void {
    this.#editingId = editing?.id ?? null;
    const startValue = editing ? toDatetimeLocalValue(editing.startTime) : nowForDatetimeLocal();
    const ongoing = editing ? editing.endTime === null : false;
    const endValue = editing?.endTime ? toDatetimeLocalValue(editing.endTime) : "";
    const intensity = editing?.intensity ?? 5;
    const medication = editing?.medication ?? "";
    const notes = editing?.notes ?? "";

    this.el.innerHTML = `
      <div class="log-form-scroll">
        <h1 class="pane-title">${editing ? "Edit episode" : "Log a migraine"}</h1>
        <div class="log-form-fields">
          <vault-input
            id="lf-start"
            type="datetime-local"
            label="Started"
            value="${startValue}"
            required
          ></vault-input>
          <vault-toggle id="lf-ongoing" label="Still ongoing" ${ongoing ? "checked" : ""}></vault-toggle>
          <vault-input
            id="lf-end"
            type="datetime-local"
            label="Ended"
            value="${endValue}"
            ${ongoing ? "disabled" : ""}
          ></vault-input>
          <vault-slider
            id="lf-intensity"
            label="Pain intensity"
            min="1"
            max="10"
            value="${intensity}"
            hint="1 = mild, 10 = worst pain ever"
          ></vault-slider>
          <vault-tag-select id="lf-symptoms" label="Symptoms and triggers">
            ${PRESET_SYMPTOMS.map(
              (s) =>
                `<vault-tag-select-option value="${s.value}">${s.label}</vault-tag-select-option>`,
            ).join("")}
          </vault-tag-select>
          <vault-input
            id="lf-medication"
            label="Medication taken"
            hint="Optional — e.g. Sumatriptan 50mg"
            value="${escapeAttr(medication)}"
          ></vault-input>
          <vault-textarea
            id="lf-notes"
            label="Notes"
            hint="Optional"
            resize="auto"
            value="${escapeAttr(notes)}"
          ></vault-textarea>
        </div>
      </div>
      <div class="log-form-actions">
        <vault-button variant="secondary" size="lg" id="lf-cancel">Cancel</vault-button>
        <vault-button variant="primary" size="lg" id="lf-save">${editing ? "Save changes" : "Save episode"}</vault-button>
      </div>
    `;

    const symptomsEl = this.el.querySelector("#lf-symptoms") as HTMLElement & { value: string[] };
    symptomsEl.value = editing?.symptoms ?? [];

    const ongoingToggle = this.el.querySelector("#lf-ongoing") as HTMLElement & {
      checked: boolean;
    };
    const endInput = this.el.querySelector("#lf-end") as HTMLElement;
    ongoingToggle.addEventListener("vault-change", (e: Event) => {
      const checked = (e as CustomEvent<{ checked: boolean }>).detail.checked;
      if (checked) endInput.setAttribute("disabled", "");
      else endInput.removeAttribute("disabled");
    });

    this.el.querySelector("#lf-cancel")?.addEventListener("click", () => this.onCancel?.());
    this.el.querySelector("#lf-save")!.addEventListener("click", () => void this.#save());
  }

  async #save(): Promise<void> {
    const store = getState().store;
    if (!store) return;

    const startInput = this.el.querySelector("#lf-start") as HTMLElement & { value: string };
    const endInput = this.el.querySelector("#lf-end") as HTMLElement & { value: string };
    const ongoingToggle = this.el.querySelector("#lf-ongoing") as HTMLElement & {
      checked: boolean;
    };
    const intensitySlider = this.el.querySelector("#lf-intensity") as HTMLElement & {
      value: number;
    };
    const symptomsEl = this.el.querySelector("#lf-symptoms") as HTMLElement & { value: string[] };
    const medicationInput = this.el.querySelector("#lf-medication") as HTMLElement & {
      value: string;
    };
    const notesInput = this.el.querySelector("#lf-notes") as HTMLElement & { value: string };
    const saveBtn = this.el.querySelector("#lf-save") as HTMLElement;

    const startLocal = startInput.value;
    if (!startLocal) {
      startInput.setAttribute("error", "Start time is required.");
      return;
    }
    const startTime = new Date(startLocal).toISOString();
    const ongoing = ongoingToggle.checked;
    const endTime = ongoing || !endInput.value ? null : new Date(endInput.value).toISOString();

    saveBtn.setAttribute("loading", "");
    saveBtn.setAttribute("disabled", "");
    try {
      await saveEpisode(store, {
        ...(this.#editingId ? { id: this.#editingId } : {}),
        startTime,
        endTime,
        intensity: intensitySlider.value,
        symptoms: symptomsEl.value,
        medication: medicationInput.value.trim(),
        notes: notesInput.value.trim(),
      });
      this.onSaved?.();
    } catch (err) {
      console.error("Failed to save episode:", err);
      showToast("Couldn't save the episode. Please try again.", "danger");
    } finally {
      saveBtn.removeAttribute("loading");
      saveBtn.removeAttribute("disabled");
    }
  }
}
