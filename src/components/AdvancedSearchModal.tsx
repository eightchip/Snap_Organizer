import React, { useState } from 'react';
import { SearchQuery } from '../hooks/useSearch';
import { Calendar, Search, X, Clock, Tag, MapPin, FileText, StickyNote } from 'lucide-react';

interface AdvancedSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (query: SearchQuery) => void;
  isSearching: boolean;
  availableTags?: string[];
}

const AdvancedSearchModal: React.FC<AdvancedSearchModalProps> = ({
  isOpen,
  onClose,
  onSearch,
  isSearching,
  availableTags = [],
}) => {
  const [query, setQuery] = useState('');
  const [selectedFields, setSelectedFields] = useState<string[]>(['ocr_text', 'memo', 'tags']);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [limit, setLimit] = useState(20);

  const availableFields = [
    { id: 'ocr_text', label: 'OCRテキスト', icon: FileText },
    { id: 'memo', label: 'メモ', icon: StickyNote },
    { id: 'tags', label: 'タグ', icon: Tag },
    { id: 'location_name', label: '位置情報', icon: MapPin },
    { id: 'group_title', label: 'グループタイトル', icon: FileText },
  ];

  const handleFieldToggle = (fieldId: string) => {
    setSelectedFields(prev =>
      prev.includes(fieldId)
        ? prev.filter(f => f !== fieldId)
        : [...prev, fieldId]
    );
  };

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const handleSearch = () => {
    if (!query.trim()) return;

    const searchQuery: SearchQuery = {
      query: query.trim(),
      fields: selectedFields.length > 0 ? selectedFields : undefined,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      tags: selectedTags.length > 0 ? selectedTags : undefined,
      limit,
    };

    onSearch(searchQuery);
  };

  const handleReset = () => {
    setQuery('');
    setSelectedFields(['ocr_text', 'memo', 'tags']);
    setDateFrom('');
    setDateTo('');
    setSelectedTags([]);
    setLimit(20);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Search className="h-5 w-5" />
            高度な検索
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 検索クエリ */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            検索キーワード
          </label>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="検索したいキーワードを入力..."
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>

        {/* 検索フィールド */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            検索対象フィールド
          </label>
          <div className="grid grid-cols-2 gap-2">
            {availableFields.map((field) => {
              const Icon = field.icon;
              return (
                <label
                  key={field.id}
                  className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                    selectedFields.includes(field.id)
                      ? 'bg-blue-50 border-blue-200'
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedFields.includes(field.id)}
                    onChange={() => handleFieldToggle(field.id)}
                    className="sr-only"
                  />
                  <Icon className="h-4 w-4" />
                  <span className="text-sm">{field.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* 日付範囲 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            作成日時範囲
          </label>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-600 mb-1">開始日</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">終了日</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* タグフィルター */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <Tag className="h-4 w-4" />
            タグフィルター
          </label>
          <div className="flex flex-wrap gap-2">
            {availableTags.map((tag) => (
              <button
                key={tag}
                onClick={() => handleTagToggle(tag)}
                className={`px-3 py-1 rounded-full text-sm transition-colors ${
                  selectedTags.includes(tag)
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* 結果件数制限 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            最大結果件数
          </label>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={10}>10件</option>
            <option value={20}>20件</option>
            <option value={50}>50件</option>
            <option value={100}>100件</option>
          </select>
        </div>

        {/* 操作ボタン */}
        <div className="flex justify-end gap-3">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            リセット
          </button>
          <button
            onClick={handleSearch}
            disabled={isSearching || !query.trim()}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSearching ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                検索中...
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                検索
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdvancedSearchModal; 