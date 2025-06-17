import { PostalItem, PostalItemGroup } from '../types';

const STORAGE_KEY = 'postal-snap-items';
const GROUP_STORAGE_KEY = 'postal-snap-groups';

export const saveItems = (items: PostalItem[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    alert('保存に失敗しました（容量制限の可能性があります）');
    console.error('localStorage save error:', e);
  }
};

export const loadItems = (): PostalItem[] => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];
  
  return JSON.parse(stored).map((item: any) => ({
    ...item,
    createdAt: new Date(item.createdAt),
    updatedAt: new Date(item.updatedAt)
  }));
};

export const saveGroups = (groups: PostalItemGroup[]): void => {
  try {
    localStorage.setItem(GROUP_STORAGE_KEY, JSON.stringify(groups));
  } catch (e) {
    alert('保存に失敗しました（容量制限の可能性があります）');
    console.error('localStorage save error:', e);
  }
};

export const loadGroups = (): PostalItemGroup[] => {
  const stored = localStorage.getItem(GROUP_STORAGE_KEY);
  if (!stored) return [];
  
  return JSON.parse(stored).map((group: any) => ({
    ...group,
    createdAt: new Date(group.createdAt),
    updatedAt: new Date(group.updatedAt)
  }));
};

export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// インポート/エクスポート用の統合データ型
export interface StorageData {
  items: PostalItem[];
  groups: PostalItemGroup[];
  tags: any[];
}

// 統合データの保存
export const saveAllData = (data: StorageData): void => {
  if (data.items) saveItems(data.items);
  if (data.groups) saveGroups(data.groups);
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

try {
  localStorage.setItem('__test__', '1');
  localStorage.removeItem('__test__');
  alert('localStorageは利用可能です');
} catch (e) {
  alert('localStorageが利用できません: ' + e);
}

const fallbackResizedDataURL = await new Promise<string>((resolve) => {
  const img = new window.Image();
  img.onload = function() {
    let { width, height } = img;
    const scale = Math.min(300 / width, 300 / height, 1);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, width, height);
    resolve(canvas.toDataURL('image/jpeg', 0.5)); // 画質50%
  };
  img.src = URL.createObjectURL(file);
});