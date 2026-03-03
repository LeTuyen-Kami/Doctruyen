import type { SQLiteDatabase } from "expo-sqlite";

export interface Story {
  id: string;
  title: string;
  author: string;
  description: string;
  created_at: number;
}

export interface Chapter {
  id: number;
  story_id: string;
  chapter_id: string;
  title: string;
  content: string;
  order_index: number;
}

export interface StoryWithChapters extends Story {
  chapterCount: number;
}

export interface ReadingProgress {
  story_id: string;
  chapter_index: number;
  paragraph_index: number;
  updated_at: number;
}

export interface Todo {
  id: string;
  title: string;
  completed: number;
  created_at: number;
}

const DATABASE_VERSION = 3;

const CREATE_READING_PROGRESS = `
  CREATE TABLE IF NOT EXISTS reading_progress (
    story_id TEXT PRIMARY KEY,
    chapter_index INTEGER NOT NULL,
    paragraph_index INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(story_id) REFERENCES stories(id)
  );
`;

const CREATE_TODOS = `
  CREATE TABLE IF NOT EXISTS todos (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
`;

export async function migrateDb(db: SQLiteDatabase) {
  try {
    const result = await db.getFirstAsync<{
      user_version: number;
    }>("PRAGMA user_version");

    const currentDbVersion = result?.user_version ?? 0;

    if (currentDbVersion === 0) {
      await db.execAsync(`
        PRAGMA journal_mode = 'wal';
        CREATE TABLE IF NOT EXISTS stories (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          author TEXT NOT NULL,
          description TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS chapters (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          story_id TEXT NOT NULL,
          chapter_id TEXT NOT NULL,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          order_index INTEGER NOT NULL,
          FOREIGN KEY(story_id) REFERENCES stories(id)
        );
        CREATE INDEX IF NOT EXISTS idx_chapters_story ON chapters(story_id);
      `);
    }

    await db.execAsync(CREATE_READING_PROGRESS);

    try {
      await db.execAsync(CREATE_TODOS);
    } catch (e) {
      if (__DEV__) {
        console.warn("Migration: CREATE_TODOS failed:", e);
      }
    }

    if (currentDbVersion < DATABASE_VERSION) {
      await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
    }
  } catch (e) {
    if (__DEV__) {
      console.error("Migration failed:", e);
    }
  }
}
