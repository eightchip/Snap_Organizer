import React from 'react';
import { useMemo, useState, useEffect } from 'react';
import { PostalItem, PostalItemGroup } from '../../types';
import { SearchBar } from '../SearchBar';
import { TagChip } from '../TagChip';
import { ItemCard } from '../ItemCard';
import { Plus, Package, Edit2, X } from 'lucide-react';
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
  onBulkTagRename: (oldName: string, newName: string) => void;
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
  onBulkTagRename
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

  const { filteredItems, tagCounts } = useMemo(() => {
    // Calculate tag counts
    const counts: Record<string, number> = {};
    tags.forEach(tag => {
      counts[tag.name] = items.filter(item => item.tags.includes(tag.name)).length;
    });

    // Filter items
    let filtered = items;

    const normalizedQuery = normalizeOcrText(searchQuery.toLowerCase());

    if (searchQuery) {
      filtered = filtered.filter(item =>
        normalizeOcrText(item.ocrText.toLowerCase()).includes(normalizedQuery) ||
        normalizeOcrText(item.memo.toLowerCase()).includes(normalizedQuery) ||
        item.tags.some(tag => normalizeOcrText(tag.toLowerCase()).includes(normalizedQuery))
      );
    }

    if (selectedTags.length > 0) {
      filtered = filtered.filter(item =>
        selectedTags.every(tag => item.tags.includes(tag))
      );
    }

    // 日付範囲フィルタ
    if (startDate) {
      const start = new Date(startDate);
      filtered = filtered.filter(item => new Date(item.createdAt) >= start);
    }
    if (endDate) {
      const end = new Date(endDate);
      // 終了日の23:59:59まで含める
      end.setHours(23,59,59,999);
      filtered = filtered.filter(item => new Date(item.createdAt) <= end);
    }

    return { filteredItems: filtered, tagCounts: counts };
  }, [items, searchQuery, selectedTags, startDate, endDate, tags]);

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
          <h1 className="text-xl font-bold text-gray-900 mb-4">
            Snap Organizer
          </h1>
          <SearchBar
            value={searchQuery}
            onChange={onSearchChange}
            placeholder="テキストやタグで検索..."
          />
          {/* 日付範囲検索UI */}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-gray-600">期間検索:</span>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="border rounded px-2 py-1 text-sm"
              placeholder="開始日"
            />
            <span className="text-gray-500">～</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="border rounded px-2 py-1 text-sm"
              placeholder="終了日"
            />
            {(startDate || endDate) && (
              <button
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="p-1 text-red-500 hover:text-red-700"
                title="期間検索をリセット"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {/* タグなし検索チェックボックス */}
          <div className="flex items-center gap-2 mt-2">
            <input
              type="checkbox"
              id="no-tags-search"
              checked={selectedTags.length === 0}
              onChange={() => onTagToggle('')}
              className="rounded"
            />
            <label htmlFor="no-tags-search" className="text-sm text-gray-600">
              タグなしのアイテムも検索
            </label>
          </div>
        </div>
      </div>

      {/* Tags Filter */}
      <div className="max-w-md mx-auto px-4 py-4 sticky top-16 z-10 bg-gray-50">
        <div className="flex flex-wrap gap-2 items-center">
          {tags.map((tag, idx) => (
            <span key={tag.name} className="flex items-center gap-1">
              <TagChip
                tag={tag.name}
                count={tagCounts[tag.name]}
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

      {/* Items List */}
      <div className="max-w-md mx-auto px-4 pb-20">
        {filteredItems.length === 0 ? (
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
        )}
      </div>

      {/* 写真追加ボタン */}
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