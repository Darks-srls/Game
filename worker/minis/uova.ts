// 🥚 Caccia alle uova (server): la gallona fa le uova, chi le prende, le consegne al nido, i furti,
// gli schiaffi che le fanno cadere e i bot con i ruoli (raccoglitori, ladri, difensori)
import { UOVA, eggValue, nestX } from '../../src/data/minis/uova';
import { PHYS } from '../../src/data/party3d';
import { mates, splitTeams, teamRank, trackHumans, velOf } from './squadre';
import { registerServerMini, type MiniApi, type MiniBot } from './types';

type Egg = { id: number; x: number; z: number; g: number; at: number; fx: number; fz: number }; // at = da quando si può prendere (prima vola)
interface UovaState {
  team: Record<string, number>;
  role: Record<string, 'g' | 't' | 'd'>; // bot: raccoglitore, ladro, difensore
  eggs: Egg[];
  carry: Record<string, number>; // chi porta un uovo: 0 normale, 1 d'oro
  nest: number[][]; // le uova nei due nidi (si ruba l'ultima arrivata)
  score: number[];
  brought: Record<string, number>; // uova portate al proprio nido (bonus personale)
  stealAt: Record<string, number>; // pausa tra un furto e l'altro
  seq: number;
  nextAt: number;
  dirty: boolean; // cambiato fuori dal tick (schiaffi)
}
type Api = MiniApi<UovaState>;

const r1 = (v: number) => Math.round(v * 10) / 10;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// un punto dell'aia valido per un uovo: dentro lo steccato e fuori dal covone
function eggSpot(x: number, z: number) {
  x = clamp(x, -UOVA.halfX + 0.9, UOVA.halfX - 0.9);
  z = clamp(z, -UOVA.halfZ + 0.9, UOVA.halfZ - 0.9);
  const d = Math.hypot(x, z);
  const min = UOVA.henR + 0.8;
  if (d < min) {
    x = d > 0.01 ? (x / d) * min : min;
    z = d > 0.01 ? (z / d) * min : 0;
  }
  return { x: r1(x), z: r1(z) };
}

// la gallona fa un uovo: vola dal covone a terra, intorno al centro (lontano dai nidi). Ogni tanto è d'oro (uno alla volta)
function layEgg(api: Api) {
  const E = api.ext;
  const gold = api.t > 5 && !E.eggs.some((e) => e.g) && Math.random() < 0.16 ? 1 : 0;
  const a = api.rand(0, Math.PI * 2);
  const r = api.rand(UOVA.henR + 1.4, 8.6);
  const p = eggSpot(clamp(Math.sin(a) * r * 1.1, -8.4, 8.4), Math.cos(a) * r);
  E.eggs.push({ id: ++E.seq, x: p.x, z: p.z, g: gold, at: api.now + UOVA.flyMs, fx: 0, fz: 0 });
  api.emit({ k: 'uova_lay', g: gold, x: p.x, z: p.z });
}

// chi porta un uovo e prende uno schiaffo lo perde: l'uovo salta via lì vicino (chi ha dato lo schiaffo è più vicino)
function dropEgg(api: Api, id: string, by: string | null) {
  const E = api.ext;
  const g = E.carry[id];
  if (g === undefined) return;
  delete E.carry[id];
  const p = api.pos(id) ?? { x: 0, z: 0 };
  const a = api.rand(0, Math.PI * 2);
  const k = api.rand(0.6, 1.4);
  const s = eggSpot(p.x + Math.sin(a) * k, p.z + Math.cos(a) * k);
  E.eggs.push({ id: ++E.seq, x: s.x, z: s.z, g, at: api.now + UOVA.flyMs, fx: r1(p.x), fz: r1(p.z) });
  api.emit({ k: 'uova_drop', id, by, g, x: s.x, z: s.z });
  E.dirty = true;
}

// l'avversario più vicino che rispetta il filtro
function closestFoe(api: Api, b: MiniBot, ok: (id: string, p: { x: number; y: number; z: number }) => boolean) {
  const E = api.ext;
  const t = E.team[b.id];
  let best: { id: string; x: number; z: number; d: number } | null = null;
  for (const id of api.inGame()) {
    if (E.team[id] === t || E.team[id] === undefined) continue;
    const p = api.pos(id);
    if (!p || Math.abs(p.y - b.body.y) > 1.6 || !ok(id, p)) continue;
    const d = Math.hypot(p.x - b.body.x, p.z - b.body.z);
    if (!best || d < best.d) best = { id, x: p.x, z: p.z, d };
  }
  return best;
}

// cammina verso (x, z) girando intorno al covone se è in mezzo; ritorna la distanza vera dalla meta
function goAround(api: Api, b: MiniBot, tx: number, tz: number, speed = 1) {
  const me = b.body;
  const dx = tx - me.x;
  const dz = tz - me.z;
  const L = Math.hypot(dx, dz);
  const u = clamp(-(me.x * dx + me.z * dz) / (L * L || 1), 0, 1);
  const cx = me.x + dx * u;
  const cz = me.z + dz * u;
  if (u > 0.02 && u < 0.98 && Math.hypot(cx, cz) < UOVA.henR + 1.1) {
    let nx = cx;
    let nz = cz;
    let n = Math.hypot(nx, nz);
    if (n < 0.05) {
      nx = -dz;
      nz = dx;
      n = Math.hypot(nx, nz) || 1;
    }
    const W = UOVA.henR + 1.8;
    api.go(b, (nx / n) * W, (nz / n) * W, speed);
  } else api.go(b, tx, tz, speed);
  return L;
}

// raccoglitore: l'uovo più conveniente (vicino, d'oro, verso casa) che un compagno non sta già andando a prendere
function gather(api: Api, b: MiniBot) {
  const E = api.ext;
  const me = b.body;
  const t = E.team[b.id];
  let best: Egg | null = null;
  let bs = Infinity;
  for (const e of E.eggs) {
    if (e.at - api.now > 350) continue;
    const d = Math.hypot(e.x - me.x, e.z - me.z);
    let taken = false;
    for (const m of api.bots) if (m !== b && E.team[m.id] === t && m.mem.egg === e.id && !(m.id in E.carry) && Math.hypot(e.x - m.body.x, e.z - m.body.z) < d) taken = true;
    if (taken) continue;
    const s = d - (e.g ? 7 : 0) + Math.abs(e.x - nestX(t)) * 0.18;
    if (s < bs) {
      bs = s;
      best = e;
    }
  }
  b.mem.egg = best?.id ?? null;
  if (!best) return false;
  const d = goAround(api, b, best.x, best.z);
  if (d > 7 && Math.random() < 0.025 * b.skill) api.dash(b);
  return true;
}

// ladro: al nido degli avversari (passando dalla parte opposta al difensore); se deve aspettare, gira lì intorno
function thieve(api: Api, b: MiniBot) {
  const E = api.ext;
  const t = E.team[b.id];
  const o = 1 - t;
  if (!E.nest[o].length) return false;
  const ex = nestX(o);
  const wait = api.now < (E.stealAt[b.id] ?? 0);
  const guard = closestFoe(api, b, (id, p) => Math.hypot(p.x - ex, p.z) < 4.5 && !(id in E.carry));
  const side = guard ? (guard.z > 0 ? -1 : 1) : Math.sin(api.now / 2000 + b.skill * 7) > 0 ? 1 : -1;
  const d = wait ? goAround(api, b, ex * 0.68, side * 3, 0.7) : goAround(api, b, ex, side * 0.9);
  if (guard && !wait && d < 5.5 && guard.d < 3.2 && Math.random() < 0.05 + b.skill * 0.12) api.dash(b);
  return true;
}

// difensore: insegue chi si avvicina al nido (o scappa con un uovo), rimette a posto le uova cadute lì vicino
function defend(api: Api, b: MiniBot) {
  const E = api.ext;
  const t = E.team[b.id];
  const hx = nestX(t);
  const thief = closestFoe(api, b, (id, p) => Math.hypot(p.x - hx, p.z) < (id in E.carry ? 9 : 6.5));
  if (thief) {
    const v = velOf(api, thief.id);
    const lead = 0.15 + b.skill * 0.3;
    api.go(b, thief.x + v.vx * lead, thief.z + v.vz * lead);
    if (thief.d > 3 && thief.d < 7 && Math.random() < 0.03 * b.skill) api.dash(b);
    return true;
  }
  const post = { x: hx - Math.sign(hx) * 3.4, z: Math.sin(api.now / 900 + b.skill * 5) * 2.4 };
  for (const e of E.eggs)
    if (e.at - api.now < 350 && Math.hypot(e.x - post.x, e.z - post.z) < 7) {
      b.mem.egg = e.id;
      goAround(api, b, e.x, e.z);
      return true;
    }
  api.go(b, post.x, post.z, 0.55);
  return true;
}

registerServerMini<UovaState>({
  kind: 'UOVA',
  ends: 'time',
  falls: 'none', // l'aia è chiusa dallo steccato: non si cade
  init: (api) => ({ team: splitTeams(api), role: {}, eggs: [], carry: {}, nest: [[], []], score: [0, 0], brought: {}, stealAt: {}, seq: 0, nextAt: 0, dirty: false }),
  // ognuno parte davanti al proprio nido, in colonna, girato verso la gallona
  spawn: (api, id) => {
    const E = api.ext;
    const t = E.team[id] ?? 0;
    const list = mates(api, E.team, t);
    const k = Math.max(0, list.indexOf(id));
    return { x: nestX(t) * 0.72, y: 0, z: (k - (list.length - 1) / 2) * 2.3, r: t ? -Math.PI / 2 : Math.PI / 2 };
  },
  play: (api) => {
    const E = api.ext;
    E.nextAt = api.now + 400;
    // ruoli dei bot: con tanti bot in squadra uno fa il difensore e uno il ladro, gli altri raccolgono
    for (const t of [0, 1]) {
      const list = api.bots.filter((b) => E.team[b.id] === t).sort((a, b) => b.skill - a.skill);
      const roles: ('g' | 't' | 'd')[] = list.length >= 4 ? ['t', 'd'] : list.length === 3 ? ['d'] : [];
      list.forEach((b, i) => (E.role[b.id] = roles[i] ?? 'g'));
    }
    // all'inizio la gallona ne fa subito qualcuna
    for (let i = 0; i < 4; i++) layEgg(api);
  },
  tick(api) {
    const E = api.ext;
    const now = api.now;
    let changed = E.dirty;
    E.dirty = false;
    trackHumans(api);
    if (now >= E.nextAt && E.eggs.length < UOVA.maxEggs) {
      layEgg(api);
      // poche uova in giro: così ce le si contende (e i furti contano)
      E.nextAt = now + (E.eggs.length < 3 ? api.rand(1000, 1600) : api.rand(1700, 2800));
      changed = true;
    }
    for (const id of api.inGame()) {
      const t = E.team[id];
      const p = api.pos(id);
      if (t === undefined || !p || p.y > 2.2) continue;
      if (id in E.carry) {
        // consegna: basta entrare nel proprio nido
        if (Math.hypot(p.x - nestX(t), p.z) < UOVA.nestR + 0.25) {
          const g = E.carry[id];
          delete E.carry[id];
          E.nest[t].push(g);
          E.score[t] += eggValue(g);
          E.brought[id] = (E.brought[id] ?? 0) + 1;
          api.emit({ k: 'uova_dep', id, team: t, g });
          changed = true;
        }
        continue;
      }
      // un uovo a terra (già atterrato) a portata di mano
      let best = -1;
      let bd = UOVA.pickR;
      for (let i = 0; i < E.eggs.length; i++) {
        const e = E.eggs[i];
        if (now < e.at) continue;
        const d = Math.hypot(p.x - e.x, p.z - e.z);
        if (d < bd) {
          bd = d;
          best = i;
        }
      }
      if (best >= 0) {
        const [e] = E.eggs.splice(best, 1);
        E.carry[id] = e.g;
        api.emit({ k: 'uova_pick', id, g: e.g });
        changed = true;
        continue;
      }
      // furto: si tocca il nido degli avversari (una volta ogni 2 secondi a testa)
      const o = 1 - t;
      if (E.nest[o].length && now >= (E.stealAt[id] ?? 0) && Math.hypot(p.x - nestX(o), p.z) < UOVA.nestR + 0.25) {
        const g = E.nest[o].pop()!;
        E.score[o] -= eggValue(g);
        E.carry[id] = g;
        E.stealAt[id] = now + UOVA.stealEvery;
        api.emit({ k: 'uova_steal', id, team: o, g });
        changed = true;
      }
    }
    // chi esce dalla partita lascia cadere il suo uovo
    for (const id of Object.keys(E.carry)) if (!api.alive(id)) dropEgg(api, id, null);
    return changed || E.dirty;
  },
  // schiaffo a chi porta un uovo (della squadra avversaria): l'uovo cade
  onPush: (api, by, hit) => {
    const E = api.ext;
    for (const id of hit) if (id in E.carry && E.team[id] !== E.team[by]) dropEgg(api, id, by);
  },
  speed: (api, id) => (id in api.ext.carry ? UOVA.carry : 1),
  bot(api, b) {
    const E = api.ext;
    const t = E.team[b.id];
    if (t === undefined) return;
    const hx = nestX(t);
    const now = api.now;
    const carrying = b.id in E.carry;
    // schiaffo a chi porta un uovo degli avversari, o a chi ronza intorno al mio nido
    if (!carrying && now >= (b.mem.slapAt ?? 0)) {
      const foe = closestFoe(api, b, (id, p) => id in E.carry || Math.hypot(p.x - hx, p.z) < UOVA.nestR + 2.5);
      if (foe && foe.d < PHYS.pushRange - 0.5) {
        b.mem.slapAt = now + api.rand(250, 700) * (1.5 - b.skill);
        if (Math.random() < 0.35 + b.skill * 0.5) api.push(b, foe.x, foe.z);
      }
    }
    if (carrying) {
      // a casa! (se qualcuno mi sta addosso, scatto)
      goAround(api, b, hx, b.body.z * 0.3);
      const chaser = closestFoe(api, b, () => true);
      if (chaser && chaser.d < 3 && Math.random() < 0.1 * b.skill) api.dash(b);
      return;
    }
    const role = E.role[b.id] ?? 'g';
    if (role === 'd' && defend(api, b)) return;
    if (role === 't' && thieve(api, b)) return;
    if (gather(api, b)) return;
    // niente uova a terra: si va a rubare
    if (thieve(api, b)) return;
    api.go(b, hx * 0.3, Math.sin(now / 1500 + b.skill * 9) * 3, 0.6);
  },
  rank: (api) => {
    const E = api.ext;
    // +1 per ogni uovo portato al nido (fino a 6: le uova rubate e riportate girano tanto, conta di più vincere)
    return teamRank(api, E.team, E.score, (id) => Math.min(UOVA.maxBonus, E.brought[id] ?? 0), (id) => !api.alive(id));
  },
  view: (api, me) => {
    const E = api.ext;
    return {
      team: E.team,
      eggs: E.eggs.map((e) => [e.id, e.x, e.z, e.g, e.at, e.fx, e.fz]),
      carry: E.carry,
      nest: E.nest.map((n) => [n.length, n.filter((g) => g).length]),
      score: E.score,
      brought: E.brought,
      steal: E.stealAt[me] ?? 0,
    };
  },
});
