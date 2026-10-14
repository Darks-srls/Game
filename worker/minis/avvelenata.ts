// 🟤 Palla avvelenata (server): le 4 polpette (a terra, in mano, in volo), i lanci con la parabola esatta,
// chi viene colpito, le prese al volo con lo scatto, la fine quando una squadra è tutta fuori, i bot
import { AVV, flyAt } from '../../src/data/minis/avvelenata';
import { bindSide } from '../../src/data/minis/squadre';
import { PHYS } from '../../src/data/party3d';
import { gauss, mates, splitTeams, teamRank, trackHumans, velOf } from './squadre';
import { registerServerMini, type MiniApi, type MiniBot } from './types';

// st: 0 a terra (o rimbalza: non avvelena), 1 in mano a h, 2 in volo (lanciata da "by" della squadra "team")
type Ball = { x: number; y: number; z: number; vx: number; vy: number; vz: number; st: number; h: string | null; by: string | null; team: number; t0: number; seq: number; f: Fly | null };
type Fly = { x: number; y: number; z: number; vx: number; vy: number; vz: number };
interface AvvState {
  team: Record<string, number>;
  balls: Ball[];
  outs: Record<string, number>; // eliminazioni fatte (bonus personale)
  hitOut: string[]; // eliminati dalle palle (gli altri sono usciti dalla partita)
  reload: Record<string, number>;
  seq: number;
}
type Api = MiniApi<AvvState>;

const R = AVV.ballR;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const r2 = (v: number) => Math.round(v * 100) / 100;
const heldBy = (E: AvvState, id: string) => E.balls.findIndex((b) => b.st === 1 && b.h === id);

function newBall(x: number): Ball {
  return { x, y: R, z: 0, vx: 0, vy: 0, vz: 0, st: 0, h: null, by: null, team: -1, t0: 0, seq: 0, f: null };
}

// LANCIA: la polpetta parte dalla mano verso l'angolo a (mira già fatta dal telefono o dal bot)
function throwBall(api: Api, by: string, a: number): boolean {
  const E = api.ext;
  if (api.stage !== 'PLAY' || !api.alive(by) || !Number.isFinite(a) || api.now < (E.reload[by] ?? 0) - 100) return false;
  const i = heldBy(E, by);
  const p = api.pos(by);
  if (i < 0 || !p) return false;
  const B = E.balls[i];
  const dx = Math.sin(a);
  const dz = Math.cos(a);
  const f: Fly = { x: r2(p.x + dx * 0.7), y: r2(p.y + 1.5), z: r2(p.z + dz * 0.7), vx: r2(dx * AVV.speed), vy: AVV.lift, vz: r2(dz * AVV.speed) };
  Object.assign(B, { x: f.x, y: f.y, z: f.z, vx: f.vx, vy: f.vy, vz: f.vz, st: 2, h: null, by, team: E.team[by], t0: api.now, seq: ++E.seq, f });
  E.reload[by] = api.now + AVV.reload;
  const b = api.bot(by);
  if (b) {
    b.pushAnimUntil = api.now + 300;
    b.body.r = a;
  }
  api.emit({ k: 'avv_throw', i, by, ...f, at: api.now, seq: B.seq });
  return true;
}

// la palla smette di avvelenare: rimbalza e rotola (la fisica la fa rollStep)
function kill(B: Ball) {
  B.st = 0;
  B.by = null;
  B.f = null;
}

// la palla in volo: parabola esatta, contro gli avversari (sul tratto percorso), i muri e il pavimento
function flyStep(api: Api, B: Ball, i: number): boolean {
  const E = api.ext;
  const f = B.f!;
  const tau = (api.now - B.t0) / 1000;
  const n = flyAt(f, tau);
  const ox = B.x;
  const oy = B.y;
  const oz = B.z;
  for (const id of api.inGame()) {
    if (E.team[id] === B.team || E.team[id] === undefined) continue;
    const p = api.pos(id);
    if (!p) continue;
    const sx = n.x - ox;
    const sz = n.z - oz;
    const u = clamp(((p.x - ox) * sx + (p.z - oz) * sz) / (sx * sx + sz * sz || 1), 0, 1);
    const cx = ox + sx * u;
    const cz = oz + sz * u;
    const cy = oy + (n.y - oy) * u;
    if (Math.hypot(p.x - cx, p.z - cz) > AVV.hitR || cy < p.y - 0.3 || cy > p.y + 2.3) continue;
    const thrower = B.by;
    if (api.dodging(id)) {
      // presa al volo! la palla è sua (se ha già le mani piene cade lì) e fuori chi l'ha lanciata
      kill(B);
      if (heldBy(E, id) < 0) {
        B.st = 1;
        B.h = id;
      } else Object.assign(B, { x: p.x, y: 1.2, z: p.z, vx: 0, vy: 0, vz: 0 });
      if (thrower && api.alive(thrower)) {
        E.outs[id] = (E.outs[id] ?? 0) + 1;
        E.hitOut.push(thrower);
        api.eliminate(thrower, 'preso');
      }
      api.emit({ k: 'avv_catch', id, by: thrower, i, x: cx, y: cy, z: cz });
      return true;
    }
    // colpito: fuori, e la palla rimbalza via
    if (thrower) E.outs[thrower] = (E.outs[thrower] ?? 0) + 1;
    E.hitOut.push(id);
    api.eliminate(id, 'colpito');
    kill(B);
    Object.assign(B, { x: cx, y: Math.max(R, cy), z: cz, vx: -f.vx * 0.2, vy: 3.5, vz: -f.vz * 0.2 });
    api.emit({ k: 'avv_hit', id, by: thrower, i, x: cx, y: cy, z: cz });
    return true;
  }
  B.x = n.x;
  B.y = n.y;
  B.z = n.z;
  B.vx = f.vx;
  B.vy = f.vy - AVV.gravity * tau;
  B.vz = f.vz;
  const wallX = Math.abs(B.x) > AVV.halfX - R;
  const wallZ = Math.abs(B.z) > AVV.halfZ - R;
  if (wallX || wallZ || B.y <= R || api.now - B.t0 > AVV.maxFly) {
    // muro o pavimento: rimbalza e non avvelena più
    if (wallX) {
      B.x = Math.sign(B.x) * (AVV.halfX - R);
      B.vx = -B.vx * 0.5;
    }
    if (wallZ) {
      B.z = Math.sign(B.z) * (AVV.halfZ - R);
      B.vz = -B.vz * 0.5;
    }
    if (B.y <= R) {
      B.y = R;
      B.vy = Math.abs(B.vy) * 0.45;
    }
    kill(B);
    api.emit({ k: 'avv_land', i, x: B.x, y: B.y, z: B.z });
    return true;
  }
  return false;
}

// a terra: rimbalzi, attrito, sponde; chi ha già una palla in mano la spinge via coi piedi
function rollStep(api: Api, B: Ball, dt: number) {
  const E = api.ext;
  for (let k = 0; k < 2; k++) {
    const h = dt / 2;
    B.vy -= 18 * h;
    B.x += B.vx * h;
    B.y += B.vy * h;
    B.z += B.vz * h;
    if (B.y <= R) {
      B.y = R;
      B.vy = B.vy < -2 ? -B.vy * 0.45 : 0;
      const fr = Math.exp(-2.4 * h);
      B.vx *= fr;
      B.vz *= fr;
    }
    if (Math.abs(B.x) > AVV.halfX - R) {
      B.x = Math.sign(B.x) * (AVV.halfX - R);
      B.vx = -B.vx * 0.6;
    }
    if (Math.abs(B.z) > AVV.halfZ - R) {
      B.z = Math.sign(B.z) * (AVV.halfZ - R);
      B.vz = -B.vz * 0.6;
    }
  }
  if (B.y > R + 0.3) return;
  for (const id of api.inGame()) {
    if (heldBy(E, id) < 0) continue;
    const p = api.pos(id);
    if (!p) continue;
    const dx = B.x - p.x;
    const dz = B.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d < R + PHYS.radius && d > 0.01) {
      B.x = p.x + (dx / d) * (R + PHYS.radius);
      B.z = p.z + (dz / d) * (R + PHYS.radius);
      B.vx += (dx / d) * 2.5;
      B.vz += (dz / d) * 2.5;
    }
  }
}

// ---------------------------------------------------------------- bot

// palla avversaria in arrivo: o niente (distratto), o scatto incontro al momento giusto (presa), o corsa di lato
function dodgeOrCatch(api: Api, b: MiniBot): boolean {
  const E = api.ext;
  const me = b.body;
  const t = E.team[b.id];
  for (const B of E.balls) {
    if (B.st !== 2 || B.team === t) continue;
    const rx = me.x - B.x;
    const rz = me.z - B.z;
    const v2 = B.vx * B.vx + B.vz * B.vz || 1;
    const tca = (rx * B.vx + rz * B.vz) / v2;
    if (tca < 0 || tca > 0.9) continue;
    const mx = rx - B.vx * tca;
    const mz = rz - B.vz * tca;
    if (Math.hypot(mx, mz) > 1.5) continue;
    if (b.mem.seen !== B.seq) {
      b.mem.seen = B.seq;
      const notice = Math.random() < 0.5 + b.skill * 0.45;
      b.mem.plan = !notice ? 0 : Math.random() < 0.05 + b.skill * 0.25 ? 1 : 2;
      // i bravi scattano proprio quando arriva (la finestra della presa dura poco)
      b.mem.planAt = api.now + Math.max(0, (tca - 0.22 + gauss() * (1.05 - b.skill) * 0.12) * 1000);
    }
    const sp = Math.sqrt(v2);
    if (b.mem.plan === 1) {
      if (api.now >= b.mem.planAt) {
        b.input.x = -B.vx / sp;
        b.input.z = -B.vz / sp;
        api.dash(b);
        b.mem.plan = 0;
      }
      return true;
    }
    if (b.mem.plan === 2) {
      // via dalla traiettoria, dalla parte dove sono già
      const px = -B.vz / sp;
      const pz = B.vx / sp;
      const s = Math.sign(mx * px + mz * pz) || (Math.random() < 0.5 ? 1 : -1);
      api.go(b, me.x + px * s * 3, me.z + pz * s * 3);
      if (tca < 0.3 && Math.random() < b.skill * 0.35) api.dash(b);
      return true;
    }
  }
  return false;
}

// con la palla in mano: verso la linea, scelgo un bersaglio, miro con l'anticipo e lancio
function attack(api: Api, b: MiniBot) {
  const E = api.ext;
  const me = b.body;
  const t = E.team[b.id];
  const side = t ? 1 : -1;
  const now = api.now;
  if (!b.mem.tgt || !api.alive(b.mem.tgt) || now > b.mem.tgtUntil) {
    const foes = api
      .inGame()
      .filter((id) => E.team[id] === 1 - t)
      .map((id) => ({ id, p: api.pos(id) }))
      .filter((o) => !!o.p)
      .sort((u, v) => Math.hypot(u.p!.x - me.x, u.p!.z - me.z) - Math.hypot(v.p!.x - me.x, v.p!.z - me.z));
    const pick = foes[Math.random() < 0.7 ? 0 : Math.min(foes.length - 1, 1)];
    b.mem.tgt = pick?.id ?? null;
    b.mem.tgtUntil = now + api.rand(1500, 3000);
    b.mem.throwAt = Math.max(b.mem.throwAt ?? 0, now + api.rand(1300, 2700) * (1.5 - b.skill));
  }
  const q = b.mem.tgt ? api.pos(b.mem.tgt) : null;
  if (!q) return;
  api.go(b, clamp(q.x * 0.6 + me.x * 0.4, -AVV.halfX + 1, AVV.halfX - 1), side * (1.4 + (1 - b.skill) * 2.6), 0.9);
  if (now < b.mem.throwAt || now < (E.reload[b.id] ?? 0)) return;
  const d = Math.hypot(q.x - me.x, q.z - me.z);
  if (d > 13) {
    b.mem.throwAt = now + 250;
    return;
  }
  const v = velOf(api, b.mem.tgt);
  const tf = d / AVV.speed;
  const lead = 0.35 + b.skill * 0.6;
  const ax = q.x + v.vx * tf * lead;
  const az = q.z + v.vz * tf * lead;
  throwBall(api, b.id, Math.atan2(ax - me.x, az - me.z) + gauss() * (0.05 + (1 - b.skill) * 0.16));
  b.mem.tgt = null;
  b.mem.throwAt = 0;
}

// senza palla: la più vicina nella mia metà (se un compagno non ci sta già andando), altrimenti indietro e di lato
function forage(api: Api, b: MiniBot) {
  const E = api.ext;
  const me = b.body;
  const t = E.team[b.id];
  const side = t ? 1 : -1;
  let best: Ball | null = null;
  let bd = Infinity;
  // avversari con la palla in mano (vicino alla linea si rischia di essere colpiti a bruciapelo)
  const armed: { x: number; z: number }[] = [];
  for (const B of E.balls) if (B.st === 1 && B.h && E.team[B.h] !== t) armed.push({ x: B.x, z: B.z });
  for (const B of E.balls) {
    if (B.st !== 0 || B.z * side < -(AVV.pickR - 0.65)) continue;
    // i più prudenti non vanno a prendere una palla sotto il naso di chi sta per lanciare
    if (Math.abs(B.z) < 3.5 && armed.some((a) => Math.hypot(a.x - B.x, a.z - B.z) < 4 + b.skill * 4) && Math.random() < 0.97) continue;
    const d = Math.hypot(B.x - me.x, B.z - me.z);
    let taken = false;
    for (const m of api.bots) if (m !== b && E.team[m.id] === t && m.mem.ball === B && Math.hypot(B.x - m.body.x, B.z - m.body.z) < d) taken = true;
    if (!taken && d < bd) {
      bd = d;
      best = B;
    }
  }
  b.mem.ball = best;
  if (best) {
    api.go(b, best.x, side * Math.max(Math.abs(best.z) * (best.z * side > 0 ? 1 : 0), AVV.line + 0.6));
    if (bd > 6 && Math.random() < 0.02 * b.skill) api.dash(b);
    return;
  }
  // in attesa: lontano dalla linea, ognuno nella sua corsia, sempre un po' in movimento
  const k = Math.max(0, mates(api, E.team, t).indexOf(b.id));
  const threat = E.balls.some((B) => B.st === 1 && B.h && E.team[B.h] !== t);
  const z = side * ((threat ? 7 : 5) + (k % 3) * 1.4);
  const x = (((k * 3) % 5) - 2) * 3 + Math.sin(api.now / 900 + k * 2) * 1.8;
  api.go(b, clamp(x, -AVV.halfX + 1, AVV.halfX - 1), clamp(z, -AVV.halfZ + 1, AVV.halfZ - 1), 0.75);
}

registerServerMini<AvvState>({
  kind: 'AVVELENATA',
  ends: 'time', // la fine la decide il tick: una squadra senza nessuno in piedi
  falls: 'none',
  init: (api) => ({ team: splitTeams(api), balls: [-4.5, -1.5, 1.5, 4.5].map(newBall), outs: {}, hitOut: [], reload: {}, seq: 0 }),
  // ognuno in fondo alla sua metà, girato verso la linea
  spawn: (api, id) => {
    const E = api.ext;
    const t = E.team[id] ?? 0;
    const list = mates(api, E.team, t);
    const k = Math.max(0, list.indexOf(id));
    const m = list.length;
    const x = m <= 1 ? 0 : -AVV.halfX + 1.6 + ((AVV.halfX * 2 - 3.2) * k) / (m - 1);
    return { x, y: 0, z: (t ? 1 : -1) * (8 + (k % 2) * 1.6), r: t ? Math.PI : 0 };
  },
  play: (api) => {
    for (const [i, B] of api.ext.balls.entries()) api.setObj(`avv_b${i}`, { x: B.x, y: B.y, z: B.z, r: 0, a: 0 });
  },
  tick(api, dt) {
    const E = api.ext;
    let changed = false;
    trackHumans(api);
    E.balls.forEach((B, i) => {
      if (B.st === 1) {
        // in mano: se chi la tiene è uscito, cade lì
        const p = B.h ? api.pos(B.h) : null;
        if (!B.h || !api.alive(B.h) || !p) {
          kill(B);
          B.h = null;
          B.vx = B.vz = 0;
          changed = true;
        } else {
          B.x = p.x;
          B.y = p.y + 1.2;
          B.z = p.z;
          return;
        }
      }
      if (B.st === 2) {
        if (flyStep(api, B, i)) changed = true;
      } else rollStep(api, B, dt);
      api.setObj(`avv_b${i}`, { x: r2(B.x), y: r2(B.y), z: r2(B.z), r: 0, a: B.st });
    });
    // si prende una palla a terra toccandola (una alla volta)
    for (const id of api.inGame()) {
      if (heldBy(E, id) >= 0) continue;
      const p = api.pos(id);
      if (!p) continue;
      const i = E.balls.findIndex((B) => B.st === 0 && Math.hypot(B.x - p.x, B.z - p.z) < AVV.pickR && B.y < p.y + 2.2 && B.y > p.y - 1);
      if (i < 0) continue;
      E.balls[i].st = 1;
      E.balls[i].h = id;
      E.reload[id] = Math.max(E.reload[id] ?? 0, api.now + AVV.ready);
      api.emit({ k: 'avv_pick', id, i });
      changed = true;
    }
    // fine: una squadra non ha più nessuno in piedi
    const alive = [0, 0];
    for (const id of api.inGame()) if (E.team[id] !== undefined) alive[E.team[id]]++;
    if (alive[0] === 0 || alive[1] === 0) {
      api.end();
      return true;
    }
    return changed;
  },
  // il clic col mouse (schiaffo) lancia la palla verso dove guardo, con la mira assistita
  push: (api, by) => {
    const E = api.ext;
    const p = api.pos(by);
    if (heldBy(E, by) < 0 || !p) return false;
    let a = p.r;
    let best = 0.35;
    for (const id of api.inGame()) {
      if (E.team[id] === E.team[by]) continue;
      const q = api.pos(id);
      if (!q) continue;
      const da = Math.atan2(Math.sin(Math.atan2(q.x - p.x, q.z - p.z) - p.r), Math.cos(Math.atan2(q.x - p.x, q.z - p.z) - p.r));
      if (Math.abs(da) < best) {
        best = Math.abs(da);
        const v = velOf(api, id);
        const tf = Math.hypot(q.x - p.x, q.z - p.z) / AVV.speed;
        a = Math.atan2(q.x + v.vx * tf - p.x, q.z + v.vz * tf - p.z);
      }
    }
    return throwBall(api, by, a);
  },
  actions: {
    MG_AVV_LANCIA: (api, me, payload) => throwBall(api, me, Number(payload?.a)),
  },
  bot(api, b) {
    const E = api.ext;
    const t = E.team[b.id];
    if (t === undefined) return;
    bindSide(b.body, t);
    if (dodgeOrCatch(api, b)) return;
    if (heldBy(E, b.id) >= 0) attack(api, b);
    else forage(api, b);
  },
  rank: (api) => {
    const E = api.ext;
    const alive = [0, 0];
    for (const id of api.ids()) if (api.alive(id) && E.team[id] !== undefined) alive[E.team[id]]++;
    return teamRank(api, E.team, alive, (id) => 2 * (E.outs[id] ?? 0), (id) => !api.alive(id) && !E.hitOut.includes(id));
  },
  view: (api, me) => {
    const E = api.ext;
    return {
      team: E.team,
      my: E.team[me],
      balls: E.balls.map((B) => [B.st, B.h, B.seq]),
      outs: E.outs,
    };
  },
});
