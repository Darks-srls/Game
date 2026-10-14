// Crea con Gemini (Nano Banana) le texture realistiche di "Non lasciarmi solo" e la copertina del gioco.
// Ogni texture viene resa ripetibile senza giunture e riceve anche la mappa del rilievo (normal map) per la luce della torcia.
// Uso: npm run horror   (le immagini già create vengono saltate; cancellale per rifarle)
import { existsSync, mkdirSync } from 'node:fs';
import dotenv from 'dotenv';
import sharp from 'sharp';
import { GoogleGenAI } from '@google/genai';

dotenv.config({ path: '.env.local', quiet: true });
dotenv.config({ quiet: true });

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
  console.error('Manca la chiave Gemini: lancia prima  npm run chiave');
  process.exit(1);
}
const ai = new GoogleGenAI({ apiKey });
const DIR = 'public/horror/tex';
mkdirSync(DIR, { recursive: true });

const FLAT =
  ' Flat orthographic photo straight on, even soft lighting with no shadows and no vignette, no perspective, the surface fills the entire image edge to edge, seamless tileable texture, photorealistic, high detail. No text, no letters, no logos, no watermark.';
const WALL =
  ' Straight-on photo of a wall section from floor to ceiling, filling the entire image, even soft lighting, no perspective, no furniture, no objects, horizontally seamless tileable, photorealistic, high detail. No text, no letters, no logos, no watermark.';

// organic: si può rendere ripetibile mescolando i bordi (superfici senza un disegno regolare)
const TEXTURES = [
  { name: 'intonaco', organic: true, prompt: 'Old matte painted plaster wall of a 1970s Italian apartment building stairwell, tired beige paint, faint cleaning marks, tiny hairline cracks, slightly dirtier near the bottom.' + WALL },
  { name: 'salvia', organic: true, prompt: 'Old matte sage green painted plaster wall of an Italian service corridor, worn paint, small chips, faint scuffs at hand height, darker grime near the floor.' + WALL },
  { name: 'scale', organic: true, prompt: 'Italian condominium stairwell wall: upper part matte grey-blue paint, lower third a darker glossy grey-blue protective band (zoccolo) with scuffs and scratches, a thin dividing line between them.' + WALL },
  { name: 'carta', organic: false, prompt: 'Faded old damask wallpaper in a 1970s Italian corridor, muted dusty mauve and beige pattern, slightly yellowed, a few small peeling seams and water stains near the bottom.' + WALL },
  { name: 'muroCantina', organic: true, prompt: 'Rough unpainted concrete block basement wall of an old building, damp patches, efflorescence salt stains, cold greenish grey tones, darker humidity near the floor.' + WALL },
  { name: 'metallo', organic: true, prompt: 'Grey industrial painted metal wall panels of an electrical meter room, matte paint with scratches, small rust spots, faint fingerprints, rivets along the edges.' + WALL },
  { name: 'piastrelle', organic: false, prompt: 'Old Italian bathroom and kitchen wall tiles 15x15 cm, off-white glossy ceramic with grey grout lines, some grout darkened, one tile slightly cracked, regular grid filling the image.' + WALL },
  { name: 'terrazzo', organic: true, prompt: 'Worn Italian terrazzo floor (graniglia) of a 1960s apartment building entrance hall, amber and cream marble chips in a warm beige binder, polished but dulled along walking paths, top-down view.' + FLAT },
  { name: 'cemento', organic: true, prompt: 'Old porous concrete basement floor, grey with darker damp stains, small cracks, patches of repair, dust, top-down view.' + FLAT },
  { name: 'linoleum', organic: true, prompt: 'Old worn green linoleum floor of a basement laundry room, faded mint green with scuffs, small dents and water marks, top-down view.' + FLAT },
  { name: 'parquet', organic: false, prompt: 'Old Italian apartment parquet floor, medium brown oak planks in a herringbone pattern, worn varnish, scratches, top-down view, regular pattern filling the image.' + FLAT },
  { name: 'cucina', organic: false, prompt: 'Retro 1970s Italian kitchen floor tiles 20x20 cm, ochre and brown geometric pattern, worn glaze, regular grid filling the image, top-down view.' + FLAT },
  { name: 'marmo', organic: true, prompt: 'Worn grey-white Carrara marble stair and landing floor of an old Italian condominium, soft grey veins, dulled by decades of footsteps, top-down view.' + FLAT },
  { name: 'soffitto', organic: true, prompt: 'Old white plaster ceiling of an apartment building, slightly yellowed, faint water stain rings, tiny cracks, top-down view.' + FLAT },
  { name: 'porta', organic: false, prompt: 'Front of an old dark varnished wooden apartment door from the 1970s, vertical panels, worn edges near the handle area, no handle, filling the whole image.' + ' Straight-on photo, even lighting, no perspective, photorealistic. No text, no numbers, no logos, no watermark.' },
  { name: 'acciaio', organic: false, prompt: 'Front of an old grey painted steel service door of a basement technical room, scratches, rust at the bottom edge, ventilation grille at the bottom, no handle, filling the whole image.' + ' Straight-on photo, even lighting, no perspective, photorealistic. No text, no numbers, no signs, no logos, no watermark.' },
  // il Custode
  { name: 'custodeVolto', organic: false, prompt: 'Front view of the face of a horrifying emaciated humanoid creature for a horror video game: grey-white wet stretched skin, empty deep black eye sockets, nose missing, an unnaturally elongated gaping black mouth with a few broken teeth, veins under the skin, centered, filling the frame, pure black background, photorealistic, dim cold light. No text, no watermark.' },
  { name: 'custodePelle', organic: true, prompt: 'Close-up of pale grey wet sickly skin texture of a creature, bluish veins, small wrinkles, damp sheen, slightly decayed spots.' + FLAT },
  { name: 'custodeTuta', organic: true, prompt: 'Close-up of dirty old work overalls fabric, dark olive grey canvas stiffened by humidity, mud and mold stains, small tears and frayed seams, water marks.' + FLAT },
  { name: 'ruggine', organic: true, prompt: 'Heavily rusted old iron surface, orange brown rust flakes over dark metal, pitted texture.' + FLAT },
  // arredi e superfici in più
  { name: 'bagno', organic: false, prompt: 'Old Italian bathroom wall tiles, small square pale blue glossy ceramic tiles with darkened grout, some mold in the grout near the bottom.' + WALL },
  { name: 'carta2', organic: false, prompt: 'Faded old 1960s Italian wallpaper with a small floral pattern in dull green and cream, yellowed, with a few peeling seams and a large water stain.' + WALL },
  { name: 'facciata', organic: true, prompt: 'Exterior facade of an old Italian 1970s apartment building: weathered ochre-grey plaster, dirty rain streaks, cracks and dark mold patches near the bottom.' + WALL },
  { name: 'asfalto', organic: true, prompt: 'Wet dark asphalt courtyard ground at night, small puddles, cracks, a few cobblestone patches, reflective wet surface.' + FLAT },
  { name: 'tessuto', organic: true, prompt: 'Old faded velvet sofa fabric in dusty bordeaux red, worn and slightly stained.' + FLAT },
  { name: 'tappeto', organic: false, prompt: 'Old Persian style rug pattern, faded red and navy, worn in the middle, top-down view filling the image.' + FLAT },
  { name: 'legnoMobili', organic: true, prompt: 'Dark walnut veneer furniture wood with fine grain, old varnish with small scratches.' + FLAT },
  { name: 'tenda', organic: true, prompt: 'Heavy old curtain fabric, dusty mustard yellow, vertical folds, slightly faded.' + FLAT },
];
const COVER = {
  out: 'public/art/gioco-horror1.webp',
  prompt:
    'Cinematic horror video game cover art, first person view in a dark old Italian apartment building stairwell at night, a maintenance worker flashlight beam cutting through dusty air, ' +
    'worn marble steps going up, grey-blue painted walls, a dim emergency light, and far up on the landing a very tall thin figure in stiff damp work overalls whose face is just a dark missing void, ' +
    'semi-realistic, muted desaturated colors with warm amber and cold green accents, volumetric light, film grain, scary but not gory. No text, no letters, no logos, no watermark.',
};

const MODELS = [process.env.GEMINI_IMAGE_MODEL, 'gemini-3-pro-image', 'gemini-3-pro-image-preview', 'gemini-3.1-flash-image', 'gemini-2.5-flash-image'].filter(Boolean);

async function generate(prompt, aspectRatio) {
  for (const model of MODELS) {
    try {
      const res = await ai.models.generateContent({ model, contents: prompt, config: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio } } });
      const image = (res.candidates?.[0]?.content?.parts ?? []).filter((p) => p.inlineData?.data && !p.thought).pop();
      if (!image) throw new Error('nessuna immagine');
      return { buf: Buffer.from(image.inlineData.data, 'base64'), model };
    } catch (e) {
      console.warn(`  ${model}: ${e.message}`);
    }
  }
  return null;
}

// Rende un'immagine ripetibile: al centro l'originale, verso i bordi la copia spostata di mezza immagine (che ai bordi è continua)
async function seamless(buf, N, horizontalOnly) {
  const { data } = await sharp(buf).resize(N, N, { fit: 'cover' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(N * N * 3);
  const half = N / 2;
  const edge = N * 0.22;
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const sx = (x + half) % N;
      const sy = horizontalOnly ? y : (y + half) % N;
      const dx = Math.min(x, N - 1 - x);
      const dy = Math.min(y, N - 1 - y);
      const wx = Math.min(1, dx / edge);
      const wy = horizontalOnly ? 1 : Math.min(1, dy / edge);
      const w = (wx * wx * (3 - 2 * wx)) * (wy * wy * (3 - 2 * wy));
      for (let k = 0; k < 3; k++) out[(y * N + x) * 3 + k] = Math.round(data[(y * N + x) * 3 + k] * w + data[(sy * N + sx) * 3 + k] * (1 - w));
    }
  return out;
}

// Mappa del rilievo dalla luminosità (le parti scure sono "più basse"): serve alla torcia per far vedere crepe e fughe
function normalMap(rgb, N, strength) {
  const h = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) h[i] = (rgb[i * 3] * 0.3 + rgb[i * 3 + 1] * 0.59 + rgb[i * 3 + 2] * 0.11) / 255;
  // sfocatura leggera (il rilievo non deve copiare il rumore dei pixel)
  const b = new Float32Array(N * N);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      let s = 0;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) s += h[((y + oy + N) % N) * N + ((x + ox + N) % N)];
      b[y * N + x] = s / 9;
    }
  const out = Buffer.alloc(N * N * 3);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const at = (xx, yy) => b[((yy + N) % N) * N + ((xx + N) % N)];
      const dx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1)) * strength;
      const dy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      out[(y * N + x) * 3] = Math.round(((-dx / len) * 0.5 + 0.5) * 255);
      out[(y * N + x) * 3 + 1] = Math.round(((dy / len) * 0.5 + 0.5) * 255);
      out[(y * N + x) * 3 + 2] = Math.round(((1 / len) * 0.5 + 0.5) * 255);
    }
  return out;
}

const N = 1024;
let made = 0;
for (const t of TEXTURES) {
  const out = `${DIR}/${t.name}.webp`;
  if (existsSync(out)) {
    console.log('già pronta:', t.name);
    continue;
  }
  console.log('creo:', t.name);
  const g = await generate(t.prompt, '1:1');
  if (!g) {
    console.error('  non riuscita:', t.name);
    continue;
  }
  const wall = /floor to ceiling|Front of/.test(t.prompt);
  let rgb;
  if (t.organic) rgb = await seamless(g.buf, N, wall);
  else rgb = (await sharp(g.buf).resize(N, N, { fit: 'cover' }).removeAlpha().raw().toBuffer({ resolveWithObject: true })).data;
  await sharp(rgb, { raw: { width: N, height: N, channels: 3 } }).webp({ quality: 82 }).toFile(out);
  await sharp(normalMap(rgb, N, t.name === 'piastrelle' || t.name === 'cucina' || t.name === 'parquet' ? 3.2 : 2.2), { raw: { width: N, height: N, channels: 3 } })
    .resize(512, 512)
    .webp({ quality: 80 })
    .toFile(`${DIR}/${t.name}_n.webp`);
  console.log(`  fatta con ${g.model}`);
  made++;
}
if (!existsSync(COVER.out)) {
  console.log('creo: copertina');
  const g = await generate(COVER.prompt, '16:9');
  if (g) {
    await sharp(g.buf).resize(800, 450, { fit: 'cover' }).webp({ quality: 80 }).toFile(COVER.out);
    console.log(`  fatta con ${g.model}`);
  }
}
console.log(`Fatto: ${made} texture nuove in ${DIR}`);
