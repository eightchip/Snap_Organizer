import React, { useState, useRef } from 'react';
import { Camera, Upload, ArrowLeft, Check, X } from 'lucide-react';
import { TagChip } from '../TagChip';
import { PhotoItem, PostalItemGroup } from '../../types';
import { imageToDataURL } from '../../utils/ocr';
import { resizeImage } from '../../utils/imageResize';
import { generateId } from '../../utils/storage';

interface AddGroupScreenProps {
  onSave: (group: PostalItemGroup) => void;
  onBack: () => void;
}

export const AddGroupScreen: React.FC<AddGroupScreenProps> = ({ onSave, onBack }) => {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [title, setTitle] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [memo, setMemo] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tags, setTags] = useState(() => {
    const saved = localStorage.getItem('postal_tags');
    return saved ? JSON.parse(saved) : [];
  });

  const processImage = async (file: File): Promise<string> => {
    // まず小さいサイズ（400x400）で試す
    let resizedImage = await resizeImage(file, 400, 400, 0.6);
    let imageDataURL = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(resizedImage);
    });

    // サイズチェック（500KB以上なら、さらに圧縮）
    if (imageDataURL.length > 500 * 1024) {
      resizedImage = await resizeImage(file, 300, 300, 0.5);
      imageDataURL = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(resizedImage);
      });
    }

    return imageDataURL;
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    // ファイル数の制限
    if (files.length > 20) {
      alert('一度に追加できる写真は20枚までです');
      return;
    }

    setSaveError(null);
    const newPhotos: PhotoItem[] = [];
    
    try {
      for (const file of files) {
        // ファイルタイプチェック
        if (!file.type.startsWith('image/')) {
          throw new Error(`${file.name} は画像ファイルではありません`);
        }

        const imageDataURL = await processImage(file);
        
        // 1枚あたりのサイズ制限（1MB）
        if (imageDataURL.length > 1024 * 1024) {
          throw new Error(`${file.name} のサイズが大きすぎます。より小さい画像を選択してください。`);
        }

        newPhotos.push({
          id: generateId(),
          image: imageDataURL,
          ocrText: '',
          createdAt: new Date()
        });
      }

      // 合計サイズチェック（10MB）
      const totalSize = newPhotos.reduce((sum, photo) => sum + photo.image.length, 0);
      if (totalSize > 10 * 1024 * 1024) {
        throw new Error('写真の合計サイズが大きすぎます。より少ない枚数を選択してください。');
      }

      setPhotos([...photos, ...newPhotos]);
    } catch (error: any) {
      console.error('Error processing images:', error);
      setSaveError(error.message || 'ファイルの処理中にエラーが発生しました');
    }
  };

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const handleSave = async () => {
    if (photos.length === 0) {
      setSaveError('少なくとも1枚の写真が必要です');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      // 保存前に最終チェック
      const totalSize = photos.reduce((sum, photo) => sum + photo.image.length, 0);
      if (totalSize > 10 * 1024 * 1024) {
        throw new Error('データサイズが大きすぎます。写真の枚数を減らすか、一部の写真を削除してください。');
      }

      const group: PostalItemGroup = {
        id: generateId(),
        title: title || `写真グループ ${new Date().toLocaleDateString()}`,
        photos,
        tags: selectedTags,
        memo,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // 保存を試みる
      try {
        onSave(group);
      } catch (e) {
        throw new Error('保存に失敗しました。写真のサイズを小さくするか、枚数を減らしてください。');
      }
    } catch (error: any) {
      console.error('Save error:', error);
      setSaveError(error.message || '保存中にエラーが発生しました');
    } finally {
      setIsSaving(false);
    }
  };

  const removePhoto = (photoId: string) => {
    setPhotos(photos.filter(p => p.id !== photoId));
  };

  return (
    <div className="min-h-screen max-h-screen overflow-auto bg-gray-50">
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
              写真グループを作成
            </h1>
            <button
              onClick={handleSave}
              disabled={photos.length === 0 || isSaving}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all 
                ${photos.length === 0 || isSaving ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}
            >
              <Check className="h-4 w-4" />
              保存
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Title Input */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="グループタイトル（任意）"
            className="w-full p-2 border border-gray-200 rounded-lg"
          />
        </div>

        {/* Photo Upload */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">写真を追加</h2>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-3 py-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors"
          >
            <Upload className="h-6 w-6 text-gray-400" />
            <span className="text-gray-600">写真を選択（複数可）</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Photo Preview */}
          {photos.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              {photos.map((photo) => (
                <div key={photo.id} className="relative">
                  <img
                    src={photo.image}
                    alt="プレビュー"
                    className="w-full h-40 object-cover rounded"
                  />
                  <button
                    onClick={() => removePhoto(photo.id)}
                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tags */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">タグ</h2>
          <div className="flex flex-wrap gap-2">
            {tags.map(tag => (
              <TagChip
                key={tag.name}
                tag={tag.name}
                selected={selectedTags.includes(tag.name)}
                onClick={() => handleTagToggle(tag.name)}
                style={{ backgroundColor: tag.color + '22', color: tag.color }}
              />
            ))}
          </div>
        </div>

        {/* Memo */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">メモ</h2>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            className="w-full h-24 p-3 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="グループのメモを入力..."
          />
        </div>
      </div>

      {/* エラーメッセージ表示 */}
      {saveError && (
        <div className="fixed top-16 left-0 right-0 mx-auto max-w-md bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded z-50">
          <p>{saveError}</p>
        </div>
      )}

      {/* 保存中インジケータ */}
      {isSaving && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-lg">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600">保存中...</p>
          </div>
        </div>
      )}
    </div>
  );
}; 