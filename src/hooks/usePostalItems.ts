import { useState, useEffect } from 'react';
import { PostalItem } from '../types';
import { saveItems, loadItems, generateId } from '../utils/storage';

export const usePostalItems = () => {
  const [items, setItems] = useState<PostalItem[]>([]);

  useEffect(() => {
    setItems(loadItems());
  }, []);

  const addItem = (itemData: Omit<PostalItem, 'id' | 'createdAt' | 'updatedAt'>) => {
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
  };

  const updateItem = (id: string, updates: Partial<PostalItem>) => {
    const updatedItems = items.map(item =>
      item.id === id
        ? { ...item, ...updates, updatedAt: new Date() }
        : item
    );
    setItems(updatedItems);
    saveItems(updatedItems);
  };

  const deleteItem = (id: string) => {
    const updatedItems = items.filter(item => item.id !== id);
    setItems(updatedItems);
    saveItems(updatedItems);
  };

  const getItem = (id: string): PostalItem | undefined => {
    return items.find(item => item.id === id);
  };

  return {
    items,
    addItem,
    updateItem,
    deleteItem,
    getItem,
    setItems,
  };
};