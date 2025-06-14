import { PostalItem } from '../types';

const STORAGE_KEY = 'postal-snap-items';

export const saveItems = (items: PostalItem[]): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
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

export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};