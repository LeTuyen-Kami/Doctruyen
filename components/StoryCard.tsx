import type { StoryWithChapters } from "@/src/db/schema";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import React, { memo } from "react";
import { Alert, Pressable, Text, View } from "react-native";

interface StoryCardProps {
  story: StoryWithChapters;
  onDelete?: (storyId: string) => void;
}

function StoryCardComponent({ story, onDelete }: StoryCardProps) {
  const router = useRouter();

  const handleDelete = () => {
    if (!onDelete) return;
    Alert.alert(
      "Xóa truyện",
      `Bạn có chắc muốn xóa "${story.title}"? Hành động này không thể hoàn tác.`,
      [
        { text: "Hủy", style: "cancel" },
        { text: "Xóa", style: "destructive", onPress: () => onDelete(story.id) },
      ]
    );
  };

  return (
    <View className="mb-4 flex-row items-center gap-2 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      <Pressable
        onPress={() => router.push(`/story/${story.id}`)}
        className="flex-1 flex-row items-start gap-3 active:opacity-80"
        accessibilityLabel={`Mở truyện ${story.title}`}
        accessibilityRole="button"
      >
        <View className="rounded-md bg-gray-100 p-2 dark:bg-gray-800">
          <Ionicons name="book-outline" size={24} color="#64748B" />
        </View>
        <View className="flex-1">
          <Text
            className="text-lg font-semibold text-gray-900 dark:text-gray-100"
            numberOfLines={2}
          >
            {story.title}
          </Text>
          <Text
            className="mt-1 text-sm text-gray-600 dark:text-gray-400"
            numberOfLines={1}
          >
            {story.author}
          </Text>
          <Text className="mt-2 text-xs text-gray-500 dark:text-gray-500">
            {story.chapterCount} chương
          </Text>
        </View>
      </Pressable>
      <Pressable
        onPress={() =>
          router.push({
            pathname: "/reader/[id]",
            params: { id: story.id, autoPlay: "true" },
          })
        }
        className="rounded-full p-2 active:opacity-70"
        accessibilityLabel="Phát đọc từ vị trí hiện tại"
        accessibilityRole="button"
      >
        <Ionicons name="play-circle" size={28} color="#3B82F6" />
      </Pressable>
      {onDelete && (
        <Pressable
          onPress={handleDelete}
          className="rounded-full p-2 active:opacity-70"
          accessibilityLabel="Xóa truyện"
          accessibilityRole="button"
        >
          <Ionicons name="trash-outline" size={22} color="#DC2626" />
        </Pressable>
      )}
    </View>
  );
}

export const StoryCard = memo(StoryCardComponent);
