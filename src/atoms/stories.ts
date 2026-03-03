import { atom } from "jotai";
import type { StoryWithChapters } from "@/src/db/schema";

export const storiesAtom = atom<StoryWithChapters[]>([]);

export const storiesRefreshAtom = atom(null, (get, set) => {
  set(storiesAtom, [...get(storiesAtom)]);
});
