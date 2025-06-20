import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import { resolve } from 'path';

// WASMファイルが存在するかチェック
const wasmExists = require('fs').existsSync('./your-wasm-pkg/pkg/your_wasm_pkg.js');

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // WASMファイルが存在する場合のみプラグインを有効化
    ...(wasmExists ? [wasm(), topLevelAwait()] : [])
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './'),
    },
  },
  optimizeDeps: {
    exclude: wasmExists ? ['your_wasm_pkg'] : []
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    },
    port: 3000
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: './index.html',
      },
      external: ['@tauri-apps/api/tauri'],
    },
  },
  define: {
    global: 'globalThis',
  },
}); 