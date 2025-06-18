import { useState, useEffect } from 'react';
import { PhotoItem, PostalItemGroup } from '../types';
import { loadItems, saveItems, loadGroups, saveGroups } from '../utils/storage';

export const usePostalItems = () => {
  const [items, setItems] = useState<PhotoItem[]>([]);
  const [groups, setGroups] = useState<PostalItemGroup[]>([]);

  useEffect(() => {
    const storedItems = loadItems();
    const storedGroups = loadGroups();
    setItems(storedItems);
    setGroups(storedGroups);
  }, []);

  useEffect(() => {
    saveItems(items);
  }, [items]);

  const addItem = (itemData: Omit<PhotoItem, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date();
    const newItem: PhotoItem = {
      ...itemData,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    setItems(prev => [...prev, newItem]);
    return newItem;
  };

  const addGroup = (groupData: PostalItemGroup) => {
    setGroups(prev => [...prev, groupData]);
    return groupData;
  };

  const updateItem = (id: string, updates: Partial<PhotoItem>) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        return {
          ...item,
          ...updates,
          updatedAt: new Date()
        };
      }
      return item;
    }));
  };

  const updateGroup = (id: string, updates: Partial<PostalItemGroup>) => {
    setGroups(prev => prev.map(group => {
      if (group.id === id) {
        return {
          ...group,
          ...updates,
          updatedAt: new Date()
        };
      }
      return group;
    }));
  };

  const getItem = (id: string): PhotoItem | undefined => {
    return items.find(item => item.id === id);
  };

  const getGroup = (id: string): PostalItemGroup | undefined => {
    return groups.find(group => group.id === id);
  };

  return {
    items,
    groups,
    addItem,
    addGroup,
    updateItem,
    updateGroup,
    getItem,
    getGroup
  };
};