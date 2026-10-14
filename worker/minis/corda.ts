// 🍝 Salta la corda (server): chi viene preso dallo spaghetto vola via ed è fuori; i bot saltano a tempo (con errori)
// I giocatori veri: il telefono vede il passaggio esatto e manda MG_CORDA_HIT (subito, niente ritardi di rete);
// il server controlla lo stesso, ma largo (se non ha mai visto saltare nessuno intorno al passaggio), per chi non manda niente.
import { CORDA, cordaActive, cordaAngle, cordaOmega, cordaPasses, crossed, ropeCross, ropeLowAt, setCordaSeed } from '../../src/data/minis/corda';
import { PHYS } from '../../src/data/party3d';
import { registerServerMini, type MiniApi } from './types';

interface CordaState {
  seed: number;
  hit: Record<string, number>; // quando è stato preso (vola via, poco dopo è fuori)
  hist: Record<string, number[]>; // giocatori veri: coppie [ora, quota] dell'ultimo secondo
  pend: { id: string; at: number; h: number }[]; // passaggi sopra i giocatori veri da controllare (largo)
  prevT: number;
  prevY: Record<string, number>;
}

const gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
const PASSES: { tau: number; n: number }[] = [];
const APEX = PHYS.jumpV / PHYS.gravity; // il salto è più alto dopo ~0,35 s

// verso in cui lo spaghetto spazza in basso (z): il primo gira con θ, il secondo al contrario
const sweep = (n: number, t: number) => (cordaOmega(t) >= 0 ? 1 : -1) * (n === 0 ? 1 : -1);

function hitPlayer(api: MiniApi<CordaState>, id: string, dz: number, fling: boolean) {
  const E = api.ext;
  if (E.hit[id] || !api.alive(id)) return;
  E.hit[id] = api.now;
  if (fling) api.fling(id, { vx: api.rand(-3, 3), vy: 9, vz: dz * 12 });
  const p = api.pos(id);
  api.emit({ k: 'corda_hit', id, dz, x: p?.x ?? 0, y: p?.y ?? 0, z: p?.z ?? 0 });
}

registerServerMini<CordaState>({
  kind: 'CORDA',
  falls: 'none', // chi cade dai lati lo elimino io (per dire se è stato lo spaghetto)
  init: () => {
    const seed = 1 + Math.floor(Math.random() * 2_000_000_000);
    setCordaSeed(seed);
    return { seed, hit: {}, hist: {}, pend: [], prevT: 0, prevY: {} };
  },
  spawn: (_api, _id, i, n) => {
    // in fila lungo il campo, girati verso il centro: la telecamera guarda lungo lo spaghetto (lo si vede arrivare di lato)
    const x = n <= 1 ? 0 : -CORDA.halfX + 1.5 + ((2 * CORDA.halfX - 3) * i) / (n - 1);
    return { x, y: 0, z: (i % 2 ? 1 : -1) * 0.6, r: x <= 0 ? Math.PI / 2 : -Math.PI / 2 };
  },
  tick(api) {
    const E = api.ext;
    const t = api.t;
    const t0 = E.prevT;
    E.prevT = t;
    for (const id of api.inGame()) {
      const p = api.pos(id);
      if (!p) continue;
      if (p.y < CORDA.fallOut) {
        api.eliminate(id, E.hit[id] ? 'spaghetto' : 'caduto');
        continue;
      }
      if (E.hit[id]) {
        if (api.now - E.hit[id] > 900) api.eliminate(id, 'spaghetto');
        continue;
      }
      const bot = api.bot(id);
      if (!bot) {
        const h = (E.hist[id] ??= []);
        h.push(api.now, p.y);
        while (h.length > 2 && h[0] < api.now - 1200) h.splice(0, 2);
      }
      const py = E.prevY[id] ?? p.y;
      E.prevY[id] = p.y;
      if (t0 <= 0 || Math.abs(p.z) > CORDA.halfZ + 0.6 || p.y < -1) continue;
      const c = ropeCross(p.z);
      const low = ropeLowAt(p.z);
      for (let n = 0; n < 2; n++) {
        if (!cordaActive(n, t0)) continue;
        const a0 = cordaAngle(n, t0);
        const a1 = cordaAngle(n, t);
        if (!crossed(a0, a1, c)) continue;
        if (bot) {
          // la quota del bot nel momento esatto del passaggio
          const edge = a1 > a0 ? Math.floor((a1 - c) / (Math.PI * 2)) : Math.floor((a0 - c) / (Math.PI * 2));
          const f = Math.abs(a1 - a0) > 1e-9 ? Math.max(0, Math.min(1, (c + edge * Math.PI * 2 - a0) / (a1 - a0))) : 1;
          const y = py + (p.y - py) * f;
          if (y < low + CORDA.hit) hitPlayer(api, id, sweep(n, t), true);
        } else E.pend.push({ id, at: api.now, h: low });
      }
    }
    // giocatori veri: fuori solo se intorno al passaggio non si sono mai staccati da terra (il telefono di solito ha già detto tutto)
    if (E.pend.length)
      E.pend = E.pend.filter((q) => {
        if (api.now - q.at < 400) return true;
        if (E.hit[q.id] || !api.alive(q.id)) return false;
        const h = E.hist[q.id] ?? [];
        let air = false;
        for (let k = 0; k < h.length; k += 2) if (h[k] >= q.at - 150 && h[k] <= q.at + 400 && h[k + 1] > q.h + 0.05) air = true;
        if (!air) hitPlayer(api, q.id, sweep(0, api.t), true);
        return false;
      });
    return false;
  },
  actions: {
    // il telefono ha visto lo spaghetto prendermi (lui mi ha già fatto volare via)
    MG_CORDA_HIT: (api, me, payload) => {
      if (api.stage !== 'PLAY' || !api.alive(me)) return false;
      hitPlayer(api, me, payload?.dz === -1 ? -1 : 1, false);
      return false;
    },
  },
  bot(api, b) {
    const E = api.ext;
    const me = b.body;
    const m = b.mem;
    const t = api.t;
    if (me.y < -1 || E.hit[b.id]) return;
    if (m.hx === undefined) m.hx = me.x;
    // posto: sparsi lungo il campo, vicino al centro (i più bravi più al centro; ogni tanto cambiano)
    if (!m.hz || api.now >= b.thinkAt) {
      b.thinkAt = api.now + api.rand(2500, 6000);
      m.hz = { z: (Math.random() - 0.5) * (0.6 + (1 - b.skill) * 3.2) };
      m.hx = Math.max(-CORDA.halfX + 1.2, Math.min(CORDA.halfX - 1.2, m.hx + api.rand(-2, 2)));
    }
    cordaPasses(me.z, t, 1.3, PASSES);
    const p1 = PASSES[0];
    const p2 = PASSES[1];
    // lontano dal passaggio si sistema, vicino sta fermo (si salta meglio)
    if (!p1 || p1.tau > 0.7) api.go(b, m.hx, m.hz.z, 0.55);
    if (!p1) return;
    const low = ropeLowAt(me.z) + CORDA.hit;
    // per ogni passaggio decide una volta sola quando saltare (errore secondo la bravura; ogni tanto si distrae)
    const key = `${p1.n}:${Math.round((t + p1.tau) * 10)}`;
    if (m.key !== key) {
      m.key = key;
      const tired = 1 + t / 65;
      m.lead = APEX + gauss() * (0.03 + (1 - b.skill) * 0.11) * tired;
      m.lapse = Math.random() < (0.004 + (1 - b.skill) * 0.024) * tired;
      // due passaggi vicini: un salto solo, a metà
      if (p2 && p2.tau - p1.tau < 0.45) m.lead += (p2.tau - p1.tau) / 2;
    }
    if (m.lapse) return;
    if (me.ground) {
      if (p1.tau <= m.lead) b.input.jump = true;
    } else if ((me.airJumps ?? 0) < 1 && p1.tau < 0.32) {
      // in volo ma troppo basso per il prossimo: doppio salto
      // (passi da 66 ms come la fisica del server: si scende più in fretta della formula continua)
      let y = me.y;
      let vy = me.vy;
      for (let k = 0; k * 0.066 < p1.tau + 0.066; k++) {
        vy -= PHYS.gravity * 0.066;
        y += vy * 0.066;
      }
      if (y < low + 0.15 && Math.random() < 0.35 + b.skill * 0.6) b.input.jump = true;
    }
    // uno schiaffo a chi è vicino, lontano dai passaggi (lo fa sbagliare)
    if (p1.tau > 0.8 && Math.random() < 0.004 + b.skill * 0.006) {
      for (const id of api.inGame()) {
        if (id === b.id) continue;
        const p = api.pos(id);
        if (p && Math.hypot(p.x - me.x, p.z - me.z) < PHYS.pushRange - 0.6) {
          api.push(b, p.x, p.z);
          break;
        }
      }
    }
  },
  view: (api) => ({ seed: api.ext.seed }),
});
