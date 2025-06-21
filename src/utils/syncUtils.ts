// import QRCode from 'qrcode';
// import pako from 'pako';
// import { loadImageBlob } from './imageDB';

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

// interface CompressedSyncData {
//   v: string;      // version
//   ts: number;     // timestamp
//   did: string;    // deviceId
//   d: {           // data
//     i: Array<{   // items
//       i: string; // id
//       t: string[]; // tags
//       m: string; // memo
//       c: number; // createdAt
//       u: number; // updatedAt
//     }>;
//     g: Array<{   // groups
//       i: string; // id
//       t: string; // title
//       g: string[]; // tags
//       m: string; // memo
//       c: number; // createdAt
//       u: number; // updatedAt
//       p: Array<{ // photos
//         i: string; // id
//         t: string[]; // tags
//         m: string; // memo
//       }>;
//     }>;
//     t: any[];    // tags
//   };
//   c: string;     // checksum
// }

// interface ChunkData {
//   t: 'c';        // type: chunk
//   n: number;     // total number
//   i: number;     // index
//   d: string;     // data
//   h: string;     // hash
// }

export class SyncManager {
  private deviceName: string;

  constructor() {
    this.deviceName = this.getDeviceName();
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