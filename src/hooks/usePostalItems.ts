import { useState, useCallback } from 'react';
import { PhotoItem, PostalItemGroup } from '../types';
import { v4 as uuidv4 } from 'uuid';

export const usePostalItems = () => {
  const [items, setItems] = useState<PhotoItem[]>([]);
  const [groups, setGroups] = useState<PostalItemGroup[]>([]);
  
  // このフックは状態の保持とそれに関連するロジックのみに責任を持つ。
  // データの読み込み（初期化）はApp.tsxに一元化するため、
  // isInitializedとuseEffectによるloadAllDataの呼び出しは削除する。

  const getGroup = useCallback((id: string) => {
    return groups.find(g => g.id === id);
  }, [groups]);

  const updateGroup = useCallback(async (id: string, updates: Partial<PostalItemGroup>) => {
    const currentGroup = getGroup(id);
    if (!currentGroup) return;

    const updatedGroup = { ...currentGroup, ...updates, updatedAt: new Date() };
    const newGroups = groups.map(g => (g.id === id ? updatedGroup : g));
    setGroups(newGroups);
  }, [groups, getGroup]);

  const deleteGroup = useCallback(async (id: string) => {
    const newGroups = groups.filter(g => g.id !== id);
    setGroups(newGroups);
  }, [groups]);
  
  const getItem = useCallback((id: string) => {
    let foundItem: PhotoItem | undefined;
    
    // First, search in top-level items
    foundItem = items.find(i => i.id === id);
    if (foundItem) return foundItem;
    
    // If not found, search within groups
    for (const group of groups) {
      foundItem = group.photos.find(p => p.id === id);
      if (foundItem) return foundItem;
    }
    
    return undefined;
  }, [items, groups]);

  const updateItem = useCallback(async (id: string, updates: Partial<PhotoItem>) => {
    let itemFound = false;

    const updateInItems = (currentItems: PhotoItem[]): PhotoItem[] => {
      return currentItems.map(item => {
        if (item.id === id) {
          itemFound = true;
          return { ...item, ...updates, updatedAt: new Date() };
        }
        return item;
      });
    };

    let newItems = updateInItems(items);

    if (itemFound) {
      setItems(newItems);
    } else {
      const newGroups = groups.map(group => {
        const updatedPhotos = updateInItems(group.photos);
        if (itemFound) {
          return { ...group, photos: updatedPhotos, updatedAt: new Date() };
        }
        return group;
      });
      setGroups(newGroups);
    }
  }, [items, groups]);

  const addGroup = useCallback(async (newGroupData: Omit<PostalItemGroup, 'id'>) => {
    const newGroup: PostalItemGroup = {
      ...newGroupData,
      id: uuidv4(),
    };
    setGroups(prev => [...prev, newGroup]);
  }, []);

  const deleteItem = useCallback(async (id: string) => {
    let itemFoundInRoot = false;
    const newItems = items.filter(item => {
      if (item.id === id) {
        itemFoundInRoot = true;
        return false;
      }
      return true;
    });

    if (itemFoundInRoot) {
      setItems(newItems);
    } else {
      const newGroups = groups.map(group => ({
        ...group,
        photos: group.photos.filter(p => p.id !== id)
      }));
      setGroups(newGroups);
    }
  }, [items, groups]);

  const addItem = useCallback(async (newItemData: Omit<PhotoItem, 'id'>) => {
    const newItem: PhotoItem = {
      ...newItemData,
      id: uuidv4()
    };
    setItems(prev => [...prev, newItem]);
  }, []);

  return {
    items,
    groups,
    addItem,
    addGroup,
    updateItem,
    getItem,
    getGroup,
    updateGroup,
    deleteItem,
    deleteGroup,
    setItems,
    setGroups,
  };
};