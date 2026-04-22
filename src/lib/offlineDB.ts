import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'samaq_offline_db';
const STORE_NAME = 'chapters';
const VERSION = 1;

export interface OfflineChapter {
  id: string; // chapterId
  mangaId: string;
  mangaTitle: string;
  chapterTitle: string;
  chapterNumber: number;
  coverUrl: string;
  images: string[]; // base64 or blob urls
  savedAt: number;
}

export async function initDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    },
  });
}

export async function saveChapterOffline(chapter: OfflineChapter) {
  const db = await initDB();
  await db.put(STORE_NAME, chapter);
}

export async function getOfflineChapters(): Promise<OfflineChapter[]> {
  const db = await initDB();
  return db.getAll(STORE_NAME);
}

export async function removeOfflineChapter(id: string) {
  const db = await initDB();
  await db.delete(STORE_NAME, id);
}

export async function clearAllOffline() {
  const db = await initDB();
  await db.clear(STORE_NAME);
}
