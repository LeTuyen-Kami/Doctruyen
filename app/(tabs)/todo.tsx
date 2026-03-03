import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

import SafeAreaView from "@/components/SafeAreaView";
import type { Todo } from "@/src/db/schema";
import {
  createTodo,
  deleteTodo,
  getAllTodos,
  updateTodo,
} from "@/src/db/todo-queries";
import { generateUUID } from "@/src/utils/string";

export default function TodoScreen() {
  const db = useSQLiteContext();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputValue, setInputValue] = useState("");
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [editValue, setEditValue] = useState("");

  const loadTodos = useCallback(async () => {
    try {
      const data = await getAllTodos(db);
      setTodos(data);
    } catch (e) {
      console.error("Failed to load todos:", e);
    } finally {
      setLoading(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadTodos();
    }, [loadTodos])
  );

  const handleAdd = useCallback(async () => {
    const title = inputValue.trim();
    if (!title) return;
    try {
      const id = generateUUID();
      await createTodo(db, id, title);
      setTodos((prev) => [
        { id, title, completed: 0, created_at: Date.now() },
        ...prev,
      ]);
      setInputValue("");
    } catch (e) {
      console.error("Failed to add todo:", e);
      Alert.alert("Lỗi", "Không thể thêm todo.");
    }
  }, [db, inputValue]);

  const handleUpdate = useCallback(
    async (id: string, title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      try {
        await updateTodo(db, id, { title: trimmed });
        setTodos((prev) =>
          prev.map((t) => (t.id === id ? { ...t, title: trimmed } : t))
        );
        setEditingTodo(null);
        setEditValue("");
      } catch (e) {
        console.error("Failed to update todo:", e);
        Alert.alert("Lỗi", "Không thể cập nhật todo.");
      }
    },
    [db]
  );

  const handleToggleComplete = useCallback(
    async (todo: Todo) => {
      const completed = todo.completed ? 0 : 1;
      try {
        await updateTodo(db, todo.id, { completed });
        setTodos((prev) =>
          prev.map((t) => (t.id === todo.id ? { ...t, completed } : t))
        );
      } catch (e) {
        console.error("Failed to toggle todo:", e);
      }
    },
    [db]
  );

  const handleDelete = useCallback(
    async (todo: Todo) => {
      Alert.alert("Xóa todo", `Bạn có chắc muốn xóa "${todo.title}"?`, [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteTodo(db, todo.id);
              setTodos((prev) => prev.filter((t) => t.id !== todo.id));
              if (editingTodo?.id === todo.id) {
                setEditingTodo(null);
                setEditValue("");
              }
            } catch (e) {
              console.error("Failed to delete todo:", e);
              Alert.alert("Lỗi", "Không thể xóa todo.");
            }
          },
        },
      ]);
    },
    [db, editingTodo]
  );

  const openEditModal = useCallback((todo: Todo) => {
    setEditingTodo(todo);
    setEditValue(todo.title);
  }, []);

  const closeEditModal = useCallback(() => {
    setEditingTodo(null);
    setEditValue("");
  }, []);

  const submitEdit = useCallback(() => {
    if (editingTodo) {
      handleUpdate(editingTodo.id, editValue);
    }
  }, [editingTodo, editValue, handleUpdate]);

  return (
    <SafeAreaView className="flex-1 bg-[#FDFBF7] dark:bg-[#1A1A1A]">
      <View className="flex-1 px-4 pt-4">
        <Text className="mb-4 text-2xl font-bold text-[#1A1A1A] dark:text-[#F5F5F5]">
          Todo
        </Text>

        {/* Add input */}
        <View className="mb-4 flex-row gap-2">
          <TextInput
            className="flex-1 rounded-lg border border-gray-200 bg-white px-4 py-3 text-base text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            placeholder="Thêm việc cần làm..."
            placeholderTextColor="#94A3B8"
            value={inputValue}
            onChangeText={setInputValue}
            onSubmitEditing={handleAdd}
            returnKeyType="done"
          />
          <Pressable
            onPress={handleAdd}
            className="items-center justify-center rounded-lg bg-[#1A1A1A] px-5 dark:bg-[#F5F5F5]"
            accessibilityLabel="Thêm todo"
            accessibilityRole="button"
          >
            <Ionicons
              name="add"
              size={24}
              color="#1A1A1A"
              style={{ transform: [{ scale: 1.2 }] }}
            />
          </Pressable>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#1A1A1A" />
          </View>
        ) : todos.length === 0 ? (
          <View className="flex-1 items-center justify-center py-12">
            <Text className="text-center text-gray-500 dark:text-gray-400">
              Chưa có todo. Hãy thêm việc cần làm ở trên.
            </Text>
          </View>
        ) : (
          <FlatList
            data={todos}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View className="mb-3 flex-row items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
                <Pressable
                  onPress={() => handleToggleComplete(item)}
                  className="rounded-full p-1 active:opacity-70"
                  accessibilityLabel={
                    item.completed ? "Đánh dấu chưa xong" : "Đánh dấu đã xong"
                  }
                  accessibilityRole="button"
                >
                  <Ionicons
                    name={
                      item.completed ? "checkmark-circle" : "ellipse-outline"
                    }
                    size={28}
                    color={item.completed ? "#22C55E" : "#94A3B8"}
                  />
                </Pressable>
                <Pressable
                  onPress={() => openEditModal(item)}
                  className="flex-1 active:opacity-80"
                  accessibilityLabel={`Sửa: ${item.title}`}
                  accessibilityRole="button"
                >
                  <Text
                    className={`text-base ${
                      item.completed
                        ? "text-gray-400 line-through dark:text-gray-500"
                        : "text-gray-900 dark:text-gray-100"
                    }`}
                    numberOfLines={2}
                  >
                    {item.title}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => handleDelete(item)}
                  className="rounded-full p-2 active:opacity-70"
                  accessibilityLabel="Xóa todo"
                  accessibilityRole="button"
                >
                  <Ionicons name="trash-outline" size={22} color="#DC2626" />
                </Pressable>
              </View>
            )}
            contentContainerStyle={{ paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {/* Edit Modal */}
      <Modal
        visible={!!editingTodo}
        transparent
        animationType="fade"
        onRequestClose={closeEditModal}
      >
        <Pressable
          className="flex-1 items-center justify-center bg-black/50 p-4"
          onPress={closeEditModal}
        >
          <Pressable
            className="w-full max-w-md rounded-xl bg-white p-4 dark:bg-gray-900"
            onPress={(e) => e.stopPropagation()}
          >
            <Text className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
              Sửa todo
            </Text>
            <TextInput
              className="mb-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-base text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              placeholder="Nội dung todo"
              placeholderTextColor="#94A3B8"
              value={editValue}
              onChangeText={setEditValue}
              autoFocus
              onSubmitEditing={submitEdit}
            />
            <View className="flex-row justify-end gap-2">
              <Pressable
                onPress={closeEditModal}
                className="rounded-lg bg-gray-200 px-4 py-2 dark:bg-gray-700"
              >
                <Text className="font-medium text-gray-700 dark:text-gray-300">
                  Hủy
                </Text>
              </Pressable>
              <Pressable
                onPress={submitEdit}
                className="rounded-lg bg-[#1A1A1A] px-4 py-2 dark:bg-[#F5F5F5]"
              >
                <Text className="font-medium text-white dark:text-gray-900">
                  Lưu
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
