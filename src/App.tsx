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
      }
      if (data.groups) {
        fixedGroups = await fixDatesAndImages(data.groups);
      }
      if (data.tags) {
        fixedTags = data.tags;
      }

      // データをまとめて更新
      setItems(fixedItems);
      setGroups(fixedGroups);
      setTags(fixedTags);

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
      let nextItems = items;
      let nextGroups = groups;

      if ('photos' in data) {
        nextGroups = [...groups, data];
      } else {
        nextItems = [...items, data];
      }
      
      const nextStorageData = { items: nextItems, groups: nextGroups, tags };
      await saveAllData(nextStorageData);

      setItems(nextItems);
      setGroups(nextGroups);
      navigateTo({ type: 'home' });
    } catch (error: any) {
      setError(error.message || '保存に失敗しました');
      console.error('Save error:', error);
    }
  };

  const handleUpdateItem = async (itemId: string, updates: Partial<PhotoItem>) => {
    setError(null);
    let itemFound = false;

    const updateInItems = (currentItems: PhotoItem[]): PhotoItem[] => {
      return currentItems.map(item => {
        if (item.id === itemId) {
          itemFound = true;
          return { ...item, ...updates, updatedAt: new Date() };
        }
        return item;
      });
    };

    let nextItems = updateInItems(items);
    let nextGroups = groups;

    if (!itemFound) {
      nextGroups = groups.map(group => {
        const originalPhotos = group.photos;
        const updatedPhotos = updateInItems(originalPhotos);
        if (originalPhotos !== updatedPhotos) { // Check if photos array was actually updated
             return { ...group, photos: updatedPhotos, updatedAt: new Date() };
        }
        return group;
      });
    }

    const nextStorageData = { items: nextItems, groups: nextGroups, tags };
    await saveAllData(nextStorageData);
    setItems(nextItems);
    setGroups(nextGroups);
  };

  const handleItemClick = (itemId: string) => {
    navigateTo({ type: 'detail', itemId });
  };

  const handleGroupClick = (groupId: string) => {
    navigateTo({ type: 'detail-group', groupId });
  };

  const handleBulkTagRename = async (oldName: string, newName: string, currentTags?: Tag[]) => {
    setError(null);
    try {
      const tagsToSave = currentTags || tags;

      const nextItems = items.map(item => ({
        ...item,
        tags: (item.tags || []).map(t => (t === oldName ? newName : t)).filter(Boolean)
      }));
      const nextGroups = groups.map(group => ({
        ...group,
        tags: (group.tags || []).map(t => (t === oldName ? newName : t)).filter(Boolean)
      }));
      
      const nextStorageData = { items: nextItems, groups: nextGroups, tags: tagsToSave };
      await saveAllData(nextStorageData);
      
      setItems(nextItems);
      setGroups(nextGroups);
      if (currentTags) {
        setTags(currentTags);
      }

    } catch (error: any) {
      setError(error.message || 'タグの一括変更に失敗しました');
      console.error('Bulk tag rename error:', error);
    }
  };

  const handleBulkDelete = async (itemIds: string[], groupIds: string[]) => {
    setError(null);
    try {
      const nextItems = items.filter(item => !itemIds.includes(item.id));
      const nextGroups = groups.filter(group => !groupIds.includes(group.id));
      
      const nextStorageData = { items: nextItems, groups: nextGroups, tags };
      await saveAllData(nextStorageData);

      setItems(nextItems);
      setGroups(nextGroups);

    } catch (error: any) {
      setError(error.message || '一括削除に失敗しました');
      console.error('Bulk delete error:', error);
    }
  };

  const handleAddTag = async () => {
    if (!newTagName.trim()) return;
    const nextTags = [...tags, { name: newTagName.trim(), color: newTagColor }];
    
    await saveAllData({ items, groups, tags: nextTags });
    
    setTags(nextTags);
    setNewTagName('');
    setNewTagColor('#3B82F6');
    setShowAddTag(false);
  };

  const startEditTag = (idx: number) => {
    setTagEditIdx(idx);
    setTagEditName(tags[idx].name);
    setTagEditColor(tags[idx].color);
  };

  const handleEditTag = async (idx: number|null, name: string, color: string) => {
    if (idx === null || !name.trim()) return;

    const oldTag = tags[idx];
    const trimmedName = name.trim();
    
    const nextTags = [...tags];
    nextTags[idx] = { name: trimmedName, color };

    if (oldTag.name !== trimmedName) {
      await handleBulkTagRename(oldTag.name, trimmedName, nextTags);
    } else {
      const nextStorageData = { items, groups, tags: nextTags };
      await saveAllData(nextStorageData);
      setTags(nextTags);
    }
    
    handleCancelEdit();
  };

  const handleCancelEdit = () => {
    setTagEditIdx(null);
    setTagEditName('');
    setTagEditColor('#3B82F6');
  };

  const handleRemoveTag = async (idx: number) => {
    const tagToRemove = tags[idx];
    if (window.confirm(`タグ「${tagToRemove.name}」を削除しますか？このタグはすべてのアイテムから削除されます。`)) {
      const nextTags = tags.filter((_, i) => i !== idx);
      // Call bulk rename with an empty new name to effectively remove the tag from items/groups
      await handleBulkTagRename(tagToRemove.name, '', nextTags);
    }
  };

  const handleTagDeleteFromItem = async (tagName: string) => {
    if (window.confirm(`このアイテムからタグ「${tagName}」を削除しますか？`)) {
        await handleBulkTagRename(tagName, '');
    }
  }

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
            onBack={() => navigateTo({ type: 'home' })}
            onUpdate={(updates) => handleUpdateItem(item.id, updates)}
            onDelete={() => {
              deleteItem(item.id).then(() => {
                setTimeout(() => {
                  saveAllData({ items, groups, tags });
                }, 0);
              });
              navigateTo({ type: 'home' });
            }}
            availableTags={tags}
            onAddTagToItem={handleAddTag}
            onDeleteTagFromItem={handleTagDeleteFromItem}
          />
        );

      case 'detail-group':
        const group = getGroup(appState.screen.groupId);
        if (!group) return null;
        return (
          <DetailGroupScreen
            group={group}
            onBack={() => navigateTo({ type: 'home' })}
            onUpdateGroup={(updates) => updateGroup(group.id, updates).then(() => {
              setTimeout(() => {
                saveAllData({ items, groups, tags });
              }, 0);
            })}
            onDelete={() => {
              deleteGroup(group.id).then(() => {
                setTimeout(() => {
                  saveAllData({ items, groups, tags });
                }, 0);
              });
              navigateTo({ type: 'home' });
            }}
            availableTags={tags}
            onAddTagToGroup={handleAddTag}
            onDeleteTagFromGroup={handleTagDeleteFromItem}
            onUpdateItemInGroup={handleUpdateItem}
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