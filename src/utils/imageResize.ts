// WASMファイルの条件付きインポート
let wasmModule: any = null;
let wasmInitialized = false;

// WASMモジュールの動的インポート
async function loadWasmModule() {
  if (!wasmModule) {
    try {
      // ブラウザ環境でのみWASMを読み込みテスト
      if (typeof window !== 'undefined') {
        const module = await import('../pkg/your_wasm_pkg');
        console.log('WASM module:', module);
        wasmModule = module;
      }
    } catch (error) {
      console.warn('WASM module not available, falling back to canvas processing:', error);
      wasmModule = null;
    }
  }
  return wasmModule;
}

const PROCESSING_TIMEOUT = 30000; // 30秒タイムアウト

async function initializeWasm() {
  if (!wasmInitialized) {
    try {
      const module = await loadWasmModule();
      if (module && module.default) {
        await module.default();
        wasmInitialized = true;
        console.log('WebAssembly initialized successfully');
      } else {
        console.warn('WASM module not available, using canvas processing only');
      }
    } catch (error) {
      console.error('Failed to initialize WebAssembly:', error);
      console.warn('Falling back to canvas processing only');
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

// Base64文字列をUint8Arrayに変換する関数
function base64ToUint8Array(base64: string): Uint8Array {
  // Base64データURLからBase64文字列を抽出
  const base64String = base64.split(',')[1];
  // Base64をデコード
  const binaryString = atob(base64String);
  // Uint8Arrayに変換
  const array = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    array[i] = binaryString.charCodeAt(i);
  }
  return array;
}

// Uint8ArrayをBase64文字列に変換する関数
function uint8ArrayToBase64(array: Uint8Array): string {
  // Uint8ArrayをBase64に変換
  let binary = '';
  for (let i = 0; i < array.length; i++) {
    binary += String.fromCharCode(array[i]);
  }
  const base64String = btoa(binary);
  // データURLとして返す
  return `data:image/jpeg;base64,${base64String}`;
}

// HTMLCanvasElementを使用して画像をリサイズする関数
async function resizeImageWithCanvas(base64Image: string, maxWidth: number, maxHeight: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // 新しいサイズを計算
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      // キャンバスを作成
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      // 画像を描画
      ctx.drawImage(img, 0, 0, width, height);

      // JPEG形式で出力
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      if (!dataUrl.startsWith('data:image/jpeg;base64,')) {
        reject(new Error('画像データの生成に失敗しました（JPEG形式で出力できませんでした）'));
        return;
      }
      resolve(dataUrl);
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = base64Image;
  });
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

    // まずCanvasでリサイズ
    console.log(`Resizing image to ${maxWidth}x${maxHeight} with quality ${quality}`);
    const resizedBase64 = await resizeImageWithCanvas(validatedImage, maxWidth, maxHeight, quality);

    // WASMが利用可能な場合のみカラー処理を適用
    const module = await loadWasmModule();
    if (module && module.preprocess_image_color) {
      console.log('Applying color processing with WASM...');
      const imageData = base64ToUint8Array(resizedBase64);
      const processedData = await withTimeout(
        Promise.resolve(module.preprocess_image_color(imageData)),
        PROCESSING_TIMEOUT
      );

      if (!processedData) {
        throw new Error('画像の処理に失敗しました');
      }

      const resultBase64 = uint8ArrayToBase64(processedData);
      console.log('Image resize completed successfully with WASM');
      return resultBase64;
    } else {
      console.log('WASM not available, using canvas processing only');
      return resizedBase64;
    }
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

    console.log('Converting base64 to Uint8Array...');
    const imageData = base64ToUint8Array(validatedImage);

    // WASMが利用可能な場合のみOCR前処理を適用
    const module = await loadWasmModule();
    if (module && module.preprocess_image) {
      console.log('Processing image for OCR with WASM...');
      const result = await withTimeout(
        Promise.resolve(module.preprocess_image(imageData)),
        PROCESSING_TIMEOUT
      );

      if (!result) {
        throw new Error('OCR前処理に失敗しました');
      }

      console.log('Converting result back to base64...');
      const resultBase64 = uint8ArrayToBase64(result);

      console.log('OCR preprocessing completed successfully with WASM');
      return resultBase64;
    } else {
      console.log('WASM not available, returning original image');
      return validatedImage;
    }
  } catch (error) {
    console.error('Image preprocessing error:', error);
    if (error instanceof Error) {
      throw new Error('OCR前処理に失敗しました: ' + error.message);
    }
    throw new Error('OCR前処理に失敗しました');
  }
}

export const adjustImageOrientation = (file: File): Promise<string> => {
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

// 画像が文字画像か写真かを自動判定する関数
export async function isTextImage(base64Image: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(false);
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      // 色数をカウント
      const colorSet = new Set();
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i+1], b = data[i+2];
        colorSet.add(`${r>>4}_${g>>4}_${b>>4}`); // 16階調で近似
      }
      const colorCount = colorSet.size;
      // エッジ量（簡易: 輝度差が大きいピクセル数）
      let edgeCount = 0;
      for (let y = 1; y < canvas.height; y++) {
        for (let x = 1; x < canvas.width; x++) {
          const idx = (y * canvas.width + x) * 4;
          const idxL = (y * canvas.width + (x-1)) * 4;
          const idxT = ((y-1) * canvas.width + x) * 4;
          const lum = 0.299*data[idx]+0.587*data[idx+1]+0.114*data[idx+2];
          const lumL = 0.299*data[idxL]+0.587*data[idxL+1]+0.114*data[idxL+2];
          const lumT = 0.299*data[idxT]+0.587*data[idxT+1]+0.114*data[idxT+2];
          if (Math.abs(lum - lumL) > 40 || Math.abs(lum - lumT) > 40) edgeCount++;
        }
      }
      // 判定基準: 色数が少なく、エッジが多い→文字画像
      const totalPixels = canvas.width * canvas.height;
      const edgeRatio = edgeCount / totalPixels;
      // 色数32以下、かつエッジ比率3%以上なら文字画像とみなす
      if (colorCount <= 32 && edgeRatio > 0.03) {
        resolve(true);
      } else {
        resolve(false);
      }
    };
    img.onerror = () => resolve(false);
    img.src = base64Image;
  });
}

// 複数画像を一括でリサイズ・品質調整する関数
export async function batchResizeImages(
  base64Images: string[],
  qualities: number[],
  maxWidth: number = 1000,
  maxHeight: number = 1000
): Promise<string[]> {
  const module = await loadWasmModule();
  if (!module || !module.batch_resize_images) {
    throw new Error('WASM batch_resize_images未実装');
  }
  // base64→Uint8Array配列
  const imageArrays = base64Images.map(base64ToUint8Array);
  // JS配列→js_sys::Array
  // WASM呼び出し
  const result = module.batch_resize_images(imageArrays, qualities, maxWidth, maxHeight);
  // 結果: Uint8Array[]
  // それぞれbase64に変換
  const resizedBase64s: string[] = [];
  for (let i = 0; i < result.length; i++) {
    const arr = result[i];
    // Uint8Array→base64
    let binary = '';
    for (let j = 0; j < arr.length; j++) {
      binary += String.fromCharCode(arr[j]);
    }
    const b64 = btoa(binary);
    resizedBase64s.push(`data:image/jpeg;base64,${b64}`);
  }
  return resizedBase64s;
} 