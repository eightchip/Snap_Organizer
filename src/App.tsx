import React, { useState, useEffect } from 'react';
import { Screen, AppState, PostalItemGroup, PhotoItem } from './types';
import { usePostalItems } from './hooks/usePostalItems';
import { HomeScreen } from './components/screens/HomeScreen';
import { UnifiedAddScreen } from './components/screens/UnifiedAddScreen';
import { DetailScreen } from './components/screens/DetailScreen';
import { DetailGroupScreen } from './components/screens/DetailGroupScreen';
import { loadGroups, saveGroups } from './utils/storage';

function App() {
  const {
    items,
    groups,
    addItem,
    addGroup,
    updateItem,
    deleteItem,
    getItem,
    setItems,
    setGroups,
    clearStorage
  } = usePostalItems();

  const [appState, setAppState] = useState<AppState>({
    currentScreen: 'home',
    selectedItemId: null,
    searchQuery: '',
    selectedTags: []
  });

  const [error, setError] = useState<string | null>(null);

  // グループデータの読み込み
  useEffect(() => {
    setGroups(loadGroups());
  }, []);

  // タグ情報もlocalStorageから取得
  const getTags = () => {
    const saved = localStorage.getItem('postal_tags');
    return saved ? JSON.parse(saved) : [];
  };
  const setTags = (tags: any) => {
    localStorage.setItem('postal_tags', JSON.stringify(tags));
  };

  // インポート
  const handleImport = async (data: any) => {
    setError(null);
    try {
      // データの検証
      if (!data.items && !data.groups && !data.tags) {
        throw new Error('インポートするデータが見つかりません');
      }

      // 一旦ストレージをクリア
      await clearStorage();

      // 日付の修正
      const fixItems = (items: any[]) => items.map(item => ({
        ...item,
        createdAt: new Date(item.createdAt),
        updatedAt: new Date(item.updatedAt)
      }));

      if (data.items) setItems(fixItems(data.items));
      if (data.groups) setGroups(fixItems(data.groups));
      if (data.tags) setTags(data.tags);

      alert('データをインポートしました');
    } catch (error: any) {
      setError(error.message || 'インポートに失敗しました');
      console.error('Import error:', error);
    }
  };

  // エクスポート
  const handleExport = () => {
    const data = {
      items,
      groups,
      tags: getTags(),
      version: '1.0'
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `postal_snap_export_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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

  const handleAddItem = (mode: 'unified') => {
    navigateTo('unified-add');
  };

  const handleUnifiedAdd = async (data: PhotoItem | PostalItemGroup) => {
    setError(null);
    try {
      if ('photos' in data) {
        // Group mode
        await addGroup(data);
      } else {
        // Single photo mode
        await addItem({
          image: data.image,
          ocrText: data.ocrText || '',
          tags: data.tags || [],
          memo: data.memo || ''
        });
      }
      navigateTo('home');
    } catch (error: any) {
      setError(error.message || '保存に失敗しました');
      console.error('Save error:', error);
    }
  };

  const handleUpdateItem = (itemId: string, updates: any) => {
    updateItem(itemId, updates);
  };

  const handleDeleteItem = (itemId: string) => {
    deleteItem(itemId);
    navigateTo('home');
  };

  const handleBulkTagRename = (oldName: string, newName: string) => {
    // アイテムのタグ更新
    const updatedItems = items.map(item => ({
      ...item,
      tags: item.tags.map(tag => tag === oldName ? newName : tag)
    }));
    setItems(updatedItems);

    // グループのタグ更新
    const updatedGroups = groups.map(group => ({
      ...group,
      tags: group.tags.map(tag => tag === oldName ? newName : tag)
    }));
    setGroups(updatedGroups);
    saveGroups(updatedGroups);
  };

  const handleUpdateGroup = (groupId: string, updates: Partial<PostalItemGroup>) => {
    const updatedGroups = groups.map(group =>
      group.id === groupId
        ? { ...group, ...updates }
        : group
    );
    setGroups(updatedGroups);
    saveGroups(updatedGroups);
  };

  const handleDeleteGroup = (groupId: string) => {
    const updatedGroups = groups.filter(group => group.id !== groupId);
    setGroups(updatedGroups);
    saveGroups(updatedGroups);
    navigateTo('home');
  };

  const renderScreen = () => {
    switch (appState.currentScreen) {
      case 'home':
        return (
          <>
            {error && (
              <div className="mx-auto max-w-md bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                <p>{error}</p>
              </div>
            )}
            <HomeScreen
              items={items}
              groups={groups}
              searchQuery={appState.searchQuery}
              selectedTags={appState.selectedTags}
              onSearchChange={handleSearchChange}
              onTagToggle={handleTagToggle}
              onAddItem={handleAddItem}
              onItemClick={(itemId) => navigateTo('detail', itemId)}
              onGroupClick={(groupId) => navigateTo('detail-group', groupId)}
              onBulkTagRename={handleBulkTagRename}
              onImport={handleImport}
              onExport={handleExport}
            />
          </>
        );

      case 'unified-add':
        return (
          <UnifiedAddScreen
            onSave={handleUnifiedAdd}
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

      case 'detail-group':
        const selectedGroup = appState.selectedItemId
          ? groups.find(g => g.id === appState.selectedItemId)
          : null;
        if (!selectedGroup) {
          navigateTo('home');
          return null;
        }
        return (
          <DetailGroupScreen
            group={selectedGroup}
            onBack={() => navigateTo('home')}
            onUpdate={(updates) => handleUpdateGroup(selectedGroup.id, updates)}
            onDelete={() => handleDeleteGroup(selectedGroup.id)}
          />
        );

      default:
        return null;
    }
  };

  return <div className="App">{renderScreen()}</div>;
}

export default App;