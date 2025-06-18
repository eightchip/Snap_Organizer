import init, { resize_image, preprocess_image_for_ocr } from '../../your-wasm-pkg/pkg';

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
      throw new Error('Failed to initialize image processing');
    }
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  const timeoutPromise = new Promise<T>((_, reject) => {
    setTimeout(() => reject(new Error('Image processing timed out')), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]);
}

function validateImage(base64Image: string) {
  if (!base64Image.startsWith('data:image/')) {
    throw new Error('Invalid image format: Must be a data URL');
  }

  const sizeInBytes = Math.ceil((base64Image.length * 3) / 4);
  if (sizeInBytes > MAX_IMAGE_SIZE) {
    throw new Error(`Image too large: Maximum size is ${MAX_IMAGE_SIZE / (1024 * 1024)}MB`);
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
    validateImage(base64Image);
    await initializeWasm();

    console.log(`Resizing image to ${maxWidth}x${maxHeight} with quality ${quality}`);
    const result = await withTimeout(
      Promise.resolve(resize_image(base64Image, maxWidth, maxHeight, quality * 100)),
      PROCESSING_TIMEOUT
    );

    console.log('Image resize completed successfully');
    return result;
  } catch (error) {
    console.error('Image resize error:', error);
    if (error instanceof Error) {
      if (error.message.includes('timed out')) {
        throw new Error('画像処理がタイムアウトしました。画像サイズを小さくしてみてください。');
      } else if (error.message.includes('too large')) {
        throw new Error('画像サイズが大きすぎます。10MB以下の画像を使用してください。');
      }
      throw new Error('画像の処理に失敗しました: ' + error.message);
    }
    throw new Error('画像の処理に失敗しました');
  }
}

export async function preprocessImageForOcr(base64Image: string): Promise<string> {
  console.log('Starting OCR preprocessing...');
  try {
    validateImage(base64Image);
    await initializeWasm();

    console.log('Processing image for OCR...');
    const result = await withTimeout(
      Promise.resolve(preprocess_image_for_ocr(base64Image)),
      PROCESSING_TIMEOUT
    );

    console.log('OCR preprocessing completed successfully');
    return result;
  } catch (error) {
    console.error('Image preprocessing error:', error);
    if (error instanceof Error) {
      if (error.message.includes('timed out')) {
        throw new Error('OCR前処理がタイムアウトしました。画像サイズを小さくしてみてください。');
      } else if (error.message.includes('too large')) {
        throw new Error('画像サイズが大きすぎます。10MB以下の画像を使用してください。');
      }
      throw new Error('OCR前処理に失敗しました: ' + error.message);
    }
    throw new Error('OCR前処理に失敗しました');
  }
} 