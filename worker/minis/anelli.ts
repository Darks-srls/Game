// 🧅 Anelli di cipolla (server): gli anelli da prendere, i trampolini dei bot, i punti, i bot che volano
import { ANELLI, PADS, SPOTS, padAt, ringFace, throughRing } from '../../src/data/minis/anelli';
import { PHYS } from '../../src/data/party3d';
import { registerServerMini, type MiniApi, type MiniBot } from './types';

interface Ring {
  s: number; // posto (SPOTS)
  g: boolean; // d'oro
  at: number; // da quando è attivo (ms): prima si vede solo dove comparirà
}
interface AnelliState {
  rings: Ring[];
  score: Record<string, number>;
  prev: Record<string, { x: number; y: number; z: number }>; // centro del corpo al giro prima
  sentAt: number;
}

const DT = 1 / 15;
const NORMAL = SPOTS.map((s, i) => (s.gold ? -1 : i)).filter((i) => i >= 0);
const GOLD = SPOTS.map((s, i) => (s.gold ? i : -1)).filter((i) => i >= 0);

// un posto libero per un anello (lontano dagli altri e da dov'era)
function freeSpot(api: MiniApi<AnelliState>, gold: boolean, from: number) {
  const list = gold ? GOLD : NORMAL;
  const busy = api.ext.rings.map((r) => r.s);
  for (let k = 0; k < 40; k++) {
    const s = list[Math.floor(Math.random() * list.length)];
    if (s === from || busy.includes(s)) continue;
    const S = SPOTS[s];
    if (api.ext.rings.some((r) => r.s >= 0 && Math.hypot(SPOTS[r.s].x - S.x, SPOTS[r.s].z - S.z) < 3 && Math.abs(SPOTS[r.s].y - S.y) < 2.5)) continue;
    if (from >= 0 && Math.hypot(SPOTS[from].x - S.x, SPOTS[from].z - S.z) < 4) continue;
    return s;
  }
  return list.find((s) => !busy.includes(s)) ?? list[0];
}

// salto simulato a passi come la fisica dei bot: quota più alta dei piedi (sopra lo stacco), con o senza doppio salto
function apex(v0: number, dj: boolean) {
  let y = 0;
  let vy = v0;
  let used = !dj;
  let best = 0;
  for (let k = 0; k < 90; k++) {
    if (!used && vy < 1.2) {
      vy = PHYS.jumpV * PHYS.doubleJump;
      used = true;
    }
    vy -= PHYS.gravity * DT;
    y += vy * DT;
    best = Math.max(best, y);
    if (vy < 0 && y < 0) break;
  }
  return best;
}
// quanto ci vuole a salire (piedi) fino a h sopra lo stacco (null = non ci arrivo senza doppio)
function riseTime(v0: number, h: number) {
  let y = 0;
  let vy = v0;
  for (let k = 1; k < 90; k++) {
    vy -= PHYS.gravity * DT;
    y += vy * DT;
    if (y >= h) return k * DT;
    if (vy < 0) return null;
  }
  return null;
}
const PAD_TOP = PADS.map((p) => ({ single: p.h + apex(p.v, false), double: p.h + apex(p.v, true) }));
const GROUND_TOP = { single: apex(PHYS.jumpV, false), double: apex(PHYS.jumpV, true) };

// ---------------------------------------------------------------- bot

interface Mem {
  ring: number; // anello che inseguo (indice in rings), -1 nessuno
  s: number; // il suo posto (se cambia, ci ripenso)
  thinkAt: number;
  side: number; // da che lato attraverso gli anelli in piedi
  dj: boolean;
  off: { x: number; z: number };
}

function pickRing(api: MiniApi<AnelliState>, b: MiniBot, M: Mem) {
  const me = b.body;
  const E = api.ext;
  const vMax = PHYS.speed * (0.85 + b.skill * 0.2);
  let best = -1;
  let bestV = -1;
  E.rings.forEach((r, i) => {
    if (api.now < r.at - 600) return;
    const S = SPOTS[r.s];
    const need = S.y - ANELLI.body;
    // ci arrivo? (da terra o dal mio trampolino)
    const top = S.pad >= 0 ? PAD_TOP[S.pad].double : GROUND_TOP.double;
    if (need > top + 0.9) return;
    const from = S.pad >= 0 ? PADS[S.pad] : S;
    const d = Math.hypot(from.x - me.x, from.z - me.z);
    let v = (r.g ? 3 : 1) / (d / vMax + 1.6 + (S.flat ? 0 : 0.8));
    // qualcuno è molto più vicino: lascio perdere (i più bravi lo capiscono meglio)
    for (const id of api.ids()) {
      if (id === b.id) continue;
      const p = api.pos(id);
      if (p && Math.hypot(p.x - from.x, p.z - from.z) < d * 0.5 && Math.random() < b.skill) v *= 0.45;
    }
    v *= 1 + api.rand(-0.5, 0.5) * (1.1 - b.skill);
    if (v > bestV) {
      bestV = v;
      best = i;
    }
  });
  M.ring = best;
  M.s = best >= 0 ? E.rings[best].s : -1;
  M.side = Math.random() < 0.5 ? 1 : -1;
  M.dj = false;
  const sl = (1 - b.skill) * 0.8;
  M.off = { x: api.rand(-sl, sl), z: api.rand(-sl, sl) };
  M.thinkAt = api.now + api.rand(1500, 3000);
}

function botBrain(api: MiniApi<AnelliState>, b: MiniBot) {
  const me = b.body;
  const E = api.ext;
  const t = api.t;
  const M = b.mem as Mem;
  if (M.ring === undefined) {
    M.ring = -1;
    M.s = -1;
    M.thinkAt = 0;
  }
  const vMax = PHYS.speed * (0.85 + b.skill * 0.2);
  const R = M.ring >= 0 ? E.rings[M.ring] : null;
  if (!R || R.s !== M.s || (me.ground && api.now >= M.thinkAt)) pickRing(api, b, M);
  const ring = M.ring >= 0 ? E.rings[M.ring] : null;
  // schiaffo a chi mi sta addosso sui trampolini
  if (Math.random() < 0.025 * b.skill) {
    for (const id of api.ids()) {
      if (id === b.id) continue;
      const p = api.pos(id);
      if (p && Math.abs(p.y - me.y) < 1.2 && Math.hypot(p.x - me.x, p.z - me.z) < PHYS.pushRange - 0.5) {
        api.push(b, p.x, p.z);
        break;
      }
    }
  }
  if (!ring) {
    // niente da prendere: verso il centro
    api.go(b, 0, 0, 0.5);
    return;
  }
  const S = SPOTS[ring.s];
  const cy = me.y + ANELLI.body;
  if (S.flat) {
    // sdraiato sopra un trampolino: ci salgo, rimbalzo e resto sotto il centro
    const P = PADS[S.pad];
    if (me.ground) {
      api.go(b, P.x + M.off.x * 0.5, P.z + M.off.z * 0.5);
      return;
    }
    const dx = S.x + M.off.x * 0.4 - me.x;
    const dz = S.z + M.off.z * 0.4 - me.z;
    const d = Math.hypot(dx, dz);
    const want = Math.min(1, d / 1.2);
    b.input.x = (dx / (d || 1)) * want;
    b.input.z = (dz / (d || 1)) * want;
    // il doppio salto quando serve per arrivarci (vicino all'apice)
    const peak = cy + (me.vy > 0 ? (me.vy * me.vy) / (2 * PHYS.gravity) : 0);
    if (!M.dj && (me.airJumps ?? 0) < 1 && me.vy < 1.5 && me.vy > -4 && peak < S.y + 0.4 && api.now >= ring.at) {
      if (Math.random() < 0.5 + b.skill * 0.5) b.input.jump = true;
      M.dj = true;
    }
    return;
  }
  // in piedi: lo attraverso di lato, lungo la faccia (che gira)
  const f = ringFace(S.ph, t);
  let nx = Math.sin(f);
  let nz = Math.cos(f);
  if (S.pad < 0) {
    // basso sul prato: rincorsa da 4 m, salto quando manca la distanza giusta
    const side = (me.x - S.x) * nx + (me.z - S.z) * nz >= 0 ? 1 : -1;
    const ax = S.x + nx * side * 4.2;
    const az = S.z + nz * side * 4.2;
    if (me.ground) {
      const lat = Math.abs((me.x - S.x) * nz - (me.z - S.z) * nx); // fuori asse
      const along = Math.abs((me.x - S.x) * nx + (me.z - S.z) * nz);
      if (lat > 0.5 || along > 4.6) api.go(b, ax, az);
      else {
        api.go(b, S.x, S.z);
        const tJ = riseTime(PHYS.jumpV, Math.max(0.3, S.y - ANELLI.body - 0.2)) ?? 0.33;
        if (along < vMax * tJ + 0.3 + api.rand(-0.4, 0.4) * (1 - b.skill)) {
          b.input.jump = true;
          M.dj = S.y - ANELLI.body > GROUND_TOP.single - 0.1;
        }
      }
    } else {
      api.go(b, S.x, S.z);
      if (M.dj && me.vy < 1.2 && (me.airJumps ?? 0) < 1) {
        b.input.jump = true;
        M.dj = false;
      }
    }
    return;
  }
  // alto, vicino a un trampolino: ci arrivo di corsa (la velocità che ho quando salgo sul trampolino resta)
  const P = PADS[S.pad];
  const ux = S.x - P.x;
  const uz = S.z - P.z;
  const ud = Math.hypot(ux, uz) || 1;
  const dirx = ux / ud;
  const dirz = uz / ud;
  // la faccia deve guardare più o meno da dove arrivo (se no aspetto che giri)
  if (nx * dirx + nz * dirz < 0) {
    nx = -nx;
    nz = -nz;
  }
  const aligned = nx * dirx + nz * dirz > 0.55;
  if (me.ground) {
    const onPad = padAt(me.x, me.z, me.y) === S.pad;
    // punto di partenza: dietro il trampolino, sulla retta verso l'anello
    const sx = P.x - dirx * (P.r + 2.2);
    const sz = P.z - dirz * (P.r + 2.2);
    const lat = Math.abs((me.x - P.x) * dirz - (me.z - P.z) * dirx);
    const behind = (me.x - P.x) * dirx + (me.z - P.z) * dirz < -P.r;
    if (onPad) {
      api.go(b, S.x, S.z);
      return;
    }
    if (!behind || lat > 0.6) {
      api.go(b, sx, sz);
      return;
    }
    if (!aligned) return; // aspetto che l'anello si giri
    // velocità giusta: arrivare all'anello mentre il corpo è alla sua quota
    const tUp = riseTime(P.v, Math.max(0.5, S.y - ANELLI.body - P.h)) ?? 0.6;
    const speed = Math.min(1, ud / tUp / vMax) * (1 + api.rand(-0.15, 0.15) * (1 - b.skill));
    api.go(b, P.x, P.z, Math.max(0.35, speed));
    return;
  }
  // in volo: correggo verso il centro dell'anello
  const dx = S.x + M.off.x * 0.3 - me.x;
  const dz = S.z + M.off.z * 0.3 - me.z;
  const d = Math.hypot(dx, dz);
  if (d > 0.4) {
    b.input.x = dx / d;
    b.input.z = dz / d;
  }
  const peak = cy + (me.vy > 0 ? (me.vy * me.vy) / (2 * PHYS.gravity) : 0);
  if (!M.dj && (me.airJumps ?? 0) < 1 && me.vy < 1.5 && peak < S.y - 0.3 && Math.random() < 0.4 + b.skill * 0.6) {
    b.input.jump = true;
    M.dj = true;
  }
}

// ---------------------------------------------------------------- il minigioco

registerServerMini<AnelliState>({
  kind: 'ANELLI',
  ends: 'time',
  falls: 'none',
  init: () => ({ rings: [], score: {}, prev: {}, sentAt: 0 }),
  spawn: (_api, _id, i, n) => {
    const a = (i / n) * Math.PI * 2;
    return { x: Math.sin(a) * 14.5, y: 0, z: Math.cos(a) * 14.5, r: a + Math.PI };
  },
  play: (api) => {
    const n = api.ids().length;
    const count = Math.min(10, 4 + Math.ceil(n / 2));
    const gold = count >= 6 ? 2 : 1;
    const E = api.ext;
    for (let k = 0; k < count; k++) {
      const g = k < gold;
      E.rings.push({ s: -1, g, at: api.now });
      E.rings[k].s = freeSpot(api, g, -1);
    }
  },
  tick(api) {
    const E = api.ext;
    const t = api.t;
    let changed = false;
    for (const id of api.ids()) {
      const p = api.pos(id);
      if (!p || !api.alive(id)) continue;
      const c = { x: p.x, y: p.y + ANELLI.body, z: p.z };
      const o = E.prev[id];
      E.prev[id] = c;
      if (!o || Math.hypot(c.x - o.x, c.y - o.y, c.z - o.z) > 5) continue;
      for (let i = 0; i < E.rings.length; i++) {
        const r = E.rings[i];
        if (api.now < r.at) continue;
        const S = SPOTS[r.s];
        if (!throughRing(S, t, o.x, o.y, o.z, c.x, c.y, c.z, ANELLI.pass)) continue;
        // preso! punti e l'anello ricompare altrove (si vede prima dove)
        const pts = r.g ? 3 : 1;
        E.score[id] = (E.score[id] ?? 0) + pts;
        api.emit({ k: 'an_take', id, i, g: r.g, pts, x: S.x, y: S.y, z: S.z });
        r.s = freeSpot(api, r.g, r.s);
        r.at = api.now + ANELLI.respawn;
        changed = true;
      }
    }
    // i trampolini lanciano i bot (il mio personaggio lo lancia il mio telefono)
    for (const b of api.bots) {
      if (!api.alive(b.id) || !b.body.ground) continue;
      const i = padAt(b.body.x, b.body.z, b.body.y);
      if (i < 0 || Math.abs(b.body.y - PADS[i].h) > 0.05) continue;
      b.body.vy = PADS[i].v;
      b.body.ground = false;
      b.body.airJumps = 0;
      b.mem.dj = false;
    }
    if (api.now - E.sentAt > 500) {
      E.sentAt = api.now;
      api.emit({ k: 'an_score', s: E.score });
    }
    return changed;
  },
  bot: botBrain,
  rank: (api) => {
    // più punti = più in alto (pari merito nello stesso gruppo)
    const groups = new Map<number, string[]>();
    for (const id of api.ids()) {
      const v = api.ext.score[id] ?? 0;
      groups.set(v, [...(groups.get(v) ?? []), id]);
    }
    return [...groups.entries()].sort((a, b) => b[0] - a[0]).map(([, ids]) => ids);
  },
  view: (api) => ({
    rings: api.ext.rings.map((r) => [r.s, r.g ? 1 : 0, r.at]),
    score: api.ext.score,
  }),
});
