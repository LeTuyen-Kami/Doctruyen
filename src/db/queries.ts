import type { SQLiteDatabase } from "expo-sqlite";
import type { Chapter, Story, StoryWithChapters } from "./schema";

async function ensureReadingProgressTable(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS reading_progress (
      story_id TEXT PRIMARY KEY,
      chapter_index INTEGER NOT NULL,
      paragraph_index INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(story_id) REFERENCES stories(id)
    );
  `);
}

export interface ReadingProgressResult {
  chapter_index: number;
  paragraph_index: number;
}

export async function getAllStories(
  db: SQLiteDatabase
): Promise<StoryWithChapters[]> {
  const stories = await db.getAllAsync<Story>(
    "SELECT * FROM stories ORDER BY created_at DESC"
  );
  const result: StoryWithChapters[] = [];

  for (const story of stories) {
    const countRow = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM chapters WHERE story_id = ?",
      story.id
    );
    result.push({
      ...story,
      chapterCount: countRow?.count ?? 0,
    });
  }

  return result;
}

export async function getStoryById(
  db: SQLiteDatabase,
  id: string
): Promise<Story | null> {
  const row = await db.getFirstAsync<Story>(
    "SELECT * FROM stories WHERE id = ?",
    id
  );
  return row ?? null;
}

export async function getChaptersByStoryId(
  db: SQLiteDatabase,
  storyId: string
): Promise<Chapter[]> {
  return db.getAllAsync<Chapter>(
    "SELECT * FROM chapters WHERE story_id = ? ORDER BY order_index ASC",
    storyId
  );
}

export async function getChapterByIndex(
  db: SQLiteDatabase,
  storyId: string,
  index: number
): Promise<Chapter | null> {
  const row = await db.getFirstAsync<Chapter>(
    "SELECT * FROM chapters WHERE story_id = ? ORDER BY order_index ASC LIMIT 1 OFFSET ?",
    storyId,
    index
  );
  return row ?? null;
}

export async function deleteStory(
  db: SQLiteDatabase,
  storyId: string
): Promise<void> {
  await db.runAsync("DELETE FROM chapters WHERE story_id = ?", storyId);
  await db.runAsync("DELETE FROM stories WHERE id = ?", storyId);
  try {
    await db.runAsync(
      "DELETE FROM reading_progress WHERE story_id = ?",
      storyId
    );
  } catch {
    await ensureReadingProgressTable(db);
  }
}

export async function getReadingProgress(
  db: SQLiteDatabase,
  storyId: string
): Promise<ReadingProgressResult | null> {
  try {
    const row = await db.getFirstAsync<{
      chapter_index: number;
      paragraph_index: number;
    }>(
      "SELECT chapter_index, paragraph_index FROM reading_progress WHERE story_id = ?",
      storyId
    );
    return row ?? null;
  } catch (e) {
    const msg = String(e);
    if (msg.includes("no such table") || msg.includes("reading_progress")) {
      await ensureReadingProgressTable(db);
      const row = await db.getFirstAsync<{
        chapter_index: number;
        paragraph_index: number;
      }>(
        "SELECT chapter_index, paragraph_index FROM reading_progress WHERE story_id = ?",
        storyId
      );
      return row ?? null;
    }
    throw e;
  }
}

export async function saveReadingProgress(
  db: SQLiteDatabase,
  storyId: string,
  chapterIndex: number,
  paragraphIndex: number
): Promise<void> {
  try {
    await db.runAsync(
      `INSERT INTO reading_progress (story_id, chapter_index, paragraph_index, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(story_id) DO UPDATE SET
         chapter_index = excluded.chapter_index,
         paragraph_index = excluded.paragraph_index,
         updated_at = excluded.updated_at`,
      storyId,
      chapterIndex,
      paragraphIndex,
      Date.now()
    );
  } catch (e) {
    const msg = String(e);
    if (msg.includes("no such table") || msg.includes("reading_progress")) {
      await ensureReadingProgressTable(db);
      await db.runAsync(
        `INSERT INTO reading_progress (story_id, chapter_index, paragraph_index, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(story_id) DO UPDATE SET
           chapter_index = excluded.chapter_index,
           paragraph_index = excluded.paragraph_index,
           updated_at = excluded.updated_at`,
        storyId,
        chapterIndex,
        paragraphIndex,
        Date.now()
      );
    } else {
      throw e;
    }
  }
}
