import type { DocStore } from "@smugrobot/echidna";
import { generateId } from "../utils/id.js";

export interface Episode {
  id: string;
  startTime: string;
  endTime: string | null;
  intensity: number;
  symptoms: string[];
  medication: string;
  notes: string;
  createdAt: number;
  updatedAt: number;
}

export type EpisodeDraft = Omit<Episode, "id" | "createdAt" | "updatedAt"> & { id?: string };

interface EpisodeBody {
  startTime: string;
  endTime: string | null;
  intensity: number;
  symptoms: string[];
  medication: string;
  notes: string;
}

/** Reverse-chronological (newest startTime first). */
export async function listEpisodes(store: DocStore): Promise<Episode[]> {
  const metas = await store.list();
  const episodes: Episode[] = [];
  for (const meta of metas) {
    if (meta.id === "__vault_sentinel__") continue;
    const raw = await store.get(meta.id);
    if (raw === null) continue;
    const body = JSON.parse(raw) as EpisodeBody;
    episodes.push({
      id: meta.id,
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt,
      ...body,
    });
  }
  episodes.sort((a, b) => b.startTime.localeCompare(a.startTime));
  return episodes;
}

export async function saveEpisode(store: DocStore, draft: EpisodeDraft): Promise<Episode> {
  const id = draft.id ?? generateId("ep");
  const body: EpisodeBody = {
    startTime: draft.startTime,
    endTime: draft.endTime,
    intensity: draft.intensity,
    symptoms: draft.symptoms,
    medication: draft.medication,
    notes: draft.notes,
  };
  const meta = await store.set(id, JSON.stringify(body), {
    title: draft.startTime,
    type: "episode",
  });
  return { id: meta.id, createdAt: meta.createdAt, updatedAt: meta.updatedAt, ...body };
}

export async function deleteEpisode(store: DocStore, id: string): Promise<void> {
  await store.delete(id);
}
