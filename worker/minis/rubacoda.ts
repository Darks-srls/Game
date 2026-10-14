// 🐷 Ruba la coda (server): chi ha la coda, i furti a schiaffi, i secondi con la coda, i bot che inseguono e scappano
import { RUBA, RUBA_OBST } from '../../src/data/minis/rubacoda';
import { PHYS } from '../../src/data/party3d';
import { registerServerMini, type MiniApi, type MiniBot } from './types';

interface Trk {
  x: number;
  z: number;
  t: number;
  vx: number;
  vz: number;
}

interface RubaState {
  tail: Record<string, boolean>; // chi ha la coda
  safe: Record<string, number>; // protetto fino a (ms): appena rubata non si può riprendere
  sec: Record<string, number>; // secondi totali con la coda
  steals: Record<string, number>;
  trk: Record<string, Trk>; // velocità stimata dei giocatori veri (serve ai bot per prevedere dove vanno)
  sentAt: number;
  dirty: boolean;
}

type Api = MiniApi<RubaState>;

const holders = (api: Api) => api.inGame().filter((id) => api.ext.tail[id]);

function velOf(api: Api, id: string) {
  if (api.bot(id)) return api.vel(id);
  const t = api.ext.trk[id];
  return t ? { vx: t.vx, vz: t.vz } : { vx: 0, vz: 0 };
}

// direzione (dx, dz) corretta per girare intorno a botti e forme (guarda solo fin dove serve)
function steer(x: number, z: number, dx: number, dz: number, maxAlong = 99) {
  let l = Math.hypot(dx, dz) || 1;
  dx /= l;
  dz /= l;
  let ax = dx;
  let az = dz;
  for (const o of RUBA_OBST) {
    const ox = o.x - x;
    const oz = o.z - z;
    const along = ox * dx + oz * dz;
    if (along < -0.3 || along > Math.min(4.2, maxAlong + o.r)) continue;
    const perp = ox * dz - oz * dx; // > 0: l'ostacolo è a destra
    const clear = o.r + PHYS.radius + 0.45;
    if (Math.abs(perp) >= clear) continue;
    const k = ((clear - Math.abs(perp)) / clear) * (1.3 - Math.max(0, along) / 4.2) * 2.2;
    const s = perp > 0 ? -1 : 1;
    ax += dz * s * k;
    az += -dx * s * k;
  }
  l = Math.hypot(ax, az) || 1;
  return { x: ax / l, z: az / l };
}

// un punto è dentro un ostacolo (o fuori dall'aia)?
function blocked(x: number, z: number, pad: number) {
  if (Math.hypot(x, z) > RUBA.r - pad) return true;
  for (const o of RUBA_OBST) if (Math.hypot(x - o.x, z - o.z) < o.r + pad) return true;
  return false;
}

// se il bot vuole muoversi ma resta fermo (incastrato), per un attimo va di lato
function unstick(api: Api, b: MiniBot, dir: { x: number; z: number }) {
  const m = b.mem;
  const me = b.body;
  if (!m.chk || api.now - m.chk.t > 700) {
    if (m.chk && Math.hypot(me.x - m.chk.x, me.z - m.chk.z) < 0.6 && me.ground) {
      const s = Math.random() < 0.5 ? 1 : -1;
      m.side = { until: api.now + 650, x: dir.z * s, z: -dir.x * s };
      if (Math.random() < 0.5) b.input.jump = true;
    }
    m.chk = { x: me.x, z: me.z, t: api.now };
  }
  if (m.side && api.now < m.side.until) return { x: m.side.x * 0.8 + dir.x * 0.2, z: m.side.z * 0.8 + dir.z * 0.2 };
  return dir;
}

function chase(api: Api, b: MiniBot) {
  const E = api.ext;
  const me = b.body;
  const now = api.now;
  const list = holders(api).filter((id) => id !== b.id);
  if (!list.length) return;
  // chi inseguire: il più comodo (vicino, non protetto, non già braccato da tutti); ogni tanto ci ripenso
  if (!b.mem.tgt || !E.tail[b.mem.tgt] || now >= b.thinkAt) {
    b.thinkAt = now + api.rand(450, 1000) * (1.35 - b.skill * 0.6);
    let best: string | null = null;
    let bestS = Infinity;
    for (const id of list) {
      const p = api.pos(id);
      if (!p) continue;
      const d = Math.hypot(p.x - me.x, p.z - me.z);
      let crowd = 0;
      for (const o of api.inGame()) {
        if (o === b.id || o === id || E.tail[o]) continue;
        const q = api.pos(o);
        if (q && Math.hypot(q.x - p.x, q.z - p.z) < d - 1) crowd++;
      }
      const s = d + ((E.safe[id] ?? 0) > now ? 4 : 0) + crowd * 2.2 * b.skill + (id === b.mem.tgt ? -1.5 : 0) + Math.random() * (1 - b.skill) * 5;
      if (s < bestS) {
        bestS = s;
        best = id;
      }
    }
    b.mem.tgt = best;
  }
  const id = b.mem.tgt as string | null;
  const p = id ? api.pos(id) : null;
  if (!id || !p) return;
  const v = velOf(api, id);
  const d = Math.hypot(p.x - me.x, p.z - me.z);
  // prevedo dove sarà (i più bravi di più)
  const lead = Math.min(1.1, d / 7) * (0.25 + b.skill * 0.75);
  let tx = p.x + v.vx * lead;
  let tz = p.z + v.vz * lead;
  const tr = Math.hypot(tx, tz);
  if (tr > RUBA.r - 0.8) {
    tx *= (RUBA.r - 0.8) / tr;
    tz *= (RUBA.r - 0.8) / tr;
  }
  if (d < 2) {
    tx = p.x;
    tz = p.z;
  }
  const dir = unstick(api, b, steer(me.x, me.z, tx - me.x, tz - me.z, Math.hypot(tx - me.x, tz - me.z)));
  b.input.x = dir.x;
  b.input.z = dir.z;
  // è salito su una botte o una forma: salto anch'io (doppio salto se serve)
  if (p.y > 0.5 && d < 2.8) {
    if (me.ground) b.input.jump = true;
    else if (!b.mem.dj && me.vy < 1.5 && me.y < p.y + 0.3) {
      b.input.jump = true;
      b.mem.dj = true;
    }
  }
  if (me.ground) b.mem.dj = false;
  // scatto per chiudere la distanza
  if (d > 2.6 && d < 5.5 && Math.random() < 0.025 * b.skill) api.dash(b);
  // schiaffo quando è a tiro (non sprecarlo se è protetto)
  const prot = (E.safe[id] ?? 0) > now + 80;
  if (!prot && d < RUBA.reach - 0.3 && Math.abs(p.y - me.y) < 1.5 && now >= b.reactAt) {
    b.reactAt = now + api.rand(90, 320) * (1.5 - b.skill);
    if (Math.random() < 0.3 + b.skill * 0.6) api.push(b, p.x, p.z);
  }
}

// scappa: prova 16 direzioni e sceglie quella che allontana di più dagli inseguitori (senza finire contro lo steccato)
function flee(api: Api, b: MiniBot) {
  const E = api.ext;
  const me = b.body;
  const now = api.now;
  const threats: { x: number; z: number; d: number }[] = [];
  for (const id of api.inGame()) {
    if (id === b.id || E.tail[id]) continue;
    const p = api.pos(id);
    if (!p) continue;
    const v = velOf(api, id);
    const look = 0.15 + b.skill * 0.35;
    const x = p.x + v.vx * look;
    const z = p.z + v.vz * look;
    threats.push({ x, z, d: Math.hypot(x - me.x, z - me.z) });
  }
  threats.sort((a, c) => a.d - c.d);
  // i meno bravi guardano solo i più vicini
  const seen = threats.slice(0, b.skill > 0.65 ? 6 : b.skill > 0.5 ? 3 : 2);
  const near = seen[0]?.d ?? 99;
  if (!b.mem.fdir || now >= b.thinkAt || near < 3.5) {
    b.thinkAt = now + api.rand(120, 300) * (1.5 - b.skill);
    let best = b.mem.fdir ?? { x: -me.x, z: -me.z };
    let bestS = -Infinity;
    const prev = b.mem.fdir;
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const dx = Math.sin(a);
      const dz = Math.cos(a);
      const qx = me.x + dx * 3;
      const qz = me.z + dz * 3;
      let s = 0;
      for (const t of seen) {
        const dq = Math.hypot(qx - t.x, qz - t.z);
        s -= 6 / (dq + 0.4);
      }
      const rq = Math.hypot(qx, qz);
      if (rq > RUBA.r - 2.2) s -= (rq - (RUBA.r - 2.2)) * 2.4;
      if (blocked(me.x + dx * 1.6, me.z + dz * 1.6, 0.7)) s -= 2.5;
      if (prev) s += 0.6 * (dx * prev.x + dz * prev.z);
      if (s > bestS) {
        bestS = s;
        best = { x: dx, z: dz };
      }
    }
    b.mem.fdir = best;
  }
  let dir = steer(me.x, me.z, b.mem.fdir.x, b.mem.fdir.z, 3);
  dir = unstick(api, b, dir);
  // nessuno vicino: si va piano (non serve correre e sbattere)
  const sp = near > 9 ? 0.6 : 1;
  b.input.x = dir.x * sp;
  b.input.z = dir.z * sp;
  // inseguitore addosso: scatto (o schiaffo per allontanarlo)
  if (near < 2.9 && Math.random() < 0.06 + b.skill * 0.14) api.dash(b);
  const t0 = seen[0];
  if (t0 && t0.d < 2 && now >= b.reactAt && Math.random() < b.skill * 0.25) {
    b.reactAt = now + 600;
    api.push(b, t0.x, t0.z);
  }
}

registerServerMini<RubaState>({
  kind: 'RUBACODA',
  ends: 'time',
  falls: 'none',
  init: () => ({ tail: {}, safe: {}, sec: {}, steals: {}, trk: {}, sentAt: 0, dirty: false }),
  // tutti in cerchio intorno all'aia; la coda a uno sì e uno no (circa metà, almeno uno)
  spawn: (api, id, i, n) => {
    const k = Math.max(1, Math.floor(n / 2));
    api.ext.tail[id] = i % 2 === 0 && i / 2 < k;
    const a = (i / n) * Math.PI * 2;
    return { x: Math.sin(a) * 10.5, y: 0, z: Math.cos(a) * 10.5, r: a + Math.PI };
  },
  tick(api, dt) {
    const E = api.ext;
    const now = api.now;
    let changed = false;
    if (E.dirty) {
      E.dirty = false;
      changed = true;
    }
    for (const id of api.ids()) {
      const p = api.pos(id);
      if (!p) continue;
      // velocità stimata dei giocatori veri
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
      // (lo steccato non fa cadere nessuno, ma per sicurezza)
      if (p.y < PHYS.fallOut) {
        const a = api.rand(0, Math.PI * 2);
        api.teleport(id, { x: Math.sin(a) * 10, y: 0, z: Math.cos(a) * 10, r: a + Math.PI });
      }
    }
    // chi esce dalla partita lascia la coda a qualcuno che non ce l'ha
    for (const id of Object.keys(E.tail)) {
      if (!E.tail[id] || api.alive(id)) continue;
      E.tail[id] = false;
      const heirs = api.inGame().filter((x) => !E.tail[x]);
      if (heirs.length) {
        const h = heirs[Math.floor(Math.random() * heirs.length)];
        E.tail[h] = true;
        E.safe[h] = now + RUBA.safeMs;
        api.emit({ k: 'rc_gift', id: h });
      }
      changed = true;
    }
    for (const id of api.inGame()) if (E.tail[id]) E.sec[id] = (E.sec[id] ?? 0) + dt;
    if (now - E.sentAt > 500) {
      E.sentAt = now;
      api.emit({ k: 'rc_score', s: Object.fromEntries(Object.entries(E.sec).map(([id, v]) => [id, Math.round(v * 10) / 10])) });
    }
    return changed;
  },
  // lo schiaffo: chi non ha la coda la ruba a chi ce l'ha; altrimenti è una spinta normale
  push(api, by) {
    const E = api.ext;
    const now = api.now;
    const p = api.pos(by);
    if (!p) return false;
    const fx = Math.sin(p.r);
    const fz = Math.cos(p.r);
    let steal: { id: string; d: number } | null = null;
    const near: { id: string; dx: number; dz: number; d: number }[] = [];
    for (const id of api.inGame()) {
      if (id === by) continue;
      const o = api.pos(id);
      if (!o || Math.abs(o.y - p.y) > 1.7) continue;
      const dx = o.x - p.x;
      const dz = o.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > RUBA.reach) continue;
      const front = d < 0.01 ? 1 : (dx * fx + dz * fz) / d;
      if (front < 0.1 && d > 1.3) continue; // dietro di me (chi è appiccicato vale sempre)
      if (api.dodging(id)) {
        api.emit({ k: 'dodge', id });
        continue;
      }
      if (!E.tail[by] && E.tail[id] && (E.safe[id] ?? 0) <= now && (!steal || d < steal.d)) steal = { id, d };
      near.push({ id, dx, dz, d });
    }
    if (steal) {
      E.tail[steal.id] = false;
      E.tail[by] = true;
      E.safe[by] = now + RUBA.safeMs;
      E.steals[by] = (E.steals[by] ?? 0) + 1;
      // il derubato fa un saltello all'indietro
      const n = near.find((x) => x.id === steal!.id)!;
      const k = n.d > 0.01 ? 1 / n.d : 0;
      api.fling(steal.id, { vx: n.dx * k * 6, vy: 5.5, vz: n.dz * k * 6 });
      api.emit({ k: 'rc_steal', by, from: steal.id });
      E.dirty = true;
      return true;
    }
    // niente coda da rubare: spinge il più vicino davanti (un po' meno forte del solito)
    near.sort((a, c) => a.d - c.d);
    const hit = near.slice(0, 1);
    for (const h of hit) {
      const k = h.d > 0.01 ? 1 / h.d : 0;
      const ux = h.d > 0.01 ? h.dx * k : fx;
      const uz = h.d > 0.01 ? h.dz * k : fz;
      api.fling(h.id, { vx: ux * PHYS.pushPower * 0.85, vy: PHYS.pushLift, vz: uz * PHYS.pushPower * 0.85 });
    }
    api.emit({ k: 'push', by, hit: hit.map((h) => h.id) });
    return false;
  },
  speed: (api, id) => (api.ext.tail[id] ? RUBA.holderSpeed : 1),
  bot(api, b) {
    if (api.ext.tail[b.id]) flee(api, b);
    else chase(api, b);
  },
  // prima chi ha la coda alla fine, poi tutti per secondi con la coda
  rank: (api) => {
    const E = api.ext;
    const key = (id: string) => (E.tail[id] && api.alive(id) ? 1_000_000 : 0) + Math.round((E.sec[id] ?? 0) * 10);
    const groups = new Map<number, string[]>();
    for (const id of api.ids()) groups.set(key(id), [...(groups.get(key(id)) ?? []), id]);
    return [...groups.entries()].sort((a, c) => c[0] - a[0]).map(([, ids]) => ids);
  },
  view: (api) => {
    const E = api.ext;
    const now = api.now;
    return {
      tail: Object.keys(E.tail).filter((id) => E.tail[id]),
      safe: Object.fromEntries(Object.entries(E.safe).filter(([, until]) => until > now)),
      sec: Object.fromEntries(Object.entries(E.sec).map(([id, v]) => [id, Math.round(v)])),
    };
  },
});
