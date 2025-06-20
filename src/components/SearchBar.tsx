import React, { useState } from 'react';
import { Search, X, Filter, Sparkles } from 'lucide-react';
import AdvancedSearchModal from './AdvancedSearchModal';
import { SearchQuery } from '../hooks/useSearch';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onAdvancedSearch?: (query: SearchQuery) => void;
  placeholder?: string;
  showAdvancedSearch?: boolean;
  isSearching?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  onAdvancedSearch,
  placeholder = 'テキストやタグで検索...',
  showAdvancedSearch = true,
  isSearching = false,
}) => {
  const [isAdvancedSearchOpen, setIsAdvancedSearchOpen] = useState(false);

  const handleAdvancedSearch = (query: SearchQuery) => {
    onAdvancedSearch?.(query);
    setIsAdvancedSearchOpen(false);
  };

  return (
    <>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="block w-full pl-10 pr-20 py-3 border border-gray-200 rounded-xl bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
          placeholder={placeholder}
          disabled={isSearching}
        />
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center gap-1">
          {value && (
            <button
              onClick={() => onChange('')}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              disabled={isSearching}
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {showAdvancedSearch && onAdvancedSearch && (
            <button
              onClick={() => setIsAdvancedSearchOpen(true)}
              className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
              title="高度な検索"
              disabled={isSearching}
            >
              <Filter className="h-4 w-4" />
            </button>
          )}
        </div>
        
        {/* 検索対象の説明 */}
        {!value && (
          <div className="absolute top-full left-0 right-0 mt-1 px-3 py-2 bg-gray-50 rounded-lg text-xs text-gray-500 shadow-lg z-10">
            <div className="flex items-center gap-1 mb-1">
              <Sparkles className="h-3 w-3" />
              <span className="font-medium">検索対象:</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <span>• OCRテキスト</span>
              <span>• メモ内容</span>
              <span>• タグ</span>
              <span>• 位置情報・施設名</span>
            </div>
          </div>
        )}
      </div>

      {/* 高度な検索モーダル */}
      {showAdvancedSearch && onAdvancedSearch && (
        <AdvancedSearchModal
          isOpen={isAdvancedSearchOpen}
          onClose={() => setIsAdvancedSearchOpen(false)}
          onSearch={handleAdvancedSearch}
          isSearching={isSearching}
        />
      )}
    </>
  );
};