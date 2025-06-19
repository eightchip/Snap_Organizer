import { useState, useEffect } from 'react';
import { PhotoItem, PostalItemGroup } from '../types';
import { loadAllData, saveAllData } from '../utils/storage';

export const usePostalItems = () => {
  const [items, setItems] = useState<PhotoItem[]>([]);
  const [groups, setGroups] = useState<PostalItemGroup[]>([]);

  // 初期データの読み込み
  useEffect(() => {
    const data = loadAllData();
    setItems(data.items);
    setGroups(data.groups);
  }, []);

  // アイテムの保存
  const saveItem = async (item: PhotoItem) => {
    const data = loadAllData();
    const existingIndex = data.items.findIndex(i => i.id === item.id);
    if (existingIndex >= 0) {
      data.items[existingIndex] = item;
    } else {
      data.items.push(item);
    }
    await saveAllData(data);
    setItems(data.items);
  };

  // グループの保存
  const saveGroup = async (group: PostalItemGroup) => {
    const data = loadAllData();
    const existingIndex = data.groups.findIndex(g => g.id === group.id);
    if (existingIndex >= 0) {
      data.groups[existingIndex] = group;
    } else {
      data.groups.push(group);
    }
    await saveAllData(data);
    setGroups(data.groups);
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
    const data = loadAllData();
    data.items = data.items.filter(i => i.id !== itemId);
    await saveAllData(data);
    setItems(data.items);
  };

  // グループの削除
  const deleteGroup = async (groupId: string) => {
    const data = loadAllData();
    data.groups = data.groups.filter(g => g.id !== groupId);
    await saveAllData(data);
    setGroups(data.groups);
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