import React, { useState, useEffect, useRef } from 'react';
import { Screen, AppState } from './types';
import { usePostalItems } from './hooks/usePostalItems';
import { HomeScreen } from './components/screens/HomeScreen';
import { AddScreen } from './components/screens/AddScreen';
import { DetailScreen } from './components/screens/DetailScreen';

function App() {
  const { items, addItem, updateItem, deleteItem, getItem, setItems } = usePostalItems();
  const [appState, setAppState] = useState<AppState>({
    currentScreen: 'home',
    selectedItemId: null,
    searchQuery: '',
    selectedTags: []
  });

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
    if (items.length === 0) {
      alert('エクスポートできるデータがありません');
      return;
    }
    const data = {
      items,
      tags: getTags(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    
    // モバイルデバイスの場合の処理
    if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
      // モバイルデバイスではダウンロードリンクを表示
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'snap_organizer_backup.json';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      // 少し待ってから要素を削除
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    } else {
      // PCでは通常のダウンロード
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
        if (json.items && Array.isArray(json.items)) {
          // 日付をDate型に変換
          const fixedItems = json.items.map((item: any) => ({
            ...item,
            createdAt: new Date(item.createdAt),
            updatedAt: new Date(item.updatedAt),
          }));
          setItems(fixedItems);
          // localStorageにも保存
          localStorage.setItem('postal-snap-items', JSON.stringify(fixedItems));
        }
        if (json.tags && Array.isArray(json.tags)) {
          // 現在のタグを取得
          const currentTags = getTags();
          const importedTags = json.tags;

          // タグの重複チェック
          const duplicateTags = importedTags.filter((importedTag: any) =>
            currentTags.some((currentTag: any) => currentTag.name === importedTag.name)
          );

          if (duplicateTags.length > 0) {
            // 重複がある場合は確認ダイアログを表示
            const confirmMessage = `以下のタグが重複しています。\n${duplicateTags.map((t: any) => t.name).join(', ')}\n\nインポートしたタグで上書きしますか？`;
            if (window.confirm(confirmMessage)) {
              // 重複を除去して新しいタグを追加
              const uniqueTags = importedTags.filter((importedTag: any) =>
                !currentTags.some((currentTag: any) => currentTag.name === importedTag.name)
              );
              setTags([...currentTags, ...uniqueTags]);
            } else {
              // 現在のタグを維持
              alert('現在のタグ設定を維持します。');
            }
          } else {
            // 重複がない場合は単純に追加
            setTags([...currentTags, ...importedTags]);
          }
        }
        alert('データをインポートしました。画面をリロードしてください。');
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

  const handleBulkTagRename = (oldName: string, newName: string) => {
    const updatedItems = items.map(item => ({
      ...item,
      tags: item.tags.map(tag => tag === oldName ? newName : tag)
    }));
    setItems(updatedItems);
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
            onAddItem={() => navigateTo('add')}
            onItemClick={(itemId) => navigateTo('detail', itemId)}
              onBulkTagRename={handleBulkTagRename}
          />
          </>
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