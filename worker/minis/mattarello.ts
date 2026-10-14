// 🥖 Il mattarello (server): il seme del rullo, chi cade (nel buco o giù dal fianco), i bot che corrono controcorrente
import { MAT, matCurrent, matHoleAt, matIndex, matNextRev, matOmega, matSurface, setMatSeed } from '../../src/data/minis/mattarello';
import { PHYS } from '../../src/data/party3d';
import { registerServerMini, type MiniApi, type MiniBot } from './types';

interface MatState {
  seed: number;
  hole: Record<string, number>; // l'ultima volta che qualcuno era sopra un buco (per dire com'è caduto)
}

// passi di lato per scansare un buco (prima i più corti)
const SIDESTEPS = [0.9, -0.9, 1.7, -1.7, 2.5, -2.5, 3.3, -3.3];

// fra quanto passa un buco sotto (x, z)? -1 = niente fino a "look" secondi
function holeAhead(x: number, z: number, t: number, look: number, from = 0.1) {
  for (let tau = from; tau <= look + 0.001; tau += 0.1) if (matHoleAt(x, z, t + tau) >= 0) return tau;
  return -1;
}

// la strada di lato da x0 a x1 è libera (contando il tempo che ci vuole ad arrivarci)? e poi lì si resta tranquilli?
function pathSafe(x0: number, x1: number, z: number, t: number, look: number) {
  const steps = Math.max(1, Math.ceil(Math.abs(x1 - x0) / 0.35));
  for (let k = 0; k <= steps; k++) {
    const px = x0 + ((x1 - x0) * k) / steps;
    const tau = Math.abs(px - x0) / 5.5;
    if (matHoleAt(px, z, t + tau) >= 0 || matHoleAt(px, z, t + tau + 0.2) >= 0) return false;
  }
  return holeAhead(x1, z, t, look + Math.abs(x1 - x0) / 5.5) < 0;
}

// il posto di lato più comodo (meglio restare sullo stesso troncone: di là il rullo può girare al contrario)
function bestSide(x: number, z: number, t: number, look: number) {
  let best: number | null = null;
  let cost = Infinity;
  for (const dx of SIDESTEPS) {
    const nx = x + dx;
    if (Math.abs(nx) > MAT.half - 0.9) continue;
    const c = Math.abs(dx) + (matIndex(nx) !== matIndex(x) ? 1.6 : 0);
    if (c < cost && pathSafe(x, nx, z, t, look)) {
      best = nx;
      cost = c;
    }
  }
  return best;
}

// quota del rullo sotto (x, z) adesso (null = vuoto)
function floorAt(x: number, z: number, t: number) {
  if (Math.abs(x) > MAT.half || Math.abs(z) > MAT.slip * MAT.R) return null;
  return matHoleAt(x, z, t) >= 0 ? null : matSurface(z);
}

function rivalNear(api: MiniApi<MatState>, b: MiniBot) {
  const me = b.body;
  let best: { x: number; z: number; d: number } | null = null;
  for (const id of api.inGame()) {
    if (id === b.id) continue;
    const p = api.pos(id);
    if (!p || p.y < -1 || Math.abs(p.y - me.y) > 1.2) continue;
    const d = Math.hypot(p.x - me.x, p.z - me.z);
    if (d < PHYS.pushRange - 0.4 && (!best || d < best.d)) best = { x: p.x, z: p.z, d };
  }
  return best;
}

registerServerMini<MatState>({
  kind: 'MATTARELLO',
  falls: 'none', // le cadute le conto io: per dire se è stato un buco o il fianco
  init: () => {
    const seed = 1 + Math.floor(Math.random() * 2_000_000_000);
    setMatSeed(seed);
    return { seed, hole: {} };
  },
  spawn: (api, _id, i, n) => {
    // in fila lungo il mattarello, in cima, girati controcorrente
    setMatSeed(api.ext.seed);
    const x = n <= 1 ? 0 : -MAT.half + 2.5 + ((2 * MAT.half - 5) * i) / (n - 1);
    const dir = Math.sign(matCurrent().segs[matIndex(x)][0].a) || 1;
    return { x, y: 0, z: 0, r: dir > 0 ? Math.PI : 0 };
  },
  tick(api) {
    const E = api.ext;
    const t = api.t;
    for (const id of api.inGame()) {
      const p = api.pos(id);
      if (!p) continue;
      if (p.y > -1.3 && Math.abs(p.z) < MAT.slip * MAT.R && matHoleAt(p.x, p.z, t) >= 0) E.hole[id] = api.now;
      if (p.y < MAT.fallOut) {
        const hole = api.now - (E.hole[id] ?? 0) < 1600;
        api.emit({ k: 'mat_fall', id, x: p.x, z: p.z, hole });
        api.eliminate(id, hole ? 'buco' : 'sugo');
      }
    }
    return false;
  },
  bot(api, b) {
    const me = b.body;
    const m = b.mem;
    const t = api.t;
    // in discesa il corpo si stacca per un attimo dal rullo: lo riaggancio (così il rullo lo trascina davvero)
    if (!me.ground && me.vy <= 0 && m.wg) {
      const g = floorAt(me.x, me.z, t);
      if (g !== null && me.y > g && me.y - g < 0.5) {
        me.y = g;
        me.vy = 0;
        me.ground = true;
        me.airJumps = 0;
      }
    }
    m.wg = me.ground;
    if (me.y < -1.2) return; // sta cadendo: niente da fare
    if (m.hx === undefined) {
      m.hx = me.x;
      m.gx = me.x;
    }
    const i = matIndex(me.x);
    const w = matOmega(i, t);
    // in volo sopra un buco: fermo (il rullo gli scorre sotto); se il rullo va piano, un passo controcorrente
    if (m.hop) {
      if (me.ground && api.now > m.hop) m.hop = 0;
      else {
        const up = w > 0.05 ? -1 : w < -0.05 ? 1 : 0;
        b.input.z = Math.abs(w) * MAT.R < 2.8 ? up * 0.45 : 0;
        return;
      }
    }
    const carry = w * Math.sqrt(Math.max(0, MAT.R * MAT.R - me.z * me.z)) + (MAT.slide * me.z) / MAT.R;
    // quanto si sente trascinare: i meno bravi se ne accorgono in ritardo (ai cambi di verso finiscono giù)
    m.pc = m.pc === undefined ? carry : m.pc + (carry - m.pc) * Math.min(1, 0.066 / (0.12 + (1 - b.skill) * 0.55));
    const speed = PHYS.speed * (0.85 + b.skill * 0.2);
    if (api.now >= b.thinkAt) {
      // i più bravi pensano più spesso e guardano più lontano
      b.thinkAt = api.now + 360 - b.skill * 230 + api.rand(0, 140);
      const look = 0.4 + b.skill * 1.0;
      const tau = holeAhead(me.x, me.z, t, look);
      // dove sto andando è ancora sicuro?
      const moving = Math.abs(m.gx - me.x) > 0.3;
      const unsafe = tau >= 0 || (moving && !pathSafe(me.x, m.gx, me.z, t, look));
      if (unsafe && Math.random() < 0.25 + b.skill * 0.75) {
        let best = bestSide(me.x, me.z, t, look);
        // a volte sbaglia lato (i meno bravi)
        if (best !== null && Math.random() < 0.18 * (1 - b.skill)) best = me.x - (best - me.x);
        if (best !== null) m.gx = best;
        else if (tau >= 0) {
          // niente posto libero: lo salto appena prima che arrivi (i meno bravi sbagliano il momento)
          m.gx = me.x;
          m.jumpAt = api.now + Math.max(0, tau - 0.12 + (Math.random() - 0.5) * 0.5 * (1 - b.skill)) * 1000;
        }
      } else if (!moving && Math.random() < 0.06) {
        // ogni tanto torna verso casa (solo se la strada è libera)
        const nx = Math.max(-MAT.half + 1, Math.min(MAT.half - 1, m.hx + api.rand(-1.5, 1.5)));
        if (pathSafe(me.x, nx, me.z, t, look)) m.gx = nx;
      }
      // distrazione: ogni tanto si sposta a caso (i meno bravi)
      if (Math.random() < 0.03 * (1 - b.skill)) m.gx = Math.max(-MAT.half + 1, Math.min(MAT.half - 1, me.x + api.rand(-3, 3)));
      // i più bravi non stanno appiccicati agli altri (uno schiaffo e si vola giù)
      else if (Math.random() < b.skill && Math.abs(m.gx - me.x) < 0.3) {
        const r = rivalNear(api, b);
        if (r && r.d < 1.9) {
          const nx = me.x + (me.x >= r.x ? 1.2 : -1.2);
          if (Math.abs(nx) < MAT.half - 0.9 && pathSafe(me.x, nx, me.z, t, look)) m.gx = nx;
        }
      }
      // il cambio di verso: i più bravi lo vedono arrivare e si mettono in cima
      m.prep = matNextRev(i, t) < 0.4 + b.skill * 1.6;
    }
    // controcorrente: un po' più su della cima (i meno bravi stanno più bassi, verso il bordo)
    const up = w > 0.05 ? -1 : w < -0.05 ? 1 : 0;
    const zGoal = m.prep ? 0 : up * (0.3 + (1 - b.skill) * 0.7);
    const vz = (zGoal - me.z) * 2.8 - m.pc;
    const vx = (m.gx - me.x) * 3.2;
    let ix = vx / speed;
    let iz = vz / speed;
    const l = Math.hypot(ix, iz);
    if (l > 1) {
      ix /= l;
      iz /= l;
    }
    b.input.x = ix;
    b.input.z = iz;
    // salto sopra il buco: su dritto, e il buco passa sotto
    if (m.jumpAt && api.now >= m.jumpAt) {
      m.jumpAt = 0;
      if (me.ground && Math.random() < 0.55 + b.skill * 0.45) {
        b.input.jump = true;
        b.input.x = 0;
        b.input.z = 0;
        m.hop = api.now + 250;
      }
    }
    // portato verso il bordo: scatto per tornare su
    if (me.ground && Math.abs(me.z) > 2.3 && Math.sign(me.z) === Math.sign(carry) && Math.random() < 0.07 * b.skill) {
      b.input.x = 0;
      b.input.z = -Math.sign(me.z);
      api.dash(b);
    }
    // uno schiaffo a chi è vicino (può mandarlo nel buco)
    if (Math.random() < 0.004 + b.skill * 0.01) {
      const r = rivalNear(api, b);
      if (r) api.push(b, r.x, r.z);
    }
  },
  view: (api) => ({ seed: api.ext.seed }),
});
