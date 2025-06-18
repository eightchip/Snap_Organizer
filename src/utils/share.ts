import { PhotoItem, PostalItemGroup } from '../types';
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

const createShareableText = (item: PhotoItem): string => {
  const lines: string[] = [];
  if (item.tags.length > 0) {
    lines.push(`タグ: ${item.tags.join(', ')}`);
  }
  if (item.memo) {
    lines.push(`メモ: ${item.memo}`);
  }
  if (item.ocrText) {
    lines.push(`OCRテキスト: ${item.ocrText}`);
  }
  return lines.join('\n');
};

const createGroupShareableText = (group: PostalItemGroup): string => {
  const lines: string[] = [];
  lines.push(`グループ: ${group.title}`);
  if (group.tags.length > 0) {
    lines.push(`タグ: ${group.tags.join(', ')}`);
  }
  if (group.memo) {
    lines.push(`メモ: ${group.memo}`);
  }
  return lines.join('\n');
};

/**
 * 単一アイテムの共有
 */
export const shareItem = async (item: PhotoItem): Promise<boolean> => {
  try {
    const shareData = {
      title: '郵便物スナップ',
      text: createShareableText(item),
      files: [
        new File([await fetch(item.image).then(r => r.blob())], 'postal-snap.jpg', {
          type: 'image/jpeg',
        }),
      ],
    };

    if (navigator.canShare && navigator.canShare(shareData)) {
      await navigator.share(shareData);
      return true;
    } else {
      console.warn('Web Share API is not supported');
      return false;
    }
  } catch (error) {
    console.error('Error sharing:', error);
    return false;
  }
};

/**
 * グループの共有
 */
export const shareGroup = async (group: PostalItemGroup): Promise<boolean> => {
  try {
    const shareData = {
      title: '郵便物スナップ - グループ',
      text: createGroupShareableText(group),
      files: await Promise.all(
        group.photos.map(async (photo) => {
          const blob = await fetch(photo.image).then(r => r.blob());
          return new File([blob], `postal-snap-${photo.id}.jpg`, {
            type: 'image/jpeg',
          });
        })
      ),
    };

    if (navigator.canShare && navigator.canShare(shareData)) {
      await navigator.share(shareData);
      return true;
    } else {
      console.warn('Web Share API is not supported');
      return false;
    }
  } catch (error) {
    console.error('Error sharing group:', error);
    return false;
  }
}; 