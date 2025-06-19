import React, { useRef, useState, useEffect, useMemo } from 'react';
import { PhotoItem, PostalItemGroup } from '../../types';
import { SearchBar } from '../SearchBar';
import { TagChip } from '../TagChip';
import { ItemCard } from '../ItemCard';
import { Plus, Package, Edit2, X, Download, Upload, Filter, FileText, Clipboard, Share2, Pencil, Trash2, CheckSquare, Map, Image, RefreshCw } from 'lucide-react';
import { usePostalItems } from '../../hooks/usePostalItems';
import { usePostalTags } from '../../hooks/usePostalTags';
import { MAX_TAGS } from '../../constants/tags';
import QRcode from 'qrcode.react';
import { normalizeOcrText } from '../../utils/normalizeOcrText';
import { loadImageBlob } from '../../utils/imageDB';
import { LocationMap } from '../LocationMap';
import { saveAppIcon, getAppIcon, removeAppIcon } from '../../utils/storage';
import { resizeImage } from '../../utils/imageResize';
import { imageToDataURL } from '../../utils/ocr';

interface HomeScreenProps {
  items: PhotoItem[];
  groups: PostalItemGroup[];
  searchQuery: string;
  selectedTags: string[];
  onSearchChange: (query: string) => void;
  onTagToggle: (tag: string) => void;
  onAddItem: (mode: 'unified') => void;
  onItemClick: (itemId: string) => void;
  onGroupClick: (groupId: string) => void;
  onBulkTagRename: (oldName: string, newName: string) => void;
  onImport: (data: any) => void;
  onExport: () => void;
  onBulkDelete: (itemIds: string[], groupIds: string[]) => void;
  onSync: () => void;
}

const COLOR_PALETTE = [
  // 書類・文書関連
  { name: '請求書', color: '#3B82F6' },  // 青
  { name: '領収書', color: '#22C55E' },  // 緑
  { name: '契約書', color: '#A78BFA' },  // 紫
  { name: '申請書', color: '#F59E0B' },  // オレンジ
  { name: '通知', color: '#EC4899' },    // ピンク

  // 生活関連
  { name: '病院', color: '#EF4444' },    // 赤
  { name: '学校', color: '#06B6D4' },    // シアン
  { name: '住所', color: '#8B5CF6' },    // バイオレット
  { name: '保険', color: '#10B981' },    // エメラルド
  { name: 'メモ', color: '#6366F1' },    // インディゴ

  // 追加のカラーパレット（新規タグ用）
  { name: '赤', color: '#DC2626' },
  { name: '青', color: '#2563EB' },
  { name: '緑', color: '#059669' },
  { name: '黄', color: '#D97706' },
  { name: '紫', color: '#7C3AED' },
  { name: '橙', color: '#EA580C' },
  { name: '茶', color: '#92400E' },
  { name: 'ピンク', color: '#DB2777' },
  { name: 'シアン', color: '#0891B2' },
  { name: 'マゼンタ', color: '#BE185D' },
  { name: 'ライム', color: '#65A30D' },
  { name: 'ネイビー', color: '#1E40AF' },
  { name: 'オリーブ', color: '#4D7C0F' },
  { name: 'テール', color: '#0F766E' },
  { name: 'マルーン', color: '#9F1239' },
  { name: 'グレー', color: '#4B5563' },
  { name: '白', color: '#F9FAFB' },
];

const DEFAULT_TAGS = COLOR_PALETTE.slice(0, 10); // 最初の10個を初期タグとして使用

// usePostalTagsフックを拡張
const usePostalTagsWithLimit = () => {
  const postalTags = usePostalTags();
  
  // 元のhandleAddTagを上書き
  const handleAddTagWithLimit = () => {
    if (!postalTags.newTagName.trim()) return;
    if (postalTags.tags.length >= MAX_TAGS) {
      alert(`タグの最大数（${MAX_TAGS}個）に達しました。\n不要なタグを削除してから追加してください。`);
      return;
    }
    const newTag = { name: postalTags.newTagName.trim(), color: postalTags.newTagColor };
    const updated = [...postalTags.tags, newTag];
    localStorage.setItem('postal_tags', JSON.stringify(updated));
    postalTags.setNewTagName('');
    postalTags.setNewTagColor('#3B82F6');
    postalTags.setShowAddTag(false);
  };

  return {
    ...postalTags,
    handleAddTag: handleAddTagWithLimit
  };
};

export const HomeScreen: React.FC<HomeScreenProps> = ({
  items,
  groups,
  searchQuery,
  selectedTags,
  onSearchChange,
  onTagToggle,
  onAddItem,
  onItemClick,
  onGroupClick,
  onBulkTagRename,
  onImport,
  onExport,
  onBulkDelete,
  onSync
}) => {
  const {
    tags,
    showAddTag,
    setShowAddTag,
    newTagName,
    setNewTagName,
    newTagColor,
    setNewTagColor,
    tagEditIdx,
    tagEditName,
    setTagEditName,
    tagEditColor,
    setTagEditColor,
    handleAddTag,
    startEditTag,
    handleEditTag,
    handleCancelEdit,
    handleRemoveTag
  } = usePostalTagsWithLimit();

  // 日付範囲検索用state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [showTagFilter, setShowTagFilter] = useState(false);

  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  const [imageUrlMap, setImageUrlMap] = useState<Record<string, string>>({});
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

  const [showMap, setShowMap] = useState(false);

  const [customIcon, setCustomIcon] = useState<string | null>(getAppIcon());
  const iconInputRef = useRef<HTMLInputElement>(null);

  // 画像URLの読み込み
  useEffect(() => {
    const loadImages = async () => {
      const newMap: Record<string, string> = {};
      const processedImages = new Set<string>();

      const loadAndCacheImage = async (imageId: string) => {
        if (!processedImages.has(imageId) && !imageUrlMap[imageId]) {
          processedImages.add(imageId);
          try {
            const blob = await loadImageBlob(imageId);
            if (blob) {
              newMap[imageId] = URL.createObjectURL(blob);
            }
          } catch (error) {
            console.error('Failed to load image:', imageId, error);
          }
        }
      };

      for (const item of items) {
        if (item.image) {
          await loadAndCacheImage(item.image);
        }
      }

      for (const group of groups) {
        for (const photo of group.photos) {
          if (photo.image) {
            await loadAndCacheImage(photo.image);
          }
        }
      }

      if (Object.keys(newMap).length > 0) {
        setImageUrlMap(prev => {
          // 古いURLを解放
          Object.values(prev).forEach(url => {
            if (!Object.values(newMap).includes(url)) {
              URL.revokeObjectURL(url);
            }
          });
          return { ...prev, ...newMap };
        });
      }
    };

    loadImages();

    return () => {
      // コンポーネントのアンマウント時にURLを解放
      Object.values(imageUrlMap).forEach(url => {
        URL.revokeObjectURL(url);
      });
    };
  }, [items, groups]);

  // 選択状態のリセット
  useEffect(() => {
    if (!isSelectionMode) {
      setSelectedItemIds([]);
      setSelectedGroupIds([]);
    }
  }, [isSelectionMode]);

  // Combine items and groups into a single list for display
  const { filteredItems, filteredGroups, tagCounts } = useMemo(() => {
    // Ensure items and groups are arrays
    const itemsArray = Array.isArray(items) ? items : [];
    const groupsArray = Array.isArray(groups) ? groups : [];

    // Filter items
    const filteredItems = itemsArray.filter(item => {
      const matchesSearch = item.ocrText?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.memo?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTags = selectedTags.length === 0 || selectedTags.every(tag => item.tags?.includes(tag));
      
      // 日付フィルタリング
      const itemDate = new Date(item.createdAt);
      const matchesDateRange = (!startDate || itemDate >= new Date(startDate)) &&
        (!endDate || itemDate <= new Date(endDate + 'T23:59:59'));
      
      return matchesSearch && matchesTags && matchesDateRange;
    });

    // Filter groups
    const filteredGroups = groupsArray.filter(group => {
      const matchesSearch = group.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        group.memo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        group.photos?.some(photo => photo.ocrText?.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesTags = selectedTags.length === 0 || selectedTags.every(tag => group.tags?.includes(tag));
      
      // 日付フィルタリング
      const groupDate = new Date(group.createdAt);
      const matchesDateRange = (!startDate || groupDate >= new Date(startDate)) &&
        (!endDate || groupDate <= new Date(endDate + 'T23:59:59'));
      
      return matchesSearch && matchesTags && matchesDateRange;
    });

    // Count tags from both items and groups
    const counts: Record<string, number> = {};
    itemsArray.forEach(item => {
      if (Array.isArray(item.tags)) {
        item.tags.forEach(tag => {
          counts[tag] = (counts[tag] || 0) + 1;
        });
      }
    });
    groupsArray.forEach(group => {
      if (Array.isArray(group.tags)) {
        group.tags.forEach(tag => {
          counts[tag] = (counts[tag] || 0) + 1;
        });
      }
    });

    return {
      filteredItems,
      filteredGroups,
      tagCounts: counts
    };
  }, [items, groups, searchQuery, selectedTags, startDate, endDate]);

  // エクスポート機能
  const handleExport = () => {
    const data = {
      items,
      groups,
      tags,
      version: '1.0'
    };
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `postal_snap_export_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // インポート処理
  const handleImportSubmit = () => {
    setImportError(null);
    try {
      const data = JSON.parse(importText);
      // タグのマージ処理
      if (data.tags && Array.isArray(data.tags)) {
        const existing = localStorage.getItem('postal_tags');
        let mergedTags = data.tags;
        if (existing) {
          const existingTags = JSON.parse(existing);
          const existingNames = new Set(existingTags.map((t: { name: string }) => t.name));
          const newTags = data.tags.filter((t: { name: string }) => !existingNames.has(t.name));
          mergedTags = [...existingTags, ...newTags];
        }
        localStorage.setItem('postal_tags', JSON.stringify(mergedTags));
      }
      onImport(data);
      setShowImportModal(false);
      setImportText('');
    } catch (error) {
      setImportError('JSONの形式が正しくありません');
    }
  };

  // クリップボードからのペースト
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setImportText(text);
    } catch (error) {
      setImportError('クリップボードからの読み取りに失敗しました');
    }
  };

  // 日付フィルターのクリア
  const clearDateFilter = () => {
    setStartDate('');
    setEndDate('');
  };

  const handleToggleSelection = (id: string, type: 'item' | 'group') => {
    if (type === 'item') {
      setSelectedItemIds(prev =>
        prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
      );
    } else {
      setSelectedGroupIds(prev =>
        prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
      );
    }
  };

  const handleBulkDelete = () => {
    if (selectedItemIds.length === 0 && selectedGroupIds.length === 0) return;
    if (window.confirm(`選択した${selectedItemIds.length + selectedGroupIds.length}件のアイテムを削除しますか？`)) {
      onBulkDelete(selectedItemIds, selectedGroupIds);
      setSelectedItemIds([]);
      setSelectedGroupIds([]);
      setIsSelectionMode(false);
    }
  };

  // アイコンの設定
  const handleIconSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.length) return;
    try {
      const file = event.target.files[0];
      const resizedBase64 = await resizeImage(await imageToDataURL(file), 40, 40);
      const response = await fetch(resizedBase64);
      const blob = await response.blob();
      const iconUrl = await saveAppIcon(blob);
      if (iconUrl) {
        setCustomIcon(iconUrl);
      }
    } catch (error) {
      console.error('アイコンの設定に失敗しました:', error);
      alert('アイコンの設定に失敗しました');
    }
  };

  // アイコンの削除
  const handleRemoveIcon = () => {
    if (window.confirm('カスタムアイコンを削除しますか？')) {
      removeAppIcon();
      setCustomIcon(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* App Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <QRcode
                value="https://snap-organizer.vercel.app/"
                size={40}
                style={{ height: 40, width: 40 }}
              />
              <h1 className="text-xl font-bold">Snap Organizer</h1>
              {customIcon ? (
                <div className="relative group">
                  <img
                    src={customIcon}
                    alt="アプリアイコン"
                    className="h-10 w-10 rounded-lg object-contain"
                  />
                  <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={handleRemoveIcon}
                      className="p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => iconInputRef.current?.click()}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="アイコンを設定"
                >
                  <Image className="h-5 w-5" />
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={onSync}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="同期・バックアップ"
              >
                <RefreshCw className="h-5 w-5" />
              </button>
              <button
                onClick={() => setShowImportModal(true)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="データをインポート"
              >
                <Upload className="h-5 w-5" />
              </button>
              <button
                onClick={handleExport}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="全体をエクスポート"
              >
                <Download className="h-5 w-5" />
              </button>
              <input
                ref={iconInputRef}
                type="file"
                accept="image/*"
                onChange={handleIconSelect}
                className="hidden"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Search, Share and Add Button */}
      <div className="sticky top-0 bg-white shadow-sm z-10">
        <div className="max-w-md mx-auto px-4">
          {/* Search Bar Row */}
          <div className="flex items-center gap-2 py-4">
            <div className="flex-1">
              <SearchBar
                value={searchQuery}
                onChange={onSearchChange}
                placeholder="テキストやタグで検索..."
              />
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setShowMap(!showMap)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="地図表示"
              >
                <Map className="h-5 w-5" />
              </button>
              <button
                onClick={handleExport}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="全体をエクスポート"
              >
                <Share2 className="h-5 w-5" />
              </button>
              <button
                onClick={() => onAddItem('unified')}
                className="p-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors shadow-md"
                title="写真を追加"
              >
                <Plus className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Map View */}
          {showMap && (
            <div className="mb-4 bg-white rounded-xl shadow-sm overflow-hidden">
              <LocationMap
                items={filteredItems}
                groups={filteredGroups}
                onItemClick={onItemClick}
                onGroupClick={onGroupClick}
              />
            </div>
          )}

          {/* Calendar Row */}
          <div className="flex items-center gap-2 pb-4">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-gray-400 flex-shrink-0">～</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
              className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {(startDate || endDate) && (
              <button
                onClick={clearDateFilter}
                className="text-sm text-blue-500 hover:text-blue-600 px-2 flex-shrink-0"
              >
                クリア
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tag Filter */}
      <div className="max-w-md mx-auto px-4 py-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">タグフィルター</h2>
            <button
              onClick={() => setShowTagFilter(!showTagFilter)}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Filter className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag, idx) => (
            <div key={tag.name} className="flex items-center gap-1">
              <TagChip
                tag={tag.name}
                selected={selectedTags.includes(tag.name)}
                onClick={() => onTagToggle(tag.name)}
                style={{ backgroundColor: tag.color + '22', color: tag.color }}
              />
              <button onClick={() => startEditTag(idx)} className="p-1 hover:bg-gray-100 rounded">
                <Pencil className="h-4 w-4" />
              </button>
              <button onClick={() => handleRemoveTag(idx)} className="p-1 hover:bg-red-100 rounded">
                <Trash2 className="h-4 w-4 text-red-500" />
              </button>
            </div>
          ))}
        </div>

        {tagEditIdx !== null && (
          <div className="flex items-center gap-2 mt-2">
            <input
              value={tagEditName}
              onChange={e => setTagEditName(e.target.value)}
              className="border p-1 rounded w-24"
            />
            <input
              type="color"
              value={tagEditColor}
              onChange={e => setTagEditColor(e.target.value)}
              className="w-8 h-8 p-0 border-none"
            />
            <button
              onClick={() => {
                handleEditTag();
                onBulkTagRename(tags[tagEditIdx].name, tagEditName.trim());
              }}
              className="px-2 py-1 bg-blue-500 text-white rounded"
            >
              保存
            </button>
            <button
              onClick={handleCancelEdit}
              className="px-2 py-1 bg-gray-200 rounded"
            >
              キャンセル
            </button>
          </div>
        )}

        {showAddTag ? (
          <div className="flex items-center gap-2 mt-2">
            <input
              value={newTagName}
              onChange={e => setNewTagName(e.target.value)}
              placeholder="新規タグ名"
              className="border p-1 rounded w-24"
            />
            <input
              type="color"
              value={newTagColor}
              onChange={e => setNewTagColor(e.target.value)}
              className="w-8 h-8 p-0 border-none"
            />
            <button
              onClick={handleAddTag}
              className="px-2 py-1 bg-blue-500 text-white rounded"
            >
              追加
            </button>
            <button
              onClick={() => setShowAddTag(false)}
              className="px-2 py-1 bg-gray-200 rounded"
            >
              キャンセル
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowAddTag(true)}
            className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded hover:bg-gray-200 mt-2"
          >
            <Plus className="h-4 w-4" /> 新規タグ
          </button>
        )}
      </div>

      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">スナップ一覧</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsSelectionMode(!isSelectionMode)}
                className={`flex items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
                  isSelectionMode ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'
                }`}
              >
                <CheckSquare className="h-5 w-5" />
                <span className="text-sm">
                  {isSelectionMode ? '選択モード中' : '一括選択'}
                </span>
              </button>
              {isSelectionMode && (selectedItemIds.length > 0 || selectedGroupIds.length > 0) && (
                <button
                  onClick={handleBulkDelete}
                  className="flex items-center gap-1 px-3 py-2 hover:bg-red-100 rounded-lg transition-colors text-red-500"
                >
                  <Trash2 className="h-5 w-5" />
                  <span className="text-sm">
                    {selectedItemIds.length + selectedGroupIds.length}件削除
                  </span>
                </button>
              )}
              <button
                onClick={() => onAddItem('unified')}
                className="flex items-center gap-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors text-white"
              >
                <Plus className="h-5 w-5" />
                <span className="text-sm">新規追加</span>
              </button>
            </div>
          </div>
          {isSelectionMode && (
            <div className="mt-2 text-sm text-gray-600 flex items-center gap-2">
              <span>
                {selectedItemIds.length + selectedGroupIds.length}件選択中
              </span>
              {selectedItemIds.length + selectedGroupIds.length > 0 && (
                <button
                  onClick={() => {
                    setSelectedItemIds([]);
                    setSelectedGroupIds([]);
                  }}
                  className="text-blue-500 hover:underline"
                >
                  選択解除
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Items List */}
      <div className="max-w-md mx-auto px-4">
        {filteredItems.length === 0 && filteredGroups.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">まだアイテムがありません</p>
            <p className="text-gray-400 text-sm">写真を撮影してアイテムを追加しましょう</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Display single items */}
            {filteredItems.map(item => (
              <div key={item.id} className="relative">
                {isSelectionMode && (
                  <button
                    onClick={() => handleToggleSelection(item.id, 'item')}
                    className={`absolute top-2 right-2 z-10 p-2 rounded-full ${
                      selectedItemIds.includes(item.id)
                        ? 'bg-blue-500 text-white'
                        : 'bg-white text-gray-500'
                    }`}
                  >
                    <CheckSquare className="h-5 w-5" />
                  </button>
                )}
                <ItemCard
                  item={item}
                  onClick={isSelectionMode ? () => handleToggleSelection(item.id, 'item') : () => onItemClick(item.id)}
                  imageUrl={imageUrlMap[item.image]}
                />
              </div>
            ))}
            {/* Display groups */}
            {filteredGroups.map(group => (
              <div key={group.id} className="relative">
                {isSelectionMode && (
                  <button
                    onClick={() => handleToggleSelection(group.id, 'group')}
                    className={`absolute top-2 right-2 z-10 p-2 rounded-full ${
                      selectedGroupIds.includes(group.id)
                        ? 'bg-blue-500 text-white'
                        : 'bg-white text-gray-500'
                    }`}
                  >
                    <CheckSquare className="h-5 w-5" />
                  </button>
                )}
                <ItemCard
                  group={group}
                  onClick={isSelectionMode ? () => handleToggleSelection(group.id, 'group') : () => onGroupClick(group.id)}
                  imageUrl={group.photos[0] ? imageUrlMap[group.photos[0].image] : undefined}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">データのインポート</h3>
                <button
                  onClick={() => setShowImportModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-4">
                <label className="block p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer">
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="h-6 w-6 text-gray-400" />
                    <span className="text-gray-600">ファイルを選択</span>
                  </div>
                  <input
                    type="file"
                    accept="application/json"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                          setImportText(e.target?.result as string);
                        };
                        reader.readAsText(file);
                      }
                    }}
                  />
                </label>
                <div className="relative">
                  <textarea
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder="JSONデータを直接入力またはペースト"
                    className="w-full h-48 p-3 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={handlePaste}
                    className="absolute top-2 right-2 p-2 text-gray-400 hover:text-gray-600"
                    title="クリップボードから貼り付け"
                  >
                    <Clipboard className="h-5 w-5" />
                  </button>
                </div>
                {importError && (
                  <div className="text-red-500 text-sm">{importError}</div>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowImportModal(false)}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleImportSubmit}
                    disabled={!importText.trim()}
                    className={`px-4 py-2 rounded-lg ${
                      importText.trim()
                        ? 'bg-blue-500 text-white hover:bg-blue-600'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    インポート
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};