import { PhotoItem, PostalItemGroup, StorageData } from '../types';
import { deleteImageBlob } from './imageDB';

const STORAGE_KEY = 'postal_snap_data';
const GROUP_STORAGE_KEY = 'postal-snap-groups';

export const saveItems = async (items: PhotoItem[]): Promise<void> => {
  const data = loadStorageData();
  // 削除された画像を特定して削除
  const oldImageIds = new Set(data.items.map(item => item.image));
  const newImageIds = new Set(items.map(item => item.image));
  for (const oldId of oldImageIds) {
    if (!newImageIds.has(oldId)) {
      await deleteImageBlob(oldId);
    }
  }
  data.items = items;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

export const loadItems = (): PhotoItem[] => {
  const data = loadStorageData();
  return data.items.map(item => ({
    ...item,
    createdAt: new Date(item.createdAt),
    updatedAt: new Date(item.updatedAt)
  }));
};

export const saveGroups = async (groups: PostalItemGroup[]): Promise<void> => {
  const data = loadStorageData();
  // 削除された画像を特定して削除
  const oldImageIds = new Set(data.groups.flatMap(group => group.photos.map(photo => photo.image)));
  const newImageIds = new Set(groups.flatMap(group => group.photos.map(photo => photo.image)));
  for (const oldId of oldImageIds) {
    if (!newImageIds.has(oldId)) {
      await deleteImageBlob(oldId);
    }
  }
  data.groups = groups;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

export const loadGroups = (): PostalItemGroup[] => {
  const data = loadStorageData();
  return data.groups.map(group => ({
    ...group,
    createdAt: new Date(group.createdAt),
    updatedAt: new Date(group.updatedAt)
  }));
};

const loadStorageData = (): StorageData => {
  const storedData = localStorage.getItem(STORAGE_KEY);
  if (!storedData) {
    return { items: [], groups: [], tags: [] };
  }
  return JSON.parse(storedData);
};

export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// 統合データの保存
export const saveAllData = async (data: StorageData): Promise<void> => {
  if (data.items) await saveItems(data.items);
  if (data.groups) await saveGroups(data.groups);
  if (data.tags) localStorage.setItem('postal_tags', JSON.stringify(data.tags));
};

// 統合データの読み込み
export const loadAllData = (): StorageData => {
  return {
    items: loadItems(),
    groups: loadGroups(),
    tags: JSON.parse(localStorage.getItem('postal_tags') || '[]')
  };
};

// アプリアイコンの保存と取得
export const saveAppIcon = async (imageBlob: Blob) => {
  try {
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
      reader.onload = () => {
        const base64 = reader.result as string;
        localStorage.setItem('app_icon', base64);
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(imageBlob);
    });
  } catch (error) {
    console.error('アイコンの保存に失敗しました:', error);
    throw error;
  }
};

export const getAppIcon = (): string | null => {
  return localStorage.getItem('app_icon');
};

export const removeAppIcon = () => {
  localStorage.removeItem('app_icon');
};