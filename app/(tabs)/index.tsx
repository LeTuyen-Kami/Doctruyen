import { StoryCard } from "@/components/StoryCard";
import { useFocusEffect } from "@react-navigation/native";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  View,
} from "react-native";

import SafeAreaView from "@/components/SafeAreaView";
import { deleteStory, getAllStories } from "@/src/db/queries";
import type { StoryWithChapters } from "@/src/db/schema";
import * as Application from "expo-application";

const version = Application.nativeApplicationVersion;
export default function StoryListScreen() {
  const db = useSQLiteContext();
  const [stories, setStories] = useState<StoryWithChapters[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadStories = useCallback(async () => {
    try {
      const data = await getAllStories(db);
      setStories(data);
    } catch (e) {
      console.error("Failed to load stories:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadStories();
    }, [loadStories])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadStories();
  }, [loadStories]);

  const handleDeleteStory = useCallback(
    async (storyId: string) => {
      try {
        await deleteStory(db, storyId);
        setStories((prev) => prev.filter((s) => s.id !== storyId));
      } catch (e) {
        console.error("Failed to delete story:", e);
      }
    },
    [db]
  );

  return (
    <SafeAreaView className="flex-1 bg-[#FDFBF7] dark:bg-[#1A1A1A]">
      <View className="flex-1 px-4 pt-4">
        <Text className="mb-4 text-2xl font-bold text-[#1A1A1A] dark:text-[#F5F5F5]">
          Thư viện truyện (v{version}.4)
        </Text>
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#1A1A1A" />
          </View>
        ) : stories.length === 0 ? (
          <View className="flex-1 items-center justify-center py-12">
            <Text className="text-center text-gray-500 dark:text-gray-400">
              Chưa có truyện. Hãy import từ tab Import.
            </Text>
          </View>
        ) : (
          <FlatList
            data={stories}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <StoryCard story={item} onDelete={handleDeleteStory} />
            )}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#1A1A1A"
              />
            }
            contentContainerStyle={{ paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
