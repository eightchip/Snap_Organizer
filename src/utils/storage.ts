import { PhotoItem, PostalItemGroup, StorageData } from '../types';
import { deleteImageBlob } from './imageDB';
import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'postal_snap_db';
const DB_VERSION = 2;
const STORE_NAME = 'images';
const DATA_STORE = 'app_data';
const META_STORE = 'metadata';

let db: IDBPDatabase | null = null;

const initDB = async () => {
  if (db) return db;
  
  db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion) {
      // 画像バイナリ用のストア
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
      // アプリデータ用のストア
      if (!db.objectStoreNames.contains(DATA_STORE)) {
        db.createObjectStore(DATA_STORE);
      }
      // メタデータ用のストア
      if (!db.objectStoreNames.contains(META_STORE)) {
        const metaStore = db.createObjectStore(META_STORE, { keyPath: 'filename' });
        metaStore.createIndex('dateTaken', 'date_taken');
        metaStore.createIndex('location', ['location.lat', 'location.lon']);
        metaStore.createIndex('tags', 'tags', { multiEntry: true });
      }
    },
  });
  
  return db;
};

// 統合データの保存（この関数が唯一の保存手段となる）
export const saveAllData = async (data: StorageData): Promise<void> => {
  const database = await initDB();
  const oldData = await loadAllData();

  // 削除された画像を特定してDBから削除
  const oldImageIds = new Set([
    ...(oldData.items || []).map(i => i.image),
    ...(oldData.groups || []).flatMap(g => (g.photos || []).map(p => p.image))
  ].filter(Boolean)); // nullやundefinedを除外

  const newImageIds = new Set([
    ...(data.items || []).map(i => i.image),
    ...(data.groups || []).flatMap(g => (g.photos || []).map(p => p.image))
  ].filter(Boolean));

  for (const oldId of oldImageIds) {
    if (!newImageIds.has(oldId)) {
      try {
        await deleteImageBlob(oldId);
      } catch (error) {
        console.error(`Failed to delete orphaned image ${oldId}:`, error);
      }
    }
  }

  // 新しいデータ全体を保存する
  await database.put(DATA_STORE, data, 'storage_data');
};

// 統合データの読み込み
export async function loadAllData(): Promise<StorageData> {
  try {
    const database = await initDB();
    const data = await database.get(DATA_STORE, 'storage_data');
    if (!data) {
      return { items: [], groups: [], tags: [] };
    }
    return data;
  } catch (error) {
    console.error('データの読み込みに失敗しました:', error);
    return { items: [], groups: [], tags: [] };
  }
}

export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// アプリアイコンの保存と取得
export async function saveAppIcon(blob: Blob): Promise<string | null> {
  try {
    const url = URL.createObjectURL(blob);
    localStorage.setItem('app_icon', url);
    return url;
  } catch (error) {
    console.error('アイコンの保存に失敗しました:', error);
    return null;
  }
}

export const getAppIcon = (): string | null => {
  return localStorage.getItem('app_icon');
};

export const removeAppIcon = () => {
  const iconUrl = localStorage.getItem('app_icon');
  if (iconUrl) {
    URL.revokeObjectURL(iconUrl);
    localStorage.removeItem('app_icon');
  }
};