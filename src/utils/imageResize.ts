import init, { resize_image, preprocess_image_for_ocr } from '../../your-wasm-pkg/pkg';

declare module '../../your-wasm-pkg/pkg' {
  export function resize_image(base64_image: string, max_width: number, max_height: number, quality: number): Promise<string>;
  export function preprocess_image_for_ocr(base64_image: string): Promise<string>;
  export default function init(): Promise<void>;
}

let wasmInitialized = false;
const PROCESSING_TIMEOUT = 30000; // 30秒タイムアウト

async function initializeWasm() {
  if (!wasmInitialized) {
    await init();
    wasmInitialized = true;
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  const timeoutPromise = new Promise<T>((_, reject) => {
    setTimeout(() => reject(new Error('Image processing timed out')), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]);
}

export async function resizeImage(
  base64Image: string,
  maxWidth: number = 800,
  maxHeight: number = 800,
  quality: number = 0.8
): Promise<string> {
  try {
    await initializeWasm();
    return await withTimeout(
      Promise.resolve(resize_image(base64Image, maxWidth, maxHeight, quality * 100)),
      PROCESSING_TIMEOUT
    );
  } catch (error) {
    console.error('Image resize error:', error);
    throw new Error('Failed to resize image: ' + (error as Error).message);
  }
}

export async function preprocessImageForOcr(base64Image: string): Promise<string> {
  try {
    await initializeWasm();
    return await withTimeout(
      Promise.resolve(preprocess_image_for_ocr(base64Image)),
      PROCESSING_TIMEOUT
    );
  } catch (error) {
    console.error('Image preprocessing error:', error);
    throw new Error('Failed to preprocess image: ' + (error as Error).message);
  }
} 