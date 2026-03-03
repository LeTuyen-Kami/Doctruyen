import { getChapterByIndex } from "@/src/db/queries";
import type { SQLiteDatabase } from "expo-sqlite";
import { useCallback, useRef } from "react";
import { chapterContentToParagraphs } from "@/src/utils/string";
import type { FlashListRef } from "@shopify/flash-list";
import type { Chapter } from "@/src/db/schema";
import type { SleepTimerConfig } from "@/components/SleepTimerModal";

const TTS_CHUNK_MAX_LENGTH = 500;

function shouldStopForSleepTimer(
  config: SleepTimerConfig | null,
  nextChapterIndex: number
): boolean {
  if (!config || config.type !== "chapter") return false;
  if (config.mode === "specific") return nextChapterIndex > config.chapterIndex;
  if (config.mode === "count") {
    return nextChapterIndex >= config.startChapterIndex + config.chaptersToRead;
  }
  return false;
}

export interface UsePlayNextParams {
  db: SQLiteDatabase;
  storyId: string | undefined;
  chapters: Chapter[];
  chapterIndex: number;
  paragraphs: string[];
  paragraphIndex: number;
  sleepTimerConfig: SleepTimerConfig | null;
  speak: (text: string, onComplete?: () => void) => void;
  saveProgress: (chapIdx: number, paraIdx: number) => void;
  onStop: () => void;
  onPlaybackEnd: () => void;
  setChapterIndex: (i: number) => void;
  setParagraphs: (p: string[]) => void;
  setParagraphIndex: (i: number) => void;
  listRef: React.RefObject<FlashListRef<string> | null>;
}

export function usePlayNext(params: UsePlayNextParams) {
  const {
    db,
    storyId,
    chapters,
    chapterIndex,
    paragraphs,
    paragraphIndex,
    sleepTimerConfig,
    speak,
    saveProgress,
    onStop,
    onPlaybackEnd,
    setChapterIndex,
    setParagraphs,
    setParagraphIndex,
    listRef,
  } = params;

  const playNextOrStopRef = useRef<() => void>(() => {});

  const playNextOrStop = useCallback(async () => {
    if (paragraphIndex < paragraphs.length - 1) {
      const next = paragraphIndex + 1;
      setParagraphIndex(next);
      saveProgress(chapterIndex, next);
      speak(paragraphs[next]!, () => playNextOrStopRef.current());
      listRef.current?.scrollToIndex({ index: next, animated: true });
    } else if (chapterIndex < chapters.length - 1 && storyId) {
      const nextChapIdx = chapterIndex + 1;
      if (shouldStopForSleepTimer(sleepTimerConfig, nextChapIdx)) {
        onStop();
        return;
      }
      const chapter = await getChapterByIndex(db, storyId, nextChapIdx);
      if (chapter) {
        const newParas = chapterContentToParagraphs(
          chapter.content,
          TTS_CHUNK_MAX_LENGTH
        );
        setChapterIndex(nextChapIdx);
        setParagraphs(newParas);
        setParagraphIndex(0);
        saveProgress(nextChapIdx, 0);
        listRef.current?.scrollToOffset({ offset: 0, animated: true });
        if (newParas.length > 0) {
          speak(newParas[0]!, () => playNextOrStopRef.current());
        } else {
          onPlaybackEnd();
        }
      } else {
        onPlaybackEnd();
      }
    } else {
      onPlaybackEnd();
    }
  }, [
    paragraphIndex,
    paragraphs,
    chapterIndex,
    chapters.length,
    storyId,
    db,
    sleepTimerConfig,
    speak,
    saveProgress,
    onStop,
    onPlaybackEnd,
    setChapterIndex,
    setParagraphs,
    setParagraphIndex,
    listRef,
  ]);

  playNextOrStopRef.current = playNextOrStop;

  const playCurrent = useCallback(() => {
    if (paragraphs.length === 0) return;
    const text = paragraphs[paragraphIndex];
    if (text) speak(text, () => playNextOrStopRef.current());
  }, [paragraphs, paragraphIndex, speak]);

  return { playNextOrStop, playCurrent };
}
