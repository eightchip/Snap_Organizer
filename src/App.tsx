import React, { useState, useEffect, useRef } from 'react';
import { Screen, AppState, PostalItemGroup } from './types';
import { usePostalItems } from './hooks/usePostalItems';
import { HomeScreen } from './components/screens/HomeScreen';
import { AddScreen } from './components/screens/AddScreen';
import { AddGroupScreen } from './components/screens/AddGroupScreen';
import { DetailScreen } from './components/screens/DetailScreen';
import { loadGroups, saveGroups, loadAllData, saveAllData } from './utils/storage';

function App() {
  const { items, addItem, updateItem, deleteItem, getItem, setItems } = usePostalItems();
  const [groups, setGroups] = useState<PostalItemGroup[]>([]);
  const [appState, setAppState] = useState<AppState>({
    currentScreen: 'home',
    selectedItemId: null,
    searchQuery: '',
    selectedTags: []
  });

  // グループデータの読み込み
  useEffect(() => {
    setGroups(loadGroups());
  }, []);

  // --- エクスポート・インポート機能 ---
  const fileInputRef = useRef<HTMLInputElement>(null);

  // タグ情報もlocalStorageから取得
  const getTags = () => {
    const saved = localStorage.getItem('postal_tags');
    return saved ? JSON.parse(saved) : [];
  };
  const setTags = (tags: any) => {
    localStorage.setItem('postal_tags', JSON.stringify(tags));
  };

  // エクスポート
  const handleExport = () => {
    const data = loadAllData();
    if (data.items.length === 0 && data.groups.length === 0) {
      alert('エクスポートできるデータがありません');
      return;
    }
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    
    // モバイルデバイスの場合の処理
    if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'snap_organizer_backup.json';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'snap_organizer_backup.json';
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // インポート
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        saveAllData(json);
        setItems(json.items || []);
        setGroups(json.groups || []);
        if (json.tags) setTags(json.tags);
        alert('データをインポートしました');
      } catch (err) {
        alert('インポートに失敗しました: ' + err);
      }
    };
    reader.readAsText(file);
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

  const handleAddItem = (mode: 'single' | 'group') => {
    navigateTo(mode === 'single' ? 'add' : 'add-group');
  };

  const handleAddSingleItem = (data: {
    image: string;
    ocrText: string;
    tags: string[];
    memo: string;
  }) => {
    addItem(data);
    navigateTo('home');
  };

  const handleAddGroup = (group: PostalItemGroup) => {
    const updatedGroups = [group, ...groups];
    setGroups(updatedGroups);
    saveGroups(updatedGroups);
    navigateTo('home');
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

  const renderScreen = () => {
    switch (appState.currentScreen) {
      case 'home':
        return (
          <>
            <div style={{textAlign: 'center', margin: '16px 0'}}>
              <button onClick={handleExport} className="px-3 py-1 bg-green-500 text-white rounded mr-2">エクスポート</button>
              <button onClick={() => fileInputRef.current?.click()} className="px-3 py-1 bg-blue-500 text-white rounded">インポート</button>
              <input type="file" accept="application/json" ref={fileInputRef} onChange={handleImport} style={{ display: 'none' }} />
            </div>
            <HomeScreen
              items={items}
              searchQuery={appState.searchQuery}
              selectedTags={appState.selectedTags}
              onSearchChange={handleSearchChange}
              onTagToggle={handleTagToggle}
              onAddItem={handleAddItem}
              onItemClick={(itemId) => navigateTo('detail', itemId)}
              onBulkTagRename={handleBulkTagRename}
            />
          </>
        );

      case 'add':
        return (
          <AddScreen
            onSave={handleAddSingleItem}
            onBack={() => navigateTo('home')}
          />
        );

      case 'add-group':
        return (
          <AddGroupScreen
            onSave={handleAddGroup}
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