import { sortByChapterNumber } from "@/src/utils/sortChapter";
import { extractEpubToStoryJSON } from "@/src/utils/epub-extract";
import type { SQLiteDatabase } from "expo-sqlite";

export interface StoryJSON {
  id: string;
  title: string;
  author: string;
  description: string;
  chapters: {
    id: string;
    title: string;
    content: string;
  }[];
}

function validateStoryJSON(data: unknown): data is StoryJSON {
  if (!data || typeof data !== "object") return false;
  const o = data as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.title !== "string") return false;
  if (typeof o.author !== "string" || typeof o.description !== "string")
    return false;
  if (!Array.isArray(o.chapters)) return false;
  for (const ch of o.chapters) {
    if (
      !ch ||
      typeof ch !== "object" ||
      typeof (ch as { id?: unknown }).id !== "string" ||
      typeof (ch as { title?: unknown }).title !== "string" ||
      typeof (ch as { content?: unknown }).content !== "string"
    ) {
      return false;
    }
  }
  return true;
}

export async function importStoryFromJSON(
  db: SQLiteDatabase,
  jsonString: string,
  isChaptersSorted: boolean = false
): Promise<
  { success: true; title: string } | { success: false; error: string }
> {
  let data: unknown;
  try {
    data = JSON.parse(jsonString);
  } catch {
    return { success: false, error: "File JSON không hợp lệ" };
  }

  if (!validateStoryJSON(data)) {
    return {
      success: false,
      error:
        "Cấu trúc JSON không đúng. Cần có: id, title, author, description, chapters[]",
    };
  }

  const now = Date.now();

  try {
    await db.runAsync(
      `INSERT OR REPLACE INTO stories (id, title, author, description, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      data.id,
      data.title,
      data.author,
      data.description,
      now
    );

    await db.runAsync("DELETE FROM chapters WHERE story_id = ?", data.id);

    const sortedChapters = isChaptersSorted
      ? data.chapters
      : sortByChapterNumber(data.chapters);

    for (let i = 0; i < sortedChapters.length; i++) {
      const ch = sortedChapters[i];
      await db.runAsync(
        `INSERT INTO chapters (story_id, chapter_id, title, content, order_index)
         VALUES (?, ?, ?, ?, ?)`,
        data.id,
        ch.id,
        ch.title,
        ch.content,
        i
      );
    }

    return { success: true, title: data.title };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: `Lỗi khi lưu: ${msg}` };
  }
}

/**
 * Import story from EPUB file.
 * Extracts metadata and chapters from EPUB, then saves to SQLite.
 */
export async function importStoryFromEpub(
  db: SQLiteDatabase,
  epubBase64OrBuffer: string | ArrayBuffer | Uint8Array,
  isChaptersSorted: boolean = true
): Promise<
  { success: true; title: string } | { success: false; error: string }
> {
  const extractResult = await extractEpubToStoryJSON(epubBase64OrBuffer);

  if (!extractResult.success) {
    return { success: false, error: extractResult.error };
  }

  const jsonString = JSON.stringify(extractResult.data);
  return importStoryFromJSON(db, jsonString, isChaptersSorted);
}
