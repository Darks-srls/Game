// 🫙 Trasformisti (server): ruoli, dispensa chiusa, travestimenti, colpi del mattarello, fischi, punti e bot
import { HIDE, PANTRY, PROPS, PROP_R, PROP_TYPES, hideBlocked } from '../../src/data/minis/nascondino';
import { registerServerMini, type MiniApi, type MiniBot } from './types';

interface HideState {
  phase: 'HIDE' | 'SEEK';
  seekAt: number; // quando si apre la dispensa
  seekers: string[];
  disguise: Record<string, number>; // chi si nasconde → tipo di oggetto
  score: Record<string, number>;
  stun: Record<string, number>; // cercatore stordito fino a qui
  hitAt: Record<string, number>;
  whistleAt: Record<string, number>;
  whistles: Record<string, number>;
  surv: Record<string, number>; // secondi di ricerca superati (un punto ogni 10)
  moved: Record<string, number>; // l'ultima volta che si è mosso (il fiuto dei bot)
  lastPos: Record<string, { x: number; z: number }>;
  heard: { x: number; z: number; at: number } | null; // l'ultimo fischio
}

interface BotMem {
  spot?: { x: number; z: number; t: number; a: number };
  morphed?: boolean;
  fleeAt?: number;
  goal?: { x: number; z: number; until: number };
  seen?: Record<string, number>;
  side?: number;
  stuckAt?: number;
  stuckX?: number;
  stuckZ?: number;
}

const isSeeker = (E: HideState, id: string) => E.seekers.includes(id);
const hiders = (api: MiniApi<HideState>) => api.inGame().filter((id) => !isSeeker(api.ext, id));

function shuffle<T>(list: T[]) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// il tipo dell'oggetto vero più vicino
function nearestType(x: number, z: number) {
  let best = 0;
  let bd = Infinity;
  for (const o of PROPS) {
    const d = (o.x - x) ** 2 + (o.z - z) ** 2;
    if (d < bd) {
      bd = d;
      best = o.t;
    }
  }
  return best;
}

// TRASFORMATI: diventa un oggetto (solo mentre i cercatori sono in dispensa)
function morph(api: MiniApi<HideState>, id: string, t: number) {
  const E = api.ext;
  if (api.stage !== 'PLAY' || E.phase !== 'HIDE' || isSeeker(E, id) || !api.alive(id)) return false;
  if (!Number.isInteger(t) || t < 0 || t >= PROP_TYPES.length) return false;
  E.disguise[id] = t;
  api.emit({ k: 'nasc_morph', id, t });
  return true;
}

// COLPISCI: il mattarello prende l'oggetto davanti (oggetto vero = stordito, travestito = trovato)
function hit(api: MiniApi<HideState>, by: string, at?: { x: number; z: number; r: number }) {
  const E = api.ext;
  const now = api.now;
  if (api.stage !== 'PLAY' || E.phase !== 'SEEK' || !isSeeker(E, by) || !api.alive(by)) return false;
  if (now < (E.stun[by] ?? 0) || now < (E.hitAt[by] ?? 0)) return false;
  E.hitAt[by] = now + HIDE.hitCd;
  const sp = api.pos(by);
  if (!sp) return false;
  // il telefono dice dove sono e dove guardo (così il ritardo della rete non conta), ma non può barare
  let p = { x: sp.x, y: sp.y, z: sp.z, r: sp.r };
  if (at && Number.isFinite(at.x) && Number.isFinite(at.z) && Number.isFinite(at.r) && Math.hypot(at.x - sp.x, at.z - sp.z) < 2.5) p = { ...p, x: at.x, z: at.z, r: at.r };
  const fx = Math.sin(p.r);
  const fz = Math.cos(p.r);
  let best: { s: number; id?: string; prop?: number; x: number; z: number } | null = null;
  const consider = (x: number, z: number, y: number, extra: { id?: string; prop?: number }) => {
    if (Math.abs(y - p.y) > 1.6) return;
    const dx = x - p.x;
    const dz = z - p.z;
    const d = Math.hypot(dx, dz);
    if (d > HIDE.hitRange + 0.35) return;
    const dot = d > 0.01 ? (dx * fx + dz * fz) / d : 1;
    if (dot < 0.3 && d > 1.0) return;
    const s = d - dot * 0.8;
    if (!best || s < best.s) best = { s, x, z, ...extra };
  };
  for (const id of hiders(api)) {
    const q = api.pos(id);
    if (q) consider(q.x, q.z, q.y, { id });
  }
  PROPS.forEach((o, i) => consider(o.x, o.z, 0, { prop: i }));
  const B = best as { s: number; id?: string; prop?: number; x: number; z: number } | null;
  const bot = api.bot(by);
  if (bot) bot.pushAnimUntil = now + 380;
  if (!B) {
    api.emit({ k: 'nasc_swing', by });
    return false;
  }
  if (B.id) {
    // TROVATO!
    const t = E.disguise[B.id] ?? -1;
    E.score[by] = (E.score[by] ?? 0) + HIDE.foundPts;
    api.emit({ k: 'nasc_found', by, id: B.id, x: B.x, z: B.z, t });
    api.eliminate(B.id, 'trovato');
    if (!hiders(api).length) api.end();
    return true;
  }
  // oggetto vero: stordito
  E.stun[by] = now + HIDE.stunMs;
  api.emit({ k: 'nasc_miss', by, i: B.prop, ms: HIDE.stunMs });
  return false;
}

// FISCHIO: punti, ma ti sentono tutti
function whistle(api: MiniApi<HideState>, id: string) {
  const E = api.ext;
  if (api.stage !== 'PLAY' || E.phase !== 'SEEK' || isSeeker(E, id) || !api.alive(id)) return false;
  if (api.now < (E.whistleAt[id] ?? 0) + HIDE.whistleCd - 150) return false;
  const p = api.pos(id);
  if (!p) return false;
  E.whistleAt[id] = api.now;
  E.whistles[id] = (E.whistles[id] ?? 0) + 1;
  const pts = E.whistles[id] <= HIDE.whistleMax ? HIDE.whistlePts : 0;
  E.score[id] = (E.score[id] ?? 0) + pts;
  E.heard = { x: p.x, z: p.z, at: api.now };
  api.emit({ k: 'nasc_fischio', id, x: Math.round(p.x * 10) / 10, z: Math.round(p.z * 10) / 10, pts });
  return true;
}

// un posto per nascondersi: accanto a un oggetto (i bravi scelgono i gruppi di oggetti uguali e lo stesso travestimento)
function pickSpot(api: MiniApi<HideState>, b: MiniBot, avoid?: { x: number; z: number }) {
  const taken = api.bots.filter((o) => o !== b && (o.mem as BotMem)?.spot).map((o) => (o.mem as BotMem).spot!);
  let best: { x: number; z: number; t: number; a: number; s: number } | null = null;
  for (let tries = 0; tries < 40; tries++) {
    const P = PROPS[Math.floor(Math.random() * PROPS.length)];
    const a = Math.random() * Math.PI * 2;
    const dist = PROP_R[P.t] + 0.55 + api.rand(0.25, 0.7);
    const x = P.x + Math.sin(a) * dist;
    const z = P.z + Math.cos(a) * dist;
    if (hideBlocked(x, z, 0.1) || z > HIDE.half - 1.5) continue;
    if (taken.some((o) => Math.hypot(o.x - x, o.z - z) < 1.6)) continue;
    if (avoid && Math.hypot(avoid.x - x, avoid.z - z) < 7) continue;
    const same = PROPS.filter((o) => o.t === P.t && Math.hypot(o.x - x, o.z - z) < 4).length;
    let s = same * b.skill + Math.random() * 2;
    if (avoid) s += Math.hypot(avoid.x - x, avoid.z - z) * 0.1;
    else s -= Math.hypot(b.body.x - x, b.body.z - z) * 0.04 * (1 - b.skill); // i pigri si nascondono vicino
    if (!best || s > best.s) {
      // chi è meno bravo a volte sbaglia travestimento
      const t = Math.random() < (1 - b.skill) * 0.45 ? Math.floor(Math.random() * PROP_TYPES.length) : P.t;
      best = { x, z, t, a: Math.random() * Math.PI * 2, s };
    }
  }
  return best ?? { x: b.body.x, z: b.body.z, t: nearestType(b.body.x, b.body.z), a: 0 };
}

// cammina verso (x, z) girando intorno ai mobili (e passando dalla porta della dispensa)
function steer(api: MiniApi<HideState>, b: MiniBot, x: number, z: number, speed = 1) {
  const me = b.body;
  const m = b.mem as BotMem;
  const H = HIDE.half;
  if ((me.z > H) !== (z > H)) {
    // dall'altra parte della parete: prima davanti alla porta, poi attraverso
    const side = me.z > H ? 1 : -1;
    if (Math.abs(me.x) > 0.45 || Math.abs(me.z - H) > 1.8) {
      api.go(b, 0, H + side * 1.1, speed);
      return Math.hypot(x - me.x, z - me.z);
    }
    api.go(b, 0, H - side * 1.8, speed);
    return Math.hypot(x - me.x, z - me.z);
  }
  const dx = x - me.x;
  const dz = z - me.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.3) return d;
  const a0 = Math.atan2(dx, dz);
  const look = Math.min(1.0, d);
  m.side ??= Math.random() < 0.5 ? 1 : -1;
  for (const off of [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8]) {
    const a = a0 + off * m.side;
    if (!hideBlocked(me.x + Math.sin(a) * look, me.z + Math.cos(a) * look, 0.05) || off === -1.8) {
      b.input = { x: Math.sin(a) * speed, z: Math.cos(a) * speed, jump: false };
      break;
    }
  }
  // fermo da un po'? cambia lato
  if (api.now > (m.stuckAt ?? 0)) {
    if (Math.hypot(me.x - (m.stuckX ?? 99), me.z - (m.stuckZ ?? 99)) < 0.35) {
      m.side = -(m.side ?? 1);
      m.goal = undefined;
    }
    m.stuckAt = api.now + 1300;
    m.stuckX = me.x;
    m.stuckZ = me.z;
  }
  return d;
}

function hiderBot(api: MiniApi<HideState>, b: MiniBot, m: BotMem) {
  const E = api.ext;
  const me = b.body;
  const now = api.now;
  m.spot ??= pickSpot(api, b);
  if (E.phase === 'HIDE' && !m.morphed) m.morphed = morph(api, b.id, m.spot.t);
  const d = Math.hypot(m.spot.x - me.x, m.spot.z - me.z);
  if (d > 0.35) {
    steer(api, b, m.spot.x, m.spot.z);
    return;
  }
  me.r = m.spot.a; // fermo, girato come un oggetto qualunque
  if (E.phase !== 'SEEK') return;
  let near = 99;
  let facing = false;
  for (const sid of E.seekers) {
    const p = api.pos(sid);
    if (!p || !api.alive(sid)) continue;
    const dd = Math.hypot(p.x - me.x, p.z - me.z);
    if (dd < near) {
      near = dd;
      facing = dd > 0.01 && (Math.sin(p.r) * (me.x - p.x) + Math.cos(p.r) * (me.z - p.z)) / dd > 0.6;
    }
  }
  // un cercatore mi punta da vicino: i più svegli scappano (ma correre si nota)
  if (near < 2.6 && facing && now > (m.fleeAt ?? 0)) {
    m.fleeAt = now + 1200;
    if (Math.random() < b.skill * 0.4) {
      const sp = E.seekers.map((id) => api.pos(id)).find((p) => p && Math.hypot(p.x - me.x, p.z - me.z) === near);
      m.spot = pickSpot(api, b, sp ?? undefined);
      steer(api, b, m.spot.x, m.spot.z);
      api.dash(b);
      return;
    }
  }
  // fischio quando i cercatori sono lontani (i bravi aspettano di essere al sicuro)
  if ((E.whistles[b.id] ?? 0) < HIDE.whistleMax && now > (E.whistleAt[b.id] ?? 0) + HIDE.whistleCd) {
    const safe = near > 5 + b.skill * 5;
    if (Math.random() < (safe ? 0.002 + b.skill * 0.003 : 0.0006)) whistle(api, b.id);
  }
}

function seekerBot(api: MiniApi<HideState>, b: MiniBot, m: BotMem) {
  const E = api.ext;
  const me = b.body;
  const now = api.now;
  if (E.phase !== 'SEEK' || now < (E.stun[b.id] ?? 0) || now < b.waitUntil) return;
  m.seen ??= {};
  // 1) accanto a un oggetto non ancora controllato: lo guardo bene e decido se colpirlo
  let cand: { key: string; x: number; z: number; d: number; id?: string; t: number } | null = null;
  const look = (key: string, x: number, z: number, t: number, id?: string) => {
    if (now < (m.seen![key] ?? 0)) return;
    const d = Math.hypot(x - me.x, z - me.z);
    if (d < 2.6 && (!cand || d < cand.d)) cand = { key, x, z, d, id, t };
  };
  PROPS.forEach((o, i) => look(`p${i}`, o.x, o.z, o.t));
  for (const id of hiders(api)) {
    const q = api.pos(id);
    if (q) look(`h${id}`, q.x, q.z, E.disguise[id] ?? -1, id);
  }
  const C = cand as { key: string; x: number; z: number; d: number; id?: string; t: number } | null;
  if (C) {
    if (C.d > 1.6) {
      steer(api, b, C.x, C.z, 0.8);
      return;
    }
    // il fiuto: si è mosso? ha fischiato qui vicino? è diverso dagli oggetti intorno? (i bravi se ne accorgono di più)
    let susp = 0.04 + (1 - b.skill) * 0.2; // oggetto vero: i meno bravi colpiscono a caso
    if (C.id) {
      susp = 0.06 + b.skill * 0.28;
      if (now - (E.moved[C.id] ?? 0) < 3000) susp += 0.3;
      if (E.heard && now - E.heard.at < 8000 && Math.hypot(E.heard.x - C.x, E.heard.z - C.z) < 3) susp += 0.35;
      if (C.t < 0) susp += 0.6;
      else if (!PROPS.some((o) => o.t === C.t && Math.hypot(o.x - C.x, o.z - C.z) < 3.5)) susp += 0.3 * b.skill;
    }
    m.seen[C.key] = now + api.rand(14000, 22000);
    me.r = Math.atan2(C.x - me.x, C.z - me.z);
    if (Math.random() < Math.min(0.95, susp)) {
      hit(api, b.id, { x: me.x, z: me.z, r: me.r });
      return;
    }
    // lo guarda un attimo e passa oltre
    b.waitUntil = now + api.rand(250, 700) * (1.4 - b.skill);
    return;
  }
  // 2) dove andare: un fischio, qualcosa che si muove, oppure un giro tra gli oggetti
  const G = m.goal;
  if (!G || now > G.until || Math.hypot(G.x - me.x, G.z - me.z) < 0.8) {
    let goal: { x: number; z: number } | null = null;
    if (E.heard && now - E.heard.at < 6000 && Math.random() < 0.5 + b.skill * 0.5) {
      const err = (1 - b.skill) * 3.5;
      goal = { x: E.heard.x + api.rand(-err, err), z: E.heard.z + api.rand(-err, err) };
    }
    if (!goal)
      for (const id of hiders(api)) {
        const q = api.pos(id);
        if (q && now - (E.moved[id] ?? 0) < 1500 && Math.hypot(q.x - me.x, q.z - me.z) < 12 && Math.random() < b.skill) {
          goal = { x: q.x, z: q.z };
          break;
        }
      }
    if (!goal) {
      // tre oggetti a caso (veri o no, non si sa), il più vicino
      const pool: { x: number; z: number }[] = [...PROPS, ...hiders(api).map((id) => api.pos(id)).filter((q): q is NonNullable<typeof q> => !!q)];
      let bd = Infinity;
      for (let i = 0; i < 3; i++) {
        const o = pool[Math.floor(Math.random() * pool.length)];
        const dd = Math.hypot(o.x - me.x, o.z - me.z);
        if (dd < bd && dd > 1.5) {
          bd = dd;
          goal = { x: o.x, z: o.z };
        }
      }
    }
    goal ??= { x: api.rand(-10, 10), z: api.rand(-10, 10) };
    m.goal = { ...goal, until: now + api.rand(4000, 7000) };
  }
  steer(api, b, m.goal!.x, m.goal!.z);
}

registerServerMini<HideState>({
  kind: 'NASCONDINO',
  ends: 'time',
  init: (api) => {
    const ids = api.ids();
    const seekers = shuffle(ids).slice(0, ids.length >= 6 ? 2 : 1);
    return { phase: 'HIDE', seekAt: 0, seekers, disguise: {}, score: {}, stun: {}, hitAt: {}, whistleAt: {}, whistles: {}, surv: {}, moved: {}, lastPos: {}, heard: null };
  },
  spawn: (api, id, i, n) => {
    const E = api.ext;
    const k = E.seekers.indexOf(id);
    if (k >= 0) {
      // chiusi in dispensa
      const x = E.seekers.length > 1 ? (k ? 1.5 : -1.5) : 0;
      return { x, y: 0, z: (PANTRY.z0 + PANTRY.z1) / 2 + 0.6, r: Math.PI };
    }
    // sparsi per la cucina, in un posto libero
    for (let tries = 0; tries < 30; tries++) {
      const a = ((i + tries * 0.37) / n) * Math.PI * 2;
      const r = 6.5 + (tries % 4) * 1.6;
      const x = Math.sin(a) * r;
      const z = Math.cos(a) * r - 1;
      if (!hideBlocked(x, z, 0.3)) return { x, y: 0, z, r: a };
    }
    return { x: 0, y: 0, z: -4, r: 0 };
  },
  play: (api) => {
    api.ext.seekAt = api.now + HIDE.hideMs;
  },
  tick(api, dt) {
    const E = api.ext;
    const now = api.now;
    let changed = false;
    // si apre la dispensa: chi non si è trasformato diventa l'oggetto più vicino
    if (E.phase === 'HIDE' && E.seekAt && now >= E.seekAt) {
      E.phase = 'SEEK';
      for (const id of hiders(api)) {
        if (E.disguise[id] !== undefined) continue;
        const p = api.pos(id);
        E.disguise[id] = p ? nearestType(p.x, p.z) : 0;
      }
      api.emit({ k: 'nasc_go' });
      changed = true;
    }
    // chi si muove (serve al fiuto dei bot cercatori)
    for (const id of hiders(api)) {
      const p = api.pos(id);
      if (!p) continue;
      const lp = E.lastPos[id];
      if (!lp || Math.hypot(p.x - lp.x, p.z - lp.z) > 0.3) {
        if (lp) E.moved[id] = now;
        E.lastPos[id] = { x: p.x, z: p.z };
      }
    }
    if (E.phase === 'SEEK') {
      // un punto ogni 10 secondi a chi resta nascosto
      for (const id of hiders(api)) {
        E.surv[id] = (E.surv[id] ?? 0) + dt;
        if (E.surv[id] >= HIDE.tickPts) {
          E.surv[id] -= HIDE.tickPts;
          E.score[id] = (E.score[id] ?? 0) + 1;
          changed = true;
        }
      }
      // tutti trovati, o nessun cercatore rimasto: fine
      if (!hiders(api).length || !E.seekers.some((id) => api.alive(id))) api.end();
    } else if (!E.seekers.some((id) => api.alive(id)) || !hiders(api).length) api.end();
    return changed;
  },
  actions: {
    MG_NASC_MORPH: (api, me, p) => morph(api, me, Number(p.t)),
    MG_NASC_HIT: (api, me, p) => hit(api, me, { x: Number(p.x), z: Number(p.z), r: Number(p.r) }),
    MG_NASC_FISCHIO: (api, me) => whistle(api, me),
  },
  speed: (api, id) => {
    const E = api.ext;
    if (isSeeker(E, id)) return E.phase === 'HIDE' || api.now < (E.stun[id] ?? 0) ? 0 : 1;
    return E.phase === 'SEEK' ? 0.85 : 1;
  },
  bot(api, b) {
    const m = b.mem as BotMem;
    if (isSeeker(api.ext, b.id)) seekerBot(api, b, m);
    else hiderBot(api, b, m);
  },
  rank: (api) => {
    // punti veri: chi resta nascosto fino alla fine prende anche il bonus
    const E = api.ext;
    const out: Record<string, number> = {};
    for (const id of api.ids()) out[id] = (E.score[id] ?? 0) + (!isSeeker(E, id) && api.alive(id) && E.phase === 'SEEK' ? HIDE.survivePts : 0);
    return out;
  },
  view: (api) => ({ phase: api.ext.phase, seekAt: api.ext.seekAt, seekers: api.ext.seekers, disguise: api.ext.disguise, score: api.ext.score }),
});
