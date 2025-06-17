import React, { useState, useRef } from 'react';
import { Camera, Upload, ArrowLeft, Check, X, Info } from 'lucide-react';
import { TagChip } from '../TagChip';
import { PhotoItem, PostalItemGroup, PhotoMetadata } from '../../types';
import { imageToDataURL } from '../../utils/ocr';
import { resizeImage } from '../../utils/imageResize';
import { generateId } from '../../utils/storage';
import EXIF from 'exif-js';

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

  const processImage = async (file: File): Promise<{ dataUrl: string; metadata: PhotoMetadata }> => {
    // EXIFデータの読み取り
    const metadata: PhotoMetadata = await new Promise((resolve) => {
      EXIF.getData(file as any, function(this: any) {
        const exifData = EXIF.getAllTags(this);
        const metadata: PhotoMetadata = {};

        try {
          if (exifData) {
            console.log('EXIF data found:', exifData); // デバッグ用

            // 撮影日時
            if (exifData.DateTime) {
              metadata.dateTime = exifData.DateTime;
            }

            // GPS情報
            if (exifData.GPSLatitude && exifData.GPSLongitude) {
              const convertDMSToDD = (dms: number[], dir: string) => {
                const degrees = dms[0];
                const minutes = dms[1];
                const seconds = dms[2];
                let dd = degrees + minutes/60 + seconds/3600;
                if (dir === 'S' || dir === 'W') dd = -dd;
                return dd;
              };
              
              try {
                metadata.gpsLatitude = convertDMSToDD(
                  exifData.GPSLatitude,
                  exifData.GPSLatitudeRef
                );
                metadata.gpsLongitude = convertDMSToDD(
                  exifData.GPSLongitude,
                  exifData.GPSLongitudeRef
                );
              } catch (e) {
                console.error('GPS conversion error:', e);
              }
            }

            // カメラ情報
            if (exifData.Make) metadata.make = exifData.Make;
            if (exifData.Model) metadata.model = exifData.Model;
            
            // 画像の向き
            if (exifData.Orientation) metadata.orientation = exifData.Orientation;
          }
        } catch (e) {
          console.error('EXIF parsing error:', e);
        }

        console.log('Processed metadata:', metadata); // デバッグ用
        resolve(metadata);
      });
    });

    // 画像のリサイズ処理
    try {
      let resizedImage = await resizeImage(file, 800, 800, 0.8); // サイズと品質を調整
      let imageDataURL = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(resizedImage);
      });

      // サイズが大きすぎる場合は更に圧縮
      if (imageDataURL.length > 1024 * 1024) {
        resizedImage = await resizeImage(file, 600, 600, 0.7);
        imageDataURL = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(resizedImage);
        });
      }

      return { dataUrl: imageDataURL, metadata };
    } catch (e) {
      console.error('Image resize error:', e);
      throw e;
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    if (files.length > 20) {
      alert('一度に追加できる写真は20枚までです');
      return;
    }

    setSaveError(null);
    const newPhotos: PhotoItem[] = [];
    
    try {
      for (const file of files) {
        if (!file.type.startsWith('image/')) {
          throw new Error(`${file.name} は画像ファイルではありません`);
        }

        const { dataUrl: imageDataURL, metadata } = await processImage(file);
        
        if (imageDataURL.length > 1024 * 1024) {
          throw new Error(`${file.name} のサイズが大きすぎます。より小さい画像を選択してください。`);
        }

        // メタデータから撮影日時を取得、なければファイルの最終更新日時を使用
        const photoDate = metadata.dateTime 
          ? new Date(metadata.dateTime.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3'))
          : file.lastModified 
            ? new Date(file.lastModified) 
            : new Date();

        newPhotos.push({
          id: generateId(),
          image: imageDataURL,
          ocrText: '',
          createdAt: photoDate,
          metadata
        });
      }

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

  // メタデータ表示用のモーダル
  const [selectedPhotoMetadata, setSelectedPhotoMetadata] = useState<{
    metadata: PhotoMetadata;
    image: string;
  } | null>(null);

  const showMetadataModal = (photo: PhotoItem) => {
    if (!photo.metadata) return;
    setSelectedPhotoMetadata({
      metadata: photo.metadata,
      image: photo.image
    });
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

          {/* Photo Preview with Metadata */}
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
                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => showMetadataModal(photo)}
                    className="absolute top-1 left-1 p-1.5 bg-white bg-opacity-75 text-gray-700 rounded-full hover:bg-opacity-100"
                  >
                    <Info className="h-4 w-4" />
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

      {/* メタデータ表示モーダル */}
      {selectedPhotoMetadata && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">写真の情報</h3>
                <button
                  onClick={() => setSelectedPhotoMetadata(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <img
                src={selectedPhotoMetadata.image}
                alt="選択された写真"
                className="w-full h-48 object-contain mb-4 rounded"
              />

              <div className="space-y-2 text-sm">
                {selectedPhotoMetadata.metadata.dateTime && (
                  <p>
                    <span className="font-medium">撮影日時：</span>
                    {new Date(selectedPhotoMetadata.metadata.dateTime.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3')).toLocaleString()}
                  </p>
                )}
                {selectedPhotoMetadata.metadata.make && selectedPhotoMetadata.metadata.model && (
                  <p>
                    <span className="font-medium">カメラ：</span>
                    {selectedPhotoMetadata.metadata.make} {selectedPhotoMetadata.metadata.model}
                  </p>
                )}
                {selectedPhotoMetadata.metadata.gpsLatitude && selectedPhotoMetadata.metadata.gpsLongitude && (
                  <p>
                    <span className="font-medium">位置情報：</span>
                    <a
                      href={`https://www.google.com/maps?q=${selectedPhotoMetadata.metadata.gpsLatitude},${selectedPhotoMetadata.metadata.gpsLongitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-600"
                    >
                      地図で見る
                    </a>
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 