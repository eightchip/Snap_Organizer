export const resizeImage = (
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality: number = 0.8
): Promise<File> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      // 元のアスペクト比を維持しながら、より小さいサイズにリサイズ
      let { width, height } = img;
      
      // 長辺を基準にスケールを計算
      const maxSize = Math.max(width, height);
      const targetSize = Math.min(maxWidth, maxHeight);
      const scale = targetSize / maxSize;
      
      if (scale < 1) {
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      // さらに、面積が大きすぎる場合は追加で縮小
      const maxArea = 480000; // 800x600相当
      const area = width * height;
      if (area > maxArea) {
        const areaScale = Math.sqrt(maxArea / area);
        width = Math.round(width * areaScale);
        height = Math.round(height * areaScale);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;

      // 画質改善のための設定
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // 描画
      ctx.drawImage(img, 0, 0, width, height);

      // JPEG形式で圧縮
      canvas.toBlob(
        (blob) => {
          if (blob) {
            // ファイル名に最適化済みであることを示す接尾辞を追加
            const optimizedName = file.name.replace(
              /(\.[^.]+)?$/,
              '_optimized.jpg'
            );
            resolve(new File([blob], optimizedName, { type: 'image/jpeg' }));
          }
        },
        'image/jpeg',
        quality
      );
    };
    img.src = URL.createObjectURL(file);
  });
}; 