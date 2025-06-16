export default async function handler(req: any, res: any) {
  try {
    // 1. リクエスト内容を確認
    console.log('Request body:', req.body);

    // 2. APIキーが取得できているか確認
    const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
    console.log('API Key:', apiKey ? 'Exists' : 'Missing');

    // 3. imageBase64が正しいか確認
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      console.error('imageBase64 is missing');
      return res.status(400).json({ error: 'imageBase64 is required' });
    }

    // 4. Google Vision APIへのリクエスト前にログ
    console.log('Sending request to Google Vision API...');

    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [
            {
              image: { content: imageBase64 },
              features: [{ type: 'TEXT_DETECTION' }]
            }
          ]
        })
      }
    );

    // 5. レスポンスのステータスと内容をログ
    console.log('Google Vision API response status:', response.status);
    const data = await response.json();
    console.log('Google Vision API response data:', data);

    // 6. 結果を返す
    const text = data.responses?.[0]?.fullTextAnnotation?.text || '';
    res.status(200).json({ text });
    console.log(text);
  } catch (error) {
    // 7. エラー内容をログ
    console.error('Internal Server Error:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
