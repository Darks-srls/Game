// 🍝 Salta la corda: due cuochi giganti fanno girare uno spaghetto al dente (asse lungo x) su un cerchio verticale.
// Regole fisiche uguali per telefono e server: l'angolo dello spaghetto è una funzione del tempo di gioco e del "seme"
// scelto dal server (arriva con la view e passa da sync): velocità che cresce, cambi di verso, il secondo spaghetto.
// Angolo θ: 0 = in basso (lo spaghetto è a quota cy - R, sopra z = 0), θ cresce = in basso va verso +z.
import { registerMini } from '../party3d';

export const CORDA = {
  halfX: 12, // campo: x da -12 a 12
  halfZ: 3.4, // … e z da -3,4 a 3,4 (dai lati si cade)
  R: 8, // raggio del giro dello spaghetto
  cy: 8.2, // altezza dell'asse (in basso passa a 0,2 m, ai bordi del campo a ~1 m)
  rope: 0.2, // raggio dello spaghetto (grafica)
  hit: 0.15, // si è presi se i piedi sono sotto lo spaghetto + questo
  w0: (Math.PI * 2) / 2.9, // un giro ogni 2,9 s all'inizio…
  w1: (Math.PI * 2) / 1.35, // … e ogni 1,35 s alla fine
  rampT: 75,
  fallOut: -6,
  until: 160,
};
const TWO_PI = Math.PI * 2;

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

// un pezzo di moto: da t, angolo th, velocità w, accelerazione a
interface Seg {
  t: number;
  th: number;
  w: number;
  a: number;
}
export interface CordaPlan {
  seed: number;
  segs: Seg[];
  revs: number[]; // quando comincia ogni cambio di verso (lo spaghetto rallenta in alto e torna indietro)
  t2: number; // quando arriva il secondo spaghetto
  phi: number; // il secondo spaghetto: θ2 = phi - θ1 (gira al contrario, sfasato)
}

export const cordaSpeed = (t: number) => CORDA.w0 + (CORDA.w1 - CORDA.w0) * Math.min(1, Math.max(0, t) / CORDA.rampT);

function segAngle(s: Seg, t: number) {
  const d = Math.max(0, t - s.t);
  return s.th + s.w * d + 0.5 * s.a * d * d;
}
function addSeg(segs: Seg[], t: number, w: number, a: number) {
  const s = segs[segs.length - 1];
  segs.push({ t, th: segAngle(s, t), w, a });
}

function buildPlan(seed: number): CordaPlan {
  const rnd = seeded(seed);
  // parte da fermo, in alto: arriva in basso (θ = 2π) alla velocità iniziale
  const w0 = CORDA.w0;
  const segs: Seg[] = [{ t: 0, th: Math.PI, w: 0, a: (w0 * w0) / (2 * Math.PI) }];
  let t = (2 * Math.PI) / w0;
  addSeg(segs, t, w0, 0);
  const revs: number[] = [];
  let nextRev = 13 + rnd() * 5;
  // ogni volta che lo spaghetto risale di fianco (orizzontale, lontano dal campo) si decide: più veloce o cambio di verso
  while (t < CORDA.until) {
    const s = segs[segs.length - 1];
    const w = s.w;
    const th = segAngle(s, t);
    // prossimo "fianco in salita": π/2 (+2πk) se gira in avanti, -π/2 (+2πk) se gira indietro
    const base = w > 0 ? Math.PI / 2 : -Math.PI / 2;
    let k = Math.ceil((th - base) / TWO_PI + 1e-9);
    if (w < 0) k = Math.floor((th - base) / TWO_PI - 1e-9);
    const target = base + k * TWO_PI;
    const te = t + (target - th) / w;
    if (te >= nextRev) {
      // cambio di verso: frena salendo, si ferma in cima e torna giù dall'altra parte
      const dur = TWO_PI / Math.abs(w);
      addSeg(segs, te, w, (-w * Math.abs(w)) / Math.PI);
      addSeg(segs, te + dur, -w, 0);
      revs.push(te);
      t = te + dur;
      nextRev = t + 9 + rnd() * 7;
    } else {
      addSeg(segs, te, Math.sign(w) * cordaSpeed(te), 0);
      t = te;
    }
  }
  // il secondo spaghetto: gira al contrario, sfasato; nei cambi di verso resta sempre in alto (phi tra 1,68π e 1,95π)
  const phi = Math.PI * (1.68 + rnd() * 0.27);
  let t2 = 36 + rnd() * 8;
  // compare quando è in cima (lontano dalle teste)
  for (let k = 0; k < 400; k++) {
    const th1 = angleIn(segs, t2);
    if (Math.cos(phi - th1) < -0.97) break;
    t2 += 0.02;
  }
  return { seed, segs, revs, t2: Math.round(t2 * 1000) / 1000, phi };
}

function segIndex(segs: Seg[], t: number) {
  if (t <= segs[0].t) return 0;
  let lo = 0;
  let hi = segs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (segs[mid].t <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}
function angleIn(segs: Seg[], t: number) {
  return segAngle(segs[segIndex(segs, t)], t);
}

const CACHE = new Map<number, CordaPlan>();
export function cordaPlan(seed: number) {
  let p = CACHE.get(seed);
  if (!p) {
    p = buildPlan(seed);
    CACHE.set(seed, p);
    if (CACHE.size > 8) CACHE.delete(CACHE.keys().next().value!);
  }
  return p;
}
let plan = cordaPlan(1);
export const cordaCurrent = () => plan;
export function setCordaSeed(seed: number) {
  if (plan.seed !== seed) plan = cordaPlan(seed);
}

// angolo dello spaghetto n (0 o 1) al tempo t; il secondo c'è solo da t2 in poi
export function cordaAngle(n: number, t: number) {
  const th = t <= 0 ? Math.PI : angleIn(plan.segs, t);
  return n === 0 ? th : plan.phi - th;
}
export const cordaActive = (n: number, t: number) => n === 0 || t >= plan.t2;
// velocità angolare dello spaghetto 0
export function cordaOmega(t: number) {
  if (t <= 0) return 0;
  const s = plan.segs[segIndex(plan.segs, t)];
  return s.w + s.a * Math.max(0, t - s.t);
}
// fra quanto comincia il prossimo cambio di verso (Infinity = mai)
export function cordaNextRev(t: number) {
  for (const r of plan.revs) if (r + TWO_PI / cordaSpeed(r) > t) return Math.max(0, r - t);
  return Infinity;
}
// dove è lo spaghetto: quota e z
export const ropeY = (th: number) => CORDA.cy - CORDA.R * Math.cos(th);
export const ropeZ = (th: number) => CORDA.R * Math.sin(th);
// quota dello spaghetto quando passa sopra z (in basso)
export const ropeLowAt = (z: number) => CORDA.cy - Math.sqrt(CORDA.R * CORDA.R - Math.min(z * z, CORDA.R * CORDA.R * 0.99));
// angolo (nel giro) a cui lo spaghetto passa in basso sopra z
export const ropeCross = (z: number) => Math.asin(Math.max(-0.99, Math.min(0.99, z / CORDA.R)));
// lo spaghetto, andando da a0 ad a1, è passato in basso sopra la posizione con angolo c?
export function crossed(a0: number, a1: number, c: number) {
  return Math.floor((a0 - c) / TWO_PI) !== Math.floor((a1 - c) / TWO_PI);
}
// fra quanto passano gli spaghetti in basso sopra z (in ordine), entro "horizon" secondi; out = lista da riempire
export function cordaPasses(z: number, t: number, horizon: number, out: { tau: number; n: number }[]) {
  out.length = 0;
  const c = ropeCross(z);
  for (let n = 0; n < 2; n++) {
    let prev = cordaAngle(n, t);
    for (let tau = 0.02; tau <= horizon + 1e-6; tau += 0.02) {
      const tt = t + tau;
      if (!cordaActive(n, tt)) {
        prev = cordaAngle(n, tt);
        continue;
      }
      const a = cordaAngle(n, tt);
      if (crossed(prev, a, c)) {
        // un po' più preciso: interpolazione dentro i 20 ms
        const edge = a > prev ? Math.floor((a - c) / TWO_PI) : Math.floor((prev - c) / TWO_PI);
        const f = Math.abs(a - prev) > 1e-9 ? Math.max(0, Math.min(1, (c + edge * TWO_PI - prev) / (a - prev))) : 0;
        out.push({ tau: tau - 0.02 + 0.02 * f, n });
      }
      prev = a;
    }
  }
  out.sort((p, q) => p.tau - q.tau);
  return out;
}

registerMini({
  kind: 'CORDA',
  name: 'Salta la corda',
  tag: 'Salta al momento giusto',
  rules:
    'Due cuochi giganti fanno girare uno spaghetto al dente: salta quando passa in basso (guarda l’ombra e il cerchio che si stringe)! Gira sempre più veloce, ogni tanto cambia verso e poi arriva il secondo spaghetto. Chi viene preso vola via. Ai bordi passa più alto: al centro è più facile, ma c’è la ressa. Qui lo scatto non c’è: salta (anche doppio)!',
  seconds: 90,
  noDash: true,
  fallOut: CORDA.fallOut,
  ground: (x, z) => (x >= -CORDA.halfX - 0.4 && x <= CORDA.halfX + 0.4 && z >= -CORDA.halfZ && z <= CORDA.halfZ ? 0 : null),
  clamp: (p) => {
    if ((p.y ?? 0) < -1) return;
    const lim = CORDA.halfX - 0.55;
    if (p.x > lim) p.x = lim;
    else if (p.x < -lim) p.x = -lim;
  },
  sync: (ext) => {
    if (ext && typeof ext.seed === 'number') setCordaSeed(ext.seed);
  },
});
