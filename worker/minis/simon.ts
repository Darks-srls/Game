// 🤖 Simon dice (server): la sequenza, chi la ripete giusta coi piedi, chi sbaglia o non fa in tempo, i bot con la memoria
import { SIMON, simonGap, simonOn, simonTile, simonTileAt } from '../../src/data/minis/simon';
import { registerServerMini, type MiniApi, type MiniBot } from './types';

interface SimonState {
  giro: number;
  seq: number[]; // la sequenza intera (si mostra con gli effetti, non viaggia nello stato)
  phase: 'SHOW' | 'GO' | 'PAUSE';
  phaseAt: number;
  endsAt: number; // fine del turno dei giocatori (GO) o della pausa
  shown: number; // luci già accese
  prog: Record<string, number>; // passi giusti in questo giro
  last: Record<string, number>; // l'ultima piastrella calpestata
  done: string[]; // chi ha finito il giro
  outGiro: Record<string, number>; // al giro in cui è uscito (per la classifica)
  outProg: Record<string, number>;
}

interface BotMem {
  plan?: number[]; // la sequenza come se la ricorda (con gli errori)
  giro?: number;
  path?: { x: number; z: number }[];
  pathFor?: number; // per quale passo è il percorso
  waitUntil?: number;
  seenProg?: number;
  post?: { x: number; z: number };
}

const NT = SIMON.n * SIMON.n;
const showStep = (giro: number) => simonOn(giro) + simonGap(giro);

// un colore nuovo (mai uguale al precedente: per ripeterlo bisognerebbe uscire e rientrare)
function nextColor(prev: number | undefined) {
  let c = Math.floor(Math.random() * NT);
  if (c === prev) c = (c + 1 + Math.floor(Math.random() * (NT - 1))) % NT;
  return c;
}

function startShow(api: MiniApi<SimonState>) {
  const E = api.ext;
  E.phase = 'SHOW';
  E.phaseAt = api.now;
  E.shown = 0;
  E.prog = {};
  E.done = [];
  api.emit({ k: 'simon_show', giro: E.giro, len: E.seq.length });
}

// incroci delle passerelle (per i percorsi dei bot)
const LINES = [-1.5, -0.5, 0.5, 1.5].map((k) => k * SIMON.step);
const NODES = LINES.flatMap((x) => LINES.map((z) => ({ x, z })));

// il segmento a→b passa su piastrelle diverse da quelle permesse? (piastrelle allargate di un po' per sicurezza)
// (soft = la piastrella accanto a cui mi trovo già: basta non salirci davvero)
function clear(ax: number, az: number, bx: number, bz: number, ok: number[], soft = -1) {
  const d = Math.hypot(bx - ax, bz - az);
  const n = Math.max(1, Math.ceil(d / 0.3));
  for (let i = 0; i <= n; i++) {
    const x = ax + ((bx - ax) * i) / n;
    const z = az + ((bz - az) * i) / n;
    const t = simonTileAt(x, z, 0.45);
    if (t < 0 || ok.includes(t)) continue;
    if (t === soft && simonTileAt(x, z, 0.05) !== t) continue;
    return false;
  }
  return true;
}

// percorso sulle passerelle fino alla piastrella giusta, senza pestare le altre
// (ok = piastrelle che si possono toccare: quella dove sono già stato non conta di nuovo, e quella giusta)
function route(from: { x: number; z: number }, ok: number[], target: number, depth = 0): { x: number; z: number }[] {
  const goal = simonTile(target);
  const soft = simonTileAt(from.x, from.z, 0.45);
  if (clear(from.x, from.z, goal.x, goal.z, ok, soft)) return [goal];
  // Dijkstra sui 16 incroci delle passerelle
  const dist = NODES.map(() => Infinity);
  const prev = NODES.map(() => -1);
  const done = NODES.map(() => false);
  NODES.forEach((n, i) => {
    if (clear(from.x, from.z, n.x, n.z, ok, soft)) dist[i] = Math.hypot(n.x - from.x, n.z - from.z);
  });
  if (dist.every((d) => d === Infinity) && !depth) {
    // proprio sul bordo di una piastrella: prima in mezzo alla passerella più vicina
    const near = (v: number) => LINES.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
    const sx = { x: near(from.x), z: from.z };
    const sz = { x: from.x, z: near(from.z) };
    const snap = Math.abs(sx.x - from.x) < Math.abs(sz.z - from.z) ? sx : sz;
    return [snap, ...route(snap, ok, target, 1)];
  }
  for (;;) {
    let u = -1;
    for (let i = 0; i < NODES.length; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0) break;
    done[u] = true;
    for (let v = 0; v < NODES.length; v++) {
      if (done[v]) continue;
      const dx = Math.abs(NODES[v].x - NODES[u].x);
      const dz = Math.abs(NODES[v].z - NODES[u].z);
      if (!((dx < 0.1 && Math.abs(dz - SIMON.step) < 0.1) || (dz < 0.1 && Math.abs(dx - SIMON.step) < 0.1))) continue;
      if (dist[u] + SIMON.step < dist[v]) {
        dist[v] = dist[u] + SIMON.step;
        prev[v] = u;
      }
    }
  }
  let best = -1;
  let bd = Infinity;
  NODES.forEach((n, i) => {
    if (dist[i] === Infinity || !clear(n.x, n.z, goal.x, goal.z, ok)) return;
    const d = dist[i] + Math.hypot(goal.x - n.x, goal.z - n.z);
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  if (best < 0) return [goal];
  const path: { x: number; z: number }[] = [goal];
  for (let i = best; i >= 0; i = prev[i]) path.unshift(NODES[i]);
  return path;
}

// la sequenza come se la ricorda un bot: più è lunga, più si confonde (i bravi meno)
function remember(b: MiniBot, seq: number[]) {
  const base = 0.01 + (1 - b.skill) * 0.05;
  const plan: number[] = [];
  seq.forEach((c, k) => {
    let x = c;
    if (Math.random() < base * (1 + k * 0.45)) {
      x = Math.floor(Math.random() * NT);
      if (x === c || x === plan[k - 1]) x = (x + 1 + Math.floor(Math.random() * (NT - 2))) % NT;
      if (x === plan[k - 1]) x = (x + 1) % NT;
    }
    plan.push(x);
  });
  return plan;
}

function out(api: MiniApi<SimonState>, id: string, reason: string) {
  const E = api.ext;
  E.outGiro[id] = E.giro;
  E.outProg[id] = E.prog[id] ?? 0;
  api.eliminate(id, reason);
}

registerServerMini<SimonState>({
  kind: 'SIMON',
  ends: 'last',
  init: () => ({ giro: 0, seq: [], phase: 'PAUSE', phaseAt: 0, endsAt: 0, shown: 0, prog: {}, last: {}, done: [], outGiro: {}, outProg: {} }),
  spawn: (_api, _id, i, n) => {
    // sul bordo esterno, tutto intorno (la passerella larga)
    const per = (SIMON.edge - 0.7) * 2 * 4;
    const s = ((i + 0.5) / n) * per;
    const L = (SIMON.edge - 0.7) * 2;
    const e = SIMON.edge - 0.7;
    const side = Math.floor(s / L);
    const u = (s % L) - e;
    const p = side === 0 ? { x: u, z: -e } : side === 1 ? { x: e, z: u } : side === 2 ? { x: -u, z: e } : { x: -e, z: -u };
    return { ...p, y: 0, r: Math.atan2(-p.x, -p.z) };
  },
  play: (api) => {
    const E = api.ext;
    E.giro = 0;
    E.seq = [];
    for (let i = 0; i < SIMON.first; i++) E.seq.push(nextColor(E.seq[i - 1]));
    startShow(api);
  },
  tick(api) {
    const E = api.ext;
    const now = api.now;
    let changed = false;
    // chi è caduto dal bordo: lo segno per la classifica
    for (const id of api.ids()) if (!api.alive(id) && E.outGiro[id] === undefined) {
      E.outGiro[id] = E.giro;
      E.outProg[id] = E.prog[id] ?? 0;
    }
    if (E.phase === 'SHOW') {
      // le luci una dopo l'altra (ognuna col suo suono, sui telefoni)
      const step = showStep(E.giro);
      while (E.shown < E.seq.length && now >= E.phaseAt + SIMON.leadMs + E.shown * step) {
        api.emit({ k: 'simon_lit', i: E.seq[E.shown], n: E.shown, d: simonOn(E.giro) });
        E.shown++;
      }
      if (E.shown >= E.seq.length && now >= E.phaseAt + SIMON.leadMs + E.seq.length * step + 350) {
        // TOCCA A VOI: chi è già sulla prima piastrella giusta ha già fatto il primo passo
        E.phase = 'GO';
        E.phaseAt = now;
        E.endsAt = now + SIMON.perStep * E.seq.length + SIMON.extra;
        for (const id of api.inGame()) {
          const p = api.pos(id);
          const t = p && Math.abs(p.y) < 0.25 ? simonTileAt(p.x, p.z) : -1;
          E.last[id] = t;
          E.prog[id] = 0;
          if (t >= 0 && t === E.seq[0]) {
            E.prog[id] = 1;
            api.emit({ k: 'simon_ok', id, n: 1, i: t });
          }
        }
        api.emit({ k: 'simon_go', endsAt: E.endsAt, len: E.seq.length });
        changed = true;
      }
    } else if (E.phase === 'GO') {
      for (const id of api.inGame()) {
        if (E.done.includes(id)) continue;
        const p = api.pos(id);
        if (!p || Math.abs(p.y) > 0.25) continue; // in volo non si calpesta niente
        const t = simonTileAt(p.x, p.z);
        if (t < 0 || t === E.last[id]) continue;
        E.last[id] = t;
        const k = E.prog[id] ?? 0;
        if (t === E.seq[k]) {
          E.prog[id] = k + 1;
          api.emit({ k: 'simon_ok', id, n: k + 1, i: t });
          if (k + 1 >= E.seq.length) {
            E.done.push(id);
            api.emit({ k: 'simon_done', id });
          }
        } else {
          // piastrella sbagliata: crolla sotto i piedi
          api.emit({ k: 'simon_wrong', id, i: t, x: Math.round(p.x * 10) / 10, z: Math.round(p.z * 10) / 10 });
          out(api, id, 'sbagliato');
          changed = true;
        }
      }
      const left = api.inGame();
      if (now >= E.endsAt || left.every((id) => E.done.includes(id))) {
        for (const id of left) if (!E.done.includes(id)) out(api, id, 'tempo');
        E.phase = 'PAUSE';
        E.phaseAt = now;
        E.endsAt = now + SIMON.pauseMs;
        api.emit({ k: 'simon_round', giro: E.giro, ok: api.inGame().length });
        changed = true;
      }
    } else if (E.phase === 'PAUSE' && E.seq.length && now >= E.endsAt) {
      // piastrelle pulite, un colore in più
      if (E.giro + 1 >= SIMON.giri || api.inGame().length <= 1) api.end();
      else {
        E.giro++;
        E.seq.push(nextColor(E.seq[E.seq.length - 1]));
        startShow(api);
        changed = true;
      }
    }
    return changed;
  },
  bot(api, b) {
    const E = api.ext;
    const me = b.body;
    const now = api.now;
    const m = b.mem as BotMem;
    if (m.giro !== E.giro) {
      m.giro = E.giro;
      m.plan = undefined;
      m.path = undefined;
      m.post = undefined;
    }
    const cur = simonTileAt(me.x, me.z);
    if (E.phase !== 'GO' || E.done.includes(b.id)) {
      // mentre Simon mostra: i bravi si mettono vicino alla prima piastrella, gli altri aspettano sulle passerelle
      if (E.phase === 'SHOW' && E.shown > 0 && !m.post) {
        const first = E.seq[0];
        if (Math.random() < b.skill * 0.7) {
          const c = simonTile(first);
          m.post = { x: c.x + api.rand(-1, 1), z: c.z + api.rand(-1, 1) };
        } else {
          const n = NODES[Math.floor(Math.random() * NODES.length)];
          m.post = { x: n.x, z: n.z };
        }
      }
      // (mentre Simon mostra si può camminare dove si vuole: non conta niente)
      if (m.post && E.phase === 'SHOW') api.go(b, m.post.x, m.post.z, 0.6);
      return;
    }
    // TOCCA A VOI
    if (!m.plan) {
      m.plan = remember(b, E.seq);
      m.waitUntil = now + api.rand(250, 900) * (1.35 - b.skill);
      m.path = undefined;
    }
    const k = E.prog[b.id] ?? 0;
    if (m.seenProg !== k) {
      // passo fatto: un attimo per ricordare il prossimo
      m.seenProg = k;
      m.path = undefined;
      if (k > 0) m.waitUntil = now + api.rand(60, 380) * (1.3 - b.skill);
    }
    if (now < (m.waitUntil ?? 0)) return;
    const target = m.plan[k];
    if (target === undefined) return;
    if (!m.path || m.pathFor !== k) {
      m.path = route(me, [E.last[b.id] ?? -1, cur, target], target);
      m.pathFor = k;
    }
    const wp = m.path[0];
    if (!wp) return;
    const d = api.go(b, wp.x, wp.z);
    if (d < (m.path.length > 1 ? 0.45 : 0.3)) m.path.shift();
  },
  rank: (api) => {
    // in piedi tutti insieme, poi chi è uscito più tardi (e a parità di giro chi aveva fatto più passi)
    const E = api.ext;
    const groups: string[][] = [];
    const alive = api.ids().filter((id) => api.alive(id));
    if (alive.length) groups.push(alive);
    const outs = api.ids().filter((id) => !api.alive(id));
    const key = (id: string) => (E.outGiro[id] ?? -1) * 100 + (E.outProg[id] ?? 0);
    const byKey = new Map<number, string[]>();
    for (const id of outs) byKey.set(key(id), [...(byKey.get(key(id)) ?? []), id]);
    for (const [, ids] of [...byKey.entries()].sort((a, b) => b[0] - a[0])) groups.push(ids);
    return groups;
  },
  view: (api) => {
    const E = api.ext;
    return { giro: E.giro, phase: E.phase, endsAt: E.endsAt, phaseAt: E.phaseAt, len: E.seq.length, prog: E.prog, done: E.done };
  },
});
