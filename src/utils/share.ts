import { PostalItem, PostalItemGroup } from '../types';
import { loadImageBlob } from './imageDB';
import JSZip from 'jszip';

/**
 * Web Share APIのサポート状況をチェック
 */
export const isWebShareSupported = () => {
  return navigator.share !== undefined && navigator.canShare !== undefined;
};

/**
 * 画像をBlobからFileに変換
 */
const blobToFile = (blob: Blob, fileName: string): File => {
  return new File([blob], fileName, { type: blob.type });
};

/**
 * 単一アイテムの共有
 */
export const shareItem = async (item: PostalItem): Promise<boolean> => {
  try {
    const blob = await loadImageBlob(item.image);
    if (!blob) {
      throw new Error('画像の読み込みに失敗しました');
    }

    const file = blobToFile(blob, `postal_snap_${item.id}.jpg`);
    const text = [item.ocrText, item.memo].filter(Boolean).join('\n\n');
    const shareData = {
      title: item.tags.length > 0 ? `[${item.tags.join(', ')}] PostalSnap` : 'PostalSnap',
      text,
      files: [file]
    };

    if (isWebShareSupported() && navigator.canShare(shareData)) {
      await navigator.share(shareData);
      return true;
    } else {
      // フォールバック: ダウンロードとメール共有
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = `postal_snap_${item.id}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // メール共有用のリンクを開く
      const mailtoLink = `mailto:?subject=${encodeURIComponent(shareData.title)}&body=${encodeURIComponent(text)}`;
      window.open(mailtoLink);
      return true;
    }
  } catch (error) {
    console.error('共有に失敗しました:', error);
    return false;
  }
};

/**
 * グループの共有
 */
export const shareGroup = async (group: PostalItemGroup): Promise<boolean> => {
  try {
    const files: File[] = [];
    for (const photo of group.photos) {
      const blob = await loadImageBlob(photo.image);
      if (blob) {
        files.push(blobToFile(blob, `postal_snap_${photo.id}.jpg`));
      }
    }

    if (files.length === 0) {
      throw new Error('共有可能な画像がありません');
    }

    const text = [
      ...group.photos.map(p => p.ocrText).filter(Boolean),
      group.memo
    ].filter(Boolean).join('\n\n');

    const shareData = {
      title: group.title || (group.tags.length > 0 ? `[${group.tags.join(', ')}] PostalSnap` : 'PostalSnap'),
      text,
      files
    };

    if (isWebShareSupported() && navigator.canShare(shareData)) {
      await navigator.share(shareData);
      return true;
    } else {
      // フォールバック: ZIP作成とダウンロード
      const zip = new JSZip();
      files.forEach((file, index) => {
        zip.file(`postal_snap_${index + 1}.jpg`, file);
      });
      
      // メタデータをJSONとして追加
      const metadata = {
        title: group.title,
        tags: group.tags,
        memo: group.memo,
        photos: group.photos.map(p => ({
          id: p.id,
          ocrText: p.ocrText,
          metadata: p.metadata
        }))
      };
      zip.file('metadata.json', JSON.stringify(metadata, null, 2));

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `postal_snap_group_${group.id}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // メール共有用のリンクを開く
      const mailtoLink = `mailto:?subject=${encodeURIComponent(shareData.title)}&body=${encodeURIComponent(text)}`;
      window.open(mailtoLink);
      return true;
    }
  } catch (error) {
    console.error('共有に失敗しました:', error);
    return false;
  }
}; 