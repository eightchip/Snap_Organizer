// Mock OCR functionality - in production, this would integrate with a real OCR service
export const extractTextFromImage = async (imageFile: File): Promise<string> => {
  // Simulate OCR processing time
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Generate mock OCR text based on image name or random content
  const mockTexts = [
    "郵便番号 123-4567\n東京都渋谷区神南1-2-3\n山田太郎様\n重要なお知らせ",
    "会議資料\n2024年3月15日\nプロジェクト進捗について\n・開発進捗 80%\n・テスト完了予定 3月末",
    "旅行メモ\n京都観光\n清水寺 - 午前中訪問\n嵐山 - 竹林散策\n金閣寺 - 夕方",
    "買い物リスト\n牛乳\nパン\n卵\nりんご\nヨーグルト",
    "レシート\nコンビニ ABC\n2024/03/15 14:23\nお弁当 ¥480\n飲み物 ¥120\n合計 ¥600"
  ];
  
  return mockTexts[Math.floor(Math.random() * mockTexts.length)];
};

export const imageToDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};