// Crea il modello 3D del Custode: Nano Banana disegna il concept (in posa A, corpo intero), Meshy lo trasforma
// in un modello 3D con le texture e poi gli costruisce lo scheletro (con camminata e corsa).
// Uso:  npm run mostro               (tutto)
//       npm run mostro -- --disegno  (solo il disegno, per guardarlo prima)
// Ogni passaggio finito viene ricordato in public/horror/models/custode.json: rilanciando si riparte da lì (non si paga due volte).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import dotenv from 'dotenv';
import sharp from 'sharp';
import { GoogleGenAI } from '@google/genai';

dotenv.config({ path: '.env.local', quiet: true });
const NAME = process.argv.find((a) => a.startsWith('--nome='))?.slice(7) ?? 'custode';
const ONLY_DRAW = process.argv.includes('--disegno');
const DIR = 'public/horror/models';
const CONCEPT = `public/horror/concept/${NAME}.png`;
const STATE = `${DIR}/${NAME}.json`;
mkdirSync(DIR, { recursive: true });
mkdirSync('public/horror/concept', { recursive: true });
const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : {};
const save = () => writeFileSync(STATE, JSON.stringify(state, null, 2));

const PROMPTS = {
  custode:
    'Full body character concept art for 3D modeling, front view, A-pose with the arms held slightly away from the body, the whole figure visible from head to feet, centered, plain light grey studio background, soft even lighting, no shadows on the background. ' +
    'A horrifying very tall emaciated humanoid creature called the Caretaker, once the night caretaker of an old apartment building: grey-green wet stretched skin, a visible ribcage, sunken belly, hunched bony shoulders, ' +
    'extremely long thin arms that reach below the knees ending in long bony fingers with dirty nails, long thin legs with knobbly knees, bare feet with long toes, ' +
    'torn stiff filthy olive work dungarees hanging off one shoulder, stained by mold and water, a rusty set of keys on a belt loop, ' +
    'the head is bald with no eyes, only dark sunken sockets, and an unnaturally wide grin full of thin yellow teeth stretching from ear to ear. ' +
    'Photorealistic horror, extremely detailed skin and fabric. No text, no letters, no watermark, single character only.',
};

// ---------------------------------------------------------------- 1. il disegno con Nano Banana
if (!existsSync(CONCEPT)) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('Manca la chiave Gemini: lancia prima  npm run chiave');
    process.exit(1);
  }
  const ai = new GoogleGenAI({ apiKey });
  console.log('Disegno il concept con Nano Banana…');
  let ok = false;
  for (const model of [process.env.GEMINI_IMAGE_MODEL, 'gemini-3-pro-image', 'gemini-3-pro-image-preview', 'gemini-2.5-flash-image'].filter(Boolean)) {
    try {
      const res = await ai.models.generateContent({ model, contents: PROMPTS[NAME], config: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: '3:4' } } });
      const img = (res.candidates?.[0]?.content?.parts ?? []).filter((p) => p.inlineData?.data && !p.thought).pop();
      if (!img) throw new Error('nessuna immagine');
      await sharp(Buffer.from(img.inlineData.data, 'base64')).resize(1024, 1365, { fit: 'inside' }).png().toFile(CONCEPT);
      console.log(`  fatto con ${model}: ${CONCEPT}`);
      ok = true;
      break;
    } catch (e) {
      console.warn(`  ${model}: ${e.message}`);
    }
  }
  if (!ok) process.exit(1);
} else console.log('Concept già pronto:', CONCEPT);
if (ONLY_DRAW) process.exit(0);

// ---------------------------------------------------------------- 2. il modello 3D con Meshy
const MESHY = process.env.MESHY_API_KEY;
if (!MESHY) {
  console.error('Manca la chiave Meshy: lancia prima  npm run chiave-meshy');
  process.exit(1);
}
const api = async (method, path, body) => {
  const res = await fetch(`https://api.meshy.ai${path}`, {
    method,
    headers: { Authorization: `Bearer ${MESHY}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Meshy ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
};
const wait = async (path) => {
  for (;;) {
    const t = await api('GET', path);
    process.stdout.write(`\r  ${t.status} ${t.progress ?? 0}%   `);
    if (t.status === 'SUCCEEDED') {
      process.stdout.write('\n');
      return t;
    }
    if (t.status === 'FAILED' || t.status === 'CANCELED') throw new Error(`compito ${t.status}: ${JSON.stringify(t.task_error ?? {})}`);
    await new Promise((r) => setTimeout(r, 8000));
  }
};
const download = async (url, out) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status}`);
  writeFileSync(out, Buffer.from(await res.arrayBuffer()));
  console.log(`  salvato ${out} (${Math.round(Buffer.byteLength(readFileSync(out)) / 1024)} KB)`);
};

if (!state.modelTask) {
  console.log('Creo il modello 3D (Meshy, immagine → 3D, in posa A, con texture PBR)…');
  const b64 = readFileSync(CONCEPT).toString('base64');
  const r = await api('POST', '/openapi/v1/image-to-3d', {
    image_url: `data:image/png;base64,${b64}`,
    ai_model: 'latest',
    should_texture: true,
    enable_pbr: true,
    pose_mode: 'a-pose',
    should_remesh: true,
    target_polycount: 30000,
    texture_resolution: '2k',
    target_formats: ['glb'],
  });
  state.modelTask = r.result;
  save();
}
const model = await wait(`/openapi/v1/image-to-3d/${state.modelTask}`);
if (!existsSync(`${DIR}/${NAME}_statico.glb`) && model.model_urls?.glb) await download(model.model_urls.glb, `${DIR}/${NAME}_statico.glb`);

// ---------------------------------------------------------------- 3. lo scheletro (e camminata/corsa)
if (!state.rigTask) {
  console.log('Costruisco lo scheletro (Meshy rigging)…');
  const r = await api('POST', '/openapi/v1/rigging', { input_task_id: state.modelTask, height_meters: 2.5 });
  state.rigTask = r.result;
  save();
}
const rig = await wait(`/openapi/v1/rigging/${state.rigTask}`);
const res = rig.result ?? {};
if (res.rigged_character_glb_url) await download(res.rigged_character_glb_url, `${DIR}/${NAME}.glb`);
if (res.basic_animations?.walking_glb_url) await download(res.basic_animations.walking_glb_url, `${DIR}/${NAME}_cammina.glb`);
if (res.basic_animations?.running_glb_url) await download(res.basic_animations.running_glb_url, `${DIR}/${NAME}_corre.glb`);
state.done = true;
save();
console.log('Fatto: il modello è in', DIR);
