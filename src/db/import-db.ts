import type { SQLiteDatabase } from "expo-sqlite";
import {
  backupDatabaseAsync,
  openDatabaseAsync,
} from "expo-sqlite";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import type { DbExportData } from "./export-db";

const ENSURE_TODOS = `
  CREATE TABLE IF NOT EXISTS todos (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
`;

function parseDbUri(uri: string): { directory: string; databaseName: string } {
  const path = uri.replace(/^file:\/\//, "");
  const lastSlash = path.lastIndexOf("/");
  if (lastSlash < 0) {
    return { directory: path, databaseName: "backup.db" };
  }
  return {
    directory: path.substring(0, lastSlash),
    databaseName: path.substring(lastSlash + 1),
  };
}

export type ImportDbResult =
  | { success: true; storiesCount: number; message?: string }
  | { success: false; error: string; needsRestart?: boolean };

function validateDbExportData(data: unknown): data is DbExportData {
  if (!data || typeof data !== "object") return false;
  const o = data as Record<string, unknown>;
  if (typeof o.version !== "number" || !Array.isArray(o.stories)) return false;
  if (!Array.isArray(o.chapters) || !Array.isArray(o.reading_progress))
    return false;
  return true;
}

/**
 * Import database từ file JSON backup.
 * Thay thế toàn bộ dữ liệu hiện tại.
 */
export async function importDbFromJSON(
  db: SQLiteDatabase,
  jsonString: string
): Promise<ImportDbResult> {
  let data: unknown;
  try {
    data = JSON.parse(jsonString);
  } catch {
    return { success: false, error: "File JSON không hợp lệ" };
  }

  if (!validateDbExportData(data)) {
    return {
      success: false,
      error: "Cấu trúc backup không đúng. Cần có stories, chapters, reading_progress.",
    };
  }

  try {
    await db.withTransactionAsync(async () => {
      await db.runAsync("DELETE FROM reading_progress");
      await db.runAsync("DELETE FROM chapters");
      await db.runAsync("DELETE FROM stories");

      for (const s of data.stories) {
        await db.runAsync(
          `INSERT INTO stories (id, title, author, description, created_at)
           VALUES (?, ?, ?, ?, ?)`,
          s.id,
          s.title,
          s.author,
          s.description,
          s.created_at
        );
      }

      for (const c of data.chapters) {
        await db.runAsync(
          `INSERT INTO chapters (story_id, chapter_id, title, content, order_index)
           VALUES (?, ?, ?, ?, ?)`,
          c.story_id,
          c.chapter_id,
          c.title,
          c.content,
          c.order_index
        );
      }

      for (const p of data.reading_progress) {
        await db.runAsync(
          `INSERT INTO reading_progress (story_id, chapter_index, paragraph_index, updated_at)
           VALUES (?, ?, ?, ?)`,
          p.story_id,
          p.chapter_index,
          p.paragraph_index,
          p.updated_at
        );
      }
    });

    return {
      success: true,
      storiesCount: data.stories.length,
      message: `Đã import ${data.stories.length} truyện, ${data.chapters.length} chương.`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: `Lỗi khi import: ${msg}` };
  }
}

/**
 * Import database từ file .db (SQLite binary).
 * Dùng backupDatabaseAsync để copy dữ liệu mà không đóng kết nối chính.
 * @param db - Database instance (main db, giữ mở)
 * @param backupUri - URI của file backup (nếu đã chọn trước). Nếu không có sẽ mở picker.
 */
export async function importDbFromFile(
  db: SQLiteDatabase,
  backupUri?: string
): Promise<ImportDbResult> {
  let backupDb: SQLiteDatabase | null = null;

  try {
    let uri = backupUri;
    if (!uri) {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/x-sqlite3", "application/octet-stream"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.length) {
        return { success: false, error: "Đã hủy chọn file" };
      }
      uri = result.assets[0].uri;
    }

    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) {
      return { success: false, error: "Không tìm thấy file" };
    }

    const { directory, databaseName } = parseDbUri(uri);
    backupDb = await openDatabaseAsync(databaseName, {}, directory);

    await backupDatabaseAsync({
      sourceDatabase: backupDb,
      destDatabase: db,
    });

    try {
      await db.execAsync(ENSURE_TODOS);
    } catch {
      // ignore - table may already exist
    }

    const count = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM stories"
    );

    return {
      success: true,
      storiesCount: count?.count ?? 0,
      message: `Đã khôi phục ${count?.count ?? 0} truyện từ file .db`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg, needsRestart: false };
  } finally {
    if (backupDb) {
      try {
        await backupDb.closeAsync();
      } catch {
        // ignore
      }
    }
  }
}

/**
 * Mở file picker và import từ JSON hoặc .db dựa trên loại file.
 */
export async function importDbFromPicker(
  db: SQLiteDatabase
): Promise<ImportDbResult> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["application/json", "application/x-sqlite3", "application/octet-stream"],
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets?.length) {
    return { success: false, error: "Đã hủy chọn file" };
  }

  const file = result.assets[0];
  const uri = file.uri;
  const name = file.name?.toLowerCase() ?? "";

  if (name.endsWith(".json")) {
    const content = await FileSystem.readAsStringAsync(uri);
    return importDbFromJSON(db, content);
  }

  if (name.endsWith(".db") || name.endsWith(".sqlite")) {
    return importDbFromFile(db, uri);
  }

  const content = await FileSystem.readAsStringAsync(uri);
  try {
    JSON.parse(content);
    return importDbFromJSON(db, content);
  } catch {
    return { success: false, error: "Định dạng file không hỗ trợ. Dùng .json hoặc .db" };
  }
}
