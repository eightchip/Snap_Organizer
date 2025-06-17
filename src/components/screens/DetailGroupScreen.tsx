import React, { useState, useEffect } from 'react';
import { PostalItemGroup, PhotoItem } from '../../types';
import { TagChip } from '../TagChip';
import { ArrowLeft, Edit3, Check, X, Trash2, Plus, Camera, Upload } from 'lucide-react';
import { imageToDataURL } from '../../utils/ocr';
import { resizeImage } from '../../utils/imageResize';
import { generateId } from '../../utils/storage';

interface DetailGroupScreenProps {
  group: PostalItemGroup;
  onBack: () => void;
  onUpdate: (updates: Partial<PostalItemGroup>) => void;
  onDelete: () => void;
}

export const DetailGroupScreen: React.FC<DetailGroupScreenProps> = ({
  group,
  onBack,
  onUpdate,
  onDelete
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(group.title);
  const [editedMemo, setEditedMemo] = useState(group.memo);
  const [editedTags, setEditedTags] = useState<string[]>(group.tags);
  const [editedPhotos, setEditedPhotos] = useState<PhotoItem[]>(group.photos);
  const [availableTags, setAvailableTags] = useState(() => {
    const saved = localStorage.getItem('postal_tags');
    return saved ? JSON.parse(saved) : [];
  });

  // タグリストを更新
  useEffect(() => {
    const saved = localStorage.getItem('postal_tags');
    if (saved) {
      setAvailableTags(JSON.parse(saved));
    }
  }, [isEditing]);

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
      title: editedTitle,
      memo: editedMemo,
      tags: editedTags,
      photos: editedPhotos,
      updatedAt: new Date()
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedTitle(group.title);
    setEditedMemo(group.memo);
    setEditedTags(group.tags);
    setEditedPhotos(group.photos);
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
    if (window.confirm('このグループを削除しますか？')) {
      onDelete();
    }
  };

  const handleAddPhoto = async (file: File) => {
    try {
      const imageDataURL = await imageToDataURL(file);
      const resizedImage = await resizeImage(dataURLtoFile(imageDataURL, 'image.jpg'), 1000, 1000);
      const reader = new FileReader();
      reader.onload = () => {
        const newPhoto: PhotoItem = {
          id: generateId(),
          image: reader.result as string,
          ocrText: '',
          createdAt: new Date()
        };
        setEditedPhotos(prev => [...prev, newPhoto]);
      };
      reader.readAsDataURL(resizedImage);
    } catch (error) {
      console.error('写真の追加に失敗しました:', error);
      alert('写真の追加に失敗しました');
    }
  };

  const handleRemovePhoto = (photoId: string) => {
    setEditedPhotos(prev => prev.filter(p => p.id !== photoId));
  };

  // DataURL→File変換
  function dataURLtoFile(dataurl: string, filename: string): File {
    const arr = dataurl.split(',');
    const match = arr[0].match(/:(.*?);/);
    const mime = match ? match[1] : 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  }

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
              グループ詳細
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
        {/* Title */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">タイトル</h2>
          {isEditing ? (
            <input
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ) : (
            <p className="text-gray-900">{group.title}</p>
          )}
        </div>

        {/* Photos */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">写真</h2>
            {isEditing && (
              <div className="flex gap-2">
                <label className="p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer">
                  <Camera className="h-5 w-5 text-gray-500" />
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => e.target.files?.[0] && handleAddPhoto(e.target.files[0])}
                    className="hidden"
                  />
                </label>
                <label className="p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer">
                  <Upload className="h-5 w-5 text-gray-500" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => e.target.files?.[0] && handleAddPhoto(e.target.files[0])}
                    className="hidden"
                  />
                </label>
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {editedPhotos.map((photo) => (
              <div key={photo.id} className="relative">
                <img
                  src={photo.image}
                  alt=""
                  className="w-full h-24 object-cover rounded"
                />
                {isEditing && (
                  <button
                    onClick={() => handleRemovePhoto(photo.id)}
                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Tags */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">タグ</h2>
          <div className="flex flex-wrap gap-2">
            {availableTags.map(tag => (
              <TagChip
                key={tag.name}
                tag={tag.name}
                selected={isEditing ? editedTags.includes(tag.name) : group.tags.includes(tag.name)}
                onClick={isEditing ? () => handleTagToggle(tag.name) : undefined}
                style={{
                  backgroundColor: tag.color + '22',
                  color: tag.color,
                  cursor: isEditing ? 'pointer' : 'default'
                }}
              />
            ))}
          </div>
        </div>

        {/* Memo */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">メモ</h2>
          {isEditing ? (
            <textarea
              value={editedMemo}
              onChange={(e) => setEditedMemo(e.target.value)}
              className="w-full h-32 p-3 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ) : (
            <div className="whitespace-pre-wrap text-gray-900">
              {group.memo}
            </div>
          )}
        </div>

        {/* Date Info */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">日時情報</h2>
          <p className="text-gray-600">作成日時: {formatDate(group.createdAt)}</p>
          {group.updatedAt.getTime() !== group.createdAt.getTime() && (
            <p className="text-gray-600 mt-1">最終更新: {formatDate(group.updatedAt)}</p>
          )}
        </div>
      </div>
    </div>
  );
}; 