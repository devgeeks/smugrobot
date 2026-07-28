/** Shared 1-10 pain-intensity thresholds — used by the calendar's day dots and the trend chart's bars. */
export function intensityColor(intensity: number): string {
  if (intensity >= 8) return "var(--danger)";
  if (intensity >= 5) return "var(--warn)";
  return "var(--cipher)";
}

export function intensityBadgeVariant(intensity: number): "danger" | "warn" | "default" {
  if (intensity >= 8) return "danger";
  if (intensity >= 5) return "warn";
  return "default";
}
