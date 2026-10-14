// Elenca i modelli Gemini che generano immagini disponibili con la tua chiave (npm run modelli)
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config({ path: '.env.local', quiet: true });
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
for await (const m of await ai.models.list()) {
  const name = String(m.name ?? '').replace(/^models\//, '');
  if (/image|banana/i.test(`${name} ${m.displayName ?? ''}`)) console.log(`${name} — ${m.displayName ?? ''}`);
}
