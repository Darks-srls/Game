// ⚡ Microsfide: l'elenco delle sfide lampo, quello che vede ogni telefono e il generatore pseudo-casuale col seme
// condiviso. Il server sceglie sfida, seme e difficoltà; ogni telefono genera la STESSA sfida dallo stesso seme.

export type SfidaId =
  | 'ZANZARA'
  | 'FRUTTA'
  | 'PECORE'
  | 'INTRUSO'
  | 'SFUMATURA'
  | 'STROOP'
  | 'MAGGIORE'
  | 'BIRRA'
  | 'PIATTO'
  | 'PALLONCINO'
  | 'FRECCE'
  | 'PIZZA'
  | 'ORDINE'
  | 'MEMORIA'
  | 'SCHIVA'
  | 'TAGLIA'
  | 'GATTO'
  | 'CALCOLO'
  | 'CANDELINE'
  | 'PAROLA'
  | 'CANESTRO'
  | 'RUOTA'
  | 'SPAGHETTI'
  | 'RIGORE'
  | 'PARTENZA'
  | 'NONTOCCARE';

// com'è andata a un giocatore nell'ultima sfida (place: 1-3 tra i più veloci, 0 = niente bonus)
export interface MsResult {
  id: string;
  ok: boolean;
  ms: number | null;
  pts: number;
  place: number;
}

// cosa vede ciascun giocatore (nessun segreto: la sfida è uguale per tutti)
export interface MicrosfideView {
  stage: 'INTRO' | 'PLAY' | 'RESULT' | 'RANK' | 'END';
  order: string[];
  n: number; // sfida in corso (da 1)
  total: number;
  game: SfidaId;
  seed: number;
  diff: number; // 0 … MAX_DIFF
  playAt: number; // inizio del gioco (ora del server)
  endAt: number; // fine del gioco (senza tolleranza)
  stageEndsAt: number | null;
  done: string[]; // chi ha già mandato il risultato
  mine: { ok: boolean; ms: number } | null;
  results: MsResult[]; // solo dal RISULTATO in poi
  scores: Record<string, number>;
  before: Record<string, number>; // punti all'ultima classifica (per vedere chi è salito)
  wins: Record<string, number>; // sfide riuscite
  firsts: Record<string, number>; // volte che è stato il più veloce
}

export const MAX_DIFF = 4;
export const INTRO_MS = 1500;
export const FIRST_INTRO_MS = 4000; // la prima volta c'è il "Pronti?" (e il tempo di caricare la schermata)
export const RESULT_MS = 2500;
export const RANK_MS = 5500;
export const RANK_EVERY = 5;
export const OK_PTS = 3;
export const FAST_PTS = [3, 2, 1];

// ---------------------------------------------------------------- generatore col seme (mulberry32)

export function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const r = {
    next,
    range: (lo: number, hi: number) => lo + next() * (hi - lo),
    int: (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1)),
    chance: (p: number) => next() < p,
    pick: <T>(list: readonly T[]): T => list[Math.floor(next() * list.length)],
    shuffle: <T>(list: readonly T[]): T[] => {
      const out = [...list];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
  };
  return r;
}
export type Rng = ReturnType<typeof rng>;

// k punti sparsi senza sovrapporsi: celle di una griglia mescolate, con un po' di disordine (frazioni 0-1)
export function scatter(r: Rng, k: number, cols: number, rows: number, pad = 0.08, jitter = 0.22) {
  const cells = r.shuffle(Array.from({ length: cols * rows }, (_, i) => i)).slice(0, k);
  const cw = (1 - 2 * pad) / cols;
  const ch = (1 - 2 * pad) / rows;
  return cells.map((c) => ({
    x: pad + cw * ((c % cols) + 0.5 + r.range(-jitter, jitter)),
    y: pad + ch * (Math.floor(c / cols) + 0.5 + r.range(-jitter, jitter)),
  }));
}

// ---------------------------------------------------------------- contenuti

export const FRUTTI = ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍒', '🍑', '🥝', '🍍', '🥥', '🍈'];

// trova l'intruso: [quella che si ripete, l'intrusa] (simili ma riconoscibili su tutti i telefoni)
export const INTRUSI: [string, string][] = [
  ['😃', '😄'],
  ['🙂', '🙃'],
  ['😐', '😑'],
  ['😺', '😸'],
  ['😴', '😪'],
  ['🐻', '🐼'],
  ['🐭', '🐹'],
  ['🍎', '🍅'],
  ['🍏', '🍐'],
  ['🍊', '🍑'],
  ['🌕', '🌝'],
  ['🌑', '🌚'],
  ['🚗', '🚙'],
  ['⚽', '🏐'],
  ['🏀', '🏈'],
  ['❤️', '🧡'],
  ['💙', '💜'],
  ['🌹', '🌷'],
  ['🔒', '🔓'],
  ['🔈', '🔉'],
  ['🙈', '🙉'],
  ['🙉', '🙊'],
  ['🐌', '🐛'],
  ['🕐', '🕓'],
  ['🍪', '🍩'],
  ['🐶', '🐺'],
  ['🥐', '🥨'],
  ['🌲', '🌳'],
];

export const STROOP_COLORI = [
  { name: 'ROSSO', hex: '#ff3b4e' },
  { name: 'BLU', hex: '#3d8bff' },
  { name: 'VERDE', hex: '#2fd35f' },
  { name: 'GIALLO', hex: '#ffd21f' },
  { name: 'ROSA', hex: '#ff7ad1' },
  { name: 'BIANCO', hex: '#ffffff' },
];

export const MEMO_POOL = [
  '🍕', '🐶', '🚗', '⚽', '🎸', '🌵', '🍦', '👻', '🚀', '🦄', '🍩', '🐙', '🎈', '🍌', '👑', '🔥', '🐸', '🍔', '🎩', '🌈',
  '🐝', '🍉', '🦊', '🥑', '💎', '🐧', '🍄', '⏰', '🎁', '🦀', '🧀', '🛵',
];

// parole da trovare tra quelle quasi uguali (maiuscole, senza accenti)
export const PAROLE = [
  'PIZZA', 'PASTA', 'GATTO', 'NONNA', 'MAMMA', 'TORTA', 'BIRRA', 'PALLA', 'CALCIO', 'PANINO', 'GELATO', 'LASAGNA', 'CANNOLO',
  'POLPETTA', 'SPAGHETTI', 'CORNETTO', 'ARANCINO', 'AMICI', 'BACIO', 'VESPA', 'MOKA', 'PROSECCO', 'MOZZARELLA', 'GNOCCHI',
  'BISCOTTO', 'CARBONARA', 'SPRITZ', 'TELEFONO', 'DIVANO', 'VACANZA', 'SPIAGGIA', 'MONTAGNA', 'FORMAGGIO', 'PATATINE',
  'CIOCCOLATO', 'BARATTOLO', 'CAPPELLO', 'OMBRELLO', 'FARFALLA', 'TARTARUGA',
];

// non toccare niente: le tentazioni
export const TENTAZIONI = [
  { t: 'HAI VINTO UN IPHONE! 📱', b: 'RITIRALO' },
  { t: '📞 Mamma sta chiamando…', b: 'RISPONDI' },
  { t: '☠️ Il telefono ha 3 VIRUS!', b: 'PULISCI' },
  { t: '💔 Nuovo messaggio dal tuo ex', b: 'LEGGI' },
  { t: '🍕 Pizza GRATIS per te!', b: 'ORDINA' },
  { t: '⭐ +100 PUNTI REGALATI', b: 'PRENDILI' },
  { t: '🔋 Batteria all’1%', b: 'SALVA' },
  { t: '🔄 Aggiornamento urgente', b: 'INSTALLA' },
  { t: '❤️ 12 persone ti hanno messo like', b: 'GUARDA CHI' },
  { t: '🎰 Gira la ruota della fortuna!', b: 'GIRA' },
  { t: '🍝 La nonna chiede se hai mangiato', b: 'RISPONDI' },
  { t: '🐱 Un gattino vuole una carezza', b: 'ACCAREZZA' },
  { t: '✅ Tocca qui per non perdere', b: 'TOCCA' },
  { t: '🎁 Hai un pacco in consegna', b: 'TRACCIA' },
];

export const CADUTE = ['🩴', '🪴', '🧱', '🎹', '🍳', '🥿', '📺'];
export const RUOTA_ICONE = ['🍕', '🍝', '🍦', '🍺', '🍷', '🧀', '🍋', '☕', '🥐', '🍩'];

// ---------------------------------------------------------------- piani condivisi (servono anche al server per i tempi minimi)

// 🐑 conta le pecore: chi passa, quando, e i numeri tra cui scegliere
export function pecorePlan(seed: number, diff: number) {
  const r = rng(seed ^ 0x51ee9);
  const dur = durOf('PECORE', diff);
  const count = r.int(3 + diff, 5 + diff + (diff >= 3 ? 1 : 0));
  const goats = diff >= 2 ? r.int(1, diff - 1) : 0;
  const cross = 1300 - diff * 110; // ms per attraversare lo schermo
  const askAt = dur - 1700; // poi compaiono i numeri
  const spawnEnd = askAt - cross;
  const kinds = r.shuffle([...Array(count).fill('🐑'), ...Array(goats).fill('🐐')] as string[]);
  const slot = (spawnEnd - 150) / kinds.length;
  const animals = kinds.map((kind, i) => ({ kind, t: 150 + slot * i + r.range(0, slot * 0.7), lane: r.range(-1, 1) }));
  const offsets = r.pick([
    [-1, 0, 1, 2],
    [-2, -1, 0, 1],
    [-3, -1, 0, 1],
    [-1, 0, 2, 3],
    [-2, 0, 1, 2],
  ]);
  const shift = count + Math.min(...offsets) < 1 ? 1 - (count + Math.min(...offsets)) : 0;
  const choices = offsets.map((o) => count + o + shift);
  return { animals, cross, askAt, count, choices };
}

// 🐱 solo il gatto: chi si affaccia alle finestre e quando
export function gattoPlan(seed: number, diff: number) {
  const r = rng(seed ^ 0x9e37);
  const dur = durOf('GATTO', diff);
  const vis = 950 - diff * 75; // quanto resta affacciato
  const cats = diff >= 2 ? 2 : 1;
  const catTimes = [r.range(1000, 1900)];
  if (cats === 2) catTimes.push(catTimes[0] + r.range(1100, 1500));
  const pops: { cell: number; t: number; kind: string }[] = [];
  const decoys = diff >= 3 ? ['🐶', '🐕', '🐩', '🐭', '🐰'] : ['🐶', '🐕', '🐩'];
  for (const t of catTimes) pops.push({ cell: r.int(0, 8), t, kind: '🐱' });
  const gap = 560 - diff * 55;
  for (let t = 200; t < dur - 500; t += gap * r.range(0.6, 1.15)) {
    // un cane non si affaccia nella finestra dove c'è (o sta per arrivare) il gatto
    const busy = pops.filter((p) => Math.abs(p.t - t) < vis + 100).map((p) => p.cell);
    const free = Array.from({ length: 9 }, (_, i) => i).filter((c) => !busy.includes(c));
    if (free.length) pops.push({ cell: r.pick(free), t, kind: r.pick(decoys) });
  }
  pops.sort((a, b) => a.t - b.t);
  return { pops, vis, cats, catTimes };
}

// 🏎️ partenza: le luci rosse si accendono una a una, poi si spengono tutte (VIA!)
export function partenzaPlan(seed: number, diff: number) {
  const r = rng(seed ^ 0xf1);
  const step = 430 - diff * 25;
  const on = [0, 1, 2, 3, 4].map((i) => 300 + i * step);
  const outAt = on[4] + r.range(500, 1700 - diff * 80);
  return { on, outAt };
}

// 🧤 rigore: quando calcia, dove tira, quanto ci mette il pallone
export function rigorePlan(seed: number, diff: number) {
  const r = rng(seed ^ 0x6011);
  const kickAt = r.range(1100, 2300);
  const zone = r.int(0, 2); // 0 sinistra, 1 centro, 2 destra
  const flight = 950 - diff * 90;
  const curve = diff >= 3 && zone !== 1; // tiro a giro: parte dritto e poi curva
  const feint = diff >= 2; // la "paradinha": rincorsa con la pausa
  return { kickAt, zone, flight, curve, feint };
}

// 🧠 memoria lampo
export function memoriaPlan(seed: number, diff: number) {
  const r = rng(seed ^ 0x3e3);
  const k = diff >= 3 ? 4 : 3;
  const showMs = 1500 - diff * 140;
  const pool = r.shuffle(MEMO_POOL);
  const show = pool.slice(0, k);
  const nOpt = [6, 8, 9, 9, 12][diff] ?? 9;
  const options = r.shuffle([...show, ...pool.slice(k, nOpt)]);
  return { k, showMs, show, options };
}

// 🔤 trova la parola tra quelle quasi uguali
const VOCALI = 'AEIOU';
const SIMILI: Record<string, string> = { Z: 'S', S: 'Z', T: 'D', D: 'T', P: 'B', B: 'P', C: 'G', G: 'C', L: 'R', R: 'L', N: 'M', M: 'N', F: 'V', V: 'F' };
export function parolaPlan(seed: number, diff: number) {
  const r = rng(seed ^ 0x7a7a);
  const target = r.pick(PAROLE);
  const k = [6, 8, 8, 10, 12][diff] ?? 8;
  const fakes = new Set<string>();
  const ops = [
    (w: string) => {
      // due lettere vicine scambiate
      const i = r.int(1, w.length - 2);
      return w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2);
    },
    (w: string) => {
      // una vocale cambiata
      const pos = [...w].map((ch, i) => (VOCALI.includes(ch) ? i : -1)).filter((i) => i >= 0);
      const i = r.pick(pos);
      return w.slice(0, i) + r.pick([...VOCALI].filter((v) => v !== w[i])) + w.slice(i + 1);
    },
    (w: string) => {
      // una doppia in più o in meno
      const dbl = [...w].map((ch, i) => (i > 0 && w[i - 1] === ch ? i : -1)).filter((i) => i >= 0);
      if (dbl.length && r.chance(0.6)) {
        const i = r.pick(dbl);
        return w.slice(0, i) + w.slice(i + 1);
      }
      const i = r.int(1, w.length - 2);
      return w.slice(0, i) + w[i] + w.slice(i);
    },
    (w: string) => {
      // una consonante simile
      const pos = [...w].map((ch, i) => (i > 0 && SIMILI[ch] ? i : -1)).filter((i) => i >= 0);
      if (!pos.length) return w;
      const i = r.pick(pos);
      return w.slice(0, i) + SIMILI[w[i]] + w.slice(i + 1);
    },
    (w: string) => {
      // una lettera in meno
      const i = r.int(1, w.length - 1);
      return w.slice(0, i) + w.slice(i + 1);
    },
  ];
  for (let guard = 0; fakes.size < k - 1 && guard < 400; guard++) {
    let w = r.pick(ops)(target);
    if (diff >= 3 && r.chance(0.3)) w = r.pick(ops)(w); // più avanti anche due errori insieme
    if (w !== target && w.length >= 3) fakes.add(w);
  }
  const words = r.shuffle([target, ...fakes]);
  return { target, words };
}

// ---------------------------------------------------------------- le sfide

export interface SfidaInfo {
  id: SfidaId;
  verb: string; // il verbo gigante dell'introduzione
  hint: (diff: number) => string;
  icon: string;
  ms: [number, number]; // durata del gioco: facile → difficile
  minMs: (seed: number, diff: number) => number; // sotto questo tempo è impossibile (anti-imbroglio)
  survive?: boolean; // si vince resistendo fino alla fine (niente bonus velocità)
  bg: string; // sfondo
}

const fixed = (ms: number) => () => ms;
const survivor = (id: SfidaId) => (_seed: number, diff: number) => durOf(id, diff) - 400;

export const SFIDE: SfidaInfo[] = [
  {
    id: 'ZANZARA',
    verb: 'SCHIACCIALA!',
    hint: () => 'Colpisci la zanzara 3 volte',
    icon: '🦟',
    ms: [5000, 4000],
    minMs: fixed(450),
    bg: 'linear-gradient(180deg,#ff9a5a,#e0507a)',
  },
  {
    id: 'FRUTTA',
    verb: 'SOLO FRUTTA!',
    hint: () => 'Tocca tutta la frutta… ma NON la bomba 💣',
    icon: '🍉',
    ms: [5000, 4500],
    minMs: fixed(600),
    bg: 'linear-gradient(180deg,#36c98e,#11806a)',
  },
  {
    id: 'PECORE',
    verb: 'CONTA!',
    hint: (d) => (d >= 2 ? 'Quante pecore 🐑? Le capre 🐐 non contano!' : 'Quante pecore saltano lo steccato?'),
    icon: '🐑',
    ms: [6000, 5500],
    minMs: (seed, diff) => pecorePlan(seed, diff).askAt + 150,
    bg: 'linear-gradient(180deg,#63c7ff,#3f8bea)',
  },
  {
    id: 'INTRUSO',
    verb: 'TROVA L’INTRUSO!',
    hint: () => 'Uno solo è diverso dagli altri',
    icon: '🔍',
    ms: [5000, 4500],
    minMs: fixed(250),
    bg: 'linear-gradient(180deg,#8b5cf6,#4c1d95)',
  },
  {
    id: 'SFUMATURA',
    verb: 'IL COLORE DIVERSO!',
    hint: () => 'Una casella è appena più chiara (o più scura)',
    icon: '🎨',
    ms: [4500, 4000],
    minMs: fixed(250),
    bg: 'linear-gradient(180deg,#334155,#0f172a)',
  },
  {
    id: 'STROOP',
    verb: 'DI CHE COLORE È?',
    hint: (d) => `Tocca il colore dell’INCHIOSTRO, non la parola (${d >= 3 ? 4 : 3} di fila)`,
    icon: '🖍️',
    ms: [5500, 5000],
    minMs: fixed(600),
    bg: 'linear-gradient(180deg,#1e1b4b,#0b0a24)',
  },
  {
    id: 'MAGGIORE',
    verb: 'IL PIÙ GRANDE!',
    hint: () => 'Tocca il numero più alto (2 volte)',
    icon: '🔢',
    ms: [5000, 4500],
    minMs: fixed(400),
    bg: 'linear-gradient(180deg,#f59e0b,#c2410c)',
  },
  {
    id: 'BIRRA',
    verb: 'SPILLA!',
    hint: () => 'Tieni premuto e lascia quando la birra è nella tacca verde',
    icon: '🍺',
    ms: [5000, 4500],
    minMs: fixed(300),
    bg: 'linear-gradient(180deg,#7c4a1e,#3b2210)',
  },
  {
    id: 'PIATTO',
    verb: 'STROFINA!',
    hint: () => 'Pulisci il piatto della nonna strofinando col dito',
    icon: '🧽',
    ms: [5500, 4500],
    minMs: fixed(700),
    bg: 'linear-gradient(180deg,#5eead4,#0f766e)',
  },
  {
    id: 'PALLONCINO',
    verb: 'GONFIA!',
    hint: (d) => (d >= 2 ? 'Tocca velocissimo finché scoppia (si sgonfia!)' : 'Tocca velocissimo finché scoppia'),
    icon: '🎈',
    ms: [5000, 4500],
    minMs: fixed(600),
    bg: 'linear-gradient(180deg,#fb7185,#be185d)',
  },
  {
    id: 'FRECCE',
    verb: 'SEGUI LE FRECCE!',
    hint: (d) => (d >= 2 ? 'Scorri il dito come la freccia. ROSSA = al contrario!' : 'Scorri il dito nella direzione della freccia'),
    icon: '➡️',
    ms: [5000, 4500],
    minMs: fixed(450),
    bg: 'linear-gradient(180deg,#0ea5e9,#1e3a8a)',
  },
  {
    id: 'PIZZA',
    verb: 'PRENDI LA PIZZA!',
    hint: (d) => (d >= 1 ? 'Muoviti a destra e sinistra: 3 pizze, MAI l’ananas 🍍' : 'Muoviti a destra e sinistra: mangia 3 pizze'),
    icon: '🍕',
    ms: [6000, 5500],
    minMs: fixed(1200),
    bg: 'linear-gradient(180deg,#fde68a,#f97316)',
  },
  {
    id: 'ORDINE',
    verb: '1, 2, 3… IN ORDINE!',
    hint: (d) => `Tocca i numeri da 1 a ${5 + d}, in ordine`,
    icon: '🔢',
    ms: [5000, 4500],
    minMs: fixed(500),
    bg: 'linear-gradient(180deg,#22d3ee,#6366f1)',
  },
  {
    id: 'MEMORIA',
    verb: 'RICORDA!',
    hint: (d) => `Guarda bene: poi ritrova i ${d >= 3 ? 4 : 3} disegni`,
    icon: '🧠',
    ms: [6000, 5500],
    minMs: (seed, diff) => memoriaPlan(seed, diff).showMs + 300,
    bg: 'linear-gradient(180deg,#f472b6,#7c3aed)',
  },
  {
    id: 'SCHIVA',
    verb: 'SCHIVA!',
    hint: () => 'Piovono ciabatte e vasi dai balconi! Trascina a destra e sinistra',
    icon: '🩴',
    ms: [4500, 5500],
    minMs: survivor('SCHIVA'),
    survive: true,
    bg: 'linear-gradient(180deg,#a5b4fc,#6d28d9)',
  },
  {
    id: 'TAGLIA',
    verb: 'AFFETTA!',
    hint: (d) => `Taglia ${d >= 2 ? 4 : 3} frutti con uno swipe${d >= 1 ? ' (non la bomba!)' : ''}`,
    icon: '🔪',
    ms: [5500, 5000],
    minMs: fixed(600),
    bg: 'linear-gradient(180deg,#78350f,#1c0f05)',
  },
  {
    id: 'GATTO',
    verb: 'SOLO IL GATTO!',
    hint: (d) => (d >= 2 ? 'Tocca il gatto 🐱 (2 volte). I cani NO!' : 'Tocca il gatto 🐱 quando si affaccia. I cani NO!'),
    icon: '🐱',
    ms: [5500, 5500],
    minMs: (seed, diff) => {
      const p = gattoPlan(seed, diff);
      return p.catTimes[p.cats - 1] + 120;
    },
    bg: 'linear-gradient(180deg,#fcd34d,#d97706)',
  },
  {
    id: 'CALCOLO',
    verb: 'CALCOLA!',
    hint: () => 'Due conti al volo: tocca il risultato giusto',
    icon: '➗',
    ms: [6000, 5000],
    minMs: fixed(500),
    bg: 'linear-gradient(180deg,#14532d,#052e16)',
  },
  {
    id: 'CANDELINE',
    verb: 'SPEGNI!',
    hint: (d) => (d >= 2 ? 'Tutte le candeline… sono magiche: si riaccendono!' : 'Spegni tutte le candeline (tocca le fiammelle)'),
    icon: '🎂',
    ms: [5000, 4500],
    minMs: fixed(450),
    bg: 'linear-gradient(180deg,#312e81,#1e1b4b)',
  },
  {
    id: 'PAROLA',
    verb: 'TROVA LA PAROLA!',
    hint: () => 'Attento alle parole quasi uguali',
    icon: '🔤',
    ms: [5000, 4500],
    minMs: fixed(250),
    bg: 'linear-gradient(180deg,#fef3c7,#fbbf24)',
  },
  {
    id: 'CANESTRO',
    verb: 'CANESTRO!',
    hint: (d) => (d >= 1 ? 'Scorri verso l’alto per tirare: il canestro si muove!' : 'Scorri verso l’alto per tirare'),
    icon: '🏀',
    ms: [5500, 5000],
    minMs: fixed(600),
    bg: 'linear-gradient(180deg,#fb923c,#9a3412)',
  },
  {
    id: 'RUOTA',
    verb: 'FERMA LA RUOTA!',
    hint: () => 'Tocca quando il simbolo giusto è sotto la freccia',
    icon: '🎡',
    ms: [5000, 4500],
    minMs: fixed(250),
    bg: 'linear-gradient(180deg,#a855f7,#581c87)',
  },
  {
    id: 'SPAGHETTI',
    verb: 'ARROTOLA!',
    hint: (d) => `Gira il dito in tondo sul piatto (${3 + d} giri)`,
    icon: '🍝',
    ms: [5500, 5000],
    minMs: fixed(700),
    bg: 'linear-gradient(180deg,#ef4444,#7f1d1d)',
  },
  {
    id: 'RIGORE',
    verb: 'PARA!',
    hint: (d) => (d >= 3 ? 'Tuffati dove va il pallone (occhio al tiro a giro!)' : 'Tocca il lato dove va il pallone, DOPO il tiro'),
    icon: '🧤',
    ms: [5500, 5000],
    minMs: (seed, diff) => rigorePlan(seed, diff).kickAt + 120,
    bg: 'linear-gradient(180deg,#16a34a,#14532d)',
  },
  {
    id: 'PARTENZA',
    verb: 'VIA!',
    hint: () => 'Tocca appena si SPENGONO le luci rosse',
    icon: '🏎️',
    ms: [5000, 5000],
    minMs: (seed, diff) => partenzaPlan(seed, diff).outAt + 100,
    bg: 'linear-gradient(180deg,#3f3f46,#09090b)',
  },
  {
    id: 'NONTOCCARE',
    verb: 'NON TOCCARE!',
    hint: () => 'Niente di niente. Resisti alle tentazioni 😈',
    icon: '🙅',
    ms: [5000, 5500],
    minMs: survivor('NONTOCCARE'),
    survive: true,
    bg: 'linear-gradient(180deg,#0f766e,#042f2e)',
  },
];

export const SFIDA = Object.fromEntries(SFIDE.map((s) => [s.id, s])) as Record<SfidaId, SfidaInfo>;
export const SFIDA_IDS = SFIDE.map((s) => s.id);

// durata del gioco secondo la difficoltà
export function durOf(id: SfidaId, diff: number): number {
  const [easy, hard] = SFIDA[id].ms;
  return Math.round(easy + ((hard - easy) * Math.max(0, Math.min(MAX_DIFF, diff))) / MAX_DIFF);
}

// la difficoltà sale col procedere della partita
export const sfidaDiff = (n: number, total: number) => Math.min(MAX_DIFF, Math.floor(((n - 1) * (MAX_DIFF + 1)) / Math.max(1, total)));

// il verbo dell'introduzione (per la parola si dice quale)
export const verbOf = (id: SfidaId, seed: number, diff: number) => (id === 'PAROLA' ? `TROVA «${parolaPlan(seed, diff).target}»!` : SFIDA[id].verb);
