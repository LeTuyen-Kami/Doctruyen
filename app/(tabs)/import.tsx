import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import SafeAreaView from "@/components/SafeAreaView";

type ImportType = "json" | "epub";

export default function ImportScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleExportJson = useCallback(async () => {
    try {
      setLoading(true);
      const { exportDbToJSON } = await import("@/src/db/export-db");
      const result = await exportDbToJSON(db, true);
      if (result.success) {
        Alert.alert("Xuất thành công", "Đã chia sẻ file backup JSON.");
      } else {
        Alert.alert("Lỗi", result.error);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert("Lỗi", msg);
    } finally {
      setLoading(false);
    }
  }, [db]);

  const handleExportDb = useCallback(async () => {
    try {
      setLoading(true);
      const { exportDbToFile } = await import("@/src/db/export-db");
      const result = await exportDbToFile(db, true);
      if (result.success) {
        Alert.alert("Xuất thành công", "Đã chia sẻ file database .db");
      } else {
        Alert.alert("Lỗi", result.error);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert("Lỗi", msg);
    } finally {
      setLoading(false);
    }
  }, [db]);

  const handleImportDb = useCallback(async () => {
    try {
      setLoading(true);
      const { importDbFromPicker } = await import("@/src/db/import-db");
      const result = await importDbFromPicker(db);
      if (result.success) {
        Alert.alert(
          "Import thành công",
          result.message ?? `Đã import ${result.storiesCount} truyện.`,
          [{ text: "OK", onPress: () => router.replace("/(tabs)") }]
        );
      } else {
        Alert.alert("Lỗi", result.error);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert("Lỗi", msg);
    } finally {
      setLoading(false);
    }
  }, [db, router]);

  const pickAndImport = useCallback(
    async (type: ImportType) => {
      try {
        const DocumentPicker = await import("expo-document-picker");
        const FileSystem = await import("expo-file-system/legacy");
        const { importStoryFromJSON, importStoryFromEpub } = await import(
          "@/src/db/import-story"
        );

        const result = await DocumentPicker.getDocumentAsync({
          type:
            type === "json"
              ? "application/json"
              : ["application/epub+zip", "application/x-epub+zip"],
          copyToCacheDirectory: true,
        });

        if (result.canceled || !result.assets?.length) return;

        setLoading(true);
        const file = result.assets[0];
        const uri = file.uri;

        if (type === "json") {
          const content = await FileSystem.readAsStringAsync(uri);
          const importResult = await importStoryFromJSON(db, content, true);

          if (importResult.success) {
            Alert.alert(
              "Import thành công",
              `Đã import truyện "${importResult.title}"`,
              [
                {
                  text: "OK",
                  onPress: () => router.replace("/(tabs)"),
                },
              ]
            );
          } else {
            Alert.alert("Lỗi", importResult.error);
          }
        } else {
          const base64 = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          const importResult = await importStoryFromEpub(db, base64, true);

          if (importResult.success) {
            Alert.alert(
              "Import thành công",
              `Đã import truyện "${importResult.title}" từ file EPUB`,
              [
                {
                  text: "OK",
                  onPress: () => router.replace("/(tabs)"),
                },
              ]
            );
          } else {
            Alert.alert("Lỗi", importResult.error);
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        Alert.alert("Lỗi", msg);
      } finally {
        setLoading(false);
      }
    },
    [db, router]
  );

  return (
    <SafeAreaView
      className="flex-1 bg-[#FDFBF7] dark:bg-[#1A1A1A]"
      edges={["top"]}
    >
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
        <Text className="mb-4 text-2xl font-bold text-[#1A1A1A] dark:text-[#F5F5F5]">
          Import truyện
        </Text>
        <Text className="mb-6 text-gray-600 dark:text-gray-400">
          Chọn file JSON hoặc EPUB từ thiết bị để import truyện. File JSON có
          định dạng từ khotruyenchu_crawler.
        </Text>

        <View className="mb-8 gap-4">
          <Pressable
            onPress={() => pickAndImport("json")}
            disabled={loading}
            className="flex-row items-center justify-center gap-3 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 py-8 active:opacity-80 dark:border-gray-600 dark:bg-gray-800"
            accessibilityLabel="Chọn file JSON"
            accessibilityRole="button"
          >
            {loading ? (
              <ActivityIndicator size="small" color="#1A1A1A" />
            ) : (
              <Ionicons name="document-text-outline" size={32} color="#64748B" />
            )}
            <Text className="text-base font-medium text-gray-700 dark:text-gray-300">
              {loading ? "Đang xử lý..." : "Chọn file JSON"}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => pickAndImport("epub")}
            disabled={loading}
            className="flex-row items-center justify-center gap-3 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 py-8 active:opacity-80 dark:border-gray-600 dark:bg-gray-800"
            accessibilityLabel="Chọn file EPUB"
            accessibilityRole="button"
          >
            {loading ? (
              <ActivityIndicator size="small" color="#1A1A1A" />
            ) : (
              <Ionicons name="book-outline" size={32} color="#64748B" />
            )}
            <Text className="text-base font-medium text-gray-700 dark:text-gray-300">
              {loading ? "Đang xử lý..." : "Chọn file EPUB"}
            </Text>
          </Pressable>
        </View>

        <Text className="mb-2 text-lg font-semibold text-[#1A1A1A] dark:text-[#F5F5F5]">
          Sao lưu & Khôi phục
        </Text>
        <Text className="mb-4 text-gray-600 dark:text-gray-400">
          Xuất toàn bộ database (truyện, chương, tiến độ đọc) hoặc khôi phục từ
          file backup.
        </Text>

        <View className="gap-4">
          <Pressable
            onPress={handleExportJson}
            disabled={loading}
            className="flex-row items-center justify-center gap-3 rounded-lg border-2 border-dashed border-emerald-300 bg-emerald-50/50 py-6 active:opacity-80 dark:border-emerald-700 dark:bg-emerald-900/20"
            accessibilityLabel="Xuất backup JSON"
            accessibilityRole="button"
          >
            {loading ? (
              <ActivityIndicator size="small" color="#059669" />
            ) : (
              <Ionicons name="download-outline" size={28} color="#059669" />
            )}
            <Text className="text-base font-medium text-emerald-800 dark:text-emerald-300">
              Xuất backup JSON
            </Text>
          </Pressable>

          <Pressable
            onPress={handleExportDb}
            disabled={loading}
            className="flex-row items-center justify-center gap-3 rounded-lg border-2 border-dashed border-emerald-300 bg-emerald-50/50 py-6 active:opacity-80 dark:border-emerald-700 dark:bg-emerald-900/20"
            accessibilityLabel="Xuất file .db"
            accessibilityRole="button"
          >
            {loading ? (
              <ActivityIndicator size="small" color="#059669" />
            ) : (
              <Ionicons name="server-outline" size={28} color="#059669" />
            )}
            <Text className="text-base font-medium text-emerald-800 dark:text-emerald-300">
              Xuất file .db
            </Text>
          </Pressable>

          <Pressable
            onPress={handleImportDb}
            disabled={loading}
            className="flex-row items-center justify-center gap-3 rounded-lg border-2 border-dashed border-amber-300 bg-amber-50/50 py-6 active:opacity-80 dark:border-amber-700 dark:bg-amber-900/20"
            accessibilityLabel="Khôi phục từ backup"
            accessibilityRole="button"
          >
            {loading ? (
              <ActivityIndicator size="small" color="#D97706" />
            ) : (
              <Ionicons name="cloud-upload-outline" size={28} color="#D97706" />
            )}
            <Text className="text-base font-medium text-amber-800 dark:text-amber-300">
              Khôi phục từ backup
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
