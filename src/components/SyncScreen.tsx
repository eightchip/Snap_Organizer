import React, { useState, useEffect } from 'react';
import { ArrowLeft, QrCode, Mail, Download, Upload, Smartphone, Computer, RefreshCw } from 'lucide-react';
import { SyncManager, SyncData, DeviceInfo } from '../utils/syncUtils';
import { PhotoItem, PostalItemGroup } from '../types';

interface SyncScreenProps {
  items: PhotoItem[];
  groups: PostalItemGroup[];
  tags: any[];
  onBack: () => void;
  onImport: (data: any) => void;
}

export const SyncScreen: React.FC<SyncScreenProps> = ({
  items,
  groups,
  tags,
  onBack,
  onImport
}) => {
  const [syncManager] = useState(() => new SyncManager());
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [qrCodeDataUrls, setQrCodeDataUrls] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [syncData, setSyncData] = useState<SyncData | null>(null);
  const [emailData, setEmailData] = useState<{ subject: string; body: string; attachment?: Blob } | null>(null);
  const [activeTab, setActiveTab] = useState<'qr' | 'email' | 'import'>('qr');
  const [compressionInfo, setCompressionInfo] = useState<{
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
    chunks: number;
  } | null>(null);

  useEffect(() => {
    setDeviceInfo(syncManager.getDeviceInfo());
  }, [syncManager]);

  // QRコードの生成
  const generateQRCode = async () => {
    setIsGenerating(true);
    try {
      const data = await syncManager.prepareSyncData(items, groups, tags);
      const qrCodes = await syncManager.generateQRCode(data);
      setQrCodeDataUrls(qrCodes);
      setSyncData(data);

      // 圧縮情報を計算
      const originalSize = JSON.stringify(data).length;
      const compressedSize = qrCodes.length * 2000; // 概算
      const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100;
      
      setCompressionInfo({
        originalSize,
        compressedSize,
        compressionRatio,
        chunks: qrCodes.length
      });
    } catch (error) {
      console.error('QRコード生成エラー:', error);
      alert('QRコードの生成に失敗しました: ' + error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  // メールバックアップの生成
  const generateEmailBackup = async () => {
    if (!syncData) {
      await generateQRCode();
    }
    
    try {
      const emailBackup = await syncManager.generateEmailBackup(syncData!);
      setEmailData(emailBackup);
    } catch (error) {
      console.error('メールバックアップ生成エラー:', error);
      alert('メールバックアップの生成に失敗しました: ' + error.message);
    }
  };

  // メール送信
  const sendEmail = () => {
    if (!emailData) return;

    const mailtoLink = `mailto:?subject=${encodeURIComponent(emailData.subject)}&body=${encodeURIComponent(emailData.body)}`;
    window.open(mailtoLink);
  };

  // 各種メールサービスの送信
  const sendToService = (service: 'gmail' | 'yahoo' | 'line' | 'outlook') => {
    if (!emailData) return;

    let url = '';
    const subject = encodeURIComponent(emailData.subject);
    const body = encodeURIComponent(emailData.body);

    switch (service) {
      case 'gmail':
        url = `https://mail.google.com/mail/?view=cm&fs=1&to=&su=${subject}&body=${body}`;
        break;
      case 'yahoo':
        url = `https://compose.mail.yahoo.com/?subject=${subject}&body=${body}`;
        break;
      case 'line':
        // Lineは直接メール送信できないので、テキストとして送信
        const lineText = `${emailData.subject}\n\n${emailData.body}`;
        url = `https://line.me/R/msg/text/?${encodeURIComponent(lineText)}`;
        break;
      case 'outlook':
        url = `https://outlook.live.com/mail/0/deeplink/compose?subject=${subject}&body=${body}`;
        break;
    }

    window.open(url, '_blank');
  };

  // ファイルインポート
  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (data.version && data.data) {
        // データの検証
        await syncManager.readQRCode(JSON.stringify(data));
        
        // インポート実行
        onImport(data.data);
        alert('データのインポートが完了しました');
      } else {
        throw new Error('無効なファイル形式です');
      }
    } catch (error) {
      console.error('インポートエラー:', error);
      alert('ファイルのインポートに失敗しました: ' + error.message);
    }
  };

  // デバイス名の更新
  const updateDeviceName = (name: string) => {
    syncManager.updateDeviceName(name);
    setDeviceInfo(syncManager.getDeviceInfo());
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-xl font-bold text-gray-900 flex-1">
              同期・バックアップ
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* デバイス情報 */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">デバイス情報</h2>
          {deviceInfo && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-gray-400" />
                <span className="text-gray-600">デバイス名:</span>
                <input
                  type="text"
                  value={deviceInfo.deviceName}
                  onChange={(e) => updateDeviceName(e.target.value)}
                  className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm"
                />
              </div>
              <div className="text-sm text-gray-500">
                デバイスID: {deviceInfo.deviceId}
              </div>
              <div className="text-sm text-gray-500">
                最終同期: {deviceInfo.lastSync ? new Date(deviceInfo.lastSync).toLocaleString('ja-JP') : '未同期'}
              </div>
            </div>
          )}
        </div>

        {/* タブ切り替え */}
        <div className="bg-white rounded-xl shadow-sm">
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('qr')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'qr'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <QrCode className="h-4 w-4 inline mr-2" />
              QRコード同期
            </button>
            <button
              onClick={() => setActiveTab('email')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'email'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Mail className="h-4 w-4 inline mr-2" />
              メールバックアップ
            </button>
            <button
              onClick={() => setActiveTab('import')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'import'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Upload className="h-4 w-4 inline mr-2" />
              インポート
            </button>
          </div>

          <div className="p-6">
            {/* QRコード同期タブ */}
            {activeTab === 'qr' && (
              <div className="space-y-4">
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">QRコード同期</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    他のデバイスでQRコードを読み取ってデータを同期できます
                  </p>
                  
                  <button
                    onClick={generateQRCode}
                    disabled={isGenerating}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {isGenerating ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <QrCode className="h-4 w-4" />
                    )}
                    {isGenerating ? '生成中...' : 'QRコード生成'}
                  </button>
                </div>

                {/* 圧縮情報 */}
                {compressionInfo && (
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-blue-900 mb-2">圧縮情報</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-blue-700">元のサイズ:</span>
                        <span className="ml-2">{compressionInfo.originalSize.toLocaleString()} 文字</span>
                      </div>
                      <div>
                        <span className="text-blue-700">圧縮後:</span>
                        <span className="ml-2">{compressionInfo.compressedSize.toLocaleString()} 文字</span>
                      </div>
                      <div>
                        <span className="text-blue-700">圧縮率:</span>
                        <span className="ml-2">{compressionInfo.compressionRatio.toFixed(1)}%</span>
                      </div>
                      <div>
                        <span className="text-blue-700">QRコード数:</span>
                        <span className="ml-2">{compressionInfo.chunks} 個</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* QRコード表示 */}
                {qrCodeDataUrls.length > 0 && (
                  <div className="space-y-4">
                    <div className="text-center">
                      <h4 className="font-semibold text-gray-900 mb-2">
                        {qrCodeDataUrls.length === 1 ? 'QRコード' : `QRコード (${qrCodeDataUrls.length}個)`}
                      </h4>
                      {qrCodeDataUrls.length > 1 && (
                        <p className="text-sm text-gray-600 mb-4">
                          データが大きいため、複数のQRコードに分割されています。<br />
                          すべてのQRコードを順番に読み取ってください。
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      {qrCodeDataUrls.map((qrCode, index) => (
                        <div key={index} className="text-center">
                          {qrCodeDataUrls.length > 1 && (
                            <div className="mb-2">
                              <span className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm font-medium">
                                QRコード {index + 1} / {qrCodeDataUrls.length}
                              </span>
                            </div>
                          )}
                          <div className="bg-white p-4 rounded-lg border inline-block">
                            <img
                              src={qrCode}
                              alt={`QRコード ${index + 1}`}
                              className="w-48 h-48"
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="text-center">
                      <p className="text-xs text-gray-500">
                        {qrCodeDataUrls.length === 1 
                          ? '他のデバイスでこのQRコードを読み取ってください'
                          : '他のデバイスで上から順番にQRコードを読み取ってください'
                        }
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* メールバックアップタブ */}
            {activeTab === 'email' && (
              <div className="space-y-4">
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">メールバックアップ</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    データをメールで送信してバックアップを作成できます
                  </p>
                  
                  <button
                    onClick={generateEmailBackup}
                    className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                  >
                    <Mail className="h-4 w-4" />
                    メールバックアップ生成
                  </button>
                </div>

                {emailData && (
                  <div className="space-y-4">
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <div className="text-sm">
                        <strong>件名:</strong> {emailData.subject}
                      </div>
                      <div className="text-sm mt-2">
                        <strong>内容:</strong>
                        <pre className="text-xs mt-1 whitespace-pre-wrap">{emailData.body}</pre>
                      </div>
                    </div>
                    
                    {/* メールサービス選択 */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-900 text-center">送信先を選択</h4>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => sendToService('gmail')}
                          className="flex items-center justify-center gap-2 px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                        >
                          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-.904.732-1.636 1.636-1.636h.819L12 10.91l9.545-7.089h.819c.904 0 1.636.732 1.636 1.636z"/>
                          </svg>
                          Gmail
                        </button>
                        
                        <button
                          onClick={() => sendToService('yahoo')}
                          className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                        >
                          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-.904.732-1.636 1.636-1.636h.819L12 10.91l9.545-7.089h.819c.904 0 1.636.732 1.636 1.636z"/>
                          </svg>
                          Yahoo
                        </button>
                        
                        <button
                          onClick={() => sendToService('line')}
                          className="flex items-center justify-center gap-2 px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                        >
                          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19.365 9.863c.349 0 .63.285.631.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
                          </svg>
                          Line
                        </button>
                        
                        <button
                          onClick={() => sendToService('outlook')}
                          className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                        >
                          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M7.88 3.39L6.6 1.86C6.45 1.69 6.24 1.58 6 1.58c-.24 0-.45.11-.6.28L3.88 3.39C3.73 3.56 3.62 3.77 3.62 4v16c0 .23.11.44.26.61l1.28 1.53c.15.17.36.28.6.28.24 0 .45-.11.6-.28l1.28-1.53c.15-.17.26-.38.26-.61V4c0-.23-.11-.44-.26-.61zM20.12 3.39l-1.28-1.53C18.69 1.69 18.48 1.58 18.24 1.58c-.24 0-.45.11-.6.28L16.36 3.39c-.15.17-.26.38-.26.61v16c0 .23.11.44.26.61l1.28 1.53c.15.17.36.28.6.28.24 0 .45-.11.6-.28l1.28-1.53c.15-.17.26-.38.26-.61V4c0-.23-.11-.44-.26-.61z"/>
                          </svg>
                          Outlook
                        </button>
                      </div>
                      
                      <button
                        onClick={sendEmail}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                      >
                        <Mail className="h-4 w-4" />
                        デフォルトメールアプリ
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* インポートタブ */}
            {activeTab === 'import' && (
              <div className="space-y-4">
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">データインポート</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    バックアップファイルまたはQRコードデータをインポートできます
                  </p>
                  
                  <label className="block p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer">
                    <div className="flex items-center justify-center gap-2">
                      <Upload className="h-6 w-6 text-gray-400" />
                      <span className="text-gray-600">ファイルを選択</span>
                    </div>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleFileImport}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* データ統計 */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">データ統計</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600">{items.length}</div>
              <div className="text-sm text-gray-500">アイテム</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{groups.length}</div>
              <div className="text-sm text-gray-500">グループ</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600">{tags.length}</div>
              <div className="text-sm text-gray-500">タグ</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}; 