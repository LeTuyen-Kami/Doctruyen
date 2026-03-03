import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import type { SQLiteDatabase } from "expo-sqlite";

async function writeAndShare(
  filename: string,
  content: string | Uint8Array,
  mimeType: string,
  share: boolean
): Promise<{ uri: string } | { error: string }> {
  try {
    const file = new File(Paths.cache, filename);
    file.create({ overwrite: true });
    file.write(content);
    if (share) {
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(file.uri, {
          mimeType,
          dialogTitle: "Xuất backup Doctruyen",
        });
      }
      file.delete();
    }
    return { uri: file.uri };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg };
  }
}

export interface DbExportData {
  version: number;
  exportedAt: number;
  stories: Array<{
    id: string;
    title: string;
    author: string;
    description: string;
    created_at: number;
  }>;
  chapters: Array<{
    id: number;
    story_id: string;
    chapter_id: string;
    title: string;
    content: string;
    order_index: number;
  }>;
  reading_progress: Array<{
    story_id: string;
    chapter_index: number;
    paragraph_index: number;
    updated_at: number;
  }>;
}

export type ExportResult =
  | { success: true; path?: string }
  | { success: false; error: string };

/**
 * Export toàn bộ database ra file JSON.
 * Có thể share qua AirDrop, email, v.v.
 * Dùng expo-file-system API mới (không dùng legacy) để tránh crash trên production.
 */
export async function exportDbToJSON(
  db: SQLiteDatabase,
  share: boolean = true
): Promise<ExportResult> {
  try {
    const [stories, chapters, progress] = await Promise.all([
      db
        .getAllAsync<DbExportData["stories"][0]>("SELECT * FROM stories")
        .catch(() => [] as DbExportData["stories"]),
      db
        .getAllAsync<DbExportData["chapters"][0]>("SELECT * FROM chapters")
        .catch(() => [] as DbExportData["chapters"]),
      db
        .getAllAsync<DbExportData["reading_progress"][0]>(
          "SELECT * FROM reading_progress"
        )
        .catch(() => [] as DbExportData["reading_progress"]),
    ]);

    const data: DbExportData = {
      version: 1,
      exportedAt: Date.now(),
      stories,
      chapters,
      reading_progress: progress,
    };

    const json = JSON.stringify(data, null, 2);
    const filename = `doctruyen-backup-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    const result = await writeAndShare(
      filename,
      json,
      "application/json",
      share
    );
    if ("error" in result) throw new Error(result.error);
    return { success: true, path: share ? undefined : result.uri };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg };
  }
}

/**
 * Export database dưới dạng file .db (SQLite binary).
 * Dùng serializeAsync để tạo bản sao nhất quán.
 * Ghi trực tiếp bytes (không base64) để tránh memory/stack issues.
 */
export async function exportDbToFile(
  db: SQLiteDatabase,
  share: boolean = true
): Promise<ExportResult> {
  try {
    try {
      await db.execAsync("PRAGMA wal_checkpoint(TRUNCATE)");
    } catch {
      try {
        await db.execAsync("PRAGMA wal_checkpoint(FULL)");
      } catch {
        // Bỏ qua nếu PRAGMA thất bại (db có thể không dùng WAL)
      }
    }

    const data = await db.serializeAsync();
    const bytes = new Uint8Array(data);

    const filename = `doctruyen-${new Date().toISOString().slice(0, 10)}.db`;
    const result = await writeAndShare(
      filename,
      bytes,
      "application/x-sqlite3",
      share
    );
    if ("error" in result) throw new Error(result.error);
    return { success: true, path: share ? undefined : result.uri };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg };
  }
}
