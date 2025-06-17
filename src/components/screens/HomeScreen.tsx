import React from 'react';
import { useMemo, useState, useEffect } from 'react';
import { PostalItem, PostalItemGroup } from '../../types';
import { SearchBar } from '../SearchBar';
import { TagChip } from '../TagChip';
import { ItemCard } from '../ItemCard';
import { Plus, Package, Edit2, X, Download, Upload, Filter, FileText, Clipboard } from 'lucide-react';
import { usePostalItems } from '../../hooks/usePostalItems';
import QRcode from 'qrcode.react';
import { normalizeOcrText } from '../../utils/normalizeOcrText';

interface HomeScreenProps {
  items: PostalItem[];
  groups: PostalItemGroup[];
  searchQuery: string;
  selectedTags: string[];
  onSearchChange: (query: string) => void;
  onTagToggle: (tag: string) => void;
  onAddItem: (mode: 'single' | 'group') => void;
  onItemClick: (itemId: string) => void;
  onGroupClick: (groupId: string) => void;
  onBulkTagRename: (oldName: string, newName: string) => void;
  onImport: (data: any) => void;
  onExport: () => void;
}

const COLOR_PALETTE = [
  { name: '仕事', color: '#3B82F6' },
  { name: '趣味', color: '#22C55E' },
  { name: '旅行', color: '#A78BFA' },
  { name: '赤', color: '#FF0000' },
  { name: '青', color: '#0000FF' },
  { name: '緑', color: '#008000' },
  { name: '黄', color: '#FFFF00' },
  { name: '紫', color: '#800080' },
  { name: '橙', color: '#FFA500' },
  { name: '茶', color: '#A52A2A' },
  { name: 'ピンク', color: '#FFC0CB' },
  { name: 'シアン', color: '#00FFFF' },
  { name: 'マゼンタ', color: '#FF00FF' },
  { name: 'ライム', color: '#00FF00' },
  { name: 'ネイビー', color: '#000080' },
  { name: 'オリーブ', color: '#808000' },
  { name: 'テール', color: '#008080' },
  { name: 'マルーン', color: '#800000' },
  { name: 'グレー', color: '#808080' },
  { name: '白', color: '#FFFFFF' },
];

const DEFAULT_TAGS = COLOR_PALETTE.slice(0, 3);

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
  onExport
}) => {
  // タグ管理（localStorage永続化）
  const [tags, setTags] = useState(() => {
    const saved = localStorage.getItem('postal_tags');
    return saved ? JSON.parse(saved) : COLOR_PALETTE.slice(0, 3);
  });
  useEffect(() => {
    localStorage.setItem('postal_tags', JSON.stringify(tags));
  }, [tags]);

  // 新規タグ追加用state
  const [showAddTag, setShowAddTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(COLOR_PALETTE[0].color);
  const [addTagError, setAddTagError] = useState('');

  // 日付範囲検索用state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // 編集用state
  const [editTagIdx, setEditTagIdx] = useState<number|null>(null);
  const [editTagName, setEditTagName] = useState('');
  const [editTagColor, setEditTagColor] = useState(COLOR_PALETTE[0].color);
  const [editTagError, setEditTagError] = useState('');
  const [editTagBulk, setEditTagBulk] = useState(false);

  const [activeTab, setActiveTab] = useState<'single' | 'group'>('single');
  const [showTagFilter, setShowTagFilter] = useState(false);

  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  const { filteredItems, tagCounts } = useMemo(() => {
    // 検索とタグでフィルタリング
    const filtered = items.filter(item => {
      const matchesSearch = item.ocrText.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.memo.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTags = selectedTags.length === 0 || selectedTags.every(tag => item.tags.includes(tag));
      return matchesSearch && matchesTags;
    });

    // タグの使用回数をカウント（単体アイテムとグループの両方）
    const counts = new Map<string, number>();
    
    // 単体アイテムのタグをカウント
    items.forEach(item => {
      item.tags.forEach(tag => {
        counts.set(tag, (counts.get(tag) || 0) + 1);
      });
    });

    // グループのタグをカウント
    groups.forEach(group => {
      group.tags.forEach(tag => {
        counts.set(tag, (counts.get(tag) || 0) + 1);
      });
    });

    return {
      filteredItems: filtered,
      tagCounts: counts
    };
  }, [items, groups, searchQuery, selectedTags]);

  // タグ追加処理
  const handleAddTag = () => {
    setAddTagError('');
    if (!newTagName.trim() || tags.some(t => t.name === newTagName.trim())) return;
    if (!newTagColor || newTagColor === COLOR_PALETTE[0].color) {
      setAddTagError('色を選択してください');
      return;
    }
    setTags([...tags, { name: newTagName.trim(), color: newTagColor }]);
    setNewTagName('');
    setNewTagColor(COLOR_PALETTE[0].color);
    setShowAddTag(false);
  };

  // 編集開始
  const openEditTagModal = (idx: number) => {
    setEditTagIdx(idx);
    setEditTagName(tags[idx].name);
    setEditTagColor(tags[idx].color);
    setShowAddTag(false);
  };
  // 編集保存
  const handleEditTag = () => {
    setEditTagError('');
    if (editTagIdx === null || !editTagName.trim()) return;
    if (!editTagColor || editTagColor === COLOR_PALETTE[0].color) {
      setEditTagError('色を選択してください');
      return;
    }
    const oldName = tags[editTagIdx].name;
    const newName = editTagName.trim();
    setTags(tags.map((t, i) => i === editTagIdx ? { name: newName, color: editTagColor } : t));
    if (editTagBulk && oldName !== newName) {
      onBulkTagRename(oldName, newName);
    }
    setEditTagIdx(null);
    setEditTagName('');
    setEditTagColor(COLOR_PALETTE[0].color);
    setEditTagBulk(false);
  };
  // 編集キャンセル
  const handleCancelEdit = () => {
    setEditTagIdx(null);
    setEditTagName('');
    setEditTagColor(COLOR_PALETTE[0].color);
  };
  // タグ削除
  const handleRemoveTag = (idx: number) => {
    if (window.confirm('このタグを削除しますか？')) {
      setTags(tags.filter((_, i) => i !== idx));
    }
  };

  // エクスポート機能
  const handleExport = () => {
    const data = {
      items,
      groups,
      tags,
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

  // インポート処理
  const handleImportSubmit = () => {
    setImportError(null);
    try {
      const data = JSON.parse(importText);
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

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* QRコード（テスト用: http://192.168.3.139:5173/ ） */}
      <div style={{ position: 'absolute', left: 8, top: 8, width: 40, height: 60, display: 'flex', alignItems: 'center' }}>
        <QRcode
          value="https://snap-organizer.vercel.app/"
          size={40}
          style={{ height: 60, width: 40, objectFit: 'contain' }}
        />
      </div>

      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-gray-900">
              Snap Organizer
            </h1>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExport}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="エクスポート"
              >
                <Download className="h-5 w-5 text-gray-600" />
              </button>
              <button
                onClick={() => setShowImportModal(true)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="インポート"
              >
                <Upload className="h-5 w-5 text-gray-600" />
              </button>
            </div>
          </div>

          <SearchBar
            value={searchQuery}
            onChange={onSearchChange}
            placeholder="テキストやタグで検索..."
          />

          {/* タブ切り替え */}
          <div className="flex border-b mt-4">
            <button
              className={`px-4 py-2 font-medium ${
                activeTab === 'single'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab('single')}
            >
              単体アイテム ({items.length})
            </button>
            <button
              className={`px-4 py-2 font-medium ${
                activeTab === 'group'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab('group')}
            >
              グループ ({groups.length})
            </button>
          </div>
        </div>
      </div>

      {/* Tags Filter */}
      <div className="max-w-md mx-auto px-4 py-4 sticky top-16 z-10 bg-gray-50">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-medium text-gray-700">タグフィルター</h2>
          <button
            onClick={() => setShowTagFilter(!showTagFilter)}
            className={`p-2 rounded-lg transition-colors ${
              showTagFilter ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'
            }`}
          >
            <Filter className="h-5 w-5" />
          </button>
        </div>
        
        {showTagFilter && (
          <div className="flex flex-wrap gap-2 items-center">
            {tags.map((tag, idx) => (
              <span key={tag.name} className="flex items-center gap-1">
                <TagChip
                  tag={tag.name}
                  count={tagCounts.get(tag.name) || 0}
                  selected={selectedTags.includes(tag.name)}
                  onClick={() => onTagToggle(tag.name)}
                  style={{ backgroundColor: tag.color + '22', color: tag.color }}
                />
                <button
                  className="ml-1 p-1 rounded hover:bg-gray-200"
                  onClick={() => openEditTagModal(idx)}
                  title="編集"
                >
                  <Edit2 className="w-3 h-3 text-gray-500" />
                </button>
                <button
                  className="ml-1 p-1 rounded hover:bg-red-100"
                  onClick={() => handleRemoveTag(idx)}
                  title="削除"
                >
                  <X className="w-3 h-3 text-red-500" />
                </button>
              </span>
            ))}
            <button
              className="px-2 py-1 bg-gray-200 rounded text-sm"
              onClick={() => setShowAddTag(true)}
            >＋新規タグ</button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="max-w-md mx-auto px-4 pb-20">
        {activeTab === 'single' ? (
          // 単体アイテム一覧
          filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-2">
                {items.length === 0 ? 'まだアイテムがありません' : '該当するアイテムが見つかりません'}
              </p>
              <p className="text-sm text-gray-400">
                {items.length === 0 ? '写真を撮影してアイテムを追加しましょう' : '検索条件を変更してみてください'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredItems.map(item => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onClick={() => onItemClick(item.id)}
                />
              ))}
            </div>
          )
        ) : (
          // グループ一覧
          <div className="space-y-4">
            {groups.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">まだグループがありません</p>
              </div>
            ) : (
              groups.map(group => (
                <div
                  key={group.id}
                  className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => onGroupClick(group.id)}
                >
                  <h3 className="font-medium text-lg mb-2">{group.title}</h3>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {group.tags.map(tag => (
                      <TagChip
                        key={tag}
                        tag={tag}
                        selected={false}
                        onClick={(e) => {
                          e.stopPropagation();
                          onTagToggle(tag);
                        }}
                        style={{
                          backgroundColor: (tags.find(t => t.name === tag)?.color || '#gray') + '22',
                          color: tags.find(t => t.name === tag)?.color || '#gray'
                        }}
                      />
                    ))}
                  </div>
                  <div className="text-sm text-gray-600 mb-3">
                    写真: {group.photos.length}枚
                  </div>
                  {group.memo && (
                    <div className="text-sm text-gray-600 mb-3">
                      メモ: {group.memo}
                    </div>
                  )}
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {group.photos.map(photo => (
                      <img
                        key={photo.id}
                        src={photo.image}
                        alt=""
                        className="w-20 h-20 object-cover rounded"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Add Button */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-3">
        <button
          onClick={() => onAddItem('group')}
          className="p-4 bg-green-500 text-white rounded-full shadow-lg hover:bg-green-600 transition-colors"
          title="写真グループを作成"
        >
          <Package className="h-6 w-6" />
        </button>
        <button
          onClick={() => onAddItem('single')}
          className="p-4 bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600 transition-colors"
          title="写真を追加"
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>

      {/* 新規タグ追加モーダル */}
      {showAddTag && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-md w-80">
            <h2 className="font-bold mb-2">新しいタグを追加</h2>
            <input
              className="border rounded px-2 py-1 w-full mb-2"
              placeholder="タグ名"
              value={newTagName}
              onChange={e => setNewTagName(e.target.value)}
              maxLength={12}
            />
            <div className="mb-4">
              <span className="block mb-1">色見本(パレットから自由設定も可能):</span>
              <div className="flex flex-wrap gap-1 mb-2">
                {COLOR_PALETTE.map(p => (
                  <button
                    key={p.color}
                    type="button"
                    className="w-6 h-6 rounded-full border-2 focus:outline-none"
                    style={{
                      background: p.color,
                      borderColor: newTagColor === p.color ? '#000' : '#fff',
                    }}
                    onClick={() => setNewTagColor(p.color)}
                    aria-label={p.name}
                  />
                ))}
                <input
                  type="color"
                  value={newTagColor}
                  onChange={e => setNewTagColor(e.target.value)}
                  className="ml-2 w-8 h-8 p-0 border-none bg-transparent align-middle"
                  title="カスタム色"
                />
              </div>
            </div>
            {addTagError && <div className="text-red-500 text-xs mb-2">{addTagError}</div>}
            <div className="flex gap-2 justify-end">
              <button
                className="px-3 py-1 bg-gray-200 rounded"
                onClick={() => setShowAddTag(false)}
              >キャンセル</button>
              <button
                className="px-3 py-1 bg-blue-500 text-white rounded"
                onClick={handleAddTag}
                disabled={!newTagName.trim() || tags.some(t => t.name === newTagName.trim())}
              >追加</button>
            </div>
          </div>
        </div>
      )}

      {/* タグ編集モーダル */}
      {editTagIdx !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-md w-80">
            <h2 className="font-bold mb-2">タグを編集</h2>
            <input
              className="border rounded px-2 py-1 w-full mb-2"
              placeholder="タグ名"
              value={editTagName}
              onChange={e => setEditTagName(e.target.value)}
              maxLength={12}
            />
            <div className="flex items-center gap-2 mb-4">
              <span>色:</span>
              <input
                type="color"
                value={editTagColor}
                onChange={e => setEditTagColor(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 mb-2">
              <input type="checkbox" id="editTagBulk" checked={editTagBulk} onChange={e => setEditTagBulk(e.target.checked)} />
              <label htmlFor="editTagBulk" className="text-sm">既存データのタグ名も一括変更</label>
            </div>
            {editTagError && <div className="text-red-500 text-xs mb-2">{editTagError}</div>}
            <div className="flex gap-2 justify-end">
              <button
                className="px-3 py-1 bg-gray-200 rounded"
                onClick={handleCancelEdit}
              >キャンセル</button>
              <button
                className="px-3 py-1 bg-blue-500 text-white rounded"
                onClick={handleEditTag}
                disabled={!editTagName.trim()}
              >保存</button>
            </div>
          </div>
        </div>
      )}

      {/* インポートモーダル */}
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
                {/* ファイルアップロード */}
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

      <button
        onClick={() => {
          localStorage.removeItem('postal_tags');
          window.location.reload();
        }}
        className="px-3 py-1 bg-red-500 text-white rounded"
      >
        タグを初期状態に戻す
      </button>
    </div>
  );
};