// 🍝 Spaghetto (server): le scie di ognuno, chi le tocca, i grissini del bordo, i bot che guardano avanti
import { SPAG, encodeTrail, spagLife, spagWall } from '../../src/data/minis/spaghetto';
import { registerServerMini, type MiniApi, type MiniBot } from './types';

interface Trail {
  xs: number[];
  zs: number[];
  ts: number[]; // quando è nato ogni pezzo (ms)
  from: number; // i pezzi prima di questo sono già spariti
  seq: number; // pezzi fatti in tutto (per la griglia dei bot)
}
interface SpagState {
  ids: string[]; // l'indice di ognuno (le scie viaggiano con l'indice)
  life: number; // quanto dura un pezzo di spaghetto (ms)
  fresh: number[]; // pezzi nuovi da mandare: indice, x, z (decimetri)
  sentAt: number;
}
// le scie e la griglia dei bot stanno fuori dallo stato salvato (sarebbero troppo grosse da salvare a ogni eliminazione)
interface Live {
  tr: Trail[];
  prev: Record<string, { x: number; z: number }>;
  until: Float64Array; // griglia fine per gli occhi dei bot: in ogni cella fino a quando c'è uno spaghetto…
  owner: Int16Array; // …di chi è…
  pieceNo: Int32Array; // …e che pezzo è
  big: Float64Array; // griglia grossa (1 m) per contare lo spazio libero raggiungibile
  seen: Int32Array;
  stamp: number;
  queue: Int32Array;
}
const CELL = 0.5;
const N = Math.ceil((SPAG.half * 2) / CELL);
const BIG = Math.ceil(SPAG.half * 2);
const LIVE = new WeakMap<SpagState, Live>();
function live(E: SpagState): Live {
  let L = LIVE.get(E);
  if (!L) {
    L = {
      tr: E.ids.map(() => ({ xs: [], zs: [], ts: [], from: 0, seq: 0 })),
      prev: {},
      until: new Float64Array(N * N),
      owner: new Int16Array(N * N),
      pieceNo: new Int32Array(N * N),
      big: new Float64Array(BIG * BIG),
      seen: new Int32Array(BIG * BIG),
      stamp: 0,
      queue: new Int32Array(BIG * BIG),
    };
    LIVE.set(E, L);
  }
  return L;
}
const cellOf = (x: number, z: number) => {
  const i = Math.floor((x + SPAG.half) / CELL);
  const j = Math.floor((z + SPAG.half) / CELL);
  return i < 0 || j < 0 || i >= N || j >= N ? -1 : j * N + i;
};
const bigOf = (x: number, z: number) => {
  const i = Math.floor(x + SPAG.half);
  const j = Math.floor(z + SPAG.half);
  return i < 0 || j < 0 || i >= BIG || j >= BIG ? -1 : j * BIG + i;
};
function mark(L: Live, x: number, z: number, exp: number, who: number, seq: number) {
  // (cella più quelle intorno: lo spaghetto per i bot è "grosso", così non ci passano rasente)
  for (let dz = -1; dz <= 1; dz++)
    for (let dx = -1; dx <= 1; dx++) {
      const c = cellOf(x + dx * CELL, z + dz * CELL);
      if (c < 0) continue;
      L.until[c] = exp;
      L.owner[c] = who;
      L.pieceNo[c] = seq;
    }
  const c = bigOf(x, z);
  if (c >= 0) L.big[c] = exp;
}

// le teste degli altri (dove sono e dove saranno fra poco): anche lì sta per comparire uno spaghetto
let heads: number[] = []; // x, z, vx, vz per ognuno
// quanto spazio libero c'è davanti nella direzione a (fino a "far" metri)
function freeAhead(api: MiniApi<SpagState>, L: Live, x: number, z: number, a: number, far: number, me: number, mySeq: number) {
  const sx = Math.sin(a);
  const sz = Math.cos(a);
  const wall = SPAG.half - 0.9;
  for (let d = 0.6; d <= far; d += 0.3) {
    const px = x + sx * d;
    const pz = z + sz * d;
    if (Math.abs(px) > wall || Math.abs(pz) > wall) return d;
    const c = cellOf(px, pz);
    if (c >= 0 && L.until[c] > api.now && !(L.owner[c] === me && L.pieceNo[c] > mySeq - SPAG.ownSafe)) return d;
    for (let h = 0; h < heads.length; h += 4) {
      const hx = heads[h];
      const hz = heads[h + 1];
      if (Math.abs(hx - px) > 5 || Math.abs(hz - pz) > 5) continue;
      if (segDist(px, pz, hx, hz, hx + heads[h + 2] * 0.7, hz + heads[h + 3] * 0.7) < 1.1) return d;
    }
  }
  return far;
}
// quante celle libere (da 1 m) si raggiungono partendo da (x, z), fino a "cap"
function room(api: MiniApi<SpagState>, L: Live, x: number, z: number, cap: number) {
  const start = bigOf(x, z);
  if (start < 0 || L.big[start] > api.now) return 0;
  const st = ++L.stamp;
  let head = 0;
  let tail = 0;
  L.queue[tail++] = start;
  L.seen[start] = st;
  while (head < tail && tail < cap) {
    const c = L.queue[head++];
    const i = c % BIG;
    const j = (c - i) / BIG;
    for (let k = 0; k < 4; k++) {
      const ni = i + (k === 0 ? 1 : k === 1 ? -1 : 0);
      const nj = j + (k === 2 ? 1 : k === 3 ? -1 : 0);
      if (ni < 1 || nj < 1 || ni >= BIG - 1 || nj >= BIG - 1) continue;
      const n = nj * BIG + ni;
      if (L.seen[n] === st || L.big[n] > api.now) continue;
      L.seen[n] = st;
      L.queue[tail++] = n;
    }
  }
  return tail;
}

function botBrain(api: MiniApi<SpagState>, b: MiniBot) {
  const me = b.body;
  const E = api.ext;
  const M = b.mem as { dir?: number; next?: number; hopAt?: number; oops?: number; oopsTurn?: number };
  const L = live(E);
  const idx = E.ids.indexOf(b.id);
  const mySeq = L.tr[idx]?.seq ?? 0;
  M.dir ??= me.r;
  heads = [];
  // (solo i più svegli pensano a dove andranno gli altri)
  if (b.skill > 0.6) for (const id of api.inGame()) {
    if (id === b.id) continue;
    const p = api.pos(id);
    if (!p || p.y > SPAG.safeY) continue;
    const v = api.vel(id);
    heads.push(p.x, p.z, v.vx, v.vz);
  }
  // i più scarsi ogni tanto fanno una sciocchezza (una curva a caso per un attimo)
  if (api.now < (M.oops ?? 0)) M.dir += M.oopsTurn ?? 0;
  else if (Math.random() < (1 - b.skill) ** 2 * 0.03) {
    M.oops = api.now + api.rand(300, 600);
    M.oopsTurn = api.rand(-0.25, 0.25);
  }
  // i più scarsi ci pensano meno spesso, guardano meno lontano e contano peggio lo spazio
  else if (api.now >= (M.next ?? 0)) {
    // (ogni tanto i più scarsi si distraggono un attimo)
    M.next = api.now + (Math.random() < (1 - b.skill) * 0.2 ? api.rand(150, 450) : 0);
    const far = 3 + b.skill * 6;
    const cap = Math.round(30 + b.skill * 120);
    let best = M.dir;
    let bestS = -1e9;
    let bestFree = 0;
    let bestArea = 0;
    for (let k = -6; k <= 6; k++) {
      const a = M.dir + (k * Math.PI) / 12;
      const free = freeAhead(api, L, me.x, me.z, a, far, idx, mySeq);
      let sc: number;
      let area = 0;
      if (free < 1.1) sc = free - 20;
      else {
        // lo spazio che resta da lì in avanti (più è grande, meglio è: niente vicoli ciechi)
        const step = Math.min(free - 0.5, 2.5);
        const px = me.x + Math.sin(a) * step;
        const pz = me.z + Math.cos(a) * step;
        area = room(api, L, px, pz, cap);
        sc = Math.min(area, cap) * 0.06 + Math.min(free, far) * 0.35 - Math.abs(k) * 0.06 + api.rand(0, 2.2) * (1 - b.skill);
      }
      if (sc > bestS) {
        bestS = sc;
        best = a;
        bestFree = free;
        bestArea = area;
      }
    }
    // strada lunga e libera davanti: ogni tanto i più bravi scattano
    if (bestFree >= far - 0.1 && Math.abs(best - M.dir) < 0.1 && Math.random() < b.skill * 0.01) api.dash(b);
    // niente scampo (o, per i più bravi, sto finendo in un buco piccolo): salto sopra lo spaghetto più vicino,
    // verso dove dall'altra parte c'è posto per atterrare e più spazio
    const pocket = b.skill > 0.55 && bestArea < 30 && bestArea < cap * 0.5;
    if ((bestFree < 1.8 || pocket) && me.ground && api.now >= (M.hopAt ?? 0)) {
      let jumpDir = NaN;
      let jumpHit = 0;
      let jumpRoom = -1;
      for (let k = -4; k <= 4; k++) {
        const a = M.dir + (k * Math.PI) / 12;
        const hit = freeAhead(api, L, me.x, me.z, a, 2.4, idx, mySeq);
        if (hit >= 2.4) continue;
        // dall'altra parte dello spaghetto (oltre la sua "fascia") ci dev'essere posto per atterrare
        const bx = me.x + Math.sin(a) * (hit + 1.2);
        const bz = me.z + Math.cos(a) * (hit + 1.2);
        const land = freeAhead(api, L, bx, bz, a, 2.6, idx, -1e9);
        const wallOk = Math.abs(bx + Math.sin(a) * 2.6) < SPAG.half - 1.2 && Math.abs(bz + Math.cos(a) * 2.6) < SPAG.half - 1.2;
        if (!wallOk || land < 2.5) continue;
        const r = room(api, L, bx + Math.sin(a) * 2.2, bz + Math.cos(a) * 2.2, 200) - Math.abs(k) * 2;
        if (r > jumpRoom) {
          jumpRoom = r;
          jumpDir = a;
          jumpHit = hit;
        }
      }
      if (!Number.isNaN(jumpDir) && jumpRoom > (bestFree < 1.8 ? 8 : bestArea * 2 + 10)) {
        best = jumpDir;
        if (jumpHit >= 0.5 && jumpHit < 1.3 && Math.abs(Math.atan2(Math.sin(jumpDir - M.dir), Math.cos(jumpDir - M.dir))) < 0.3 && Math.random() < 0.3 + b.skill * 0.7) {
          b.input.jump = true;
          M.hopAt = api.now + 800;
        }
      }
    }
    // sterzo un po' alla volta (non a scatti)
    let d = best - M.dir;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    const turn = 0.45 + b.skill * 0.25;
    M.dir += Math.max(-turn, Math.min(turn, d));
  }
  b.input.x = Math.sin(M.dir);
  b.input.z = Math.cos(M.dir);
}

// distanza del punto (px, pz) dal segmento a→b
function segDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const sx = bx - ax;
  const sz = bz - az;
  const l2 = sx * sx + sz * sz;
  const k = l2 > 1e-9 ? Math.max(0, Math.min(1, ((px - ax) * sx + (pz - az) * sz) / l2)) : 0;
  return Math.hypot(px - ax - sx * k, pz - az - sz * k);
}

registerServerMini<SpagState>({
  kind: 'SPAGHETTO',
  ends: 'last',
  init: (api) => {
    const ids = api.ids();
    return { ids, life: spagLife(ids.length), fresh: [], sentAt: 0 };
  },
  spawn: (_api, _id, i, n) => {
    // in cerchio, girati verso fuori e tutti un po' nello stesso verso (a spirale: le strade non si incrociano)
    const a = (i / n) * Math.PI * 2;
    const R = 7.5;
    return { x: Math.sin(a) * R, y: 0, z: Math.cos(a) * R, r: a + Math.PI / 4 };
  },
  tick(api) {
    const E = api.ext;
    const now = api.now;
    const L = live(E);
    let changed = false;
    // i pezzi nuovi di spaghetto (uno ogni mezzo metro esatto) e quelli che spariscono
    E.ids.forEach((id, k) => {
      const T = L.tr[k];
      while (T.from < T.ts.length && now - T.ts[T.from] > E.life) T.from++;
      if (T.from > 256) {
        T.xs.splice(0, T.from);
        T.zs.splice(0, T.from);
        T.ts.splice(0, T.from);
        T.from = 0;
      }
      if (!api.alive(id)) return;
      const p = api.pos(id);
      if (!p) return;
      if (T.xs.length === 0) {
        T.xs.push(p.x);
        T.zs.push(p.z);
        T.ts.push(now);
        T.seq++;
        E.fresh.push(k, Math.round(p.x * 10), Math.round(p.z * 10));
        return;
      }
      for (let guard = 0; guard < 12; guard++) {
        const lx = T.xs[T.xs.length - 1];
        const lz = T.zs[T.zs.length - 1];
        const d = Math.hypot(p.x - lx, p.z - lz);
        if (d < SPAG.step) break;
        // (un salto enorme, es. una ripartenza: la scia ricomincia da qui)
        const jump = d > 4;
        const nx = jump ? p.x : lx + ((p.x - lx) / d) * SPAG.step;
        const nz = jump ? p.z : lz + ((p.z - lz) / d) * SPAG.step;
        T.xs.push(nx);
        T.zs.push(nz);
        T.ts.push(now);
        T.seq++;
        mark(L, nx, nz, now + E.life, k, T.seq);
        E.fresh.push(k, Math.round(nx * 10), Math.round(nz * 10));
        if (jump) break;
      }
    });
    // chi tocca uno spaghetto (stando giù) o il bordo è fuori
    for (const id of api.inGame()) {
      const p = api.pos(id);
      if (!p) continue;
      const o = L.prev[id] ?? { x: p.x, z: p.z };
      L.prev[id] = { x: p.x, z: p.z };
      if (spagWall(p.x, p.z)) {
        api.eliminate(id, 'muro');
        changed = true;
        continue;
      }
      if (p.y > SPAG.safeY || api.dodging(id)) continue;
      const me = E.ids.indexOf(id);
      let by = -1;
      for (let k = 0; k < L.tr.length && by < 0; k++) {
        const T = L.tr[k];
        // (il mio ultimo metro e mezzo non conta; degli altri non conta la punta appena fatta: la testa che passa)
        let end = k === me ? T.xs.length - SPAG.ownSafe : T.xs.length;
        if (k !== me) while (end > T.from && now - T.ts[end - 1] < SPAG.fresh) end--;
        for (let i = T.from; i < end; i++) {
          const x = T.xs[i];
          const z = T.zs[i];
          if (Math.abs(x - p.x) > 3 || Math.abs(z - p.z) > 3) continue;
          if (segDist(x, z, o.x, o.z, p.x, p.z) < SPAG.hitR) {
            by = k;
            break;
          }
        }
      }
      if (by >= 0) {
        api.emit({ k: 'sp_hit', id, by: E.ids[by], x: p.x, z: p.z });
        api.eliminate(id, by === me ? 'suo' : 'spaghetto');
        changed = true;
      }
    }
    // i pezzi nuovi a tutti (insieme, un paio di volte per giro)
    if (E.fresh.length && now - E.sentAt >= 120) {
      E.sentAt = now;
      api.emit({ k: 'sp', d: E.fresh });
      E.fresh = [];
    }
    return changed;
  },
  bot: botBrain,
  // (con autoRun i bot correrebbero anche durante l'introduzione: fermi finché non si gioca)
  speed: (api) => (api.stage === 'PLAY' ? 1 : 0),
  view: (api) => ({
    ids: api.ext.ids,
    life: api.ext.life,
    // le scie recenti, compatte (servono a chi si collega a metà): punto di partenza + una lettera per pezzo,
    // più l'età del primo e dell'ultimo pezzo (decimi di secondo)
    tr: live(api.ext).tr.map((T) => (T.ts.length > T.from ? `${encodeTrail(T.xs, T.zs, T.from)},${Math.round((api.now - T.ts[T.from]) / 100)},${Math.round((api.now - T.ts[T.ts.length - 1]) / 100)}` : '')),
  }),
});

