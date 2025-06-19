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

interface ChunkData {
  type: 'chunk';
  total: number;
  index: number;
  data: string;
  checksum: string;
}

export class SyncManager {
  private deviceId: string;
  private deviceName: string;
  private readonly MAX_QR_SIZE = 500; // QRコードの最大サイズを500バイトに縮小
  private readonly CHUNK_HEADER_SIZE = 50; // チャンクヘッダーのサイズ
  private readonly MAX_QR_CHUNKS = 4; // 最大分割数

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
    // 必要最小限のデータのみを含める
    const minimalData = {
      items: items.map(item => ({
        id: item.id,
        tags: item.tags,
        memo: item.memo,
        createdAt: new Date(item.createdAt).getTime(),
        updatedAt: new Date(item.updatedAt).getTime()
      })),
      groups: groups.map(group => ({
        id: group.id,
        title: group.title,
        tags: group.tags,
        memo: group.memo,
        createdAt: new Date(group.createdAt).getTime(),
        updatedAt: new Date(group.updatedAt).getTime(),
        photos: group.photos.map(photo => ({
          id: photo.id,
          tags: photo.tags,
          memo: photo.memo
        }))
      })),
      tags
    };

    // チェックサムを計算
    const checksum = await this.calculateChecksum(JSON.stringify(minimalData));

    return {
      version: '1.0',
      timestamp: Date.now(),
      deviceId: this.deviceId,
      data: minimalData,
      checksum
    };
  }

  // 高度なデータ圧縮
  private async compressDataAdvanced(data: string): Promise<string> {
    try {
      // 1. 不要な空白と改行を削除
      const minified = JSON.stringify(JSON.parse(data));
      
      // 2. 長い文字列の短縮（画像データは除外）
      const shortened = this.shortenData(minified);
      
      // 3. Base64エンコード（URLセーフな形式で）
      const encoded = btoa(shortened)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
      
      return encoded;
    } catch (error) {
      console.error('圧縮エラー:', error);
      throw error;
    }
  }

  // データの短縮
  private shortenData(data: string): string {
    try {
      const parsed = JSON.parse(data);
      
      // 日付を短い形式に変換
      const convertDates = (obj: any) => {
        if (obj.createdAt) {
          obj.createdAt = new Date(obj.createdAt).getTime();
        }
        if (obj.updatedAt) {
          obj.updatedAt = new Date(obj.updatedAt).getTime();
        }
        return obj;
      };

      // アイテムの処理
      if (parsed.items) {
        parsed.items = parsed.items.map((item: any) => convertDates(item));
      }

      // グループの処理
      if (parsed.groups) {
        parsed.groups = parsed.groups.map((group: any) => {
          group = convertDates(group);
          if (group.photos) {
            group.photos = group.photos.map((photo: any) => convertDates(photo));
          }
          return group;
        });
      }

      return JSON.stringify(parsed);
    } catch (error) {
      console.warn('データ短縮に失敗、元のデータを使用:', error);
      return data;
    }
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
      const jsonData = JSON.stringify(syncData);
      console.log('QRコード生成: 元データサイズ', jsonData.length);

      // データサイズが小さい場合は単一QRコード
      if (jsonData.length <= this.MAX_QR_SIZE) {
        console.log('単一QRコードで生成');
        const qrCodeDataUrl = await QRCode.toDataURL(jsonData, {
          width: 200,
          margin: 1,
          errorCorrectionLevel: 'M',
          color: { dark: '#000000', light: '#FFFFFF' }
        });
        return [qrCodeDataUrl];
      }

      // データを分割
      const chunks = this.splitIntoChunks(jsonData);
      console.log(`${chunks.length}個のチャンクに分割`);

      if (chunks.length > this.MAX_QR_CHUNKS) {
        throw new Error(`データが大きすぎます（${chunks.length}分割が必要）`);
      }

      // 各チャンクをQRコード化
      const qrCodes = await Promise.all(chunks.map(async (chunk, index) => {
        const chunkData = {
          type: 'chunk',
          total: chunks.length,
          index: index,
          data: chunk,
          checksum: this.calculateSimpleChecksum(chunk)
        };
        
        return QRCode.toDataURL(JSON.stringify(chunkData), {
          width: 200,
          margin: 1,
          errorCorrectionLevel: 'M',
          color: { dark: '#000000', light: '#FFFFFF' }
        });
      }));

      return qrCodes;
    } catch (error) {
      console.error('QRコード生成エラー:', error);
      throw error;
    }
  }

  // データを適切なサイズのチャンクに分割
  private splitIntoChunks(data: string): string[] {
    const chunks: string[] = [];
    const chunkSize = this.MAX_QR_SIZE - this.CHUNK_HEADER_SIZE;
    
    for (let i = 0; i < data.length; i += chunkSize) {
      chunks.push(data.slice(i, i + chunkSize));
    }
    
    return chunks;
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
      const parsed = JSON.parse(qrData) as ChunkData | SyncData;
      
      // チャンクデータの場合
      if ('type' in parsed && parsed.type === 'chunk') {
        // チャンクデータを一時保存
        const key = `temp_chunk_${parsed.index}`;
        localStorage.setItem(key, JSON.stringify(parsed));
        
        // 全チャンクが揃っているか確認
        const chunks: ChunkData[] = [];
        for (let i = 0; i < parsed.total; i++) {
          const chunkData = localStorage.getItem(`temp_chunk_${i}`);
          if (!chunkData) return null;
          chunks.push(JSON.parse(chunkData));
        }
        
        // チャンクを結合
        const combinedData = chunks
          .sort((a, b) => a.index - b.index)
          .map(chunk => {
            // チェックサム検証
            if (this.calculateSimpleChecksum(chunk.data) !== chunk.checksum) {
              throw new Error(`チャンク${chunk.index}のチェックサムが一致しません`);
            }
            return chunk.data;
          })
          .join('');
        
        // 一時データを削除
        for (let i = 0; i < parsed.total; i++) {
          localStorage.removeItem(`temp_chunk_${i}`);
        }
        
        return JSON.parse(combinedData);
      }
      
      // 単一QRコードの場合
      return parsed as SyncData;
    } catch (error) {
      console.error('QRコード読み取りエラー:', error);
      return null;
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
    
    // QRコードを生成
    let qrCodeHtml = '';
    try {
      const qrCodes = await this.generateQRCode(syncData);
      qrCodeHtml = qrCodes.map((qrCode, index) => `
<div style="margin: 20px 0;">
  <p style="color: #666;">QRコード ${qrCodes.length > 1 ? `(${index + 1}/${qrCodes.length})` : ''}</p>
  <img src="${qrCode}" alt="同期用QRコード" style="width: 300px; height: 300px;">
</div>`).join('');
    } catch (error) {
      console.error('QRコード生成エラー:', error);
      qrCodeHtml = '<p style="color: red;">※ QRコードの生成に失敗しました</p>';
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