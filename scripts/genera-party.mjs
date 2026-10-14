// Crea con Gemini (Nano Banana) la copertina di "Axend Party" (i personaggi del gioco sono fatti in 3D dal codice).
// Uso: npm run party   (se la copertina esiste già viene saltata; cancellala per rifarla)
import { existsSync } from 'node:fs';
import dotenv from 'dotenv';
import sharp from 'sharp';
import { GoogleGenAI } from '@google/genai';

dotenv.config({ path: '.env.local' });
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
  console.error('Manca la chiave Gemini: lancia prima  npm run chiave');
  process.exit(1);
}
const ai = new GoogleGenAI({ apiKey });
const OUT = 'public/art/gioco-party.webp';
const PROMPT =
  'High quality 3D animated game cover, bright and cheerful like Fall Guys mixed with Roblox: chunky blocky cartoon characters with square yellow heads, ' +
  'simple happy faces and colorful shirts (red, blue, green, pink, orange) having chaotic fun on a floating round candy-colored platform in the sky, ' +
  'one pushing another off the edge, one jumping with arms up, one falling with a funny surprised face, a giant cute doll in the background, ' +
  'colorful musical chairs, confetti, fluffy clouds, blue sky, rich saturated colors, soft cinematic lighting. No text, no letters, no words, no logos, no watermark.';

if (existsSync(OUT)) {
  console.log('La copertina esiste già:', OUT);
  process.exit(0);
}
const models = [process.env.GEMINI_IMAGE_MODEL, 'gemini-3-pro-image', 'gemini-3-pro-image-preview', 'gemini-3.1-flash-image', 'gemini-2.5-flash-image'].filter(Boolean);
for (const model of models) {
  try {
    const res = await ai.models.generateContent({
      model,
      contents: PROMPT,
      config: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: '16:9' } },
    });
    const image = (res.candidates?.[0]?.content?.parts ?? []).filter((p) => p.inlineData?.data && !p.thought).pop();
    if (!image) throw new Error('nessuna immagine');
    await sharp(Buffer.from(image.inlineData.data, 'base64')).resize(800, 450, { fit: 'cover' }).webp({ quality: 80 }).toFile(OUT);
    console.log(`Copertina creata con ${model}: ${OUT}`);
    process.exit(0);
  } catch (e) {
    console.warn(`${model}: ${e.message}`);
  }
}
process.exit(1);
