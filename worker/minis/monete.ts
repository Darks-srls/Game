// 🪙 Pioggia di monete (server): la pioggia, le forme di parmigiano, chi raccoglie, gli schiaffi che fanno cadere le monete, i bot
import { MON } from '../../src/data/minis/monete';
import { PHYS } from '../../src/data/party3d';
import { registerServerMini, type MiniApi, type MiniBot } from './types';

interface Coin {
  i: number;
  x: number;
  z: number;
  v: number; // valore
  at: number; // quando atterra (ms)
  fx?: number; // da dove schizza (monete perse)
  fz?: number;
}
interface Forma {
  i: number;
  x: number;
  z: number;
  at: number; // quando cade
}
interface MonState {
  coins: Coin[];
  formas: Forma[];
  n: Record<string, number>; // monete di ognuno
  next: number; // prossimo numero di oggetto
  coinAt: number; // prossima moneta
  rainAt: number; // prossimo acquazzone (tante monete in un punto)
  formaAt: number; // prossima forma di parmigiano
  stun: Record<string, number>; // schiacciato fino a (bot)
  guard: Record<string, number>; // appena derubato: per un attimo gli schiaffi non fanno perdere monete
  t0: number; // inizio della partita (i tempi nello stato sono relativi: stato più piccolo)
  sentAt: number;
  syncAt: number;
  dirty: boolean;
}
type Api = MiniApi<MonState>;

const r1 = (v: number) => Math.round(v * 10) / 10;
// moneta compatta: [numero, x, z, valore, quando atterra (ms dall'inizio), da x, da z]
const enc = (c: Coin, t0: number) =>
  c.fx === undefined ? [c.i, r1(c.x), r1(c.z), c.v, c.at - t0] : [c.i, r1(c.x), r1(c.z), c.v, c.at - t0, r1(c.fx), r1(c.fz ?? 0)];

// un punto libero della piazza (dentro i muretti, fuori dalla fontana)
function fit(x: number, z: number) {
  const m = MON.half - 1;
  x = Math.max(-m, Math.min(m, x));
  z = Math.max(-m, Math.min(m, z));
  const d = Math.hypot(x, z);
  const min = MON.fountainR + 0.8;
  if (d < min) {
    const k = d > 0.01 ? min / d : 0;
    if (k) {
      x *= k;
      z *= k;
    } else x = min;
  }
  return { x, z };
}
const randSpot = (api: Api) => fit(api.rand(-MON.half + 1, MON.half - 1), api.rand(-MON.half + 1, MON.half - 1));

function addCoins(api: Api, list: Coin[]) {
  if (!list.length) return;
  api.ext.coins.push(...list);
  api.ext.dirty = true;
  api.emit({ k: 'mo_drop', t0: api.ext.t0, c: list.map((c) => enc(c, api.ext.t0)) });
}

// monete perse: schizzano intorno a (x, z) e si possono riprendere
function scatter(api: Api, x: number, z: number, amount: number) {
  const E = api.ext;
  const pieces: number[] = [];
  let left = amount;
  while (left > 8 && pieces.length < 4) {
    pieces.push(MON.big);
    left -= MON.big;
  }
  while (left > 0 && pieces.length < 10) {
    pieces.push(1);
    left--;
  }
  for (let k = 0; left > 0; k = (k + 1) % pieces.length, left--) pieces[k]++;
  const list: Coin[] = pieces.map((v) => {
    const a = api.rand(0, Math.PI * 2);
    const d = api.rand(1.6, 3.8);
    const p = fit(x + Math.sin(a) * d, z + Math.cos(a) * d);
    return { i: E.next++, x: p.x, z: p.z, v, at: api.now + MON.flight, fx: x, fz: z };
  });
  addCoins(api, list);
}

// ---------------------------------------------------------------- bot

// direzione verso (dx, dz) che gira intorno alla fontana (solo se è davanti, prima della meta)
function steer(x: number, z: number, dx: number, dz: number) {
  let l = Math.hypot(dx, dz) || 1;
  const ux = dx / l;
  const uz = dz / l;
  let ax = ux;
  let az = uz;
  const ox = -x;
  const oz = -z;
  const along = ox * ux + oz * uz;
  if (along > -0.3 && along < Math.min(4, l + MON.fountainR)) {
    const perp = ox * uz - oz * ux;
    const clear = MON.fountainR + PHYS.radius + 0.5;
    if (Math.abs(perp) < clear) {
      const k = ((clear - Math.abs(perp)) / clear) * 2.2;
      const s = perp > 0 ? -1 : 1;
      ax += uz * s * k;
      az += -ux * s * k;
    }
  }
  l = Math.hypot(ax, az) || 1;
  return { x: ax / l, z: az / l };
}

function unstick(api: Api, b: MiniBot, dir: { x: number; z: number }) {
  const m = b.mem;
  const me = b.body;
  if (!m.chk || api.now - m.chk.t > 700) {
    if (m.chk && m.moving && Math.hypot(me.x - m.chk.x, me.z - m.chk.z) < 0.5) {
      const s = Math.random() < 0.5 ? 1 : -1;
      m.side = { until: api.now + 600, x: dir.z * s, z: -dir.x * s };
    }
    m.chk = { x: me.x, z: me.z, t: api.now };
  }
  if (m.side && api.now < m.side.until) return { x: m.side.x, z: m.side.z };
  return dir;
}

function botBrain(api: Api, b: MiniBot) {
  const E = api.ext;
  const me = b.body;
  const now = api.now;
  b.mem.moving = false;
  if ((E.stun[b.id] ?? 0) > now) return; // schiacciato: vede le stelline
  const v = PHYS.speed * (0.85 + b.skill * 0.2);
  // 1) una forma sta per cadermi addosso: via (i più bravi se ne accorgono prima)
  for (const f of E.formas) {
    const tl = f.at - now;
    const d = Math.hypot(me.x - f.x, me.z - f.z);
    if (tl > -50 && tl < 300 + b.skill * 1300 && d < MON.formaR + 1.1) {
      if (!b.mem.saw || b.mem.saw !== f.i) {
        b.mem.saw = f.i;
        b.mem.sawOk = Math.random() < 0.35 + b.skill * 0.65;
      }
      if (b.mem.sawOk) {
        let dx = me.x - f.x;
        let dz = me.z - f.z;
        if (Math.hypot(dx, dz) < 0.2) {
          dx = Math.random() - 0.5;
          dz = Math.random() - 0.5;
        }
        const dir = steer(me.x, me.z, dx, dz);
        b.input.x = dir.x;
        b.input.z = dir.z;
        b.mem.moving = true;
        if (tl < 600 && d < MON.formaR) api.dash(b);
        return;
      }
    }
  }
  // 2) scelgo la moneta che conviene (valore, distanza, chi ci arriva prima, pericoli)
  if (now >= b.thinkAt || !E.coins.some((c) => c.i === b.mem.coin)) {
    b.thinkAt = now + api.rand(220, 520) * (1.4 - b.skill * 0.6);
    const rivals: { x: number; z: number }[] = [];
    for (const id of api.inGame()) {
      if (id === b.id) continue;
      const p = api.pos(id);
      if (p) rivals.push(p);
    }
    let best: Coin | null = null;
    let bestS = 0;
    for (const c of E.coins) {
      const d = Math.hypot(c.x - me.x, c.z - me.z);
      const arrive = now + (d / v) * 1000;
      if (arrive > c.at + MON.life - 250) continue;
      const wait = Math.max(0, c.at - arrive) / 1000;
      // dentro il cerchio di una forma che cade quando ci sarei?
      let danger = false;
      for (const f of E.formas) if (Math.hypot(c.x - f.x, c.z - f.z) < MON.formaR + 0.6 && f.at > now - 100 && f.at < Math.max(arrive, c.at) + 900) danger = true;
      if (danger && Math.random() < 0.3 + b.skill * 0.7) continue;
      let rival = Infinity;
      for (const p of rivals) rival = Math.min(rival, Math.hypot(p.x - c.x, p.z - c.z));
      const contest = rival < d - 0.8 ? 0.2 + (1 - b.skill) * 0.4 : rival < d + 0.6 ? 0.7 : 1;
      let s = (c.v * contest) / (d / v + wait + 0.7);
      if (c.i === b.mem.coin) s *= 1.25; // un po' di costanza
      s *= 1 + (Math.random() - 0.5) * (1.2 - b.skill);
      if (s > bestS) {
        bestS = s;
        best = c;
      }
    }
    b.mem.coin = best?.i ?? null;
    if (!best && (!b.mem.wander || now > b.mem.wander.until)) {
      const p = randSpot(api);
      b.mem.wander = { x: p.x * 0.6, z: p.z * 0.6, until: now + 2500 };
    }
  }
  const c = E.coins.find((x) => x.i === b.mem.coin);
  const gx = c ? c.x : (b.mem.wander?.x ?? 0);
  const gz = c ? c.z : (b.mem.wander?.z ?? 0);
  const d = Math.hypot(gx - me.x, gz - me.z);
  if (c && d < 0.5 && c.at > now) return; // aspetto che atterri
  if (d > 0.3) {
    const dir = unstick(api, b, steer(me.x, me.z, gx - me.x, gz - me.z));
    const sp = c ? 1 : 0.7;
    b.input.x = dir.x * sp;
    b.input.z = dir.z * sp;
    b.mem.moving = true;
  }
  if (c && d > 3 && d < 7 && (c.v > 1 || Math.random() < 0.3) && Math.random() < 0.03 * b.skill) api.dash(b);
  // 3) schiaffo a chi è ricco e mi sta davanti
  if (now >= b.reactAt) {
    b.reactAt = now + api.rand(350, 800);
    let target: { x: number; z: number; n: number } | null = null;
    for (const id of api.inGame()) {
      if (id === b.id) continue;
      const p = api.pos(id);
      const n = E.n[id] ?? 0;
      if (!p || n < 4 || (E.guard[id] ?? 0) > now || Math.abs(p.y - me.y) > 1.5) continue;
      if (Math.hypot(p.x - me.x, p.z - me.z) > PHYS.pushRange - 0.5) continue;
      if (!target || n > target.n) target = { x: p.x, z: p.z, n };
    }
    if (target && Math.random() < 0.08 + b.skill * 0.25 + (target.n >= (E.n[b.id] ?? 0) ? 0.12 : 0)) api.push(b, target.x, target.z);
  }
}

registerServerMini<MonState>({
  kind: 'MONETE',
  ends: 'time',
  falls: 'none',
  init: (api) => ({ coins: [], formas: [], n: {}, next: 1, coinAt: 0, rainAt: 0, formaAt: 0, stun: {}, guard: {}, t0: api.now, sentAt: 0, syncAt: 0, dirty: false }),
  spawn: (_api, _id, i, n) => {
    const a = (i / n) * Math.PI * 2 + Math.PI / 4;
    return { x: Math.sin(a) * 8, y: 0, z: Math.cos(a) * 8, r: a + Math.PI };
  },
  play: (api) => {
    const E = api.ext;
    E.t0 = api.now;
    E.coinAt = api.now + 300;
    E.rainAt = api.now + api.rand(7000, 10000);
    E.formaAt = api.now + 5000;
    // si parte con qualche moneta già in volo
    addCoins(
      api,
      Array.from({ length: 6 }, (_, k) => {
        const p = randSpot(api);
        return { i: E.next++, x: p.x, z: p.z, v: 1, at: api.now + MON.warn + k * 150 };
      }),
    );
  },
  tick(api) {
    const E = api.ext;
    const now = api.now;
    const T = Math.min(1, api.t / 60); // 0 → 1 durante la partita
    // la pioggia (sempre più fitta)
    if (now >= E.coinAt && E.coins.length < 34) {
      E.coinAt = now + api.rand(420, 720) * (1 - T * 0.35);
      const list: Coin[] = [];
      const many = Math.random() < 0.25 ? 2 : 1;
      for (let k = 0; k < many; k++) {
        const p = randSpot(api);
        list.push({ i: E.next++, x: p.x, z: p.z, v: Math.random() < 0.07 ? MON.big : 1, at: now + MON.warn + k * 200 });
      }
      addCoins(api, list);
    }
    // l'acquazzone: tante monete tutte insieme in un punto (ci si azzuffa)
    if (now >= E.rainAt) {
      E.rainAt = now + api.rand(8000, 12000);
      const c = randSpot(api);
      const n = 6 + Math.floor(Math.random() * 3);
      const list: Coin[] = [];
      for (let k = 0; k < n; k++) {
        const a = api.rand(0, Math.PI * 2);
        const p = fit(c.x + Math.sin(a) * api.rand(0.3, 2.4), c.z + Math.cos(a) * api.rand(0.3, 2.4));
        list.push({ i: E.next++, x: p.x, z: p.z, v: k === 0 ? MON.big : 1, at: now + MON.warn + 300 + k * 90 });
      }
      addCoins(api, list);
      api.emit({ k: 'mo_rain', x: r1(c.x), z: r1(c.z) });
    }
    // le forme di parmigiano: cadono vicino a qualcuno (più spesso col tempo; a volte proprio sul più ricco)
    if (now >= E.formaAt) {
      E.formaAt = now + api.rand(4200, 6000) * (1 - T * 0.45);
      const ids = api.inGame();
      if (ids.length) {
        const rich = ids.reduce((a, c) => ((E.n[c] ?? 0) > (E.n[a] ?? 0) ? c : a), ids[0]);
        const who = Math.random() < 0.35 && (E.n[rich] ?? 0) > 2 ? rich : ids[Math.floor(Math.random() * ids.length)];
        const p = api.pos(who);
        if (p) {
          const a = api.rand(0, Math.PI * 2);
          const off = api.rand(0, 1.6);
          const q = fit(p.x + Math.sin(a) * off, p.z + Math.cos(a) * off);
          const f = { i: E.next++, x: q.x, z: q.z, at: now + MON.formaWarn };
          E.formas.push(f);
          E.dirty = true;
          api.emit({ k: 'mo_forma', i: f.i, x: r1(f.x), z: r1(f.z), at: f.at });
        }
      }
    }
    // la forma cade: chi è sotto è schiacciato, perde metà delle monete e vola via
    for (const f of E.formas) {
      if (now < f.at) continue;
      const hit: { id: string; lose: number }[] = [];
      for (const id of api.inGame()) {
        const p = api.pos(id);
        if (!p || p.y > 2.4) continue;
        const dx = p.x - f.x;
        const dz = p.z - f.z;
        const d = Math.hypot(dx, dz);
        if (d > MON.formaR) continue;
        if (api.dodging(id)) {
          api.emit({ k: 'dodge', id });
          continue;
        }
        const n = E.n[id] ?? 0;
        const lose = Math.ceil(n / 2);
        E.n[id] = n - lose;
        const ux = d > 0.1 ? dx / d : Math.sin(f.i);
        const uz = d > 0.1 ? dz / d : Math.cos(f.i);
        api.fling(id, { vx: ux * 8, vy: 8, vz: uz * 8 });
        E.stun[id] = now + 1300;
        if (lose) scatter(api, p.x, p.z, lose);
        hit.push({ id, lose });
      }
      api.emit({ k: 'mo_crush', i: f.i, x: r1(f.x), z: r1(f.z), hit });
    }
    if (E.formas.some((f) => now >= f.at)) {
      E.formas = E.formas.filter((f) => now < f.at);
      E.dirty = true;
    }
    // chi tocca una moneta atterrata la prende (se in due, il più vicino)
    const ids = api.inGame();
    const pos = ids.map((id) => api.pos(id));
    const taken: number[] = [];
    for (const c of E.coins) {
      if (now < c.at) continue;
      let best = -1;
      let bestD = MON.pickR * MON.pickR;
      for (let k = 0; k < ids.length; k++) {
        const p = pos[k];
        if (!p || p.y > 1.6 || (E.stun[ids[k]] ?? 0) > now + 900) continue;
        const dd = (p.x - c.x) ** 2 + (p.z - c.z) ** 2;
        if (dd < bestD) {
          bestD = dd;
          best = k;
        }
      }
      if (best >= 0) {
        const id = ids[best];
        E.n[id] = (E.n[id] ?? 0) + c.v;
        taken.push(c.i);
        api.emit({ k: 'mo_take', i: c.i, by: id, v: c.v });
      }
    }
    const before = E.coins.length;
    if (taken.length) E.coins = E.coins.filter((c) => !taken.includes(c.i));
    E.coins = E.coins.filter((c) => now < c.at + MON.life);
    if (E.coins.length !== before) E.dirty = true;
    // punti dal vivo come effetto (leggero); lo stato intero al massimo una volta al secondo
    if (now - E.sentAt > 500) {
      E.sentAt = now;
      api.emit({ k: 'mo_score', s: E.n });
    }
    if (E.dirty && now - E.syncAt > 1000) {
      E.dirty = false;
      E.syncAt = now;
      return true;
    }
    return false;
  },
  // lo schiaffo normale spinge; in più chi è colpito perde il 30% delle monete (almeno una), che schizzano intorno
  onPush(api, by, hit) {
    const E = api.ext;
    for (const id of hit) {
      const n = E.n[id] ?? 0;
      if (n <= 0 || (E.guard[id] ?? 0) > api.now) continue;
      const lose = Math.max(1, Math.round(n * 0.3));
      E.n[id] = n - lose;
      E.guard[id] = api.now + 1500;
      const p = api.pos(id);
      if (p) scatter(api, p.x, p.z, lose);
      api.emit({ k: 'mo_slap', id, by, lose });
    }
  },
  speed: (api, id) => ((api.ext.stun[id] ?? 0) > api.now ? 0.2 : 1),
  bot: botBrain,
  rank: (api) => {
    const groups = new Map<number, string[]>();
    for (const id of api.ids()) {
      const n = api.ext.n[id] ?? 0;
      groups.set(n, [...(groups.get(n) ?? []), id]);
    }
    return [...groups.entries()].sort((a, b) => b[0] - a[0]).map(([, ids]) => ids);
  },
  view: (api) => ({
    c: api.ext.coins.map((c) => enc(c, api.ext.t0)),
    f: api.ext.formas.map((f) => [f.i, r1(f.x), r1(f.z), f.at - api.ext.t0]),
    t0: api.ext.t0,
    n: api.ext.n,
    last: api.ext.next - 1,
  }),
});
