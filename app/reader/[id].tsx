import AnimatedSlider, { useScroll } from "@/components/AnimatedSlider";
import { ChapterListModal } from "@/components/ChapterListModal";
import { ReaderControls } from "@/components/ReaderControls";
import SafeAreaView from "@/components/SafeAreaView";
import { SettingsModal } from "@/components/SettingsModal";
import { SleepTimerCountdown } from "@/components/SleepTimerCountdown";
import {
  SleepTimerModal,
  type SleepTimerConfig,
} from "@/components/SleepTimerModal";
import {
  defaultTTSSettings,
  loadTTSSettings,
  type TTSSettings,
} from "@/src/atoms/tts-settings";
import {
  getChapterByIndex,
  getChaptersByStoryId,
  getReadingProgress,
  getStoryById,
  saveReadingProgress,
} from "@/src/db/queries";
import type { Chapter } from "@/src/db/schema";
import { splitTextNested, type ParagraphSegment } from "@/src/utils/string";
import { Ionicons } from "@expo/vector-icons";
import {
  useFocusEffect,
  useIsFocused,
  useNavigation,
} from "@react-navigation/native";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { setAudioModeAsync } from "expo-audio";
import { Command, MediaControl, PlaybackState } from "expo-media-control";
import { useLocalSearchParams } from "expo-router";
import * as Speech from "expo-speech";
import { useSQLiteContext } from "expo-sqlite";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { BackgroundTimer } from "react-native-nitro-bg-timer";
import Animated from "react-native-reanimated";

const AnimatedFlashlist = Animated.createAnimatedComponent(FlashList);

const TTS_CHUNK_MAX_LENGTH = 500;

function flattenParagraphs(segments: ParagraphSegment[]): string[] {
  const items: string[] = [];
  for (const p of segments) {
    if (p.segments.length === 0) {
      items.push(p.text);
    } else {
      for (const seg of p.segments) {
        items.push(seg.text);
      }
    }
  }
  return items;
}

export default function ReaderScreen() {
  const { offsetY, contentHeight, viewportHeight, scrollHandler } = useScroll();

  const { id, chapterIndex: chapterIndexParam, autoPlay } = useLocalSearchParams<{
    id: string;
    chapterIndex?: string;
    autoPlay?: string;
  }>();
  const db = useSQLiteContext();
  const navigation = useNavigation();

  const [storyTitle, setStoryTitle] = useState<string>("");
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [paragraphs, setParagraphs] = useState<string[]>([]);
  const [paragraphIndex, setParagraphIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [chapterModalVisible, setChapterModalVisible] = useState(false);
  const [sleepTimerModalVisible, setSleepTimerModalVisible] = useState(false);
  const [sleepTimerConfig, setSleepTimerConfig] =
    useState<SleepTimerConfig | null>(null);
  const [sleepTimerEndTime, setSleepTimerEndTime] = useState<number | null>(
    null
  );
  const [ttsSettings, setTtsSettings] =
    useState<TTSSettings>(defaultTTSSettings);

  const listRef = useRef<FlashListRef<any>>(null);
  const sleepTimerEndTimeRef = useRef<number | null>(null);
  const sleepTimerConfigRef = useRef<SleepTimerConfig | null>(null);
  const isPlayingRef = useRef(false);
  const playNextOrStopRef = useRef<() => void>(() => {});
  const isStoppedManuallyRef = useRef(false);
  const paragraphsRef = useRef<string[]>([]);
  const paragraphIndexRef = useRef(0);
  const chapterIndexRef = useRef(0);
  const handlePlayPauseRef = useRef<() => void>(() => {});
  const handleNextChapterRef = useRef<() => void>(() => {});
  const handlePreviousChapterRef = useRef<() => void>(() => {});
  const ttsSettingsRef = useRef(ttsSettings);
  const pauseTimeoutRef = useRef<number | null>(null);
  ttsSettingsRef.current = ttsSettings;
  paragraphsRef.current = paragraphs;
  paragraphIndexRef.current = paragraphIndex;

  const withPauseThen = useCallback((fn: () => void) => {
    const ms = ttsSettingsRef.current.pauseBetweenParagraphsMs ?? 0;
    if (ms > 0) {
      pauseTimeoutRef.current = BackgroundTimer.setTimeout(() => {
        pauseTimeoutRef.current = null;
        fn();
      }, ms);
    } else {
      fn();
    }
  }, []);
  chapterIndexRef.current = chapterIndex;
  sleepTimerConfigRef.current = sleepTimerConfig;

  const loadSettings = useCallback(async () => {
    const s = await loadTTSSettings();
    setTtsSettings(s);
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: "duckOthers",
    }).catch((e) => console.warn("setAudioModeAsync failed:", e));

    return () => {
      setAudioModeAsync({
        playsInSilentMode: false,
        shouldPlayInBackground: false,
        interruptionMode: "mixWithOthers",
      }).catch((e) => console.warn("reset audio mode failed:", e));
    };
  }, []);

  const saveProgress = useCallback(
    (chapIdx: number, paraIdx: number) => {
      if (id) {
        saveReadingProgress(db, id, chapIdx, paraIdx).catch((e) =>
          console.warn("saveReadingProgress failed:", e)
        );
      }
    },
    [db, id]
  );

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      const [story, chaptersData] = await Promise.all([
        getStoryById(db, id),
        getChaptersByStoryId(db, id),
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
        const progress = await getReadingProgress(db, id);
        if (progress && progress.chapter_index < chaptersData.length) {
          chapIdx = progress.chapter_index;
          paraIdx = Math.max(0, progress.paragraph_index);
        } else {
          chapIdx = 0;
        }
      }

      setChapterIndex(chapIdx);

      const chapter = await getChapterByIndex(db, id, chapIdx);
      if (chapter) {
        const nested = splitTextNested(chapter.content, TTS_CHUNK_MAX_LENGTH);
        const paras = flattenParagraphs(nested);
        setParagraphs(paras);
        setParagraphIndex(Math.min(paraIdx, paras.length - 1));
      }
    } catch (e) {
      console.error("Failed to load reader:", e);
    } finally {
      setLoading(false);
    }
  }, [db, id, chapterIndexParam]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const autoPlayedRef = useRef(false);
  useEffect(() => {
    if (!loading && autoPlay === "true" && !autoPlayedRef.current && paragraphs.length > 0) {
      autoPlayedRef.current = true;
      requestAnimationFrame(() => {
        handlePlayPauseRef.current?.();
      });
    }
  }, [loading, autoPlay, paragraphs.length]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: storyTitle || "Đọc truyện" });
  }, [navigation, storyTitle]);

  const speakParagraph = useCallback(
    (text: string, onComplete?: () => void) => {
      if (!text.trim()) {
        onComplete?.();
        return;
      }
      Speech.speak(text, {
        rate: ttsSettings.rate,
        pitch: ttsSettings.pitch,
        voice: ttsSettings.voice ?? undefined,
        language: ttsSettings.language,
        onDone: () => {
          if (isStoppedManuallyRef.current) {
            isStoppedManuallyRef.current = false;
            return;
          }
          onComplete?.();
        },
        onStopped: () => {
          isPlayingRef.current = false;
          setIsPlaying(false);
        },
      });
      isPlayingRef.current = true;
      setIsPlaying(true);
    },
    [ttsSettings]
  );

  const stopAndPlay = useCallback(() => {
    if (pauseTimeoutRef.current != null) {
      BackgroundTimer.clearTimeout(pauseTimeoutRef.current);
      pauseTimeoutRef.current = null;
    }
    isStoppedManuallyRef.current = true;
    Speech.stop();
    isPlayingRef.current = false;
    setIsPlaying(false);
  }, []);

  const stopDueToSleepTimer = useCallback(() => {
    stopAndPlay();
    setSleepTimerConfig(null);
    setSleepTimerEndTime(null);
    sleepTimerEndTimeRef.current = null;
  }, [stopAndPlay]);

  const playNextOrStop = useCallback(async () => {
    const config = sleepTimerConfigRef.current;
    if (config?.type === "time" && sleepTimerEndTimeRef.current != null) {
      if (Date.now() >= sleepTimerEndTimeRef.current) {
        stopDueToSleepTimer();
        return;
      }
    }
    if (paragraphIndex < paragraphs.length - 1) {
      const next = paragraphIndex + 1;
      setParagraphIndex(next);
      saveProgress(chapterIndex, next);
      speakParagraph(paragraphs[next], () =>
        withPauseThen(() => playNextOrStopRef.current())
      );
      listRef.current?.scrollToIndex({ index: next, animated: true });
    } else {
      const endChapterText = `kết thúc chương ${chapterIndex + 1}`;
      const loadAndPlayNextChapter = async () => {
        const nextChapIdx = chapterIndex + 1;
        if (config?.type === "chapter") {
          const shouldStop =
            config.mode === "specific"
              ? nextChapIdx > config.chapterIndex
              : config.mode === "count" &&
                nextChapIdx >= config.startChapterIndex + config.chaptersToRead;
          if (shouldStop) {
            stopDueToSleepTimer();
            return;
          }
        }
        const chapter = id
          ? await getChapterByIndex(db, id, nextChapIdx)
          : null;
        if (chapter) {
          const nested = splitTextNested(chapter.content, TTS_CHUNK_MAX_LENGTH);
          const newParas = flattenParagraphs(nested);
          setChapterIndex(nextChapIdx);
          setParagraphs(newParas);
          setParagraphIndex(0);
          saveProgress(nextChapIdx, 0);
          listRef.current?.scrollToOffset({ offset: 0, animated: true });
          if (newParas.length > 0) {
            const chapTitle = chapter.title?.trim();
            if (chapTitle) {
              speakParagraph(chapTitle, () =>
                withPauseThen(() =>
                  speakParagraph(newParas[0], () =>
                    withPauseThen(() => playNextOrStopRef.current())
                  )
                )
              );
            } else {
              speakParagraph(newParas[0], () =>
                withPauseThen(() => playNextOrStopRef.current())
              );
            }
          } else {
            isPlayingRef.current = false;
            setIsPlaying(false);
          }
        } else {
          isPlayingRef.current = false;
          setIsPlaying(false);
        }
      };
      if (chapterIndex < chapters.length - 1 && id) {
        speakParagraph(endChapterText, () =>
          withPauseThen(() => loadAndPlayNextChapter())
        );
      } else {
        speakParagraph(endChapterText, () => {
          isPlayingRef.current = false;
          setIsPlaying(false);
        });
      }
    }
  }, [
    paragraphIndex,
    paragraphs,
    chapterIndex,
    chapters.length,
    id,
    db,
    speakParagraph,
    saveProgress,
    stopDueToSleepTimer,
    withPauseThen,
  ]);

  playNextOrStopRef.current = playNextOrStop;

  const handleStartSleepTimer = useCallback(
    (config: SleepTimerConfig) => {
      sleepTimerEndTimeRef.current = null;
      setSleepTimerEndTime(null);
      if (
        config.type === "chapter" &&
        config.mode === "specific" &&
        chapterIndex > config.chapterIndex
      ) {
        stopDueToSleepTimer();
        return;
      }
      setSleepTimerConfig(config);
      if (config.type === "time") {
        const end = Date.now() + config.minutes * 60 * 1000;
        sleepTimerEndTimeRef.current = end;
        setSleepTimerEndTime(end);
      }
    },
    [chapterIndex, stopDueToSleepTimer]
  );

  const handleCancelSleepTimer = useCallback(() => {
    setSleepTimerConfig(null);
    setSleepTimerEndTime(null);
    sleepTimerEndTimeRef.current = null;
  }, []);

  const playCurrent = useCallback(() => {
    if (paragraphs.length === 0) return;
    const text = paragraphs[paragraphIndex];
    if (!text) return;
    const currentChapter = chapters[chapterIndex];
    const isFirstParagraph = paragraphIndex === 0;
    if (isFirstParagraph && currentChapter?.title?.trim()) {
      speakParagraph(currentChapter.title, () =>
        withPauseThen(() =>
          speakParagraph(text, () =>
            withPauseThen(() => playNextOrStopRef.current())
          )
        )
      );
    } else {
      speakParagraph(text, () =>
        withPauseThen(() => playNextOrStopRef.current())
      );
    }
  }, [
    paragraphs,
    paragraphIndex,
    chapterIndex,
    chapters,
    speakParagraph,
    withPauseThen,
  ]);

  const handlePlayPause = useCallback(() => {
    if (isPlayingRef.current) {
      isStoppedManuallyRef.current = true;
      Speech.stop();
      isPlayingRef.current = false;
      setIsPlaying(false);
    } else {
      playCurrent();
    }
  }, [playCurrent]);

  const handleNext = useCallback(() => {
    const wasPlaying = isPlayingRef.current;
    stopAndPlay();
    if (paragraphIndex < paragraphs.length - 1) {
      const next = paragraphIndex + 1;
      setParagraphIndex(next);
      saveProgress(chapterIndex, next);
      if (wasPlaying && paragraphs[next]) {
        speakParagraph(paragraphs[next], () =>
          withPauseThen(() => playNextOrStopRef.current())
        );
      }
    }
  }, [
    paragraphIndex,
    paragraphs,
    chapterIndex,
    stopAndPlay,
    speakParagraph,
    saveProgress,
    withPauseThen,
  ]);

  const handlePrevious = useCallback(() => {
    stopAndPlay();
    if (paragraphIndex > 0) {
      const prev = paragraphIndex - 1;
      setParagraphIndex(prev);
      saveProgress(chapterIndex, prev);
    }
  }, [paragraphIndex, chapterIndex, stopAndPlay, saveProgress]);

  const handleSelectChapter = useCallback(
    async (index: number) => {
      stopAndPlay();
      const chapter = await getChapterByIndex(db, id!, index);
      if (chapter) {
        const nested = splitTextNested(chapter.content, TTS_CHUNK_MAX_LENGTH);
        const paras = flattenParagraphs(nested);
        setChapterIndex(index);
        setParagraphs(paras);
        setParagraphIndex(0);
        saveProgress(index, 0);
        listRef.current?.scrollToIndex({ index: 0, animated: true });
      }
    },
    [db, id, stopAndPlay, saveProgress]
  );

  const handlePreviousChapter = useCallback(() => {
    if (chapterIndex > 0) {
      handleSelectChapter(chapterIndex - 1);
    }
  }, [chapterIndex, handleSelectChapter]);

  const handleNextChapter = useCallback(() => {
    if (chapterIndex < chapters.length - 1) {
      handleSelectChapter(chapterIndex + 1);
    }
  }, [chapterIndex, chapters.length, handleSelectChapter]);

  handlePlayPauseRef.current = handlePlayPause;
  handleNextChapterRef.current = handleNextChapter;
  handlePreviousChapterRef.current = handlePreviousChapter;

  const isFocused = useIsFocused();

  // Media controls sync (expo-media-control) - streaming mode, no seek/slider
  useEffect(() => {
    if (!isFocused || loading || chapters.length === 0) return;

    MediaControl.enableMediaControls({
      capabilities: [
        Command.PLAY,
        Command.PAUSE,
        Command.PREVIOUS_TRACK,
        Command.NEXT_TRACK,
      ],
      notification: {
        color: "#64748B",
      },
    }).catch((e) =>
      console.warn("MediaControl.enableMediaCon````trols failed:", e)
    );

    return () => {
      MediaControl.disableMediaControls().catch((e) =>
        console.warn("MediaControl.disableMediaControls failed:", e)
      );
    };
  }, [isFocused, loading, chapters.length]);

  useEffect(() => {
    if (!isFocused || loading || chapters.length === 0) return;

    const currentChapter = chapters[chapterIndex];

    MediaControl.isEnabled().then((isEnabled) => {
      MediaControl.updateMetadata({
        title: storyTitle,
        artist: currentChapter?.title ?? "",
      }).catch((e) => console.warn("MediaControl.updateMetadata failed:", e));
    });
  }, [isFocused, loading, storyTitle, chapterIndex, chapters]);

  useEffect(() => {
    if (!isFocused || loading) return;

    const state = isPlaying ? PlaybackState.PLAYING : PlaybackState.PAUSED;
    MediaControl.updatePlaybackState(state).catch((e) =>
      console.warn("MediaControl.updatePlaybackState failed:", e)
    );
  }, [isFocused, loading, isPlaying]);

  useEffect(() => {
    if (!isFocused || loading) return;

    const removeListener = MediaControl.addListener((event) => {
      switch (event.command) {
        case Command.PLAY:
          handlePlayPauseRef.current();
          break;
        case Command.PAUSE:
          handlePlayPauseRef.current();
          break;
        case Command.NEXT_TRACK:
          handleNextChapterRef.current();
          break;
        case Command.PREVIOUS_TRACK:
          handlePreviousChapterRef.current();
          break;
      }
    });

    return () => {
      removeListener();
    };
  }, [isFocused, loading]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        if (pauseTimeoutRef.current != null) {
          BackgroundTimer.clearTimeout(pauseTimeoutRef.current);
          pauseTimeoutRef.current = null;
        }
        isStoppedManuallyRef.current = true;
        Speech.stop();
        isPlayingRef.current = false;
        setIsPlaying(false);
        MediaControl.disableMediaControls().catch((e) =>
          console.warn("MediaControl.disableMediaControls failed:", e)
        );
        setSleepTimerConfig(null);
        setSleepTimerEndTime(null);
        sleepTimerEndTimeRef.current = null;
        if (id) {
          saveReadingProgress(
            db,
            id,
            chapterIndexRef.current,
            paragraphIndexRef.current
          ).catch((e) => console.warn("save progress on leave failed:", e));
        }
      };
    }, [db, id])
  );

  useEffect(() => {
    if (isPlayingRef.current && paragraphsRef.current.length > 0) {
      const text = paragraphsRef.current[paragraphIndexRef.current];
      if (text?.trim()) {
        isStoppedManuallyRef.current = true;
        Speech.stop();
        speakParagraph(text, () => playNextOrStopRef.current());
      }
    }
  }, [ttsSettings, speakParagraph]);

  if (loading) {
    return (
      <SafeAreaView
        className="flex-1 bg-[#FDFBF7] dark:bg-[#1A1A1A]"
        edges={["bottom"]}
      >
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#1A1A1A" />
        </View>
      </SafeAreaView>
    );
  }

  const currentChapter = chapters[chapterIndex];

  return (
    <SafeAreaView
      className="flex-1 bg-[#FDFBF7] dark:bg-[#1A1A1A]"
      edges={["bottom"]}
    >
      <View className="flex-1">
        <View className="flex-row items-center justify-between border-b border-gray-200 px-4 py-2 dark:border-gray-700 relative">
          <AnimatedSlider
            value={offsetY}
            contentHeight={contentHeight}
            viewportHeight={viewportHeight}
            color="#3B82F6"
          />
          <Text
            className="flex-1 text-sm font-medium text-gray-600 dark:text-gray-400"
            numberOfLines={1}
          >
            {currentChapter?.title}
          </Text>
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => setSleepTimerModalVisible(true)}
              className="flex-row items-center gap-1.5 rounded-lg p-2 active:opacity-80"
              accessibilityLabel="Hẹn giờ tắt"
              accessibilityRole="button"
            >
              <Ionicons
                name="timer-outline"
                size={22}
                color={sleepTimerConfig ? "#F59E0B" : "#64748B"}
              />
              {sleepTimerConfig?.type === "time" && (
                <SleepTimerCountdown endTime={sleepTimerEndTime} />
              )}
            </Pressable>
            <Pressable
              onPress={() => setChapterModalVisible(true)}
              className="rounded-lg p-2 active:opacity-80"
              accessibilityLabel="Danh sách chương"
              accessibilityRole="button"
            >
              <Ionicons name="list" size={22} color="#64748B" />
            </Pressable>
            <Pressable
              onPress={() => setSettingsModalVisible(true)}
              className="rounded-lg p-2 active:opacity-80"
              accessibilityLabel="Cài đặt đọc"
              accessibilityRole="button"
            >
              <Ionicons name="settings" size={22} color="#64748B" />
            </Pressable>
          </View>
        </View>

        <AnimatedFlashlist
          ref={listRef}
          bounces={false}
          data={paragraphs}
          style={{ flex: 1 }}
          onScroll={scrollHandler}
          onContentSizeChange={(_, h) => {
            contentHeight.value = h;
          }}
          scrollEventThrottle={16}
          keyExtractor={(_, idx) => String(idx)}
          ListHeaderComponent={
            currentChapter ? (
              <Text className="mb-4 text-lg font-semibold text-[#1A1A1A] dark:text-[#F5F5F5]">
                {currentChapter.title}
              </Text>
            ) : null
          }
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingVertical: 16,
            paddingBottom: 24,
          }}
          // showsVerticalScrollIndicator={false}
          renderItem={({ item: text, index: idx }) => (
            <Pressable
              onLongPress={() => {
                setParagraphIndex(idx);
                saveProgress(chapterIndex, idx);
              }}
            >
              <View
                className={`mb-3 rounded-lg px-3 py-2 ${
                  idx === paragraphIndex
                    ? "bg-gray-200 dark:bg-gray-800"
                    : "bg-transparent"
                }`}
              >
                <Text
                  className={`text-base leading-7 text-justify ${
                    idx === paragraphIndex
                      ? "font-medium text-[#1A1A1A] dark:text-[#F5F5F5]"
                      : "text-[#1A1A1A] dark:text-[#F5F5F5]"
                  }`}
                >
                  {text as string}
                </Text>
              </View>
            </Pressable>
          )}
        />

        <View className="border-t border-gray-200 dark:border-gray-700">
          <ReaderControls
            isPlaying={isPlaying}
            onPlayPause={handlePlayPause}
            onPrevious={handlePrevious}
            onNext={handleNext}
            onPreviousChapter={handlePreviousChapter}
            onNextChapter={handleNextChapter}
            canGoPrevious={paragraphIndex > 0}
            canGoNext={paragraphIndex < paragraphs.length - 1}
            canGoPreviousChapter={chapterIndex > 0}
            canGoNextChapter={chapterIndex < chapters.length - 1}
          />
        </View>
      </View>

      <SettingsModal
        visible={settingsModalVisible}
        onClose={() => setSettingsModalVisible(false)}
        currentSettings={ttsSettings}
        onSettingsChange={setTtsSettings}
      />

      <ChapterListModal
        visible={chapterModalVisible}
        onClose={() => setChapterModalVisible(false)}
        chapters={chapters}
        currentIndex={chapterIndex}
        onSelectChapter={handleSelectChapter}
      />

      <SleepTimerModal
        visible={sleepTimerModalVisible}
        onClose={() => setSleepTimerModalVisible(false)}
        chapters={chapters}
        currentChapterIndex={chapterIndex}
        onStartTimer={handleStartSleepTimer}
        activeTimer={sleepTimerConfig}
        onCancelTimer={handleCancelSleepTimer}
        endTime={
          sleepTimerConfig?.type === "time" ? sleepTimerEndTime : undefined
        }
      />
    </SafeAreaView>
  );
}
