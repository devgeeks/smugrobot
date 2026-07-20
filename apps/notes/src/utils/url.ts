const ALLOWED_SCHEMES = new Set(["http:", "https:", "mailto:"]);

/** Rejects dangerous URL schemes (javascript:, data:, vbscript:, ...) on link hrefs. */
export function sanitizeHref(href: string): string | null {
  const trimmed = href.trim();
  if (!trimmed) return null;

  try {
    // Resolve against a dummy base so scheme-less/relative hrefs parse too.
    const url = new URL(trimmed, "https://dummy.invalid/");
    if (url.origin === "https://dummy.invalid" && !trimmed.includes(":")) {
      // Scheme-less relative/anchor link (e.g. "#section", "./foo") — allowed.
      return trimmed;
    }
    return ALLOWED_SCHEMES.has(url.protocol) ? trimmed : null;
  } catch {
    return null;
  }
}
