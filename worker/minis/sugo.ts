// 🍅 Sale il sugo (server): il sugo che sale, chi arriva sul coperchio, batticarne e mattarello, le molle dei bot, i bot che saltano
import {
  SUGO,
  SUGO_BASE,
  SUGO_LID,
  SUGO_N,
  SUGO_NONE,
  SUGO_PLATS,
  inSugoPlat,
  sugoAngle,
  sugoLevel,
  sugoPend,
  sugoPlatAt,
  sugoSweepAngle,
  type SugoPlat,
} from '../../src/data/minis/sugo';
import { PHYS } from '../../src/data/party3d';
import { registerServerMini, type MiniApi, type MiniBot } from './types';

interface SugoState {
  best: Record<string, number>; // quota più alta raggiunta (per la classifica di chi non arriva)
  order: string[]; // ordine d'arrivo sul coperchio
  hitAt: Record<string, number>; // ultimo colpo preso (batticarne, mattarello)
}

const DT = 1 / 15; // passo dei bot (il server gira 15 volte al secondo)
const PENDS = SUGO_PLATS.filter((p) => p.pend);
const SWEEPS = SUGO_PLATS.filter((p) => p.sweep);
const gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());

// ---------------------------------------------------------------- geometria per i bot

// centro e assi di una piattaforma all'istante t
function frame(p: SugoPlat, t: number) {
  const a = sugoAngle(p, t);
  const s = Math.sin(a);
  const c = Math.cos(a);
  return { x: p.rho * s, z: p.rho * c, tx: c, tz: -s, rx: s, rz: c };
}
// il punto della piattaforma p più vicino a (x, z), rientrato di "inset" dal bordo
function nearestOn(p: SugoPlat, x: number, z: number, t: number, inset: number) {
  const f = frame(p, t);
  const dx = x - f.x;
  const dz = z - f.z;
  if (p.disc) {
    const d = Math.hypot(dx, dz);
    const lim = Math.max(0, p.disc - inset);
    const k = d > lim ? lim / d : 1;
    return { x: f.x + dx * k, z: f.z + dz * k };
  }
  const attached = p.rho - p.hw <= SUGO.potR + 0.05;
  const hl = Math.max(0, p.hl - inset);
  const u = Math.max(-hl, Math.min(hl, dx * f.tx + dz * f.tz));
  const vMin = -p.hw + (attached ? PHYS.radius + 0.15 : inset);
  const v = Math.max(Math.min(vMin, 0), Math.min(Math.max(p.hw - inset, 0), dx * f.rx + dz * f.rz));
  return { x: f.x + f.tx * u + f.rx * v, z: f.z + f.tz * u + f.rz * v };
}
// dove si atterra sulla prossima (un po' dentro, dal lato da cui arrivo)
function landingPoint(target: number, x: number, z: number, t: number, inset: number) {
  if (target >= SUGO_N) {
    // il coperchio: verso l'asse del pentolone
    const d = Math.hypot(x, z) || 1;
    return { x: (x / d) * (SUGO.lidR - 1.2), z: (z / d) * (SUGO.lidR - 1.2) };
  }
  return nearestOn(SUGO_PLATS[target], x, z, t, inset);
}

// volo simulato a passi come la fisica dei bot: dopo quanti secondi si ricade alla quota h (rispetto allo stacco)
function flightTime(h: number, v0: number, dj: boolean): number | null {
  let y = 0;
  let vy = v0;
  let used = !dj;
  for (let k = 1; k < 70; k++) {
    if (!used && vy < 1.2) {
      vy = PHYS.jumpV * PHYS.doubleJump;
      used = true;
    }
    vy -= PHYS.gravity * DT;
    y += vy * DT;
    if (vy < 0 && y <= h) return k * DT;
    if (vy < 0 && y < h - 0.6) return null; // non ci arrivo
  }
  return null;
}
// apice del volo (salto singolo / doppio)
const APEX = (() => {
  const apex = (dj: boolean) => {
    let y = 0;
    let vy = PHYS.jumpV;
    let used = !dj;
    let best = 0;
    for (let k = 0; k < 70; k++) {
      if (!used && vy < 1.2) {
        vy = PHYS.jumpV * PHYS.doubleJump;
        used = true;
      }
      vy -= PHYS.gravity * DT;
      y += vy * DT;
      best = Math.max(best, y);
    }
    return best;
  };
  return { single: apex(false), double: apex(true) };
})();

// ---------------------------------------------------------------- il cervello del bot

interface Plan {
  tgt: number; // piattaforma su cui voglio atterrare (SUGO_N = coperchio)
  dj: boolean; // doppio salto all'apice
  djDone: boolean;
  off: { x: number; z: number }; // errore di mira (i più scarsi sbagliano di più)
}
interface Mem {
  cur: number; // dove sono (ultima piattaforma toccata)
  since: number; // da quando sono qui (ms)
  plan: Plan | null;
  wait: Record<number, number>; // decisioni prese davanti ai pendoli (1 = aspetto il momento giusto)
  wander: { x: number; z: number } | null;
}

function botBrain(api: MiniApi<SugoState>, b: MiniBot) {
  const me = b.body;
  const t = api.t;
  const M = b.mem as Mem;
  if (M.cur === undefined) {
    M.cur = SUGO_BASE;
    M.since = api.now;
    M.plan = null;
    M.wait = {};
    M.wander = null;
  }
  const mul = 0.85 + b.skill * 0.2;
  const vMax = PHYS.speed * mul;
  // arrivato: passeggia sul coperchio
  if (api.finished(b.id)) {
    if (!M.wander || Math.hypot(me.x - M.wander.x, me.z - M.wander.z) < 0.6 || Math.random() < 0.01) {
      const a = api.rand(0, Math.PI * 2);
      const r = api.rand(2.2, SUGO.lidR - 2);
      M.wander = { x: Math.sin(a) * r, z: Math.cos(a) * r };
    }
    if (me.y > SUGO.top - 0.5) api.go(b, M.wander.x, M.wander.z, 0.35);
    return;
  }
  if (me.ground) {
    const at = sugoPlatAt(me.x, me.z, t, me.y);
    if (at !== SUGO_NONE && at !== M.cur) {
      M.cur = at;
      M.since = api.now;
    }
    M.plan = null;
  }
  if (!me.ground) {
    flyBrain(api, b, M, vMax);
    return;
  }
  const cur = M.cur;
  const tgt = cur === SUGO_BASE ? 0 : cur + 1;
  if (cur === SUGO_LID) return;
  // sulla molla non si salta: ci pensa lei
  if (cur >= 0 && SUGO_PLATS[cur].k === 'molla') {
    api.go(b, SUGO_PLATS[cur].cx, SUGO_PLATS[cur].cz, 0.4);
    return;
  }
  const T = tgt < SUGO_N ? SUGO_PLATS[tgt] : null;
  const moving = !!T && !!(T.amp || T.spin);
  const h = (T ? T.y : SUGO.top) - me.y;
  const stuck = api.now - M.since > 5000; // fermo da troppo: si butta
  // che salto serve: singolo se basta (anche dal bordo), se no doppio all'apice
  // (lo snap sul bordo, 0,6 m, aiuta solo nei salti più alti del doppio)
  const tauS = h <= APEX.single - 0.18 ? flightTime(h, PHYS.jumpV, false) : null;
  const tauD = flightTime(h > APEX.double - 0.15 ? h - 0.55 : h, PHYS.jumpV, true);
  const inset = T?.disc ? 0.35 : T?.pend ? 0.45 : 1.0;
  const guess = (tauS ?? tauD ?? 0.6) + 0.05;
  let A = landingPoint(tgt, me.x, me.z, t + guess, inset);
  // da dove stacco: il bordo della mia piattaforma verso il punto d'arrivo
  const edge = (a: { x: number; z: number }) => (cur >= 0 ? nearestOn(SUGO_PLATS[cur], a.x, a.z, t, 0.4) : a);
  let P = edge(A);
  const fromEdge = Math.hypot(A.x - P.x, A.z - P.z);
  const dj = !(tauS && fromEdge / (tauS + 0.05) <= vMax * 0.95);
  let tau = (dj ? (tauD ?? 0.6) : (tauS ?? 0.6)) + 0.05;
  if (dj && moving) {
    A = landingPoint(tgt, me.x, me.z, t + tau, inset);
    P = edge(A);
  }
  if (cur === SUGO_BASE) P = A;
  const d = Math.hypot(A.x - me.x, A.z - me.z);
  const atEdge = cur >= 0 && Math.hypot(P.x - me.x, P.z - me.z) < 0.45;
  if (dj && !tauD) tau = 0.6;
  const need = d / tau; // velocità orizzontale che serve
  // batticarne: sulla lasagna aspetto in una delle zone sicure in fondo che il batticarne si allontani, poi corro
  // (i più scarsi a volte non guardano o partono in ritardo; i più bravi se sta per prenderli ci saltano sopra)
  let danger = false;
  let duck = false;
  let sprint = false;
  if (cur >= 0 && SUGO_PLATS[cur].pend && !stuck) {
    const p = SUGO_PLATS[cur];
    M.wait[p.i] ??= Math.random() < 0.35 + b.skill * 0.65 ? 1 : 0;
    const myU = (me.x - p.cx) * p.cs - (me.z - p.cz) * p.sn;
    const myV = (me.x - p.cx) * p.sn + (me.z - p.cz) * p.cs;
    const pu = (P.x - p.cx) * p.cs - (P.z - p.cz) * p.sn;
    const dir = Math.sign(pu - myU) || 1;
    // corro fino a "goal" (lungo il giro): fra quanti decimi di secondo mi prende? (-1 = mai; nelle zone in fondo non arriva)
    const sim = (goal: number) => {
      for (let k = 0; k <= 14; k++) {
        const u = myU + Math.sign(goal - myU) * Math.min(Math.abs(goal - myU), vMax * k * 0.1);
        if (Math.abs(u) > SUGO.pendSafe && (k > 0 || Math.sign(u) === Math.sign(goal))) return -1;
        const pe = sugoPend(p, t + k * 0.1);
        if (pe.y < p.y + 2.4 && Math.abs(pe.u - u) < SUGO.pendHit + 0.35) return k;
      }
      return -1;
    };
    const fwd = sim(pu);
    sprint = true;
    if (M.wait[p.i] && fwd >= 0) {
      if (Math.abs(myU) > SUGO.pendSafe - 0.05) danger = true; // al sicuro: aspetto
      else {
        const backU = -dir * (p.hl - 0.5);
        const back = sim(backU);
        if (back < 0 || back > fwd + 2) {
          // torno indietro nella zona sicura
          api.go(b, p.cx + p.cs * backU + p.sn * myV, p.cz - p.sn * backU + p.cs * myV);
          return;
        }
        if (fwd <= 3 && Math.random() < b.skill) duck = true;
      }
    }
  }
  if (duck) {
    b.input.jump = true;
    api.go(b, P.x, P.z);
    M.plan = { tgt: M.cur, dj: true, djDone: false, off: { x: 0, z: 0 } };
    return;
  }
  // mattarello sulla pizza: si salta quando sta per arrivare
  let hop = false;
  if (cur >= 0 && SUGO_PLATS[cur].sweep) {
    const p = SUGO_PLATS[cur];
    const dx = me.x - p.cx;
    const dz = me.z - p.cz;
    if (Math.hypot(dx, dz) < SUGO.sweepR + 0.6) {
      const phi = Math.atan2(dx, dz);
      const th = sugoSweepAngle(p, t);
      const ahead = ((((p.sweep > 0 ? phi - th : th - phi) % Math.PI) + Math.PI) % Math.PI) / Math.abs(p.sweep);
      if (ahead < 0.3 + (1 - b.skill) * api.rand(-0.12, 0.25) && ahead > 0.04) hop = Math.random() < 0.6 + b.skill * 0.5;
    }
  }
  if (hop) {
    b.input.jump = true;
    api.go(b, P.x, P.z, 0.5);
    return;
  }
  if (danger) return; // fermo nella zona sicura
  // salto: quando il punto d'arrivo è a tiro (o sono sul bordo); chi è scarso sbaglia la misura
  const reach = vMax * tau;
  const ok = need <= vMax * (moving ? 0.98 : 1.02) || stuck;
  if ((d <= reach * 0.72 || atEdge) && ok) {
    const err = 1 + gauss() * (0.03 + (1 - b.skill) * 0.16);
    const s = Math.min(vMax, need * err);
    const dx = A.x - me.x;
    const dz = A.z - me.z;
    b.input.x = (dx / (d || 1)) * (s / (PHYS.speed * mul));
    b.input.z = (dz / (d || 1)) * (s / (PHYS.speed * mul));
    b.input.jump = true;
    const sloppy = (1 - b.skill) * 0.9;
    M.plan = { tgt, dj: dj && !(Math.random() < (1 - b.skill) * 0.08), djDone: false, off: { x: api.rand(-sloppy, sloppy), z: api.rand(-sloppy, sloppy) } };
    return;
  }
  // non ancora: verso il bordo (sulle piattaforme che scorrono aspetto lì)
  if (atEdge) return;
  api.go(b, P.x, P.z, d > reach || sprint ? 1 : 0.75);
  // ogni tanto uno schiaffo a chi mi sta tra i piedi
  if (Math.random() < 0.006 * b.skill) {
    for (const id of api.inGame()) {
      if (id === b.id) continue;
      const o = api.pos(id);
      if (!o || Math.abs(o.y - me.y) > 0.8) continue;
      if (Math.hypot(o.x - me.x, o.z - me.z) < PHYS.pushRange - 0.6) {
        api.push(b, o.x, o.z);
        break;
      }
    }
  }
}

// in volo: correggo verso il punto d'arrivo, doppio salto all'apice (o per salvarmi)
function flyBrain(api: MiniApi<SugoState>, b: MiniBot, M: Mem, vMax: number) {
  const me = b.body;
  const t = api.t;
  let plan = M.plan;
  if (!plan) {
    // spinto o caduto: cerco la piattaforma sotto di me più vicina
    let best = -1;
    let bestD = 1e9;
    for (let i = SUGO_N - 1; i >= 0; i--) {
      const p = SUGO_PLATS[i];
      if (p.y > me.y + 0.3 || p.y < me.y - 20) continue;
      const q = nearestOn(p, me.x, me.z, t + 0.3, 0.5);
      const dd = Math.hypot(q.x - me.x, q.z - me.z) + (me.y - p.y) * 0.15;
      if (dd < bestD) {
        bestD = dd;
        best = i;
      }
    }
    if (best < 0) return;
    plan = M.plan = { tgt: best, dj: false, djDone: false, off: { x: 0, z: 0 } };
  }
  const T = plan.tgt < SUGO_N ? SUGO_PLATS[plan.tgt] : null;
  const ty = T ? T.y : SUGO.top;
  // quanto manca all'atterraggio (stima con la velocità verticale attuale; se non ci arrivo, fino all'apice)
  const disc = me.vy * me.vy + 2 * PHYS.gravity * (me.y - ty);
  const left = Math.max(0.12, disc >= 0 ? (me.vy + Math.sqrt(disc)) / PHYS.gravity : Math.max(0, me.vy) / PHYS.gravity + 0.15);
  const A = landingPoint(plan.tgt, me.x, me.z, t + left, T?.disc ? 0.3 : 0.9);
  const ax = A.x + plan.off.x;
  const az = A.z + plan.off.z;
  const dx = ax - me.x;
  const dz = az - me.z;
  const d = Math.hypot(dx, dz);
  const want = Math.min(vMax, d / left);
  b.input.x = (dx / (d || 1)) * (want / vMax);
  b.input.z = (dz / (d || 1)) * (want / vMax);
  if ((me.airJumps ?? 0) < 1 && !plan.djDone) {
    if (plan.dj && me.vy < 1.2) {
      b.input.jump = true;
      plan.djDone = true;
    } else if (me.vy < -1 && me.y < ty + 0.25 && !(T ? inSugoPlat(T, me.x, me.z, t) : me.x * me.x + me.z * me.z < SUGO.lidR ** 2) && Math.random() < 0.4 + b.skill * 0.6) {
      // sto cadendo corto: doppio salto per salvarmi
      b.input.jump = true;
      plan.djDone = true;
    }
  }
}

// ---------------------------------------------------------------- il minigioco

registerServerMini<SugoState>({
  kind: 'SUGO',
  ends: 'all',
  falls: 'none', // fuori solo chi tocca il sugo
  init: () => ({ best: {}, order: [], hitAt: {} }),
  spawn: (_api, _id, i, n) => {
    // sulla focaccia, prima della prima fetta di pane, girati lungo il giro
    const rows = [9.4, 11.3, 13.2];
    const perRow = Math.max(1, Math.ceil(n / rows.length));
    const row = i % rows.length;
    const k = Math.floor(i / rows.length);
    const a = -1.0 + (perRow <= 1 ? 0.5 : k / (perRow - 1)) * 0.95 + row * 0.06;
    const r = rows[row];
    return { x: Math.sin(a) * r, y: 0, z: Math.cos(a) * r, r: a + Math.PI / 2 };
  },
  tick(api, dt) {
    const E = api.ext;
    const t = api.t;
    const lvl = sugoLevel(t);
    let changed = false;
    for (const id of api.inGame()) {
      const p = api.pos(id);
      if (!p) continue;
      // arrivato sul coperchio
      if (p.y >= SUGO.top - 0.25 && p.x * p.x + p.z * p.z <= (SUGO.lidR + 0.3) ** 2) {
        api.finish(id);
        E.order.push(id);
        E.best[id] = SUGO.top;
        api.emit({ k: 'sugo_top', id, n: E.order.length });
        changed = true;
        continue;
      }
      // nel sugo: fuori
      if (p.y < lvl - 0.05) {
        api.eliminate(id, 'sugo');
        api.emit({ k: 'sugo_splash', id, x: p.x, y: lvl, z: p.z });
        changed = true;
        continue;
      }
      if (p.y > (E.best[id] ?? -99)) E.best[id] = Math.round(p.y * 10) / 10;
      const hitOk = api.now - (E.hitAt[id] ?? 0) > 800 && !api.dodging(id);
      // batticarne a pendolo: ti rimanda indietro (o avanti) lungo il giro
      for (const q of PENDS) {
        if (!hitOk || p.y < q.y - 0.5 || p.y > q.y + 3) continue;
        const dx = p.x - q.cx;
        const dz = p.z - q.cz;
        const u = dx * q.cs - dz * q.sn;
        const v = dx * q.sn + dz * q.cs;
        if (Math.abs(v) > q.hw + 0.3) continue;
        const pe = sugoPend(q, t);
        if (Math.abs(u - pe.u) > SUGO.pendHit || pe.y > p.y + 2.3 || pe.y < p.y - 0.4) continue;
        E.hitAt[id] = api.now;
        const sg = Math.sign(pe.va || u - pe.u || 1);
        api.fling(id, { vx: q.cs * sg * 8.5, vy: 6, vz: -q.sn * sg * 8.5 });
        api.emit({ k: 'bonk', id, big: true });
        api.emit({ k: 'sugo_whack', id, i: q.i });
        break;
      }
      // mattarello che gira rasoterra sulla pizza
      for (const q of SWEEPS) {
        if (!hitOk || api.now - (E.hitAt[id] ?? 0) <= 800 || p.y < q.y - 0.3 || p.y > q.y + SUGO.sweepH + 0.35) continue;
        const dx = p.x - q.cx;
        const dz = p.z - q.cz;
        const rr = Math.hypot(dx, dz);
        if (rr > SUGO.sweepR + 0.4 || rr < 0.5) continue;
        const phi = Math.atan2(dx, dz);
        const a0 = sugoSweepAngle(q, t - dt);
        const a1 = sugoSweepAngle(q, t);
        const m = 0.55 / Math.max(rr, 0.8);
        const lo = Math.min(a0, a1) - m;
        if (((((phi - lo) % Math.PI) + Math.PI) % Math.PI) > Math.abs(a1 - a0) + 2 * m) continue;
        E.hitAt[id] = api.now;
        const sg = Math.sign(q.sweep);
        api.fling(id, { vx: sg * Math.cos(phi) * 4.5, vy: 6.5, vz: -sg * Math.sin(phi) * 4.5 });
        api.emit({ k: 'bonk', id });
      }
    }
    // le molle di spaghetti lanciano i bot (il mio personaggio lo lancia il mio telefono)
    for (const b of api.bots) {
      if (!api.alive(b.id) || api.finished(b.id) || !b.body.ground) continue;
      const i = sugoPlatAt(b.body.x, b.body.z, t, b.body.y);
      if (i < 0 || SUGO_PLATS[i].k !== 'molla') continue;
      b.body.vy = SUGO.springV;
      b.body.ground = false;
      b.body.airJumps = 0;
      // (come chi tiene avanti il joystick: parte già verso la piattaforma dopo)
      const T = SUGO_PLATS[i + 1];
      if (T) {
        const tau = flightTime(T.y - b.body.y, SUGO.springV, false) ?? 0.75;
        const A = landingPoint(i + 1, b.body.x, b.body.z, t + tau, T.disc ? 0.35 : 1.2);
        const dx = A.x - b.body.x;
        const dz = A.z - b.body.z;
        const d = Math.hypot(dx, dz) || 1;
        const v = Math.min(PHYS.speed * (0.85 + b.skill * 0.2), d / tau) * (1 + gauss() * (1 - b.skill) * 0.12);
        b.body.vx = (dx / d) * v;
        b.body.vz = (dz / d) * v;
      }
      const sloppy = (1 - b.skill) * 0.8;
      b.mem.plan = { tgt: i + 1, dj: false, djDone: false, off: { x: api.rand(-sloppy, sloppy), z: api.rand(-sloppy, sloppy) } };
      api.emit({ k: 'sugo_boing', i, id: b.id });
    }
    return changed;
  },
  bot: botBrain,
  rank: (api) => {
    // prima chi è arrivato (in ordine), poi chi è salito di più (a mezzo metro: pari merito)
    const E = api.ext;
    const groups: string[][] = E.order.map((id) => [id]);
    const rest = api.ids().filter((id) => !E.order.includes(id));
    const byH = new Map<number, string[]>();
    for (const id of rest) {
      const h = Math.round((E.best[id] ?? 0) * 2);
      byH.set(h, [...(byH.get(h) ?? []), id]);
    }
    for (const [, ids] of [...byH.entries()].sort((a, b) => b[0] - a[0])) groups.push(ids);
    return groups;
  },
});


