import type { SQLiteDatabase } from "expo-sqlite";
import type { Todo } from "./schema";

export async function getAllTodos(db: SQLiteDatabase): Promise<Todo[]> {
  try {
    return await db.getAllAsync<Todo>(
      "SELECT * FROM todos ORDER BY created_at DESC"
    );
  } catch (e) {
    const msg = String(e);
    if (msg.includes("no such table") || msg.includes("todos")) {
      return [];
    }
    throw e;
  }
}

export async function createTodo(
  db: SQLiteDatabase,
  id: string,
  title: string
): Promise<void> {
  const now = Date.now();
  await db.runAsync(
    "INSERT INTO todos (id, title, completed, created_at) VALUES (?, ?, 0, ?)",
    id,
    title.trim(),
    now
  );
}

export async function updateTodo(
  db: SQLiteDatabase,
  id: string,
  updates: { title?: string; completed?: number }
): Promise<void> {
  if (updates.title !== undefined) {
    await db.runAsync("UPDATE todos SET title = ? WHERE id = ?", updates.title.trim(), id);
  }
  if (updates.completed !== undefined) {
    await db.runAsync("UPDATE todos SET completed = ? WHERE id = ?", updates.completed, id);
  }
}

export async function deleteTodo(
  db: SQLiteDatabase,
  id: string
): Promise<void> {
  await db.runAsync("DELETE FROM todos WHERE id = ?", id);
}
