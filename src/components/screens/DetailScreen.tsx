import React, { useState } from 'react';
import { PostalItem } from '../../types';
import { TagChip } from '../TagChip';
import { ArrowLeft, Edit3, Check, X, Trash2, Calendar, FileText, StickyNote } from 'lucide-react';

interface DetailScreenProps {
  item: PostalItem;
  onBack: () => void;
  onUpdate: (updates: Partial<PostalItem>) => void;
  onDelete: () => void;
}

const AVAILABLE_TAGS = ['仕事', '趣味', '旅行', '郵便物'];

export const DetailScreen: React.FC<DetailScreenProps> = ({
  item,
  onBack,
  onUpdate,
  onDelete
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedOcrText, setEditedOcrText] = useState(item.ocrText);
  const [editedMemo, setEditedMemo] = useState(item.memo);
  const [editedTags, setEditedTags] = useState<string[]>(item.tags);

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'long'
    }).format(date);
  };

  const handleSave = () => {
    onUpdate({
      ocrText: editedOcrText,
      memo: editedMemo,
      tags: editedTags
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedOcrText(item.ocrText);
    setEditedMemo(item.memo);
    setEditedTags(item.tags);
    setIsEditing(false);
  };

  const handleTagToggle = (tag: string) => {
    setEditedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const handleDelete = () => {
    if (window.confirm('このアイテムを削除しますか？')) {
      onDelete();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-xl font-bold text-gray-900 flex-1">
              アイテム詳細
            </h1>
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <button
                    onClick={handleCancel}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="h-5 w-5 text-gray-500" />
                  </button>
                  <button
                    onClick={handleSave}
                    className="p-2 hover:bg-green-100 rounded-lg transition-colors"
                  >
                    <Check className="h-5 w-5 text-green-600" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <Edit3 className="h-5 w-5 text-gray-500" />
                  </button>
                  <button
                    onClick={handleDelete}
                    className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                  >
                    <Trash2 className="h-5 w-5 text-red-500" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Image */}
        <div className="bg-white rounded-xl overflow-hidden shadow-sm">
          <img
            src={item.image}
            alt="撮影画像"
            className="w-full aspect-[4/3] object-cover"
          />
        </div>

        {/* Date Info */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 text-gray-600 mb-2">
            <Calendar className="h-5 w-5" />
            <span className="font-medium">作成日時</span>
          </div>
          <p className="text-gray-900">{formatDate(item.createdAt)}</p>
          {item.updatedAt.getTime() !== item.createdAt.getTime() && (
            <p className="text-sm text-gray-500 mt-1">
              最終更新: {formatDate(item.updatedAt)}
            </p>
          )}
        </div>

        {/* OCR Text */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 text-gray-600 mb-4">
            <FileText className="h-5 w-5" />
            <span className="font-medium">抽出されたテキスト</span>
          </div>
          {isEditing ? (
            <textarea
              value={editedOcrText}
              onChange={(e) => setEditedOcrText(e.target.value)}
              className="w-full h-32 p-3 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          ) : (
            <div className="whitespace-pre-wrap text-gray-900 bg-gray-50 p-3 rounded-lg">
              {item.ocrText}
            </div>
          )}
        </div>

        {/* Tags */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">タグ</h2>
          <div className="flex flex-wrap gap-2">
            {isEditing ? (
              AVAILABLE_TAGS.map(tag => (
                <TagChip
                  key={tag}
                  tag={tag}
                  selected={editedTags.includes(tag)}
                  onClick={() => handleTagToggle(tag)}
                />
              ))
            ) : (
              item.tags.length > 0 ? (
                item.tags.map(tag => (
                  <TagChip key={tag} tag={tag} />
                ))
              ) : (
                <p className="text-gray-500">タグが設定されていません</p>
              )
            )}
          </div>
        </div>

        {/* Memo */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 text-gray-600 mb-4">
            <StickyNote className="h-5 w-5" />
            <span className="font-medium">メモ</span>
          </div>
          {isEditing ? (
            <textarea
              value={editedMemo}
              onChange={(e) => setEditedMemo(e.target.value)}
              className="w-full h-24 p-3 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="メモを入力..."
            />
          ) : (
            <div className="text-gray-900">
              {item.memo || (
                <span className="text-gray-500 italic">メモはありません</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};