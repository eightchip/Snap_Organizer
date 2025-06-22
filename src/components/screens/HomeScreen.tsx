import React, { useRef, useState, useEffect, useMemo } from 'react';
import { PhotoItem, PostalItemGroup, Tag } from '../../types';
import { SearchBar } from '../SearchBar';
import { TagChip } from '../TagChip';
import { ItemCard } from '../ItemCard';
import { Plus, Package, X, Download, Upload, Filter, FileText, Clipboard, Share2, Pencil, Trash2, CheckSquare, Map, Image, Search } from 'lucide-react';
// import { usePostalItems } from '../../hooks/usePostalItems';
import { useSearch, SearchQuery } from '../../hooks/useSearch';
import { MAX_TAGS } from '../../constants/tags';
import QRcode from 'qrcode.react';
// import { normalizeOcrText } from '../../utils/normalizeOcrText';
import { loadImageBlob, saveAppIconToDB, loadAppIconFromDB, deleteAppIconFromDB } from '../../utils/imageDB';
import { resizeImage } from '../../utils/imageResize';
import { imageToDataURL } from '../../utils/ocr';
import { SyncManager } from '../../utils/syncUtils';
import { shareDataViaEmail } from '../../utils/share';
import { LocationMap } from '../LocationMap';
import PhotoGalleryModal from '../components/PhotoGalleryModal';

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
  getExportData: () => Promise<any>;
  onBulkDelete: (itemIds: string[], groupIds: string[]) => void;
  availableTags: Tag[];
  // タグ編集UI用props
  showAddTag: boolean;
  setShowAddTag: (v: boolean) => void;
  newTagName: string;
  setNewTagName: (v: string) => void;
  newTagColor: string;
  setNewTagColor: (v: string) => void;
  tagEditIdx: number|null;
  tagEditName: string;
  setTagEditName: (v: string) => void;
  tagEditColor: string;
  setTagEditColor: (v: string) => void;
  handleAddTag: () => void;
  startEditTag: (idx: number) => void;
  handleEditTag: (idx: number, name: string, color: string) => void;
  handleCancelEdit: () => void;
  handleRemoveTag: (idx: number) => void;
}

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
  getExportData,
  onBulkDelete,
  availableTags,
  // タグ編集UI用props
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
}) => {
  const [showTagFilter, setShowTagFilter] = useState(false);

  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  const [imageUrlMap, setImageUrlMap] = useState<Record<string, string>>({});
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

  const [showMap, setShowMap] = useState(false);

  const [customIcon, setCustomIcon] = useState<string | null>(null);
  const iconInputRef = useRef<HTMLInputElement>(null);

  const [showShareModal, setShowShareModal] = useState(false);
  const syncManager = useMemo(() => new SyncManager(), []);

  // 新しい検索フックを使用
  const {
    isInitialized,
    isSearching,
    searchResults,
    error: searchError,
    search: advancedSearch,
    addItemToIndex,
    addGroupToIndex,
    } = useSearch();

  // 検索結果の状態管理
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [currentSearchMode, setCurrentSearchMode] = useState<'basic' | 'advanced'>('basic');

  // 日付範囲検索用stateを宣言
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // AND/OR切り替え用state
  const [tagFilterMode, setTagFilterMode] = useState<'AND' | 'OR'>('AND');

  // 全画面ギャラリーモーダル用state
  const [galleryPhotos, setGalleryPhotos] = useState<string[]>([]);
  const [galleryIndex, setGalleryIndex] = useState<number>(0);
  const [showGallery, setShowGallery] = useState(false);

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

      // Ensure items and groups are arrays before iterating
      const itemsArray = Array.isArray(items) ? items : [];
      const groupsArray = Array.isArray(groups) ? groups : [];

      for (const item of itemsArray) {
        if (item.image) {
          await loadAndCacheImage(item.image);
        }
      }

      for (const group of groupsArray) {
        if (Array.isArray(group.photos)) {
          for (const photo of group.photos) {
            if (photo.image) {
              await loadAndCacheImage(photo.image);
            }
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
      // コンポーネントのアンマウント時にURLを解放テスト変更
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

  // 高度な検索を実行
  const handleAdvancedSearch = async (query: SearchQuery) => {
    setCurrentSearchMode('advanced');
    setShowSearchResults(true);
    await advancedSearch(query, items, groups);
  };

  // 基本的な検索を実行
  const handleBasicSearch = async (query: string) => {
    if (!query.trim()) {
      setShowSearchResults(false);
      setCurrentSearchMode('basic');
      return;
    }

    setCurrentSearchMode('basic');
    setShowSearchResults(true);
    
    // 基本的な検索クエリを作成
    const searchQuery: SearchQuery = {
      query: query.trim(),
      fields: ['ocr_text', 'memo', 'tags', 'location_name'],
      limit: 50,
    };
    
    await advancedSearch(searchQuery, items, groups);
  };

  // 検索結果からアイテムを取得
  const getSearchResultItems = useMemo(() => {
    if (!showSearchResults || !searchResults.length) {
      return { items: [], groups: [] };
    }

    const resultItems: PhotoItem[] = [];
    const resultGroups: PostalItemGroup[] = [];

    // 検索結果のIDからアイテムとグループを取得
    for (const result of searchResults) {
      // アイテムから検索
      const item = items.find(item => item.id === result.id);
      if (item) {
        resultItems.push(item);
        continue;
      }

      // グループから検索
      const group = groups.find(group => group.id === result.id);
      if (group) {
        resultGroups.push(group);
        continue;
      }

      // グループ内の写真から検索
      for (const group of groups) {
        const photo = group.photos.find(photo => photo.id === result.id);
        if (photo) {
          resultItems.push(photo);
          break;
        }
      }
    }

    return { items: resultItems, groups: resultGroups };
  }, [searchResults, items, groups, showSearchResults]);

  // アイテムとグループを検索インデックスに追加
  useEffect(() => {
    if (!isInitialized) return;

    const updateSearchIndex = async () => {
      // アイテムをインデックスに追加
      for (const item of items) {
        await addItemToIndex(item);
      }

      // グループをインデックスに追加
      for (const group of groups) {
        await addGroupToIndex(group);
      }
    };

    updateSearchIndex();
  }, [isInitialized, items, groups, addItemToIndex, addGroupToIndex]);

  // 検索クエリが変更されたときの処理
  useEffect(() => {
    if (searchQuery) {
      handleBasicSearch(searchQuery);
    } else {
      setShowSearchResults(false);
    }
  }, [searchQuery]);

  // フィルタリングされたアイテムとグループ
  const filteredItems = useMemo(() => {
    let filtered = showSearchResults ? getSearchResultItems.items : items;

    // 日付フィルター
    if (startDate || endDate) {
      filtered = filtered.filter(item => {
        const itemDate = new Date(item.createdAt);
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;
        
        if (start && itemDate < start) return false;
        if (end && itemDate > end) return false;
        return true;
      });
    }

    // タグフィルター
    if (selectedTags.length > 0) {
      filtered = filtered.filter(item =>
        tagFilterMode === 'AND'
          ? selectedTags.every(tag => item.tags.includes(tag))
          : selectedTags.some(tag => item.tags.includes(tag))
      );
    }

    return filtered;
  }, [showSearchResults, getSearchResultItems.items, items, startDate, endDate, selectedTags, tagFilterMode]);

  const filteredGroups = useMemo(() => {
    let filtered = showSearchResults ? getSearchResultItems.groups : groups;

    // 日付フィルター
    if (startDate || endDate) {
      filtered = filtered.filter(group => {
        const groupDate = new Date(group.createdAt);
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;
        
        if (start && groupDate < start) return false;
        if (end && groupDate > end) return false;
        return true;
      });
    }

    // タグフィルター
    if (selectedTags.length > 0) {
      filtered = filtered.filter(group =>
        tagFilterMode === 'AND'
          ? selectedTags.every(tag => group.tags.includes(tag))
          : selectedTags.some(tag => group.tags.includes(tag))
      );
    }

    return filtered;
  }, [showSearchResults, getSearchResultItems.groups, groups, startDate, endDate, selectedTags, tagFilterMode]);

  const handleExportClick = () => {
    setShowShareModal(true);
  };

  const handleDownloadJson = () => {
    onExport();
    setShowShareModal(false);
  };

  const handleShareViaEmail = async () => {
    const exportData = await getExportData();
    // Construct SyncData inline (prepareSyncData does not exist)
    const version = '1.0';
    const timestamp = Date.now();
    // Get deviceId using the same logic as SyncManager
    let deviceId = localStorage.getItem('device_id');
    if (!deviceId) {
      deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('device_id', deviceId);
    }
    const data = {
      items: exportData.items,
      groups: exportData.groups,
      tags: exportData.tags,
    };
    // Calculate checksum (copy logic from calculateChecksum)
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(JSON.stringify(data));
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const checksum = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    const syncData = { version, timestamp, deviceId, data, checksum };
    const emailContent = await syncManager.generateEmailBackup(syncData);

    // 画像ファイルも添付
    const attachments = [
      { blob: emailContent.attachment, filename: `snap-organizer-backup-${Date.now()}.json`, mimeType: 'application/json' }
    ];
    // アイテム画像
    for (const item of exportData.items) {
      if (item.image) {
        try {
          const blob = await loadImageBlob(item.image);
          if (blob && blob.size > 0) {
            attachments.push({ blob, filename: `item-${item.id}.jpg`, mimeType: 'image/jpeg' });
          }
        } catch {}
      }
    }
    // グループ画像
    for (const group of exportData.groups) {
      if (Array.isArray(group.photos)) {
        for (const photo of group.photos) {
          if (photo.image) {
            try {
              const blob = await loadImageBlob(photo.image);
              if (blob && blob.size > 0) {
                attachments.push({ blob, filename: `group-${group.id}-photo-${photo.id}.jpg`, mimeType: 'image/jpeg' });
              }
            } catch {}
          }
        }
      }
    }

    await shareDataViaEmail(
      emailContent.subject,
      emailContent.body,
      attachments
    );
    setShowShareModal(false);
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
      await saveAppIconToDB(blob);
      setCustomIcon(URL.createObjectURL(blob));
    } catch (error) {
      console.error('アイコンの設定に失敗しました:', error);
      alert('アイコンの設定に失敗しました');
    }
  };

  // アイコンの削除
  const handleRemoveIcon = () => {
    if (window.confirm('カスタムアイコンを削除しますか？')) {
      deleteAppIconFromDB();
      setCustomIcon(null);
    }
  };

  // 永続化: 初期化時にIndexedDBから再取得
  useEffect(() => {
    (async () => {
      const blob = await loadAppIconFromDB();
      if (blob) {
        setCustomIcon(URL.createObjectURL(blob));
      } else {
        setCustomIcon(null);
      }
    })();
  }, []);

  return (
    <div className="max-w-md mx-auto bg-gray-50 min-h-screen">
      <input
        type="file"
        ref={iconInputRef}
        onChange={handleIconSelect}
        className="hidden"
        accept="image/*"
      />
      <header className="sticky top-0 z-30 bg-gradient-to-r from-gray-50 to-blue-50 backdrop-blur-sm shadow-sm">
        <div className="max-w-md mx-auto px-4">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-2">
              <QRcode
                value="https://snap-organizer.vercel.app/"
                size={40}
                style={{ height: 40, width: 40 }}
              />
              <h1 className="text-xl font-bold">Snap Organizer</h1>
            </div>
            <div className="flex items-center gap-2">
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
              <button onClick={() => setShowImportModal(true)} className="p-2 rounded-full hover:bg-gray-200 transition-colors" title="インポート">
                <Download className="w-6 h-6" />
              </button>
              <button onClick={handleExportClick} className="p-2 rounded-full hover:bg-gray-200 transition-colors" title="エクスポート/共有">
                <Upload className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="sticky top-0 bg-white shadow-sm z-10">
        <div className="max-w-md mx-auto px-4">
          <div className="flex items-center gap-2 py-4">
            <div className="flex-1">
              <SearchBar
                value={searchQuery}
                onChange={onSearchChange}
                onAdvancedSearch={handleAdvancedSearch}
                placeholder="テキストやタグで検索..."
                showAdvancedSearch={true}
                isSearching={isSearching}
                advancedTags={availableTags.map((tag: { name: string }) => tag.name)}
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
                onClick={() => onAddItem('unified')}
                className="p-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors shadow-md"
                title="写真を追加"
              >
                <Plus className="h-6 w-6" />
              </button>
            </div>
          </div>

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

          {/* 検索結果の表示 */}
          {showSearchResults && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">
                    検索結果 ({searchResults.length}件)
                  </span>
                </div>
                <button
                  onClick={() => {
                    setShowSearchResults(false);
                    onSearchChange('');
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  クリア
                </button>
              </div>
              {searchError && (
                <p className="text-xs text-red-600 mb-2">{searchError}</p>
              )}
              <p className="text-xs text-blue-700">
                {currentSearchMode === 'advanced' ? '高度な検索' : '基本検索'}で「{searchQuery}」を検索
              </p>
            </div>
          )}
        </div>
      </div>

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
            {/* AND/OR切り替え */}
            <div className="ml-2 flex gap-1">
              <button
                onClick={() => setTagFilterMode('AND')}
                className={`px-2 py-1 rounded text-xs font-bold border-2 ${tagFilterMode === 'AND' ? 'bg-blue-500 text-white border-blue-600' : 'bg-white text-blue-500 border-blue-300'}`}
              >AND</button>
              <button
                onClick={() => setTagFilterMode('OR')}
                className={`px-2 py-1 rounded text-xs font-bold border-2 ${tagFilterMode === 'OR' ? 'bg-blue-500 text-white border-blue-600' : 'bg-white text-blue-500 border-blue-300'}`}
              >OR</button>
            </div>
          </div>
          {/* タグ一括解除ボタン */}
          {selectedTags.length > 0 && (
            <button
              onClick={() => onTagToggle('ALL_CLEAR')}
              className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-xs font-bold text-gray-700 border border-gray-400"
            >
              選択解除
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {availableTags.map((tag: { name: string; color: string }, idx: number) => {
            // タグ件数を計算
            const itemCount = items.filter(item => item.tags.includes(tag.name)).length;
            const groupPhotoCount = groups.reduce((acc, group) => acc + (group.photos ? group.photos.filter(photo => photo.tags.includes(tag.name)).length : 0), 0);
            const groupCount = groups.filter(group => group.tags && group.tags.includes(tag.name)).length;
            const totalCount = itemCount + groupPhotoCount + groupCount;
            const isSelected = selectedTags.includes(tag.name);
            return (
              <div key={tag.name} className="flex items-center gap-1">
                <TagChip
                  tag={tag.name}
                  selected={isSelected}
                  onClick={() => onTagToggle(tag.name)}
                  style={{
                    backgroundColor: tag.color + (isSelected ? '33' : '22'),
                    color: tag.color,
                    borderWidth: isSelected ? 3 : 1,
                    borderColor: isSelected ? tag.color : '#ccc',
                    boxShadow: isSelected ? `0 0 0 2px ${tag.color}55` : undefined,
                  }}
                />
                {totalCount > 0 && (
                  <span className="text-xs font-bold text-pink-600 ml-0.5">{totalCount}</span>
                )}
                <button onClick={() => startEditTag(idx)} className="p-1 hover:bg-gray-100 rounded">
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => handleRemoveTag(idx)} className="p-1 hover:bg-red-100 rounded">
                  <Trash2 className="h-4 w-4 text-red-500" />
                </button>
              </div>
            );
          })}
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
                handleEditTag(tagEditIdx, tagEditName, tagEditColor);
                onBulkTagRename(availableTags[tagEditIdx].name, tagEditName.trim());
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

      <div className="max-w-md mx-auto px-4">
        {filteredItems.length === 0 && filteredGroups.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">まだアイテムがありません</p>
            <p className="text-gray-400 text-sm">写真を撮影してアイテムを追加しましょう</p>
          </div>
        ) : (
          <div className="space-y-4">
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
                  availableTags={availableTags}
                />
              </div>
            ))}
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
                  availableTags={availableTags}
                  onPhotoClick={(idx) => {
                    setGalleryPhotos(group.photos.map(p => imageUrlMap[p.image] || ''));
                    setGalleryIndex(idx);
                    setShowGallery(true);
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>

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

      {showShareModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm">
            <h2 className="text-xl font-bold mb-4">エクスポート/共有</h2>
            <p className="mb-6">データのエクスポート方法を選択してください。</p>
            <div className="space-y-4">
              <button
                onClick={handleDownloadJson}
                className="w-full flex items-center justify-center p-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                <Download className="w-5 h-5 mr-2" />
                JSONファイルとしてダウンロード
              </button>
              <button
                onClick={handleShareViaEmail}
                className="w-full flex items-center justify-center p-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                <Share2 className="w-5 h-5 mr-2" />
                Eメールで共有
              </button>
            </div>
            <button
              onClick={() => setShowShareModal(false)}
              className="mt-6 w-full p-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* 全画面ギャラリーモーダル */}
      {showGallery && (
        <PhotoGalleryModal
          photos={galleryPhotos}
          initialIndex={galleryIndex}
          onClose={() => setShowGallery(false)}
        />
      )}
    </div>
  );
};