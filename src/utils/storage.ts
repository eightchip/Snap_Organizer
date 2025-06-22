import { StorageData } from '../types';
import { initDB, deleteImageBlob, saveAppIconToDB, loadAppIconFromDB, deleteAppIconFromDB } from './imageDB';
import { DBSchema, openDB } from 'idb';
import { PhotoItem, PostalItemGroup, Tag } from '../types';

const DB_NAME = 'PostalSnapDB';
const DB_VERSION = 1;
const STORE_NAME = 'storage_data';
const KEY = 'storage_data';

let dbPromise: Promise<IDBPDatabase<MyDB>> | null = null;

const getDbPromise = () => {
  if (!dbPromise) {
    dbPromise = openDB<MyDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
    });
  }
  return dbPromise;
};

export const saveAllData = async (data: { items: PhotoItem[], groups: PostalItemGroup[], tags: Tag[] }) => {
  try {
    const db = await getDbPromise();
    console.log('SAVING THIS DATA:', JSON.stringify(data, null, 2));
    await db.put(STORE_NAME, data, KEY);
    console.log('Data saved successfully.');
  } catch (error) {
    console.error('Failed to save data:', error);
    throw new Error('データベースへの保存に失敗しました。');
  }
};

export const loadAllData = async (): Promise<{ items: PhotoItem[], groups: PostalItemGroup[], tags: Tag[] }> => {
  try {
    const db = await getDbPromise();
    const data = await db.get(STORE_NAME, KEY);
    return data || { items: [], groups: [], tags: [] };
  } catch (error) {
    console.error('Failed to load data:', error);
    return { items: [], groups: [], tags: [] };
  }
};

export const clearAllData = async () => {
  try {
    const db = await getDbPromise();
    await db.clear(STORE_NAME);
    // You might want to clear image blobs as well
  } catch (error) {
    console.error('Failed to clear data:', error);
    throw new Error('全データの削除に失敗しました。');
  }
};

export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// アプリアイコンの保存と取得
export async function saveAppIcon(blob: Blob): Promise<string | null> {
  try {
    await saveAppIconToDB(blob);
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error('アイコンの保存に失敗しました:', error);
    return null;
  }
}

export const getAppIcon = async (): Promise<string | null> => {
  const blob = await loadAppIconFromDB();
  return blob ? URL.createObjectURL(blob) : null;
};

export const removeAppIcon = async () => {
  await deleteAppIconFromDB();
};