import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Loader2, ArrowLeft, Check, Mic, MicOff, X, Info } from 'lucide-react';
import { TagChip } from '../TagChip';
import { PhotoItem, PostalItemGroup, PhotoMetadata } from '../../types';
import { imageToDataURL, runTesseractOcr, runGoogleCloudOcr } from '../../utils/ocr';
import { normalizeOcrText } from '../../utils/normalizeOcrText';
import { resizeImage } from '../../utils/imageResize';
import { saveImageBlob, loadImageBlob } from '../../utils/imageDB';
import { generateId } from '../../utils/storage';
import init, { preprocess_image_color } from '../../pkg/your_wasm_pkg';

interface UnifiedAddScreenProps {
  onSave: (data: PhotoItem | PostalItemGroup) => void;
  onBack: () => void;
}

export const UnifiedAddScreen: React.FC<UnifiedAddScreenProps> = ({ onSave, onBack }) => {
  // State for both single and multiple photos
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [title, setTitle] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [memo, setMemo] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [wasmReady, setWasmReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showSaved, setShowSaved] = useState(false);
  const [useCloudOcr, setUseCloudOcr] = useState(false);
  const [imageUrlMap, setImageUrlMap] = useState<Record<string, string>>({});

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Tags
  const [tags, setTags] = useState(() => {
    const saved = localStorage.getItem('postal_tags');
    return saved ? JSON.parse(saved) : [
      { name: '仕事', color: '#3B82F6' },
      { name: '趣味', color: '#22C55E' },
      { name: '旅行', color: '#A78BFA' },
      { name: '郵便物', color: '#F59E42' },
    ];
  });

  // Initialize WASM
  useEffect(() => {
    init().then(() => setWasmReady(true)).catch(console.error);
  }, []);

  // Load image URLs
  useEffect(() => {
    (async () => {
      const map: Record<string, string> = {};
      for (const photo of photos) {
        if (photo.image && !imageUrlMap[photo.image]) {
          const blob = await loadImageBlob(photo.image);
          if (blob) map[photo.image] = URL.createObjectURL(blob);
        }
      }
      setImageUrlMap(prev => ({ ...prev, ...map }));
    })();
  }, [photos]);

  // Handle file selection
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!wasmReady) {
      alert('WASMの初期化中です。少し待ってから再度お試しください。');
      return;
    }

    setIsProcessing(true);
    setSaveError(null);

    try {
      const files = Array.from(event.target.files || []);
      if (files.length === 0) return;

      const processedPhotos: PhotoItem[] = [];
      for (const file of files) {
        if (!file.type.startsWith('image/')) continue;
        if (file.size > 1024 * 1024 * 5) { // 5MB limit
          alert('画像サイズが大きすぎます');
          continue;
        }

        const imageId = generateId();
        await saveImageBlob(imageId, file);

        const metadata: PhotoMetadata = { dateTime: new Date().toISOString() };
        processedPhotos.push({
          id: generateId(),
          image: imageId,
          ocrText: '',
          createdAt: new Date(metadata.dateTime ?? Date.now()),
          metadata
        });
      }

      setPhotos(prev => [...prev, ...processedPhotos]);
    } catch (error) {
      console.error('Error processing images:', error);
      setSaveError('画像の処理中にエラーが発生しました');
    } finally {
      setIsProcessing(false);
      if (event.target) event.target.value = '';
    }
  };

  // Handle OCR
  const handleOcr = async (photoId: string) => {
    const photo = photos.find(p => p.id === photoId);
    if (!photo) return;

    setIsProcessing(true);
    setSaveError(null);

    try {
      const blob = await loadImageBlob(photo.image);
      if (!blob) throw new Error('画像の読み込みに失敗しました');

      let extractedText = '';
      if (useCloudOcr) {
        const base64 = await blobToBase64(blob);
        const res = await fetch('/api/vision-ocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64.split(',')[1] }),
        });

        if (!res.ok) {
          throw new Error('Google Cloud Vision APIでの処理に失敗しました');
        }

        const { text } = await res.json();
        extractedText = text;
      } else {
        // Convert Blob to File for Tesseract OCR
        const file = new File([blob], 'image.jpg', { type: blob.type });
        extractedText = await runTesseractOcr(file);
      }

      setPhotos(prev => prev.map(p => 
        p.id === photoId 
          ? { ...p, ocrText: normalizeOcrText(extractedText) }
          : p
      ));
    } catch (error) {
      console.error('OCR error:', error);
      setSaveError(`OCR処理中にエラーが発生しました: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle save
  const handleSave = async () => {
    if (photos.length === 0) {
      setSaveError('少なくとも1枚の写真が必要です');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      if (photos.length === 1) {
        // Single photo mode
        const photo = photos[0];
        onSave({
          ...photo,
          tags: selectedTags,
          memo,
          updatedAt: new Date()
        });
      } else {
        // Group mode
        const group: PostalItemGroup = {
          id: generateId(),
          title: title || `写真グループ ${new Date().toLocaleDateString()}`,
          photos,
          tags: selectedTags,
          memo,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        onSave(group);
      }

      setShowSaved(true);
      setTimeout(() => {
        setShowSaved(false);
        setIsSaving(false);
      }, 2000);
    } catch (error) {
      console.error('Save error:', error);
      setSaveError('保存中にエラーが発生しました');
      setIsSaving(false);
    }
  };

  // Utility functions
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const removePhoto = (photoId: string) => {
    setPhotos(photos.filter(p => p.id !== photoId));
  };

  return (
    <div className="min-h-screen max-h-screen overflow-auto bg-gray-50">
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
              {photos.length === 1 ? '新しいアイテム' : '写真グループを作成'}
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
        {/* Title Input (Only for group mode) */}
        {photos.length > 1 && (
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="グループタイトル（任意）"
              className="w-full p-2 border border-gray-200 rounded-lg"
            />
          </div>
        )}

        {/* Photo Upload */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">写真を追加</h2>
          
          {/* OCR toggle (Only for single photo) */}
          {photos.length === 1 && (
            <div className="flex items-center gap-4 mb-4">
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={useCloudOcr}
                  onChange={e => setUseCloudOcr(e.target.checked)}
                />
                Google Cloud Visionで認識する（有料）
              </label>
            </div>
          )}

          {!photos.length && (
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
          )}

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

          {/* Photo Preview */}
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
                  {photos.length === 1 && !photo.ocrText && (
                    <button
                      onClick={() => handleOcr(photo.id)}
                      disabled={isProcessing}
                      className="absolute bottom-1 right-1 px-2 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 disabled:bg-gray-400"
                    >
                      OCR実行
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {photos.length > 0 && (
            <button
              onClick={() => {
                setPhotos([]);
                setTitle('');
                setMemo('');
              }}
              className="mt-4 text-sm text-blue-500 hover:text-blue-600"
            >
              別の画像を選択
            </button>
          )}
        </div>

        {/* OCR Results (Only for single photo) */}
        {photos.length === 1 && photos[0].ocrText && (
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-semibold text-gray-900">
                抽出されたテキスト
              </h2>
              <button
                className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                onClick={() => {
                  const textarea = document.getElementById('ocr-textarea');
                  if (textarea) (textarea as HTMLTextAreaElement).select();
                }}
              >
                全選択
              </button>
            </div>
            <textarea
              id="ocr-textarea"
              value={photos[0].ocrText}
              onChange={(e) => setPhotos(prev => [{...prev[0], ocrText: e.target.value}])}
              className="w-full h-32 p-3 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="OCRで抽出されたテキストが表示されます"
            />
          </div>
        )}

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
            placeholder="メモを入力..."
          />
        </div>
      </div>

      {/* Status Messages */}
      {showSaved && (
        <div className="fixed top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-[9999] text-lg font-bold animate-bounce">
          保存しました
        </div>
      )}
      
      {saveError && (
        <div className="fixed top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg z-[9999] text-lg font-bold">
          {saveError}
        </div>
      )}

      {isProcessing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-lg">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600">処理中...</p>
          </div>
        </div>
      )}
    </div>
  );
}; 