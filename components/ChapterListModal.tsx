import type { Chapter } from "@/src/db/schema";
import { Ionicons } from "@expo/vector-icons";
import { FlashList, FlashListRef } from "@shopify/flash-list";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";

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

interface ChapterListModalProps {
  visible: boolean;
  onClose: () => void;
  chapters: Chapter[];
  currentIndex: number;
  onSelectChapter: (index: number) => void;
}

export function ChapterListModal({
  visible,
  onClose,
  chapters,
  currentIndex,
  onSelectChapter,
}: ChapterListModalProps) {
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);
  const flatListRef = useRef<FlashListRef<Chapter>>(null);
  const horizontalScrollRef = useRef<ScrollView>(null);
  const isScrollingFromSectionRef = useRef(false);

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
    flatListRef.current?.scrollToIndex({
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
    if (!visible || chapters.length === 0) return;
    const sectionIdx = Math.floor(currentIndex / CHAPTERS_PER_SECTION);
    setActiveSectionIndex(sectionIdx);
    setTimeout(() => {
      scrollToChapter(currentIndex);
      scrollHorizontalToSection(sectionIdx);
    }, 100);
  }, [
    visible,
    chapters.length,
    currentIndex,
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

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable className="flex-1 justify-end bg-black/50" onPress={onClose}>
        <Pressable
          className="h-[70%] rounded-t-2xl bg-[#FDFBF7] dark:bg-[#1A1A1A]"
          onPress={(e) => e.stopPropagation()}
        >
          <View className="flex-row items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
            <View className="flex-row items-center gap-2">
              <Ionicons name="list" size={24} color="#64748B" />
              <Text className="text-lg font-semibold text-[#1A1A1A] dark:text-[#F5F5F5]">
                Danh sách chương
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              className="p-2"
              accessibilityLabel="Đóng"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={24} color="#64748B" />
            </Pressable>
          </View>

          {sections.length > 1 && (
            <View>
              <ScrollView
                ref={horizontalScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                className="border-b border-gray-200 px-4 py-2 dark:border-gray-700"
                contentContainerStyle={{}}
              >
                {sections.map((section) => (
                  <Pressable
                    key={section.index}
                    onPress={() => scrollToSection(section.index)}
                    className={`mr-2 rounded-lg border px-3 py-2 ${
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
            </View>
          )}

          <FlashList
            ref={flatListRef}
            data={chapters}
            keyExtractor={(item) => `${item.story_id}-${item.chapter_id}`}
            renderItem={({ item, index }) => (
              <Pressable
                onPress={() => {
                  onSelectChapter(index);
                  onClose();
                }}
                className={`border-b border-gray-100 px-4 py-3 dark:border-gray-800 ${
                  index === currentIndex ? "bg-gray-100 dark:bg-gray-800" : ""
                }`}
                accessibilityLabel={`Chương ${index + 1}: ${item.title}`}
                accessibilityRole="button"
              >
                <Text
                  className={`text-base ${
                    index === currentIndex
                      ? "font-semibold text-[#1A1A1A] dark:text-[#F5F5F5]"
                      : "text-gray-700 dark:text-gray-300"
                  }`}
                  numberOfLines={2}
                >
                  {item.title}
                </Text>
                <Text className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                  Chương {index + 1}
                </Text>
              </Pressable>
            )}
            contentContainerStyle={{ paddingBottom: 24 }}
            onScroll={handleVerticalScroll}
            scrollEventThrottle={100}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
