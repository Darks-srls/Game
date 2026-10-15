// ⚽🚗 Axend Turbo — il "cervello" dei bot: chi va sulla palla e chi copre, dove e quando colpirla (a terra, col salto,
// al volo, sul muro), verso dove spingerla, calcio d'inizio, difesa, boost, demolizioni, e le manovre (flip, salti, aerial).
import { arenaDist, arenaNormal } from '../arena';
import { noControls, type Car, type Controls } from '../car';
import { ARENA, BALL, CAR, TICK_RATE } from '../consts';
import { V3, clamp } from '../math';
import type { World } from '../world';
import { DOUBLE_TICK, aimNose, airRecover, dodgeStick, driveTo, jumpProfile, localOf, orient, riseTicks, type LandMem } from './control';
import { ballPrediction, type BallPrediction } from './predict';

const R = BALL.radius;
const GY = ARENA.extentY;
const GW = ARENA.goalHalfW;
const BOOST_AIR = CAR.boostAccelAir;
const BOOST_GROUND = CAR.boostAccelGround;
const BOOST_USE = CAR.boostPerSecond;
const NO_DANGER = 99;

export type PlanKind = 'none' | 'ball' | 'pos' | 'kickoff' | 'demo';
export type HitKind = 'ground' | 'jump' | 'double' | 'aerial' | 'wall';
export type ActKind = 'none' | 'dodge' | 'jump' | 'aerial' | 'unstuck';

export interface BotMemory extends LandMem {
  seed: number;
  seenChange: number;
  thinkAt: number;
  freezeUntil: number; // tempo di reazione: fino a qui si continua col piano vecchio
  plan: PlanKind;
  why: string; // perché (per i resoconti e il banco di prova)
  // colpo
  hit: HitKind;
  hitTick: number;
  bx: number;
  by: number;
  bz: number;
  tx: number;
  ty: number;
  tz: number;
  sx: number;
  sy: number;
  // posizione
  fx: number;
  fy: number;
  vmax: number;
  boostOk: boolean;
  reverseOk: boolean;
  victim: string;
  planEnd: number;
  // manovra in corso
  act: ActKind;
  actTick: number;
  a1: number;
  a2: number;
  a3: number;
  flipReset: number; // 0 no, 1 si prova, 2 preso
  // varie
  stuck: number;
  unstucks: number;
  role: number;
  kickStart: number;
  jumpToggle: number;
  demoAt: number;
  assist: boolean;
  lastTick: number; // ultimo passo in cui il bot ha guidato (per ripartire puliti dopo una pausa, es. assistito)
}

export function newBotMemory(seed = 0): BotMemory {
  return {
    seed: (seed || Math.floor(Math.random() * 2147483646) + 1) | 0,
    seenChange: -100000,
    thinkAt: 0,
    freezeUntil: 0,
    plan: 'none',
    why: '',
    hit: 'ground',
    hitTick: 0,
    bx: 0,
    by: 0,
    bz: 0,
    tx: 0,
    ty: 0,
    tz: 0,
    sx: 0,
    sy: 1,
    fx: 0,
    fy: 0,
    vmax: 2300,
    boostOk: false,
    reverseOk: false,
    victim: '',
    planEnd: 0,
    act: 'none',
    actTick: 0,
    a1: 0,
    a2: 0,
    a3: 0,
    flipReset: 0,
    stuck: 0,
    unstucks: 0,
    role: 0,
    kickStart: -1,
    jumpToggle: 0,
    demoAt: 0,
    assist: false,
    lastTick: -1000,
    landTick: 0,
    lnx: 0,
    lny: 0,
    lnz: 1,
  };
}

function rnd(m: BotMemory) {
  // mulberry32
  let t = (m.seed = (m.seed + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const sideOf = (team: number) => (team === 0 ? 1 : -1);
const wrapPi = (a: number) => {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
};

const v1 = new V3();
const v2 = new V3();
const v3 = new V3();
const v4 = new V3();

// ---------------------------------------------------------------- informazioni di squadra (una volta ogni pochi passi per mondo)
interface TeamInfo {
  tick: number;
  predTick: number;
  eta: Map<string, number>;
  role: Map<string, number>;
  attacker: [string, string];
  best: [number, number];
  danger: [number, number]; // secondi al gol subito (NO_DANGER = nessun pericolo)
  dangerX: [number, number]; // dove la palla attraversa la linea
  size: [number, number];
  kickTaker: [string, string];
}
const infos = new WeakMap<World, TeamInfo>();

// stima veloce del tempo per arrivare sulla palla (per i ruoli)
function quickEta(c: Car, p: BallPrediction, off: number): number {
  if (c.demoed) return 50;
  const f = c.forward(v1);
  let fx = f.x;
  let fy = f.y;
  const fl = Math.hypot(fx, fy);
  if (fl < 0.2) (fx = 0), (fy = sideOf(c.team));
  else (fx /= fl), (fy /= fl);
  const v0 = Math.max(0, c.vel.x * fx + c.vel.y * fy);
  const boost = c.boost > 10;
  const a = boost ? 1500 : 900;
  const vmax = boost ? 2300 : 1410;
  const air = c.numWheels === 0 ? 0.2 + Math.max(0, c.pos.z - 100) / 1500 : 0;
  const t1 = Math.max(0, (vmax - v0) / a);
  const d = p.d;
  for (let i = off; i < p.n; i += 8) {
    const t = (i - off) / TICK_RATE;
    const k = i * 6;
    const dx = d[k] - c.pos.x;
    const dy = d[k + 1] - c.pos.y;
    const dh = Math.hypot(dx, dy);
    const need = dh - 150 + Math.max(0, d[k + 2] - 200) * 0.8;
    const cos = dh > 1 ? (dx * fx + dy * fy) / dh : 1;
    const ta = t - Math.acos(clamp(cos, -1, 1)) * 0.4 - air;
    if (need <= 0) return t;
    if (ta <= 0) continue;
    const reach = ta <= t1 ? v0 * ta + 0.5 * a * ta * ta : v0 * t1 + 0.5 * a * t1 * t1 + vmax * (ta - t1);
    if (reach >= need) return t;
  }
  return 6;
}

function isKickoff(world: World) {
  const b = world.ball;
  return (world.phase === 'play' || world.phase === 'countdown') && Math.abs(b.pos.x) < 1 && Math.abs(b.pos.y) < 1 && b.pos.z < 110 && Math.abs(b.vel.x) + Math.abs(b.vel.y) + Math.abs(b.vel.z) < 60;
}

function teamInfo(world: World, p: BallPrediction): TeamInfo {
  let ti = infos.get(world);
  if (!ti) {
    ti = {
      tick: -100,
      predTick: -1,
      eta: new Map(),
      role: new Map(),
      attacker: ['', ''],
      best: [6, 6],
      danger: [NO_DANGER, NO_DANGER],
      dangerX: [0, 0],
      size: [0, 0],
      kickTaker: ['', ''],
    };
    infos.set(world, ti);
  }
  if (world.tick - ti.tick < 4 && world.tick >= ti.tick && ti.predTick === p.tick) return ti;
  ti.tick = world.tick;
  ti.predTick = p.tick;
  const off = world.tick - p.tick;
  const ball = world.ball;
  ti.eta.clear();
  for (const c of world.cars) ti.eta.set(c.id, quickEta(c, p, off));
  const kick = isKickoff(world);
  for (const team of [0, 1] as const) {
    const side = sideOf(team);
    const mates = world.cars.filter((c) => c.team === team);
    ti.size[team] = mates.length;
    // pericolo: la palla finisce nella nostra porta
    const own = team === 0 ? -1 : 1;
    if (p.goal === own) {
      ti.danger[team] = (p.n - 1 - off) / TICK_RATE;
      ti.dangerX[team] = p.d[(p.n - 1) * 6];
    } else ti.danger[team] = NO_DANGER;
    let best = 6;
    for (const c of mates) best = Math.min(best, ti.eta.get(c.id) ?? 6);
    ti.best[team] = best;
    // chi batte il calcio d'inizio: il più vicino; a pari distanza quello a sinistra (blu: x minore, arancioni: x maggiore)
    if (kick) {
      let bestK = '';
      let bd = 1e9;
      let bx = 0;
      for (const c of mates) {
        if (c.demoed) continue;
        const dd = Math.hypot(c.pos.x, c.pos.y);
        if (dd < bd - 5 || (Math.abs(dd - bd) <= 5 && c.pos.x * side < bx * side)) {
          bd = dd;
          bestK = c.id;
          bx = c.pos.x;
        }
      }
      ti.kickTaker[team] = bestK;
    }
    // ruoli: va sulla palla chi ci arriva prima (meglio se dalla parte giusta), gli altri coprono
    const danger = ti.danger[team] < NO_DANGER;
    let att = '';
    let attScore = 1e9;
    for (const c of mates) {
      if (c.demoed) continue;
      const eta = ti.eta.get(c.id) ?? 6;
      const goalSide = (c.pos.y - ball.pos.y) * side < 200;
      let s = eta;
      if (!danger) {
        if (!goalSide && ball.pos.y * side < 3500) s += 0.6 + Math.min(1, Math.abs(c.pos.y - ball.pos.y) / 3000);
        if (!c.bot) s += 0.15;
        if (c.boost < 12 && eta > 1.2) s += 0.25;
      }
      if (c.id === ti.attacker[team]) s -= 0.3;
      if (s < attScore) (attScore = s), (att = c.id);
    }
    if (kick && ti.kickTaker[team]) att = ti.kickTaker[team];
    ti.attacker[team] = att;
    // il più vicino alla propria porta fa il portiere (con 3 o più), gli altri il supporto
    const ownY = -side * GY;
    let keeper = '';
    if (mates.length >= 3) {
      let kd = 1e9;
      for (const c of mates) {
        if (c.id === att || c.demoed) continue;
        const dd = Math.abs(c.pos.y - ownY) + Math.abs(c.pos.x) * 0.3;
        if (dd < kd) (kd = dd), (keeper = c.id);
      }
    }
    for (const c of mates) ti.role.set(c.id, c.id === att ? 0 : c.id === keeper ? 2 : 1);
  }
  return ti;
}

// ---------------------------------------------------------------- direzione del tiro
// coni come angoli: [a, b] in senso antiorario, il più corto tra le due direzioni
function coneOf(bx: number, by: number, x1: number, y1: number, x2: number, y2: number, out: number[]) {
  const t1 = Math.atan2(y1 - by, x1 - bx);
  const t2 = Math.atan2(y2 - by, x2 - bx);
  if (wrapPi(t2 - t1) >= 0) (out[0] = t1), (out[1] = t2);
  else (out[0] = t2), (out[1] = t1);
}
function inCone(th: number, a: number, b: number) {
  const w = wrapPi(b - a);
  const x = wrapPi(th - a);
  return x >= 0 && x <= (w < 0 ? w + 2 * Math.PI : w);
}
function clampCone(th: number, a: number, b: number) {
  if (inCone(th, a, b)) return th;
  return Math.abs(wrapPi(th - a)) < Math.abs(wrapPi(th - b)) ? a : b;
}
const cone = [0, 0];
const ownCone = [0, 0];

// mai verso la propria porta: vicino alla linea (o dentro la porta) solo verso fuori, altrimenti fuori dal cono dei pali
function avoidOwnGoal(th: number, bx: number, by: number, side: number) {
  const og = -side * GY;
  const fromLine = (by - og) * side;
  if (fromLine < 350 || (fromLine < 900 && Math.abs(bx) < GW + 300)) {
    const fa = side > 0 ? 0.3 : -Math.PI + 0.3;
    const fb = side > 0 ? Math.PI - 0.3 : -0.3;
    return clampCone(th, fa, fb);
  }
  const m = GW + 700 + Math.min(1500, fromLine * 0.3);
  coneOf(bx, by, -m, og, m, og, ownCone);
  if (inCone(th, ownCone[0], ownCone[1])) return Math.abs(wrapPi(th - ownCone[0])) < Math.abs(wrapPi(th - ownCone[1])) ? ownCone[0] - 0.05 : ownCone[1] + 0.05;
  return th;
}

// colpire la palla andando da (cx, cy) verso (bx, by) la manda verso la nostra porta?
export function towardOwnGoal(team: number, cx: number, cy: number, bx: number, by: number) {
  const side = sideOf(team);
  const th = Math.atan2(by - cy, bx - cx);
  return Math.abs(wrapPi(avoidOwnGoal(th, bx, by, side) - th)) > 0.25;
}

// sceglie la direzione in cui spingere la palla (in mem.sx, mem.sy): in porta se l'angolo lo permette,
// altrimenti al centro / al compagno / in avanti, mai verso la propria porta
function chooseShot(world: World, car: Car, bx: number, by: number, skill: number, mem: BotMemory, noise: boolean) {
  const side = sideOf(car.team);
  let nx = bx - car.pos.x;
  let ny = by - car.pos.y;
  const nl = Math.hypot(nx, ny) || 1;
  nx /= nl;
  ny /= nl;
  const th = Math.atan2(ny, nx);
  const gy = side * GY;
  const maxCut = 0.5 + 0.4 * skill + (mem.assist ? 0.1 : 0);
  let res = th;
  const pw = GW - 170;
  if (by * side < GY - 80) {
    coneOf(bx, by, -pw, gy, pw, gy, cone);
    const s = clampCone(th, cone[0], cone[1]);
    res = s;
    const shotCut = Math.abs(wrapPi(s - th));
    const goalDist = Math.hypot(bx, gy - by);
    // tiro scarso (niente angolo, porta stretta o troppo lontana): passaggio a un compagno messo meglio
    let done = false;
    if ((skill >= 0.55 || mem.assist) && (shotCut > maxCut || Math.abs(wrapPi(cone[1] - cone[0])) < 0.28 || goalDist > 4300)) {
      let bestD = 1e9;
      for (const m of world.cars) {
        if (m.team !== car.team || m.id === car.id || m.demoed || m.pos.z > 300) continue;
        if ((m.pos.y - by) * side < 300 || Math.abs(m.pos.x) > 2800 || Math.hypot(m.pos.x, gy - m.pos.y) > goalDist - 400) continue;
        const px = m.pos.x + m.vel.x * 0.7;
        const py = m.pos.y + m.vel.y * 0.7 + side * 250;
        const tp = Math.atan2(py - by, px - bx);
        const cut = Math.abs(wrapPi(tp - th));
        if (cut < maxCut && cut < bestD) (bestD = cut), (res = tp), (done = true);
      }
    }
    if (!done && shotCut > maxCut) {
      // non c'è angolo per tirare: palla al centro davanti alla porta, o avanti
      if (by * side > 1500 && Math.abs(bx) > 1100) {
        const tc = Math.atan2(gy - side * 1300 - by, -bx * 0.2 - bx);
        if (Math.abs(wrapPi(tc - th)) < maxCut + 0.2) (res = tc), (done = true);
      }
      if (!done) {
        // in avanti (verso il campo avversario), anche di sponda sul muro
        const fa = side > 0 ? 0.35 : -Math.PI + 0.35;
        const fb = side > 0 ? Math.PI - 0.35 : -0.35;
        const s2 = clampCone(th, fa, fb);
        if (Math.abs(wrapPi(s2 - th)) < maxCut + 0.35) res = s2;
        else {
          // almeno di lato, mai all'indietro verso la nostra metà
          const ga = side > 0 ? -0.25 : -Math.PI - 0.25;
          const gb = side > 0 ? Math.PI + 0.25 : 0.25;
          res = clampCone(th, ga, gb);
        }
      }
    }
  }
  res = avoidOwnGoal(res, bx, by, side);
  if (noise) res += (rnd(mem) - 0.5) * 2 * (1 - skill) * 0.22;
  mem.sx = Math.cos(res);
  mem.sy = Math.sin(res);
}

// ---------------------------------------------------------------- dove e quando colpire la palla
const reach = new Float64Array(301); // distanza percorribile dopo k/60 s andando dritti
const reachV = new Float64Array(301); // velocità a quel punto
const reachB = new Float64Array(301); // boost consumato

function buildReach(v0: number, boost: number) {
  let v = Math.max(0, v0);
  let d = 0;
  let b = boost;
  reach[0] = 0;
  reachV[0] = v;
  reachB[0] = 0;
  const dt = 1 / 60;
  for (let k = 1; k <= 300; k++) {
    let a = v < 1400 ? 1600 * (1 - (0.9 * v) / 1400) : v < 1410 ? (160 * (1410 - v)) / 10 : 0;
    if (b > 0 && v < 2300) {
      a += BOOST_GROUND;
      b -= BOOST_USE * dt;
    }
    v = Math.min(2300, v + a * dt);
    d += v * dt;
    reach[k] = d;
    reachV[k] = v;
    reachB[k] = boost - Math.max(0, b);
  }
}
const reachAt = (t: number) => (t <= 0 ? 0 : reach[Math.min(300, Math.floor(t * 60))]);

function clampField(p: V3) {
  p.x = clamp(p.x, -(ARENA.extentX - 200), ARENA.extentX - 200);
  // dentro la porta si può andare (per pulire la palla dalla linea), altrimenti si sta lontani dal muro di fondo
  const ly = Math.abs(p.x) < GW - 130 ? GY + 550 : GY - 200;
  p.y = clamp(p.y, -ly, ly);
  const s = Math.abs(p.x) + Math.abs(p.y);
  const lim = ARENA.cornerSum - 400;
  if (s > lim) {
    const k = lim / s;
    p.x *= k;
    p.y *= k;
  }
  return p;
}

// accelerazione media richiesta per un aerial che parte ora (salto + doppio salto) e arriva a (tx,ty,tz) fra T secondi
function aerialNeed(car: Car, tx: number, ty: number, tz: number, T: number, fromGround: boolean): number {
  if (fromGround) return aerialNeedFrom(car.pos.x, car.pos.y, car.pos.z, car.vel.x, car.vel.y, tx, ty, tz, T);
  if (T < 0.3) return 1e9;
  const px = car.pos.x + car.vel.x * T;
  const py = car.pos.y + car.vel.y * T;
  const pz = car.pos.z + car.vel.z * T - 325 * T * T;
  const tb = T - 0.1;
  const dl = Math.hypot(tx - px, ty - py, tz - pz);
  return (2 * dl) / (tb * tb);
}
// da terra (z dell'origine cz) con velocità orizzontale (vx, vy): salto, doppio salto, poi boost
function aerialNeedFrom(cx: number, cy: number, cz: number, vx: number, vy: number, tx: number, ty: number, tz: number, T: number): number {
  if (T < 0.45) return 1e9;
  const prof = jumpProfile();
  const kj = Math.min(Math.round(T * TICK_RATE), 36);
  const tj = kj / TICK_RATE;
  const dz = prof.z2[kj] - prof.z2[0];
  const vz = prof.v2[kj];
  const tr = T - tj;
  const pz = cz + dz + vz * tr - 325 * tr * tr;
  const px = cx + vx * T;
  const py = cy + vy * T;
  const tb = T - 0.3;
  const dl = Math.hypot(tx - px, ty - py, tz - pz);
  return (2 * dl) / (tb * tb);
}

// cerca il primo momento in cui si può colpire la palla; scrive il piano in mem e restituisce true
function findHit(world: World, car: Car, mem: BotMemory, p: BallPrediction, skill: number, save = false, maxT = 5): boolean {
  const off = world.tick - p.tick;
  const side = sideOf(car.team);
  const f = car.forward(v1);
  let fx = f.x;
  let fy = f.y;
  const fl = Math.hypot(fx, fy);
  if (fl < 0.3) {
    const vl = Math.hypot(car.vel.x, car.vel.y);
    if (vl > 100) (fx = car.vel.x / vl), (fy = car.vel.y / vl);
    else (fx = 0), (fy = side);
  } else (fx /= fl), (fy /= fl);
  const fwdSpeed = car.vel.x * fx + car.vel.y * fy;
  const upZ = car.up(v2).z;
  const onWall = car.onGround && upZ < 0.75;
  const air = car.numWheels === 0;
  let pen = fwdSpeed < 0 ? -fwdSpeed / 3500 : 0;
  if (air) {
    const z = Math.max(0, car.pos.z - 20);
    pen += (car.vel.z + Math.sqrt(car.vel.z * car.vel.z + 1300 * z)) / 650 + 0.1;
  }
  if (onWall) pen += 0.2 + car.pos.z / 1800;
  pen += (1 - skill) * 0.12;
  const boostOk = skill >= 0.15 && car.boost > 0;
  buildReach(fwdSpeed, boostOk ? car.boost * (skill < 0.4 ? 0.5 : 1) : 0);
  const rs = 0.86 + 0.14 * skill; // i più scarsi si muovono peggio
  const prof = jumpProfile();
  const aerialSkill = mem.assist ? 0 : 0.45;
  const aerialOk = skill >= aerialSkill && car.boost >= 25 && car.onGround && !onWall && car.numWheels >= 3;
  const maxAirZ = mem.assist ? 1950 : 350 + 1600 * skill;
  const jumpOk = skill >= 0.12;
  const dblOk = skill >= 0.4;
  const wallOk = skill >= 0.35;
  const h1 = prof.z1[72] + 55; // altezze che si prendono salendo in meno di 0,6–0,75 s
  const h2 = prof.z2[90] + 55;
  const d = p.d;
  const last = Math.min(p.n, off + Math.round(maxT * TICK_RATE));
  for (let i = off + 3; i < last; i += 2) {
    const t = (i - off) / TICK_RATE;
    const k = i * 6;
    const bx = d[k];
    const by = d[k + 1];
    const bz = d[k + 2];
    let kind: HitKind | '' = '';
    if (bz < 155) kind = 'ground';
    else if (bz < h1 && jumpOk) kind = 'jump';
    else if (bz < h2 && dblOk) kind = 'double';
    else {
      if (wallOk && bz < 1700 && !(Math.abs(bx) < GW + 250 && bz < ARENA.goalHeight + 150)) {
        if (arenaDist(bx, by, bz) < R + 120) kind = 'wall';
      }
      if (!kind && aerialOk && bz < maxAirZ) kind = 'aerial';
    }
    if (!kind) continue;
    const dx = bx - car.pos.x;
    const dy = by - car.pos.y;
    const dh = Math.hypot(dx, dy);
    const cosA = dh > 1 ? (dx * fx + dy * fy) / dh : 1;
    if (kind === 'aerial') {
      // (una fetta su due: basta e costa la metà)
      if (t < 0.6 || cosA < 0.6 - pen || (i - off) % 4 !== 3) continue;
      chooseShot(world, car, bx, by, skill, mem, false);
      // l'aerial spinge la palla nella direzione in cui si vola: il tiro deve essere quasi in quella direzione
      const sdot = (mem.sx * dx + mem.sy * dy) / (dh || 1);
      if (sdot < 0.55) continue;
      const tx = bx - mem.sx * (R + 40);
      const ty = by - mem.sy * (R + 40);
      const tz = bz - 25;
      const margin = mem.assist ? 0.8 : 0.5 + 0.3 * skill;
      // si guida un po' verso il punto (accelerando) e poi si salta: si prova qualche tempo di partenza
      const ux = (tx - car.pos.x) / (dh || 1);
      const uy = (ty - car.pos.y) / (dh || 1);
      const tTurn = Math.acos(clamp(cosA, -1, 1)) * 0.36 + pen;
      let ok = false;
      for (let tg = 0, n = 0; tg <= t - 0.6 && n < 12; tg += 0.25, n++) {
        const kg = Math.min(300, Math.floor(Math.max(0, tg - tTurn) * 60));
        const dg = tg > 0 ? reach[kg] * rs : 0;
        if (dg > dh - 80) break;
        const vg = tg > 0 ? reachV[kg] : Math.max(0, fwdSpeed);
        const need = aerialNeedFrom(car.pos.x + ux * dg, car.pos.y + uy * dg, CAR.restZ, ux * vg, uy * vg, tx, ty, tz, t - tg);
        if (need > BOOST_AIR * margin) continue;
        const boostNeed = (tg > 0 ? reachB[kg] : 0) + (need / BOOST_AIR) * (t - tg - 0.3) * BOOST_USE * 1.3 + 6;
        if (boostNeed > car.boost) continue;
        ok = true;
        break;
      }
      if (!ok) continue;
      setHit(world, mem, 'aerial', i, p, bx, by, bz, tx, ty, tz);
      return true;
    }
    const quickD = dh - 170 + (kind === 'wall' ? bz - 100 : 0);
    const quickTa = t - Math.acos(clamp(cosA, -1, 1)) * 0.36 - pen;
    if (quickTa <= 0 || reachAt(quickTa) * rs < quickD) continue;
    let tz = 0;
    if (kind === 'jump' || kind === 'double') {
      const z = kind === 'jump' ? prof.z1 : prof.z2;
      const rk = riseTicks(z, kind === 'jump' ? prof.top1 : prof.top2, bz - 55);
      if (rk < 0 || rk > (i - off) - 2) continue;
      tz = bz - 55;
    }
    // il punto da cui colpire, con l'avvicinamento per spingere la palla nella direzione scelta
    chooseShot(world, car, bx, by, skill, mem, false);
    if (kind === 'wall') {
      // l'origine della macchina sul muro, sotto la palla (un filo più in basso: la si prende col muso)
      arenaNormal(bx, by, bz, v3);
      setHit(world, mem, 'wall', i, p, bx, by, bz, bx - v3.x * (R - 20), by - v3.y * (R - 20), Math.max(60, bz - v3.z * (R - 20) - 60));
      return true;
    }
    const offs = kind === 'ground' ? 150 : 115;
    const tx = bx - mem.sx * offs;
    const ty = by - mem.sy * offs;
    const ex = tx - car.pos.x;
    const ey = ty - car.pos.y;
    const dist0 = Math.hypot(ex, ey);
    const kk = clamp(dist0 * 0.45 - 60, 0, 1100);
    v3.set(tx - mem.sx * kk, ty - mem.sy * kk, 0);
    clampField(v3);
    const ax = v3.x - car.pos.x;
    const ay = v3.y - car.pos.y;
    const al = Math.hypot(ax, ay);
    const path = al + Math.hypot(tx - v3.x, ty - v3.y);
    const cosB = al > 1 ? (ax * fx + ay * fy) / al : 1;
    const ta = t - Math.acos(clamp(cosB, -1, 1)) * 0.36 - pen;
    if (ta <= 0 || reachAt(ta) * rs < path - 20) {
      // parata: basta toccarla andando dritti, se così non la si spinge verso la nostra porta
      if (save && !towardOwnGoal(car.team, car.pos.x, car.pos.y, bx, by)) {
        const nx = dx / (dh || 1);
        const ny = dy / (dh || 1);
        mem.sx = nx;
        mem.sy = ny;
        setHit(world, mem, kind, i, p, bx, by, bz, bx - nx * offs, by - ny * offs, tz);
        return true;
      }
      continue;
    }
    setHit(world, mem, kind, i, p, bx, by, bz, tx, ty, tz);
    return true;
  }
  return false;
}

function setHit(world: World, mem: BotMemory, kind: HitKind, i: number, p: BallPrediction, bx: number, by: number, bz: number, tx: number, ty: number, tz: number) {
  mem.plan = 'ball';
  mem.hit = kind;
  mem.hitTick = p.tick + i;
  mem.bx = bx;
  mem.by = by;
  mem.bz = bz;
  mem.tx = tx;
  mem.ty = ty;
  mem.tz = tz;
}

function setPos(world: World, mem: BotMemory, x: number, y: number, faceX: number, faceY: number, vmax: number, boostOk: boolean, why: string, reverseOk = true) {
  v4.set(x, y, 0);
  clampField(v4);
  mem.plan = 'pos';
  mem.tx = v4.x;
  mem.ty = v4.y;
  mem.tz = 0;
  const fl = Math.hypot(faceX, faceY);
  mem.fx = fl > 1e-3 ? faceX / fl : 0;
  mem.fy = fl > 1e-3 ? faceY / fl : 0;
  mem.vmax = vmax;
  mem.boostOk = boostOk;
  mem.reverseOk = reverseOk;
  mem.why = why;
}

// un cuscinetto del boost di passaggio verso (x, y), se conviene
function padOnWay(world: World, car: Car, x: number, y: number, maxDetour: number, ownHalfOnly: boolean): number {
  let best = -1;
  let bestScore = 1e9;
  const direct = Math.hypot(x - car.pos.x, y - car.pos.y);
  const side = sideOf(car.team);
  for (let i = 0; i < world.pads.length; i++) {
    const pd = world.pads[i];
    if (ownHalfOnly && pd.y * side > 300) continue;
    const d1 = Math.hypot(pd.x - car.pos.x, pd.y - car.pos.y);
    if (pd.timer > d1 / 1800 + 0.2) continue;
    const detour = d1 + Math.hypot(x - pd.x, y - pd.y) - direct;
    const lim = pd.big ? maxDetour : maxDetour * 0.35;
    if (detour > lim) continue;
    const score = detour - (pd.big ? 1200 : 150);
    if (score < bestScore) (bestScore = score), (best = i);
  }
  return best;
}

// ---------------------------------------------------------------- decisioni
function think(world: World, car: Car, mem: BotMemory, skill: number, p: BallPrediction, ti: TeamInfo) {
  const side = sideOf(car.team);
  const ownY = -side * GY;
  const ball = world.ball;
  const off = world.tick - p.tick;
  let role = ti.role.get(car.id) ?? 0;
  if (mem.assist && role !== 0) {
    // l'assistito va sulla palla a meno che un compagno sia nettamente messo meglio
    const mine = ti.eta.get(car.id) ?? 6;
    const att = ti.eta.get(ti.attacker[car.team]) ?? 6;
    if (mine < att + 0.45) role = 0;
  }
  mem.role = role;

  if (world.phase === 'goal') {
    // festa del gol: si torna nella propria metà e si fa il pieno
    const pi = padOnWay(world, car, car.pos.x * 0.5, ownY * 0.5, 3000, true);
    if (pi >= 0 && car.boost < 90) setPos(world, mem, world.pads[pi].x, world.pads[pi].y, 0, 0, 2300, false, 'boost');
    else setPos(world, mem, car.pos.x * 0.5, ownY * 0.5, 0, side, 1400, false, 'pausa');
    return;
  }

  if (isKickoff(world)) {
    if (ti.kickTaker[car.team] === car.id) {
      mem.plan = 'kickoff';
      mem.why = 'calcio';
      if (mem.kickStart < 0) mem.kickStart = world.tick + Math.round(rnd(mem) * (1 - skill) * 0.35 * TICK_RATE);
      return;
    }
    // gli altri: boost d'angolo vicino o in porta
    if (role === 2 || ti.size[car.team] === 1) setPos(world, mem, 0, ownY + side * 300, 0, side, 2300, false, 'porta');
    else {
      const sx = car.pos.x < 0 ? -1 : 1;
      if (Math.abs(car.pos.x) > 1000) setPos(world, mem, sx * 3072, -side * 4096, 0, side, 2300, true, 'boost');
      else setPos(world, mem, sx * 1200, -side * 2600, 0, side, 2300, false, 'copre');
    }
    return;
  }
  mem.kickStart = -1;

  const danger = ti.danger[car.team];
  const opp = car.team === 0 ? 1 : 0;
  const oppBest = ti.best[opp];
  const single = ti.size[car.team] === 1;
  const bx = ball.pos.x;
  const by = ball.pos.y;
  const goalSide = (car.pos.y - by) * side < 150;
  const ballOwnHalf = by * side < 0;

  if (role === 0 || danger < NO_DANGER) {
    const got = findHit(world, car, mem, p, skill, danger < NO_DANGER);
    const t = got ? (mem.hitTick - world.tick) / TICK_RATE : 99;
    if (danger < NO_DANGER) {
      const attEta = ti.eta.get(ti.attacker[car.team]) ?? 6;
      const second = role !== 0 && attEta < danger - 0.15 && attEta < t + 0.35;
      if (got && t <= danger - 0.03 && !second) {
        mem.why = 'parata';
        finishBallPlan(world, car, mem, skill, p);
        return;
      }
      if (role === 0) {
        // non ci si arriva prima del gol: ci si mette sulla linea dove entra la palla
        const x = clamp(ti.dangerX[car.team], -GW + 150, GW - 150);
        setPos(world, mem, x, ownY - side * 60, 0, side, 2300, true, 'linea', true);
        return;
      }
    } else if (got && role === 0) {
      const late = t - oppBest;
      const smart = skill >= 0.35 && !mem.assist;
      // poco boost e la palla non è urgente: prima un cuscinetto (grande se non costa troppa strada)
      if (smart && car.boost < 30 && t > 1.1 && (late > -0.3 || t > 2) && !(by * side > 2500 && goalSide)) {
        const pi = padOnWay(world, car, mem.tx, mem.ty, car.boost < 12 ? 1800 : 1000, false);
        if (pi >= 0) {
          setPos(world, mem, world.pads[pi].x, world.pads[pi].y, 0, 0, 2300, false, 'boost');
          return;
        }
      }
      if (smart && !goalSide && late > 0.3 && (ballOwnHalf || (ball.vel.y * side < -300 && by * side < 2500))) {
        backPost(world, car, mem, 'rientro');
        return;
      }
      // dalla parte sbagliata e il colpo possibile è solo di striscio: si rientra invece di inseguire
      const cdx = mem.bx - car.pos.x;
      const cdy = mem.by - car.pos.y;
      const cut = (cdx * mem.sx + cdy * mem.sy) / (Math.hypot(cdx, cdy) || 1);
      if (smart && !goalSide && cut < 0.5 && (t > 0.5 || late > -0.2)) {
        if (ballOwnHalf || ball.vel.y * side < -200) backPost(world, car, mem, 'rientro');
        else shadow(world, car, mem, p, 'ombra');
        return;
      }
      if (smart && goalSide && late > 0.6 + 0.5 * (1 - skill) && by * side < 2000) {
        shadow(world, car, mem, p, 'ombra');
        return;
      }
      mem.why = 'palla';
      finishBallPlan(world, car, mem, skill, p);
      return;
    } else if (role === 0) {
      // non si arriva in tempo: si va verso dove sarà la palla fra un po', stando dalla parte giusta
      const k = Math.min(p.n - 1, off + 2 * TICK_RATE) * 6;
      const fx = p.d[k];
      const fy = p.d[k + 1] - side * 900;
      if (!goalSide && by * side < 2000) backPost(world, car, mem, 'rientro');
      else setPos(world, mem, fx, fy, p.d[k] - fx, p.d[k + 1] - fy, 2300, true, 'insegue');
      return;
    }
  }

  // ---- supporto e portiere
  if (single) {
    shadow(world, car, mem, p, 'ombra');
    return;
  }
  // demolizione ogni tanto (bravi): il portiere avversario o chi è sulla nostra strada
  if (role === 1 && skill >= 0.7 && car.boost > 30 && world.tick >= mem.demoAt && danger >= NO_DANGER && !ballOwnHalf) {
    mem.demoAt = world.tick + 4 * TICK_RATE;
    if (rnd(mem) < 0.3 * skill) {
      const f = car.forward(v1);
      let victim = '';
      let bd = 2600;
      for (const o of world.cars) {
        if (o.team === car.team || o.demoed || !o.onGround || o.pos.z > 100) continue;
        const dx = o.pos.x - car.pos.x;
        const dy = o.pos.y - car.pos.y;
        const dd = Math.hypot(dx, dy);
        if (dd < bd && (dx * f.x + dy * f.y) / dd > 0.75) (bd = dd), (victim = o.id);
      }
      if (victim) {
        mem.plan = 'demo';
        mem.victim = victim;
        mem.planEnd = world.tick + Math.round(2.2 * TICK_RATE);
        mem.why = 'demo';
        return;
      }
    }
  }
  const bk = Math.min(p.n - 1, off + 60) * 6;
  const fbx = p.d[bk];
  const fby = p.d[bk + 1];
  if (role === 2 || danger < NO_DANGER) {
    // portiere: davanti alla porta, un po' verso la palla; più avanti se la palla è lontana
    const depth = fby * side < -1000 ? 200 : clamp((fby * side + GY) * 0.3, 400, 2600);
    const x = clamp(fbx * 0.3, -700, 700);
    const y = ownY + side * depth;
    const far = Math.hypot(x - car.pos.x, y - car.pos.y);
    if (car.boost < 50 && danger >= NO_DANGER && fby * side > 0) {
      const pi = padOnWay(world, car, x, y, 900, true);
      if (pi >= 0) {
        setPos(world, mem, world.pads[pi].x, world.pads[pi].y, 0, 0, 2300, false, 'boost');
        return;
      }
    }
    setPos(world, mem, x, y, fbx - x, fby - y, 2300, far > 2500, 'portiere');
    return;
  }
  // supporto: dietro la palla verso la propria porta, pronto a prendere il rimbalzo
  let x = fbx * 0.55;
  let y = fby - side * 2300;
  if (y * side < -(GY - 500)) y = ownY + side * 500;
  if (fby * side < -2500) {
    x = fbx * 0.35;
    y = ownY + side * 700;
  }
  if (car.boost < 40 && danger >= NO_DANGER) {
    const pi = padOnWay(world, car, x, y, 1800, false);
    if (pi >= 0) {
      setPos(world, mem, world.pads[pi].x, world.pads[pi].y, 0, 0, 2300, false, 'boost');
      return;
    }
  }
  const far = Math.hypot(x - car.pos.x, y - car.pos.y);
  setPos(world, mem, x, y, fbx - x, fby - y, 2300, far > 2800, 'supporto');
}

// tra palla e porta, a distanza
function shadow(world: World, car: Car, mem: BotMemory, p: BallPrediction, why: string) {
  const side = sideOf(car.team);
  const ownY = -side * GY;
  const off = world.tick - p.tick;
  const k = Math.min(p.n - 1, off + 40) * 6;
  const bx = p.d[k];
  const by = p.d[k + 1];
  let dx = 0 - bx;
  let dy = ownY - by;
  const dl = Math.hypot(dx, dy) || 1;
  dx /= dl;
  dy /= dl;
  const dist = Math.min(1500, dl * 0.6);
  const px = bx + dx * dist;
  const py = by + dy * dist;
  if (car.boost < 60 && viaPad(world, car, mem, px, py, car.boost < 25 ? 1200 : 500)) return;
  setPos(world, mem, px, py, bx - px, by - py, 2300, dl > 3500, why);
}

// passa da un cuscinetto se è di strada (true = piano scritto)
function viaPad(world: World, car: Car, mem: BotMemory, x: number, y: number, maxDetour: number): boolean {
  const pi = padOnWay(world, car, x, y, maxDetour, false);
  if (pi < 0) return false;
  const pd = world.pads[pi];
  if (Math.hypot(pd.x - car.pos.x, pd.y - car.pos.y) > Math.hypot(x - car.pos.x, y - car.pos.y)) return false;
  setPos(world, mem, pd.x, pd.y, 0, 0, 2300, false, 'boost');
  return true;
}

// rientro dal palo lontano
function backPost(world: World, car: Car, mem: BotMemory, why: string) {
  const side = sideOf(car.team);
  const ownY = -side * GY;
  const bx = world.ball.pos.x;
  const sx = bx > 0 ? -1 : 1;
  if (car.boost < 40 && viaPad(world, car, mem, sx * (GW - 150), ownY + side * 250, 400)) return;
  setPos(world, mem, sx * (GW - 150), ownY + side * 250, bx - sx * (GW - 150), world.ball.pos.y - ownY, 2300, true, why, false);
}

function finishBallPlan(world: World, car: Car, mem: BotMemory, skill: number, p: BallPrediction) {
  // errore di mira dei meno bravi
  if (skill < 1 && mem.hit !== 'wall') {
    const e = (rnd(mem) - 0.5) * 2 * (1 - skill) * 0.25;
    const c = Math.cos(e);
    const s = Math.sin(e);
    const sx = mem.sx * c - mem.sy * s;
    const sy = mem.sx * s + mem.sy * c;
    mem.sx = sx;
    mem.sy = sy;
  }
  // tentativo di flip reset (assistito, o bravissimi ogni tanto): palla alta e lenta
  mem.flipReset = 0;
  if (mem.hit === 'aerial' && mem.bz > 600 && (mem.assist || (skill >= 0.95 && rnd(mem) < 0.15))) {
    const k = (mem.hitTick - p.tick) * 6;
    const bvz = p.d[k + 5];
    const T = (mem.hitTick - world.tick) / TICK_RATE;
    if (Math.abs(bvz) < 900 && car.boost > 40 && T > 0.9 && mem.by * sideOf(car.team) > -500) mem.flipReset = 1;
  }
}

// ---------------------------------------------------------------- manovre
function startAct(world: World, mem: BotMemory, act: ActKind, a1 = 0, a2 = 0, a3 = 0) {
  mem.act = act;
  mem.actTick = world.tick;
  mem.a1 = a1;
  mem.a2 = a2;
  mem.a3 = a3;
}

const sB = new V3();
const sD = new V3();
const sP = new V3();
const sU = new V3();

// posizione della palla nella previsione al passo assoluto `tick` (o l'ultima)
function predAt(p: BallPrediction, tick: number, out: V3) {
  const i = clamp(tick - p.tick, 0, p.n - 1) * 6;
  return out.set(p.d[i], p.d[i + 1], p.d[i + 2]);
}

// restituisce true se la manovra ha scritto i comandi
function runAct(world: World, car: Car, mem: BotMemory, out: Controls, skill: number, p: BallPrediction): boolean {
  const k = world.tick - mem.actTick;
  switch (mem.act) {
    case 'dodge': {
      // a1 = passi di salto tenuto (0 = già in aria), a2/a3 = direzione (avanti, destra) o 0,0 = verso la palla
      const hold = mem.a1;
      const press = hold + 2;
      out.throttle = 1;
      if (k < hold) {
        out.jump = true;
        return true;
      }
      if (k < press) {
        if (car.onGround && hold > 0 && k > hold + 1) break;
        return true;
      }
      if (k === press) {
        if (car.hasFlipped || car.hasDoubleJumped) break;
        let fw = mem.a2;
        let rt = mem.a3;
        if (fw === 0 && rt === 0) {
          const b = world.ball.pos;
          if (towardOwnGoal(car.team, car.pos.x, car.pos.y, b.x, b.y)) break;
          const l = localOf(car, b.x, b.y, b.z, sD);
          fw = l.x;
          rt = -l.y;
        }
        out.jump = true;
        dodgeStick(out, fw, rt);
        return true;
      }
      if (k < press + 70 && !car.onGround) return true; // capriola: niente comandi che la annullino
      if (car.onGround || k > press + 200) break;
      airRecover(car, out, world.tick, mem);
      return true;
    }
    case 'jump': {
      // salto (o doppio salto) per prendere una palla alta da terra; a1 = passi di salto, a2 = doppio, a3 = flip alla fine
      const T = (mem.hitTick - world.tick) / TICK_RATE;
      const dbl = mem.a2 > 0;
      out.throttle = 1;
      out.jump = k < mem.a1 || (dbl && k === DOUBLE_TICK);
      predAt(p, mem.hitTick, sB);
      if (!car.onGround && !(dbl && k === DOUBLE_TICK)) {
        // muso verso la palla
        sD.subOf(T > 0.08 ? sB : world.ball.pos, car.pos);
        aimNose(car, sD, out, true);
        out.roll = 0;
      }
      const dist = Math.hypot(world.ball.pos.x - car.pos.x, world.ball.pos.y - car.pos.y, world.ball.pos.z - car.pos.z);
      if (mem.a3 > 0 && !dbl && k > mem.a1 && T < 0.09 && dist < 270 && !car.hasFlipped && !car.onGround) {
        startAct(world, mem, 'dodge', 0, 0, 0);
        mem.actTick = world.tick - 1; // si preme al prossimo passo
        out.jump = false;
        return true;
      }
      if (T < -0.35 || (car.onGround && k > 12) || (world.ball.lastTouchId === car.id && world.ball.lastTouchTick > mem.actTick && k > 4 && T < -0.05)) break;
      return true;
    }
    case 'aerial':
      return runAerial(world, car, mem, out, skill, p, k);
    case 'unstuck': {
      // retromarcia sterzando al contrario, poi un salto se non basta
      out.throttle = mem.a1;
      out.steer = mem.a2;
      out.jump = mem.a3 > 0 && k === 10;
      if (k > 55) break;
      return true;
    }
  }
  mem.act = 'none';
  mem.thinkAt = world.tick;
  return false;
}

function runAerial(world: World, car: Car, mem: BotMemory, out: Controls, skill: number, p: BallPrediction, k: number): boolean {
  const T = (mem.hitTick - world.tick) / TICK_RATE;
  const dbl = mem.a1 > 0;
  // il bersaglio segue la previsione (se qualcuno ha toccato la palla, il punto si sposta)
  predAt(p, mem.hitTick, sB);
  const reset = mem.flipReset;
  if (reset === 1) {
    // flip reset: la parte sotto della macchina verso la palla
    sD.subOf(car.pos, sB);
    const l = sD.len() || 1;
    sP.copy(sB).addScaled(sD, (R + 18) / l);
  } else sP.set(sB.x - mem.sx * (R + 40), sB.y - mem.sy * (R + 40), sB.z - 25);
  // dove saremmo senza boost, contando la spinta del salto che manca
  const up = car.up(sU);
  const Tc = Math.max(T, 0);
  let jx = 0;
  if (k < 24) {
    const dv = (CAR.jumpAccel * (24 - k)) / TICK_RATE;
    jx += dv * Math.max(0, Tc - (24 - k) / 240);
  }
  if (dbl && k <= DOUBLE_TICK) jx += CAR.jumpImmediate * Math.max(0, Tc - (DOUBLE_TICK - k) / TICK_RATE);
  sD.set(
    sP.x - (car.pos.x + car.vel.x * Tc + up.x * jx),
    sP.y - (car.pos.y + car.vel.y * Tc + up.y * jx),
    sP.z - (car.pos.z + car.vel.z * Tc - 325 * Tc * Tc + up.z * jx),
  );
  const dl = sD.len();
  const need = T > 0.03 ? (2 * dl) / (T * T) : 0;
  out.jump = k < 24 || (dbl && k === DOUBLE_TICK);
  const pressing = dbl && k === DOUBLE_TICK;
  const dBall = Math.hypot(world.ball.pos.x - car.pos.x, world.ball.pos.y - car.pos.y, world.ball.pos.z - car.pos.z);
  let align = 0;
  if (!pressing) {
    if (reset === 1 && T < 0.85) {
      // flip reset: il sotto della macchina verso la palla; il muso (e il boost) corregge l'errore di lato
      sU.subOf(car.pos, sB).normalize();
      const along = sD.dot(sU);
      sD.addScaled(sU, -along);
      const perp = sD.len();
      if (perp < 40) {
        sD.copy(car.vel).addScaled(sU, -car.vel.dot(sU));
        if (sD.len2() < 1) car.forward(sD);
      }
      const ang = orient(car, sD, sU, out);
      const f = car.forward(v1);
      const needPerp = T > 0.05 ? (2 * perp) / (T * T) : 0;
      align = ang < 0.35 && perp >= 40 && f.dot(sD) / (sD.len() || 1) > 0.85 && needPerp > 350 ? 1 : 0;
    } else if (dl > 35 && T > 0.12) {
      aimNose(car, sD, out);
      const f = car.forward(v1);
      align = f.dot(sD) / dl;
    } else {
      sD.subOf(world.ball.pos, car.pos);
      aimNose(car, sD, out);
      const f = car.forward(v1);
      align = f.dot(sD) / (sD.len() || 1);
    }
  }
  // boost quando il muso è allineato e serve spinta (con un po' di isteresi)
  const thr = car.isBoosting ? 0.12 : 0.28;
  out.boost = !pressing && align > 0.82 && need > BOOST_AIR * thr && car.boost > 0;
  out.throttle = align > 0.5 && need > 40 ? 1 : 0;
  // flip reset preso? (le ruote hanno toccato la palla e il salto è tornato)
  if (reset === 1 && k > 30 && car.numWheels >= 3 && car.wheels.some((w) => w.contact && !w.world)) {
    mem.flipReset = 2;
    // nuovo bersaglio: la palla dopo il tocco, poi flip dentro
    return true;
  }
  if (reset === 2) {
    // dopo il reset: si punta la palla e ci si butta dentro col flip
    sD.subOf(world.ball.pos, car.pos);
    aimNose(car, sD, out);
    const f = car.forward(v1);
    out.boost = f.dot(sD) / (sD.len() || 1) > 0.85 && dBall > 260 && car.boost > 0;
    if (dBall < 240 && !car.hasFlipped && !car.hasDoubleJumped) {
      startAct(world, mem, 'dodge', 0, 0, 0);
      mem.actTick = world.tick - 1;
      out.jump = false;
      mem.flipReset = 0;
      return true;
    }
    if (car.onGround && car.wheels.every((w) => !w.contact || w.world)) {
      mem.act = 'none';
      mem.flipReset = 0;
      return false;
    }
    if (k > 4 * TICK_RATE || car.pos.z < 120) {
      mem.act = 'none';
      mem.flipReset = 0;
      return false;
    }
    return true;
  }
  // flip dentro la palla alla fine (se il salto è ancora disponibile)
  if (!dbl && skill >= 0.6 && T < 0.1 && T > -0.05 && dBall < 250 && !car.hasFlipped && k > 26) {
    startAct(world, mem, 'dodge', 0, 0, 0);
    mem.actTick = world.tick - 1;
    out.jump = false;
    return true;
  }
  const touched = world.ball.lastTouchId === car.id && world.ball.lastTouchTick > mem.actTick;
  if (T < -0.3 || (car.onGround && k > 30) || (touched && T < 0.15) || (k > 40 && need > BOOST_AIR * 2.2 && T > 0.25) || (car.boost <= 0 && need > BOOST_AIR * 0.2 && k > 40)) {
    mem.act = 'none';
    mem.thinkAt = world.tick;
    return false;
  }
  return true;
}

// ---------------------------------------------------------------- esecuzione dei piani a terra
function execBall(world: World, car: Car, mem: BotMemory, out: Controls, skill: number, p: BallPrediction) {
  const T = (mem.hitTick - world.tick) / TICK_RATE;
  if (T < -0.15) mem.thinkAt = Math.min(mem.thinkAt, world.tick);
  const fwdSpeed = car.vel.dot(car.forward(v1));
  const prof = jumpProfile();
  if (mem.hit === 'aerial') {
    // ci si allinea e si parte quando il volo torna fattibile
    const dx = mem.tx - car.pos.x;
    const dy = mem.ty - car.pos.y;
    const ang = driveTo(car, out, mem.tx, mem.ty, 0, 2300, true);
    const need = aerialNeed(car, mem.tx, mem.ty, mem.tz, T, true);
    if (car.onGround && car.numWheels >= 3 && Math.abs(ang) < 0.3 && need < BOOST_AIR * 0.85 && car.boost > 10) {
      const dbl = mem.tz - car.pos.z > 330 ? 1 : 0;
      startAct(world, mem, 'aerial', dbl);
      runAct(world, car, mem, out, skill, p);
      return;
    }
    if (T < 0.4 || Math.hypot(dx, dy) < 200) mem.thinkAt = Math.min(mem.thinkAt, world.tick);
    return;
  }
  if (mem.hit === 'wall') {
    const up = car.up(v2);
    const onWall = car.onGround && up.z < 0.7;
    let gx = mem.tx;
    let gy = mem.ty;
    let gz = mem.tz;
    let path: number;
    if (onWall) path = Math.hypot(mem.tx - car.pos.x, mem.ty - car.pos.y, mem.tz - car.pos.z);
    else {
      // da terra: si arriva al piede del muro di fronte (dritti verso il muro), poi si sale dritti fino alla palla
      arenaNormal(mem.tx, mem.ty, Math.min(mem.tz, 600), v3);
      const nl = Math.hypot(v3.x, v3.y) || 1;
      const nx = v3.x / nl;
      const ny = v3.y / nl;
      const fx = mem.tx + nx * 200;
      const fy = mem.ty + ny * 200;
      const d0 = Math.hypot(fx - car.pos.x, fy - car.pos.y);
      const kk = clamp(d0 * 0.45, 0, 900);
      gx = fx + nx * kk;
      gy = fy + ny * kk;
      gz = 0;
      if (d0 < 350) (gx = mem.tx), (gy = mem.ty), (gz = mem.tz);
      path = Math.hypot(gx - car.pos.x, gy - car.pos.y) + kk + Math.max(0, mem.tz - 100);
    }
    const vDes = T > 0.05 ? path / T + 150 : 2300;
    driveTo(car, out, gx, gy, gz, Math.max(vDes, 900), skill > 0.3);
    // vicino alla palla sul muro: salto dal muro (verso il campo) e flip dentro la palla
    const b = world.ball.pos;
    const db = Math.hypot(b.x - car.pos.x, b.y - car.pos.y, b.z - car.pos.z);
    if (onWall && skill >= 0.45 && db < 300 && T < 0.3 && car.numWheels >= 3) {
      startAct(world, mem, 'dodge', 4, 0, 0);
      runAct(world, car, mem, out, skill, p);
    }
    if (T < -0.1) mem.thinkAt = Math.min(mem.thinkAt, world.tick);
    return;
  }
  // a terra / salto: punto di contatto e avvicinamento
  const tx = mem.tx;
  const ty = mem.ty;
  const dist = Math.hypot(tx - car.pos.x, ty - car.pos.y);
  const kk = clamp(dist * 0.45 - 60, 0, 1100);
  v3.set(tx - mem.sx * kk, ty - mem.sy * kk, 0);
  clampField(v3);
  const path = Math.hypot(v3.x - car.pos.x, v3.y - car.pos.y) + Math.hypot(tx - v3.x, ty - v3.y);
  let gx = v3.x;
  let gy = v3.y;
  if (dist < 260) {
    gx = mem.bx;
    gy = mem.by;
  }
  let vDes = T > 0.04 ? path / T : 2300;
  if (T <= 0.04) vDes = 2300;
  // ai bravi piace arrivare forte: se si è in anticipo di poco si tira lo stesso
  if (mem.hit === 'ground' && vDes < 900 && T < 0.6 && skill > 0.5) vDes = Math.max(vDes, 900);
  const ang = driveTo(car, out, gx, gy, 0, vDes, skill > 0.15 && (skill > 0.35 || path > 1500));
  if (!car.onGround || car.numWheels < 3) return;
  const upZ = car.up(v2).z;
  if (upZ < 0.85) return;
  if (mem.hit === 'jump' || mem.hit === 'double') {
    const dbl = mem.hit === 'double';
    const z = dbl ? prof.z2 : prof.z1;
    const rk = riseTicks(z, dbl ? prof.top2 : prof.top1, mem.tz);
    const ticksLeft = mem.hitTick - world.tick;
    if (rk >= 0 && ticksLeft <= rk + 1 && ticksLeft >= rk - 6) {
      // dove saremo al momento del colpo (in aria la velocità orizzontale resta quella)?
      const Tl = ticksLeft / TICK_RATE;
      const ex = car.pos.x + car.vel.x * Tl - tx;
      const ey = car.pos.y + car.vel.y * Tl - ty;
      if (Math.hypot(ex, ey) < 130) {
        const hold = dbl ? 24 : clamp(Math.round(rk * 0.9), 6, 24);
        startAct(world, mem, 'jump', hold, dbl ? 1 : 0, skill >= 0.55 ? 1 : 0);
        runAct(world, car, mem, out, skill, p);
        return;
      }
      if (ticksLeft < rk - 6) mem.thinkAt = Math.min(mem.thinkAt, world.tick);
    }
    return;
  }
  // a terra: flip nella palla per dare forza
  if (skill >= 0.3 && mem.hit === 'ground') {
    const b = world.ball;
    const bd = Math.hypot(b.pos.x - car.pos.x, b.pos.y - car.pos.y);
    const closing = fwdSpeed;
    if (b.pos.z < 140 && T > 0.08 && T < 0.24 && Math.abs(ang) < 0.25 && closing > 900 && bd < 200 + closing * 0.26 && bd > 170) {
      const want = mem.sx * (b.pos.x - car.pos.x) + mem.sy * (b.pos.y - car.pos.y);
      if (want > 0 && !towardOwnGoal(car.team, car.pos.x, car.pos.y, b.pos.x, b.pos.y) && rnd(mem) < 0.35 + 0.65 * skill) {
        startAct(world, mem, 'dodge', 5, 0, 0);
        runAct(world, car, mem, out, skill, p);
      }
    }
  }
}

function execPos(world: World, car: Car, mem: BotMemory, out: Controls) {
  const dx = mem.tx - car.pos.x;
  const dy = mem.ty - car.pos.y;
  const dist = Math.hypot(dx, dy);
  const fx = mem.fx;
  const fy = mem.fy;
  const hasFace = fx !== 0 || fy !== 0;
  if (dist > 320) {
    let ax = mem.tx;
    let ay = mem.ty;
    if (hasFace) {
      const kk = Math.min(dist * 0.4, 700);
      ax -= fx * kk;
      ay -= fy * kk;
    }
    const vDes = Math.min(mem.vmax, Math.sqrt(2 * 2200 * dist) + 100);
    // la palla è sulla strada? la si scansa (spostandosi non si tocca la palla: niente autogol per sbaglio)
    const b = world.ball.pos;
    if (b.z < 260) {
      const lb = localOf(car, b.x, b.y, b.z, v4);
      const lt = localOf(car, ax, ay, 0, v2);
      if (lb.x > -60 && lb.x < 1100 && Math.abs(lb.y) < 280 && lt.x > lb.x - 100 && towardOwnGoal(car.team, car.pos.x, car.pos.y, b.x, b.y)) {
        const l = car.left(v3);
        const sgnSide = lb.y > 0 ? -1 : 1;
        ax = b.x + l.x * sgnSide * 420;
        ay = b.y + l.y * sgnSide * 420;
      }
    }
    // in retromarcia se il posto è dietro e si guarda già nella direzione giusta (portiere che torna)
    const f = car.forward(v1);
    const facing = hasFace ? f.x * fx + f.y * fy : 0;
    const urgent = mem.why === 'linea' || mem.why === 'rientro';
    driveTo(car, out, ax, ay, 0, vDes, mem.boostOk && (dist > 1800 || (urgent && dist > 500)), mem.reverseOk && (urgent || (facing > 0.6 && dist < 1300)));
    return;
  }
  // arrivati: si gira verso la palla piano, poi fermi
  if (hasFace) {
    const f = car.forward(v1);
    const facing = f.x * fx + f.y * fy;
    if (facing < 0.85) {
      driveTo(car, out, car.pos.x + fx * 400, car.pos.y + fy * 400, 0, 500, false);
      return;
    }
  }
  const sp = car.vel.dot(car.forward(v1));
  out.throttle = dist > 120 ? clamp(dist / 600, 0.1, 0.6) : Math.abs(sp) > 60 ? -Math.sign(sp) * 0.5 : 0;
  const l = localOf(car, mem.tx, mem.ty, 0, v4);
  out.steer = dist > 120 ? clamp(-3 * Math.atan2(l.y, l.x), -1, 1) : 0;
}

function execKickoff(world: World, car: Car, mem: BotMemory, out: Controls, skill: number, p: BallPrediction) {
  if (world.tick < mem.kickStart) return;
  const side = sideOf(car.team);
  const b = world.ball;
  // si mira un filo dietro al centro della palla (dalla nostra parte)
  const tx = b.pos.x;
  const ty = b.pos.y - side * 30;
  const d = Math.hypot(tx - car.pos.x, ty - car.pos.y);
  const ang = driveTo(car, out, tx, ty, 0, 2300, skill >= 0.2);
  out.boost = skill >= 0.2 && car.boost > 0 && Math.abs(ang) < 0.4;
  const sp = car.vel.len();
  const flipD = 260 + sp * 0.28;
  if (skill >= 0.25 && d < flipD && Math.abs(ang) < 0.2 && car.onGround) {
    startAct(world, mem, 'dodge', 5, 1, 0);
    runAct(world, car, mem, out, skill, p);
  }
}

function execDemo(world: World, car: Car, mem: BotMemory, out: Controls) {
  const o = world.car(mem.victim);
  if (!o || o.demoed || world.tick > mem.planEnd || o.team === car.team) {
    mem.thinkAt = world.tick;
    mem.plan = 'none';
    return;
  }
  const d = Math.hypot(o.pos.x - car.pos.x, o.pos.y - car.pos.y);
  const t = d / Math.max(1200, car.vel.len());
  const tx = o.pos.x + o.vel.x * t;
  const ty = o.pos.y + o.vel.y * t;
  const ang = driveTo(car, out, tx, ty, 0, 2300, true);
  if (Math.abs(ang) > 1.2) {
    mem.plan = 'none';
    mem.thinkAt = world.tick;
  }
}

// ---------------------------------------------------------------- il bot, passo per passo
export function botStep(world: World, car: Car, mem: BotMemory, skill: number): Controls {
  const out = noControls();
  if (car.demoed || world.phase === 'end') {
    mem.act = 'none';
    return out;
  }
  skill = clamp(skill, 0, 1);
  // ripresa dopo una pausa (assistito riattivato, mondo riavvolto): niente manovre o piani vecchi
  if (world.tick - mem.lastTick > 3 || world.tick < mem.lastTick) {
    mem.act = 'none';
    mem.plan = 'none';
    mem.flipReset = 0;
    mem.thinkAt = world.tick;
    mem.freezeUntil = 0;
    mem.stuck = 0;
    mem.seenChange = world.tick;
  }
  mem.lastTick = world.tick;
  const p = ballPrediction(world);
  const ti = teamInfo(world, p);
  if (world.phase === 'countdown') {
    mem.act = 'none';
    mem.plan = 'none';
    mem.kickStart = -1;
    mem.thinkAt = world.tick;
    think(world, car, mem, skill, p, ti);
    return out;
  }
  // un tocco ha cambiato la strada della palla: ci si accorge dopo il tempo di reazione
  if (p.changedTick > mem.seenChange) {
    mem.seenChange = p.changedTick;
    if (world.tick >= mem.freezeUntil) {
      mem.freezeUntil = p.changedTick + Math.round((0.04 + (1 - skill) * 0.26) * TICK_RATE);
      mem.thinkAt = mem.freezeUntil;
    }
  }
  if (mem.act !== 'none' && runAct(world, car, mem, out, skill, p)) return finish(world, car, mem, out);
  if (world.tick >= mem.thinkAt && world.tick >= mem.freezeUntil) {
    think(world, car, mem, skill, p, ti);
    mem.thinkAt = world.tick + Math.round(4 + (1 - skill) * 8);
  }
  // in aria senza manovra: si atterra sulle ruote
  if (car.numWheels === 0 && !car.onGround) {
    const up = car.up(v2);
    if (car.bodyContact && up.z < 0.2) {
      // ribaltati: salto per raddrizzarsi (si preme a intermittenza)
      mem.jumpToggle++;
      out.jump = mem.jumpToggle % 16 < 4;
      out.throttle = 1;
      return finish(world, car, mem, out);
    }
    // aerial ancora possibile dopo un rimbalzo? si guarda verso dove si va
    if (mem.plan === 'ball' || mem.plan === 'pos') airRecover(car, out, world.tick, mem, mem.tx - car.pos.x, mem.ty - car.pos.y);
    else airRecover(car, out, world.tick, mem);
    return finish(world, car, mem, out);
  }
  switch (mem.plan) {
    case 'ball':
      execBall(world, car, mem, out, skill, p);
      break;
    case 'kickoff':
      execKickoff(world, car, mem, out, skill, p);
      break;
    case 'demo':
      execDemo(world, car, mem, out);
      break;
    case 'pos':
      execPos(world, car, mem, out);
      break;
    default:
      driveTo(car, out, world.ball.pos.x, world.ball.pos.y, 0, 1400, false);
  }
  return finish(world, car, mem, out);
}

// bloccati? (contro un muro, una macchina, la porta): retromarcia e via
function finish(world: World, car: Car, mem: BotMemory, out: Controls): Controls {
  const touching = car.onGround || car.numWheels > 0 || car.bodyContact;
  if (mem.act === 'none' && touching && Math.abs(out.throttle) > 0.5 && car.vel.len() < 90 && world.phase !== 'end') {
    mem.stuck++;
    if (mem.stuck > 70) {
      // incastrati (muro, porta, un'altra macchina, di fianco): indietro sterzando al contrario, a volte avanti, poi salto
      mem.stuck = 0;
      mem.unstucks++;
      const dir = mem.unstucks % 4 === 2 ? Math.sign(out.throttle || 1) : -Math.sign(out.throttle || 1);
      startAct(world, mem, 'unstuck', dir, -Math.sign(out.steer || 1) * (mem.unstucks % 2 ? 1 : -1), mem.unstucks % 3 === 0 && car.onGround ? 1 : 0);
    }
  } else if (mem.stuck > 0) mem.stuck -= car.vel.len() > 300 ? 2 : 0;
  if (mem.stuck < 0) mem.stuck = 0;
  return out;
}

