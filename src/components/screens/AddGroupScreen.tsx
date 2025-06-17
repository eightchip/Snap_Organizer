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
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [tags, setTags] = useState(() => {
    const saved = localStorage.getItem('postal_tags');
    return saved ? JSON.parse(saved) : [];
  });

  const processImage = async (file: File): Promise<{ dataUrl: string; metadata: PhotoMetadata }> => {
    console.log('Starting image processing for:', file.name);
    
    try {
      // まず基本的な画像の読み込みを試みる
      const imageDataURL = await imageToDataURL(file);
      console.log('Basic image conversion complete');

      // 画像のリサイズ処理
      const resizedImage = await resizeImage(file, 800, 800, 0.8);
      console.log('Image resize complete. New size:', resizedImage.size);

      // リサイズした画像をDataURLに変換
      const resizedDataURL = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (e) => {
          console.error('FileReader error:', e);
          reject(new Error('画像の読み込みに失敗しました'));
        };
        reader.readAsDataURL(resizedImage);
      });

      console.log('Resized image conversion complete');

      // EXIFデータの読み取り
      const metadata: PhotoMetadata = await new Promise((resolve) => {
        EXIF.getData(file as any, function(this: any) {
          const exifData = EXIF.getAllTags(this);
          const metadata: PhotoMetadata = {};

          try {
            if (exifData) {
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

          resolve(metadata);
        });
      });

      console.log('EXIF data extraction complete');

      return {
        dataUrl: resizedDataURL,
        metadata
      };
    } catch (error) {
      console.error('Image processing error:', error);
      throw new Error('画像の処理中にエラーが発生しました: ' + (error as Error).message);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('File selection triggered'); // 基本的なトリガー確認
    
    try {
      const files = Array.from(event.target.files || []);
      console.log('Files selected:', files.length); // ファイル数の確認
      
      if (files.length === 0) {
        console.log('No files selected');
        return;
      }

      if (files.length > 20) {
        alert('一度に追加できる写真は20枚までです');
        return;
      }

      setSaveError(null);
      const newPhotos: PhotoItem[] = [];
      
      console.log('Processing files:', files.map(f => ({
        name: f.name,
        type: f.type,
        size: f.size,
        lastModified: new Date(f.lastModified).toISOString()
      }))); // より詳細なファイル情報

      for (const file of files) {
        try {
          if (!file.type.startsWith('image/')) {
            throw new Error(`${file.name} は画像ファイルではありません (type: ${file.type})`);
          }

          console.log(`Processing file: ${file.name} (${file.size} bytes)`);
          
          const { dataUrl: imageDataURL, metadata } = await processImage(file);
          console.log('Image processing complete:', {
            fileName: file.name,
            originalSize: file.size,
            processedSize: imageDataURL.length,
            hasMetadata: !!metadata,
            metadataKeys: metadata ? Object.keys(metadata) : []
          });

          if (imageDataURL.length > 2 * 1024 * 1024) {
            console.warn(`Large image warning: ${file.name} (${imageDataURL.length} bytes)`);
          }

          // メタデータから撮影日時を取得、なければファイルの最終更新日時を使用
          const photoDate = metadata.dateTime 
            ? new Date(metadata.dateTime.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3'))
            : file.lastModified 
              ? new Date(file.lastModified) 
              : new Date();

          const newPhoto: PhotoItem = {
            id: generateId(),
            image: imageDataURL,
            ocrText: '',
            createdAt: photoDate,
            metadata
          };

          newPhotos.push(newPhoto);
          console.log(`Successfully added photo: ${newPhoto.id}`);

        } catch (fileError: any) {
          console.error(`Error processing file ${file.name}:`, fileError);
          setSaveError(`${file.name}の処理中にエラーが発生しました: ${fileError.message}`);
          return; // 1つのファイルでもエラーが発生したら処理を中止
        }
      }

      const totalSize = newPhotos.reduce((sum, photo) => sum + photo.image.length, 0);
      console.log('Total size of processed photos:', totalSize);

      if (totalSize > 10 * 1024 * 1024) {
        throw new Error('写真の合計サイズが大きすぎます。より少ない枚数を選択してください。');
      }

      setPhotos(prevPhotos => {
        const updatedPhotos = [...prevPhotos, ...newPhotos];
        console.log('Updated photos array:', updatedPhotos.length);
        return updatedPhotos;
      });

    } catch (error: any) {
      console.error('File selection error:', error);
      setSaveError(error.message || 'ファイルの処理中にエラーが発生しました');
    }

    // 入力をリセット（同じファイルを再度選択できるように）
    if (event.target) {
      event.target.value = '';
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
    console.log('Showing metadata for photo:', { 
      id: photo.id, 
      hasMetadata: !!photo.metadata,
      metadata: photo.metadata 
    }); // デバッグ用

    if (!photo.metadata) {
      console.log('No metadata available for photo:', photo.id); // デバッグ用
      alert('この写真にはメタデータが含まれていません');
      return;
    }

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
          <div className="space-y-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-3 py-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors"
            >
              <Upload className="h-6 w-6 text-gray-400" />
              <span className="text-gray-600">ギャラリーから選択（複数可）</span>
            </button>
            
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-3 py-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors"
            >
              <Camera className="h-6 w-6 text-gray-400" />
              <span className="text-gray-600">カメラで撮影</span>
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
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