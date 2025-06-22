import React from 'react';
import { PhotoItem, PostalItemGroup, Tag } from '../types';
import { TagChip } from './TagChip';
import { Calendar, FileText, Image } from 'lucide-react';

interface ItemCardProps {
  item?: PhotoItem;
  group?: PostalItemGroup;
  onClick: () => void;
  imageUrl?: string;
  availableTags: Tag[];
  onPhotoClick?: (photoIdx: number) => void;
}

export const ItemCard: React.FC<ItemCardProps> = ({ item, group, onClick, imageUrl, availableTags, onPhotoClick }) => {
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const truncateText = (text: string, maxLength: number = 100) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  const getTagColor = (tagName: string, availableTags: Tag[]) => {
    const found = availableTags.find((t: any) => t.name === tagName);
    return found ? found.color : '#ccc';
  };

  // 単体アイテムの場合
  if (item) {
    return (
      <div
        onClick={onClick}
        className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
      >
        <div className="bg-gray-100 overflow-hidden flex items-center justify-center" style={{ height: 160 }}>
          <img
            src={imageUrl}
            alt="撮影画像"
            className="max-h-full max-w-full object-contain"
            style={{ width: '100%', height: 'auto' }}
          />
        </div>
        
        <div className="p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Calendar className="h-4 w-4" />
            <span>{formatDate(item.createdAt)}</span>
          </div>
          
          <div className="flex items-start gap-2 mb-3">
            <FileText className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-gray-700 leading-relaxed">
              {truncateText(item.ocrText)}
            </p>
          </div>
          
          {item.memo && (
            <p className="text-sm text-gray-600 mb-3 italic">
              {truncateText(item.memo, 80)}
            </p>
          )}
          
          {item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {item.tags.map((tag) => (
                <TagChip key={tag} tag={tag} style={{ backgroundColor: getTagColor(tag, availableTags) + '22', color: getTagColor(tag, availableTags) }} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // グループの場合
  if (group) {
    return (
      <div
        onClick={onClick}
        className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
      >
        {/* 横スクロールサムネイル */}
        <div className="bg-gray-100 overflow-x-auto flex gap-2 items-center px-2" style={{ height: 100 }} onClick={e => e.stopPropagation()}>
          {group.photos.map((photo, idx) => (
            <img
              key={photo.id}
              src={photo.image}
              alt={`グループ写真${idx+1}`}
              className="h-20 w-auto rounded shadow cursor-pointer border-2 border-gray-200 hover:border-blue-400"
              onClick={() => onPhotoClick && onPhotoClick(idx)}
              style={{ flex: '0 0 auto' }}
            />
          ))}
        </div>
        {/* 1枚目をサムネイルとして大きく表示（従来通り） */}
        <div className="bg-gray-100 overflow-hidden flex items-center justify-center" style={{ height: 160 }}>
          <img
            src={imageUrl}
            alt="グループのサムネイル"
            className="max-h-full max-w-full object-contain"
            style={{ width: '100%', height: 'auto' }}
          />
        </div>
        
        <div className="p-4">
          <h3 className="font-medium text-lg mb-2">{group.title || '無題のグループ'}</h3>
          
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Calendar className="h-4 w-4" />
            <span>{formatDate(group.createdAt)}</span>
            <span className="ml-auto flex items-center gap-1">
              <Image className="h-4 w-4" />
              {group.photos.length}枚
            </span>
          </div>
          
          {group.memo && (
            <p className="text-sm text-gray-600 mb-3 italic">
              {truncateText(group.memo, 80)}
            </p>
          )}
          
          {group.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {group.tags.map((tag) => (
                <TagChip key={tag} tag={tag} style={{ backgroundColor: getTagColor(tag, availableTags) + '22', color: getTagColor(tag, availableTags) }} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};