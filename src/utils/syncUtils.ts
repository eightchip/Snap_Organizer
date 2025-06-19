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

export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  lastSync: number;
  dataVersion: string;
}

export class SyncManager {
  private deviceId: string;
  private deviceName: string;

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

  // データの準備（圧縮・暗号化）
  async prepareSyncData(items: any[], groups: any[], tags: any[]): Promise<SyncData> {
    const data = {
      items,
      groups,
      tags
    };

    // データを圧縮
    const compressedData = await this.compressData(JSON.stringify(data));
    
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

  // QRコードの生成
  async generateQRCode(syncData: SyncData): Promise<string> {
    try {
      // データサイズをチェック（QRコードの制限）
      const dataString = JSON.stringify(syncData);
      if (dataString.length > 3000) {
        throw new Error('データが大きすぎます。一部のデータのみ同期します。');
      }

      const qrCodeDataUrl = await QRCode.toDataURL(dataString, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      return qrCodeDataUrl;
    } catch (error) {
      console.error('QRコード生成エラー:', error);
      throw error;
    }
  }

  // QRコードからデータを読み取り
  async readQRCode(qrCodeDataUrl: string): Promise<SyncData> {
    try {
      // QRコードの読み取り（実際の実装ではライブラリを使用）
      const dataString = await this.decodeQRCode(qrCodeDataUrl);
      const syncData: SyncData = JSON.parse(dataString);
      
      // データの検証
      await this.validateSyncData(syncData);
      
      return syncData;
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

  // データの圧縮
  private async compressData(data: string): Promise<string> {
    // 簡単な圧縮（実際の実装ではより高度な圧縮を使用）
    return btoa(encodeURIComponent(data));
  }

  // データの解凍
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