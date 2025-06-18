import { PhotoItem, PostalItemGroup, StorageData } from '../types';

const STORAGE_KEY = 'postal_snap_data';
const GROUP_STORAGE_KEY = 'postal-snap-groups';

export const saveItems = (items: PhotoItem[]): void => {
  const data = loadStorageData();
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

export const saveGroups = (groups: PostalItemGroup[]): void => {
  const data = loadStorageData();
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