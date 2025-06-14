import React, { useState } from 'react';
import { Screen, AppState } from './types';
import { usePostalItems } from './hooks/usePostalItems';
import { HomeScreen } from './components/screens/HomeScreen';
import { AddScreen } from './components/screens/AddScreen';
import { DetailScreen } from './components/screens/DetailScreen';

function App() {
  const { items, addItem, updateItem, deleteItem, getItem } = usePostalItems();
  const [appState, setAppState] = useState<AppState>({
    currentScreen: 'home',
    selectedItemId: null,
    searchQuery: '',
    selectedTags: []
  });

  const navigateTo = (screen: Screen, itemId?: string) => {
    setAppState(prev => ({
      ...prev,
      currentScreen: screen,
      selectedItemId: itemId || null
    }));
  };

  const handleSearchChange = (query: string) => {
    setAppState(prev => ({ ...prev, searchQuery: query }));
  };

  const handleTagToggle = (tag: string) => {
    setAppState(prev => ({
      ...prev,
      selectedTags: prev.selectedTags.includes(tag)
        ? prev.selectedTags.filter(t => t !== tag)
        : [...prev.selectedTags, tag]
    }));
  };

  const handleAddItem = (data: {
    image: string;
    ocrText: string;
    tags: string[];
    memo: string;
  }) => {
    addItem(data);
    navigateTo('home');
  };

  const handleUpdateItem = (itemId: string, updates: any) => {
    updateItem(itemId, updates);
  };

  const handleDeleteItem = (itemId: string) => {
    deleteItem(itemId);
    navigateTo('home');
  };

  const renderScreen = () => {
    switch (appState.currentScreen) {
      case 'home':
        return (
          <HomeScreen
            items={items}
            searchQuery={appState.searchQuery}
            selectedTags={appState.selectedTags}
            onSearchChange={handleSearchChange}
            onTagToggle={handleTagToggle}
            onAddItem={() => navigateTo('add')}
            onItemClick={(itemId) => navigateTo('detail', itemId)}
          />
        );

      case 'add':
        return (
          <AddScreen
            onSave={handleAddItem}
            onBack={() => navigateTo('home')}
          />
        );

      case 'detail':
        const selectedItem = appState.selectedItemId ? getItem(appState.selectedItemId) : null;
        if (!selectedItem) {
          navigateTo('home');
          return null;
        }
        return (
          <DetailScreen
            item={selectedItem}
            onBack={() => navigateTo('home')}
            onUpdate={(updates) => handleUpdateItem(selectedItem.id, updates)}
            onDelete={() => handleDeleteItem(selectedItem.id)}
          />
        );

      default:
        return null;
    }
  };

  return <div className="App">{renderScreen()}</div>;
}

export default App;