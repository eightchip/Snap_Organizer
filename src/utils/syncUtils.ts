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

export class SyncManager {
  private deviceId: string;
  private deviceName: string;
  private readonly MAX_QR_SIZE = 2000; // QRコードの最大サイズ（安全マージン付き）
  private readonly COMPRESSION_LEVEL = 9; // 圧縮レベル（0-9）

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
    const data = {
      items,
      groups,
      tags
    };

    // データを高度に圧縮
    const compressedData = await this.compressDataAdvanced(JSON.stringify(data));
    
    // チェックサムを計算
    const checksum = await this.calculateChecksum(compressedData);

    return {
      version: '1.0',
      timestamp: Date.now(),
      deviceId: this.deviceId,
      data: data,
      checksum
    };
  }

  // 高度なデータ圧縮
  private async compressDataAdvanced(data: string): Promise<string> {
    // 1. 不要な空白と改行を削除
    const minified = JSON.stringify(JSON.parse(data));
    
    // 2. 長い文字列の短縮（画像データは除外）
    const shortened = this.shortenData(minified);
    
    // 3. Base64エンコード
    const base64 = btoa(encodeURIComponent(shortened));
    
    // 4. さらに圧縮（簡単なアルゴリズム）
    const compressed = this.simpleCompress(base64);
    
    return compressed;
  }

  // データの短縮
  private shortenData(data: string): string {
    try {
      const parsed = JSON.parse(data);
      
      // 画像データを短縮（base64の最初と最後のみ保持）
      const shortenImageData = (item: any) => {
        if (item.image && item.image.length > 100) {
          item.image = item.image.substring(0, 50) + '...' + item.image.substring(item.image.length - 50);
        }
        return item;
      };

      // アイテムの画像データを短縮
      if (parsed.items) {
        parsed.items = parsed.items.map(shortenImageData);
      }

      // グループ内の画像データを短縮
      if (parsed.groups) {
        parsed.groups = parsed.groups.map((group: any) => ({
          ...group,
          photos: group.photos.map(shortenImageData)
        }));
      }

      return JSON.stringify(parsed);
    } catch (error) {
      console.warn('データ短縮に失敗、元のデータを使用:', error);
      return data;
    }
  }

  // 簡単な圧縮アルゴリズム
  private simpleCompress(data: string): string {
    // 連続する文字の圧縮
    let compressed = '';
    let count = 1;
    let current = data[0];

    for (let i = 1; i < data.length; i++) {
      if (data[i] === current) {
        count++;
      } else {
        if (count > 3) {
          compressed += `${count}${current}`;
        } else {
          compressed += current.repeat(count);
        }
        current = data[i];
        count = 1;
      }
    }

    if (count > 3) {
      compressed += `${count}${current}`;
    } else {
      compressed += current.repeat(count);
    }

    return compressed;
  }

  // データをチャンクに分割
  private splitDataIntoChunks(data: string): SyncChunk[] {
    const chunks: SyncChunk[] = [];
    const totalChunks = Math.ceil(data.length / this.MAX_QR_SIZE);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * this.MAX_QR_SIZE;
      const end = Math.min(start + this.MAX_QR_SIZE, data.length);
      const chunkData = data.substring(start, end);

      chunks.push({
        chunkIndex: i,
        totalChunks,
        data: chunkData,
        checksum: this.calculateSimpleChecksum(chunkData)
      });
    }

    return chunks;
  }

  // 簡単なチェックサム計算
  private calculateSimpleChecksum(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32bit整数に変換
    }
    return Math.abs(hash).toString(36);
  }

  // QRコードの生成（分割対応）
  async generateQRCode(syncData: SyncData): Promise<string[]> {
    try {
      const dataString = JSON.stringify(syncData);
      
      // データサイズをチェック
      if (dataString.length <= this.MAX_QR_SIZE) {
        // 単一QRコードで対応可能
        const qrCodeDataUrl = await QRCode.toDataURL(dataString, {
          width: 300,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
        return [qrCodeDataUrl];
      } else {
        // データを分割して複数のQRコードを生成
        const compressedData = await this.compressDataAdvanced(dataString);
        const chunks = this.splitDataIntoChunks(compressedData);
        
        const qrCodes: string[] = [];
        for (const chunk of chunks) {
          const chunkData = JSON.stringify({
            type: 'sync_chunk',
            ...chunk,
            deviceId: this.deviceId,
            timestamp: Date.now()
          });

          const qrCode = await QRCode.toDataURL(chunkData, {
            width: 300,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            }
          });
          qrCodes.push(qrCode);
        }
        
        return qrCodes;
      }
    } catch (error) {
      console.error('QRコード生成エラー:', error);
      throw error;
    }
  }

  // 複数のQRコードからデータを復元
  async reconstructDataFromChunks(chunks: SyncChunk[]): Promise<SyncData> {
    try {
      // チャンクを順序通りに並べ替え
      const sortedChunks = chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
      
      // データを結合
      let combinedData = '';
      for (const chunk of sortedChunks) {
        // チェックサムを検証
        const calculatedChecksum = this.calculateSimpleChecksum(chunk.data);
        if (calculatedChecksum !== chunk.checksum) {
          throw new Error(`チャンク ${chunk.chunkIndex} のデータが破損しています`);
        }
        combinedData += chunk.data;
      }

      // データを解凍
      const decompressedData = await this.decompressDataAdvanced(combinedData);
      const syncData: SyncData = JSON.parse(decompressedData);
      
      // データの検証
      await this.validateSyncData(syncData);
      
      return syncData;
    } catch (error) {
      console.error('データ復元エラー:', error);
      throw error;
    }
  }

  // 高度なデータ解凍
  private async decompressDataAdvanced(compressedData: string): Promise<string> {
    // 1. 簡単な圧縮を解凍
    const decompressed = this.simpleDecompress(compressedData);
    
    // 2. Base64デコード
    const decoded = decodeURIComponent(atob(decompressed));
    
    return decoded;
  }

  // 簡単な解凍アルゴリズム
  private simpleDecompress(data: string): string {
    let result = '';
    let i = 0;
    
    while (i < data.length) {
      if (/\d/.test(data[i])) {
        // 数字が見つかった場合、圧縮されたデータとして処理
        let count = '';
        while (i < data.length && /\d/.test(data[i])) {
          count += data[i];
          i++;
        }
        if (i < data.length) {
          const char = data[i];
          result += char.repeat(parseInt(count));
          i++;
        }
      } else {
        result += data[i];
        i++;
      }
    }
    
    return result;
  }

  // QRコードからデータを読み取り
  async readQRCode(qrCodeDataUrl: string): Promise<SyncData> {
    try {
      // QRコードの読み取り（実際の実装ではライブラリを使用）
      const dataString = await this.decodeQRCode(qrCodeDataUrl);
      const parsedData = JSON.parse(dataString);
      
      if (parsedData.type === 'sync_chunk') {
        // チャンクデータの場合
        throw new Error('複数のQRコードが必要です。すべてのQRコードを読み取ってください。');
      } else {
        // 通常の同期データの場合
        const syncData: SyncData = parsedData;
        await this.validateSyncData(syncData);
        return syncData;
      }
    } catch (error) {
      console.error('QRコード読み取りエラー:', error);
      throw error;
    }
  }

  // メールバックアップの生成
  async generateEmailBackup(syncData: SyncData): Promise<{
    subject: string;
    body: string;
    attachment?: Blob;
  }> {
    const timestamp = new Date(syncData.timestamp).toLocaleString('ja-JP');
    const deviceName = this.deviceName;
    
    const subject = `[Snap Organizer] データバックアップ - ${deviceName} - ${timestamp}`;
    
    const body = `
Snap Organizer データバックアップ

デバイス: ${deviceName}
日時: ${timestamp}
アイテム数: ${syncData.data.items.length}
グループ数: ${syncData.data.groups.length}
タグ数: ${syncData.data.tags.length}

このメールには、アプリのデータが添付されています。
新しいデバイスでQRコードを読み取るか、添付ファイルをインポートしてください。

---
Snap Organizer
`;

    // データをファイルとして添付
    const dataBlob = new Blob([JSON.stringify(syncData, null, 2)], {
      type: 'application/json'
    });

    return {
      subject,
      body,
      attachment: dataBlob
    };
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
} 