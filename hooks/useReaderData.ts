import {
  getChapterByIndex,
  getChaptersByStoryId,
  getReadingProgress,
  getStoryById,
  saveReadingProgress,
} from "@/src/db/queries";
import type { Chapter } from "@/src/db/schema";
import type { SQLiteDatabase } from "expo-sqlite";
import { useCallback, useEffect, useState } from "react";
import { chapterContentToParagraphs } from "@/src/utils/string";

const TTS_CHUNK_MAX_LENGTH = 500;

export interface UseReaderDataParams {
  db: SQLiteDatabase;
  storyId: string | undefined;
  chapterIndexParam?: string;
}

export interface UseReaderDataResult {
  storyTitle: string;
  chapters: Chapter[];
  chapterIndex: number;
  paragraphs: string[];
  paragraphIndex: number;
  loading: boolean;
  currentChapter: Chapter | undefined;
  setChapterIndex: (index: number) => void;
  setParagraphIndex: (index: number) => void;
  setParagraphs: (p: string[]) => void;
  goToChapter: (index: number) => Promise<void>;
  saveProgress: (chapIdx: number, paraIdx: number) => void;
  loadChapterContent: (index: number) => Promise<string[]>;
}

export function useReaderData({
  db,
  storyId,
  chapterIndexParam,
}: UseReaderDataParams): UseReaderDataResult {
  const [storyTitle, setStoryTitle] = useState("");
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [paragraphs, setParagraphs] = useState<string[]>([]);
  const [paragraphIndex, setParagraphIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  const saveProgress = useCallback(
    (chapIdx: number, paraIdx: number) => {
      if (storyId) {
        saveReadingProgress(db, storyId, chapIdx, paraIdx).catch((e) =>
          console.warn("saveReadingProgress failed:", e)
        );
      }
    },
    [db, storyId]
  );

  const loadChapterContent = useCallback(
    async (index: number): Promise<string[]> => {
      if (!storyId) return [];
      const chapter = await getChapterByIndex(db, storyId, index);
      if (!chapter) return [];
      return chapterContentToParagraphs(chapter.content, TTS_CHUNK_MAX_LENGTH);
    },
    [db, storyId]
  );

  const loadData = useCallback(async () => {
    if (!storyId) return;
    try {
      const [story, chaptersData] = await Promise.all([
        getStoryById(db, storyId),
        getChaptersByStoryId(db, storyId),
      ]);
      if (story) setStoryTitle(story.title);
      setChapters(chaptersData);

      let chapIdx: number;
      let paraIdx = 0;

      if (chapterIndexParam !== undefined) {
        chapIdx = Math.max(
          0,
          Math.min(parseInt(chapterIndexParam, 10), chaptersData.length - 1)
        );
      } else {
        const progress = await getReadingProgress(db, storyId);
        if (progress && progress.chapter_index < chaptersData.length) {
          chapIdx = progress.chapter_index;
          paraIdx = Math.max(0, progress.paragraph_index);
        } else {
          chapIdx = 0;
        }
      }

      setChapterIndex(chapIdx);
      const paras = await loadChapterContent(chapIdx);
      setParagraphs(paras);
      setParagraphIndex(Math.min(paraIdx, Math.max(0, paras.length - 1)));
    } catch (e) {
      console.error("Failed to load reader:", e);
    } finally {
      setLoading(false);
    }
  }, [db, storyId, chapterIndexParam, loadChapterContent]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const goToChapter = useCallback(
    async (index: number) => {
      const paras = await loadChapterContent(index);
      setChapterIndex(index);
      setParagraphs(paras);
      setParagraphIndex(0);
      saveProgress(index, 0);
    },
    [loadChapterContent, saveProgress]
  );

  return {
    storyTitle,
    chapters,
    chapterIndex,
    paragraphs,
    paragraphIndex,
    loading,
    currentChapter: chapters[chapterIndex],
    setChapterIndex,
    setParagraphIndex,
    setParagraphs,
    goToChapter,
    saveProgress,
    loadChapterContent,
  };
}
