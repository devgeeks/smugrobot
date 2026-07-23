import type { NoteMeta } from "../state/types.js";

/** Notes belonging to `folderId`, or every note when `folderId` is null (the "All notes" view). */
export function computeNoteList(
  all: Record<string, unknown>[],
  folderId: string | null,
): NoteMeta[] {
  return (
    all.filter(
      (m) => m["type"] === "note" && (folderId === null || (m["folderId"] ?? null) === folderId),
    ) as NoteMeta[]
  ).sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Note count per folder id, keyed by folderId (or '' for notes with no folder). */
export function computeNoteCounts(all: Record<string, unknown>[]): Record<string, number> {
  const noteCounts: Record<string, number> = {};
  for (const m of all) {
    if (m["type"] === "note") {
      const key = (m["folderId"] as string | null) ?? "";
      noteCounts[key] = (noteCounts[key] ?? 0) + 1;
    }
  }
  return noteCounts;
}
