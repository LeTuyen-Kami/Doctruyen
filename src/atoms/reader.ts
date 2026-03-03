import { atom } from "jotai";

export interface ReaderState {
  storyId: string;
  chapterIndex: number;
  paragraphIndex: number;
  isPlaying: boolean;
}

export const readerStateAtom = atom<ReaderState | null>(null);
