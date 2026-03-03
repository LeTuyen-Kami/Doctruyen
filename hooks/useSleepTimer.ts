import type { SleepTimerConfig } from "@/components/SleepTimerModal";
import { BackgroundTimer } from "react-native-nitro-bg-timer";
import { useCallback, useRef, useState } from "react";

export interface UseSleepTimerParams {
  chapterIndex: number;
  onStop: () => void;
}

export interface UseSleepTimerResult {
  config: SleepTimerConfig | null;
  start: (config: SleepTimerConfig) => void;
  cancel: () => void;
  shouldStopForNextChapter: (nextChapterIndex: number) => boolean;
}

export function useSleepTimer({
  chapterIndex,
  onStop,
}: UseSleepTimerParams): UseSleepTimerResult {
  const [config, setConfig] = useState<SleepTimerConfig | null>(null);
  const timeoutIdRef = useRef<number | null>(null);
  const configRef = useRef<SleepTimerConfig | null>(null);
  configRef.current = config;

  const stop = useCallback(() => {
    onStop();
    setConfig(null);
    if (timeoutIdRef.current != null) {
      BackgroundTimer.clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }
  }, [onStop]);

  const start = useCallback(
    (newConfig: SleepTimerConfig) => {
      if (timeoutIdRef.current != null) {
        BackgroundTimer.clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }
      if (
        newConfig.type === "chapter" &&
        newConfig.mode === "specific" &&
        chapterIndex > newConfig.chapterIndex
      ) {
        stop();
        return;
      }
      setConfig(newConfig);
      if (newConfig.type === "time") {
        const id = BackgroundTimer.setTimeout(
          stop,
          newConfig.minutes * 60 * 1000
        );
        timeoutIdRef.current = id;
      }
    },
    [chapterIndex, stop]
  );

  const cancel = useCallback(() => {
    setConfig(null);
    if (timeoutIdRef.current != null) {
      BackgroundTimer.clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }
  }, []);

  const shouldStopForNextChapter = useCallback(
    (nextChapterIndex: number): boolean => {
      const c = configRef.current;
      if (!c || c.type !== "chapter") return false;
      if (c.mode === "specific") {
        return nextChapterIndex > c.chapterIndex;
      }
      if (c.mode === "count") {
        return nextChapterIndex >= c.startChapterIndex + c.chaptersToRead;
      }
      return false;
    },
    []
  );

  return {
    config,
    start,
    cancel,
    shouldStopForNextChapter,
  };
}
