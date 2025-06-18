import React, { useState, useEffect } from 'react';
import { PostalItemGroup, PhotoItem } from '../../types';
import { TagChip } from '../TagChip';
import { ArrowLeft, Edit3, Check, X, Trash2, Plus, Camera, Upload, Share2, RotateCw, RotateCcw } from 'lucide-react';
import { imageToDataURL } from '../../utils/ocr';
import { resizeImage } from '../../utils/imageResize';
import { generateId } from '../../utils/storage';
import { loadImageBlob, saveImageBlob } from '../../utils/imageDB';
import { shareGroup } from '../../utils/share';

interface DetailGroupScreenProps {
  group: PostalItemGroup;
  onBack: () => void;
  onUpdate: (updates: Partial<PostalItemGroup>) => void;
  onDelete: () => void;
}

// PhotoItemにrotationを持たせる
interface PhotoItemWithRotation extends PhotoItem {
  rotation?: number; // 0, 90, 180, 270
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
  const [editedPhotos, setEditedPhotos] = useState<PhotoItemWithRotation[]>(group.photos);
  const [isSharing, setIsSharing] = useState(false);
  const [availableTags, setAvailableTags] = useState(() => {
    const saved = localStorage.getItem('postal_tags');
    return saved ? JSON.parse(saved) : [];
  });
  const [imageUrlMap, setImageUrlMap] = useState<Record<string, string>>({});
  const [rotatedImageUrlMap, setRotatedImageUrlMap] = useState<Record<string, string>>({});

  // タグリストを更新
  useEffect(() => {
    const saved = localStorage.getItem('postal_tags');
    if (saved) {
      setAvailableTags(JSON.parse(saved));
    }
  }, [isEditing]);

  useEffect(() => {
    (async () => {
      const map: Record<string, string> = {};
      for (const photo of editedPhotos) {
        let base64 = photo.image;
        // base64でなければBlobからbase64化
        if (!base64.startsWith('data:') && !base64.startsWith('blob:')) {
          const blob = await loadImageBlob(photo.image);
          if (blob) {
            base64 = await blobToBase64(blob);
          } else {
            map[photo.id] = '';
            continue;
          }
        } else if (base64.startsWith('blob:')) {
          const blob = await fetch(base64).then(r => r.blob());
          base64 = await blobToBase64(blob);
        }
        // 回転
        if (photo.rotation && photo.rotation % 360 !== 0) {
          base64 = await applyRotationToBase64(base64, photo.rotation);
        }
        map[photo.id] = base64;
      }
      setRotatedImageUrlMap(map);
    })();
  }, [editedPhotos]);

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

  // 画像回転用関数
  const rotatePhoto = (photoId: string, direction: 'left' | 'right') => {
    setEditedPhotos(prev => prev.map(photo => {
      if (photo.id !== photoId) return photo;
      let newRotation = (photo.rotation || 0) + (direction === 'right' ? 90 : -90);
      newRotation = ((newRotation % 360) + 360) % 360; // 0,90,180,270
      return { ...photo, rotation: newRotation };
    }));
  };

  // 画像回転をcanvasで適用する関数
  const applyRotationToBase64 = async (base64: string, rotation: number): Promise<string> => {
    if (!rotation || rotation % 360 === 0) return base64;
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject('No ctx');
        if (rotation % 180 === 0) {
          canvas.width = img.width;
          canvas.height = img.height;
        } else {
          canvas.width = img.height;
          canvas.height = img.width;
        }
        ctx.save();
        switch (rotation) {
          case 90:
            ctx.translate(canvas.width, 0);
            ctx.rotate(Math.PI / 2);
            break;
          case 180:
            ctx.translate(canvas.width, canvas.height);
            ctx.rotate(Math.PI);
            break;
          case 270:
            ctx.translate(0, canvas.height);
            ctx.rotate(-Math.PI / 2);
            break;
        }
        ctx.drawImage(img, 0, 0);
        ctx.restore();
        resolve(canvas.toDataURL('image/jpeg'));
      };
      img.onerror = reject;
      img.src = base64;
    });
  };

  // Utility function
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // 保存時に回転を反映
  const handleSave = async () => {
    const processedPhotos: PhotoItem[] = [];
    for (const photo of editedPhotos) {
      const base64 = rotatedImageUrlMap[photo.id] || photo.image;
      const response = await fetch(base64);
      const rotatedBlob = await response.blob();
      await saveImageBlob(photo.id, rotatedBlob);
      const { rotation, ...photoWithoutRotation } = photo;
      processedPhotos.push(photoWithoutRotation);
    }
    onUpdate({
      title: editedTitle,
      memo: editedMemo,
      tags: editedTags,
      photos: processedPhotos,
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
      const resizedImage = await resizeImage(imageDataURL, 1000, 1000);
      const blob = await (await fetch(resizedImage)).blob();
      const reader = new FileReader();
      reader.onload = () => {
        const newPhoto: PhotoItem = {
          id: generateId(),
          image: reader.result as string,
          ocrText: '',
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: [],
          memo: '',
          metadata: {
            filename: file.name,
            source: 'bulk',
          },
        };
        setEditedPhotos(prev => [...prev, newPhoto]);
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error('写真の追加に失敗しました:', error);
      alert('写真の追加に失敗しました');
    }
  };

  const handleRemovePhoto = (photoId: string) => {
    setEditedPhotos(prev => prev.filter(p => p.id !== photoId));
  };

  const handleShare = async () => {
    setIsSharing(true);
    try {
      const success = await shareGroup(group);
      if (!success) {
        alert('共有に失敗しました。');
      }
    } catch (error) {
      console.error('共有エラー:', error);
      alert('共有中にエラーが発生しました。');
    } finally {
      setIsSharing(false);
    }
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
                    onClick={handleShare}
                    disabled={isSharing}
                    className={`p-2 rounded-lg transition-colors ${
                      isSharing ? 'bg-gray-100 cursor-not-allowed' : 'hover:bg-blue-100'
                    }`}
                  >
                    <Share2 className={`h-5 w-5 ${isSharing ? 'text-gray-400' : 'text-blue-500'}`} />
                  </button>
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
              <div key={photo.id} className="relative group">
                <img
                  src={rotatedImageUrlMap[photo.id] || ''}
                  alt="プレビュー"
                  className="w-full h-24 object-contain rounded"
                />
                {isEditing && (
                  <>
                    <div className="absolute bottom-1 left-1 flex gap-1 opacity-80 group-hover:opacity-100">
                      <button
                        type="button"
                        className="p-1 bg-gray-200 rounded-full hover:bg-gray-300"
                        onClick={() => rotatePhoto(photo.id, 'left')}
                      >
                        <RotateCcw className="h-4 w-4 text-gray-700" />
                      </button>
                      <button
                        type="button"
                        className="p-1 bg-gray-200 rounded-full hover:bg-gray-300"
                        onClick={() => rotatePhoto(photo.id, 'right')}
                      >
                        <RotateCw className="h-4 w-4 text-gray-700" />
                      </button>
                    </div>
                    <button
                      onClick={() => handleRemovePhoto(photo.id)}
                      className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </>
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