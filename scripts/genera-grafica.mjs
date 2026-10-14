// Crea con Gemini la grafica di Axend Games in stile film d'animazione (tipo Disney):
// logo, copertine dei giochi, carte segrete e 12 personaggi per gli avatar. Finiscono in public/art/.
// Uso: npm run chiave (una volta sola), poi npm run grafica, poi npm run deploy per metterla online.
// Le immagini già create vengono saltate: se si ferma, rilancialo e riparte da dove era.
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
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

const STYLE =
  'High quality 3D animated feature film style, like a modern Disney Pixar family movie: adorable characters with big expressive eyes, ' +
  'soft cinematic lighting, rich saturated colors, rounded friendly shapes, playful magical mood, purple and gold color accents. ' +
  'No text, no letters, no words, no logos, no watermark.';

const AVATARS = [
  ['av1', 'a cute little orange fox cub with big eyes wearing a cozy red scarf'],
  ['av2', 'a cheerful panda wearing cool sunglasses'],
  ['av3', 'a frog detective holding a magnifying glass'],
  ['av4', 'a friendly tiger wearing a bow tie'],
  ['av5', 'a smiling purple octopus'],
  ['av6', 'a unicorn with a sparkly rainbow mane'],
  ['av7', 'a friendly little green alien'],
  ['av8', 'a small round cute robot with glowing eyes'],
  ['av9', 'a penguin wearing a tuxedo'],
  ['av10', 'a proud lion wearing a tiny golden crown'],
  ['av11', 'a black cat wearing a burglar eye mask'],
  ['av12', 'a wise owl professor with round glasses'],
];

const ASSETS = [
  {
    file: 'logo',
    aspect: '1:1',
    size: [512, 512],
    prompt: 'App mascot: a cute round purple creature with big sparkling eyes happily holding a glowing smartphone like a game controller, confetti and golden stars around it, centered, simple purple-blue gradient background.',
  },
  {
    file: 'gioco-spia',
    aspect: '16:9',
    size: [800, 450],
    prompt: 'Game cover: a charming cartoon fox secret agent in a fedora and trench coat peeking around a corner with a magnifying glass, in a moonlit purple city street at night, playful mystery.',
  },
  {
    file: 'gioco-impostore',
    aspect: '16:9',
    size: [800, 450],
    prompt: 'Game cover: a row of identical cute round blue characters smiling on a stage, and among them one sneaky orange character wearing an obvious fake mustache and glasses trying to blend in, spotlight, funny.',
  },
  {
    file: 'gioco-telefono',
    aspect: '16:9',
    size: [800, 450],
    prompt: 'Game cover: cute cartoon friends passing smartphones in a chain, each screen shows a funny childish doodle (a cat, a rocket, a pizza), crayons and colorful paper flying, joyful chaos.',
  },
  {
    file: 'carta-coperta',
    aspect: '1:1',
    size: [640, 640],
    prompt: 'A closed top-secret envelope with a golden wax seal shaped like a question mark, glowing magically, floating in a purple starry night sky.',
  },
  {
    file: 'carta-spia',
    aspect: '1:1',
    size: [640, 640],
    prompt: 'A cute cartoon fox secret agent wearing a fedora hat and dark sunglasses, winking playfully with a sly smile, dramatic red and purple lighting.',
  },
  {
    file: 'carta-impostore',
    aspect: '1:1',
    size: [640, 640],
    prompt: 'A cute cartoon character wearing an obvious fake mustache and big glasses disguise, sweating nervously with a guilty smile, red spotlight on a purple background, comedic.',
  },
  {
    file: 'gioco-disegna',
    aspect: '16:9',
    size: [800, 450],
    prompt: 'Game cover: cute cartoon friends around a big drawing easel, one is drawing a funny wobbly cat with a crayon while the others lean in excitedly trying to guess, colorful crayons everywhere.',
  },
  {
    file: 'gioco-bomba',
    aspect: '16:9',
    size: [800, 450],
    prompt: 'Game cover: a cute round cartoon bomb with big nervous eyes and a sparkling lit fuse flying through the air between cute cartoon friends who panic and laugh, comedic action.',
  },
  {
    file: 'gioco-artista',
    aspect: '16:9',
    size: [800, 450],
    prompt: 'Game cover: cute cartoon artists painting together on one big canvas, each with a different color brush, and one sneaky artist wearing a fake mustache pretending to know what to paint.',
  },
  {
    file: 'gioco-battute',
    aspect: '16:9',
    size: [800, 450],
    prompt: 'Game cover: cute cartoon friends at a tiny comedy club stage, one holding a microphone telling a joke while the others laugh so hard they cry and fall off their chairs, warm spotlight, confetti, joyful.',
  },
  {
    file: 'gioco-preferiresti',
    aspect: '16:9',
    size: [800, 450],
    prompt: 'Game cover: a cute cartoon character at a fork in a magical path, scratching its head while choosing between two funny options: on the left a giant slice of pizza with a cactus on top, on the right a giant ice cream cone being chased by a rain cloud, comedic dilemma.',
  },
  {
    file: 'gioco-sintonia',
    aspect: '16:9',
    size: [800, 450],
    prompt: 'Game cover: cute cartoon friends gathered around a giant colorful half-circle dial with a big wooden needle, one friend wearing a mystic turban and holding a glowing crystal ball, the others concentrating and pointing, magical sparkles.',
  },
  {
    file: 'gioco-tabu',
    aspect: '16:9',
    size: [800, 450],
    prompt: 'Game cover: a cute cartoon character miming and explaining with huge exaggerated gestures, a teammate guessing excitedly with a lightbulb above its head, and a sneaky opponent about to slam a big red buzzer button, colorful game show stage.',
  },
  {
    file: 'gioco-chisono',
    aspect: '16:9',
    size: [800, 450],
    prompt: 'Game cover: cute cartoon friends each wearing a headband with a mystery card on the forehead showing simple pictures (a crown, a pirate hat, a carrot), one puzzled character with a big glowing question mark above its head while the others giggle.',
  },
  {
    file: 'gioco-teatrino',
    aspect: '16:9',
    size: [800, 450],
    prompt: 'Game cover: a cute cartoon character on a tiny theater stage with red velvet curtains, reciting dramatically with a hand on the forehead, while an audience of cute friends leans forward trying to guess the acting style, warm spotlight, comedic.',
  },
  {
    file: 'gioco-smorfie',
    aspect: '16:9',
    size: [800, 450],
    prompt: 'Game cover: cute cartoon friends taking selfies with smartphones while making hilarious exaggerated faces (cross-eyed, tongue out, super shocked), instant photos flying around, colorful camera flashes, joyful chaos.',
  },
  {
    file: 'gioco-dadi',
    aspect: '16:9',
    size: [800, 450],
    prompt: 'Game cover: cute cartoon friends around a wooden table each hiding dice under a cup, one slyly peeking under its cup with a sneaky grin, another pointing suspiciously, dice scattered on the table, warm cozy tavern lighting, playful bluffing.',
  },
  {
    file: 'gioco-oca',
    aspect: '16:9',
    size: [800, 450],
    prompt: 'Game cover: a giant colorful spiral board game path in a magical meadow, a cute goose wearing a tiny crown hopping on the squares, cute cartoon friends standing on the path like game pawns, a big white die tumbling in the air, playful.',
  },
  {
    file: 'gioco-nonridere',
    aspect: '16:9',
    size: [800, 450],
    prompt: 'Game cover: a cute cartoon clown character making a silly face and juggling rubber chickens in front of cute friends who desperately try not to laugh, cheeks puffed and hands over their mouths, one about to burst out laughing, comedic.',
  },
  // giochi flat a moduli (src/data/flatGames.ts)
  {
    file: 'gioco-lupi',
    aspect: '16:9',
    size: [800, 450],
    prompt: 'Game cover: a cozy cartoon medieval village at night under a huge full moon, cute villagers peeking nervously from their windows while two sneaky cartoon werewolves with goofy grins tiptoe between the houses, purple moonlight, playful spooky mystery.',
  },
  {
    file: 'gioco-missione',
    aspect: '16:9',
    size: [800, 450],
    prompt: 'Game cover: a team of cute cartoon secret agents in sunglasses around a glowing mission table with a holographic map, one agent behind them secretly cutting a wire with a sneaky grin, spy movie lighting, playful tension.',
  },
  {
    file: 'gioco-infiltrato',
    aspect: '16:9',
    size: [800, 450],
    prompt: 'Game cover: cute cartoon friends asking questions to a wise old cartoon chef holding a sealed golden envelope, while one friend in the group winks at the viewer with a top hat hiding a tiny copy of the same envelope, game show lighting, playful mystery.',
  },
  {
    file: 'gioco-rose',
    aspect: '16:9',
    size: [800, 450],
    prompt: 'Game cover: a wooden bar table seen from above with stacks of round coasters, some painted with red roses and one with a cartoon skull, cute cartoon hands nervously flipping a coaster, warm tavern light, bluffing tension.',
  },
  {
    file: 'gioco-bestie',
    aspect: '16:9',
    size: [800, 450],
    prompt: 'Game cover: cute cartoon friends around a table passing face-down cards to each other with suspicious looks, cartoon cockroach, rat, bat, frog, spider and scorpion characters peeking out of the cards with goofy faces, comedic bluffing.',
  },
  {
    file: 'gioco-intrigo',
    aspect: '16:9',
    size: [800, 450],
    prompt: 'Game cover: a lavish cartoon royal court with a sly duke counting gold coins, a sneaky assassin with a tiny dagger, a captain and an elegant countess whispering behind fans, everyone hiding cards behind their backs, dramatic purple and gold lighting.',
  },
  {
    file: 'gioco-corte',
    aspect: '16:9',
    size: [800, 450],
    prompt: 'Game cover: a cute cartoon princess on a balcony of a fairytale castle waiting for a love letter, cartoon guards, a priest, a baron and a prince racing up the stairs holding envelopes with red wax hearts, romantic comedy.',
  },
  {
    file: 'gioco-dizionario',
    aspect: '16:9',
    size: [800, 450],
    prompt: 'Game cover: a giant ancient open dictionary glowing with magic, cute cartoon friends wearing tiny scholar glasses inventing silly definitions, one with a huge feather quill, floating letters-free paper pages, cozy library, comedic.',
  },
  {
    file: 'gioco-codici',
    aspect: '16:9',
    size: [800, 450],
    prompt: 'Game cover: two cute cartoon teams, red and blue, on opposite sides of a big grid of blank secret cards on a table, each team captain wearing a spy headset and whispering a secret clue, glowing card highlights, game show tension.',
  },
  {
    file: 'gioco-parolaunica',
    aspect: '16:9',
    size: [800, 450],
    prompt: 'Game cover: cute cartoon friends each holding up a small blank sign toward a blindfolded friend in the middle who is thinking hard with a glowing lightbulb above the head, colorful confetti, cooperative fun.',
  },
  {
    file: 'gioco-scala10',
    aspect: '16:9',
    size: [800, 450],
    prompt: 'Game cover: a cute cartoon team captain on a colorful game show stage ordering a row of glowing cards on a giant ladder that goes from small to huge, friends cheering, one friend laughing at a ridiculous card, joyful.',
  },
  {
    file: 'gioco-gregge',
    aspect: '16:9',
    size: [800, 450],
    prompt: 'Game cover: a flock of cute fluffy cartoon sheep all thinking the same thought shown by identical clouds above their heads, and one black sheep with a different silly thought looking embarrassed, green meadow, comedic.',
  },
  {
    file: 'gioco-mente',
    aspect: '16:9',
    size: [800, 450],
    prompt: 'Game cover: cute cartoon friends sitting in a circle in total silence with closed eyes and glowing foreheads, a stack of numbered cards floating in the middle with magical light connecting their minds, calm cosmic purple background, tension and focus.',
  },
  {
    file: 'gioco-nomicose',
    aspect: '16:9',
    size: [800, 450],
    prompt: 'Game cover: cute cartoon friends scribbling frantically on paper sheets with pencils around a table, a giant glowing alphabet letter block in the middle, an hourglass running out, one friend slamming a big red STOP button, energetic.',
  },
  {
    file: 'gioco-quizzone',
    aspect: '16:9',
    size: [800, 450],
    prompt: 'Game cover: a dazzling cartoon TV quiz show stage with four colorful glowing answer buttons, cute cartoon contestants at podiums slamming buttons, spotlights and confetti, game show excitement.',
  },
  {
    file: 'gioco-emoji',
    aspect: '16:9',
    size: [800, 450],
    prompt: 'Game cover: cute cartoon friends staring at a giant smartphone screen full of big colorful 3D emoji faces and objects forming a puzzle, one friend with a lightbulb moment, playful bright colors.',
  },
  {
    file: 'gioco-ghigliottina',
    aspect: '16:9',
    size: [800, 450],
    prompt: 'Game cover: a dramatic cartoon game show stage with a giant comically oversized golden guillotine-shaped blade made of cardboard above a glowing prize chest, a cute contestant thinking hard with five glowing blank cards floating around, theatrical lighting, comedic suspense.',
  },
  {
    file: 'gioco-stima',
    aspect: '16:9',
    size: [800, 450],
    prompt: 'Game cover: cute cartoon friends betting colorful poker chips on a long row of glowing number tiles on a casino style table, one friend squinting at a giant measuring tape and jar of jellybeans, playful estimation game.',
  },
  {
    file: 'gioco-cinque',
    aspect: '16:9',
    size: [800, 450],
    prompt: 'Game cover: a row of five big glossy tiles colored green, yellow and grey floating in the air, cute cartoon friends racing to type on giant keyboards, sparkles when a tile flips green, bright puzzle game.',
  },
  {
    file: 'gioco-microsfide',
    aspect: '16:9',
    size: [800, 450],
    prompt: 'Game cover: chaotic super fun collage of tiny microgames: a cute cartoon character tapping a target, catching a falling pizza, dodging a bomb, slicing fruit, popping a balloon, all bursting out of a giant smartphone, frantic energetic colors.',
  },
  {
    file: 'bomba',
    aspect: '1:1',
    size: [400, 400],
    prompt: 'A cute round black cartoon bomb character with big expressive nervous eyes and a sparkling lit fuse, centered on a plain purple background.',
  },
  ...AVATARS.map(([file, who]) => ({
    file: `avatars/${file}`,
    aspect: '1:1',
    size: [256, 256],
    prompt: `Character portrait for a game avatar: ${who}, head and shoulders, facing the viewer, friendly smile, plain soft pastel background.`,
  })),
];

// Sceglie un modello Gemini che genera immagini tra quelli disponibili per la chiave
async function pickModel() {
  // Nano Banana Pro per la qualità migliore, poi Nano Banana 2, poi il primo Nano Banana
  const preferred = [
    process.env.GEMINI_IMAGE_MODEL,
    'gemini-3-pro-image',
    'gemini-3-pro-image-preview',
    'gemini-3.1-flash-image',
    'gemini-3.1-flash-image-preview',
    'gemini-2.5-flash-image',
  ].filter(Boolean);
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

async function generate(model, prompt, aspect) {
  const request = (withAspect) =>
    ai.models.generateContent({
      model,
      contents: prompt,
      config: { responseModalities: ['TEXT', 'IMAGE'], ...(withAspect ? { imageConfig: { aspectRatio: aspect } } : {}) },
    });
  let res;
  try {
    res = await request(true);
  } catch (e) {
    // alcuni modelli non accettano il formato: si riprova senza
    if (!/aspect|imageConfig|INVALID_ARGUMENT/i.test(String(e?.message))) throw e;
    res = await request(false);
  }
  // Nano Banana Pro manda anche delle bozze mentre "pensa": si tiene solo l'immagine finale
  const parts = res.candidates?.[0]?.content?.parts ?? [];
  const image = parts.filter((p) => p.inlineData?.data && !p.thought).pop();
  if (!image) {
    const text = parts
      .map((p) => p.text)
      .filter(Boolean)
      .join(' ')
      .slice(0, 160);
    throw new Error(`nessuna immagine nella risposta (${res.candidates?.[0]?.finishReason ?? '?'})${text ? `: ${text}` : ''}`);
  }
  return Buffer.from(image.inlineData.data, 'base64');
}

const model = await pickModel();
console.log(`Modello: ${model}`);
let created = 0;

const only = process.argv[2]; // es. "npm run grafica -- avatars" per crearne solo una parte
for (const asset of ASSETS) {
  if (only && !asset.file.includes(only)) continue;
  const file = `public/art/${asset.file}.webp`;
  if (existsSync(file)) continue;
  mkdirSync(dirname(file), { recursive: true });
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const png = await generate(model, `${STYLE}\n${asset.prompt}`, asset.aspect);
      await sharp(png).resize(asset.size[0], asset.size[1], { fit: 'cover' }).webp({ quality: 80 }).toFile(file);
      created++;
      console.log(`✓ ${asset.file}`);
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
        console.error(`✗ ${asset.file} (tentativo ${attempt}): ${msg}`);
        await sleep(5000);
      }
    }
  }
  await sleep(3000); // resta sotto i limiti del piano gratuito
}

console.log(`Fatto: ${created} immagini nuove in public/art. Per metterle online: npm run deploy`);
