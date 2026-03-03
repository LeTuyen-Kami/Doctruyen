import { useColorScheme } from "@/hooks/use-color-scheme";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, Text, View } from "react-native";

interface ReaderControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onPreviousChapter: () => void;
  onNextChapter: () => void;
  canGoPrevious: boolean;
  canGoNext: boolean;
  canGoPreviousChapter: boolean;
  canGoNextChapter: boolean;
}

export function ReaderControls({
  isPlaying,
  onPlayPause,
  onPrevious,
  onNext,
  onPreviousChapter,
  onNextChapter,
  canGoPrevious,
  canGoNext,
  canGoPreviousChapter,
  canGoNextChapter,
}: ReaderControlsProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const iconColor = isDark ? "#F5F5F5" : "#1A1A1A";
  const playBgColor = isDark ? "#F5F5F5" : "#1A1A1A";
  const playIconColor = isDark ? "#1A1A1A" : "#FDFBF7";

  return (
    <View className="gap-4 py-4">
      <View className="flex-row items-center justify-center gap-8">
        <Pressable
          onPress={() => {
            onPrevious();
          }}
          disabled={!canGoPrevious}
          className="rounded-full p-3 active:opacity-80 disabled:opacity-40"
        >
          <Ionicons name="play-back" size={28} color={iconColor} />
        </Pressable>

        <Pressable
          onPress={onPlayPause}
          className="rounded-full p-4 active:opacity-80 disabled:opacity-40"
          style={{ backgroundColor: playBgColor }}
        >
          {isPlaying ? (
            <Ionicons name="pause" size={32} color={playIconColor} />
          ) : (
            <Ionicons name="play" size={32} color={playIconColor} />
          )}
        </Pressable>

        <Pressable
          onPress={() => {
            onNext();
          }}
          disabled={!canGoNext}
          className="rounded-full p-3 active:opacity-80 disabled:opacity-40"
        >
          <Ionicons name="play-forward" size={28} color={iconColor} />
        </Pressable>
      </View>

      <View className="flex-row items-center justify-center gap-6">
        <Pressable
          onPress={onPreviousChapter}
          disabled={!canGoPreviousChapter}
          className="flex-row items-center gap-2 rounded-lg px-4 py-2 active:opacity-80 disabled:opacity-40"
          accessibilityLabel="Chương trước"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={20} color={iconColor} />
          <Text className="text-sm" style={{ color: iconColor }}>
            Chương trước
          </Text>
        </Pressable>
        <Pressable
          onPress={onNextChapter}
          disabled={!canGoNextChapter}
          className="flex-row items-center gap-2 rounded-lg px-4 py-2 active:opacity-80 disabled:opacity-40"
          accessibilityLabel="Chương tiếp"
          accessibilityRole="button"
        >
          <Text className="text-sm" style={{ color: iconColor }}>
            Chương tiếp
          </Text>
          <Ionicons name="chevron-forward" size={20} color={iconColor} />
        </Pressable>
      </View>
    </View>
  );
}
