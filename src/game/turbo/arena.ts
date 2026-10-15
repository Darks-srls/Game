// ⚽🚗 Axend Turbo — il campo come "campo di distanza" (SDF): per ogni punto, quanto manca alla parete più vicina
// (positivo = dentro il campo, negativo = dentro un muro). Ottagono con gli angoli a 45°, raccordi curvi tra pavimento
// e muri (si guida sui muri e sul soffitto) e le due porte. Serve a palla, ruote e carrozzeria.
import { ARENA } from './consts';
import { V3 } from './math';

const SQ2 = Math.SQRT2;

// intersezione "arrotondata" di semispazi (distanze positive dentro): raccordo concavo di raggio r
function roundedInside(r: number, a: number, b: number, c: number, d: number, e: number) {
  const m = Math.min(a, b, c, d, e);
  if (m >= r) return m;
  let s = 0;
  if (a < r) s += (r - a) * (r - a);
  if (b < r) s += (r - b) * (r - b);
  if (c < r) s += (r - c) * (r - c);
  if (d < r) s += (r - d) * (r - d);
  if (e < r) s += (r - e) * (r - e);
  return r - Math.sqrt(s);
}

// raccordo tra muro laterale e angolo (più dolce): applicato alle due pareti verticali
function verticalEdge(side: number, corner: number) {
  const r = ARENA.edgeFillet;
  if (side >= r || corner >= r) return Math.min(side, corner);
  return r - Math.hypot(r - side, r - corner);
}

export function arenaDist(x: number, y: number, z: number): number {
  const ax = x < 0 ? -x : x;
  const ay = y < 0 ? -y : y;
  // campo principale
  const dFloor = z;
  const dCeil = ARENA.height - z;
  const dSide = ARENA.extentX - ax;
  const dBack = ARENA.extentY - ay;
  const dCorner = (ARENA.cornerSum - ax - ay) / SQ2;
  // le pareti verticali tra loro (lato/angolo/fondo) hanno il loro raccordo, poi tutto si raccorda con pavimento e soffitto
  const walls = Math.min(verticalEdge(dSide, dCorner), verticalEdge(dBack, dCorner));
  const main = roundedInside(ARENA.wallFillet, dFloor, dCeil, walls, 1e9, 1e9);
  if (ay < ARENA.extentY - 400) return main;
  // la porta: una scatola dietro la linea, unita al campo
  const gSide = ARENA.goalHalfW - ax;
  const gCeil = ARENA.goalHeight - z;
  const gBack = ARENA.extentY + ARENA.goalDepth - ay;
  const gFront = ay - (ARENA.extentY - 400);
  const goal = roundedInside(40, gSide, gCeil, gBack, dFloor, gFront);
  return main > goal ? main : goal;
}

// normale (verso l'interno del campo) nel punto p, con le differenze centrali
export function arenaNormal(x: number, y: number, z: number, out: V3): V3 {
  const h = 0.5;
  out.x = arenaDist(x + h, y, z) - arenaDist(x - h, y, z);
  out.y = arenaDist(x, y + h, z) - arenaDist(x, y - h, z);
  out.z = arenaDist(x, y, z + h) - arenaDist(x, y, z - h);
  const l = Math.hypot(out.x, out.y, out.z);
  if (l < 1e-9) out.set(0, 0, 1);
  else out.scale(1 / l);
  return out;
}

// raggio dal punto o nella direzione dir (unitaria) per al massimo maxLen: distanza del contatto o -1
export function arenaRay(o: V3, dir: V3, maxLen: number): number {
  let t = 0;
  for (let i = 0; i < 24; i++) {
    const d = arenaDist(o.x + dir.x * t, o.y + dir.y * t, o.z + dir.z * t);
    if (d < 0.25) return t;
    t += d;
    if (t > maxLen) return -1;
  }
  return -1;
}

// la palla è entrata in porta? (+1 = gol per i blu nella porta arancione, -1 = gol per gli arancioni)
export function goalScored(y: number, radius: number): 0 | 1 | -1 {
  if (y > ARENA.goalScoreY + radius) return 1;
  if (y < -(ARENA.goalScoreY + radius)) return -1;
  return 0;
}
