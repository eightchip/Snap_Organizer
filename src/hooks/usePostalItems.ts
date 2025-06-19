import { useState, useEffect } from 'react';
import { PhotoItem, PostalItemGroup } from '../types';
import { loadItems, saveItems, loadGroups, saveGroups, saveAllData } from '../utils/storage';

export const usePostalItems = () => {
  const [items, setItems] = useState<PhotoItem[]>([]);
  const [groups, setGroups] = useState<PostalItemGroup[]>([]);

  // 初期データ読み込み
  useEffect(() => {
    setItems(loadItems());
    setGroups(loadGroups());
  }, []);

  // アイテムの保存
  const saveItem = (item: PhotoItem) => {
    const updatedItems = [...items, item];
    setItems(updatedItems);
    saveItems(updatedItems);
  };

  // グループの保存
  const saveGroup = (group: PostalItemGroup) => {
    const updatedGroups = [...groups, group];
    setGroups(updatedGroups);
    saveGroups(updatedGroups);
  };

  // アイテムの更新
  const updateItem = (itemId: string, updates: Partial<PhotoItem>) => {
    const updatedItems = items.map(item =>
      item.id === itemId ? { ...item, ...updates } : item
    );
    setItems(updatedItems);
    saveItems(updatedItems);
  };

  // グループの更新
  const updateGroup = (groupId: string, updates: Partial<PostalItemGroup>) => {
    const updatedGroups = groups.map(group =>
      group.id === groupId ? { ...group, ...updates } : group
    );
    setGroups(updatedGroups);
    saveGroups(updatedGroups);
  };

  // アイテムの削除
  const deleteItem = async (itemId: string) => {
    const updatedItems = items.filter(item => item.id !== itemId);
    setItems(updatedItems);
    await saveItems(updatedItems);
  };

  // グループの削除
  const deleteGroup = async (groupId: string) => {
    const updatedGroups = groups.filter(group => group.id !== groupId);
    setGroups(updatedGroups);
    await saveGroups(updatedGroups);
  };

  // タグ一括リネーム
  const bulkRenameTag = (oldName: string, newName: string) => {
    const updatedItems = items.map(item => ({
      ...item,
      tags: item.tags.map(tag => tag === oldName ? newName : tag)
    }));
    const updatedGroups = groups.map(group => ({
      ...group,
      tags: group.tags.map(tag => tag === oldName ? newName : tag)
    }));
    setItems(updatedItems);
    setGroups(updatedGroups);
    saveAllData({ items: updatedItems, groups: updatedGroups, tags: [] });
  };

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

  const getItem = (id: string): PhotoItem | undefined => {
    return items.find(item => item.id === id);
  };

  const getGroup = (id: string): PostalItemGroup | undefined => {
    return groups.find(group => group.id === id);
  };

  return {
    items,
    groups,
    saveItem,
    saveGroup,
    updateItem,
    updateGroup,
    deleteItem,
    deleteGroup,
    bulkRenameTag,
    addItem,
    addGroup,
    getItem,
    getGroup
  };
};