// 🧅 Anelli di cipolla: parco giochi con i trampolini (pancake e tortelloni), anelli fritti giganti da attraversare (regole fisiche)
import { PHYS, registerMini } from '../party3d';

export const ANELLI = {
  r: 21, // raggio del parco (c'è lo steccato di grissini)
  ringR: 1.55, // raggio dell'anello (al centro del "tubo")
  tube: 0.34,
  pass: 1.4, // il centro del corpo deve passare entro questa distanza dal centro dell'anello (server)
  passLocal: 1.2, // (sul telefono, per l'effetto immediato: un po' più severo)
  respawn: 4000, // l'anello preso ricompare altrove dopo questo tempo
  warn: 1000, // e un secondo prima si vede dove
  spin: 0.35, // gli anelli in piedi girano piano su se stessi (rad/s)
  body: 1.0, // il centro del corpo è a questa altezza dai piedi
};

// trampolini: pancake (piccoli) e il tortellone gigante in mezzo
export interface Pad {
  x: number;
  z: number;
  r: number;
  h: number; // quota del piano (ci si sale anche camminando)
  v: number; // velocità verso l'alto del lancio
  big: boolean;
}
export const PADS: Pad[] = [{ x: 0, z: 0, r: 2.4, h: 0.55, v: 19, big: true }];
for (let k = 0; k < 6; k++) {
  const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
  PADS.push({ x: Math.sin(a) * 10, z: Math.cos(a) * 10, r: 1.7, h: 0.5, v: 16, big: false });
}
for (let k = 0; k < 4; k++) {
  const a = (k / 4) * Math.PI * 2;
  PADS.push({ x: Math.sin(a) * 16.5, z: Math.cos(a) * 16.5, r: 1.5, h: 0.45, v: 15, big: false });
}

// posti dove può comparire un anello: sdraiato sopra un trampolino (si passa saltando su), in piedi tra due
// trampolini (si passa volando di lato) o in piedi basso sul prato (si passa con un salto)
export interface Spot {
  x: number;
  y: number; // quota del centro dell'anello
  z: number;
  flat: boolean; // sdraiato (si attraversa in verticale)
  pad: number; // trampolino da cui ci si arriva (-1 = da terra)
  ph: number; // in piedi: verso iniziale della faccia
  gold: boolean;
}
export const SPOTS: Spot[] = [];
{
  const flat = (pad: number, y: number, gold = false) => SPOTS.push({ x: PADS[pad].x, y, z: PADS[pad].z, flat: true, pad, ph: 0, gold });
  flat(0, 4.4);
  flat(0, 6.2);
  flat(0, 8.0, true);
  for (let k = 1; k <= 6; k++) {
    flat(k, 3.9);
    flat(k, 5.1);
  }
  for (let k = 7; k <= 10; k++) flat(k, 3.7);
  for (let k = 0; k < 6; k++) {
    const pad = 1 + k;
    const P = PADS[pad];
    // tra il pancake e il tortellone (si vola verso il centro)
    const a = Math.atan2(P.x, P.z);
    SPOTS.push({ x: Math.sin(a) * 6.8, y: 5.0, z: Math.cos(a) * 6.8, flat: false, pad, ph: a, gold: false });
    // in alto tra due pancake vicini (d'oro)
    const Q = PADS[1 + ((k + 1) % 6)];
    const mx = (P.x + Q.x) / 2;
    const mz = (P.z + Q.z) / 2;
    SPOTS.push({ x: mx, y: 6.0, z: mz, flat: false, pad, ph: Math.atan2(Q.x - P.x, Q.z - P.z), gold: true });
    // basso sul prato, fuori dal giro dei pancake
    const b = a + Math.PI / 6;
    SPOTS.push({ x: Math.sin(b) * 13.6, y: 2.7, z: Math.cos(b) * 13.6, flat: false, pad: -1, ph: b + Math.PI / 2, gold: false });
  }
}

// verso della faccia di un anello in piedi all'istante t (normale orizzontale)
export const ringFace = (ph: number, t: number) => ph + ANELLI.spin * t;

// su che trampolino sono? (-1 = nessuno)
export function padAt(x: number, z: number, y?: number): number {
  for (let i = 0; i < PADS.length; i++) {
    const p = PADS[i];
    const dx = x - p.x;
    const dz = z - p.z;
    if (dx * dx + dz * dz <= p.r * p.r && (y === undefined || y >= p.h - 0.6)) return i;
  }
  return -1;
}

// il centro del corpo è passato dentro l'anello tra a e b? (spot s, faccia all'istante t)
export function throughRing(s: Spot, t: number, ax: number, ay: number, az: number, bx: number, by: number, bz: number, radius: number): boolean {
  let d0: number;
  let d1: number;
  if (s.flat) {
    d0 = ay - s.y;
    d1 = by - s.y;
  } else {
    const f = ringFace(s.ph, t);
    const nx = Math.sin(f);
    const nz = Math.cos(f);
    d0 = (ax - s.x) * nx + (az - s.z) * nz;
    d1 = (bx - s.x) * nx + (bz - s.z) * nz;
  }
  if ((d0 < 0) === (d1 < 0) || d0 === d1) return false;
  const k = d0 / (d0 - d1);
  const px = ax + (bx - ax) * k - s.x;
  const py = ay + (by - ay) * k - s.y;
  const pz = az + (bz - az) * k - s.z;
  return px * px + py * py + pz * pz <= radius * radius;
}

registerMini({
  kind: 'ANELLI',
  name: 'Anelli di cipolla',
  tag: 'Vola negli anelli',
  rules:
    'Salta sui pancake e sul tortellone gigante per volare in alto e passa DENTRO gli anelli di cipolla fritti: 1 punto, quelli d’oro 3. Chi ci passa per primo lo prende, poi ricompare altrove. Gli schiaffi sui trampolini sono permessi!',
  seconds: 60,
  ground: (x, z, _t, y) => {
    const i = padAt(x, z, y);
    return i >= 0 ? PADS[i].h : 0;
  },
  clamp: (p) => {
    // lo steccato di grissini
    const R = ANELLI.r - PHYS.radius;
    const d2 = p.x * p.x + p.z * p.z;
    if (d2 > R * R) {
      const d = Math.sqrt(d2);
      p.x *= R / d;
      p.z *= R / d;
    }
  },
});
