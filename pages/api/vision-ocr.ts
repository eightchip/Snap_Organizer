import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: any, res: any) {
  const { imageBase64 } = req.body;
  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;

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
  const data = await response.json();
  const text = data.responses?.[0]?.fullTextAnnotation?.text || '';
  res.status(200).json({ text });
}
