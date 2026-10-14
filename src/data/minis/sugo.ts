// 🍅 Sale il sugo: si sale a spirale intorno al pentolone gigante mentre il sugo bollente sale dal basso (regole fisiche)
// Il percorso è fisso (uguale su telefono e server): pane, formaggi, lasagne, cucchiai, mestoli, molle di spaghetti.
import { PHYS, registerMini } from '../party3d';

export const SUGO = {
  potR: 8, // raggio del pentolone
  top: 40, // quota del coperchio (traguardo)
  lidR: 8.9, // il coperchio sporge un po'
  knobR: 1.1, // il pomello in mezzo al coperchio
  knobH: 1.1,
  baseR: 15, // la focaccia di partenza (quota 0)
  start: -4, // quota del sugo al VIA
  v0: 0.35, // velocità del sugo all'inizio (m/s)…
  acc: 0.0058, // …e quanto accelera (sempre più veloce: arriva in cima dopo ~62 s)
  springV: 15.5, // la molla di spaghetti lancia in alto (~4 m)
  pendY: 5.6, // batticarne a pendolo: perno sopra la lasagna (la testa scende fino a 1,2 m)
  pendArm: 4.4,
  pendAmp: 1.0,
  pendHit: 0.9, // quanto è "spessa" la testa (lungo il giro) per chi la prende
  pendSafe: 3.85, // oltre questa distanza dal centro della lasagna il batticarne non arriva mai basso
  sweepH: 0.55, // mattarello che gira rasoterra sulla pizza
  sweepR: 3.0,
  postR: 0.55, // il macinapepe in mezzo (perno del mattarello)
};

// quota del sugo (t = secondi dal VIA): uguale per tutti, si vede salire e chi lo tocca è fuori
export const sugoLevel = (t: number) => {
  const s = Math.max(0, t);
  return Math.min(SUGO.top + 4, SUGO.start + SUGO.v0 * s + SUGO.acc * s * s);
};
// velocità del sugo (per l'HUD e i bot)
export const sugoSpeed = (t: number) => SUGO.v0 + 2 * SUGO.acc * Math.max(0, t);

export type SugoKind = 'pane' | 'formaggio' | 'lasagna' | 'cucchiaio' | 'mestolo' | 'molla' | 'pizza';
export interface SugoPlat {
  i: number;
  k: SugoKind;
  th: number; // angolo del centro (x = sin, z = cos)
  rho: number; // distanza del centro dall'asse del pentolone
  y: number; // quota del piano
  hl: number; // mezza lunghezza lungo il giro (rettangoli)
  hw: number; // mezza larghezza verso fuori (rettangoli)
  disc: number; // raggio (piattaforme tonde), 0 = rettangolo
  amp: number; // scorre avanti e indietro lungo il giro: ampiezza (m)…
  w: number; // …velocità (rad/s)…
  ph: number; // …e fase
  spin: number; // gira su se stessa (rad/s)
  pend: number; // batticarne a pendolo sopra (rad/s), 0 = niente
  pendPh: number;
  sweep: number; // mattarello che gira sopra (rad/s), 0 = niente
  cx: number; // centro da fermo
  cz: number;
  sn: number; // sin/cos dell'angolo (da ferma)
  cs: number;
  bound: number; // raggio che contiene tutta la corsa della piattaforma
}

interface Spec {
  k: SugoKind;
  gap: number; // spazio vuoto da quella prima (lungo il giro)
  dy: number; // quanto è più alta di quella prima
  l?: number; // lunghezza lungo il giro (rettangoli)
  w?: number; // larghezza verso fuori (rettangoli, attaccati al pentolone)
  r?: number; // raggio (tonde)
  rho?: number; // distanza dall'asse (tonde, o rettangoli staccati)
  slide?: [number, number, number]; // ampiezza, velocità, fase
  spin?: number;
  pend?: [number, number];
  sweep?: number;
}

// Il percorso: scalini normali (salto), alti (doppio salto), molle (+3,7 m), lunghi salti, cose che si muovono
const SPEC: Spec[] = [
  { k: 'pane', gap: 0, dy: 1.0, l: 4.4, w: 3.2 },
  { k: 'pane', gap: 2.0, dy: 1.0, l: 3.8, w: 3.0 },
  { k: 'formaggio', gap: 2.2, dy: 1.1, l: 3.4, w: 3.0 },
  { k: 'formaggio', gap: 2.6, dy: 0.8, l: 3.0, w: 2.4, rho: 12.2, slide: [1.6, 1.8, 0] },
  { k: 'pane', gap: 2.4, dy: 1.0, l: 4.0, w: 3.0 },
  { k: 'molla', gap: 2.0, dy: 0.4, r: 1.3, rho: 9.7 },
  { k: 'lasagna', gap: 2.2, dy: 3.6, l: 5.6, w: 3.4 },
  { k: 'cucchiaio', gap: 2.1, dy: 1.0, l: 1.8, w: 4.2 },
  { k: 'cucchiaio', gap: 2.3, dy: 1.0, l: 1.8, w: 4.2 },
  { k: 'pane', gap: 3.6, dy: 0.2, l: 4.0, w: 3.0 },
  { k: 'lasagna', gap: 2.0, dy: 1.0, l: 10.4, w: 3.4, pend: [2.2, 0] },
  { k: 'formaggio', gap: 2.2, dy: 1.9, l: 3.6, w: 3.0 },
  { k: 'pizza', gap: 2.4, dy: 1.0, r: 2.5, rho: 13.4, spin: 0.85 },
  { k: 'mestolo', gap: 2.3, dy: 1.2, r: 1.45, rho: 10.9 },
  { k: 'mestolo', gap: 2.3, dy: 1.2, r: 1.45, rho: 9.9 },
  { k: 'molla', gap: 2.1, dy: 0.5, r: 1.3, rho: 9.7 },
  { k: 'pizza', gap: 2.2, dy: 3.7, r: 3.2, rho: 11.3, sweep: 1.25 },
  { k: 'pane', gap: 2.2, dy: 1.0, l: 3.8, w: 3.0 },
  { k: 'formaggio', gap: 2.6, dy: 1.0, l: 3.0, w: 2.4, rho: 12.2, slide: [1.6, 1.55, 0] },
  { k: 'formaggio', gap: 3.4, dy: 1.0, l: 3.0, w: 2.4, rho: 12.2, slide: [1.6, 1.55, Math.PI] },
  { k: 'pane', gap: 2.3, dy: 1.2, l: 3.8, w: 3.0 },
  { k: 'cucchiaio', gap: 2.3, dy: 1.8, l: 1.9, w: 4.2 },
  { k: 'molla', gap: 2.0, dy: 0.5, r: 1.3, rho: 9.7 },
  { k: 'lasagna', gap: 2.2, dy: 3.7, l: 10.4, w: 3.4, pend: [2.5, 1.6] },
  { k: 'mestolo', gap: 2.4, dy: 1.2, r: 1.4, rho: 10.4 },
  { k: 'mestolo', gap: 2.6, dy: 1.2, r: 1.4, rho: 12.6, slide: [1.5, 1.45, 0.5] },
  { k: 'cucchiaio', gap: 2.5, dy: 1.4, l: 1.8, w: 4.2 },
  { k: 'pane', gap: 3.6, dy: 0.6, l: 3.6, w: 3.0 },
  { k: 'formaggio', gap: 2.2, dy: 1.6, l: 4.2, w: 3.2 },
];

export const SUGO_PLATS: SugoPlat[] = [];
{
  let th = 0.55;
  let y = 0;
  SPEC.forEach((s, i) => {
    const disc = s.r ?? 0;
    const hl = disc || (s.l ?? 3) / 2;
    const hw = disc || (s.w ?? 3) / 2;
    const rho = s.rho ?? SUGO.potR + hw; // i rettangoli sono attaccati al pentolone
    if (i > 0) {
      const p = SUGO_PLATS[i - 1];
      th += ((p.disc || p.hl) + s.gap + hl) / ((p.rho + rho) / 2);
    }
    y += s.dy;
    const amp = s.slide?.[0] ?? 0;
    SUGO_PLATS.push({
      i,
      k: s.k,
      th,
      rho,
      y: Math.round(y * 100) / 100,
      hl,
      hw,
      disc,
      amp,
      w: s.slide?.[1] ?? 0,
      ph: s.slide?.[2] ?? 0,
      spin: s.spin ?? 0,
      pend: s.pend?.[0] ?? 0,
      pendPh: s.pend?.[1] ?? 0,
      sweep: s.sweep ?? 0,
      cx: Math.sin(th) * rho,
      cz: Math.cos(th) * rho,
      sn: Math.sin(th),
      cs: Math.cos(th),
      bound: Math.hypot(hl, hw) + amp + 0.05,
    });
  });
}
export const SUGO_N = SUGO_PLATS.length;
export const SUGO_BASE = -1; // la focaccia di partenza
export const SUGO_LID = -2; // il coperchio (arrivo)
export const SUGO_NONE = -3;

// angolo e centro di una piattaforma all'istante t (quelle che scorrono si spostano lungo il giro)
export function sugoAngle(p: SugoPlat, t: number) {
  return p.amp ? p.th + (p.amp / p.rho) * Math.sin(p.w * t + p.ph) : p.th;
}
// (x, z) è sopra la piattaforma p all'istante t?
export function inSugoPlat(p: SugoPlat, x: number, z: number, t: number): boolean {
  let dx = x - p.cx;
  let dz = z - p.cz;
  if (dx * dx + dz * dz > p.bound * p.bound) return false;
  let s = p.sn;
  let c = p.cs;
  if (p.amp) {
    const a = sugoAngle(p, t);
    s = Math.sin(a);
    c = Math.cos(a);
    dx = x - p.rho * s;
    dz = z - p.rho * c;
  }
  if (p.disc) return dx * dx + dz * dz <= p.disc * p.disc;
  const u = dx * c - dz * s; // lungo il giro
  const v = dx * s + dz * c; // verso fuori
  return u <= p.hl && u >= -p.hl && v <= p.hw && v >= -p.hw;
}
// su cosa sono? (la più alta raggiungibile da quota y): indice, SUGO_LID, SUGO_BASE o SUGO_NONE
export function sugoPlatAt(x: number, z: number, t: number, y = 1e9): number {
  const lim = y + 0.6;
  const r2 = x * x + z * z;
  if (lim >= SUGO.top && r2 <= SUGO.lidR * SUGO.lidR) return SUGO_LID;
  for (let i = SUGO_N - 1; i >= 0; i--) {
    const p = SUGO_PLATS[i];
    if (p.y > lim) continue;
    if (inSugoPlat(p, x, z, t)) return i;
  }
  if (lim >= 0 && r2 <= SUGO.baseR * SUGO.baseR) return SUGO_BASE;
  return SUGO_NONE;
}
export const sugoTopOf = (i: number) => (i === SUGO_LID ? SUGO.top : i === SUGO_BASE ? 0 : i >= 0 ? SUGO_PLATS[i].y : -99);

// velocità del piano di una piattaforma in (x, z) (quelle che scorrono e la pizza che gira)
export function sugoPlatVel(p: SugoPlat, x: number, z: number, t: number): { x: number; z: number } {
  if (p.amp) {
    const a = sugoAngle(p, t);
    const v = p.amp * p.w * Math.cos(p.w * t + p.ph);
    return { x: Math.cos(a) * v, z: -Math.sin(a) * v };
  }
  if (p.spin) return { x: p.spin * (z - p.cz), z: -p.spin * (x - p.cx) };
  return { x: 0, z: 0 };
}

// batticarne a pendolo: angolo e posizione della testa (u = lungo il giro dal centro della lasagna, quota)
export function sugoPend(p: SugoPlat, t: number) {
  const a = SUGO.pendAmp * Math.sin(p.pend * t + p.pendPh);
  const va = SUGO.pendAmp * p.pend * Math.cos(p.pend * t + p.pendPh);
  return { a, va, u: Math.sin(a) * SUGO.pendArm, y: p.y + SUGO.pendY - Math.cos(a) * SUGO.pendArm };
}
export const sugoSweepAngle = (p: SugoPlat, t: number) => p.sweep * Math.max(0, t);

// il pavimento sotto i piedi: le ultime risposte di ground() (la velocità del pavimento non sa la quota:
// la ritrova qui, perché il passo dopo chiede proprio il punto in cui il corpo è atterrato)
const CACHE = 96;
const cacheX = new Float64Array(CACHE);
const cacheZ = new Float64Array(CACHE);
const cacheI = new Int16Array(CACHE).fill(SUGO_NONE);
let cacheAt = 0;
const MOVING = SUGO_PLATS.filter((p) => p.amp || p.spin);
const SWEEPS = SUGO_PLATS.filter((p) => p.sweep);
const ZERO = { x: 0, z: 0 };

registerMini({
  kind: 'SUGO',
  name: 'Sale il sugo',
  tag: 'Arrampicata',
  rules:
    'Il sugo bollente sale sempre più veloce! Salta di piattaforma in piattaforma a spirale intorno al pentolone fino al coperchio. Le molle di spaghetti lanciano in alto, occhio al batticarne e al mattarello. Chi tocca il sugo è fuori: chi arriva prima vince, poi conta quanto sei salito.',
  seconds: 100,
  fallOut: -30,
  ground: (x, z, t, y) => {
    const i = sugoPlatAt(x, z, t, y);
    cacheX[cacheAt] = x;
    cacheZ[cacheAt] = z;
    cacheI[cacheAt] = i;
    cacheAt = (cacheAt + 1) % CACHE;
    return i === SUGO_NONE ? null : sugoTopOf(i);
  },
  groundVel: (x, z, t) => {
    for (let k = 0; k < CACHE; k++) {
      if (cacheX[k] !== x || cacheZ[k] !== z) continue;
      const i = cacheI[k];
      return i >= 0 && (SUGO_PLATS[i].amp || SUGO_PLATS[i].spin) ? sugoPlatVel(SUGO_PLATS[i], x, z, t) : ZERO;
    }
    // (non dovrebbe succedere: se proprio non lo so, guardo solo quelle che si muovono)
    for (const p of MOVING) if (inSugoPlat(p, x, z, t)) return sugoPlatVel(p, x, z, t);
    return ZERO;
  },
  clamp: (p) => {
    const y = p.y ?? 0;
    const r = PHYS.radius;
    const d2 = p.x * p.x + p.z * p.z;
    if (y < SUGO.top - 0.3) {
      // la parete del pentolone
      const R = SUGO.potR + r;
      if (d2 < R * R) {
        const d = Math.sqrt(d2) || 1e-6;
        p.x *= R / d;
        p.z *= R / d;
      }
    } else if (y < SUGO.top + SUGO.knobH) {
      // il pomello del coperchio
      const R = SUGO.knobR + r;
      if (d2 < R * R) {
        const d = Math.sqrt(d2) || 1e-6;
        p.x *= R / d;
        p.z *= R / d;
      }
    }
    // il macinapepe in mezzo alla pizza col mattarello
    for (const q of SWEEPS) {
      if (y < q.y - 0.5 || y > q.y + 2.4) continue;
      const dx = p.x - q.cx;
      const dz = p.z - q.cz;
      const R = SUGO.postR + r;
      const dd = dx * dx + dz * dz;
      if (dd < R * R && dd > 1e-8) {
        const d = Math.sqrt(dd);
        p.x = q.cx + (dx / d) * R;
        p.z = q.cz + (dz / d) * R;
      }
    }
  },
});
