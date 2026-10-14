// 🧱 Il muro di lasagna (server): il seme della sequenza dei muri e i bot che cercano il buco (o saltano quelli bassi)
import { MURO, MURO_DIRS, muroCurrent, muroFirst, setMuroSeed, type MuroWall } from '../../src/data/minis/muro';
import { PHYS } from '../../src/data/party3d';
import { registerServerMini } from './types';

interface MuroState {
  seed: number;
  outAt: Record<string, number>; // quando è caduto ognuno (chi cade insieme è pari merito)
}

const gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
const LIM = MURO.th / 2 + PHYS.radius;

// il muro (o la metà del muro doppio) che arriva prima addosso al bot: fra quanto, e dove sono i buchi
function nextThreat(me: { x: number; z: number }, t: number, see: number) {
  const walls = muroCurrent();
  let best: { w: MuroWall; k: number; slab: number; tau: number; along: number; lat: number } | null = null;
  for (let k = muroFirst(t); k < walls.length; k++) {
    const w = walls[k];
    if (w.t0 > t + see) break;
    const D = MURO_DIRS[w.dir];
    const along = me.x * D.fx + me.z * D.fz;
    const lat = me.x * D.lx + me.z * D.lz;
    for (let slab = 0; slab < (w.type === 2 ? 2 : 1); slab++) {
      // dove sarà il muro: parte da MURO.start al tempo t0
      const s = MURO.start + w.v * (t - w.t0) - slab * MURO.gap2;
      const d = along - s;
      if (d < -LIM + 0.05) continue; // già passato
      const tau = Math.max(0, (d - LIM) / w.v);
      if (tau > see) continue;
      if (!best || tau < best.tau) best = { w, k, slab, tau, along, lat };
    }
  }
  return best;
}

registerServerMini<MuroState>({
  kind: 'MURO',
  init: () => {
    const seed = 1 + Math.floor(Math.random() * 2_000_000_000);
    setMuroSeed(seed);
    return { seed, outAt: {} };
  },
  spawn: (_api, _id, i, n) => {
    // sparsi sulla teglia
    const a = (i / n) * Math.PI * 2 + 0.4;
    const r = 3 + (i % 2) * 2.5;
    return { x: Math.sin(a) * r, y: 0, z: Math.cos(a) * r, r: a + Math.PI };
  },
  bot(api, b) {
    const me = b.body;
    const m = b.mem;
    const t = api.t;
    if (me.y < -0.8) return; // sta cadendo
    // quanto prima vede arrivare i muri e quanto spesso ci ripensa
    const see = 0.45 + b.skill * 1.7;
    if (api.now >= b.thinkAt) {
      b.thinkAt = api.now + 330 - b.skill * 220 + api.rand(0, 120);
      const th = nextThreat(me, t, see);
      m.th = null;
      if (th) {
        const w = th.w;
        const key = `${th.k}:${th.slab}`;
        if (w.type === 1) {
          // muro basso: si salta appena prima che arrivi (andandogli incontro); i meno bravi sbagliano il momento
          // o se ne accorgono tardi, quando già li spinge
          if (m.key !== key) {
            m.key = key;
            m.lead = 0.14 + gauss() * (0.02 + (1 - b.skill) * 0.12);
            m.late = Math.random() < 0.35 * (1 - b.skill) ? api.rand(0.25, 0.9) : 0;
          }
          m.th = { dir: w.dir, low: true, k: th.k };
        } else {
          // il buco: il più vicino che si fa in tempo a raggiungere (i meno bravi a volte sbagliano scelta o mira)
          if (m.key !== key) {
            m.key = key;
            const holes = th.slab ? w.holes2 : w.holes;
            const speed = PHYS.speed * (0.85 + b.skill * 0.2) * 0.9;
            // tempo che ha: finché il muro lo raggiunge, più quello in cui il muro lo spinge fino al bordo
            const slack = th.tau + Math.max(0, MURO.half - 0.6 - (th.along + th.tau * w.v)) / w.v;
            // (un buco già scelto da altri bot "costa" un po' di più: non si ammucchiano tutti nello stesso)
            const crowd = (c: number) => api.bots.filter((o) => o !== b && api.alive(o.id) && o.mem.key === key && Math.abs((o.mem.aim ?? 99) - c) < 1).length * 1.5;
            const sorted = [...holes].sort((p, q) => Math.abs(p - th.lat) + crowd(p) - Math.abs(q - th.lat) - crowd(q));
            let pick = sorted.find((c) => Math.abs(c - th.lat) / speed < slack) ?? sorted[0];
            if (sorted.length > 1 && Math.random() < 0.35 * (1 - b.skill)) pick = sorted[1];
            // (più va avanti, più si stancano: errori e indecisione crescono)
            const tired = 1 + t / 120;
            m.aim = pick + gauss() * (1 - b.skill) * 0.75 * tired;
            // un attimo per capire dove andare (i meno bravi ci mettono di più)
            // (il secondo muro del muro doppio lo aveva già visto arrivare)
            m.react = api.now + (th.slab ? 0.08 + (1 - b.skill) * 0.3 : (0.15 + (1 - b.skill) * 0.95 + Math.random() * 0.3) * tired) * 1000;
          }
          // già schiacciato contro il muro accanto al buco: corregge la mira (i più bravi subito)
          if (th.tau >= 0.05) m.pressAt = 0;
          else if (!m.pressAt) m.pressAt = api.now;
          if (m.pressAt && api.now - m.pressAt > 200 + (1 - b.skill) * 1100) {
            const holes = th.slab ? w.holes2 : w.holes;
            const near = holes.reduce((a, c) => (Math.abs(c - th.lat) < Math.abs(a - th.lat) ? c : a), holes[0]);
            if (Math.abs(near - th.lat) < 3) m.aim = near;
          }
          m.th = { dir: w.dir, low: false, lat: m.aim, tau: th.tau };
        }
      } else {
        m.key = null;
        // niente in arrivo: si piazza verso il centro, lontano dagli altri
        if (!m.home || Math.random() < 0.08) m.home = { x: api.rand(-5, 5), z: api.rand(-5, 5) };
      }
    }
    const T = m.th;
    if (T) {
      const D = MURO_DIRS[T.dir];
      const along = me.x * D.fx + me.z * D.fz;
      if (T.low) {
        const w = muroCurrent()[T.k];
        const d = along - (MURO.start + w.v * (t - w.t0));
        // all'ultimo un passo incontro al muro (in volo ci passa sopra prima); prima si sta lontani dal bordo
        const close = d - LIM < 2.2;
        const safe = along > -MURO.half + 2 && along < MURO.half - 1.5;
        const lat = me.x * D.lx + me.z * D.lz;
        const back = along > MURO.half - 3 ? -0.7 : 0;
        b.input.x = close && safe ? -D.fx * 0.6 : D.fx * back - D.lx * Math.max(-0.5, Math.min(0.5, lat * 0.1));
        b.input.z = close && safe ? -D.fz * 0.6 : D.fz * back - D.lz * Math.max(-0.5, Math.min(0.5, lat * 0.1));
        if (d > -LIM) {
          const tau = Math.max(0, d - LIM) / (w.v + (close && safe ? 4 : 0));
          if (tau > 0.02) m.pushed = 0;
          else if (!m.pushed) m.pushed = api.now;
          const ready = m.late ? m.pushed && api.now - m.pushed > m.late * 1000 : tau <= m.lead;
          if (ready && me.ground) b.input.jump = true;
        }
        return;
      }
      const lat = me.x * D.lx + me.z * D.lz;
      // ancora indeciso: fermo
      const dl = api.now < (m.react ?? 0) ? 0 : T.lat - lat;
      // di lato verso il buco; avanti/indietro: lontano dal bordo verso cui spinge il muro
      const da = along > MURO.half - 3.5 ? -1 : along < -MURO.half + 2 ? 0.5 : 0;
      const sl = Math.max(-1, Math.min(1, dl * 1.6)) * (0.72 + b.skill * 0.28);
      let ix = D.lx * sl + D.fx * da;
      let iz = D.lz * sl + D.fz * da;
      const l = Math.hypot(ix, iz);
      if (l > 1) {
        ix /= l;
        iz /= l;
      }
      b.input.x = ix;
      b.input.z = iz;
      // lontano dal buco e il muro è quasi addosso: scatto
      if (Math.abs(dl) > 2.5 && T.tau < 0.8 && Math.random() < 0.08 * b.skill) api.dash(b);
    } else if (m.home) {
      api.go(b, m.home.x, m.home.z, 0.6);
      // uno schiaffo a chi gli sta appiccicato (ogni tanto)
      if (Math.random() < 0.004 + b.skill * 0.008)
        for (const id of api.inGame()) {
          if (id === b.id) continue;
          const p = api.pos(id);
          if (p && Math.hypot(p.x - me.x, p.z - me.z) < PHYS.pushRange - 0.5) {
            api.push(b, p.x, p.z);
            break;
          }
        }
    }
    // mai sul bordo
    if (Math.abs(me.x) > MURO.half - 1.2 || Math.abs(me.z) > MURO.half - 1.2) {
      if (!T) api.go(b, me.x * 0.5, me.z * 0.5);
    }
  },
  tick(api) {
    for (const id of api.ids()) if (!api.alive(id) && api.ext.outAt[id] === undefined) api.ext.outAt[id] = api.now;
    return false;
  },
  // classifica: chi è in piedi, poi chi è caduto dopo; chi cade nello stesso momento (stesso muro) è pari merito
  rank: (api) => {
    const E = api.ext;
    for (const id of api.ids()) if (!api.alive(id) && E.outAt[id] === undefined) E.outAt[id] = api.now;
    const groups: string[][] = [api.ids().filter((id) => api.alive(id))];
    const out = api.ids().filter((id) => !api.alive(id)).sort((a, b) => E.outAt[b] - E.outAt[a]);
    for (const id of out) {
      const last = groups[groups.length - 1];
      if (groups.length > 1 && last.length && Math.abs(E.outAt[last[0]] - E.outAt[id]) < 250) last.push(id);
      else groups.push([id]);
    }
    return groups.filter((g) => g.length);
  },
  view: (api) => ({ seed: api.ext.seed }),
});
