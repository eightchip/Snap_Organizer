import QRCode from 'qrcode';

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

  // データの準備（高度な圧縮）
  async prepareSyncData(items: any[], groups: any[], tags: any[]): Promise<SyncData> {
    // さらにデータを最小化
    const minimalData = {
      items: items.map(item => ({
        id: item.id,
        tags: item.tags || [],
        memo: item.memo || '',
        createdAt: item.createdAt instanceof Date ? item.createdAt.getTime() : new Date(item.createdAt).getTime(),
        updatedAt: item.updatedAt instanceof Date ? item.updatedAt.getTime() : new Date(item.updatedAt).getTime()
      })),
      groups: groups.map(group => ({
        id: group.id,
        title: group.title || '',
        tags: group.tags || [],
        memo: group.memo || '',
        createdAt: group.createdAt instanceof Date ? group.createdAt.getTime() : new Date(group.createdAt).getTime(),
        updatedAt: group.updatedAt instanceof Date ? group.updatedAt.getTime() : new Date(group.updatedAt).getTime(),
        photos: group.photos.map(photo => ({
          id: photo.id,
          tags: photo.tags || [],
          memo: photo.memo || ''
        }))
      })),
      tags: tags
    };

    // チェックサムを計算
    const checksum = await this.calculateChecksum(JSON.stringify(minimalData));

    // SyncData形式で返す
    return {
      version: '1.0',
      timestamp: Date.now(),
      deviceId: this.deviceId,
      data: minimalData,
      checksum: checksum
    };
  }

  // 高度なデータ圧縮
  private async compressDataAdvanced(syncData: SyncData): Promise<string> {
    try {
      // 1. 基本的なnullチェック
      if (!syncData) {
        throw new Error('同期データがありません');
      }

      // 2. 必須フィールドの存在チェック
      const requiredFields = ['version', 'timestamp', 'deviceId', 'data'] as const;
      for (const field of requiredFields) {
        if (!syncData[field]) {
          throw new Error(`必須フィールド '${field}' が不足しています`);
        }
      }

      // 3. データ構造の検証
      if (!syncData.data || typeof syncData.data !== 'object') {
        throw new Error('同期データの内容が不正です');
      }

      // 4. 配列の検証
      if (!Array.isArray(syncData.data.items) || !Array.isArray(syncData.data.groups)) {
        throw new Error('items または groups が配列ではありません');
      }

      // 5. データを短縮名で再構成
      const minimalData: CompressedSyncData = {
        v: syncData.version,
        ts: syncData.timestamp,
        did: syncData.deviceId,
        d: {
          i: syncData.data.items.map((item, index) => {
            if (!item || typeof item !== 'object') {
              throw new Error(`不正なアイテムデータ (index: ${index})`);
            }
            if (!item.id) {
              throw new Error(`アイテムIDが不足しています (index: ${index})`);
            }
            return {
              i: item.id,
              t: Array.isArray(item.tags) ? item.tags : [],
              m: item.memo || '',
              c: this.normalizeTimestamp(item.createdAt),
              u: this.normalizeTimestamp(item.updatedAt)
            };
          }),
          g: syncData.data.groups.map((group, index) => {
            if (!group || typeof group !== 'object') {
              throw new Error(`不正なグループデータ (index: ${index})`);
            }
            if (!group.id) {
              throw new Error(`グループIDが不足しています (index: ${index})`);
            }
            return {
              i: group.id,
              t: group.title || '',
              m: group.memo || '',
              g: Array.isArray(group.tags) ? group.tags : [],
              c: this.normalizeTimestamp(group.createdAt),
              u: this.normalizeTimestamp(group.updatedAt),
              p: Array.isArray(group.photos) ? group.photos.map((photo, photoIndex) => {
                if (!photo || typeof photo !== 'object') {
                  throw new Error(`不正な写真データ (group: ${index}, photo: ${photoIndex})`);
                }
                if (!photo.id) {
                  throw new Error(`写真IDが不足しています (group: ${index}, photo: ${photoIndex})`);
                }
                return {
                  i: photo.id,
                  t: Array.isArray(photo.tags) ? photo.tags : [],
                  m: photo.memo || ''
                };
              }) : []
            };
          }),
          t: syncData.data.tags
        },
        c: syncData.checksum
      };

      // 6. JSONに変換して返す
      return JSON.stringify(minimalData);
    } catch (error) {
      console.error('データ圧縮エラー:', error);
      throw new Error(`データの圧縮に失敗しました: ${error.message}`);
    }
  }

  // タイムスタンプを正規化するヘルパーメソッド
  private normalizeTimestamp(timestamp: any): number {
    if (!timestamp) {
      return Date.now();
    }
    if (timestamp instanceof Date) {
      return timestamp.getTime();
    }
    if (typeof timestamp === 'number') {
      return timestamp;
    }
    try {
      return new Date(timestamp).getTime();
    } catch (error) {
      return Date.now();
    }
  }

  // データをチャンクに分割（短縮名ヘッダー）
  private splitDataIntoChunks(data: string): Array<{ i: number; n: number; d: string; h: string }> {
    const MAX_QR_SIZE = this.MAX_QR_SIZE;
    const totalChunks = Math.ceil(data.length / MAX_QR_SIZE);
    const chunks: Array<{ i: number; n: number; d: string; h: string }> = [];
    for (let i = 0; i < totalChunks; i++) {
      const start = i * MAX_QR_SIZE;
      const end = Math.min(start + MAX_QR_SIZE, data.length);
      const chunkData = data.substring(start, end);
      chunks.push({
        i,
        n: totalChunks,
        d: chunkData,
        h: this.calculateSimpleChecksum(chunkData)
      });
    }
    return chunks;
  }

  // QRコードの生成（圧縮→分割→QR化）
  async generateQRCode(syncData: SyncData): Promise<string[]> {
    try {
      // 1. データを圧縮
      const compressedData = await this.compressDataAdvanced(syncData);
      
      // 2. チャンクサイズを計算（ヘッダー情報を考慮）
      const effectiveChunkSize = this.MAX_QR_SIZE - this.CHUNK_HEADER_SIZE;
      
      // 3. データをチャンクに分割
      const chunks: ChunkData[] = [];
      const totalChunks = Math.ceil(compressedData.length / effectiveChunkSize);
      
      if (totalChunks > this.MAX_QR_CHUNKS) {
        throw new Error(`データが大きすぎます。${this.MAX_QR_CHUNKS}個以下のQRコードに収める必要があります。`);
      }

      for (let i = 0; i < totalChunks; i++) {
        const start = i * effectiveChunkSize;
        const end = Math.min(start + effectiveChunkSize, compressedData.length);
        const chunkData = compressedData.slice(start, end);
        
        // チャンク情報を作成
        const chunk: ChunkData = {
          t: 'c',
          n: totalChunks,
          i: i,
          d: chunkData,
          h: await this.calculateSimpleChecksum(chunkData)
        };
        
        chunks.push(chunk);
      }

      // 4. 各チャンクをQRコードに変換
      const qrOptions = {
        errorCorrectionLevel: 'M' as QRCode.QRCodeErrorCorrectionLevel,
        margin: 1,
        width: 300,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      };

      const qrPromises = chunks.map(async (chunk, index) => {
        try {
          const chunkStr = JSON.stringify(chunk);
          return await QRCode.toDataURL(chunkStr, qrOptions);
        } catch (error) {
          console.error(`QRコード生成エラー (チャンク ${index + 1}/${totalChunks}):`, error);
          throw new Error(`QRコード生成に失敗しました (チャンク ${index + 1}/${totalChunks}): ${error.message}`);
        }
      });

      const results = await Promise.all(qrPromises);
      console.log(`QRコード生成完了: ${results.length}個のQRコードを生成しました`);
      return results;
    } catch (error) {
      console.error('QRコード生成エラー:', error);
      throw new Error(`QRコード生成に失敗しました: ${error.message}`);
    }
  }

  // 複数のQRコードからデータを復元
  async reconstructDataFromChunks(chunks: { i: number; n: number; d: string; h: string }[]): Promise<SyncData> {
    try {
      // チャンクを順序通りに並べ替え
      const sortedChunks = chunks.sort((a, b) => a.i - b.i);
      // データを結合
      let combinedData = '';
      for (const chunk of sortedChunks) {
        // チェックサムを検証
        const calculatedChecksum = this.calculateSimpleChecksum(chunk.d);
        if (calculatedChecksum !== chunk.h) {
          throw new Error(`チャンク ${chunk.i} のデータが破損しています`);
        }
        combinedData += chunk.d;
      }
      // データを解凍
      const decompressedData = await this.decompressDataAdvanced(combinedData);
      // 展開
      return this.expandSyncData(JSON.parse(decompressedData));
    } catch (error) {
      console.error('データ復元エラー:', error);
      throw error;
    }
  }

  // 高度なデータ解凍
  private async decompressDataAdvanced(compressedData: string): Promise<string> {
    try {
      // 1. Base64デコード（URLセーフな形式から）
      const base64 = compressedData
        .replace(/-/g, '+')
        .replace(/_/g, '/');
      
      // パディングを追加
      const pad = base64.length % 4;
      const paddedBase64 = pad ? base64 + '='.repeat(4 - pad) : base64;
      
      // デコード
      const decoded = atob(paddedBase64);
      
      return decoded;
    } catch (error) {
      console.error('解凍エラー:', error);
      throw error;
    }
  }

  // QRコードからデータを読み取り
  async readQRCode(qrData: string): Promise<SyncData | null> {
    try {
      const parsed = JSON.parse(qrData) as ChunkData | CompressedSyncData;
      
      // チャンクデータの場合
      if ('t' in parsed && parsed.t === 'c') {
        // チャンクデータを一時保存
        const key = `temp_chunk_${parsed.i}`;
        localStorage.setItem(key, JSON.stringify(parsed));
        
        // 全チャンクが揃っているか確認
        const chunks: ChunkData[] = [];
        for (let i = 0; i < parsed.n; i++) {
          const chunkData = localStorage.getItem(`temp_chunk_${i}`);
          if (!chunkData) return null;
          chunks.push(JSON.parse(chunkData));
        }
        
        // チャンクを結合
        const combinedData = chunks
          .sort((a, b) => a.i - b.i)
          .map(chunk => {
            // チェックサム検証
            if (this.calculateSimpleChecksum(chunk.d) !== chunk.h) {
              throw new Error(`チャンク${chunk.i}のチェックサムが一致しません`);
            }
            return chunk.d;
          })
          .join('');
        
        // 一時データを削除
        for (let i = 0; i < parsed.n; i++) {
          localStorage.removeItem(`temp_chunk_${i}`);
        }
        
        const fullData = JSON.parse(combinedData) as CompressedSyncData;
        return this.expandSyncData(fullData);
      }
      
      // 単一QRコードの場合
      return this.expandSyncData(parsed as CompressedSyncData);
    } catch (error) {
      console.error('QRコード読み取りエラー:', error);
      return null;
    }
  }

  // 圧縮されたデータを展開
  private expandSyncData(data: any): SyncData {
    return {
      version: data.v,
      timestamp: data.ts,
      deviceId: data.did,
      data: {
        items: data.d.i.map((item: any) => ({
          id: item.i,
          tags: item.t,
          memo: item.m,
          createdAt: new Date(item.c),
          updatedAt: new Date(item.u)
        })),
        groups: data.d.g.map((group: any) => ({
          id: group.i,
          title: group.t,
          tags: group.g,
          memo: group.m,
          createdAt: new Date(group.c),
          updatedAt: new Date(group.u),
          photos: group.p.map((photo: any) => ({
            id: photo.i,
            tags: photo.t,
            memo: photo.m
          }))
        })),
        tags: data.d.t
      },
      checksum: data.c
    };
  }

  // メールバックアップの生成
  async generateEmailBackup(syncData: SyncData): Promise<{
    subject: string;
    body: string;
    attachment?: Blob;
  }> {
    if (!syncData || !syncData.data) {
      throw new Error('バックアップデータが無効です');
    }

    const timestamp = new Date(syncData.timestamp || Date.now()).toLocaleString('ja-JP');
    const deviceName = this.deviceName;
    
    const subject = `[Snap Organizer] データバックアップ - ${deviceName} - ${timestamp}`;
    
    // QRコードを生成
    let qrCodeHtml = '';
    try {
      const qrCodes = await this.generateQRCode(syncData);
      qrCodeHtml = qrCodes.map((qrCode, index) => `
<div style="margin: 20px 0;">
  <p style="color: #666;">QRコード ${qrCodes.length > 1 ? `(${index + 1}/${qrCodes.length})` : ''}</p>
  <img src="${qrCode}" alt="同期用QRコード" style="width: 200px; height: 200px;">
</div>`).join('');
    } catch (error) {
      console.error('QRコード生成エラー:', error);
      qrCodeHtml = '<p style="color: red;">QRコードの生成に失敗しました</p>';
    }

    const body = `
<html>
<body style="font-family: sans-serif;">
<h1 style="color: #333;">Snap Organizer データバックアップ</h1>

<div style="margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 8px;">
  <p>デバイス: ${deviceName} - ${timestamp}</p>
  <p>アイテム数: ${syncData.data.items.length}</p>
  <p>グループ数: ${syncData.data.groups.length}</p>
  <p>タグ数: ${syncData.data.tags.length}</p>
</div>

<div style="margin: 20px 0;">
  <p>このメールには、アプリのデータが添付されています。</p>
  <p>新しいデバイスで以下のいずれかの方法でデータを復元できます：</p>
  <ul>
    <li>下記のQRコードを読み取る</li>
    <li>添付ファイルをインポートする</li>
  </ul>
</div>

${qrCodeHtml}

<hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
<p style="color: #666;">
  Snap Organizer<br>
  From: eightchip@yahoo.co.jp
</p>
</body>
</html>`;

    // データをファイルとして添付
    const attachment = new Blob([JSON.stringify(syncData)], { type: 'application/json' });

    return { subject, body, attachment };
  }

  // データの圧縮（旧版 - 後方互換性のため保持）
  private async compressData(data: string): Promise<string> {
    return btoa(encodeURIComponent(data));
  }

  // データの解凍（旧版）
  private async decompressData(compressedData: string): Promise<string> {
    return decodeURIComponent(atob(compressedData));
  }

  // チェックサムの計算
  private async calculateChecksum(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // データの検証
  private async validateSyncData(syncData: SyncData): Promise<void> {
    if (!syncData.version || !syncData.timestamp || !syncData.data) {
      throw new Error('無効な同期データです');
    }

    // バージョンチェック
    if (syncData.version !== '1.0') {
      throw new Error('サポートされていないデータバージョンです');
    }

    // チェックサムの検証
    const calculatedChecksum = await this.calculateChecksum(JSON.stringify(syncData.data));
    if (calculatedChecksum !== syncData.checksum) {
      throw new Error('データの整合性チェックに失敗しました');
    }
  }

  // QRコードのデコード（実際の実装ではライブラリを使用）
  private async decodeQRCode(qrCodeDataUrl: string): Promise<string> {
    // ここでは実際のQRコード読み取りライブラリを使用
    // 例: jsQR, QuaggaJS など
    throw new Error('QRコード読み取り機能は別途実装が必要です');
  }

  // デバイス名の更新
  updateDeviceName(name: string): void {
    this.deviceName = name;
    localStorage.setItem('device_name', name);
  }

  // デバイス情報の取得
  getDeviceInfo(): DeviceInfo {
    return {
      deviceId: this.deviceId,
      deviceName: this.deviceName,
      lastSync: parseInt(localStorage.getItem('last_sync') || '0'),
      dataVersion: '1.0'
    };
  }

  // 簡易チェックサム（32bit整数を36進数文字列で返す）
  private calculateSimpleChecksum(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32bit整数に変換
    }
    return Math.abs(hash).toString(36);
  }
} 