import { PhotoItem, PostalItemGroup } from '../types';
import { loadImageBlob } from './imageDB';

/**
 * Web Share APIのサポート状況をチェック
 */
export const isWebShareSupported = () => {
  return navigator.share !== undefined && navigator.canShare !== undefined;
};

/**
 * 画像をBlobからFileに変換
 */
// const blobToFile = (blob: Blob, fileName: string): File => {
//   return new File([blob], fileName, { type: blob.type });
// };

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
  // 位置情報
  const loc = item.metadata?.location;
  if (loc && typeof loc.lat === 'number' && typeof loc.lon === 'number') {
    lines.push('---');
    lines.push('位置情報:');
    if (loc.name) lines.push(`地名: ${loc.name}`);
    lines.push(`緯度: ${loc.lat}`);
    lines.push(`経度: ${loc.lon}`);
    lines.push(`Googleマップ: https://maps.google.com/?q=${loc.lat},${loc.lon}`);
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
  // グループ全体の位置情報（metadata?.location）
  const loc = group.metadata?.location;
  if (loc && typeof loc.lat === 'number' && typeof loc.lon === 'number') {
    lines.push('---');
    lines.push('位置情報:');
    if (loc.name) lines.push(`地名: ${loc.name}`);
    lines.push(`緯度: ${loc.lat}`);
    lines.push(`経度: ${loc.lon}`);
    lines.push(`Googleマップ: https://maps.google.com/?q=${loc.lat},${loc.lon}`);
  }
  return lines.join('\n');
};

/**
 * 単一アイテムの共有
 */
export const shareItem = async (item: PhotoItem): Promise<boolean> => {
  try {
    const blob = await loadImageBlob(item.image);
    if (!blob || blob.size === 0) throw new Error('画像データが取得できません');
    const shareData = {
      title: '郵便物スナップ',
      text: createShareableText(item),
      files: [
        new File([blob], 'postal-snap.jpg', {
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
    const files = [];
    for (const photo of group.photos) {
      const blob = await loadImageBlob(photo.image);
      if (blob && blob.size > 0) {
        files.push(new File([blob], `postal-snap-${photo.id}.jpg`, { type: 'image/jpeg' }));
      }
    }
    const shareData = {
      title: '郵便物スナップ - グループ',
      text: createGroupShareableText(group),
      files,
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

/**
 * メールでデータを共有する
 * attachments: [{ blob, filename, mimeType }]
 */
export const shareDataViaEmail = async (
  subject: string,
  body: string,
  attachments: { blob: Blob, filename: string, mimeType: string }[]
) => {
  const files = attachments.map(att => new File([att.blob], att.filename, { type: att.mimeType }));

  // Web Share APIが利用可能で、ファイルを共有できるかチェック
  if (navigator.share && navigator.canShare && navigator.canShare({ files })) {
    try {
      await navigator.share({
        title: subject,
        text: body,
        files,
      });
      console.log('Successfully shared data via Web Share API');
    } catch (error) {
      console.error('Error using Web Share API:', error);
      fallbackToMailto(subject, body, files);
    }
  } else {
    fallbackToMailto(subject, body, files);
  }
};

/**
 * mailto:リンクを生成してメールクライアントを開く
 * 添付ファイルは自動添付できないため、案内文を追加
 */
const fallbackToMailto = (subject: string, body: string, files: File[]) => {
  let attachmentList = '';
  if (files.length > 0) {
    attachmentList = '\n\n---\n【ご注意】\nこのメールには以下のファイルを添付してください:\n' + files.map(f => `・${f.name}`).join('\n');
  }
  const mailtoBody = `${body}${attachmentList}\n\n---\nお使いの環境ではファイルの自動添付がサポートされていません。\nお手数ですが、アプリからエクスポートしたファイルや画像を手動で添付してください。`;
  const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(mailtoBody)}`;
  window.open(mailtoLink, '_blank');
}; 