import init, { resize_image, preprocess_image_for_ocr } from '../../your-wasm-pkg/pkg/your_wasm_pkg';

let wasmInitialized = false;

const initializeWasm = async () => {
  if (!wasmInitialized) {
    await init();
    wasmInitialized = true;
  }
};

export const resizeImage = async (
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality: number = 0.8
): Promise<Blob> => {
  await initializeWasm();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const base64Image = e.target?.result as string;
        const resizedBase64 = await resize_image(base64Image, maxWidth, maxHeight, quality * 100);
        
        // Base64からBlobに変換
        const byteString = atob(resizedBase64.split(',')[1]);
        const mimeString = resizedBase64.split(',')[0].split(':')[1].split(';')[0];
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        
        resolve(new Blob([ab], { type: mimeString }));
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

export const preprocessImageForOcr = async (file: File): Promise<Blob> => {
  await initializeWasm();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const base64Image = e.target?.result as string;
        const processedBase64 = await preprocess_image_for_ocr(base64Image);
        
        // Base64からBlobに変換
        const byteString = atob(processedBase64.split(',')[1]);
        const mimeString = processedBase64.split(',')[0].split(':')[1].split(';')[0];
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        
        resolve(new Blob([ab], { type: mimeString }));
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}; 