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
    getItem,
    getGroup,
    updateGroup
  } = usePostalItems();

  // 検索とタグフィルター用の状態
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const [appState, setAppState] = useState<AppState>({
    screen: { type: 'home' }
  });

  const [error, setError] = useState<string | null>(null);

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
      if (!data.items && !data.groups && !data.tags) {
        throw new Error('インポートするデータが見つかりません');
      }

      // 日付の修正
      const fixItems = (items: any[]) => items.map(item => ({
        ...item,
        createdAt: new Date(item.createdAt),
        updatedAt: new Date(item.updatedAt)
      }));

      if (data.items) {
        const fixedItems = fixItems(data.items);
        for (const item of fixedItems) {
          await addItem(item);
        }
      }
      if (data.groups) {
        const fixedGroups = fixItems(data.groups);
        for (const group of fixedGroups) {
          await addGroup(group);
        }
      }
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

  const navigateTo = (screen: Screen) => {
    setAppState({ screen });
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
  };

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const handleAddItem = () => {
    navigateTo({ type: 'add', mode: 'unified' });
  };

  const handleUnifiedAdd = async (data: PhotoItem | PostalItemGroup) => {
    setError(null);
    try {
      if ('photos' in data) {
        // Group mode
        await addGroup(data);
      } else {
        // Single photo mode
        await addItem(data);
      }
      navigateTo({ type: 'home' });
    } catch (error: any) {
      setError(error.message || '保存に失敗しました');
      console.error('Save error:', error);
    }
  };

  const handleUpdateItem = (itemId: string, updates: Partial<PhotoItem>) => {
    updateItem(itemId, updates);
  };

  const handleItemClick = (itemId: string) => {
    navigateTo({ type: 'detail', itemId });
  };

  const handleGroupClick = (groupId: string) => {
    navigateTo({ type: 'detail-group', groupId });
  };

  const handleBulkTagRename = (oldName: string, newName: string) => {
    // アイテムのタグ更新
    items.forEach(item => {
      if (item.tags.includes(oldName)) {
        const updatedTags = item.tags.map(tag => tag === oldName ? newName : tag);
        updateItem(item.id, { tags: updatedTags });
      }
    });

    // グループのタグ更新
    groups.forEach(group => {
      if (group.tags.includes(oldName)) {
        const updatedTags = group.tags.map(tag => tag === oldName ? newName : tag);
        updateGroup(group.id, { tags: updatedTags });
      }
    });
  };

  const renderScreen = () => {
    switch (appState.screen.type) {
      case 'home':
        return (
          <HomeScreen
            items={items}
            groups={groups}
            searchQuery={searchQuery}
            selectedTags={selectedTags}
            onSearchChange={handleSearchChange}
            onTagToggle={handleTagToggle}
            onAddItem={handleAddItem}
            onItemClick={handleItemClick}
            onGroupClick={handleGroupClick}
            onBulkTagRename={handleBulkTagRename}
            onImport={handleImport}
            onExport={handleExport}
          />
        );

      case 'add':
        return (
          <UnifiedAddScreen
            onSave={handleUnifiedAdd}
            onBack={() => navigateTo({ type: 'home' })}
          />
        );

      case 'detail':
        const item = getItem(appState.screen.itemId);
        if (!item) return null;
        return (
          <DetailScreen
            item={item}
            onBack={() => navigateTo({ type: 'home' })}
            onUpdate={(updates) => handleUpdateItem(item.id, updates)}
          />
        );

      case 'detail-group':
        const group = getGroup(appState.screen.groupId);
        if (!group) return null;
        return (
          <DetailGroupScreen
            group={group}
            onBack={() => navigateTo({ type: 'home' })}
            onUpdate={(updates) => updateGroup(group.id, updates)}
            onDelete={() => {
              updateGroup(group.id, { deleted: true });
              navigateTo({ type: 'home' });
            }}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {error && (
        <div className="mx-auto max-w-md bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>{error}</p>
        </div>
      )}
      {renderScreen()}
    </div>
  );
}

export default App;