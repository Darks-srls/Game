// 🥖 Il mattarello: un mattarello gigante a 6 tronconi che girano ognuno per conto suo, con i buchi nella sfoglia.
// Regole fisiche uguali per telefono e server: i giri e i buchi si calcolano dal tempo di gioco e dal "seme" scelto dal server
// (arriva con la view e passa da sync), così telefono e server vedono il rullo nello stesso punto.
import { registerMini } from '../party3d';

export const MAT = {
  R: 4, // raggio del mattarello (la cima è a quota 0, l'asse a -R)
  n: 6, // tronconi
  len: 6, // lunghezza di un troncone (lungo x)
  half: 18, // metà lunghezza del mattarello
  slip: 0.85, // oltre 0,85 R dalla cima si scivola giù
  slide: 2.4, // scivolata verso il bordo (m/s, quando si è sul bordo)
  w0: 0.5, // velocità angolare all'inizio (rad/s): in cima la sfoglia corre a 2 m/s
  w1: 1.25, // … e alla fine (5 m/s)
  rampT: 80, // secondi per arrivare alla velocità massima
  step: 2, // ogni quanti secondi si aggiorna la velocità
  revOff: 0.4, // i cambi di verso partono 0,4 s dopo un aggiornamento di velocità
  revT: 1.2, // durata del cambio di verso
  warn: 2.6, // il cambio di verso si vede arrivare (secondi prima)
  holes: 8, // buchi per troncone (si aprono un po' alla volta)
  fallOut: -6,
  until: 150, // il programma dei giri si calcola fino a qui
};
const R2 = MAT.R * MAT.R;
const TWO_PI = Math.PI * 2;

// generatore pseudo-casuale con seme (mulberry32): uguale sul telefono e sul server
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// un pezzo di moto: da t, angolo th, velocità w, accelerazione a (rad/s²)
export interface MatSeg {
  t: number;
  th: number;
  w: number;
  a: number;
}
// un buco nella sfoglia: angolo nel troncone (dalla cima verso +z, a giro 0), x dal centro del troncone, raggio, quando si apre
export interface MatHole {
  a: number;
  x: number;
  r: number;
  open: number;
  star: boolean;
}
export interface MatPlan {
  seed: number;
  segs: MatSeg[][];
  holes: MatHole[][];
  revs: { i: number; t: number }[]; // cambi di verso (in ordine di tempo)
}

// mescola 0..n-1 (Fisher-Yates: niente sort con confronti a caso, che cambia da un motore all'altro)
export function shuffled(n: number, rnd: () => number) {
  const a = Array.from({ length: n }, (_, k) => k);
  for (let k = n - 1; k > 0; k--) {
    const j = Math.floor(rnd() * (k + 1));
    [a[k], a[j]] = [a[j], a[k]];
  }
  return a;
}

export const matSpeed = (t: number) => MAT.w0 + (MAT.w1 - MAT.w0) * Math.min(1, Math.max(0, t) / MAT.rampT);

function addSeg(segs: MatSeg[], t: number, w: number, a: number) {
  const s = segs[segs.length - 1];
  const d = t - s.t;
  segs.push({ t, th: s.th + s.w * d + 0.5 * s.a * d * d, w, a });
}

// tutto il programma della partita dal seme: versi, cambi di verso, buchi
function buildPlan(seed: number): MatPlan {
  const rnd = seeded(seed);
  const n = MAT.n;
  // versi di partenza: almeno due per parte
  let dir0: number[] = [];
  for (let tries = 0; tries < 20; tries++) {
    dir0 = Array.from({ length: n }, () => (rnd() < 0.5 ? 1 : -1));
    const pos = dir0.filter((d) => d > 0).length;
    if (pos >= 2 && pos <= n - 2) break;
  }
  // cambi di verso: uno alla volta, sempre più spesso (più avanti anche due insieme)
  const revs: { i: number; t: number }[] = [];
  let at = 9 + rnd() * 3;
  let last = -1;
  while (at < MAT.until - 4) {
    const k = Math.max(1, Math.round((at - MAT.revOff) / MAT.step));
    const tr = k * MAT.step + MAT.revOff;
    let i = Math.floor(rnd() * n);
    if (i === last) i = (i + 1 + Math.floor(rnd() * (n - 1))) % n;
    revs.push({ i, t: tr });
    last = i;
    if (tr > 40 && rnd() < 0.3) revs.push({ i: (i + 2 + Math.floor(rnd() * 3)) % n, t: tr });
    at = tr + Math.max(3.4, 7.5 - tr * 0.05) + rnd() * 2.5;
  }
  const segs: MatSeg[][] = [];
  for (let i = 0; i < n; i++) {
    let dir = dir0[i];
    // partenza da fermo: in 2 secondi arriva alla sua velocità
    const list: MatSeg[] = [{ t: 0, th: rnd() * TWO_PI, w: 0, a: (dir * matSpeed(MAT.step)) / MAT.step }];
    const mine = new Set(revs.filter((r) => r.i === i).map((r) => Math.round((r.t - MAT.revOff) / MAT.step)));
    for (let k = 1; k * MAT.step <= MAT.until; k++) {
      const ts = k * MAT.step;
      const W = matSpeed(ts);
      addSeg(list, ts, dir * W, 0);
      if (mine.has(k)) {
        // frena, si ferma e riparte nell'altro verso
        addSeg(list, ts + MAT.revOff, dir * W, (-2 * dir * W) / MAT.revT);
        dir = -dir;
        addSeg(list, ts + MAT.revOff + MAT.revT, dir * W, 0);
      }
    }
    segs.push(list);
  }
  // buchi: sparsi intorno al troncone, senza toccarsi; si aprono pochi alla volta
  const holes: MatHole[][] = [];
  const openAt = [4, 6.5, 15, 24, 33, 42, 51, 60];
  for (let i = 0; i < n; i++) {
    const list: MatHole[] = [];
    const order = shuffled(MAT.holes, rnd);
    for (let k = 0; k < MAT.holes; k++) {
      const r = 1 + rnd() * 0.3;
      let best: MatHole | null = null;
      for (let tries = 0; tries < 30; tries++) {
        const h: MatHole = {
          a: ((k + 0.5) / MAT.holes) * TWO_PI + (rnd() - 0.5) * 0.5,
          x: (rnd() * 2 - 1) * (MAT.len / 2 - r - 0.2),
          r,
          open: openAt[order[k]] + rnd() * 4,
          star: rnd() < 0.55,
        };
        // (distanze al quadrato: niente funzioni che possono differire di un soffio tra i browser)
        const ok = list.every((o) => {
          let d = Math.abs(h.a - o.a) % TWO_PI;
          if (d > Math.PI) d = TWO_PI - d;
          const min = h.r + o.r + 0.7;
          return (d * MAT.R) ** 2 + (h.x - o.x) ** 2 > min * min;
        });
        best = h;
        if (ok) break;
      }
      list.push(best!);
    }
    holes.push(list);
  }
  return { seed, segs, holes, revs };
}

// pochi programmi in memoria (il server tiene più stanze)
const CACHE = new Map<number, MatPlan>();
export function matPlan(seed: number): MatPlan {
  let p = CACHE.get(seed);
  if (!p) {
    p = buildPlan(seed);
    CACHE.set(seed, p);
    if (CACHE.size > 8) CACHE.delete(CACHE.keys().next().value!);
  }
  return p;
}

let plan: MatPlan = matPlan(1);
export const matCurrent = () => plan;
export function setMatSeed(seed: number) {
  if (plan.seed !== seed) plan = matPlan(seed);
}

function segOf(list: MatSeg[], t: number): MatSeg {
  if (t <= list[0].t) return list[0];
  let lo = 0;
  let hi = list.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (list[mid].t <= t) lo = mid;
    else hi = mid - 1;
  }
  return list[lo];
}
// di quanto è girato il troncone i al tempo t (radianti: positivo = la cima va verso +z)
export function matAngle(i: number, t: number): number {
  const s = segOf(plan.segs[i], t);
  const d = Math.max(0, t - s.t);
  return s.th + s.w * d + 0.5 * s.a * d * d;
}
// velocità angolare del troncone i
export function matOmega(i: number, t: number): number {
  if (t <= 0) return 0;
  const s = segOf(plan.segs[i], t);
  return s.w + s.a * Math.max(0, t - s.t);
}
// fra quanti secondi il troncone i cambia verso (Infinity = mai più)
export function matNextRev(i: number, t: number): number {
  for (const r of plan.revs) if (r.i === i && r.t + MAT.revT > t) return Math.max(0, r.t - t);
  return Infinity;
}

export const matIndex = (x: number) => {
  const i = Math.floor((x + MAT.half) / MAT.len);
  return i < 0 ? 0 : i >= MAT.n ? MAT.n - 1 : i;
};
export const matCenterX = (i: number) => -MAT.half + MAT.len * (i + 0.5);
// quota della superficie (senza buchi)
export const matSurface = (z: number) => Math.sqrt(Math.max(0, R2 - z * z)) - MAT.R;

// sopra un buco aperto? (indice del buco, -1 = no)
export function matHoleAt(x: number, z: number, t: number): number {
  const zr = z / MAT.R;
  if (zr >= 1 || zr <= -1 || x < -MAT.half || x > MAT.half) return -1;
  const i = matIndex(x);
  const al = Math.asin(zr) - matAngle(i, t);
  const lx = x - matCenterX(i);
  const hs = plan.holes[i];
  for (let k = 0; k < hs.length; k++) {
    const h = hs[k];
    if (t < h.open) continue;
    const dx = lx - h.x;
    if (dx > h.r || dx < -h.r) continue;
    let d = (al - h.a) % TWO_PI;
    if (d > Math.PI) d -= TWO_PI;
    else if (d < -Math.PI) d += TWO_PI;
    const ds = d * MAT.R;
    if (ds * ds + dx * dx < h.r * h.r) return k;
  }
  return -1;
}

const GV = { x: 0, z: 0 };

registerMini({
  kind: 'MATTARELLO',
  name: 'Il mattarello',
  tag: 'Corri contro il rullo',
  rules:
    'Siete sopra un mattarello gigante che gira: corri controcorrente per restare in cima, sennò scivoli giù nel sugo. Ogni pezzo gira per conto suo (e ogni tanto cambia verso!) e nella sfoglia si aprono buchi a stella: scansali o saltali. Vince l’ultimo in piedi.',
  seconds: 90,
  fallOut: MAT.fallOut,
  ground: (x, z, t) => {
    if (x < -MAT.half || x > MAT.half) return null;
    const zr = z / MAT.R;
    if (zr > MAT.slip || zr < -MAT.slip) return null;
    if (t > 0 && matHoleAt(x, z, t) >= 0) return null;
    return Math.sqrt(R2 - z * z) - MAT.R;
  },
  // la sfoglia trascina (parte orizzontale della velocità della superficie) e sul fianco si scivola verso il bordo
  groundVel: (x, z, t) => {
    GV.x = 0;
    GV.z = 0;
    if (x < -MAT.half || x > MAT.half || z >= MAT.R || z <= -MAT.R) return GV;
    GV.z = matOmega(matIndex(x), t) * Math.sqrt(R2 - z * z) + (MAT.slide * z) / MAT.R;
    return GV;
  },
  clamp: (p) => {
    const y = p.y ?? 0;
    const r = 0.55;
    // le testate: dalle punte non si esce (finché si è sopra)
    if (y > -1.5) {
      if (p.x > MAT.half - r) p.x = MAT.half - r;
      else if (p.x < -MAT.half + r) p.x = -MAT.half + r;
    }
    // chi scivola giù dal fianco cade fuori dal mattarello (non ci passa dentro)
    const az = Math.abs(p.z);
    if (az > MAT.slip * MAT.R - 0.15 && az < MAT.R + 0.6 && y < matSurface(Math.min(az, MAT.R)) - 0.25) {
      const dy = y + 0.6 + MAT.R;
      const need = MAT.R + 0.55;
      if (dy * dy < need * need) {
        const zz = Math.sqrt(need * need - dy * dy);
        if (az < zz) p.z = p.z < 0 ? -zz : zz;
      }
    }
  },
  sync: (ext) => {
    if (ext && typeof ext.seed === 'number') setMatSeed(ext.seed);
  },
});
