// Genera con Gemini le illustrazioni dei luoghi (stile film d'animazione 3D) in public/luoghi/<id>.webp
// Uso: metti GEMINI_API_KEY nel file .env.local, poi:
//   npm run immagini          -> tutte quelle che mancano
//   npm run immagini -- 5     -> solo 5 (per provare)
// Le immagini già create vengono saltate: se si ferma, rilancialo e riparte da dove era.
import { existsSync, mkdirSync } from 'node:fs';
import dotenv from 'dotenv';
import sharp from 'sharp';
import { GoogleGenAI } from '@google/genai';
import { DEFAULT_LOCATIONS } from '../src/data/locations';

dotenv.config({ path: '.env.local' });
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
  console.error('Manca la chiave: crea il file .env.local con la riga  GEMINI_API_KEY=la_tua_chiave');
  process.exit(1);
}

const OUT = 'public/luoghi';
const limit = Number(process.argv[2]) || Infinity;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ai = new GoogleGenAI({ apiKey });

// Stile descritto a parole: i modelli spesso rifiutano i nomi di studi e marchi
const STYLE =
  'A charming illustration in the style of a 3D animated family movie: soft cinematic lighting, vibrant warm colors, ' +
  'rounded shapes, cute expressive cartoon characters with big eyes. Square composition, rich details. ' +
  'No text, no letters, no logos, no watermarks.';

// Sceglie un modello Gemini che genera immagini tra quelli disponibili per la chiave
async function pickModel() {
  const preferred = [process.env.GEMINI_IMAGE_MODEL, 'gemini-2.5-flash-image', 'gemini-3-pro-image-preview', 'gemini-2.0-flash-preview-image-generation'].filter(Boolean);
  const models = [];
  try {
    for await (const m of await ai.models.list()) {
      models.push({ name: String(m.name ?? '').replace(/^models\//, ''), actions: m.supportedActions ?? [] });
    }
  } catch (e) {
    console.warn('Non riesco a leggere la lista dei modelli:', e.message);
  }
  const names = models.map((m) => m.name);
  return (
    preferred.find((p) => names.includes(p)) ??
    models.find((m) => m.name.includes('image') && m.actions.includes('generateContent'))?.name ??
    preferred[0]
  );
}

mkdirSync(OUT, { recursive: true });
const model = await pickModel();
console.log(`Modello: ${model}`);

let created = 0;
for (const loc of DEFAULT_LOCATIONS) {
  if (created >= limit) break;
  const file = `${OUT}/${loc.id}.webp`;
  if (existsSync(file)) continue;

  const prompt = `${STYLE}\nScene: "${loc.name}" (an Italian place), with characters such as ${loc.roles.slice(0, 3).join(', ')}.`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await ai.models.generateContent({ model, contents: prompt, config: { responseModalities: ['TEXT', 'IMAGE'] } });
      const part = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
      if (!part) throw new Error('nessuna immagine nella risposta');
      await sharp(Buffer.from(part.inlineData.data, 'base64')).resize(640, 640, { fit: 'cover' }).webp({ quality: 78 }).toFile(file);
      created++;
      console.log(`✓ ${loc.name}`);
      break;
    } catch (e) {
      const msg = String(e?.message ?? e);
      if (/RESOURCE_EXHAUSTED|quota|429/i.test(msg)) {
        if (attempt === 3) {
          console.error('Limite di utilizzo della chiave raggiunto. Rilancia più tardi: riparte da dove si è fermato.');
          process.exit(1);
        }
        console.log('  limite momentaneo, aspetto un minuto…');
        await sleep(60000);
      } else if (/billing|PERMISSION_DENIED|API key|403|404|not found/i.test(msg)) {
        console.error(`Errore con la chiave o il modello: ${msg}`);
        process.exit(1);
      } else {
        console.error(`✗ ${loc.name} (tentativo ${attempt}): ${msg}`);
        await sleep(5000);
      }
    }
  }
  await sleep(4000); // resta sotto i limiti del piano gratuito
}

console.log(`Fatto: ${created} immagini nuove in ${OUT}. Per metterle online: npm run deploy`);
