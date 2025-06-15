export function normalizeOcrText(text: string): string {
  // 1. 全角スペース→半角
  let result = text.replace(/[\u3000]/g, ' ');
  // 2. 改行・タブ・不可視文字を半角スペースに
  result = result.replace(/[\r\n\t\v\f\u200B-\u200D\uFEFF]/g, ' ');
  // 3. 全角数字→半角数字
  result = result.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFF10 + 0x30));
  // 4. 全角ダッシュ（―）→全角長音（ー）
  result = result.replace(/―/g, 'ー');
  // 5. 連続する空白を1つに
  result = result.replace(/ +/g, ' ');
  // 6. 前後の空白を除去
  result = result.trim();
  // 7. 日本語（漢字・ひらがな・カタカナ）と数字の間のスペースを除去
  result = result.replace(/([\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}0-9]) ([\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}0-9])/gu, '$1$2');
  return result;
}
