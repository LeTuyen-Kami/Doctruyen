import { useColorScheme } from "@/hooks/use-color-scheme";
import type { Chapter } from "@/src/db/schema";
import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import React, { useCallback, useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type SleepTimerType = "time" | "chapter";

export type SleepTimerConfig =
  | { type: "time"; minutes: number }
  | { type: "chapter"; mode: "specific"; chapterIndex: number }
  | {
      type: "chapter";
      mode: "count";
      chaptersToRead: number;
      startChapterIndex: number;
    };

const TIME_PRESETS = [
  { label: "15 phút", minutes: 15 },
  { label: "30 phút", minutes: 30 },
  { label: "1 giờ", minutes: 60 },
  { label: "2 giờ", minutes: 120 },
  { label: "4 giờ", minutes: 240 },
] as const;

import { SleepTimerCountdown } from "./SleepTimerCountdown";

interface SleepTimerModalProps {
  visible: boolean;
  onClose: () => void;
  chapters: Chapter[];
  currentChapterIndex: number;
  onStartTimer: (config: SleepTimerConfig) => void;
  activeTimer: SleepTimerConfig | null;
  onCancelTimer: () => void;
  endTime?: number | null;
}

export function SleepTimerModal({
  visible,
  onClose,
  chapters,
  currentChapterIndex,
  onStartTimer,
  activeTimer,
  onCancelTimer,
  endTime,
}: SleepTimerModalProps) {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === "dark";
  const iconColor = isDark ? "#F5F5F5" : "#1A1A1A";
  const mutedColor = isDark ? "#94A3B8" : "#64748B";

  const [timerType, setTimerType] = useState<"time" | "chapter">("time");
  const [selectedMinutes, setSelectedMinutes] = useState<number | null>(15);
  const [customMinutes, setCustomMinutes] = useState("");
  const [chapterMode, setChapterMode] = useState<"specific" | "count">("count");
  const [selectedChapterIndex, setSelectedChapterIndex] = useState(0);
  const [chaptersToRead, setChaptersToRead] = useState("1");

  const customMinutesNum = parseInt(customMinutes, 10);
  const isValidCustom =
    !isNaN(customMinutesNum) && customMinutesNum > 0 && customMinutesNum <= 480;
  const chaptersToReadNum = parseInt(chaptersToRead, 10);
  const isValidChaptersCount =
    !isNaN(chaptersToReadNum) &&
    chaptersToReadNum > 0 &&
    chaptersToReadNum <= 100;

  useEffect(() => {
    if (visible) {
      setSelectedChapterIndex(currentChapterIndex);
    }
  }, [visible, currentChapterIndex]);

  const handleStartTimeTimer = useCallback(() => {
    const minutes =
      selectedMinutes ?? (customMinutes.trim() ? customMinutesNum : 15);
    if (minutes > 0 && minutes <= 480) {
      onStartTimer({ type: "time", minutes });
      onClose();
    }
  }, [selectedMinutes, customMinutes, customMinutesNum, onStartTimer, onClose]);

  const handleStartChapterTimer = useCallback(() => {
    if (chapterMode === "specific") {
      onStartTimer({
        type: "chapter",
        mode: "specific",
        chapterIndex: selectedChapterIndex,
      });
    } else if (isValidChaptersCount) {
      onStartTimer({
        type: "chapter",
        mode: "count",
        chaptersToRead: chaptersToReadNum,
        startChapterIndex: currentChapterIndex,
      });
    }
    onClose();
  }, [
    chapterMode,
    selectedChapterIndex,
    chaptersToReadNum,
    isValidChaptersCount,
    currentChapterIndex,
    onStartTimer,
    onClose,
  ]);

  const getActiveTimerLabel = useCallback(() => {
    if (!activeTimer) return null;
    if (activeTimer.type === "time") {
      if (endTime != null) {
        return "Còn lại ";
      }
      return `Hẹn giờ: ${activeTimer.minutes} phút`;
    }
    if (activeTimer.type === "chapter" && activeTimer.mode === "specific") {
      const ch = chapters[activeTimer.chapterIndex];
      return `Dừng tại: ${
        ch?.title ?? `Chương ${activeTimer.chapterIndex + 1}`
      }`;
    }
    if (activeTimer.type === "chapter" && activeTimer.mode === "count") {
      return `Đọc thêm ${activeTimer.chaptersToRead} chương`;
    }
    return null;
  }, [activeTimer, chapters, endTime]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <Pressable className="flex-1 justify-end bg-black/50" onPress={onClose}>
          <Pressable
            className="max-h-[85%] rounded-t-2xl bg-[#FDFBF7] dark:bg-[#1A1A1A]"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="flex-row items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
              <View className="flex-row items-center gap-2">
                <Ionicons name="timer-outline" size={24} color="#64748B" />
                <Text className="text-lg font-semibold text-[#1A1A1A] dark:text-[#F5F5F5]">
                  Hẹn giờ tắt
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

            <ScrollView className="max-h-[70vh] px-4 py-4">
              {activeTimer && (
                <View className="mb-4 rounded-lg bg-amber-100 px-4 py-3 dark:bg-amber-900/30">
                  <View className="mb-2 flex-row flex-wrap items-center gap-1">
                    <Text className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      Đang hẹn giờ: {getActiveTimerLabel()}
                    </Text>
                    {activeTimer.type === "time" && endTime != null && (
                      <SleepTimerCountdown
                        endTime={endTime}
                        className="text-sm font-medium text-amber-800 dark:text-amber-200"
                      />
                    )}
                  </View>
                  <Pressable
                    onPress={onCancelTimer}
                    className="self-start rounded-lg bg-amber-600 px-3 py-2"
                  >
                    <Text className="text-sm font-medium text-white">
                      Hủy hẹn giờ
                    </Text>
                  </Pressable>
                </View>
              )}

              <View className="mb-4">
                <Text className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Loại hẹn giờ
                </Text>
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => setTimerType("time")}
                    className={`flex-1 flex-row items-center justify-center gap-2 rounded-lg px-4 py-3 ${
                      timerType === "time"
                        ? "bg-[#1A1A1A] dark:bg-[#F5F5F5]"
                        : "bg-gray-200 dark:bg-gray-700"
                    }`}
                  >
                    <Ionicons
                      name="time-outline"
                      size={20}
                      color={
                        timerType === "time"
                          ? isDark
                            ? "#1A1A1A"
                            : "#F5F5F5"
                          : iconColor
                      }
                    />
                    <Text
                      className={`text-sm font-medium ${
                        timerType === "time"
                          ? "text-white dark:text-[#1A1A1A]"
                          : "text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      Theo thời gian
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setTimerType("chapter")}
                    className={`flex-1 flex-row items-center justify-center gap-2 rounded-lg px-4 py-3 ${
                      timerType === "chapter"
                        ? "bg-[#1A1A1A] dark:bg-[#F5F5F5]"
                        : "bg-gray-200 dark:bg-gray-700"
                    }`}
                  >
                    <Ionicons
                      name="book-outline"
                      size={20}
                      color={
                        timerType === "chapter"
                          ? isDark
                            ? "#1A1A1A"
                            : "#F5F5F5"
                          : iconColor
                      }
                    />
                    <Text
                      className={`text-sm font-medium ${
                        timerType === "chapter"
                          ? "text-white dark:text-[#1A1A1A]"
                          : "text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      Theo chương
                    </Text>
                  </Pressable>
                </View>
              </View>

              {timerType === "time" && (
                <View className="mb-4">
                  <Text className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Thời gian
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {TIME_PRESETS.map((preset) => (
                      <Pressable
                        key={preset.minutes}
                        onPress={() => {
                          setSelectedMinutes(preset.minutes);
                          setCustomMinutes("");
                        }}
                        className={`rounded-lg px-4 py-2 ${
                          selectedMinutes === preset.minutes && !customMinutes
                            ? "bg-[#1A1A1A] dark:bg-[#F5F5F5]"
                            : "bg-gray-200 dark:bg-gray-700"
                        }`}
                      >
                        <Text
                          className={`text-sm ${
                            selectedMinutes === preset.minutes && !customMinutes
                              ? "font-medium text-white dark:text-[#1A1A1A]"
                              : "text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          {preset.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <View className="mt-3 flex-row items-center gap-2">
                    <Text className="text-sm text-gray-600 dark:text-gray-400">
                      Tùy chỉnh (phút):
                    </Text>
                    <TextInput
                      value={customMinutes}
                      onChangeText={(t) => {
                        setCustomMinutes(t);
                        if (t.trim()) setSelectedMinutes(null);
                      }}
                      placeholder="VD: 45"
                      placeholderTextColor={mutedColor}
                      keyboardType="number-pad"
                      className="min-w-[80] rounded-lg border border-gray-300 bg-white px-3 py-2 text-[#1A1A1A] dark:border-gray-600 dark:bg-gray-800 dark:text-[#F5F5F5]"
                    />
                  </View>
                  <Pressable
                    onPress={handleStartTimeTimer}
                    disabled={
                      !(
                        (selectedMinutes && selectedMinutes > 0) ||
                        (customMinutes.trim() && isValidCustom)
                      )
                    }
                    className="mt-4 rounded-lg bg-[#1A1A1A] py-3 dark:bg-[#F5F5F5] disabled:opacity-50"
                  >
                    <Text className="text-center font-medium text-white dark:text-[#1A1A1A]">
                      Bật hẹn giờ (
                      {customMinutes.trim() && isValidCustom
                        ? `${customMinutesNum} phút`
                        : selectedMinutes
                        ? `${selectedMinutes} phút`
                        : "—"}
                      )
                    </Text>
                  </Pressable>
                </View>
              )}

              {timerType === "chapter" && (
                <View className="mb-4">
                  <Text className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Chọn theo chương
                  </Text>
                  <View className="mb-4 flex-row gap-2">
                    <Pressable
                      onPress={() => setChapterMode("count")}
                      className={`flex-1 rounded-lg px-4 py-3 ${
                        chapterMode === "count"
                          ? "bg-[#1A1A1A] dark:bg-[#F5F5F5]"
                          : "bg-gray-200 dark:bg-gray-700"
                      }`}
                    >
                      <Text
                        className={`text-center text-sm font-medium ${
                          chapterMode === "count"
                            ? "text-white dark:text-[#1A1A1A]"
                            : "text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        Số chương tiếp theo
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setChapterMode("specific")}
                      className={`flex-1 rounded-lg px-4 py-3 ${
                        chapterMode === "specific"
                          ? "bg-[#1A1A1A] dark:bg-[#F5F5F5]"
                          : "bg-gray-200 dark:bg-gray-700"
                      }`}
                    >
                      <Text
                        className={`text-center text-sm font-medium ${
                          chapterMode === "specific"
                            ? "text-white dark:text-[#1A1A1A]"
                            : "text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        Chương cụ thể
                      </Text>
                    </Pressable>
                  </View>

                  {chapterMode === "count" && (
                    <View className="mb-4">
                      <Text className="mb-2 text-sm text-gray-600 dark:text-gray-400">
                        Đọc thêm bao nhiêu chương:
                      </Text>
                      <TextInput
                        value={chaptersToRead}
                        onChangeText={setChaptersToRead}
                        placeholder="VD: 3"
                        placeholderTextColor={mutedColor}
                        keyboardType="number-pad"
                        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-[#1A1A1A] dark:border-gray-600 dark:bg-gray-800 dark:text-[#F5F5F5]"
                      />
                    </View>
                  )}

                  {chapterMode === "specific" && (
                    <View className="mb-4">
                      <Text className="mb-2 text-sm text-gray-600 dark:text-gray-400">
                        Dừng tại chương:
                      </Text>
                      <View className="h-[300px]">
                        <FlashList<Chapter>
                          data={chapters}
                          keyExtractor={(ch) =>
                            `${ch.story_id}-${ch.chapter_id}`
                          }
                          extraData={selectedChapterIndex}
                          style={{ maxHeight: 300 }}
                          showsVerticalScrollIndicator
                          renderItem={({ item: ch, index: idx }) => (
                            <Pressable
                              onPress={() => setSelectedChapterIndex(idx)}
                              className={`mb-2 rounded-lg px-3 py-2 ${
                                selectedChapterIndex === idx
                                  ? "bg-[#1A1A1A] dark:bg-[#F5F5F5]"
                                  : "bg-gray-100 dark:bg-gray-800"
                              }`}
                            >
                              <Text
                                className={`text-sm ${
                                  selectedChapterIndex === idx
                                    ? "font-medium text-white dark:text-[#1A1A1A]"
                                    : "text-gray-700 dark:text-gray-300"
                                }`}
                                numberOfLines={1}
                              >
                                {ch.title}
                              </Text>
                              <Text
                                className={`text-xs ${
                                  selectedChapterIndex === idx
                                    ? "text-white/80 dark:text-[#1A1A1A]/80"
                                    : "text-gray-500"
                                }`}
                              >
                                Chương {idx + 1}
                              </Text>
                            </Pressable>
                          )}
                        />
                      </View>
                    </View>
                  )}

                  <Pressable
                    onPress={handleStartChapterTimer}
                    disabled={
                      (chapterMode === "count" && !isValidChaptersCount) ||
                      (chapterMode === "specific" && selectedChapterIndex < 0)
                    }
                    className="rounded-lg bg-[#1A1A1A] py-3 dark:bg-[#F5F5F5] disabled:opacity-50"
                  >
                    <Text className="text-center font-medium text-white dark:text-[#1A1A1A]">
                      Bật hẹn giờ (
                      {chapterMode === "count"
                        ? `đọc thêm ${chaptersToReadNum} chương`
                        : chapters[selectedChapterIndex]?.title ??
                          `Chương ${selectedChapterIndex + 1}`}
                      )
                    </Text>
                  </Pressable>
                </View>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
