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
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [syncData, setSyncData] = useState<SyncData | null>(null);
  const [emailData, setEmailData] = useState<{ subject: string; body: string; attachment?: Blob } | null>(null);
  const [activeTab, setActiveTab] = useState<'qr' | 'email' | 'import'>('qr');

  useEffect(() => {
    setDeviceInfo(syncManager.getDeviceInfo());
  }, [syncManager]);

  // QRコードの生成
  const generateQRCode = async () => {
    setIsGenerating(true);
    try {
      const data = await syncManager.prepareSyncData(items, groups, tags);
      const qrCode = await syncManager.generateQRCode(data);
      setQrCodeDataUrl(qrCode);
      setSyncData(data);
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

                {qrCodeDataUrl && (
                  <div className="text-center">
                    <div className="bg-white p-4 rounded-lg border inline-block">
                      <img
                        src={qrCodeDataUrl}
                        alt="QRコード"
                        className="w-48 h-48"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      他のデバイスでこのQRコードを読み取ってください
                    </p>
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
                  <div className="space-y-3">
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <div className="text-sm">
                        <strong>件名:</strong> {emailData.subject}
                      </div>
                      <div className="text-sm mt-2">
                        <strong>内容:</strong>
                        <pre className="text-xs mt-1 whitespace-pre-wrap">{emailData.body}</pre>
                      </div>
                    </div>
                    
                    <button
                      onClick={sendEmail}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                    >
                      <Mail className="h-4 w-4" />
                      メールアプリで開く
                    </button>
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