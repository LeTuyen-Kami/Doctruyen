import SafeAreaView from "@/components/SafeAreaView";
import { Ionicons } from "@expo/vector-icons";
import type { FlashListRef } from "@shopify/flash-list";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import {
  getChaptersByStoryId,
  getReadingProgress,
  getStoryById,
} from "@/src/db/queries";
import type { Chapter } from "@/src/db/schema";
import { FlashList } from "@shopify/flash-list";

const CHAPTERS_PER_SECTION = 100;
const ESTIMATED_ITEM_HEIGHT = 72;
const SECTION_ITEM_WIDTH = 140;
const SECTION_ITEM_MARGIN = 8;
const SECTION_ITEM_TOTAL = SECTION_ITEM_WIDTH + SECTION_ITEM_MARGIN;

interface Section {
  index: number;
  start: number;
  end: number;
  label: string;
}

export default function StoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const db = useSQLiteContext();
  const [story, setStory] = useState<{ title: string; author: string } | null>(
    null
  );
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasProgress, setHasProgress] = useState(false);
  const [currentChapterIndex, setCurrentChapterIndex] = useState<number | null>(
    null
  );
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);
  const verticalListRef = useRef<FlashListRef<Chapter>>(null);
  const horizontalScrollRef = useRef<ScrollView>(null);
  const isScrollingFromSectionRef = useRef(false);
  const hasScrolledToCurrentRef = useRef(false);

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      const [storyData, chaptersData, progress] = await Promise.all([
        getStoryById(db, id),
        getChaptersByStoryId(db, id),
        getReadingProgress(db, id),
      ]);
      if (storyData) {
        setStory({
          title: storyData.title,
          author: storyData.author,
        });
      }
      setChapters(chaptersData);
      setHasProgress(progress !== null);
      setCurrentChapterIndex(progress?.chapter_index ?? null);
    } catch (e) {
      console.error("Failed to load story:", e);
    } finally {
      setLoading(false);
    }
  }, [db, id]);

  useEffect(() => {
    loadData();
    hasScrolledToCurrentRef.current = false;
  }, [loadData]);

  const sections = useMemo((): Section[] => {
    if (chapters.length === 0) return [];
    const result: Section[] = [];
    for (let i = 0; i < chapters.length; i += CHAPTERS_PER_SECTION) {
      const start = i + 1;
      const end = Math.min(i + CHAPTERS_PER_SECTION, chapters.length);
      result.push({
        index: result.length,
        start,
        end,
        label: `Chương ${start}-${end}`,
      });
    }
    return result;
  }, [chapters.length]);

  const scrollToChapter = useCallback((index: number) => {
    verticalListRef.current?.scrollToIndex({
      index,
      animated: false,
      viewPosition: 0.2,
    });
  }, []);

  const scrollHorizontalToSection = useCallback((sectionIndex: number) => {
    const x = Math.max(0, sectionIndex * SECTION_ITEM_TOTAL - 60);
    horizontalScrollRef.current?.scrollTo({ x, animated: true });
  }, []);

  const scrollToSection = useCallback(
    (sectionIndex: number) => {
      isScrollingFromSectionRef.current = true;
      const targetChapterIndex = sectionIndex * CHAPTERS_PER_SECTION;
      scrollToChapter(targetChapterIndex);
      setActiveSectionIndex(sectionIndex);
      scrollHorizontalToSection(sectionIndex);
      setTimeout(() => {
        isScrollingFromSectionRef.current = false;
      }, 500);
    },
    [scrollToChapter, scrollHorizontalToSection]
  );

  useEffect(() => {
    if (hasScrolledToCurrentRef.current) return;
    if (
      chapters.length > 0 &&
      currentChapterIndex != null &&
      currentChapterIndex >= 0 &&
      currentChapterIndex < chapters.length
    ) {
      hasScrolledToCurrentRef.current = true;
      setTimeout(() => {
        scrollToChapter(currentChapterIndex);
        const sectionIdx = Math.floor(
          currentChapterIndex / CHAPTERS_PER_SECTION
        );
        setActiveSectionIndex(sectionIdx);
        scrollHorizontalToSection(sectionIdx);
      }, 100);
    }
  }, [
    chapters.length,
    currentChapterIndex,
    scrollToChapter,
    scrollHorizontalToSection,
  ]);

  const handleVerticalScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (isScrollingFromSectionRef.current || sections.length === 0) return;
      const offsetY = e.nativeEvent.contentOffset.y;
      const estimatedIndex = Math.floor(offsetY / ESTIMATED_ITEM_HEIGHT);
      const newSection = Math.min(
        Math.floor(estimatedIndex / CHAPTERS_PER_SECTION),
        sections.length - 1
      );
      if (newSection >= 0 && newSection !== activeSectionIndex) {
        setActiveSectionIndex(newSection);
        scrollHorizontalToSection(newSection);
      }
    },
    [sections.length, activeSectionIndex, scrollHorizontalToSection]
  );

  const openReader = (chapterIndex: number) => {
    router.push({
      pathname: "/reader/[id]",
      params: { id, chapterIndex: String(chapterIndex) },
    });
  };

  const continueReading = () => {
    router.push({
      pathname: "/reader/[id]",
      params: { id },
    });
  };

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

  if (!story) {
    return (
      <SafeAreaView
        className="flex-1 bg-[#FDFBF7] dark:bg-[#1A1A1A]"
        edges={["bottom"]}
      >
        <View className="flex-1 items-center justify-center px-4">
          <Text className="text-center text-gray-500 dark:text-gray-400">
            Không tìm thấy truyện.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      className="flex-1 bg-[#FDFBF7] dark:bg-[#1A1A1A]"
      edges={["bottom"]}
    >
      <View className="flex-1 px-4 pt-4">
        <View className="mb-6 flex-row items-center gap-3">
          <View className="rounded-md bg-gray-100 p-2 dark:bg-gray-800">
            <Ionicons name="book-outline" size={28} color="#64748B" />
          </View>
          <View className="flex-1">
            <Text className="text-xl font-bold text-[#1A1A1A] dark:text-[#F5F5F5]">
              {story.title}
            </Text>
            <Text className="text-sm text-gray-600 dark:text-gray-400">
              {story.author}
            </Text>
          </View>
        </View>

        {hasProgress && (
          <Pressable
            onPress={continueReading}
            className="mb-4 rounded-lg bg-[#1A1A1A] py-3 dark:bg-[#F5F5F5]"
            accessibilityLabel="Tiếp tục đọc"
            accessibilityRole="button"
          >
            <Text className="text-center font-medium text-white dark:text-[#1A1A1A]">
              Tiếp tục đọc
            </Text>
          </Pressable>
        )}

        <Text className="mb-3 text-base font-semibold text-[#1A1A1A] dark:text-[#F5F5F5]">
          Danh sách chương ({chapters.length})
        </Text>

        {chapters.length === 0 ? (
          <View className="flex-1 items-center justify-center py-12">
            <Text className="text-center text-gray-500 dark:text-gray-400">
              Chưa có chương nào.
            </Text>
          </View>
        ) : (
          <View className="flex-1">
            <View>
              {sections.length > 1 && (
                <ScrollView
                  ref={horizontalScrollRef}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  className="mb-3 -mx-4 py-2"
                  contentContainerStyle={{ paddingHorizontal: 16 }}
                >
                  {sections.map((section) => (
                    <Pressable
                      key={section.index}
                      onPress={() => scrollToSection(section.index)}
                      className={`mr-2 rounded-lg border px-3 py-2 items-center ${
                        section.index === activeSectionIndex
                          ? "border-[#1A1A1A] bg-[#1A1A1A] dark:border-[#F5F5F5] dark:bg-[#F5F5F5]"
                          : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
                      }`}
                      style={{ width: SECTION_ITEM_WIDTH }}
                    >
                      <Text
                        className={`text-xs font-medium ${
                          section.index === activeSectionIndex
                            ? "text-white dark:text-[#1A1A1A]"
                            : "text-[#1A1A1A] dark:text-[#F5F5F5]"
                        }`}
                        numberOfLines={1}
                      >
                        {section.label}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </View>
            <FlashList
              ref={verticalListRef}
              data={chapters}
              keyExtractor={(item) => `${item.story_id}-${item.chapter_id}`}
              renderItem={({ item, index }) => (
                <ChapterItem
                  chapter={item}
                  index={index}
                  onPress={() => openReader(index)}
                />
              )}
              contentContainerStyle={{ paddingBottom: 24 }}
              showsVerticalScrollIndicator={false}
              onScroll={handleVerticalScroll}
              scrollEventThrottle={100}
            />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

function ChapterItem({
  chapter,
  index,
  onPress,
}: {
  chapter: Chapter;
  index: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="mb-2 rounded-lg border border-gray-200 bg-white py-3 px-4 active:opacity-80 dark:border-gray-700 dark:bg-gray-900"
      accessibilityLabel={`Đọc ${chapter.title}`}
      accessibilityRole="button"
    >
      <Text
        className="text-base text-[#1A1A1A] dark:text-[#F5F5F5]"
        numberOfLines={2}
      >
        {chapter.title}
      </Text>
      <Text className="mt-1 text-xs text-gray-500 dark:text-gray-500">
        Chương {index + 1}
      </Text>
    </Pressable>
  );
}
