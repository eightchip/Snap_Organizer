import { invoke } from '@tauri-apps/api/core';

// base64画像をRustでリサイズ
export async function rustResizeImage(base64: string, width: number, height: number): Promise<string> {
  return await invoke<string>('resize_image', { base64Input: base64, width, height });
}
