import init, { resize_image, preprocess_image_for_ocr } from '../../your-wasm-pkg/pkg';
import EXIF from 'exif-js';

declare module '../../your-wasm-pkg/pkg' {
  export function resize_image(base64_image: string, max_width: number, max_height: number, quality: number): Promise<string>;
  export function preprocess_image_for_ocr(base64_image: string): Promise<string>;
  export default function init(): Promise<void>;
}

let wasmInitialized = false;
const PROCESSING_TIMEOUT = 30000; // 30秒タイムアウト
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

async function initializeWasm() {
  if (!wasmInitialized) {
    try {
      await init();
      wasmInitialized = true;
      console.log('WebAssembly initialized successfully');
    } catch (error) {
      console.error('Failed to initialize WebAssembly:', error);
      throw new Error('画像処理の初期化に失敗しました');
    }
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  const timeoutPromise = new Promise<T>((_, reject) => {
    setTimeout(() => reject(new Error('画像処理がタイムアウトしました')), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]);
}

function validateImage(base64Image: string | null | undefined): string {
  if (!base64Image) {
    throw new Error('画像データが見つかりません');
  }

  // データがBase64形式かどうかをチェック
  try {
    if (base64Image.includes('base64,')) {
      return base64Image;
    }

    // データURLでない場合は、Base64データとして扱い、データURLに変換
    return `data:image/jpeg;base64,${base64Image}`;
  } catch (error) {
    console.error('Image validation error:', error);
    throw new Error('画像データの形式が正しくありません');
  }
}

export async function resizeImage(
  base64Image: string,
  maxWidth: number = 800,
  maxHeight: number = 800,
  quality: number = 0.8
): Promise<string> {
  console.log('Starting image resize...');
  try {
    const validatedImage = validateImage(base64Image);
    await initializeWasm();

    console.log(`Resizing image to ${maxWidth}x${maxHeight} with quality ${quality}`);
    const result = await withTimeout(
      Promise.resolve(resize_image(validatedImage, maxWidth, maxHeight, quality * 100)),
      PROCESSING_TIMEOUT
    );

    if (!result) {
      throw new Error('画像のリサイズに失敗しました');
    }

    console.log('Image resize completed successfully');
    return result;
  } catch (error) {
    console.error('Image resize error:', error);
    if (error instanceof Error) {
      throw new Error('画像の処理に失敗しました: ' + error.message);
    }
    throw new Error('画像の処理に失敗しました');
  }
}

export async function preprocessImageForOcr(base64Image: string): Promise<string> {
  console.log('Starting OCR preprocessing...');
  try {
    const validatedImage = validateImage(base64Image);
    await initializeWasm();

    console.log('Processing image for OCR...');
    const result = await withTimeout(
      Promise.resolve(preprocess_image_for_ocr(validatedImage)),
      PROCESSING_TIMEOUT
    );

    if (!result) {
      throw new Error('OCR前処理に失敗しました');
    }

    console.log('OCR preprocessing completed successfully');
    return result;
  } catch (error) {
    console.error('Image preprocessing error:', error);
    if (error instanceof Error) {
      throw new Error('OCR前処理に失敗しました: ' + error.message);
    }
    throw new Error('OCR前処理に失敗しました');
  }
}

const adjustImageOrientation = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function(e) {
      resolve(e.target?.result as string);
    };
    reader.onerror = function() {
      reject(new Error('Failed to read file for orientation adjustment'));
    };
    reader.readAsDataURL(file);
  });
};

// Fileを受け取って自動で向き補正→リサイズする関数
export async function resizeImageWithOrientation(
  file: File,
  maxWidth: number = 800,
  maxHeight: number = 800,
  quality: number = 0.8
): Promise<string> {
  const orientedBase64 = await adjustImageOrientation(file);
  return resizeImage(orientedBase64, maxWidth, maxHeight, quality);
} 