import Tesseract from 'tesseract.js';

// 画像を幅600pxにリサイズ＋グレースケール＋大津の方法で二値化
export const preprocessImageOtsu600 = (imageDataUrl: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const maxWidth = 600;
      const scale = Math.min(1, maxWidth / img.width);
      const width = Math.round(img.width * scale);
      const height = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      const imageData = ctx.getImageData(0, 0, width, height);
      // グレースケール
      for (let i = 0; i < imageData.data.length; i += 4) {
        const avg = (imageData.data[i] + imageData.data[i+1] + imageData.data[i+2]) / 3;
        imageData.data[i] = imageData.data[i+1] = imageData.data[i+2] = avg;
      }
      // 大津の方法
      const threshold = otsuThreshold(imageData.data);
      for (let i = 0; i < imageData.data.length; i += 4) {
        const value = imageData.data[i] > threshold ? 255 : 0;
        imageData.data[i] = imageData.data[i+1] = imageData.data[i+2] = value;
      }
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL());
    };
    img.src = imageDataUrl;
  });
};

function otsuThreshold(gray: Uint8ClampedArray) {
  let hist = new Array(256).fill(0);
  for (let i = 0; i < gray.length; i += 4) hist[gray[i]]++;
  let total = gray.length / 4;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0, wB = 0, wF = 0, varMax = 0, threshold = 0;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    let mB = sumB / wB;
    let mF = (sum - sumB) / wF;
    let varBetween = wB * wF * (mB - mF) * (mB - mF);
    if (varBetween > varMax) {
      varMax = varBetween;
      threshold = t;
    }
  }
  return threshold;
}

// Tesseract.js OCR（20秒タイムアウト）
export const runTesseractOcr = async (file: File, timeoutMs = 20000): Promise<string> => {
  const imageDataUrl = await imageToDataURL(file);
  const preprocessed = await preprocessImageOtsu600(imageDataUrl);
  const ocrPromise = Tesseract.recognize(
    preprocessed,
    'jpn',
    {
      logger: m => console.log(m),
      // @ts-ignore
      params: { tessedit_pageseg_mode: '6' },
    }
  ).then(res => res.data.text);
  const timeoutPromise = new Promise<string>((_, reject) =>
    setTimeout(() => reject(new Error('OCRタイムアウト')), timeoutMs)
  );
  return Promise.race([ocrPromise, timeoutPromise]);
};

// Google Cloud Vision OCR
export const runGoogleCloudOcr = async (file: File): Promise<string> => {
  try {
    const base64 = await fileToBase64(file);
    const apiKey = await getGoogleCloudApiKey();

    if (!apiKey) {
      throw new Error('Google Cloud Vision APIキーが設定されていません');
    }

    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [
            {
              image: { content: base64.split(',')[1] },
              features: [{ type: 'TEXT_DETECTION' }]
            }
          ]
        })
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Google Cloud Vision API error: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return data.responses?.[0]?.fullTextAnnotation?.text || '';
  } catch (error) {
    console.error('Google Cloud Vision OCR error:', error);
    throw error;
  }
};

// APIキーを取得（Tauriの設定から）
const getGoogleCloudApiKey = async (): Promise<string | null> => {
  try {
    // TODO: Tauriの設定からAPIキーを取得する実装
    // 一時的に環境変数から取得
    return (import.meta.env as ImportMetaEnv).VITE_GOOGLE_CLOUD_VISION_API_KEY || null;
  } catch (error) {
    console.error('Failed to get Google Cloud API key:', error);
    return null;
  }
};

// ファイルをBase64に変換
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const imageToDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};