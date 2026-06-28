export function deriveTitleFromMarkdown(md: string): string {
  const first = md.split("\n").find((l) => l.trim().length > 0);
  if (!first) return "Untitled";
  return first.replace(/^#{1,6}\s*/, "").trim() || "Untitled";
}
