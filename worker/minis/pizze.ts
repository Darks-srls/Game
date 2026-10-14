// 🍕 Pizza express (server): il forno che sforna, chi prende, chi consegna, gli schiaffi che fanno cadere la pizza, i bot camerieri
import { PIZ, PIZ_OBST, PIZ_SLOTS, PIZ_TABLES } from '../../src/data/minis/pizze';
import { PHYS } from '../../src/data/party3d';
import { registerServerMini, type MiniApi, type MiniBot } from './types';

interface Pizza {
  i: number;
  d: number; // tavolo di destinazione
  s: 0 | 1 | 2; // 0 sul bancone, 1 in mano a qualcuno, 2 per terra
  slot: number; // piedistallo (sul bancone)
  by: string | null; // chi la porta
  x: number; // per terra: dove
  z: number;
  fx: number; // per terra: da dove è volata
  fz: number;
  at: number; // presa (in mano) · atterraggio (per terra)
  hot: number; // quando è stata presa dal bancone la prima volta (la pizza calda vale il bonus): 0 = ancora sul bancone
}
interface PizState {
  pz: Pizza[];
  next: number;
  refill: number[]; // quando il forno rimette una pizza su ogni piedistallo
  pts: Record<string, number>;
  dl: Record<string, number>; // consegne
  noPick: Record<string, { i: number; until: number }>; // chi ha appena perso la pizza non la riprende subito
  trk: Record<string, { x: number; z: number; t: number; vx: number; vz: number }>;
  t0: number;
  syncAt: number;
  dirty: boolean;
}
type Api = MiniApi<PizState>;

const r1 = (v: number) => Math.round(v * 10) / 10;

// un punto libero per terra (dentro le pareti, fuori da forno, tavoli e vasi)
function fit(x: number, z: number) {
  const m = PIZ.half - 0.8;
  x = Math.max(-m, Math.min(m, x));
  z = Math.max(-m, Math.min(m, z));
  for (const o of PIZ_OBST) {
    const dx = x - o.x;
    const dz = z - o.z;
    const d = Math.hypot(dx, dz);
    const min = o.r + 0.6;
    if (d < min) {
      const k = d > 0.01 ? min / d : 0;
      x = o.x + (k ? dx * k : min);
      z = o.z + (k ? dz * k : 0);
    }
  }
  return { x, z };
}

const carrying = (E: PizState, id: string) => E.pz.find((p) => p.s === 1 && p.by === id);

function newPizza(api: Api, slot: number) {
  const E = api.ext;
  const used = new Set(E.pz.map((p) => p.d));
  const free = PIZ_TABLES.map((_, k) => k).filter((k) => !used.has(k));
  const pool = free.length ? free : PIZ_TABLES.map((_, k) => k);
  const d = pool[Math.floor(Math.random() * pool.length)];
  const s = PIZ_SLOTS[slot];
  const p: Pizza = { i: E.next++, d, s: 0, slot, by: null, x: s.x, z: s.z, fx: s.x, fz: s.z, at: api.now, hot: 0 };
  E.pz.push(p);
  E.dirty = true;
  api.emit({ k: 'pz_new', i: p.i, slot, d });
}

function velOf(api: Api, id: string) {
  if (api.bot(id)) return api.vel(id);
  const t = api.ext.trk[id];
  return t ? { vx: t.vx, vz: t.vz } : { vx: 0, vz: 0 };
}

// ---------------------------------------------------------------- bot

// direzione verso (dx, dz) girando intorno a forno, tavoli e vasi (non a quello che si vuole raggiungere)
function steer(x: number, z: number, dx: number, dz: number, skip = -1) {
  let l = Math.hypot(dx, dz) || 1;
  const ux = dx / l;
  const uz = dz / l;
  let ax = ux;
  let az = uz;
  for (let k = 0; k < PIZ_OBST.length; k++) {
    if (k === skip) continue;
    const o = PIZ_OBST[k];
    const ox = o.x - x;
    const oz = o.z - z;
    const along = ox * ux + oz * uz;
    if (along < -0.3 || along > Math.min(4.2, l + o.r)) continue;
    const perp = ox * uz - oz * ux;
    const clear = o.r + PHYS.radius + 0.45;
    if (Math.abs(perp) >= clear) continue;
    const kk = ((clear - Math.abs(perp)) / clear) * (1.3 - Math.max(0, along) / 4.2) * 2.2;
    const s = perp > 0 ? -1 : 1;
    ax += uz * s * kk;
    az += -ux * s * kk;
  }
  l = Math.hypot(ax, az) || 1;
  return { x: ax / l, z: az / l };
}

function unstick(api: Api, b: MiniBot, dir: { x: number; z: number }) {
  const m = b.mem;
  const me = b.body;
  if (!m.chk || api.now - m.chk.t > 700) {
    if (m.chk && Math.hypot(me.x - m.chk.x, me.z - m.chk.z) < 0.5) {
      const s = Math.random() < 0.5 ? 1 : -1;
      m.side = { until: api.now + 600, x: dir.z * s, z: -dir.x * s };
    }
    m.chk = { x: me.x, z: me.z, t: api.now };
  }
  if (m.side && api.now < m.side.until) return { x: m.side.x * 0.85 + dir.x * 0.15, z: m.side.z * 0.85 + dir.z * 0.15 };
  return dir;
}

function botBrain(api: Api, b: MiniBot) {
  const E = api.ext;
  const me = b.body;
  const now = api.now;
  const v = PHYS.speed * (0.85 + b.skill * 0.2);
  const mine = carrying(E, b.id);
  // chi ha la pizza: al tavolo giusto, scansando chi lo insegue
  if (mine) {
    const T = PIZ_TABLES[mine.d];
    let dir = steer(me.x, me.z, T.x - me.x, T.z - me.z, 4 + mine.d);
    let threat = Infinity;
    const base = dir;
    let sx = 0;
    let sz = 0;
    for (const id of api.inGame()) {
      if (id === b.id || carrying(E, id)) continue;
      const p = api.pos(id);
      if (!p) continue;
      const rx = p.x - me.x;
      const rz = p.z - me.z;
      const d = Math.hypot(rx, rz);
      if (d > 4.5 || d < 0.01) continue;
      threat = Math.min(threat, d);
      // chi mi sbarra la strada: lo scarto di lato (i più bravi prima e meglio); chi è dietro lo semino con lo scatto
      const ahead = (rx * base.x + rz * base.z) / d;
      if (ahead < -0.2) continue;
      const side = rx * base.z - rz * base.x > 0 ? -1 : 1; // dalla parte opposta a lui
      const w = b.skill * ((4.5 - d) / 4.5) * 1.3 * (0.4 + ahead * 0.6);
      sx += base.z * side * w;
      sz += -base.x * side * w;
    }
    const l = Math.hypot(base.x + sx, base.z + sz) || 1;
    dir = unstick(api, b, { x: (base.x + sx) / l, z: (base.z + sz) / l });
    b.input.x = dir.x;
    b.input.z = dir.z;
    // scatto (si schiva anche lo schiaffo) quando un inseguitore arriva a tiro: i più bravi al momento giusto
    if (threat < 2.4 && now >= b.reactAt) {
      b.reactAt = now + 150;
      if (Math.random() < 0.05 + b.skill * b.skill * 0.6) api.dash(b);
    }
    return;
  }
  // senza pizza: la più comoda tra bancone e pavimento, oppure la rubo a chi la porta
  if (now >= b.thinkAt || !b.mem.goal) {
    b.thinkAt = now + api.rand(260, 600) * (1.4 - b.skill * 0.6);
    const others = api.inGame().filter((id) => id !== b.id);
    let best: { kind: 'pz' | 'steal'; id: string | number; s: number } | null = null;
    for (const p of E.pz) {
      if (p.s === 1) continue;
      if (p.s === 2 && E.noPick[b.id]?.i === p.i && E.noPick[b.id].until > now) continue;
      const px = p.s === 0 ? PIZ_SLOTS[p.slot].x : p.x;
      const pz = p.s === 0 ? PIZ_SLOTS[p.slot].z : p.z;
      const d = Math.hypot(px - me.x, pz - me.z);
      let rival = Infinity;
      for (const id of others) {
        if (carrying(E, id)) continue;
        const q = api.pos(id);
        if (q) rival = Math.min(rival, Math.hypot(q.x - px, q.z - pz));
      }
      const contest = rival < d - 1 ? 0.3 + (1 - b.skill) * 0.5 : 1;
      let s = contest / (d / v + 0.6);
      if (b.mem.goal?.kind === 'pz' && b.mem.goal.id === p.i) s *= 1.25;
      s *= 1 + (Math.random() - 0.5) * (1 - b.skill) * 0.6;
      if (!best || s > best.s) best = { kind: 'pz', id: p.i, s };
    }
    const greed = 0.3 + b.skill * 0.3; // voglia di rubare
    for (const id of others) {
      const p = api.pos(id);
      const c = carrying(E, id);
      if (!p || !c) continue;
      const d = Math.hypot(p.x - me.x, p.z - me.z);
      if (d > 6.5) continue;
      const T = PIZ_TABLES[c.d];
      const left = Math.hypot(T.x - p.x, T.z - p.z); // se è quasi al tavolo non lo prendo più
      if (left < d * 0.7) continue;
      let s = (greed * 0.9) / (d / v + 0.9);
      if (b.mem.goal?.kind === 'steal' && b.mem.goal.id === id) s *= 1.3;
      if (!best || s > best.s) best = { kind: 'steal', id, s };
    }
    b.mem.goal = best;
  }
  const goal = b.mem.goal as { kind: 'pz' | 'steal'; id: string | number } | null;
  let gx = 0;
  let gz = 0;
  let skip = -1;
  let target: { x: number; z: number } | null = null;
  if (goal?.kind === 'pz') {
    const p = E.pz.find((x) => x.i === goal.id && x.s !== 1);
    if (!p) {
      b.mem.goal = null;
      return;
    }
    if (p.s === 0) {
      // al piedistallo ci si arriva da fuori (dal lato opposto al forno)
      const s = PIZ_SLOTS[p.slot];
      const r = Math.hypot(s.x, s.z);
      gx = s.x + (s.x / r) * 0.9;
      gz = s.z + (s.z / r) * 0.9;
      skip = 1 + p.slot;
    } else {
      gx = p.x;
      gz = p.z;
    }
  } else if (goal?.kind === 'steal') {
    const id = goal.id as string;
    const p = api.pos(id);
    if (!p || !carrying(E, id)) {
      b.mem.goal = null;
      return;
    }
    const vv = velOf(api, id);
    const d = Math.hypot(p.x - me.x, p.z - me.z);
    const lead = Math.min(0.9, d / 7) * b.skill;
    gx = p.x + vv.vx * lead;
    gz = p.z + vv.vz * lead;
    if (d < 2) {
      gx = p.x;
      gz = p.z;
    }
    target = p;
  } else {
    // niente da fare: mi avvicino al forno (da fuori)
    gx = Math.sin(b.skill * 20) * 5.5;
    gz = Math.cos(b.skill * 20) * 5.5;
  }
  const d = Math.hypot(gx - me.x, gz - me.z);
  if (d > 0.25) {
    const dir = unstick(api, b, steer(me.x, me.z, gx - me.x, gz - me.z, skip));
    b.input.x = dir.x;
    b.input.z = dir.z;
  }
  if (target && d > 2.5 && d < 5.5 && Math.random() < 0.03 * b.skill) api.dash(b);
  // schiaffo a chi porta una pizza ed è a tiro (anche se non era il piano)
  if (now >= b.reactAt) {
    b.reactAt = now + api.rand(120, 380) * (1.5 - b.skill);
    for (const id of api.inGame()) {
      if (id === b.id || !carrying(E, id)) continue;
      const p = api.pos(id);
      if (!p || Math.abs(p.y - me.y) > 1.5 || Math.hypot(p.x - me.x, p.z - me.z) > PHYS.pushRange - 0.45) continue;
      if (Math.random() < 0.1 + b.skill * 0.6) api.push(b, p.x, p.z);
      break;
    }
  }
}

registerServerMini<PizState>({
  kind: 'PIZZE',
  ends: 'time',
  falls: 'none',
  init: (api) => ({ pz: [], next: 1, refill: [0, 0, 0], pts: {}, dl: {}, noPick: {}, trk: {}, t0: api.now, syncAt: 0, dirty: false }),
  // in cerchio tra il forno e i tavoli, girati verso il forno
  spawn: (_api, _id, i, n) => {
    const a = (i / n) * Math.PI * 2 + Math.PI / 6;
    return { x: Math.sin(a) * 7.3, y: 0, z: Math.cos(a) * 7.3, r: a + Math.PI };
  },
  play: (api) => {
    const E = api.ext;
    E.t0 = api.now;
    newPizza(api, 0);
    newPizza(api, 1);
    E.refill = [0, 0, api.now + 2000];
  },
  tick(api) {
    const E = api.ext;
    const now = api.now;
    // il forno rimette le pizze sul bancone
    for (let k = 0; k < PIZ_SLOTS.length; k++) {
      if (E.pz.some((p) => p.s === 0 && p.slot === k)) continue;
      if (!E.refill[k]) E.refill[k] = now + api.rand(1500, 2500);
      else if (now >= E.refill[k]) {
        E.refill[k] = 0;
        newPizza(api, k);
      }
    }
    // posizioni (e velocità stimata dei giocatori veri, per i bot che rubano)
    const ids = api.inGame();
    const pos = new Map<string, { x: number; y: number; z: number }>();
    for (const id of ids) {
      const p = api.pos(id);
      if (!p) continue;
      if (p.y < PHYS.fallOut) api.teleport(id, { x: 0, y: 0, z: 6 });
      pos.set(id, p);
      if (!api.bot(id)) {
        const t = E.trk[id];
        if (!t) E.trk[id] = { x: p.x, z: p.z, t: now, vx: 0, vz: 0 };
        else if (p.x !== t.x || p.z !== t.z || now - t.t > 300) {
          const h = Math.max(0.03, (now - t.t) / 1000);
          t.vx = t.vx * 0.4 + ((p.x - t.x) / h) * 0.6;
          t.vz = t.vz * 0.4 + ((p.z - t.z) / h) * 0.6;
          t.x = p.x;
          t.z = p.z;
          t.t = now;
        }
      }
    }
    const done: number[] = [];
    for (const pz of E.pz) {
      if (pz.s === 1) {
        // in mano: chi esce la lascia cadere; al tavolo giusto è consegnata
        const p = pz.by ? pos.get(pz.by) : undefined;
        if (!pz.by || !api.alive(pz.by) || !p) {
          const q = fit(pz.x, pz.z);
          Object.assign(pz, { s: 2, by: null, x: q.x, z: q.z, fx: q.x, fz: q.z, at: now });
          E.dirty = true;
          continue;
        }
        pz.x = p.x;
        pz.z = p.z;
        const T = PIZ_TABLES[pz.d];
        if (Math.hypot(p.x - T.x, p.z - T.z) < PIZ.deliver && p.y < 2.5) {
          const fast = now - pz.hot <= PIZ.bonusMs;
          const pts = PIZ.points + (fast ? PIZ.bonus : 0);
          E.pts[pz.by] = (E.pts[pz.by] ?? 0) + pts;
          E.dl[pz.by] = (E.dl[pz.by] ?? 0) + 1;
          api.emit({ k: 'pz_deliver', i: pz.i, by: pz.by, d: pz.d, pts, fast });
          done.push(pz.i);
          E.dirty = true;
        }
        continue;
      }
      if (pz.s === 2 && now - pz.at > PIZ.groundMs) {
        // per terra da troppo: torna al forno
        api.emit({ k: 'pz_back', i: pz.i, x: r1(pz.x), z: r1(pz.z) });
        done.push(pz.i);
        E.dirty = true;
        continue;
      }
      if (pz.s === 2 && now < pz.at) continue; // sta ancora volando
      // la prende chi la tocca (se in due, il più vicino)
      const px = pz.s === 0 ? PIZ_SLOTS[pz.slot].x : pz.x;
      const pzz = pz.s === 0 ? PIZ_SLOTS[pz.slot].z : pz.z;
      const reach = pz.s === 0 ? PIZ.grab : PIZ.groundGrab;
      let best: string | null = null;
      let bestD = reach;
      for (const [id, p] of pos) {
        if (p.y > 1.8 || carrying(E, id)) continue;
        const np = E.noPick[id];
        if (np && np.i === pz.i && np.until > now) continue;
        const d = Math.hypot(p.x - px, p.z - pzz);
        if (d < bestD) {
          bestD = d;
          best = id;
        }
      }
      if (best) {
        Object.assign(pz, { s: 1, by: best, at: now, hot: pz.hot || now });
        api.emit({ k: 'pz_take', i: pz.i, by: best, d: pz.d });
        E.dirty = true;
      }
    }
    if (done.length) E.pz = E.pz.filter((p) => !done.includes(p.i));
    if (E.dirty && now - E.syncAt > 150) {
      E.dirty = false;
      E.syncAt = now;
      return true;
    }
    return false;
  },
  // lo schiaffo normale spinge; in più chi porta una pizza la fa cadere (vola qualche metro più in là)
  onPush(api, by, hit) {
    const E = api.ext;
    const from = api.pos(by);
    for (const id of hit) {
      const pz = carrying(E, id);
      const p = api.pos(id);
      if (!pz || !p) continue;
      let dx = from ? p.x - from.x : 0;
      let dz = from ? p.z - from.z : 1;
      const l = Math.hypot(dx, dz) || 1;
      dx /= l;
      dz /= l;
      const dist = api.rand(2.4, 3.4);
      const q = fit(p.x + dx * dist + api.rand(-0.6, 0.6), p.z + dz * dist + api.rand(-0.6, 0.6));
      Object.assign(pz, { s: 2, by: null, x: q.x, z: q.z, fx: p.x, fz: p.z, at: api.now + PIZ.flight });
      E.noPick[id] = { i: pz.i, until: api.now + 1200 };
      E.dirty = true;
      api.emit({ k: 'pz_drop', i: pz.i, id, by });
    }
  },
  speed: (api, id) => (carrying(api.ext, id) ? PIZ.carry : 1),
  bot: botBrain,
  rank: (api) => {
    const groups = new Map<number, string[]>();
    for (const id of api.ids()) {
      const n = api.ext.pts[id] ?? 0;
      groups.set(n, [...(groups.get(n) ?? []), id]);
    }
    return [...groups.entries()].sort((a, b) => b[0] - a[0]).map(([, ids]) => ids);
  },
  // pizze compatte: [numero, tavolo, 0, piedistallo] · [numero, tavolo, 1, chi, calda da] · [numero, tavolo, 2, x, z, atterra, da x, da z, calda da]
  view: (api) => {
    const E = api.ext;
    return {
      pz: E.pz.map((p) => (p.s === 0 ? [p.i, p.d, 0, p.slot] : p.s === 1 ? [p.i, p.d, 1, p.by, p.hot - E.t0] : [p.i, p.d, 2, r1(p.x), r1(p.z), p.at - E.t0, r1(p.fx), r1(p.fz), p.hot - E.t0])),
      s: E.pts,
      dl: E.dl,
      t0: E.t0,
    };
  },
});
