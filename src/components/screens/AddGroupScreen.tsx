import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, ArrowLeft, Check, X, Info } from 'lucide-react';
import { TagChip } from '../TagChip';
import { PhotoItem, PostalItemGroup, PhotoMetadata } from '../../types';
import { imageToDataURL } from '../../utils/ocr';
import { resizeImage } from '../../utils/imageResize';
import { generateId } from '../../utils/storage';
import EXIF from 'exif-js';
import { saveImageBlob, loadImageBlob } from '../../utils/imageDB';

// 開発環境でのみErudaを読み込む
if (process.env.NODE_ENV === 'development') {
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/eruda';
  document.body.appendChild(script);
  script.onload = () => {
    (window as any).eruda.init();
  };
}

// エラーログを表示する関数
const showErrorLogs = () => {
  try {
    const logs = JSON.parse(localStorage.getItem('error_logs') || '[]');
    if (logs.length === 0) {
      alert('エラーログはありません');
      return;
    }
    
    const logText = logs.map((log: any) => 
      `[${log.timestamp}]\n` +
      `Context: ${log.context}\n` +
      `Error: ${log.error}\n` +
      `Platform: ${log.platform}\n` +
      `Browser: ${log.userAgent}\n` +
      (log.stack ? `Stack: ${log.stack}\n` : '') +
      '-------------------'
    ).join('\n');
    
    alert(logText);
  } catch (e) {
    console.error('Error showing error logs:', e);
  }
};

// Base64変換用ユーティリティ関数
function uint8ToBase64(u8arr: Uint8Array): string {
  let CHUNK_SIZE = 0x8000; // 32KB
  let index = 0;
  let length = u8arr.length;
  let result = '';
  let slice;
  while (index < length) {
    slice = u8arr.subarray(index, Math.min(index + CHUNK_SIZE, length));
    result += String.fromCharCode.apply(null, slice);
    index += CHUNK_SIZE;
  }
  return btoa(result);
}

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
  const [isProcessing, setIsProcessing] = useState(false);
  const [wasmReady, setWasmReady] = useState(false);
  const [errorLogs, setErrorLogs] = useState<any[]>([]);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [tags, setTags] = useState(() => {
    const saved = localStorage.getItem('postal_tags');
    return saved ? JSON.parse(saved) : [];
  });
  const [imageUrlMap, setImageUrlMap] = useState<Record<string, string>>({});

  // エラーログを保存する関数
  const saveErrorLog = (error: any, context: string) => {
    try {
      const errorLog = {
        timestamp: new Date().toISOString(),
        context,
        error: error?.message || String(error),
        stack: error?.stack,
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
      };

      // 既存のログを取得
      const existingLogs = JSON.parse(localStorage.getItem('error_logs') || '[]');
      // 新しいログを追加（最大100件まで保持）
      const updatedLogs = [errorLog, ...existingLogs].slice(0, 100);
      localStorage.setItem('error_logs', JSON.stringify(updatedLogs));
      // 状態も更新
      setErrorLogs(updatedLogs);
    } catch (e) {
      console.error('Error saving error log:', e);
    }
  };

  useEffect(() => {
    import('../../pkg/your_wasm_pkg')
      .then(() => {
        console.log('WASM initialized successfully');
        setWasmReady(true);
      })
      .catch(error => {
        console.error('WASM initialization failed:', error);
        setSaveError('システムの初期化に失敗しました。ページを再読み込みしてください。');
      });
  }, []);

  // 画像リサイズ（JPEG 70%品質、最大300x300pxでフォールバック用も用意）
  async function resizeImageToBase64(file: File): Promise<string> {
    return await new Promise<string>((resolve) => {
      const img = new window.Image();
      img.onload = function() {
        let { width, height } = img;
        const scale = Math.min(300 / width, 300 / height, 1);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.5)); // 画質50%
      };
      img.src = URL.createObjectURL(file);
    });
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setIsProcessing(true);
    setSaveError(null);

    try {
      const files = Array.from(event.target.files || []);
      if (files.length === 0) return;

      const processedPhotos: PhotoItem[] = [];
      for (const file of files) {
        if (!file.type.startsWith('image/')) continue;
        if (file.size > 1024 * 1024 * 5) { // 5MB超はスキップ
          alert('画像サイズが大きすぎます');
          continue;
        }

        // 1. 画像リサイズ（JPEG 50%品質、最大300x300pxでフォールバック用も用意）
        const fallbackResizedDataURL = await resizeImageToBase64(file);

        // 2. WASMカラー圧縮（失敗時はリサイズ画像でフォールバック）
        let finalDataURL = fallbackResizedDataURL;
        try {
          const base64 = fallbackResizedDataURL.split(',')[1];
          const imageBuffer = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
          // 動的importでpreprocess_image_colorを呼び出す
          const wasm = await import('../../pkg/your_wasm_pkg');
          const processed = await (wasm as any).preprocess_image_color(imageBuffer);
          const processedBase64 = uint8ToBase64(processed);
          finalDataURL = 'data:image/jpeg;base64,' + processedBase64;
        } catch (wasmError) {
          console.warn('WASM color processing failed, fallback to resized image:', wasmError);
        }

        const metadata: PhotoMetadata = { dateTime: new Date().toISOString() };
        const imageId = generateId();
        await saveImageBlob(imageId, file); // fileまたはリサイズ後Blob
        processedPhotos.push({
          id: generateId(),
          image: imageId, // 画像IDを保存
          ocrText: '',
          createdAt: new Date(metadata.dateTime ?? Date.now()),
          metadata
        });
      }
      if (processedPhotos.length > 0) setPhotos(prev => [...prev, ...processedPhotos]);
    } catch (error) {
      alert('画像処理中にエラーが発生しました');
      console.error(error);
    } finally {
      setIsProcessing(false);
      if (event.target) event.target.value = '';
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
        setSaveError(null); // 成功時にエラーを消す
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

  // エラーメッセージの自動消去
  useEffect(() => {
    if (saveError) {
      const timer = setTimeout(() => setSaveError(null), 2000);
      return () => clearTimeout(timer);
    }
    // アンマウント時にエラーをクリア
    return () => setSaveError(null);
  }, [saveError]);

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

  useEffect(() => {
    (async () => {
      const map: Record<string, string> = {};
      for (const photo of photos) {
        if (photo.image && !imageUrlMap[photo.image]) {
          const blob = await loadImageBlob(photo.image);
          if (blob) map[photo.image] = URL.createObjectURL(blob);
        }
      }
      setImageUrlMap(map);
    })();
  }, [photos]);

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

      {/* エラーログ表示ボタン */}
      <button
        onClick={() => {
          const logs = JSON.parse(localStorage.getItem('error_logs') || '[]');
          if (logs.length === 0) {
            alert('エラーログはありません');
            return;
          }
          const logText = logs.map((log: any) => 
            `[${new Date(log.timestamp).toLocaleString()}]\n` +
            `Context: ${log.context}\n` +
            `Error: ${log.error}\n` +
            `Platform: ${log.platform}\n` +
            `Browser: ${log.userAgent}\n` +
            (log.stack ? `Stack: ${log.stack}\n` : '') +
            '-------------------'
          ).join('\n');
          alert(logText);
        }}
        className="fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg z-50"
      >
        エラーログ確認
      </button>

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
              disabled={isProcessing || !wasmReady}
              className={`w-full flex items-center justify-center gap-3 py-4 border-2 border-dashed rounded-lg transition-colors
                ${isProcessing || !wasmReady 
                  ? 'border-gray-200 bg-gray-50 cursor-not-allowed' 
                  : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'}`}
            >
              <Upload className={`h-6 w-6 ${isProcessing || !wasmReady ? 'text-gray-300' : 'text-gray-400'}`} />
              <span className={isProcessing || !wasmReady ? 'text-gray-400' : 'text-gray-600'}>
                {isProcessing ? '処理中...' : 'ギャラリーから選択（複数可）'}
              </span>
            </button>
            
            <button
              onClick={() => cameraInputRef.current?.click()}
              disabled={isProcessing || !wasmReady}
              className={`w-full flex items-center justify-center gap-3 py-4 border-2 border-dashed rounded-lg transition-colors
                ${isProcessing || !wasmReady 
                  ? 'border-gray-200 bg-gray-50 cursor-not-allowed' 
                  : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'}`}
            >
              <Camera className={`h-6 w-6 ${isProcessing || !wasmReady ? 'text-gray-300' : 'text-gray-400'}`} />
              <span className={isProcessing || !wasmReady ? 'text-gray-400' : 'text-gray-600'}>
                {isProcessing ? '処理中...' : 'カメラで撮影'}
              </span>
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            disabled={isProcessing || !wasmReady}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
            disabled={isProcessing || !wasmReady}
          />

          {!wasmReady && (
            <p className="mt-2 text-sm text-yellow-600 bg-yellow-50 p-2 rounded">
              システムの初期化中です。しばらくお待ちください...
            </p>
          )}

          {saveError && (
            <p className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
              {saveError}
            </p>
          )}

          {/* Photo Preview with Metadata */}
          {photos.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              {photos.map((photo) => (
                <div key={photo.id} className="relative">
                  <img
                    src={imageUrlMap[photo.image] || ''}
                    alt="プレビュー"
                    className="w-full h-40 object-contain rounded"
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

      {/* エラーログ表示 */}
      {errorLogs.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50">
          <button
            onClick={() => setShowErrorDetails(!showErrorDetails)}
            className="bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg"
          >
            エラー ({errorLogs.length})
          </button>
          
          {showErrorDetails && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg p-4 max-w-lg w-full max-h-[80vh] overflow-auto">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold">エラーログ</h3>
                  <button
                    onClick={() => setShowErrorDetails(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="space-y-4">
                  {errorLogs.map((log, index) => (
                    <div key={index} className="border-b pb-2">
                      <p className="text-sm text-gray-500">{new Date(log.timestamp).toLocaleString()}</p>
                      <p className="font-medium">{log.context}</p>
                      <p className="text-red-600">{log.error}</p>
                      {log.stack && (
                        <pre className="text-xs bg-gray-100 p-2 mt-1 overflow-x-auto">
                          {log.stack}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}; 