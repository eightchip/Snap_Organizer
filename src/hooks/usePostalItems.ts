import { useState, useEffect, useCallback } from 'react';
import { PhotoItem, PostalItemGroup } from '../types';
import { loadAllData, saveAllData } from '../utils/storage';

export const usePostalItems = () => {
  const [items, setItems] = useState<PhotoItem[]>([]);
  const [groups, setGroups] = useState<PostalItemGroup[]>([]);

  // 初期データの読み込み
  const loadInitialData = useCallback(async () => {
    const data = await loadAllData();
    setItems(data.items || []);
    setGroups(data.groups || []);
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // アイテムの保存
  const saveItem = async (item: PhotoItem) => {
    const data = await loadAllData();
    const currentItems = data.items || [];
    const existingIndex = currentItems.findIndex(i => i.id === item.id);
    if (existingIndex >= 0) {
      currentItems[existingIndex] = item;
    } else {
      currentItems.push(item);
    }
    await saveAllData({ ...data, items: currentItems });
    setItems(currentItems);
  };

  // グループの保存
  const saveGroup = async (group: PostalItemGroup) => {
    const data = await loadAllData();
    const currentGroups = data.groups || [];
    const existingIndex = currentGroups.findIndex(g => g.id === group.id);
    if (existingIndex >= 0) {
      currentGroups[existingIndex] = group;
    } else {
      currentGroups.push(group);
    }
    await saveAllData({ ...data, groups: currentGroups });
    setGroups(currentGroups);
  };

  // アイテムの追加
  const addItem = async (item: PhotoItem) => {
    await saveItem(item);
  };

  // グループの追加
  const addGroup = async (group: PostalItemGroup) => {
    await saveGroup(group);
  };

  // アイテムの更新
  const updateItem = async (itemId: string, updates: Partial<PhotoItem>) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    await saveItem({ ...item, ...updates, updatedAt: new Date() });
  };

  // グループの更新
  const updateGroup = async (groupId: string, updates: Partial<PostalItemGroup>) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    await saveGroup({ ...group, ...updates, updatedAt: new Date() });
  };

  // アイテムの削除
  const deleteItem = async (itemId: string) => {
    const data = await loadAllData();
    const updatedItems = (data.items || []).filter(i => i.id !== itemId);
    await saveAllData({ ...data, items: updatedItems });
    setItems(updatedItems);
  };

  // グループの削除
  const deleteGroup = async (groupId: string) => {
    const data = await loadAllData();
    const updatedGroups = (data.groups || []).filter(g => g.id !== groupId);
    await saveAllData({ ...data, groups: updatedGroups });
    setGroups(updatedGroups);
  };

  // アイテムの取得
  const getItem = (id: string) => items.find(i => i.id === id);

  // グループの取得
  const getGroup = (id: string) => groups.find(g => g.id === id);

  return {
    items,
    groups,
    setItems,
    setGroups,
    saveItem,
    saveGroup,
    addItem,
    addGroup,
    updateItem,
    updateGroup,
    deleteItem,
    deleteGroup,
    getItem,
    getGroup
  };
};