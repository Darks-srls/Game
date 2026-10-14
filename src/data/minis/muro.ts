// 🧱 Il muro di lasagna: muri di lasagna attraversano la teglia uno dopo l'altro; si passa solo dai buchi (o sopra quelli bassi).
// Regole fisiche uguali per telefono e server: la sequenza dei muri si calcola dal "seme" scelto dal server (arriva con
// la view e passa da sync) e la posizione di ogni muro è una funzione del tempo, così telefono e server sono d'accordo.
import { registerMini } from '../party3d';

export const MURO = {
  half: 10, // metà lato della teglia
  start: -16, // da dove parte un muro (lungo la sua direzione: sale da sotto la teglia)
  end: 14, // dove sparisce
  th: 0.5, // spessore
  hFull: 3.4, // muro pieno (non si salta)
  hLow: 0.85, // muro basso (si salta)
  holeW: 0.85, // metà larghezza di un buco (la sagoma dell'omino)
  holeH: 2.3, // altezza del buco (solo grafica)
  lane: 0.32, // dentro il buco si viene "infilati" a non più di questo dal centro
  gap2: 4.5, // distanza tra i due muri del muro doppio
  slideV: 2.4, // schiacciati contro il muro si scivola di lato piano (m/s): il buco va raggiunto prima
  until: 160, // la sequenza si calcola fino a qui
};

// tipi: 0 muro pieno con 1-2 buchi, 1 muro basso, 2 muro doppio (due muri con un buco ciascuno, in posti diversi)
export interface MuroWall {
  t0: number; // quando parte (s dal via)
  dir: number; // 0 verso +x, 1 verso -x, 2 verso +z, 3 verso -z
  v: number; // velocità (m/s)
  type: 0 | 1 | 2;
  holes: number[]; // centri dei buchi (coordinata laterale) del primo muro
  holes2: number[]; // … e del secondo (muro doppio)
}

// direzione di marcia (f) e laterale (l) per ognuna delle 4 direzioni (yaw: rotation.y della grafica)
export const MURO_DIRS = [
  { fx: 1, fz: 0, lx: 0, lz: -1, yaw: Math.PI / 2 },
  { fx: -1, fz: 0, lx: 0, lz: 1, yaw: -Math.PI / 2 },
  { fx: 0, fz: 1, lx: 1, lz: 0, yaw: 0 },
  { fx: 0, fz: -1, lx: -1, lz: 0, yaw: Math.PI },
];

// generatore pseudo-casuale con seme (mulberry32): uguale sul telefono e sul server
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// centri dei buchi su una griglia di mezzo metro (pochi tipi di muro diversi: la grafica li riusa)
const holeSpot = (rnd: () => number, lim: number) => Math.round((rnd() * 2 - 1) * lim * 2) / 2;

function buildWalls(seed: number): MuroWall[] {
  const rnd = seeded(seed);
  const walls: MuroWall[] = [];
  let t = 2.5;
  let last = -1;
  let same = 0;
  while (t < MURO.until) {
    const v = Math.min(10, 3.4 + t * 0.08);
    const r = rnd();
    // all'inizio muri pieni con due buchi e qualche muro basso; poi un buco solo e i muri doppi
    const type: 0 | 1 | 2 = t < 18 ? (r < 0.72 ? 0 : 1) : t < 40 ? (r < 0.5 ? 0 : r < 0.75 ? 1 : 2) : r < 0.45 ? 0 : r < 0.65 ? 1 : 2;
    let holes: number[] = [];
    let holes2: number[] = [];
    if (type === 0) {
      const two = t < 22 || rnd() < Math.max(0.1, 0.6 - t * 0.01);
      const a = holeSpot(rnd, 8);
      holes = [a];
      if (two) {
        let b = a;
        for (let k = 0; k < 20 && Math.abs(b - a) < 5; k++) b = holeSpot(rnd, 8);
        holes.push(b);
      }
    } else if (type === 2) {
      const a = holeSpot(rnd, 7);
      let b = a;
      for (let k = 0; k < 30 && (Math.abs(b - a) < 3.5 || Math.abs(b - a) > 6); k++) b = holeSpot(rnd, 7);
      holes = [a];
      holes2 = [b];
    }
    // direzione a caso (mai tre di fila uguali)
    let dir = Math.floor(rnd() * 4);
    if (dir === last && same >= 1) dir = (dir + 1 + Math.floor(rnd() * 3)) % 4;
    same = dir === last ? same + 1 : 0;
    last = dir;
    walls.push({ t0: Math.round(t * 100) / 100, dir, v, type, holes, holes2 });
    // più avanti a volte arriva anche un muro di traverso, insieme (l'incrocio)
    if (t > 45 && type !== 2 && rnd() < 0.3) {
      const a = holeSpot(rnd, 7);
      let b = a;
      for (let k = 0; k < 20 && Math.abs(b - a) < 5; k++) b = holeSpot(rnd, 7);
      const cross = (dir < 2 ? 2 : 0) + Math.floor(rnd() * 2);
      walls.push({ t0: Math.round((t + 0.5) * 100) / 100, dir: cross, v: v * 0.9, type: 0, holes: [a, b], holes2: [] });
      t += 1;
    }
    t += Math.max(1.3, 5.2 - t * 0.06) + rnd() * 1.2 + (type === 2 ? 1 : 0);
  }
  return walls;
}

const CACHE = new Map<number, MuroWall[]>();
export function muroWalls(seed: number) {
  let w = CACHE.get(seed);
  if (!w) {
    w = buildWalls(seed);
    CACHE.set(seed, w);
    if (CACHE.size > 8) CACHE.delete(CACHE.keys().next().value!);
  }
  return w;
}

let walls: MuroWall[] = muroWalls(1);
let curSeed = 1;
export const muroCurrent = () => walls;
export function setMuroSeed(seed: number) {
  if (seed !== curSeed) {
    curSeed = seed;
    walls = muroWalls(seed);
  }
}

// dove è il muro (centro del primo muro, lungo la sua direzione) al tempo t
export const muroPos = (w: MuroWall, t: number) => MURO.start + w.v * (t - w.t0);
// per quanto tempo un muro resta in giro
export const muroLife = (w: MuroWall) => (MURO.end - MURO.start + (w.type === 2 ? MURO.gap2 : 0)) / w.v;
export const muroHeight = (w: MuroWall) => (w.type === 1 ? MURO.hLow : MURO.hFull);
// indice del primo muro che può essere ancora in giro al tempo t (i muri sono in ordine di partenza)
export function muroFirst(t: number) {
  let lo = 0;
  let hi = walls.length;
  // nessun muro dura più di 10 s
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (walls[mid].t0 < t - 10) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

// chi è schiacciato contro un muro: da dove scivola (un oggetto per corpo, riusato)
const PRESS = new WeakMap<object, { k: number; lat: number; t: number }>();

registerMini({
  kind: 'MURO',
  name: 'Il muro di lasagna',
  tag: 'Trova il buco',
  rules:
    'Muri di lasagna attraversano la teglia da tutte le parti, sempre più veloci: infilati nel buco a forma di omino, salta quelli bassi e occhio ai muri doppi (due buchi in posti diversi). Se il muro ti prende ti spinge giù dal bordo: puoi ancora scivolare di lato fino al buco! Vince l’ultimo in piedi.',
  seconds: 100,
  ground: (x, z) => (x >= -MURO.half && x <= MURO.half && z >= -MURO.half && z <= MURO.half ? 0 : null),
  // i muri spingono: chi ci sbatte contro viene portato avanti (nel buco si passa, sopra quelli bassi si salta)
  clamp: (p, t) => {
    const y = p.y ?? 0;
    if (y < -1.5 || t <= 0) return;
    const r = 0.55;
    const lim = MURO.th / 2 + r;
    for (let k = muroFirst(t); k < walls.length; k++) {
      const w = walls[k];
      if (w.t0 > t) break;
      if (y >= muroHeight(w) - 0.05) continue;
      const s0 = muroPos(w, t);
      if (s0 > MURO.end + 1 + MURO.gap2) continue;
      const D = MURO_DIRS[w.dir];
      let along = p.x * D.fx + p.z * D.fz;
      let lat = p.x * D.lx + p.z * D.lz;
      let moved = false;
      for (let slab = 0; slab < (w.type === 2 ? 2 : 1); slab++) {
        const s = s0 - slab * MURO.gap2;
        const d = along - s;
        if (d >= lim || d <= -lim) continue;
        const holes = slab ? w.holes2 : w.holes;
        let inHole = false;
        for (let h = 0; h < holes.length; h++) {
          const dl = lat - holes[h];
          if (dl > -MURO.holeW && dl < MURO.holeW) {
            // dentro il buco: ci si infila (spinti verso il centro)
            inHole = true;
            if (dl > MURO.lane) lat = holes[h] + MURO.lane;
            else if (dl < -MURO.lane) lat = holes[h] - MURO.lane;
            break;
          }
        }
        if (!inHole) {
          along = d >= 0 ? s + lim : s - lim;
          // contro la lasagna si scivola di lato piano
          const id = k * 2 + slab;
          const pr = PRESS.get(p);
          if (pr && pr.k === id && t > pr.t && t - pr.t < 0.25) {
            const mx = MURO.slideV * (t - pr.t);
            if (lat > pr.lat + mx) lat = pr.lat + mx;
            else if (lat < pr.lat - mx) lat = pr.lat - mx;
          }
          if (pr) {
            pr.k = id;
            pr.lat = lat;
            pr.t = t;
          } else PRESS.set(p, { k: id, lat, t });
        }
        moved = true;
      }
      if (moved) {
        p.x = along * D.fx + lat * D.lx;
        p.z = along * D.fz + lat * D.lz;
      }
    }
  },
  sync: (ext) => {
    if (ext && typeof ext.seed === 'number') setMuroSeed(ext.seed);
  },
});
