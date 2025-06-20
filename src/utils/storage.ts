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

export const saveItems = async (items: PhotoItem[]): Promise<void> => {
  const database = await initDB();
  const oldData = await loadStorageData();
  
  // 削除された画像を特定して削除
  const oldImageIds = new Set(oldData.items.map(item => item.image));
  const newImageIds = new Set(items.map(item => item.image));
  for (const oldId of oldImageIds) {
    if (!newImageIds.has(oldId)) {
      await deleteImageBlob(oldId);
    }
  }

  const data = { ...oldData, items };
  await database.put(DATA_STORE, data, 'storage_data');
};

export const loadItems = async (): Promise<PhotoItem[]> => {
  const data = await loadStorageData();
  return data.items.map(item => ({
    ...item,
    createdAt: new Date(item.createdAt),
    updatedAt: new Date(item.updatedAt)
  }));
};

export const saveGroups = async (groups: PostalItemGroup[]): Promise<void> => {
  const database = await initDB();
  const oldData = await loadStorageData();
  
  // 削除された画像を特定して削除
  const oldImageIds = new Set(oldData.groups.flatMap(group => group.photos.map(photo => photo.image)));
  const newImageIds = new Set(groups.flatMap(group => group.photos.map(photo => photo.image)));
  for (const oldId of oldImageIds) {
    if (!newImageIds.has(oldId)) {
      await deleteImageBlob(oldId);
    }
  }

  const data = { ...oldData, groups };
  await database.put(DATA_STORE, data, 'storage_data');
};

export const loadGroups = async (): Promise<PostalItemGroup[]> => {
  const data = await loadStorageData();
  return data.groups.map(group => ({
    ...group,
    createdAt: new Date(group.createdAt),
    updatedAt: new Date(group.updatedAt)
  }));
};

const loadStorageData = async (): Promise<StorageData> => {
  const database = await initDB();
  const data = await database.get(DATA_STORE, 'storage_data');
  if (!data) {
    return { items: [], groups: [], tags: [] };
  }
  return data;
};

export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// 統合データの保存
export const saveAllData = async (data: StorageData): Promise<void> => {
  const database = await initDB();
  if (data.items) await saveItems(data.items);
  if (data.groups) await saveGroups(data.groups);
  if (data.tags) await database.put(DATA_STORE, data.tags, 'tags');
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
  localStorage.removeItem('app_icon');
  const iconUrl = localStorage.getItem('app_icon');
  if (iconUrl) {
    URL.revokeObjectURL(iconUrl);
  }
};