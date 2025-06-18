import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Loader2, ArrowLeft, Check, Mic, MicOff, X, Info, RotateCw, RotateCcw } from 'lucide-react';
import { TagChip } from '../TagChip';
import { PhotoItem, PostalItemGroup, PhotoMetadata, Location } from '../../types';
import { imageToDataURL, runTesseractOcr, runGoogleCloudOcr } from '../../utils/ocr';
import { normalizeOcrText } from '../../utils/normalizeOcrText';
import { resizeImage, resizeImageWithOrientation } from '../../utils/imageResize';
import { saveImageBlob, loadImageBlob } from '../../utils/imageDB';
import { generateId } from '../../utils/storage';
import init, { preprocess_image_color } from '../../pkg/your_wasm_pkg';
import EXIF from 'exif-js';

interface UnifiedAddScreenProps {
  onSave: (data: PhotoItem | PostalItemGroup) => void;
  onBack: () => void;
}

type OcrMode = 'disabled' | 'tesseract' | 'google-cloud';

// PhotoItemにrotationを持たせる
interface PhotoItemWithRotation extends PhotoItem {
  rotation?: number; // 0, 90, 180, 270
}

export const UnifiedAddScreen: React.FC<UnifiedAddScreenProps> = ({ onSave, onBack }) => {
  // State for both single and multiple photos
  const [photos, setPhotos] = useState<PhotoItemWithRotation[]>([]);
  const [title, setTitle] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [memo, setMemo] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [wasmReady, setWasmReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showSaved, setShowSaved] = useState(false);
  const [ocrMode, setOcrMode] = useState<OcrMode>('disabled');
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

  // 画像回転用関数
  const rotatePhoto = (photoId: string, direction: 'left' | 'right') => {
    setPhotos(prev => prev.map(photo => {
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

  // Handle file selection
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.length) return;
    setIsProcessing(true);
    setSaveError(null);
    try {
      const newPhotos: PhotoItemWithRotation[] = [];
      for (const file of Array.from(event.target.files)) {
        try {
          // Generate unique ID
          const id = generateId();
          console.log(`Processing image: ${file.name}, size: ${file.size} bytes`);
          // 向き補正＋リサイズ
          const resizedBase64 = await resizeImageWithOrientation(file);
          console.log('Image resized (with orientation) successfully');
          // Base64からBlobに変換
          const response = await fetch(resizedBase64);
          if (!response.ok) throw new Error('Failed to create blob from resized image');
          const resizedBlob = await response.blob();
          console.log(`Resized blob created, size: ${resizedBlob.size} bytes`);
          await saveImageBlob(id, resizedBlob);
          console.log('Image blob saved successfully');
          // Extract metadata
          const metadata: PhotoMetadata = {
            filename: file.name,
            source: photos.length === 0 ? 'single' : 'bulk',
            dateTaken: await extractDateTaken(file),
            location: await extractLocation(file),
          };
          // Create photo item
          const photo: PhotoItemWithRotation = {
            id,
            image: id,
            ocrText: '',
            createdAt: new Date(),
            updatedAt: new Date(),
            metadata,
            tags: [],
            memo: '',
            rotation: 0,
          };
          newPhotos.push(photo);
          console.log(`Photo item created successfully: ${id}`);
        } catch (error) {
          console.error('Image processing error:', error);
          throw new Error(`画像「${file.name}」の処理に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
        }
      }
      if (newPhotos.length > 0) {
        setPhotos(prev => [...prev, ...newPhotos]);
        console.log(`${newPhotos.length} photos processed successfully`);
      } else {
        throw new Error('写真の処理に失敗しました');
      }
    } catch (error) {
      console.error('File processing error:', error);
      setSaveError(error instanceof Error ? error.message : '写真の処理中にエラーが発生しました');
    } finally {
      setIsProcessing(false);
      // Reset file input
      event.target.value = '';
    }
  };

  // Metadata extraction utilities
  const extractDateTaken = async (file: File): Promise<string | undefined> => {
    return new Promise((resolve) => {
      const exifCallback = function(this: any) {
        const exifDate = EXIF.getTag(this, 'DateTimeOriginal');
        if (exifDate) {
          // Convert EXIF date format to ISO string
          const [date, time] = exifDate.split(' ');
          const [year, month, day] = date.split(':');
          resolve(`${year}-${month}-${day}`);
        } else {
          resolve(undefined);
        }
      };
      EXIF.getData(file as any, exifCallback as any);
    });
  };

  const extractLocation = async (file: File): Promise<Location | undefined> => {
    return new Promise((resolve) => {
      const exifCallback = function(this: any) {
        const lat = EXIF.getTag(this, 'GPSLatitude');
        const lon = EXIF.getTag(this, 'GPSLongitude');
        const latRef = EXIF.getTag(this, 'GPSLatitudeRef');
        const lonRef = EXIF.getTag(this, 'GPSLongitudeRef');

        if (lat && lon && latRef && lonRef) {
          // Convert GPS coordinates to decimal
          const latitude = convertDMSToDD(lat, latRef);
          const longitude = convertDMSToDD(lon, lonRef);
          if (!isNaN(latitude) && !isNaN(longitude)) {
            resolve({ lat: latitude, lon: longitude });
          } else {
            resolve(undefined);
          }
        } else {
          resolve(undefined);
        }
      };
      EXIF.getData(file as any, exifCallback as any);
    });
  };

  const convertDMSToDD = (dms: number[], ref: string): number => {
    if (!dms || dms.length !== 3) return NaN;
    const degrees = dms[0];
    const minutes = dms[1];
    const seconds = dms[2];
    let dd = degrees + minutes / 60 + seconds / 3600;
    if (ref === 'S' || ref === 'W') dd = -dd;
    return dd;
  };

  // Handle OCR
  const handleOcr = async (photoId: string) => {
    const photo = photos.find(p => p.id === photoId);
    if (!photo) return;

    if (ocrMode === 'disabled') {
      setSaveError('OCRモードが選択されていません');
      return;
    }

    setIsProcessing(true);
    setSaveError(null);

    try {
      const blob = await loadImageBlob(photo.image);
      if (!blob) throw new Error('画像の読み込みに失敗しました');

      let extractedText = '';
      const file = new File([blob], 'image.jpg', { type: blob.type });

      if (ocrMode === 'google-cloud') {
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
      } else if (ocrMode === 'tesseract') {
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
      // 回転を反映した画像で保存
      const processedPhotos: PhotoItem[] = [];
      for (const photo of photos) {
        let base64 = await loadImageBlob(photo.image).then(blob => blobToBase64(blob!));
        if (photo.rotation && photo.rotation % 360 !== 0) {
          base64 = await applyRotationToBase64(base64, photo.rotation);
        }
        // 保存用blob生成
        const response = await fetch(base64);
        const rotatedBlob = await response.blob();
        await saveImageBlob(photo.id, rotatedBlob);
        // rotationを除外して保存
        const { rotation, ...photoWithoutRotation } = photo;
        processedPhotos.push(photoWithoutRotation);
      }
      if (processedPhotos.length === 1) {
        // Single photo mode
        const photo = processedPhotos[0];
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
          photos: processedPhotos,
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
          
          {/* OCR Settings (Only for single photo) */}
          {photos.length === 1 && (
            <div className="flex flex-col gap-2 mb-4">
              <div className="flex items-center gap-2">
                <select
                  value={ocrMode}
                  onChange={(e) => setOcrMode(e.target.value as OcrMode)}
                  className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="disabled">OCR無効</option>
                  <option value="tesseract">Tesseract OCR（無料）</option>
                  <option value="google-cloud">Google Cloud Vision（有料）</option>
                </select>
                {ocrMode !== 'disabled' && (
                  <button
                    onClick={() => handleOcr(photos[0].id)}
                    disabled={isProcessing}
                    className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    {isProcessing ? '処理中...' : 'OCR実行'}
                  </button>
                )}
              </div>
              {ocrMode !== 'disabled' && (
                <p className="text-sm text-gray-500">
                  {ocrMode === 'tesseract' 
                    ? '※ Tesseract OCRは無料ですが、精度が低い場合があります。'
                    : '※ Google Cloud Visionは有料ですが、高精度な認識が可能です。'}
                </p>
              )}
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
                <div key={photo.id} className="relative group">
                  <img
                    src={imageUrlMap[photo.image] || ''}
                    alt="プレビュー"
                    className="w-full h-40 object-contain rounded"
                    style={{ transform: `rotate(${photo.rotation || 0}deg)` }}
                  />
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