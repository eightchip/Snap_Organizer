import QRCode from 'qrcode';
import pako from 'pako';
import { loadImageBlob } from './imageDB';

export interface SyncData {
  version: string;
  timestamp: number;
  deviceId: string;
  data: {
    items: any[];
    groups: any[];
    tags: any[];
  };
  checksum: string;
}

export interface SyncChunk {
  chunkIndex: number;
  totalChunks: number;
  data: string;
  checksum: string;
}

export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  lastSync: number;
  dataVersion: string;
}

interface CompressedSyncData {
  v: string;      // version
  ts: number;     // timestamp
  did: string;    // deviceId
  d: {           // data
    i: Array<{   // items
      i: string; // id
      t: string[]; // tags
      m: string; // memo
      c: number; // createdAt
      u: number; // updatedAt
    }>;
    g: Array<{   // groups
      i: string; // id
      t: string; // title
      g: string[]; // tags
      m: string; // memo
      c: number; // createdAt
      u: number; // updatedAt
      p: Array<{ // photos
        i: string; // id
        t: string[]; // tags
        m: string; // memo
      }>;
    }>;
    t: any[];    // tags
  };
  c: string;     // checksum
}

interface ChunkData {
  t: 'c';        // type: chunk
  n: number;     // total number
  i: number;     // index
  d: string;     // data
  h: string;     // hash
}

export class SyncManager {
  private deviceId: string;
  private deviceName: string;
  private readonly MAX_QR_SIZE = 300; // QRコードの最大サイズを300バイトに縮小
  private readonly CHUNK_HEADER_SIZE = 30; // チャンクヘッダーのサイズを最適化
  private readonly MAX_QR_CHUNKS = 8; // 最大分割数を8に増加

  constructor() {
    this.deviceId = this.getOrCreateDeviceId();
    this.deviceName = this.getDeviceName();
  }

  // デバイスIDの生成・取得
  private getOrCreateDeviceId(): string {
    let deviceId = localStorage.getItem('device_id');
    if (!deviceId) {
      deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('device_id', deviceId);
    }
    return deviceId;
  }

  // デバイス名の取得
  private getDeviceName(): string {
    const savedName = localStorage.getItem('device_name');
    if (savedName) return savedName;
    
    // デフォルトデバイス名を生成
    const defaultName = `${navigator.platform} - ${new Date().toLocaleDateString()}`;
    localStorage.setItem('device_name', defaultName);
    return defaultName;
  }

  // Blob→base64変換ユーティリティ（App.tsx等にあればimport、なければ下記を追加）
  private blobToBase64 = async (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // メールバックアップの生成
  async generateEmailBackup(syncData: SyncData): Promise<{
    subject: string;
    body: string;
    attachment: Blob;
  }> {
    if (!syncData || !syncData.data) {
      throw new Error('バックアップデータが無効です');
    }

    const timestamp = new Date(syncData.timestamp || Date.now()).toLocaleString('ja-JP');
    const deviceName = this.deviceName;
    
    const subject = `[Snap Organizer] データバックアップ - ${deviceName} - ${timestamp}`;
    
    const body = `
Snap Organizerのデータバックアップです。

このメールに添付されているJSONファイルをアプリのインポート機能で読み込むことで、データを復元できます。

--------------------
デバイス: ${deviceName}
時刻: ${timestamp}
アイテム数: ${syncData.data.items.length}
グループ数: ${syncData.data.groups.length}
タグ数: ${syncData.data.tags.length}
--------------------

From: Snap Organizer
`;

    // データをファイルとして添付
    const attachment = new Blob([JSON.stringify(syncData, null, 2)], { type: 'application/json' });

    return { subject, body, attachment };
  }
} 