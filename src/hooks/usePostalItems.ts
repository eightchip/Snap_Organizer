import { useState, useEffect } from 'react';
import { PostalItem, PostalItemGroup } from '../types';
import { saveItems, loadItems, generateId, saveGroups, loadGroups } from '../utils/storage';

export const usePostalItems = () => {
  const [items, setItems] = useState<PostalItem[]>([]);
  const [groups, setGroups] = useState<PostalItemGroup[]>([]);

  // 初期データの読み込み
  useEffect(() => {
    try {
      setItems(loadItems());
      setGroups(loadGroups());
    } catch (error) {
      console.error('Failed to load items:', error);
    }
  }, []);

  const addItem = (itemData: Omit<PostalItem, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const newItem: PostalItem = {
        ...itemData,
        id: generateId(),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const updatedItems = [newItem, ...items];
      setItems(updatedItems);
      saveItems(updatedItems);
      return newItem;
    } catch (error) {
      console.error('Failed to add item:', error);
      throw new Error('アイテムの追加に失敗しました');
    }
  };

  const addGroup = (groupData: PostalItemGroup) => {
    try {
      const updatedGroups = [groupData, ...groups];
      setGroups(updatedGroups);
      saveGroups(updatedGroups);
    } catch (error) {
      console.error('Failed to add group:', error);
      throw new Error('グループの追加に失敗しました');
    }
  };

  const updateItem = (id: string, updates: Partial<PostalItem>) => {
    try {
      const updatedItems = items.map(item =>
        item.id === id
          ? { ...item, ...updates, updatedAt: new Date() }
          : item
      );
      setItems(updatedItems);
      saveItems(updatedItems);
    } catch (error) {
      console.error('Failed to update item:', error);
      throw new Error('アイテムの更新に失敗しました');
    }
  };

  const deleteItem = (id: string) => {
    try {
      const updatedItems = items.filter(item => item.id !== id);
      setItems(updatedItems);
      saveItems(updatedItems);
    } catch (error) {
      console.error('Failed to delete item:', error);
      throw new Error('アイテムの削除に失敗しました');
    }
  };

  const getItem = (id: string): PostalItem | undefined => {
    return items.find(item => item.id === id);
  };

  const clearStorage = () => {
    try {
      setItems([]);
      setGroups([]);
      saveItems([]);
      saveGroups([]);
    } catch (error) {
      console.error('Failed to clear storage:', error);
      throw new Error('ストレージのクリアに失敗しました');
    }
  };

  return {
    items,
    groups,
    addItem,
    addGroup,
    updateItem,
    deleteItem,
    getItem,
    setItems,
    setGroups,
    clearStorage,
  };
};