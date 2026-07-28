export const PRESET_SYMPTOMS = [
  { value: "aura", label: "Aura" },
  { value: "nausea", label: "Nausea" },
  { value: "vomiting", label: "Vomiting" },
  { value: "light-sensitivity", label: "Light sensitivity" },
  { value: "sound-sensitivity", label: "Sound sensitivity" },
  { value: "dizziness", label: "Dizziness" },
] as const;

const LABEL_BY_VALUE = new Map<string, string>(PRESET_SYMPTOMS.map((s) => [s.value, s.label]));

/** Preset values map to their friendly label; custom (free-typed) tags are already readable. */
export function symptomLabel(value: string): string {
  return LABEL_BY_VALUE.get(value) ?? value;
}
