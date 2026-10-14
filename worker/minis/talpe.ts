// 🐹 Schiaccia le talpe (server): talpe che spuntano sempre più spesso, chi ci atterra sopra, le bombe, i bot che saltano al momento giusto
import { holeX, holeZ, TALPE } from '../../src/data/minis/talpe';
import { PHYS } from '../../src/data/party3d';
import { registerServerMini, type MiniApi, type MiniBot } from './types';

interface Mole {
  id: number;
  h: number; // buca
  k: number; // 0 normale, 1 d'oro, 2 bomba
  up: number; // quando spunta (ms)
  down: number; // quando torna giù
}
interface TalpeState {
  moles: Mole[];
  next: number;
  spawnAt: number;
  pts: Record<string, number>;
  air: Record<string, number>; // quota più alta raggiunta nel salto in corso
  t0: number;
  sentAt: number;
  syncAt: number;
  dirty: boolean;
}
type Api = MiniApi<TalpeState>;

const HOLES = TALPE.n * TALPE.n;
const AIR = (2 * PHYS.jumpV) / PHYS.gravity; // un salto dura ~0,7 s
const enc = (m: Mole, t0: number) => [m.id, m.h, m.k, m.up - t0, m.down - t0];
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());

function spawnMole(api: Api) {
  const E = api.ext;
  const T = Math.min(1, api.t / 60);
  const busy = new Set(E.moles.map((m) => m.h));
  const ppl = api.inGame().map((id) => api.pos(id));
  // dove non c'è già una talpa e nessuno ci sta sopra (niente talpe gratis sotto i piedi)
  let free: number[] = [];
  for (let h = 0; h < HOLES; h++) {
    if (busy.has(h)) continue;
    const near = ppl.some((p) => p && Math.hypot(p.x - holeX(h), p.z - holeZ(h)) < 1.7);
    if (!near) free.push(h);
  }
  if (!free.length) free = [...Array(HOLES).keys()].filter((h) => !busy.has(h));
  if (!free.length) return;
  const h = free[Math.floor(Math.random() * free.length)];
  const r = Math.random();
  const k = r < 0.09 ? 1 : r < 0.09 + lerp(0.1, 0.22, T) ? 2 : 0;
  const dur = lerp(TALPE.upMax, TALPE.upMin, T) * (k === 1 ? 0.85 : 1);
  const m: Mole = { id: E.next++, h, k, up: api.now + TALPE.warn, down: api.now + TALPE.warn + dur };
  E.moles.push(m);
  E.dirty = true;
  api.emit({ k: 'tp_mole', t0: E.t0, m: enc(m, E.t0) });
}

// ---------------------------------------------------------------- bot

function botBrain(api: Api, b: MiniBot) {
  const E = api.ext;
  const me = b.body;
  const now = api.now;
  const vmax = PHYS.speed * (0.85 + b.skill * 0.2);
  // in volo: si tiene la direzione (e la velocità) scelta per il salto
  if (!me.ground) {
    if (b.mem.jdir) {
      b.input.x = b.mem.jdir.x;
      b.input.z = b.mem.jdir.z;
    }
    return;
  }
  b.mem.jdir = null;
  // una bomba sta per scoppiare qui vicino: via
  for (const m of E.moles) {
    if (m.k !== 2 || m.down - now > 600 || m.down < now) continue;
    const dx = me.x - holeX(m.h);
    const dz = me.z - holeZ(m.h);
    const d = Math.hypot(dx, dz);
    if (d < TALPE.boomR + 0.8 && Math.random() < 0.4 + b.skill * 0.6) {
      b.input.x = d > 0.1 ? dx / d : 1;
      b.input.z = d > 0.1 ? dz / d : 0;
      return;
    }
  }
  // scelgo la talpa che riesco a schiacciare prima che sparisca (e che non sia già di un altro più vicino)
  let tgt = E.moles.find((m) => m.id === b.mem.tm);
  if (!tgt || now >= b.thinkAt) {
    b.thinkAt = now + api.rand(180, 420) * (1.4 - b.skill * 0.6);
    const rivals = api
      .inGame()
      .filter((id) => id !== b.id)
      .map((id) => api.pos(id));
    let best: Mole | null = null;
    let bestS = 0;
    for (const m of E.moles) {
      // le bombe si evitano (i meno bravi a volte ci cascano)
      if (m.k === 2) {
        b.mem.fool ??= {};
        if (b.mem.fool[m.id] === undefined) b.mem.fool[m.id] = Math.random() < (1 - b.skill) * 0.3;
        if (!b.mem.fool[m.id]) continue;
      }
      const hx = holeX(m.h);
      const hz = holeZ(m.h);
      const d = Math.hypot(hx - me.x, hz - me.z);
      const land = now + (Math.max(0, d - vmax * AIR * 0.8) / vmax + AIR) * 1000 + (1 - b.skill) * 250;
      if (land > m.down - 60) continue;
      let rival = Infinity;
      for (const p of rivals) if (p) rival = Math.min(rival, Math.hypot(p.x - hx, p.z - hz));
      const contest = rival < d - 1.5 ? 0.3 + (1 - b.skill) * 0.4 : 1;
      const val = m.k === 1 ? 3 : 1;
      let s = (val * contest) / ((Math.max(land, m.up + 50) - now) / 1000 + 0.3);
      if (m.id === b.mem.tm) s *= 1.3;
      s *= 1 + (Math.random() - 0.5) * (1 - b.skill) * 0.8;
      if (s > bestS) {
        bestS = s;
        best = m;
      }
    }
    if (best && best.id !== b.mem.tm) b.reactAt = now + (1 - b.skill) * 320; // ci mette un attimo ad accorgersene
    b.mem.tm = best?.id ?? null;
    tgt = best ?? undefined;
  }
  if (!tgt) {
    // nessuna talpa buona: mi metto in mezzo, dove si arriva dappertutto
    if (!b.mem.idle || now > b.mem.idle.until) b.mem.idle = { x: api.rand(-4.5, 4.5), z: api.rand(-4.5, 4.5), until: now + 1800 };
    const d = api.go(b, b.mem.idle.x, b.mem.idle.z, 0.6);
    if (d < 0.6) b.input.x = b.input.z = 0;
    return;
  }
  const hx = holeX(tgt.h);
  const hz = holeZ(tgt.h);
  const dx = hx - me.x;
  const dz = hz - me.z;
  const D = Math.hypot(dx, dz);
  const reach = vmax * AIR * 0.92;
  const landAt = now + AIR * 1000;
  if (D <= reach && now >= b.reactAt) {
    if (landAt >= tgt.up + 40 && landAt <= tgt.down - 40) {
      // salto calibrato per atterrare sulla buca (con un errore che dipende dalla bravura)
      const want = D / (AIR * vmax);
      const err = 1 + gauss() * (1 - b.skill) * 0.3;
      const ang = Math.atan2(dx, dz) + gauss() * (1 - b.skill) * 0.12;
      const m = Math.min(1, want * err);
      b.mem.jdir = { x: Math.sin(ang) * m, z: Math.cos(ang) * m };
      b.input.x = b.mem.jdir.x;
      b.input.z = b.mem.jdir.z;
      b.input.jump = true;
      return;
    }
    // troppo presto: mi avvicino e aspetto che spunti
    if (D > 1) api.go(b, hx, hz, 0.45);
    return;
  }
  api.go(b, hx, hz);
  // a volte uno schiaffo a chi punta la stessa talpa
  if (D < 5 && now >= (b.mem.slapAt ?? 0)) {
    b.mem.slapAt = now + 500;
    for (const id of api.inGame()) {
      if (id === b.id) continue;
      const p = api.pos(id);
      if (!p || Math.hypot(p.x - me.x, p.z - me.z) > PHYS.pushRange - 0.6 || Math.hypot(p.x - hx, p.z - hz) > D + 0.5) continue;
      if (Math.random() < 0.1 + b.skill * 0.25) api.push(b, p.x, p.z);
      break;
    }
  }
}

registerServerMini<TalpeState>({
  kind: 'TALPE',
  ends: 'time',
  falls: 'none',
  init: (api) => ({ moles: [], next: 1, spawnAt: 0, pts: {}, air: {}, t0: api.now, sentAt: 0, syncAt: 0, dirty: false }),
  // in cerchio tra le buche, girati verso il centro
  spawn: (_api, _id, i, n) => {
    const a = (i / n) * Math.PI * 2 + 0.4;
    return { x: Math.sin(a) * 6.8, y: 0, z: Math.cos(a) * 6.8, r: a + Math.PI };
  },
  play: (api) => {
    api.ext.t0 = api.now;
    api.ext.spawnAt = api.now + 600;
  },
  tick(api) {
    const E = api.ext;
    const now = api.now;
    const T = Math.min(1, api.t / 60);
    // talpe nuove: sempre più spesso e sempre più insieme (con tanti giocatori qualcuna in più)
    const max = Math.round(lerp(2, 6, T)) + (api.inGame().length > 5 ? 1 : 0);
    if (now >= E.spawnAt) {
      E.spawnAt = now + lerp(1000, 420, T) * api.rand(0.75, 1.25);
      if (E.moles.length < max) spawnMole(api);
    }
    // chi atterra da un salto vicino al centro di una buca con la talpa fuori la schiaccia
    for (const id of api.inGame()) {
      const p = api.pos(id);
      if (!p) continue;
      if (p.y < PHYS.fallOut) api.teleport(id, { x: 0, y: 0, z: 0 });
      if (p.y > 0.3) {
        E.air[id] = Math.max(E.air[id] ?? 0, p.y);
        continue;
      }
      const air = E.air[id] ?? 0;
      E.air[id] = 0;
      if (air < 0.75) continue; // non è un salto
      let best: Mole | null = null;
      let bestD = TALPE.hitR;
      for (const m of E.moles) {
        if (now < m.up - 60 || now > m.down + 150) continue;
        const d = Math.hypot(p.x - holeX(m.h), p.z - holeZ(m.h));
        if (d < bestD) {
          bestD = d;
          best = m;
        }
      }
      if (!best) continue;
      const m = best;
      const pts = TALPE.pts[m.k];
      E.pts[id] = (E.pts[id] ?? 0) + pts;
      E.moles = E.moles.filter((x) => x !== m);
      E.dirty = true;
      api.emit({ k: 'tp_hit', i: m.id, h: m.h, kk: m.k, by: id, pts });
      if (m.k === 2) {
        // la bomba: chi ci è saltato sopra vola via, chi è vicino viene spinto
        boom(api, m, id);
      }
    }
    // talpe che tornano giù (le bombe non schiacciate scoppiano da sole)
    const gone = E.moles.filter((m) => now > m.down + 150);
    if (gone.length) {
      for (const m of gone) if (m.k === 2) boom(api, m, null);
      E.moles = E.moles.filter((m) => now <= m.down + 150);
      E.dirty = true;
    }
    if (now - E.sentAt > 500) {
      E.sentAt = now;
      api.emit({ k: 'tp_score', s: E.pts });
    }
    if (E.dirty && now - E.syncAt > 1000) {
      E.dirty = false;
      E.syncAt = now;
      return true;
    }
    return false;
  },
  bot: botBrain,
  rank: (api) => {
    const groups = new Map<number, string[]>();
    for (const id of api.ids()) {
      const n = api.ext.pts[id] ?? 0;
      groups.set(n, [...(groups.get(n) ?? []), id]);
    }
    return [...groups.entries()].sort((a, b) => b[0] - a[0]).map(([, ids]) => ids);
  },
  view: (api) => ({
    m: api.ext.moles.map((m) => enc(m, api.ext.t0)),
    s: api.ext.pts,
    t0: api.ext.t0,
    last: api.ext.next - 1,
  }),
});

// scoppio della bomba: lancia via chi ci è atterrato sopra e spinge chi è vicino
function boom(api: Api, m: Mole, by: string | null) {
  const x = holeX(m.h);
  const z = holeZ(m.h);
  const hit: string[] = [];
  for (const id of api.inGame()) {
    const p = api.pos(id);
    if (!p) continue;
    const dx = p.x - x;
    const dz = p.z - z;
    const d = Math.hypot(dx, dz);
    if (id !== by && (d > TALPE.boomR || api.dodging(id))) continue;
    const a = d > 0.15 ? Math.atan2(dx, dz) : api.rand(0, Math.PI * 2);
    const pow = id === by ? 9 : 6.5 * (1 - d / (TALPE.boomR + 0.5));
    api.fling(id, { vx: Math.sin(a) * pow, vy: id === by ? 11 : 6, vz: Math.cos(a) * pow });
    hit.push(id);
  }
  api.emit({ k: 'tp_boom', h: m.h, by, hit });
}
