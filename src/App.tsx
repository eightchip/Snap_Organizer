import { useState, useEffect } from 'react';
import { Screen, AppState, PostalItemGroup, PhotoItem, Tag } from './types';
import { usePostalItems } from './hooks/usePostalItems';
import { HomeScreen } from './components/screens/HomeScreen';
import { UnifiedAddScreen } from './components/screens/UnifiedAddScreen';
import { DetailScreen } from './components/screens/DetailScreen';
import { DetailGroupScreen } from './components/screens/DetailGroupScreen';
import { SyncScreen } from './components/SyncScreen';
import { loadAllData, saveAllData } from './utils/storage';
import { deleteImageBlob, loadImageBlob, saveImageBlob } from './utils/imageDB';

// Base64ヘルパー関数
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const base64ToBlob = (base64: string): Blob => {
  const parts = base64.split(';base64,');
  const contentType = parts[0].split(':')[1];
  const raw = window.atob(parts[1]);
  const rawLength = raw.length;
  const uInt8Array = new Uint8Array(rawLength);
  for (let i = 0; i < rawLength; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }
  return new Blob([uInt8Array], { type: contentType });
};

function App() {
  const {
    items,
    groups,
    addItem,
    addGroup,
    updateItem,
    getItem,
    getGroup,
    updateGroup,
    deleteItem,
    deleteGroup,
    setItems,
    setGroups
  } = usePostalItems();

  // 検索とタグフィルター用の状態
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tags, setTags] = useState<Tag[]>([]); // タグもグローバルstateで管理

  const [appState, setAppState] = useState<AppState>({
    screen: { type: 'home' }
  });

  const [error, setError] = useState<string | null>(null);

  // App関数内でタグ編集UIのstate/操作を定義
  const [showAddTag, setShowAddTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3B82F6');
  const [tagEditIdx, setTagEditIdx] = useState<number|null>(null);
  const [tagEditName, setTagEditName] = useState('');
  const [tagEditColor, setTagEditColor] = useState('#3B82F6');

  // 起動時にIndexedDBから全データをstateに反映
  useEffect(() => {
    loadAllData().then(data => {
      setItems(data.items || []);
      setGroups(data.groups || []);
      setTags(data.tags || []);
    });
  }, []);

  // インポート
  const handleImport = async (jsonData: any) => {
    setError(null);
    try {
      const data = jsonData.data ? jsonData.data : jsonData;
      if (!data.items && !data.groups && !data.tags) {
        throw new Error('インポートするデータが見つかりません');
      }

      const fixDatesAndImages = async (items: any[]) => {
        for (const item of items) {
          item.createdAt = new Date(item.createdAt);
          item.updatedAt = new Date(item.updatedAt);
          if (item.imageData && item.image) {
            const blob = base64ToBlob(item.imageData);
            await saveImageBlob(item.image, blob);
          }
          if (item.photos) { // For groups
            await fixDatesAndImages(item.photos);
          }
        }
        return items.map((item: any) => {
          const { imageData, ...rest } = item;
          return rest;
        });
      };

      let fixedItems: any[] = [];
      let fixedGroups: any[] = [];
      let fixedTags: Tag[] = [];
      if (data.items) {
        fixedItems = await fixDatesAndImages(data.items);
        setItems(fixedItems);
      }
      if (data.groups) {
        fixedGroups = await fixDatesAndImages(data.groups);
        setGroups(fixedGroups);
      }
      if (data.tags) {
        fixedTags = data.tags;
        setTags(fixedTags);
      } else {
        fixedTags = [];
      }

      await saveAllData({
        items: fixedItems,
        groups: fixedGroups,
        tags: fixedTags
      });

      alert('データをインポートしました');
    } catch (error: any) {
      setError(error.message || 'インポートに失敗しました');
      console.error('Import error:', error);
    }
  };

  // エクスポート
  const handleExport = async () => {
    const data = { items, groups, tags };
    
    const itemsWithImageData = await Promise.all(
      (data.items || []).map(async item => {
        if (!item.image) return item;
        const blob = await loadImageBlob(item.image);
        const imageData = blob ? await blobToBase64(blob) : null;
        return { ...item, imageData };
      })
    );

    const groupsWithImageData = await Promise.all(
      (data.groups || []).map(async group => {
        const photosWithImageData = await Promise.all(
          (group.photos || []).map(async photo => {
            if (!photo.image) return photo;
            const blob = await loadImageBlob(photo.image);
            const imageData = blob ? await blobToBase64(blob) : null;
            return { ...photo, imageData };
          })
        );
        return { ...group, photos: photosWithImageData };
      })
    );

    return {
      version: '1.1', // New version with image data
      items: itemsWithImageData,
      groups: groupsWithImageData,
      tags: data.tags
    };
  };

  const handleDownloadExport = async () => {
    const data = await handleExport();
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
    if (tag === 'ALL_CLEAR') {
      setSelectedTags([]);
      return;
    }
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

  const handleBulkTagRename = async (oldName: string, newName: string) => {
    setError(null);
    try {
      const currentData = await loadAllData();
      const updatedItems = (currentData.items || []).map(item => ({
        ...item,
        tags: (item.tags || []).map(t => t === oldName ? newName : t)
      }));
      const updatedGroups = (currentData.groups || []).map(group => ({
        ...group,
        tags: (group.tags || []).map(t => t === oldName ? newName : t)
      }));
      
      const updatedData = { ...currentData, items: updatedItems, groups: updatedGroups };
      await saveAllData(updatedData);

      // Update local state
      setItems(updatedItems);
      setGroups(updatedGroups);
    } catch (error: any) {
      setError(error.message || 'タグの一括変更に失敗しました');
      console.error('Tag rename error:', error);
    }
  };

  const handleBulkDelete = async (itemIds: string[], groupIds: string[]) => {
    setError(null);
    try {
      // 削除対象の画像IDを収集
      const imageIdsToDelete = new Set<string>();
      
      // 単一アイテムの画像
      (items || [])
        .filter(item => itemIds.includes(item.id))
        .forEach(item => {
          if (item.image) imageIdsToDelete.add(item.image);
        });
      
      // グループ内の画像
      (groups || [])
        .filter(group => groupIds.includes(group.id))
        .forEach(group => {
          (group.photos || []).forEach(photo => {
            if (photo.image) imageIdsToDelete.add(photo.image);
          });
        });

      // データの削除
      const data = await loadAllData();
      const updatedItems = (data.items || []).filter(item => !itemIds.includes(item.id));
      const updatedGroups = (data.groups || []).filter(group => !groupIds.includes(group.id));
      
      // データを保存
      await saveAllData({ ...data, items: updatedItems, groups: updatedGroups });
      
      // 画像の削除
      for (const imageId of imageIdsToDelete) {
        try {
          await deleteImageBlob(imageId);
        } catch (error) {
          console.error('Failed to delete image:', imageId, error);
        }
      }

      // 状態を更新
      setItems(updatedItems);
      setGroups(updatedGroups);
    } catch (error: any) {
      setError(error.message || '削除に失敗しました');
      console.error('Delete error:', error);
    }
  };

  const handleAddTag = () => {
    if (!newTagName.trim()) return;
    const newTag = { name: newTagName.trim(), color: newTagColor };
    const updated = [...tags, newTag];
    setTags(updated);
    setNewTagName('');
    setNewTagColor('#3B82F6');
    setShowAddTag(false);
    saveAllData({ items, groups, tags: updated });
  };

  const startEditTag = (idx: number) => {
    setTagEditIdx(idx);
    setTagEditName(tags[idx].name);
    setTagEditColor(tags[idx].color);
  };

  const handleEditTag = (idx: number|null, name: string, color: string) => {
    if (idx === null || !name.trim()) return;
    const updated = tags.map((t, i) => i === idx ? { name: name.trim(), color } : t);
    setTags(updated);
    setTagEditIdx(null);
    setTagEditName('');
    setTagEditColor('#3B82F6');
    saveAllData({ items, groups, tags: updated });
  };

  const handleCancelEdit = () => {
    setTagEditIdx(null);
    setTagEditName('');
    setTagEditColor('#3B82F6');
  };

  const handleRemoveTag = (idx: number) => {
    if (!window.confirm('このタグを削除しますか？')) return;
    const delName = tags[idx].name;
    const updated = tags.filter((_, i) => i !== idx);
    setTags(updated);
    setTagEditIdx(null);
    setTagEditName('');
    setTagEditColor('#3B82F6');
    saveAllData({ items, groups, tags: updated });
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
            onExport={handleDownloadExport}
            getExportData={handleExport}
            onBulkDelete={handleBulkDelete}
            availableTags={tags}
            showAddTag={showAddTag}
            setShowAddTag={setShowAddTag}
            newTagName={newTagName}
            setNewTagName={setNewTagName}
            newTagColor={newTagColor}
            setNewTagColor={setNewTagColor}
            tagEditIdx={tagEditIdx}
            tagEditName={tagEditName}
            setTagEditName={setTagEditName}
            tagEditColor={tagEditColor}
            setTagEditColor={setTagEditColor}
            handleAddTag={handleAddTag}
            startEditTag={startEditTag}
            handleEditTag={handleEditTag}
            handleCancelEdit={handleCancelEdit}
            handleRemoveTag={handleRemoveTag}
          />
        );

      case 'add':
        return (
          <UnifiedAddScreen
            onSave={handleUnifiedAdd}
            onBack={() => navigateTo({ type: 'home' })}
            availableTags={tags}
            showAddTag={showAddTag}
            setShowAddTag={setShowAddTag}
            newTagName={newTagName}
            setNewTagName={setNewTagName}
            newTagColor={newTagColor}
            setNewTagColor={setNewTagColor}
            handleAddTag={handleAddTag}
          />
        );

      case 'detail':
        const item = getItem(appState.screen.itemId);
        if (!item) return null;
        return (
          <DetailScreen
            item={item}
            availableTags={tags}
            onBack={() => navigateTo({ type: 'home' })}
            onUpdate={(updates) => handleUpdateItem(item.id, updates)}
            onDelete={async () => {
              await deleteItem(item.id);
              navigateTo({ type: 'home' });
            }}
          />
        );

      case 'detail-group':
        const group = getGroup(appState.screen.groupId);
        if (!group) return null;
        return (
          <DetailGroupScreen
            group={group}
            availableTags={tags}
            onBack={() => navigateTo({ type: 'home' })}
            onUpdate={(updates) => updateGroup(group.id, updates)}
            onDelete={async () => {
              await deleteGroup(group.id);
              navigateTo({ type: 'home' });
            }}
            showAddTag={showAddTag}
            setShowAddTag={setShowAddTag}
            newTagName={newTagName}
            setNewTagName={setNewTagName}
            newTagColor={newTagColor}
            setNewTagColor={setNewTagColor}
            tagEditIdx={tagEditIdx}
            tagEditName={tagEditName}
            setTagEditName={setTagEditName}
            tagEditColor={tagEditColor}
            setTagEditColor={setTagEditColor}
            handleAddTag={handleAddTag}
            startEditTag={startEditTag}
            handleEditTag={handleEditTag}
            handleCancelEdit={handleCancelEdit}
            handleRemoveTag={handleRemoveTag}
          />
        );

      case 'sync':
        return (
          <SyncScreen
            items={items}
            groups={groups}
            tags={tags}
            onBack={() => navigateTo({ type: 'home' })}
            onImport={handleImport}
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