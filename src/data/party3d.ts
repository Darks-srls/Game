// 🎉 Axend Party: minigiochi 3D. Qui ci sono le regole fisiche e le arene, uguali per il telefono e per il server
// (il server le usa per i bot e per controllare cadute, spinte e colpi).
// Mondo in metri: y verso l'alto, i giocatori corrono verso +z.

export type BaseKind = 'SUMO' | 'REDLIGHT' | 'CHAIRS' | 'SNIPER' | 'POLPETTE' | 'NONNA' | 'GALLINA' | 'PONTE' | 'BOTTO' | 'DENTE' | 'WAFER' | 'FRUTTA' | 'CALCIO' | 'POMODORI' | 'CORSA';
// minigiochi "a moduli": ognuno nel suo file (src/data/minis, worker/minis, src/components/party3d/minis)
export type ExtKind =
  | 'RUBACODA'
  | 'RE'
  | 'ANELLI'
  | 'MATTARELLO'
  | 'MURO'
  | 'UOVA'
  | 'SUGO'
  | 'AUTOSCONTRO'
  | 'PITTURA'
  | 'RUBABANDIERA'
  | 'NASCONDINO'
  | 'SIMON'
  | 'AVVELENATA'
  | 'MONETE'
  | 'TALPE'
  | 'BILANCIA'
  | 'SPAGHETTO'
  | 'PALLAVOLO'
  | 'CORDA'
  | 'PIZZE';
export type MiniKind = BaseKind | ExtKind;

export interface MiniInfo {
  name: string;
  tag: string;
  rules: string;
  seconds: number; // 0 = finisce da solo (eliminazione)
}

// (si completa con i minigiochi a moduli quando si registrano: vedi registerMini)
export const MINIGAMES = {} as Record<MiniKind, MiniInfo>;
const BASE_MINIGAMES: Record<BaseKind, MiniInfo> = {
  SUMO: {
    name: 'Spingi giù',
    tag: 'Tutti contro tutti',
    rules: 'Spingi gli altri giù dall’isola. Si restringe col tempo: vince l’ultimo che resta in piedi.',
    seconds: 75,
  },
  REDLIGHT: {
    name: 'Luce rossa, luce verde',
    tag: 'Corsa',
    rules: 'Corri quando la bambola è di spalle, FERMATI quando si gira: chi si muove è fuori. Spingere gli altri è permesso.',
    seconds: 75,
  },
  CHAIRS: {
    name: 'Sedie musicali',
    tag: 'Eliminazione',
    rules: 'Balla finché c’è la musica. Quando si ferma spuntano le sedie: passaci sopra per sederti prima degli altri. Una sedia in meno ogni giro.',
    seconds: 0,
  },
  SNIPER: {
    name: 'Cecchini',
    tag: 'Cecchini contro corridori',
    rules: 'I cecchini mirano in prima persona dalla torre e sparano. I corridori si riparano dietro le casse, possono lanciare un POMODORO alla torre per accecare un cecchino e devono arrivare al traguardo sotto la torre.',
    seconds: 50,
  },
  POLPETTE: {
    name: 'Polpette rotolanti',
    tag: 'Corsa in salita',
    rules: 'Arriva in cima alla lunga salita mentre la nonna fa rotolare giù polpette giganti. Se cadi dai lati ricominci da sotto! Con lo SCATTO al momento giusto ci passi attraverso.',
    seconds: 95,
  },
  NONNA: {
    name: 'Il mestolo della nonna',
    tag: 'Sopravvivenza',
    rules: 'Siete sulla tavola della nonna: salta il mestolo che gira e scappa dove sta per sbattere la ciabatta. Vince chi resta a tavola.',
    seconds: 75,
  },
  PONTE: {
    name: 'Il ponte di lasagne',
    tag: 'Coraggio o fortuna',
    rules: 'Attraversa il ponte saltando da una lasagna all’altra: in ogni fila una regge e una crolla. Chi va avanti rischia, chi aspetta vede dove cadono gli altri… ma il tempo scade!',
    seconds: 80,
  },
  BOTTO: {
    name: 'Il petardo',
    tag: 'Patata bollente',
    rules: 'Qualcuno ha in mano un petardo acceso: toccando un altro glielo passi. Quando scoppia, chi ce l’ha è fuori. Chi ha il petardo corre più veloce: inseguili!',
    seconds: 0,
  },
  GALLINA: {
    name: 'La gallina d’oro',
    tag: 'Ruba e scappa',
    rules: 'Corri sulla gallina d’oro per prenderla e tienila più a lungo che puoi. Per rubarla dai uno SCHIAFFO a chi ce l’ha: passa subito a te! Chi la tiene corre più piano.',
    seconds: 60,
  },
  DENTE: {
    name: 'Pasta al dente',
    tag: 'Tempismo',
    rules: 'Il timer della pasta conta i secondi, ma dopo 3 si spegne! Premi SCOLA! esattamente al tempo giusto. Tre manche: vince chi in totale sbaglia di meno.',
    seconds: 0,
  },
  WAFER: {
    name: 'Pavimento di wafer',
    tag: 'Non stare fermo',
    rules: 'Tre piani di wafer: ogni mattonella che calpesti si sbriciola subito. Se cadi finisci al piano di sotto… sotto l’ultimo c’è il cioccolato. Vince l’ultimo che resta su.',
    seconds: 150,
  },
  FRUTTA: {
    name: 'Macedonia',
    tag: 'Memoria',
    rules: 'Le piastrelle mostrano la frutta per pochi secondi, poi si coprono. Quando appare il frutto da salvare corri su una piastrella giusta: tutte le altre crollano! Ogni giro è più veloce.',
    seconds: 0,
  },
  CALCIO: {
    name: 'Calcetto gigante',
    tag: 'Rossi contro blu',
    rules: 'Due squadre e un pallone enorme: correndoci contro lo spingi, con TIRA fai una cannonata. Vince la squadra che segna di più (e chi segna prende punti extra)!',
    seconds: 70,
  },
  POMODORI: {
    name: 'Pomodorata',
    tag: 'Tutti contro tutti',
    rules: 'Lancia pomodori agli altri per buttarli giù dal mercato, che si restringe sempre di più. Riparati dietro le cassette (o saltaci sopra). Vince l’ultimo in piedi.',
    seconds: 90,
  },
  CORSA: {
    name: 'Corsa pazza',
    tag: 'Percorso a ostacoli',
    rules: 'Salta le barre che girano, schiva i martelloni, sfonda le porte giuste (alcune sono finte!) e salta sulle piattaforme. Se cadi riparti dall’ultima bandierina.',
    seconds: 100,
  },
};
Object.assign(MINIGAMES, BASE_MINIGAMES);
// tutti i minigiochi giocabili (quelli a moduli ci sono solo se il loro file è stato caricato)
export const miniKinds = () => Object.keys(MINIGAMES) as MiniKind[];

// ---------------------------------------------------------------- minigiochi a moduli
// Ogni minigioco nuovo ha un file in src/data/minis/ con le regole fisiche della sua arena
// (uguali per il telefono e per il server) e si registra qui.
export interface SharedMini extends MiniInfo {
  kind: ExtKind;
  speed?: number; // velocità di corsa (1 = normale)
  grip?: number; // aderenza: senza, a terra si cambia direzione all'istante; con un numero (es. 2.5) si scivola (ghiaccio, autoscontro)
  noPush?: boolean; // niente schiaffo
  noDash?: boolean; // niente scatto/tuffo
  noDoubleJump?: boolean;
  noJump?: boolean; // niente salto
  autoRun?: boolean; // si corre sempre in avanti (il joystick gira soltanto): es. lo spaghetto alla Tron
  fallOut?: number; // sotto questa quota sei caduto (di solito PHYS.fallOut)
  // quota del pavimento sotto (x, z): null = vuoto. y = quota da cui si arriva (per i piani sovrapposti). Senza: pavimento piatto a 0 ovunque
  ground?: (x: number, z: number, t: number, y?: number) => number | null;
  clamp?: (p: { x: number; z: number; y?: number }, t: number) => void; // pareti e ostacoli: sposta p fuori
  groundVel?: (x: number, z: number, t: number) => { x: number; z: number }; // pavimento che trascina (nastri, piattaforme mobili)
  sync?: (ext: any) => void; // stato dell'arena che cambia (mattonelle, porte…): arriva da PartyView.ext (telefono) o dallo stato del server
}
export const MINIS: Partial<Record<MiniKind, SharedMini>> = {};
export function registerMini(m: SharedMini) {
  MINIS[m.kind] = m;
  MINIGAMES[m.kind] = { name: m.name, tag: m.tag, rules: m.rules, seconds: m.seconds };
}

// velocità di corsa per minigioco (a Luce rossa si va più piano: servono più semafori per arrivare)
// (a Pasta al dente non si cammina: si sta in fila davanti alla pentola)
const KIND_SPEED: Record<BaseKind, number> = {
  SUMO: 1,
  REDLIGHT: 0.62,
  CHAIRS: 1,
  SNIPER: 0.9,
  POLPETTE: 0.95,
  NONNA: 0.95,
  GALLINA: 1,
  PONTE: 0.9,
  BOTTO: 1,
  DENTE: 0,
  WAFER: 0.95,
  FRUTTA: 1,
  CALCIO: 1,
  POMODORI: 0.95,
  CORSA: 1,
};
export const speedOf = (kind: MiniKind) => KIND_SPEED[kind as BaseKind] ?? MINIS[kind]?.speed ?? 1;
// qui non si spinge e non si scatta
const NO_PUSH: MiniKind[] = ['DENTE'];
const NO_DASH: MiniKind[] = ['PONTE', 'DENTE'];
export const noPush = (kind: MiniKind) => NO_PUSH.includes(kind) || !!MINIS[kind]?.noPush;
export const noDash = (kind: MiniKind) => NO_DASH.includes(kind) || !!MINIS[kind]?.noDash;
export const noDoubleJump = (kind: MiniKind) => kind === 'PONTE' || !!MINIS[kind]?.noDoubleJump;

export const PHYS = {
  speed: 7.2, // metri al secondo
  jumpV: 9.5,
  gravity: 27,
  radius: 0.55, // ingombro di un personaggio
  pushRange: 2.7, // lo schiaffo prende chi è davanti entro 2,7 m (con un po' di mira automatica)
  pushCooldown: 800, // ms
  dashSpeed: 16, // scatto: velocità
  dashTime: 0.2, // secondi
  dashCooldown: 1800, // ms
  dodgeMs: 380, // durante lo scatto non ti prende niente (spinte, mestolo, polpette)
  diveSpeed: 9, // tuffo in aria (corto: è per schivare e per allungarsi, non per volare)
  doubleJump: 0.8, // il secondo salto è un po' più basso
  pushPower: 10,
  pushLift: 4.5,
  fallOut: -6, // sotto questa quota sei caduto
};

// Punti per la posizione in un minigioco (1°, 2°, 3°…)
export const POINTS = [10, 8, 6, 5, 4, 3, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1];
export const SNIPER_HIT_POINTS = 3;

// ---------------------------------------------------------------- arene

// Spingi giù: isola rotonda che si restringe
export const SUMO = { r0: 12, rMin: 3.5, shrinkFrom: 6, rate: 0.16 };
export const sumoRadius = (t: number) => (t < SUMO.shrinkFrom ? SUMO.r0 : Math.max(SUMO.rMin, SUMO.r0 - (t - SUMO.shrinkFrom) * SUMO.rate));

// Luce rossa: campo rettangolare, bambola in fondo
export const RED = { halfW: 14, start: -28, finish: 26, back: -32, front: 32, dollZ: 33 };
export const RED_TIMES = { turn: 900, checkDelay: 380, tolerance: 0.55 };

// Sedie musicali: pista rotonda con le pareti
export const CHAIRS = { r: 11, chairsR: 8, sitRange: 1.7, stopSeconds: 9 };

// Cecchini: canale con casse per ripararsi e torre in fondo
export const SNIPER = { halfW: 6.5, start: -36, back: -40, finish: 24, towerZ: 29, towerTop: 9, front: 26, reload: 1100, hitRadius: 0.8 };
export interface Box {
  x: number;
  z: number;
  w: number; // larghezza (x)
  d: number; // profondità (z)
  h: number; // altezza
}
export const SNIPER_BOXES: Box[] = [
  { x: -3, z: -27, w: 3, d: 1.2, h: 2.5 },
  { x: 3.4, z: -23, w: 3, d: 1.2, h: 2.5 },
  { x: -0.8, z: -18, w: 4, d: 1.2, h: 2.5 },
  { x: 4, z: -13, w: 2.6, d: 1.2, h: 2.5 },
  { x: -4, z: -12, w: 2.6, d: 1.2, h: 2.5 },
  { x: 0.6, z: -7, w: 3.2, d: 1.2, h: 2.5 },
  { x: -3.6, z: -1.5, w: 3, d: 1.2, h: 2.5 },
  { x: 3.6, z: 1.5, w: 3, d: 1.2, h: 2.5 },
  { x: -0.4, z: 7, w: 3.6, d: 1.2, h: 2.5 },
  { x: -4, z: 12, w: 2.6, d: 1.2, h: 2.5 },
  { x: 4, z: 13, w: 2.6, d: 1.2, h: 2.5 },
  { x: 0, z: 18.5, w: 3.2, d: 1.2, h: 2.5 },
];
// Polpette rotolanti: salita larga 14 m (dai lati si cade), pali per ripararsi, cima piatta
export const SLOPE = { halfW: 7.5, back: -52, start: -49, rampFrom: -44, rampTo: 46, top: 20, front: 56, finish: 47, ballR: 1.3, ballZ: 52 };
export const slopeHeight = (z: number) => (z <= SLOPE.rampFrom ? 0 : z >= SLOPE.rampTo ? SLOPE.top : ((z - SLOPE.rampFrom) / (SLOPE.rampTo - SLOPE.rampFrom)) * SLOPE.top);
export const SLOPE_POSTS = [
  { x: -3.5, z: -34 },
  { x: 3, z: -27 },
  { x: -1, z: -19 },
  { x: 4.5, z: -11 },
  { x: -4.5, z: -6 },
  { x: 1.5, z: 1 },
  { x: -2.5, z: 8 },
  { x: 4, z: 15 },
  { x: -4, z: 22 },
  { x: 0.5, z: 28 },
  { x: 3.5, z: 35 },
  { x: -3, z: 40 },
];
export const POST_R = 0.75;
// posizione di una polpetta (deterministica: la calcola uguale il telefono e il server)
export function ballPos(b: { x: number; t0: number; v: number }, now: number) {
  const z = SLOPE.ballZ - ((now - b.t0) / 1000) * b.v;
  return { x: b.x, z, y: slopeHeight(z) + SLOPE.ballR, roll: (SLOPE.ballZ - z) / SLOPE.ballR };
}

// Il mestolo della nonna: tavola rotonda, il mestolo gira sempre più veloce
export const TABLE = { r: 11, spoonR: 11.6, spoonH: 0.9, slamR: 2.3, slamWarn: 1300 };
const SPOON_AT_50 = 0.85 * 50 + 0.0135 * 50 * 50;
export function spoonAngle(t: number): number {
  if (t < 0) return 0;
  return t < 50 ? 0.85 * t + 0.0135 * t * t : SPOON_AT_50 + 2.2 * (t - 50);
}

// Il ponte di lasagne: file di due lastre (una regge, una crolla), si salta da una fila all'altra
export const BRIDGE = { rows: 7, rowZ0: -18, rowStep: 4, tileX: 2, tileHalf: 1.6, startFrom: -30, startTo: -21, finishFrom: 8.6, finishTo: 16, platHalfW: 5.5 };
export const bridgeRowZ = (i: number) => BRIDGE.rowZ0 + i * BRIDGE.rowStep;
let brokenTiles = new Set<string>(); // "fila:lato" (lato 0 = sinistra x>0, 1 = destra x<0)
export function setBrokenTiles(list: string[]) {
  brokenTiles = new Set(list);
}
// su che lastra sono? (null = nessuna)
export function tileAt(x: number, z: number): { row: number; side: number } | null {
  for (let i = 0; i < BRIDGE.rows; i++) {
    if (Math.abs(z - bridgeRowZ(i)) > BRIDGE.tileHalf) continue;
    for (const side of [0, 1]) if (Math.abs(x - (side ? -BRIDGE.tileX : BRIDGE.tileX)) <= BRIDGE.tileHalf) return { row: i, side };
  }
  return null;
}

// Il petardo: piazza rotonda
export const PLAZA = { r: 12, fuseMin: 7000, fuseMax: 13000, passCooldown: 700, tagRange: 1.35, holderSpeed: 1.15 };

// La gallina d'oro: aia rotonda con lo steccato
export const YARD = { r: 13, henSpeed: 5.6, grabRange: 1.4, holderSpeed: 0.8 };

export const sniperEye = (i: number, n: number) => ({ x: n <= 1 ? 0 : -3 + (6 * i) / (n - 1), y: SNIPER.towerTop + 1.6, z: SNIPER.towerZ });

// Pasta al dente: tutti in fila ad arco davanti al pentolone, il timer si spegne dopo 3 secondi
export const DENTE = { targets: [10, 6.5, 13.37], showFor: 3, late: 4, miss: 5, perfect: 0.1, revealMs: 5500, arcR: 9.5, leadMs: 1600 };
export const dentePlace = (i: number, n: number) => {
  const a = n <= 1 ? 0 : -1.2 + (2.4 * i) / (n - 1);
  const x = Math.sin(a) * DENTE.arcR;
  const z = -Math.cos(a) * DENTE.arcR;
  return { x, z, r: Math.atan2(-x, -z) };
};

// Pavimento di wafer: tre piani di mattonelle esagonali (punta in su), coordinate assiali
const SQ3 = Math.sqrt(3);
export const WAFER = { size: 1.3, rings: 8, layers: 3, gap: 7, crumble: 600, fallOut: -21 };
export const HEX_TILES: { q: number; r: number; x: number; z: number }[] = [];
const HEX_INDEX = new Map<number, number>();
for (let q = -WAFER.rings; q <= WAFER.rings; q++)
  for (let r = Math.max(-WAFER.rings, -q - WAFER.rings); r <= Math.min(WAFER.rings, -q + WAFER.rings); r++) {
    HEX_INDEX.set((q + 16) * 64 + r + 16, HEX_TILES.length);
    HEX_TILES.push({ q, r, x: WAFER.size * SQ3 * (q + r / 2), z: WAFER.size * 1.5 * r });
  }
export const HEX_N = HEX_TILES.length; // 127 per piano
export const waferY = (layer: number) => -layer * WAFER.gap;
// che mattonella c'è sotto (x, z)? -1 = fuori
export function hexAt(x: number, z: number): number {
  const fq = ((SQ3 / 3) * x - z / 3) / WAFER.size;
  const fr = ((2 / 3) * z) / WAFER.size;
  const fs = -fq - fr;
  let q = Math.round(fq);
  let r = Math.round(fr);
  const s = Math.round(fs);
  const dq = Math.abs(q - fq);
  const dr = Math.abs(r - fr);
  const ds = Math.abs(s - fs);
  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  return HEX_INDEX.get((q + 16) * 64 + r + 16) ?? -1;
}
// stato delle mattonelle: un carattere per mattonella (piano * 127 + indice): 0 intera, 1 si sbriciola, 2 caduta
let hexState = '';
export function setHexState(s: string) {
  hexState = s;
}
export const hexChar = (layer: number, i: number) => hexState[layer * HEX_N + i] ?? '0';

// Macedonia: 4×4 piastrelle sospese nel vuoto
export const FRUIT = { n: 4, step: 5, half: 2.45, size: 4.6, giri: 10 };
export const FRUITS = ['mela', 'banana', 'uva', 'anguria', 'limone', 'ciliegie'] as const;
export const FRUIT_NAMES = ['MELA', 'BANANA', 'UVA', 'ANGURIA', 'LIMONE', 'CILIEGIE'];
export const fruitTile = (i: number) => ({ x: ((i % FRUIT.n) - 1.5) * FRUIT.step, z: (Math.floor(i / FRUIT.n) - 1.5) * FRUIT.step });
export function fruitTileAt(x: number, z: number): number {
  const i = Math.round(x / FRUIT.step + 1.5);
  const j = Math.round(z / FRUIT.step + 1.5);
  if (i < 0 || j < 0 || i >= FRUIT.n || j >= FRUIT.n) return -1;
  const c = fruitTile(j * FRUIT.n + i);
  return Math.abs(x - c.x) <= FRUIT.half && Math.abs(z - c.z) <= FRUIT.half ? j * FRUIT.n + i : -1;
}
let fruitOpen: boolean[] = [];
export function setFruitOpen(o: boolean[]) {
  fruitOpen = o;
}
// durata delle fasi di ogni giro (sempre più veloci) e quante piastrelle giuste restano
export const fruitTimes = (giro: number) => ({ show: Math.max(2200, 5000 - giro * 320), hide: Math.max(2300, 4400 - giro * 240), drop: 2300, rise: 1300 });
export const fruitSafe = (giro: number) => [4, 4, 3, 3, 2, 2, 2, 1, 1, 1][Math.min(9, giro)];

// Calcetto gigante: campo con le sponde basse (e il vetro sopra), porte in fondo
export const PITCH = { halfW: 10, halfL: 16, goalW: 4.4, goalH: 3.6, goalD: 2.6, ballR: 1.25, kick: 17, kickLift: 5.5, kickRange: 2.9, resetMs: 2600 };
export const TEAM_COLORS = ['#ff3b5c', '#3a86ff'];
export const TEAM_NAMES = ['ROSSI', 'BLU'];

// Pomodorata: il mercato rotondo che si restringe, con le cassette per ripararsi
export const MARKET = { r0: 12.5, rMin: 5, shrinkFrom: 12, rate: 0.1, reload: 650, speed: 17, lift: 4.5, gravity: 14, hitR: 1.25, power: 9.5, assist: 0.42 };
export const marketRadius = (t: number) => (t < MARKET.shrinkFrom ? MARKET.r0 : Math.max(MARKET.rMin, MARKET.r0 - (t - MARKET.shrinkFrom) * MARKET.rate));
export const CRATES: Box[] = [
  { x: -3.2, z: 2.2, w: 2.2, d: 1.3, h: 1.3 },
  { x: 3.3, z: 1.4, w: 1.3, d: 2.2, h: 1.3 },
  { x: 0.6, z: -3.6, w: 2.2, d: 1.3, h: 1.3 },
  { x: -2.6, z: -2.1, w: 1.3, d: 1.3, h: 1.3 },
];
export const crateAt = (x: number, z: number) => CRATES.find((b) => Math.abs(x - b.x) <= b.w / 2 && Math.abs(z - b.z) <= b.d / 2) ?? null;

// Corsa pazza: percorso dritto verso +z, senza sponde (chi cade riparte dall'ultima bandierina)
export const RACE = { halfW: 6, back: -7, start: -3, gapFrom: 84, gapTo: 104, finish: 110, front: 118, sweepR: 6.2, sweepH: 0.95 };
export const RACE_CP = [-3, 38, 62, 81, 106];
export const SWEEPERS = [
  { z: 10, w: 2.1 },
  { z: 26, w: -2.6 },
];
export const sweepAngle = (i: number, t: number) => SWEEPERS[i].w * Math.max(0, t);
export const HAMMERS = [
  { z: 44, w: 2.3, ph: 0 },
  { z: 51, w: 2.75, ph: 2.1 },
  { z: 58, w: 2.0, ph: 4.2 },
];
export const HAMMER = { pivotY: 9.5, arm: 8.2, amp: 1.2, headR: 1.3, headL: 2.8 };
export function hammerHead(i: number, t: number) {
  const h = HAMMERS[i];
  const a = HAMMER.amp * Math.sin(h.w * t + h.ph);
  const va = HAMMER.amp * h.w * Math.cos(h.w * t + h.ph); // velocità angolare
  return { a, x: Math.sin(a) * HAMMER.arm, y: HAMMER.pivotY - Math.cos(a) * HAMMER.arm, z: h.z, vx: Math.cos(a) * HAMMER.arm * va };
}
export const DOOR_ROWS = [66, 76];
export const DOOR = { n: 5, slot: 2.4, half: 0.45 };
export const doorX = (i: number) => -RACE.halfW + DOOR.slot * (i + 0.5);
let openDoors = new Set<string>(); // "fila:porta"
export function setOpenDoors(list: string[]) {
  openDoors = new Set(list);
}
export const PLATS = [
  { z: 88, w: 1.3, ph: 0 },
  { z: 94, w: 1.7, ph: 2 },
  { z: 100, w: 1.15, ph: 4 },
];
export const PLAT = { half: 2.0, amp: 4.2 };
export const platX = (i: number, t: number) => PLAT.amp * Math.sin(PLATS[i].w * t + PLATS[i].ph);
const platVX = (i: number, t: number) => PLAT.amp * PLATS[i].w * Math.cos(PLATS[i].w * t + PLATS[i].ph);
export function platAt(x: number, z: number, t: number) {
  for (let i = 0; i < PLATS.length; i++) if (Math.abs(z - PLATS[i].z) <= PLAT.half && Math.abs(x - platX(i, t)) <= PLAT.half) return i;
  return -1;
}
// a che quota si cade fuori (sotto l'ultimo piano di wafer si va più giù)
export const fallOutOf = (kind: MiniKind) => (kind === 'WAFER' ? WAFER.fallOut : (MINIS[kind]?.fallOut ?? PHYS.fallOut));

// Quota del pavimento sotto (x, z): null = vuoto (si cade)
// (y = quota da cui si arriva: serve al wafer per sapere su che piano si atterra)
export function groundAt(kind: MiniKind, x: number, z: number, t: number, y?: number): number | null {
  const ext = MINIS[kind];
  if (ext) return ext.ground ? ext.ground(x, z, t, y) : 0;
  if (kind === 'SUMO') return Math.hypot(x, z) <= sumoRadius(t) ? 0 : null;
  if (kind === 'NONNA') return Math.hypot(x, z) <= TABLE.r ? 0 : null;
  if (kind === 'POLPETTE') return Math.abs(x) <= SLOPE.halfW ? slopeHeight(z) : null;
  if (kind === 'PONTE') {
    if (Math.abs(x) <= BRIDGE.platHalfW && ((z >= BRIDGE.startFrom && z <= BRIDGE.startTo) || (z >= BRIDGE.finishFrom && z <= BRIDGE.finishTo))) return 0;
    const t = tileAt(x, z);
    return t && !brokenTiles.has(`${t.row}:${t.side}`) ? 0 : null;
  }
  if (kind === 'BOTTO') return Math.hypot(x, z) <= PLAZA.r ? 0 : null;
  if (kind === 'WAFER') {
    const i = hexAt(x, z);
    if (i < 0) return null;
    // il piano più alto ancora intero sotto i piedi
    for (let l = 0; l < WAFER.layers; l++) {
      const ly = waferY(l);
      if (y !== undefined && y < ly - 0.6) continue;
      if (hexChar(l, i) !== '2') return ly;
    }
    return null;
  }
  if (kind === 'FRUTTA') {
    const i = fruitTileAt(x, z);
    return i >= 0 && fruitOpen[i] !== false ? 0 : null;
  }
  if (kind === 'POMODORI') {
    if (Math.hypot(x, z) > marketRadius(t)) return null;
    const c = crateAt(x, z);
    return c && (y === undefined || y >= c.h - 0.6) ? c.h : 0;
  }
  if (kind === 'CORSA') {
    if (Math.abs(x) <= RACE.halfW && ((z >= RACE.back && z <= RACE.gapFrom) || (z >= RACE.gapTo && z <= RACE.front))) return 0;
    return platAt(x, z, t) >= 0 ? 0 : null;
  }
  return 0;
}

// velocità del pavimento sotto i piedi (le piattaforme mobili della corsa ti portano con sé)
export function groundVel(kind: MiniKind, x: number, z: number, t: number): { x: number; z: number } {
  const ext = MINIS[kind];
  if (ext) return ext.groundVel ? ext.groundVel(x, z, t) : { x: 0, z: 0 };
  if (kind !== 'CORSA') return { x: 0, z: 0 };
  const i = platAt(x, z, t);
  return { x: i >= 0 ? platVX(i, t) : 0, z: 0 };
}

// Pareti: tengono i personaggi dentro l'arena (e fuori dalle casse)
export function clampArena(kind: MiniKind, p: { x: number; z: number; y?: number }, t = 0) {
  const r = PHYS.radius;
  const ext = MINIS[kind];
  if (ext) ext.clamp?.(p, t);
  else if (kind === 'CALCIO') {
    // dentro la porta ci si può infilare (il portiere), ai lati c'è la sponda
    if (Math.abs(p.z) > PITCH.halfL - r) p.x = Math.max(-PITCH.goalW + r, Math.min(PITCH.goalW - r, p.x));
    p.x = Math.max(-PITCH.halfW + r, Math.min(PITCH.halfW - r, p.x));
    const zMax = Math.abs(p.x) < PITCH.goalW - r ? PITCH.halfL + PITCH.goalD - r : PITCH.halfL - r;
    p.z = Math.max(-zMax, Math.min(zMax, p.z));
  } else if (kind === 'POMODORI') {
    // le cassette: si sbatte contro (ma ci si può saltare sopra)
    for (const b of CRATES) {
      if ((p.y ?? 0) >= b.h - 0.2) continue;
      const dx = p.x - b.x;
      const dz = p.z - b.z;
      const ox = b.w / 2 + r - Math.abs(dx);
      const oz = b.d / 2 + r - Math.abs(dz);
      if (ox > 0 && oz > 0) {
        if (ox < oz) p.x += Math.sign(dx || 1) * ox;
        else p.z += Math.sign(dz || 1) * oz;
      }
    }
  } else if (kind === 'CORSA') {
    p.z = Math.max(RACE.back + r, Math.min(RACE.front - r, p.z));
    // i perni delle barre che girano
    for (const sw of SWEEPERS) {
      const dx = p.x;
      const dz = p.z - sw.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.7 + r && d > 0.001) {
        p.x = (dx / d) * (0.7 + r);
        p.z = sw.z + (dz / d) * (0.7 + r);
      }
    }
    // le file di porte: si passa solo da quelle sfondate
    if (Math.abs(p.x) <= RACE.halfW + 0.3)
      DOOR_ROWS.forEach((rowZ, row) => {
        const dz = p.z - rowZ;
        if (Math.abs(dz) >= DOOR.half + r) return;
        const i = Math.max(0, Math.min(DOOR.n - 1, Math.floor((p.x + RACE.halfW) / DOOR.slot)));
        if (openDoors.has(`${row}:${i}`) && Math.abs(p.x - doorX(i)) < DOOR.slot / 2 - 0.12) return;
        p.z = rowZ + (dz >= 0 ? 1 : -1) * (DOOR.half + r);
      });
  } else if (kind === 'REDLIGHT') {
    p.x = Math.max(-RED.halfW + r, Math.min(RED.halfW - r, p.x));
    p.z = Math.max(RED.back + r, Math.min(RED.front - r, p.z));
  } else if (kind === 'CHAIRS') {
    const d = Math.hypot(p.x, p.z);
    if (d > CHAIRS.r - r) {
      p.x *= (CHAIRS.r - r) / d;
      p.z *= (CHAIRS.r - r) / d;
    }
  } else if (kind === 'GALLINA') {
    const d = Math.hypot(p.x, p.z);
    if (d > YARD.r - r) {
      p.x *= (YARD.r - r) / d;
      p.z *= (YARD.r - r) / d;
    }
  } else if (kind === 'PONTE') {
    p.z = Math.max(BRIDGE.startFrom + r, Math.min(BRIDGE.finishTo - r, p.z));
  } else if (kind === 'POLPETTE') {
    p.z = Math.max(SLOPE.back + r, Math.min(SLOPE.front - r, p.z));
    for (const o of SLOPE_POSTS) {
      const dx = p.x - o.x;
      const dz = p.z - o.z;
      const d = Math.hypot(dx, dz);
      if (d < POST_R + r && d > 0.001) {
        p.x = o.x + (dx / d) * (POST_R + r);
        p.z = o.z + (dz / d) * (POST_R + r);
      }
    }
  } else if (kind === 'SNIPER') {
    p.x = Math.max(-SNIPER.halfW + r, Math.min(SNIPER.halfW - r, p.x));
    p.z = Math.max(SNIPER.back + r, Math.min(SNIPER.front - r, p.z));
    for (const b of SNIPER_BOXES) {
      // spinge fuori dalla cassa lungo il lato più vicino
      const dx = p.x - b.x;
      const dz = p.z - b.z;
      const ox = b.w / 2 + r - Math.abs(dx);
      const oz = b.d / 2 + r - Math.abs(dz);
      if (ox > 0 && oz > 0) {
        if (ox < oz) p.x += Math.sign(dx || 1) * ox;
        else p.z += Math.sign(dz || 1) * oz;
      }
    }
  }
}

// ---------------------------------------------------------------- corpo che si muove

export interface Body {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  kx: number; // spinta ricevuta (si smorza)
  kz: number;
  r: number; // verso dove guarda (radianti, 0 = +z)
  ground: boolean;
  dashT?: number; // secondi di scatto rimasti
  dashDir?: number;
  dive?: boolean; // tuffo in corso (fino all'atterraggio)
  airJumps?: number; // salti fatti in aria (doppio salto)
}
export interface Input {
  x: number; // -1..1 direzione nel mondo
  z: number;
  jump: boolean;
  dash?: boolean; // scatto a terra / tuffo in aria
}
export const newBody = (x: number, z: number, r = 0, y = 0): Body => ({ x, y, z, vx: 0, vy: 0, vz: 0, kx: 0, kz: 0, r, ground: true, dashT: 0, dive: false, airJumps: 0 });

// Un passo di fisica (uguale per il mio personaggio e per i bot)
export function stepBody(b: Body, input: Input, dt: number, kind: MiniKind, t: number, speedMul = 1) {
  speedMul *= speedOf(kind);
  const ext = MINIS[kind];
  if (ext?.autoRun && Math.hypot(input.x, input.z) < 0.3) input = { ...input, x: Math.sin(b.r), z: Math.cos(b.r) };
  if (ext?.noJump) input = { ...input, jump: false };
  const len = Math.min(1, Math.hypot(input.x, input.z));
  const ix = len > 0.05 ? (input.x / Math.max(1, Math.hypot(input.x, input.z))) * PHYS.speed * speedMul : 0;
  const iz = len > 0.05 ? (input.z / Math.max(1, Math.hypot(input.x, input.z))) * PHYS.speed * speedMul : 0;
  const grip = MINIS[kind]?.grip;
  if (b.ground && grip) {
    // si scivola: la velocità va verso quella voluta poco alla volta
    const k = Math.min(1, dt * grip);
    b.vx += (ix - b.vx) * k;
    b.vz += (iz - b.vz) * k;
  } else if (b.ground) {
    b.vx = ix;
    b.vz = iz;
  } else {
    const k = Math.min(1, dt * 3);
    b.vx += (ix - b.vx) * k;
    b.vz += (iz - b.vz) * k;
  }
  if (input.jump && b.ground) {
    b.vy = PHYS.jumpV;
    b.ground = false;
  } else if (input.jump && !b.ground && (b.airJumps ?? 0) < 1 && !b.dive && !noDoubleJump(kind)) {
    // doppio salto
    b.vy = PHYS.jumpV * PHYS.doubleJump;
    b.airJumps = 1;
  }
  const dir = len > 0.05 ? Math.atan2(input.x, input.z) : b.r;
  if (input.dash && !noDash(kind)) {
    if (b.ground) {
      b.dashT = PHYS.dashTime;
      b.dashDir = dir;
    } else if (!b.dive) {
      // tuffo: un balzo in avanti in volo
      b.dive = true;
      b.dashDir = dir;
      b.vx = Math.sin(dir) * PHYS.diveSpeed;
      b.vz = Math.cos(dir) * PHYS.diveSpeed;
      b.vy = Math.min(Math.max(b.vy, 1.5), 3.5);
    }
  }
  if ((b.dashT ?? 0) > 0) {
    b.dashT = Math.max(0, (b.dashT ?? 0) - dt);
    b.vx = Math.sin(b.dashDir ?? b.r) * PHYS.dashSpeed;
    b.vz = Math.cos(b.dashDir ?? b.r) * PHYS.dashSpeed;
  } else if (b.dive && !b.ground) {
    // in tuffo si tiene lo slancio
    b.vx = Math.sin(b.dashDir ?? b.r) * PHYS.diveSpeed;
    b.vz = Math.cos(b.dashDir ?? b.r) * PHYS.diveSpeed;
  }
  const fr = Math.exp(-(b.ground ? 3.4 : 0.8) * dt); // a terra la spinta si smorza piano: si scivola
  b.kx *= fr;
  b.kz *= fr;
  b.vy -= PHYS.gravity * dt;
  const prevY = b.y;
  // la piattaforma mobile su cui sto mi porta con sé
  const carry = b.ground ? groundVel(kind, b.x, b.z, t) : { x: 0, z: 0 };
  b.x += (b.vx + b.kx + carry.x) * dt;
  b.z += (b.vz + b.kz + carry.z) * dt;
  b.y += b.vy * dt;
  const g = groundAt(kind, b.x, b.z, t, prevY);
  if (g !== null && b.y <= g && prevY >= g - 0.6) {
    b.y = g;
    b.vy = 0;
    if (b.dive) {
      // atterraggio di pancia: si scivola un attimo
      b.kx += b.vx * 0.5;
      b.kz += b.vz * 0.5;
      b.vx = 0;
      b.vz = 0;
    }
    b.ground = true;
    b.dive = false;
    b.airJumps = 0;
  } else b.ground = false;
  // le pareti valgono solo finché si è sopra il pavimento (chi cade dall'isola cade e basta)
  if (b.y > -1 || MINIS[kind]) clampArena(kind, b, t);
  if (Math.hypot(b.vx, b.vz) > 0.3) b.r = Math.atan2(b.vx, b.vz);
}

// Chi colpisce una spinta: davanti a chi spinge, entro la portata
export function pushTargets(from: { x: number; z: number; r: number }, others: { id: string; x: number; y: number; z: number }[]) {
  const fx = Math.sin(from.r);
  const fz = Math.cos(from.r);
  return others.filter((o) => {
    const dx = o.x - from.x;
    const dz = o.z - from.z;
    const d = Math.hypot(dx, dz);
    if (d > PHYS.pushRange || d < 0.01) return d < 0.01;
    return (dx * fx + dz * fz) / d > 0.2; // entro ~78° davanti
  });
}

// Il segmento a→b attraversa una cassa? (per i cecchini: chi è riparato non si colpisce)
export function blockedByBoxes(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) {
  for (const box of SNIPER_BOXES) {
    const min = [box.x - box.w / 2, 0, box.z - box.d / 2];
    const max = [box.x + box.w / 2, box.h, box.z + box.d / 2];
    const o = [a.x, a.y, a.z];
    const dir = [b.x - a.x, b.y - a.y, b.z - a.z];
    let t0 = 0;
    let t1 = 1;
    let hit = true;
    for (let i = 0; i < 3 && hit; i++) {
      if (Math.abs(dir[i]) < 1e-9) {
        if (o[i] < min[i] || o[i] > max[i]) hit = false;
      } else {
        let ta = (min[i] - o[i]) / dir[i];
        let tb = (max[i] - o[i]) / dir[i];
        if (ta > tb) [ta, tb] = [tb, ta];
        t0 = Math.max(t0, ta);
        t1 = Math.min(t1, tb);
        if (t0 > t1) hit = false;
      }
    }
    if (hit) return true;
  }
  return false;
}

// Colori dei bot e nomi buffi
export const BOT_NAMES = ['Gino', 'Pina', 'Ugo', 'Rita', 'Tonio', 'Lella', 'Mirko', 'Sasà', 'Fefè', 'Nando', 'Ornella', 'Brando'];
export const PARTY_COLORS = ['#ff4d6d', '#ffb703', '#2ec4b6', '#3a86ff', '#8338ec', '#fb5607', '#06d6a0', '#ff70a6', '#70d6ff', '#9ef01a', '#e0aaff', '#f15bb5'];

// Posizione che viaggia in rete: x, y, z, verso (r) e animazione (a)
export interface NetPos {
  x: number;
  y: number;
  z: number;
  r: number;
  a: number;
}

// Animazioni (codice che viaggia in rete)
export const ANIM = { idle: 0, walk: 1, air: 2, sit: 3, fall: 4, dance: 5, push: 6, dive: 7, dash: 8 } as const;
