// 🎨 Pennellate (server): colora le piastrelle dalle posizioni, i secchi di vernice, gli schiaffi che sbilanciano, i bot pittori
import { PAINT, PAINT_CHARS, PAINT_EMPTY, PAINT_N, paintTileAt, paintTilesIn } from '../../src/data/minis/pittura';
import { PHYS } from '../../src/data/party3d';
import { registerServerMini, type MiniApi } from './types';

interface Bucket {
  id: number;
  x: number;
  z: number;
  at: number; // quando atterra (prima non si prende)
}

interface PaintState {
  tiles: string; // una lettera per piastrella: '.' libera, altrimenti l'indice in order
  order: string[]; // chi è ogni lettera
  last: Record<string, { x: number; z: number } | null>; // ultimo punto dipinto (per non saltare piastrelle)
  stun: Record<string, number>; // sbilanciato fino a qui: niente colore
  buckets: Bucket[];
  seq: number;
  nextBucket: number;
  dirty: boolean; // il pavimento è cambiato dall'ultimo invio completo
  sentAt: number;
  scoreAt: number;
}

interface BotMem {
  goal?: { x: number; z: number; bucket?: number };
  slapAt?: number;
  stuckAt?: number;
  stuckX?: number;
  stuckZ?: number;
}

const tmp: number[] = [];
// lettera → indice (veloce)
const IDX = new Int8Array(128).fill(-1);
for (let i = 0; i < PAINT_CHARS.length; i++) IDX[PAINT_CHARS.charCodeAt(i)] = i;

// quante piastrelle ha ognuno
function counts(E: PaintState) {
  const n = new Array<number>(E.order.length).fill(0);
  for (let k = 0; k < E.tiles.length; k++) {
    const i = IDX[E.tiles.charCodeAt(k) & 127];
    if (i >= 0 && i < n.length) n[i]++;
  }
  return n;
}

// colora un elenco di piastrelle (ritorna le coppie [piastrella, chi] cambiate)
function paint(E: PaintState, list: number[], who: number, out: number[]) {
  const ch = PAINT_CHARS[who];
  let arr: string[] | null = null;
  for (const k of list) {
    if (k < 0 || E.tiles[k] === ch) continue;
    arr ??= E.tiles.split('');
    if (arr[k] === ch) continue;
    arr[k] = ch;
    out.push(k, who);
  }
  if (arr) {
    E.tiles = arr.join('');
    E.dirty = true;
  }
}

function newBucket(api: MiniApi<PaintState>) {
  const E = api.ext;
  let best: { x: number; z: number; s: number } | null = null;
  for (let i = 0; i < 24; i++) {
    const x = api.rand(-PAINT.half + 2, PAINT.half - 2);
    const z = api.rand(-PAINT.half + 2, PAINT.half - 2);
    // lontano da tutti (così bisogna correre) e dagli altri secchi
    let s = Math.random() * 2;
    for (const id of api.inGame()) {
      const p = api.pos(id);
      if (p) s += Math.min(6, Math.hypot(p.x - x, p.z - z)) * 0.4;
    }
    for (const b of E.buckets) if (Math.hypot(b.x - x, b.z - z) < 5) s -= 20;
    if (!best || s > best.s) best = { x, z, s };
  }
  if (!best) return;
  const B = { id: ++E.seq, x: Math.round(best.x * 10) / 10, z: Math.round(best.z * 10) / 10, at: api.now + PAINT.dropMs };
  E.buckets.push(B);
  api.emit({ k: 'paint_drop', id: B.id, x: B.x, z: B.z, at: B.at });
}

registerServerMini<PaintState>({
  kind: 'PITTURA',
  ends: 'time',
  falls: 'none',
  init: (api) => ({
    tiles: PAINT_EMPTY.repeat(PAINT_N),
    order: api.ids().slice(0, PAINT_CHARS.length),
    last: {},
    stun: {},
    buckets: [],
    seq: 0,
    nextBucket: 0,
    dirty: false,
    sentAt: 0,
    scoreAt: 0,
  }),
  spawn: (_api, _id, i, n) => {
    // tutti intorno al centro, girati verso fuori (ognuno parte verso la sua fetta di quadro)
    const a = (i / n) * Math.PI * 2 + 0.4;
    return { x: Math.sin(a) * 4.5, y: 0, z: Math.cos(a) * 4.5, r: a };
  },
  play: (api) => {
    api.ext.nextBucket = api.now + 4000;
  },
  tick(api) {
    const E = api.ext;
    const now = api.now;
    let changed = false;
    const fx: number[] = [];
    // il rullo colora le piastrelle sotto ognuno (lungo tutto il tratto dall'ultima volta)
    for (const id of api.inGame()) {
      const who = E.order.indexOf(id);
      const p = api.pos(id);
      if (who < 0 || !p) continue;
      if (p.y > 0.5 || now < (E.stun[id] ?? 0)) {
        E.last[id] = null; // in volo o sbilanciato: non colora (e all'atterraggio riparte da lì)
        continue;
      }
      const from = E.last[id];
      const d = from ? Math.hypot(p.x - from.x, p.z - from.z) : 0;
      const list: number[] = [];
      if (!from || d > 4) list.push(paintTileAt(p.x, p.z));
      else {
        const steps = Math.max(1, Math.ceil(d / 0.4));
        for (let s = 1; s <= steps; s++) list.push(paintTileAt(from.x + ((p.x - from.x) * s) / steps, from.z + ((p.z - from.z) * s) / steps));
      }
      E.last[id] = { x: p.x, z: p.z };
      paint(E, list, who, fx);
    }
    if (fx.length) api.emit({ k: 'paint_t', c: fx });
    // i secchi: ne cade uno ogni tanto (più spesso alla fine)
    if (now >= E.nextBucket && api.t > 2) {
      if (E.buckets.length < PAINT.maxBuckets) {
        newBucket(api);
        changed = true;
      }
      const late = api.stageEndsAt && api.stageEndsAt - now < 20_000 ? 0.65 : 1;
      E.nextBucket = now + api.rand(PAINT.every[0], PAINT.every[1]) * late;
    }
    // chi ci passa sopra: SPLASH!
    for (const B of [...E.buckets]) {
      if (now < B.at) continue;
      let taker: string | null = null;
      let bestD = PAINT.bucketPick;
      for (const id of api.inGame()) {
        const p = api.pos(id);
        if (!p || p.y > 1.6) continue;
        const d = Math.hypot(p.x - B.x, p.z - B.z);
        if (d < bestD) {
          bestD = d;
          taker = id;
        }
      }
      if (!taker) continue;
      E.buckets = E.buckets.filter((o) => o !== B);
      const who = E.order.indexOf(taker);
      const c: number[] = [];
      if (who >= 0) paint(E, paintTilesIn(B.x, B.z, PAINT.splashR, tmp), who, c);
      api.emit({ k: 'paint_splash', id: taker, b: B.id, x: B.x, z: B.z, c });
      changed = true;
    }
    // punteggi dal vivo (leggeri) ogni mezzo secondo
    if (now - E.scoreAt > 500) {
      E.scoreAt = now;
      const n = counts(E);
      const s: Record<string, number> = {};
      E.order.forEach((id, i) => n[i] && (s[id] = n[i]));
      api.emit({ k: 'paint_score', s });
    }
    // il pavimento intero al massimo ogni secondo (i cambi minuti sono già arrivati come effetti)
    if (E.dirty && now - E.sentAt >= PAINT.sendMs) {
      E.dirty = false;
      E.sentAt = now;
      changed = true;
    }
    return changed;
  },
  // lo schiaffo spinge e sbilancia: per un attimo il rullo non colora
  onPush(api, _by, hit) {
    const until = api.now + PAINT.stunMs;
    for (const id of hit) api.ext.stun[id] = until;
    if (hit.length) api.emit({ k: 'paint_dizzy', ids: hit, ms: PAINT.stunMs });
  },
  speed: (api, id) => (api.now < (api.ext.stun[id] ?? 0) ? 0.55 : 1),
  bot(api, b) {
    const E = api.ext;
    const me = b.body;
    const now = api.now;
    const m = b.mem as BotMem;
    const who = E.order.indexOf(b.id);
    const mine = PAINT_CHARS[who];
    // bloccato contro qualcuno o contro la cornice: cambia idea
    if (now > (m.stuckAt ?? 0)) {
      if (m.goal && Math.hypot(me.x - (m.stuckX ?? 99), me.z - (m.stuckZ ?? 99)) < 0.4) m.goal = undefined;
      m.stuckAt = now + 900;
      m.stuckX = me.x;
      m.stuckZ = me.z;
    }
    const reached = m.goal ? Math.hypot(m.goal.x - me.x, m.goal.z - me.z) < 0.6 : true;
    const bucketGone = m.goal?.bucket !== undefined && !E.buckets.some((o) => o.id === m.goal!.bucket);
    if (!m.goal || reached || bucketGone || now >= b.thinkAt) {
      b.thinkAt = now + api.rand(700, 1500) * (1.3 - b.skill * 0.5);
      let best: { x: number; z: number; s: number; bucket?: number } | null = null;
      // un secchio vale tanto, se ci arrivo prima degli altri
      for (const B of E.buckets) {
        const d = Math.hypot(B.x - me.x, B.z - me.z);
        let rival = 99;
        for (const id of api.inGame()) {
          if (id === b.id) continue;
          const p = api.pos(id);
          if (p) rival = Math.min(rival, Math.hypot(B.x - p.x, B.z - p.z));
        }
        if (d > rival * (0.8 + b.skill * 0.5) && d > 4) continue;
        const s = 18 + b.skill * 10 - d * 1.1;
        if (!best || s > best.s) best = { x: B.x, z: B.z, s, bucket: B.id };
      }
      // zone con tante piastrelle non mie (quelle degli altri valgono un po' di più: gliele tolgo)
      const tries = 4 + Math.round(b.skill * 10);
      for (let i = 0; i < tries; i++) {
        const x = api.rand(-PAINT.half + 1.2, PAINT.half - 1.2);
        const z = api.rand(-PAINT.half + 1.2, PAINT.half - 1.2);
        let s = 0;
        for (const k of paintTilesIn(x, z, 2.2, tmp)) s += E.tiles[k] === mine ? 0 : E.tiles[k] === PAINT_EMPTY ? 1 : 1.25;
        // la strada per arrivarci conta anche lei (si colora camminando)
        const d = Math.hypot(x - me.x, z - me.z);
        for (let t = 0.25; t < 1; t += 0.25) {
          const k = paintTileAt(me.x + (x - me.x) * t, me.z + (z - me.z) * t);
          if (k >= 0 && E.tiles[k] !== mine) s += 0.8;
        }
        s -= d * 0.35;
        s += Math.random() * (1 - b.skill) * 6; // i meno bravi scelgono un po' a caso
        if (!best || s > best.s) best = { x, z, s };
      }
      if (best) m.goal = { x: best.x, z: best.z, bucket: best.bucket };
    }
    if (m.goal) api.go(b, m.goal.x, m.goal.z);
    // schiaffo a chi mi è vicino (soprattutto se è sul mio colore)
    if (now > (m.slapAt ?? 0)) {
      m.slapAt = now + api.rand(250, 500);
      let near: { x: number; z: number; d: number; on: boolean } | null = null;
      for (const id of api.inGame()) {
        if (id === b.id) continue;
        const p = api.pos(id);
        if (!p || Math.abs(p.y - me.y) > 1.2) continue;
        const d = Math.hypot(p.x - me.x, p.z - me.z);
        if (d < PHYS.pushRange - 0.4 && (!near || d < near.d)) near = { x: p.x, z: p.z, d, on: E.tiles[paintTileAt(p.x, p.z)] === mine };
      }
      if (near && Math.random() < (near.on ? 0.3 : 0.12) + b.skill * 0.3) {
        api.push(b, near.x, near.z);
        m.slapAt = now + api.rand(900, 2000);
      }
    }
    if (Math.random() < 0.002) b.input.jump = true;
  },
  rank: (api) => {
    // più piastrelle = più su (pari merito nello stesso gruppo)
    const E = api.ext;
    const n = counts(E);
    const groups = new Map<number, string[]>();
    for (const id of api.ids()) {
      const i = E.order.indexOf(id);
      const v = i >= 0 ? n[i] : 0;
      groups.set(v, [...(groups.get(v) ?? []), id]);
    }
    return [...groups.entries()].sort((a, b) => b[0] - a[0]).map(([, ids]) => ids);
  },
  view: (api) => ({ tiles: api.ext.tiles, order: api.ext.order, buckets: api.ext.buckets }),
});
