// ⚽🚗 Axend Turbo — la forma dello stadio costruita ESATTAMENTE come il campo di distanza di arena.ts:
// pavimento, raccordi curvi (256) tra pavimento/soffitto e muri, raccordi verticali (200) tra lati e angoli a 45°,
// bocche delle porte e porte (scatole con raccordi da 40). Tutto in uu (geometria pura, si prova anche con node).
import * as THREE from 'three';
import { arenaDist } from '../../../game/turbo/arena';
import { ARENA } from '../../../game/turbo/consts';
import { S } from './coords';

const R = ARENA.wallFillet; // 256
const RE = ARENA.edgeFillet; // 200
const H = ARENA.height;
const EX = ARENA.extentX;
const EY = ARENA.extentY;
const CS = ARENA.cornerSum;
const SQ2 = Math.SQRT2;
export const GW = ARENA.goalHalfW; // mezza larghezza della porta
export const GH = ARENA.goalHeight;
export const GR = 40; // raccordo della scatola della porta
export const GY1 = EY + ARENA.goalDepth; // fondo della porta (6000)
export const OPAQUE_TOP = 700; // fin qui il muro è opaco, sopra c'è il vetro
export const FLOOR_Y = EY - R; // dove finisce il pavimento piatto (4864)
export const FLOOR_X = EX - R; // (3840)
export const FLOOR_CORNER = CS - SQ2 * R; // |x| + |y| del pavimento piatto (7701,96)

// ---------------------------------------------------------------- campo di distanza "principale" (senza porte), come arena.ts
function vEdge(side: number, corner: number) {
  if (side >= RE || corner >= RE) return Math.min(side, corner);
  return RE - Math.hypot(RE - side, RE - corner);
}
export function wall2D(x: number, y: number) {
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  const dSide = EX - ax;
  const dBack = EY - ay;
  const dCorner = (CS - ax - ay) / SQ2;
  return Math.min(vEdge(dSide, dCorner), vEdge(dBack, dCorner));
}
export function mainDist(x: number, y: number, z: number) {
  const w = wall2D(x, y);
  const a = z;
  const b = H - z;
  const m = Math.min(a, b, w);
  if (m >= R) return m;
  let s = 0;
  if (a < R) s += (R - a) * (R - a);
  if (b < R) s += (R - b) * (R - b);
  if (w < R) s += (R - w) * (R - w);
  return R - Math.sqrt(s);
}
// normale verso l'interno del campo (gradiente del campo principale)
function mainNormal(x: number, y: number, z: number, out: number[]) {
  const h = 0.5;
  let nx = mainDist(x + h, y, z) - mainDist(x - h, y, z);
  let ny = mainDist(x, y + h, z) - mainDist(x, y - h, z);
  let nz = mainDist(x, y, z + h) - mainDist(x, y, z - h);
  const l = Math.hypot(nx, ny, nz) || 1;
  nx /= l;
  ny /= l;
  nz /= l;
  out[0] = nx;
  out[1] = ny;
  out[2] = nz;
  return out;
}

// normale del campo completo (porte comprese)
function surfNormal(x: number, y: number, z: number, out: number[]) {
  const h = 0.5;
  const nx = arenaDist(x + h, y, z) - arenaDist(x - h, y, z);
  const ny = arenaDist(x, y + h, z) - arenaDist(x, y - h, z);
  const nz = arenaDist(x, y, z + h) - arenaDist(x, y, z - h);
  const l = Math.hypot(nx, ny, nz) || 1;
  out[0] = nx / l;
  out[1] = ny / l;
  out[2] = nz / l;
  return out;
}

// ---------------------------------------------------------------- costruttore di geometrie (in uu)
export type ColorFn = (x: number, y: number, z: number, out: number[]) => void; // colore (rgb o rgba) dal punto in uu

export class Geo {
  pos: number[] = [];
  nor: number[] = [];
  uv: number[] = [];
  idx: number[] = [];
  vert(x: number, y: number, z: number, nx: number, ny: number, nz: number, u = 0, v = 0) {
    this.pos.push(x, y, z);
    this.nor.push(nx, ny, nz);
    this.uv.push(u, v);
    return this.pos.length / 3 - 1;
  }
  // triangolo girato in modo che la faccia guardi come le normali dei vertici (niente errori di verso)
  tri(a: number, b: number, c: number) {
    const p = this.pos;
    const ux = p[b * 3] - p[a * 3];
    const uy = p[b * 3 + 1] - p[a * 3 + 1];
    const uz = p[b * 3 + 2] - p[a * 3 + 2];
    const vx = p[c * 3] - p[a * 3];
    const vy = p[c * 3 + 1] - p[a * 3 + 1];
    const vz = p[c * 3 + 2] - p[a * 3 + 2];
    const fx = uy * vz - uz * vy;
    const fy = uz * vx - ux * vz;
    const fz = ux * vy - uy * vx;
    if (fx * fx + fy * fy + fz * fz < 1e-8) return; // degenere
    const n = this.nor;
    const sx = n[a * 3] + n[b * 3] + n[c * 3];
    const sy = n[a * 3 + 1] + n[b * 3 + 1] + n[c * 3 + 1];
    const sz = n[a * 3 + 2] + n[b * 3 + 2] + n[c * 3 + 2];
    if (fx * sx + fy * sy + fz * sz >= 0) this.idx.push(a, b, c);
    else this.idx.push(a, c, b);
  }
  quad(a: number, b: number, c: number, d: number) {
    // a-b-c-d in giro
    this.tri(a, b, c);
    this.tri(a, c, d);
  }
  // in metri e con gli assi di three; colori opzionali calcolati dal punto
  toGeometry(color?: ColorFn, colorSize = 3) {
    const n = this.pos.length / 3;
    const pos = new Float32Array(n * 3);
    const nor = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const x = this.pos[i * 3];
      const y = this.pos[i * 3 + 1];
      const z = this.pos[i * 3 + 2];
      pos[i * 3] = x * S;
      pos[i * 3 + 1] = z * S;
      pos[i * 3 + 2] = -y * S;
      nor[i * 3] = this.nor[i * 3];
      nor[i * 3 + 1] = this.nor[i * 3 + 2];
      nor[i * 3 + 2] = -this.nor[i * 3 + 1];
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(this.uv), 2));
    if (color) {
      const col = new Float32Array(n * colorSize);
      const c = [1, 1, 1, 1];
      for (let i = 0; i < n; i++) {
        color(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2], c);
        for (let k = 0; k < colorSize; k++) col[i * colorSize + k] = c[k];
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, colorSize));
    }
    g.setIndex(n > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    return g;
  }
}

// ---------------------------------------------------------------- profilo del muro (righe) e contorno di un quarto di campo

export interface Row {
  z: number; // quota
  w: number; // distanza "2D" dai muri verticali (0 = sul muro)
  s: number; // lunghezza lungo il profilo dal pavimento (per le texture)
}
const K_FILLET = 10;
const S_VERT0 = (R * Math.PI) / 2; // fine del raccordo basso
export const S_OPAQUE = S_VERT0 + (OPAQUE_TOP - R); // profilo del muro opaco
const S_CEIL0 = S_VERT0 + (H - 2 * R);

export function floorFilletRows(): Row[] {
  const out: Row[] = [];
  for (let k = 0; k <= K_FILLET; k++) {
    const p = (k / K_FILLET) * (Math.PI / 2);
    out.push({ z: R * (1 - Math.cos(p)), w: R * (1 - Math.sin(p)), s: R * p });
  }
  return out;
}
const vRow = (z: number): Row => ({ z, w: 0, s: S_VERT0 + (z - R) });
export function ceilFilletRows(): Row[] {
  const out: Row[] = [];
  for (let k = 0; k <= K_FILLET; k++) {
    const p = (Math.PI / 2) * (1 - k / K_FILLET);
    out.push({ z: H - R * (1 - Math.cos(p)), w: R * (1 - Math.sin(p)), s: S_CEIL0 + R * (Math.PI / 2 - p) });
  }
  return out;
}
// lo z del raccordo basso del muro di fondo a distanza w dal muro (per le facce laterali della bocca)
export const rampZ = (w: number) => R - Math.sqrt(Math.max(0, R * R - (R - w) * (R - w)));

const NS = 12; // lato lungo
const NF = 8; // raccordo verticale
const NC = 4; // angolo a 45°
const NBO = 5; // fondo, dal raccordo alla porta
const NBI = 3; // fondo, sopra la porta (fino a x = 0)

// contorno (x ≥ 0, y ≥ 0) del livello w: dal centro del lato lungo (y = 0) al fondo (fino a x = GW, o fino a 0 con inner)
export function quadContour(w: number, inner: boolean): number[] {
  const out: number[] = [];
  const sharp = w >= RE;
  const k = RE - w;
  const sideFil = (phi: number) => {
    const a = sharp ? w : RE - k * Math.cos(phi);
    const b = sharp ? w : RE - k * Math.sin(phi);
    const x = EX - a;
    return [x, CS - x - SQ2 * b];
  };
  const backFil = (phi: number) => {
    const A = sharp ? w : RE - k * Math.sin(phi);
    const B = sharp ? w : RE - k * Math.cos(phi);
    const y = EY - A;
    return [CS - y - SQ2 * B, y];
  };
  const [x0, yS] = sideFil(0);
  for (let i = 0; i < NS; i++) out.push(x0, (yS * i) / NS);
  for (let i = 0; i < NF; i++) out.push(...sideFil(((i / NF) * Math.PI) / 2));
  const [cx0, cy0] = sideFil(Math.PI / 2);
  const [cx1, cy1] = backFil(0);
  for (let i = 0; i < NC; i++) out.push(cx0 + ((cx1 - cx0) * i) / NC, cy0 + ((cy1 - cy0) * i) / NC);
  for (let i = 0; i < NF; i++) out.push(...backFil(((i / NF) * Math.PI) / 2));
  const [bx, by] = backFil(Math.PI / 2);
  for (let i = 0; i < NBO; i++) out.push(bx + ((GW - bx) * i) / NBO, by);
  out.push(GW, by);
  if (inner) for (let i = 1; i <= NBI; i++) out.push(GW - (GW * i) / NBI, by);
  return out;
}

// lunghezza d'arco del contorno sul muro (w = 0) per ogni colonna: serve alle texture che girano tutto intorno
const ARC = (() => {
  const c = quadContour(0, true);
  const s = [0];
  for (let i = 1; i < c.length / 2; i++) s.push(s[i - 1] + Math.hypot(c[i * 2] - c[i * 2 - 2], c[i * 2 + 1] - c[i * 2 - 1]));
  return s;
})();
export const QUARTER_LEN = ARC[ARC.length - 1]; // un quarto del giro del campo (uu)
export const LOOP_LEN = QUARTER_LEN * 4;
// coordinata U che gira intorno al campo e cresce verso destra per chi guarda il muro dall'interno
function loopU(sx: number, sy: number, s: number) {
  if (sx > 0 && sy < 0) return s;
  if (sx < 0 && sy < 0) return 2 * QUARTER_LEN - s;
  if (sx < 0 && sy > 0) return 2 * QUARTER_LEN + s;
  return 4 * QUARTER_LEN - s;
}
const QUADS: [number, number][] = [
  [1, 1],
  [-1, 1],
  [-1, -1],
  [1, -1],
];

// striscia di muro: righe del profilo × contorno, nei quattro quarti. uv = (U in uu, s in uu): chi la usa la scala
function wallStrip(g: Geo, rows: Row[], inner: boolean) {
  const nrm = [0, 0, 0];
  const contours = rows.map((r) => quadContour(r.w, inner));
  const cols = contours[0].length / 2;
  for (const [sx, sy] of QUADS) {
    const base: number[][] = [];
    rows.forEach((r, ri) => {
      const c = contours[ri];
      const line: number[] = [];
      for (let i = 0; i < cols; i++) {
        const x = c[i * 2] * sx;
        const y = c[i * 2 + 1] * sy;
        mainNormal(x, y, r.z, nrm);
        line.push(g.vert(x, y, r.z, nrm[0], nrm[1], nrm[2], loopU(sx, sy, ARC[i]), r.s));
      }
      base.push(line);
    });
    for (let ri = 0; ri < rows.length - 1; ri++)
      for (let i = 0; i < cols - 1; i++) g.quad(base[ri][i], base[ri][i + 1], base[ri + 1][i + 1], base[ri + 1][i]);
  }
}

// muro opaco: raccordo basso + muro fino a OPAQUE_TOP (con le bocche delle porte), più le facce laterali delle bocche
export function buildWallLow() {
  const g = new Geo();
  wallStrip(g, [...floorFilletRows(), vRow(GH)], false);
  wallStrip(g, [vRow(GH), vRow(OPAQUE_TOP)], true);
  const fr = floorFilletRows();
  const nrm = [0, 0, 0];
  for (const sy of [1, -1])
    for (const sx of [1, -1]) {
      // fianco della rampa che si interrompe sulla bocca della porta (piano x = ±GW), sopra il raccordo da 40 della porta
      const nx = -sx;
      const top: number[] = [];
      const bot: number[] = [];
      for (const r of fr) {
        const y = (EY - r.w) * sy;
        top.push(g.vert(GW * sx, y, r.z, nx, 0, 0, 0, r.s));
        bot.push(g.vert(GW * sx, y, Math.min(GR, r.z), nx, 0, 0, 0, Math.min(GR, r.z)));
      }
      for (let i = 0; i < fr.length - 1; i++) g.quad(bot[i], bot[i + 1], top[i + 1], top[i]);
      // ai piedi del palo: il campo è aperto sopra la rampa O sopra il raccordo della porta → quota = min(rampa, raccordo)
      const KT = 6;
      const grid: number[][] = [];
      for (const r of fr) {
        const y = (EY - r.w) * sy;
        const line: number[] = [];
        for (let k = 0; k <= KT; k++) {
          const th = -Math.PI / 2 + ((k / KT) * Math.PI) / 2;
          const x = (GW - GR + GR * Math.cos(th)) * sx;
          const z = Math.min(GR + GR * Math.sin(th), r.z);
          surfNormal(x, y, z, nrm);
          line.push(g.vert(x, y, z, nrm[0], nrm[1], nrm[2], 0, z));
        }
        grid.push(line);
      }
      for (let i = 0; i < fr.length - 1; i++) for (let k = 0; k < KT; k++) g.quad(grid[i][k], grid[i][k + 1], grid[i + 1][k + 1], grid[i + 1][k]);
      // angolo in alto della bocca (raccordo da 40 tra palo e traversa): il muro riempie fuori dall'arco
      const ny = -sy;
      const tc = g.vert(GW * sx, EY * sy, GH, 0, ny, 0, 0, S_VERT0 + GH - R);
      let prev = -1;
      for (let k = 0; k <= 6; k++) {
        const th = ((k / 6) * Math.PI) / 2;
        const z = GH - GR + GR * Math.sin(th);
        const v = g.vert((GW - GR + GR * Math.cos(th)) * sx, EY * sy, z, 0, ny, 0, 0, S_VERT0 + z - R);
        if (prev >= 0) g.tri(tc, prev, v);
        prev = v;
      }
    }
  return g;
}

// vetro: muro alto, raccordo del soffitto e soffitto
export function buildGlass() {
  const g = new Geo();
  wallStrip(g, [vRow(OPAQUE_TOP), ...ceilFilletRows()], true);
  floorGrid(g, H, -1, 8);
  return g;
}

// ---------------------------------------------------------------- pavimento
function floorHalfW(y: number) {
  return Math.min(FLOOR_X, FLOOR_CORNER - Math.abs(y));
}
// griglia dell'ottagono piatto (uv = x, y in uu)
function floorGrid(g: Geo, z: number, nz: number, nx: number) {
  const kink = FLOOR_CORNER - FLOOR_X;
  const ys = new Set<number>([-FLOOR_Y, -kink, 0, kink, FLOOR_Y]);
  const step = 640;
  for (let y = -FLOOR_Y; y < FLOOR_Y; y += step) ys.add(y);
  const list = [...ys].sort((a, b) => a - b);
  const rows: number[][] = [];
  for (const y of list) {
    const hw = floorHalfW(y);
    const line: number[] = [];
    for (let i = 0; i <= nx; i++) {
      const x = -hw + (2 * hw * i) / nx;
      line.push(g.vert(x, y, z, 0, 0, nz, x, y));
    }
    rows.push(line);
  }
  for (let r = 0; r < rows.length - 1; r++) for (let i = 0; i < nx; i++) g.quad(rows[r][i], rows[r][i + 1], rows[r + 1][i + 1], rows[r + 1][i]);
}
function rectGrid(g: Geo, x0: number, x1: number, y0: number, y1: number, nx: number, ny: number) {
  const rows: number[][] = [];
  for (let j = 0; j <= ny; j++) {
    const y = y0 + ((y1 - y0) * j) / ny;
    const line: number[] = [];
    for (let i = 0; i <= nx; i++) {
      const x = x0 + ((x1 - x0) * i) / nx;
      line.push(g.vert(x, y, 0, 0, 0, 1, x, y));
    }
    rows.push(line);
  }
  for (let r = 0; r < ny; r++) for (let i = 0; i < nx; i++) g.quad(rows[r][i], rows[r][i + 1], rows[r + 1][i + 1], rows[r + 1][i]);
}
// pavimento: campo + bocche delle porte + pavimento dentro le porte
export function buildFloor() {
  const g = new Geo();
  floorGrid(g, 0, 1, 24);
  for (const sy of [1, -1]) {
    const a = FLOOR_Y * sy;
    const b = EY * sy;
    rectGrid(g, -(GW - GR), GW - GR, Math.min(a, b), Math.max(a, b), 6, 1);
    const c = (GY1 - GR) * sy;
    rectGrid(g, -(GW - GR), GW - GR, Math.min(b, c), Math.max(b, c), 6, 3);
  }
  return g;
}

// ---------------------------------------------------------------- porte (scatola con raccordi da 40)
interface PP {
  x: number;
  z: number;
  cx: number;
  cz: number;
  floor: boolean;
}
// profilo della porta (sezione x-z) in giro: raccordi, pali, traversa, e il pavimento
function goalProfile(): PP[] {
  const out: PP[] = [];
  const xi = GW - GR;
  const zl = GR;
  const zh = GH - GR;
  const arc = (cx: number, cz: number, a0: number, a1: number, n: number) => {
    for (let k = 0; k <= n; k++) {
      const a = a0 + ((a1 - a0) * k) / n;
      out.push({ x: cx + GR * Math.cos(a), z: cz + GR * Math.sin(a), cx, cz, floor: false });
    }
  };
  arc(xi, zl, -Math.PI / 2, 0, 5); // in basso a destra
  out.push({ x: GW, z: (zl + zh) / 2, cx: xi, cz: (zl + zh) / 2, floor: false });
  arc(xi, zh, 0, Math.PI / 2, 5); // in alto a destra
  for (let k = 1; k < 6; k++) {
    const x = xi - (2 * xi * k) / 6;
    out.push({ x, z: GH, cx: x, cz: zh, floor: false });
  }
  arc(-xi, zh, Math.PI / 2, Math.PI, 5);
  out.push({ x: -GW, z: (zl + zh) / 2, cx: -xi, cz: (zl + zh) / 2, floor: false });
  arc(-xi, zl, Math.PI, (3 * Math.PI) / 2, 5);
  for (let k = 1; k < 6; k++) {
    const x = -xi + (2 * xi * k) / 6;
    out.push({ x, z: 0, cx: x, cz: zl, floor: true });
  }
  return out;
}

// la scatola della porta per il lato sy (+1 arancione, −1 blu): tubo + fondo arrotondato + parete di fondo
export function buildGoal(sy: number) {
  const g = new Geo();
  const P = goalProfile();
  const n = P.length;
  const yA = EY;
  const yB = GY1 - GR;
  // tubo (senza la parte piatta del pavimento, che sta nel pavimento)
  const ra: number[] = [];
  const rb: number[] = [];
  for (const p of P) {
    const nx = -(p.x - p.cx) / GR;
    const nz = -(p.z - p.cz) / GR;
    ra.push(g.vert(p.x, yA * sy, p.z, nx, 0, nz, p.x, p.z));
    rb.push(g.vert(p.x, yB * sy, p.z, nx, 0, nz, p.x, p.z));
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    if (P[i].z < 0.01 && P[j].z < 0.01) continue; // il pavimento piatto è nel pavimento
    g.quad(ra[i], ra[j], rb[j], rb[i]);
  }
  // fondo arrotondato (raccordo da 40 verso la parete di fondo)
  const KC = 6;
  let prev = rb;
  for (let k = 1; k <= KC; k++) {
    const th = ((k / KC) * Math.PI) / 2;
    const ring: number[] = [];
    for (const p of P) {
      const ox = (p.x - p.cx) / GR;
      const oz = (p.z - p.cz) / GR;
      const x = p.cx + ox * GR * Math.cos(th);
      const z = p.cz + oz * GR * Math.cos(th);
      const y = (yB + GR * Math.sin(th)) * sy;
      ring.push(g.vert(x, y, z, -ox * Math.cos(th), -Math.sin(th) * sy, -oz * Math.cos(th), x, z));
    }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      g.quad(prev[i], prev[j], ring[j], ring[i]);
    }
    prev = ring;
  }
  // parete di fondo
  const xi = GW - GR;
  const yb = GY1 * sy;
  const a = g.vert(-xi, yb, GR, 0, -sy, 0, -xi, GR);
  const b = g.vert(xi, yb, GR, 0, -sy, 0, xi, GR);
  const c = g.vert(xi, yb, GH - GR, 0, -sy, 0, xi, GH - GR);
  const d = g.vert(-xi, yb, GH - GR, 0, -sy, 0, -xi, GH - GR);
  g.quad(a, b, c, d);
  return g;
}

// ---------------------------------------------------------------- strisce luminose
// fascia lungo tutto il giro a quota z0..z1, staccata di poco dal muro verso l'interno
function neonLoop(g: Geo, z0: number, z1: number, lift = 1.5) {
  const c = quadContour(0, true);
  const nrm = [0, 0, 0];
  const cols = c.length / 2;
  for (const [sx, sy] of QUADS) {
    const lo: number[] = [];
    const hi: number[] = [];
    for (let i = 0; i < cols; i++) {
      const x = c[i * 2] * sx;
      const y = c[i * 2 + 1] * sy;
      mainNormal(x, y, (z0 + z1) / 2, nrm);
      const hx = nrm[0];
      const hy = nrm[1];
      const l = Math.hypot(hx, hy) || 1;
      const px = x + (hx / l) * lift;
      const py = y + (hy / l) * lift;
      lo.push(g.vert(px, py, z0, hx / l, hy / l, 0, loopU(sx, sy, ARC[i]), 0));
      hi.push(g.vert(px, py, z1, hx / l, hy / l, 0, loopU(sx, sy, ARC[i]), 1));
    }
    for (let i = 0; i < cols - 1; i++) g.quad(lo[i], lo[i + 1], hi[i + 1], hi[i]);
  }
}
// linee verticali luminose a metà dei raccordi verticali (8 spigoli)
function neonEdges(g: Geo, z0: number, z1: number, half = 7, lift = 1.5) {
  const nrm = [0, 0, 0];
  const pts: [number, number][] = [];
  // metà del raccordo lato/angolo e angolo/fondo a w = 0
  const k = RE;
  {
    const a = RE - k * Math.cos(Math.PI / 4);
    const b = RE - k * Math.sin(Math.PI / 4);
    const x = EX - a;
    pts.push([x, CS - x - SQ2 * b]);
    const y = EY - a;
    pts.push([CS - y - SQ2 * b, y]);
  }
  for (const [sx, sy] of QUADS)
    for (const [px, py] of pts) {
      const x = px * sx;
      const y = py * sy;
      mainNormal(x, y, (z0 + z1) / 2, nrm);
      const l = Math.hypot(nrm[0], nrm[1]) || 1;
      const nx = nrm[0] / l;
      const ny = nrm[1] / l;
      // tangente orizzontale
      const tx = -ny;
      const ty = nx;
      const cx = x + nx * lift;
      const cy = y + ny * lift;
      const a = g.vert(cx - tx * half, cy - ty * half, z0, nx, ny, 0, 0, 0);
      const b = g.vert(cx + tx * half, cy + ty * half, z0, nx, ny, 0, 1, 0);
      const c = g.vert(cx + tx * half, cy + ty * half, z1, nx, ny, 0, 1, 1);
      const d = g.vert(cx - tx * half, cy - ty * half, z1, nx, ny, 0, 0, 1);
      g.quad(a, b, c, d);
    }
}
export function buildNeon() {
  const g = new Geo();
  neonLoop(g, OPAQUE_TOP, OPAQUE_TOP + 14);
  neonLoop(g, H - R - 10, H - R);
  neonEdges(g, OPAQUE_TOP + 14, H - R - 10);
  return g;
}

// cornice luminosa della bocca della porta (tubo che segue pali e traversa, raccordi da 40 compresi)
export function buildGoalFrame(sy: number, radius = 9) {
  const g = new Geo();
  const path: [number, number][] = [];
  const xi = GW - GR;
  const zh = GH - GR;
  path.push([-GW, 0]);
  path.push([-GW, zh * 0.5]);
  for (let k = 0; k <= 8; k++) {
    const a = Math.PI - ((k / 8) * Math.PI) / 2;
    path.push([-xi + GR * Math.cos(a), zh + GR * Math.sin(a)]);
  }
  for (let k = 1; k < 6; k++) path.push([-xi + (2 * xi * k) / 6, GH]);
  for (let k = 0; k <= 8; k++) {
    const a = Math.PI / 2 - ((k / 8) * Math.PI) / 2;
    path.push([xi + GR * Math.cos(a), zh + GR * Math.sin(a)]);
  }
  path.push([GW, zh * 0.5]);
  path.push([GW, 0]);
  const y = (EY + 3) * sy;
  const seg = 10;
  const rings: number[][] = [];
  for (let i = 0; i < path.length; i++) {
    const p = path[i];
    const q0 = path[Math.max(0, i - 1)];
    const q1 = path[Math.min(path.length - 1, i + 1)];
    let tx = q1[0] - q0[0];
    let tz = q1[1] - q0[1];
    const tl = Math.hypot(tx, tz) || 1;
    tx /= tl;
    tz /= tl;
    // normale nel piano della bocca (verso l'esterno della bocca) e asse y
    const nx = tz;
    const nz = -tx;
    const ring: number[] = [];
    for (let k = 0; k <= seg; k++) {
      const a = (k / seg) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const ox = nx * ca;
      const oz = nz * ca;
      const oy = sa;
      // il centro del tubo sta 3 uu dentro il muro (fuori dalla bocca)
      const px = p[0] + ox * radius - nx * 3;
      const pz = p[1] + oz * radius - nz * 3;
      ring.push(g.vert(px, y + oy * radius, pz, ox, oy, oz, i / (path.length - 1), k / seg));
    }
    rings.push(ring);
  }
  for (let i = 0; i < rings.length - 1; i++) for (let k = 0; k < seg; k++) g.quad(rings[i][k], rings[i][k + 1], rings[i + 1][k + 1], rings[i + 1][k]);
  return g;
}
