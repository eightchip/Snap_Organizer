# ErrorHandling: IndexedDB 永続化・初期化エラー対策まとめ

## 1. 今回発生した主な問題

- **リロードやインポート後にデータが消える**
- **「IndexedDBが初期化されていません」エラーが発生**
- デプロイ環境（Vercel等）や複数端末でデータが保持されない
- カスタムアイコンだけは消えず、他のデータが消える現象

## 2. 原因

- IndexedDBのグローバル変数（db）が非同期初期化の競合でnullのまま使われることがあった
- storage.tsでimageDB/dbを直接参照し、初期化タイミングによってはnull参照エラー
- サーバーサイドやSSR環境でIndexedDB初期化を試みて失敗
- 複数箇所から同時にinitDBが呼ばれ、race conditionが発生

## 3. 修正したポイント

- **initDBの同時初期化ガード（dbPromise）を導入**
    - 複数箇所から同時に呼ばれても1つのPromiseだけが走るように
- **initDBを必ずexportし、storage.tsではawait initDB()でDBインスタンスを取得してから使う設計に統一**
- **サーバーサイドやwindowがない環境では初期化しないガードを追加**
- usePostalTagsやlocalStorage('postal_tags')の全廃、Appのstate/props統一

## 4. 今後の対策・ベストプラクティス

- **IndexedDBのインスタンスはグローバル変数で直接参照せず、必ずawait initDB()で取得する**
- **SSR/サーバーサイドではIndexedDBを絶対に触らない（typeof windowチェックを徹底）**
- **非同期初期化の競合/race conditionを防ぐため、Promiseガードを使う**
- **データ消失・初期化失敗時はユーザーに明確なエラー表示を行う**
- **永続化・インポート/エクスポートのテストは必ず複数端末・リロード・PWA環境で行う**

---

### 参考: 典型的なエラー例

- `Error: IndexedDBが初期化されていません`
- `データの読み込みに失敗しました: ...`
- `Failed to load resource: the server responded with a status of 401 (manifest.json)`（これは永続化とは無関係）

---

### もし再発した場合のチェックリスト

1. **initDBが必ずawaitされているか？**
2. **dbやimageDBを直接参照していないか？**
3. **サーバーサイドでIndexedDBを触っていないか？**
4. **ブラウザのIndexedDBストアにstorage_dataが存在するか？**
5. **複数端末・リロード・インポート/エクスポートでデータが保持されるか？**

---

何か問題が再発した場合は、このファイルの内容を参考にデバッグ・修正してください。 