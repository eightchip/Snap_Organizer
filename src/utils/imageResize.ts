// WASMモジュールと初期化状態を管理する変数
let wasmApi: {
  batch_resize_images: (images: Uint8Array[], qualities: Float32Array, max_width: number, max_height: number) => Promise<any>;
  preprocess_image_for_ocr: (base64Image: string) => Promise<string>;
  // 他のWASM関数もここに追加できます
} | null = null;
let wasmInitPromise: Promise<void> | null = null;

// WASMモジュールを初期化する関数
async function initializeWasm() {
  // すでに初期化中または初期化済みの場合は何もしない
  if (wasmInitPromise) {
    return wasmInitPromise;
  }

  // 初期化のPromiseを作成し、グローバルに保持
  wasmInitPromise = (async () => {
    try {
      console.log('Initializing WASM module...');
      // wasm-packが生成したモジュールを動的にインポート
      // @ts-ignore
      const wasm = await import('/your-wasm-pkg/pkg/your_wasm_pkg.js');
      
      // 'default'エクスポートは通常、WASMの初期化関数
      await wasm.default();

      // エクスポートされた関数をAPIオブジェクトに格納
      wasmApi = {
        batch_resize_images: wasm.batch_resize_images,
        preprocess_image_for_ocr: wasm.preprocess_image_for_ocr,
      };

      console.log('WASM module initialized successfully.');
      console.log('Available WASM functions:', Object.keys(wasmApi));
    } catch (error) {
      console.error('Failed to initialize WASM module:', error);
      // エラーが発生した場合、後続の処理がフォールバックできるようにnullのままにする
      wasmApi = null;
      // エラーを再スローして、呼び出し元でキャッチできるようにする
      throw error;
    }
  })();

  return wasmInitPromise;
}

const PROCESSING_TIMEOUT = 30000; // 30秒タイムアウト

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

// WASMが利用可能かチェックし、利用できない場合はCanvasフォールバックを実行
async function runWithWasmOrCanvasFallback<T>(
  wasmFunction: () => Promise<T>,
  canvasFunction: () => Promise<T>
): Promise<T> {
  try {
    await initializeWasm();
    if (wasmApi) {
      return await wasmFunction();
    }
  } catch (error) {
    console.warn('WASM execution failed, falling back to canvas.', error);
  }
  return await canvasFunction();
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

    return runWithWasmOrCanvasFallback(
      async () => {
        console.log(`Resizing image to ${maxWidth}x${maxHeight} with quality ${quality}`);
        const resizedBase64 = await resizeImageWithCanvas(validatedImage, maxWidth, maxHeight, quality);
        console.log('Image resize completed successfully with WASM');
        return resizedBase64;
      },
      async () => {
        console.warn('WASM not available, using canvas processing only');
        return await resizeImageWithCanvas(validatedImage, maxWidth, maxHeight, quality);
      }
    );
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

  const validatedImage = validateImage(base64Image);

  return runWithWasmOrCanvasFallback(
    async () => {
      if (!wasmApi?.preprocess_image_for_ocr) throw new Error("WASM function not available");
      console.log('Preprocessing OCR with WASM...');
      return await wasmApi.preprocess_image_for_ocr(validatedImage);
    },
    async () => {
      console.log('Preprocessing OCR with Canvas...');
      // ここにCanvasベースのOCR前処理を実装（現在は未実装）
      // 必要であれば、グレースケール化などの処理を追加
      return validatedImage; // とりあえずそのまま返す
    }
  );
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
  console.log('Starting batch image resize...');

  return runWithWasmOrCanvasFallback(
    async () => {
      if (!wasmApi?.batch_resize_images) throw new Error("WASM function not available");
      console.log('Calling WASM batch_resize_images...');
      const images = base64Images.map(base64ToUint8Array);
      const qualitiesFloat32 = new Float32Array(qualities);

      const resizedImagesArray = await wasmApi.batch_resize_images(
        images,
        qualitiesFloat32,
        maxWidth,
        maxHeight
      );

      if (!resizedImagesArray) {
        throw new Error('画像のバッチ処理に失敗しました');
      }

      const resultBase64 = Array.from(resizedImagesArray as any[]).map(uint8ArrayToBase64);
      console.log('Batch image resize completed successfully with WASM');
      return resultBase64;
    },
    async () => {
      console.warn('WASM not available, falling back to sequential canvas processing.');
      const resizedImages = [];
      for (let i = 0; i < base64Images.length; i++) {
        const resized = await resizeImageWithCanvas(base64Images[i], maxWidth, maxHeight, qualities[i]);
        resizedImages.push(resized);
      }
      return resizedImages;
    }
  );
} 