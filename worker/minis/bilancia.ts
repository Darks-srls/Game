// ⚖️ La bilancia (server): il piatto che pende col peso (giocatori e polpette), le polpette che cadono e rotolano, i bot
import { BIL, bilOn, bilY, setBilTilt } from '../../src/data/minis/bilancia';
import { PHYS } from '../../src/data/party3d';
import { registerServerMini, type MiniApi, type MiniBot } from './types';

interface Ball {
  id: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  on: boolean; // appoggiata sul piatto (rotola)
  sky: boolean; // sta ancora cadendo dall'alto (si vede il bersaglio per terra)
  roll: number; // giro su se stessa (solo grafica)
}
interface BilState {
  tx: number;
  tz: number;
  wx: number; // velocità dell'inclinazione
  wz: number;
  balls: Ball[];
  seq: number;
  nextBall: number;
  hitAt: Record<string, number>;
  slam: { a: number; at: number } | null; // la ciabattata della nonna sul bordo (angolo, quando)
  nextSlam: number;
}

// il piatto va verso la pendenza "giusta" per i pesi che ha sopra (gain × momento), come una molla smorzata
const STIFF = 1.3; // molla (periodo di oscillazione ~5 s)
const DAMP = 1.15; // smorzamento
const gain = (t: number) => 0.15 + 0.13 * Math.min(1, t / 70); // pendenza per un giocatore sul bordo: cresce col tempo
const ROLL = 22; // le polpette scendono lungo la pendenza (m/s² per unità di pendenza)
// inclinazione massima: da 15° a 20° (a 20° in salita si va quasi da fermi)
const maxTilt = (t: number) => Math.tan(((15 + 5 * Math.min(1, t / 75)) * Math.PI) / 180);

// chi pesa sul piatto: in piedi (o quasi) sopra il piatto
function weighs(p: { x: number; y: number; z: number } | null) {
  if (!p || !bilOn(p.x, p.z)) return false;
  const dy = p.y - bilY(p.x, p.z);
  return dy > -1 && dy < 2.2;
}

function spawnBall(api: MiniApi<BilState>) {
  const E = api.ext;
  // spesso vicino a qualcuno (così bisogna muoversi), a volte a caso
  let x = 0;
  let z = 0;
  const ids = api.inGame();
  const who = ids[Math.floor(Math.random() * ids.length)];
  const p = who ? api.pos(who) : null;
  if (p && Math.random() < 0.75) {
    const a = api.rand(0, Math.PI * 2);
    const d = api.rand(1.2, 3);
    x = p.x + Math.sin(a) * d;
    z = p.z + Math.cos(a) * d;
  } else {
    const a = api.rand(0, Math.PI * 2);
    const d = Math.sqrt(Math.random()) * 9;
    x = Math.sin(a) * d;
    z = Math.cos(a) * d;
  }
  const r = Math.hypot(x, z);
  if (r > 9.5) {
    x *= 9.5 / r;
    z *= 9.5 / r;
  }
  E.balls.push({ id: ++E.seq, x, y: BIL.ballDrop, z, vx: 0, vy: 0, vz: 0, on: false, sky: true, roll: 0 });
  api.emit({ k: 'bil_drop', id: E.seq, x, z });
}

const speedOf = (b: MiniBot) => PHYS.speed * (0.85 + b.skill * 0.2);

registerServerMini<BilState>({
  kind: 'BILANCIA',
  init: () => {
    setBilTilt(0, 0);
    return { tx: 0, tz: 0, wx: 0, wz: 0, balls: [], seq: 0, nextBall: 0, hitAt: {}, slam: null, nextSlam: 0 };
  },
  spawn: (_api, _id, i, n) => {
    // in cerchio, ben distribuiti: il piatto parte in equilibrio
    const a = (i / n) * Math.PI * 2;
    return { x: Math.sin(a) * 6.5, y: 0, z: Math.cos(a) * 6.5, r: a + Math.PI };
  },
  play: (api) => {
    api.ext.nextBall = api.now + 4500;
    api.ext.nextSlam = api.now + BIL.slamFrom * 1000;
  },
  tick(api, dt) {
    const E = api.ext;
    const t = api.t;
    let changed = false;
    // ---- il piatto: i pesi lo fanno pendere, il perno lo riporta piano in piano
    let mx = 0;
    let mz = 0;
    for (const id of api.inGame()) {
      const p = api.pos(id);
      if (!p || !weighs(p)) continue;
      mx += p.x;
      mz += p.z;
    }
    for (const b of E.balls)
      if (b.on) {
        mx += b.x * BIL.ballM;
        mz += b.z * BIL.ballM;
      }
    const G = gain(t);
    E.wx += (STIFF * ((G * mx) / BIL.r - E.tx) - DAMP * E.wx) * dt;
    E.wz += (STIFF * ((G * mz) / BIL.r - E.tz) - DAMP * E.wz) * dt;
    E.tx += E.wx * dt;
    E.tz += E.wz * dt;
    const tl = Math.hypot(E.tx, E.tz);
    const tMax = maxTilt(t);
    if (tl > tMax) {
      // fine corsa: il piatto si ferma (toglie la velocità che spinge oltre)
      E.tx *= tMax / tl;
      E.tz *= tMax / tl;
      const out = (E.wx * E.tx + E.wz * E.tz) / tMax;
      if (out > 0) {
        E.wx -= (out * E.tx) / tMax;
        E.wz -= (out * E.tz) / tMax;
      }
    }
    setBilTilt(E.tx, E.tz);
    api.setObj('bil_tilt', { x: E.tx, y: 0, z: E.tz, r: E.wx, a: E.wz });

    // ---- la ciabattata della nonna: si vede arrivare, poi il bordo va giù di colpo (e chi è lì vola via)
    if (!E.slam && api.now >= E.nextSlam - BIL.slamWarn) {
      // di solito dalla parte dove c'è più gente
      const a = Math.hypot(mx, mz) > 1.5 && Math.random() < 0.7 ? Math.atan2(mx, mz) + api.rand(-0.5, 0.5) : api.rand(0, Math.PI * 2);
      E.slam = { a: Math.round(a * 100) / 100, at: E.nextSlam };
      changed = true;
    }
    if (E.slam && api.now >= E.slam.at) {
      const sx = Math.sin(E.slam.a);
      const sz = Math.cos(E.slam.a);
      const imp = 0.34 + 0.22 * Math.min(1, t / 80);
      E.wx += sx * imp;
      E.wz += sz * imp;
      for (const id of api.inGame()) {
        const p = api.pos(id);
        if (!p || Math.hypot(p.x - sx * BIL.r, p.z - sz * BIL.r) > BIL.slamR || api.dodging(id)) continue;
        api.fling(id, { vx: sx * 8, vy: 8, vz: sz * 8 });
      }
      api.emit({ k: 'bil_slam', a: E.slam.a });
      E.slam = null;
      E.nextSlam = api.now + (Math.max(3.8, 9 - t * 0.07) + api.rand(0, 2)) * 1000;
      changed = true;
    }

    // ---- polpette: cadono dall'alto, sbattono sul piatto, rotolano giù
    if (api.now >= E.nextBall) {
      const live = E.balls.length;
      const max = t > 60 ? 6 : t > 40 ? 5 : 4;
      if (live < max) {
        spawnBall(api);
        if (t > 55 && live + 1 < max && Math.random() < 0.35) spawnBall(api);
        changed = true;
      }
      E.nextBall = api.now + Math.max(1500, 5000 - t * 45) + api.rand(0, 1200);
    }
    for (const b of E.balls) {
      if (!b.on) {
        const prev = b.y;
        b.vy -= BIL.ballG * dt;
        b.x += b.vx * dt;
        b.z += b.vz * dt;
        b.y += b.vy * dt;
        if (b.sky && bilOn(b.x, b.z)) {
          const py = bilY(b.x, b.z) + BIL.ballR;
          if (b.y <= py && prev >= py - 0.3) {
            b.y = py;
            b.on = true;
            b.sky = false;
            // il colpo fa sobbalzare il piatto
            const imp = Math.min(1, -b.vy / 15) * 0.06 * BIL.ballM;
            E.wx += (b.x / BIL.r) * imp;
            E.wz += (b.z / BIL.r) * imp;
            b.vy = 0;
            api.emit({ k: 'bil_thud', id: b.id, x: b.x, z: b.z });
            changed = true;
          }
        }
      } else {
        b.vx += E.tx * ROLL * dt;
        b.vz += E.tz * ROLL * dt;
        const f = 1 - 0.25 * dt;
        b.vx *= f;
        b.vz *= f;
        b.x += b.vx * dt;
        b.z += b.vz * dt;
        b.roll += (Math.hypot(b.vx, b.vz) * dt) / BIL.ballR;
        if (!bilOn(b.x, b.z)) {
          // giù dal bordo
          b.on = false;
          b.vy = -1;
          changed = true;
        } else b.y = bilY(b.x, b.z) + BIL.ballR;
      }
      api.setObj(`bil_b${b.id}`, { x: b.x, y: b.y, z: b.z, r: b.roll, a: Math.atan2(b.vx, b.vz) });
    }
    const before = E.balls.length;
    E.balls = E.balls.filter((b) => b.y > -16);
    if (E.balls.length !== before) changed = true;

    // ---- i bot travolti dalle polpette (i giocatori veri se ne accorgono sul telefono: vedi local)
    for (const b of E.balls) {
      if (b.y > 6) continue;
      const sp = Math.hypot(b.vx, b.vz);
      for (const bot of api.bots) {
        if (!api.alive(bot.id)) continue;
        const me = bot.body;
        const dx = me.x - b.x;
        const dz = me.z - b.z;
        const d = Math.hypot(dx, dz);
        if (d > BIL.ballR + PHYS.radius || me.y > b.y + BIL.ballR * 0.55 || me.y + 1.7 < b.y - BIL.ballR) continue;
        if (api.now - (E.hitAt[bot.id] ?? 0) < 650 || api.dodging(bot.id)) continue;
        E.hitAt[bot.id] = api.now;
        const nx = d > 0.01 ? dx / d : 1;
        const nz = d > 0.01 ? dz / d : 0;
        const pw = 8.5 + sp * 0.8 + (b.on ? 0 : 4);
        api.fling(bot.id, { vx: nx * pw + b.vx * 0.4, vy: 6, vz: nz * pw + b.vz * 0.4 });
        b.vx *= 0.6;
        b.vz *= 0.6;
        api.emit({ k: 'bil_bonk', id: bot.id, x: me.x, y: me.y, z: me.z });
      }
    }
    return changed;
  },
  // SCHIAFFO a una polpetta: parte rotolando verso dove guardi (e lo schiaffo normale vale lo stesso)
  push(api, by) {
    const p = api.pos(by);
    if (!p) return undefined;
    const fx = Math.sin(p.r);
    const fz = Math.cos(p.r);
    for (const b of api.ext.balls) {
      if (!b.on) continue;
      const dx = b.x - p.x;
      const dz = b.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > BIL.ballR + 1.9 || (dx * fx + dz * fz) / (d || 1) < 0.2 || Math.abs(b.y - BIL.ballR - p.y) > 1.5) continue;
      b.vx = fx * 8.5;
      b.vz = fz * 8.5;
      api.emit({ k: 'bil_kick', id: b.id, by, x: b.x, y: b.y, z: b.z });
    }
    return undefined;
  },
  bot(api, b) {
    const E = api.ext;
    const me = b.body;
    const m = b.mem;
    // il piatto che scende si stacca dai piedi: riaggancio
    if (!me.ground && me.vy <= 0 && m.wg && bilOn(me.x, me.z)) {
      const g = bilY(me.x, me.z);
      if (me.y > g && me.y - g < 0.5) {
        me.y = g;
        me.vy = 0;
        me.ground = true;
        me.airJumps = 0;
      }
    }
    m.wg = me.ground;
    if (!bilOn(me.x, me.z) || me.y < bilY(me.x, me.z) - 1.5) return; // sta cadendo
    const speed = speedOf(b);
    const r = Math.hypot(me.x, me.z);
    // la pendenza come la sente lui: i meno bravi se ne accorgono in ritardo
    const kk = Math.min(1, 0.066 / (0.15 + (1 - b.skill) * 0.7));
    m.tx = m.tx === undefined ? E.tx : m.tx + (E.tx - m.tx) * kk;
    m.tz = m.tz === undefined ? E.tz : m.tz + (E.tz - m.tz) * kk;
    const tl = Math.hypot(m.tx, m.tz);
    // distratto: per un attimo non fa niente (e scivola)
    if (api.now < (m.daze ?? 0)) return;
    // (più va avanti, più si stancano)
    const tired = 1 + api.t / 60;
    if (Math.random() < (0.007 * (1 - b.skill) + 0.0015) * tired) {
      m.daze = api.now + api.rand(500, 1500);
      return;
    }
    if (api.now >= b.thinkAt || !m.goal) {
      b.thinkAt = api.now + 450 - b.skill * 300 + api.rand(0, 150);
      if (!m.off || Math.random() < 0.1) {
        const a = api.rand(0, Math.PI * 2);
        const d = api.rand(1.5, 4.5);
        m.off = { x: Math.sin(a) * d, z: Math.cos(a) * d };
      }
      // dove andare: i meno bravi corrono verso il lato alto (e fanno oscillare il piatto),
      // i più bravi si mettono dove il piatto torna in piano (contando gli altri e le polpette)
      const ux = tl > 0.005 ? -m.tx / tl : 0;
      const uz = tl > 0.005 ? -m.tz / tl : 0;
      const up = 1.5 + (tl / BIL.tMax) * 5;
      let ox = 0;
      let oz = 0;
      for (const id of api.inGame()) {
        if (id === b.id) continue;
        const p = api.pos(id);
        if (!weighs(p)) continue;
        ox += p!.x;
        oz += p!.z;
      }
      for (const ball of E.balls)
        if (ball.on) {
          ox += ball.x * BIL.ballM;
          oz += ball.z * BIL.ballM;
        }
      let bx = -ox;
      let bz = -oz;
      const bl = Math.hypot(bx, bz);
      if (bl > 7) {
        bx *= 7 / bl;
        bz *= 7 / bl;
      }
      const smart = b.skill * b.skill;
      m.goal = { x: ux * up * (1 - smart) + bx * smart + m.off.x, z: uz * up * (1 - smart) + bz * smart + m.off.z };
      // polpette: scappa da quelle che stanno per cadere vicino o che rotolano verso di lui
      m.flee = null;
      if (Math.random() < (0.12 + b.skill * b.skill * 0.85) / tired)
        for (const ball of E.balls) {
          const land = ball.sky;
          const fx = land ? ball.x : ball.x + ball.vx * 0.6;
          const fz = land ? ball.z : ball.z + ball.vz * 0.6;
          const d = Math.hypot(me.x - fx, me.z - fz);
          if (d > BIL.ballR + 2.2 || ball.y < -2) continue;
          // di lato rispetto a dove va (o via dal punto dove cade)
          const sp = Math.hypot(ball.vx, ball.vz);
          let ax = me.x - fx;
          let az = me.z - fz;
          if (!land && sp > 1) {
            const px = -ball.vz / sp;
            const pz = ball.vx / sp;
            const side = (me.x - ball.x) * px + (me.z - ball.z) * pz >= 0 ? 1 : -1;
            ax = px * side;
            az = pz * side;
          }
          const al = Math.hypot(ax, az) || 1;
          m.flee = { x: me.x + (ax / al) * 3.2, z: me.z + (az / al) * 3.2 };
          break;
        }
    }
    let goal = m.flee ?? m.goal;
    // la ciabattata in arrivo: via da lì (e i più bravi si spostano già dall'altra parte)
    if (E.slam && Math.random() < (0.2 + b.skill * 0.8) / Math.sqrt(tired)) {
      const sx = Math.sin(E.slam.a) * BIL.r;
      const sz = Math.cos(E.slam.a) * BIL.r;
      if (Math.hypot(me.x - sx, me.z - sz) < BIL.slamR + 3.5) goal = { x: -sx * 0.25, z: -sz * 0.25 };
      else if (b.skill > 0.6) goal = { x: goal.x - sx * 0.2, z: goal.z - sz * 0.2 };
    }
    // mai troppo vicino al bordo (i meno bravi ci vanno più vicino)
    const edge = 8.2 + (1 - b.skill) * 2.4;
    if (r > edge) goal = { x: me.x * 0.4, z: me.z * 0.4 };
    const gl = Math.hypot(goal.x, goal.z);
    if (gl > edge - 0.8) goal = { x: (goal.x * (edge - 0.8)) / gl, z: (goal.z * (edge - 0.8)) / gl };
    // si muove compensando la scivolata (i meno bravi la sentono meno)
    const comp = 0.5 + b.skill * 0.5;
    let vx = (goal.x - me.x) * 2.4 - m.tx * BIL.slide * comp;
    let vz = (goal.z - me.z) * 2.4 - m.tz * BIL.slide * comp;
    const vl = Math.hypot(vx, vz);
    if (vl > speed) {
      vx *= speed / vl;
      vz *= speed / vl;
    }
    b.input.x = vx / speed;
    b.input.z = vz / speed;
    // la polpetta è già addosso: salto doppio o scatto
    for (const ball of E.balls) {
      if (!ball.on) continue;
      const d = Math.hypot(me.x - ball.x - ball.vx * 0.25, me.z - ball.z - ball.vz * 0.25);
      if (d < BIL.ballR + 0.9 && Math.random() < b.skill * 0.6) {
        if (Math.random() < 0.5) api.dash(b);
        else b.input.jump = true;
        break;
      }
    }
    // schiaffo verso fuori a chi è più vicino al bordo di lui
    if (Math.random() < 0.01 + b.skill * 0.02) {
      for (const id of api.inGame()) {
        if (id === b.id) continue;
        const p = api.pos(id);
        if (!p || Math.abs(p.y - me.y) > 1.2) continue;
        const d = Math.hypot(p.x - me.x, p.z - me.z);
        if (d < PHYS.pushRange - 0.4 && Math.hypot(p.x, p.z) > r + 0.5) {
          api.push(b, p.x, p.z);
          break;
        }
      }
    }
  },
  view: (api, me) => {
    const E = api.ext;
    return {
      // le polpette: quelle che cadono (per il bersaglio per terra) e quelle sul piatto
      balls: E.balls.map((b) => ({ id: b.id, x: Math.round(b.x * 10) / 10, z: Math.round(b.z * 10) / 10, f: b.sky ? 1 : 0 })),
      slam: E.slam,
      nextSlam: E.nextSlam,
      // l'inclinazione serve qui solo al server (ai telefoni arriva come oggetto 'bil_tilt', più spesso)
      ...(me === '' ? { tx: E.tx, tz: E.tz } : {}),
    };
  },
});
