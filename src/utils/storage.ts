import { StorageData } from '../types';
import { initDB, deleteImageBlob, saveAppIconToDB, loadAppIconFromDB, deleteAppIconFromDB } from './imageDB';

// openDB, IDBPDatabase, DB_NAME, DB_VERSION, STORE_NAME, DATA_STORE, META_STORE, db, initDB などの定義・importは全て削除

// 統合データの保存
export const saveAllData = async (data: StorageData): Promise<void> => {
  console.log("Saving data to DB:", JSON.stringify(data, null, 2));
  const database = await initDB();
  const oldData = await loadAllData();

  // 削除された画像を特定してDBから削除
  const oldImageIds = new Set([
    ...(oldData.items || []).map(i => i.image),
    ...(oldData.groups || []).flatMap(g => (g.photos || []).map(p => p.image))
  ].filter(Boolean));

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
  await database.put('data', data, 'storage_data');
};

// 統合データの読み込み
export async function loadAllData(): Promise<StorageData> {
  try {
    const database = await initDB();
    const data = await database.get('data', 'storage_data');
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