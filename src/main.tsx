import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import init from './pkg/your_wasm_pkg';

// WebAssemblyモジュールの初期化
async function initializeApp() {
  try {
    await init();
    ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (error) {
    console.error('Failed to initialize WebAssembly module:', error);
    // エラーメッセージを表示
    document.getElementById('root')!.innerHTML = `
      <div style="padding: 20px; color: red;">
        アプリケーションの初期化に失敗しました。ページを再読み込みしてください。
      </div>
    `;
  }
}

initializeApp();
