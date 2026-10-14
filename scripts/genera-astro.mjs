// Crea con Gemini (Nano Banana) la grafica del videogioco "Astro Impostori":
// l'astronauta (bianco: il colore lo dà il gioco), gli oggetti delle stanze e la copertina.
// Gli sprite nascono su uno sfondo verde (o magenta) pieno che poi viene reso trasparente.
// Uso: npm run astro   (le immagini già create vengono saltate)
import { existsSync, mkdirSync } from 'node:fs';
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SPRITE_STYLE =
  'High quality 3D animated cartoon style like a modern Pixar movie, cute, chunky and rounded shapes, soft studio lighting, clean outlines. ' +
  'Single isolated object only, centered, fully visible with some margin. No text, no letters, no logo, no watermark, no shadow on the ground.';
const BG = {
  green: 'The background must be one perfectly flat solid pure green color (#00FF00), with no gradient, no texture and no shadows.',
  magenta: 'The background must be one perfectly flat solid pure magenta color (#FF00FF), with no gradient, no texture and no shadows.',
};
const COVER_STYLE =
  'High quality 3D animated feature film style, like a modern Disney Pixar family movie: adorable characters with big expressive eyes, ' +
  'soft cinematic lighting, rich saturated colors, rounded friendly shapes, playful magical mood, purple and gold color accents. ' +
  'No text, no letters, no words, no logos, no watermark.';

const SPRITES = [
  ['crew', 'green', 260, 'A cute round chubby astronaut character: one big round body, two tiny stubby legs, a small backpack on the back, the whole suit pure WHITE, a big glossy pitch-black visor with one small white highlight. Standing, seen from the side and facing right, full body.'],
  ['table', 'green', 300, 'Top-down view of a round spaceship cafeteria table with a big glowing red emergency button in the center.'],
  ['reactor', 'green', 300, 'Top-down view of a glowing blue reactor core machine with chunky pipes, a spaceship interior object.'],
  ['engine', 'green', 300, 'Top-down view of a big round spaceship engine turbine glowing orange inside.'],
  ['medbay', 'green', 280, 'Top-down view of a round medical scanner platform with a glowing cyan ring of light.'],
  ['nav', 'green', 280, 'Top-down view of a curved navigation console desk with a glowing holographic blue star map above it.'],
  ['electric', 'green', 260, 'Top-down view of an open electrical panel box full of colorful wires and small yellow sparks.'],
  ['crates', 'green', 300, 'Top-down view of a stack of wooden and metal storage crates and a couple of barrels.'],
  ['o2', 'magenta', 260, 'Top-down view of three oxygen tanks with blue glowing bubbles and a small potted leafy green plant.'],
  ['weapons', 'green', 280, 'Top-down view of a chunky spaceship laser cannon turret with a seat and a joystick.'],
  ['shields', 'green', 280, 'Top-down view of a round shield generator machine with a glowing cyan hexagon hologram above it.'],
  ['security', 'green', 300, 'Top-down view of a security desk with a curved wall of small glowing monitors showing camera views, and a swivel chair.'],
  ['lab', 'green', 300, 'Top-down view of a round science laboratory table with bubbling colorful flasks, test tubes and a microscope.'],
  ['admin', 'green', 300, 'Top-down view of a round admin table with a glowing blue holographic map of a spaceship floating above it.'],
  ['comms', 'green', 300, 'Top-down view of a communications console with a small satellite dish antenna, blinking lights and a headset.'],
  ['vent', 'magenta', 150, 'Top-down view of a square metal floor vent hatch with diagonal grate slats and four bolts, flat on the floor, slightly worn gray metal.'],
];
const COVER = {
  file: 'gioco-astro',
  prompt:
    'Game cover: cute round cartoon astronauts of different colors (red, blue, yellow, green, pink) in a cozy colorful spaceship corridor, one of them sneaky with a mischievous grin and glowing eyes while the others do not notice, stars through round windows, playful mystery.',
};

async function pickModel() {
  const preferred = [process.env.GEMINI_IMAGE_MODEL, 'gemini-3-pro-image', 'gemini-3-pro-image-preview', 'gemini-3.1-flash-image', 'gemini-3.1-flash-image-preview', 'gemini-2.5-flash-image'].filter(Boolean);
  const names = [];
  try {
    for await (const m of await ai.models.list()) names.push(String(m.name ?? '').replace(/^models\//, ''));
  } catch (e) {
    console.warn('Non riesco a leggere la lista dei modelli:', e.message);
  }
  return preferred.find((p) => names.includes(p)) ?? preferred[0];
}

async function generate(model, prompt, aspect) {
  const res = await ai.models.generateContent({
    model,
    contents: prompt,
    config: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: aspect } },
  });
  const parts = res.candidates?.[0]?.content?.parts ?? [];
  const image = parts.filter((p) => p.inlineData?.data && !p.thought).pop();
  if (!image) throw new Error(`nessuna immagine (${res.candidates?.[0]?.finishReason ?? '?'})`);
  return Buffer.from(image.inlineData.data, 'base64');
}

// Toglie lo sfondo verde/magenta: trasparente dove il colore è "di sfondo", morbido sui bordi, senza alone colorato
async function keyOut(png, bg) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const amount = bg === 'green' ? g - Math.max(r, b) : Math.min(r, b) - g; // quanto è "colore di sfondo"
    if (amount > 90) data[i + 3] = 0;
    else if (amount > 35) {
      data[i + 3] = Math.round(255 * (1 - (amount - 35) / 55));
      if (bg === 'green') data[i + 1] = Math.max(r, b);
      else {
        data[i] = Math.min(r, g + 40);
        data[i + 2] = Math.min(b, g + 40);
      }
    }
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

const model = await pickModel();
console.log(`Modello: ${model}`);
mkdirSync('public/art/astro', { recursive: true });

const jobs = [
  ...SPRITES.map(([file, bg, size, prompt]) => ({ out: `public/art/astro/${file}.webp`, file, bg, size, prompt: `${SPRITE_STYLE} ${BG[bg]}\n${prompt}`, aspect: '1:1' })),
  { out: `public/art/${COVER.file}.webp`, file: COVER.file, cover: true, prompt: `${COVER_STYLE}\n${COVER.prompt}`, aspect: '16:9' },
];

let created = 0;
for (const job of jobs) {
  if (existsSync(job.out)) continue;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const png = await generate(model, job.prompt, job.aspect);
      if (job.cover) await sharp(png).resize(800, 450, { fit: 'cover' }).webp({ quality: 80 }).toFile(job.out);
      else {
        const keyed = await keyOut(png, job.bg);
        const trimmed = await sharp(keyed).trim({ threshold: 10 }).toBuffer();
        await sharp(trimmed).resize(job.size, job.size, { fit: 'inside' }).webp({ quality: 85, alphaQuality: 90 }).toFile(job.out);
      }
      created++;
      console.log(`✓ ${job.file}`);
      break;
    } catch (e) {
      const msg = String(e?.message ?? e);
      console.error(`✗ ${job.file} (tentativo ${attempt}): ${msg.slice(0, 160)}`);
      if (/RESOURCE_EXHAUSTED|quota|429/i.test(msg)) await sleep(60000);
      else await sleep(4000);
    }
  }
  await sleep(2500);
}
console.log(`Fatto: ${created} immagini nuove. Per metterle online: npm run deploy`);
