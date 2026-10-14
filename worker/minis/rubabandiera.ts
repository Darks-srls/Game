// 🧺 Rubabandiera (server): i numeri, la nonna che chiama, chi prende lo strofinaccio, chi viene toccato, i punti
// e i bot (tempo di reazione secondo la bravura, finte davanti allo strofinaccio, inseguimenti con l'anticipo)
import { RUBA, rubaSlot } from '../../src/data/minis/rubabandiera';
import { mates, splitTeams, teamRank, trackHumans, velOf } from './squadre';
import { registerServerMini, type MiniApi, type MiniBot } from './types';

interface RubaState {
  team: Record<string, number>;
  nums: Record<string, number[]>; // i numeri di ognuno (nella squadra più piccola uno ne ha due)
  n: number; // numeri da 1 a n
  phase: 'WAIT' | 'CALL' | 'CARRY' | 'POINT';
  at: number; // inizio della fase
  until: number; // fine della fase
  called: number[];
  carrier: string | null; // chi ha lo strofinaccio
  chasers: string[]; // chi lo può toccare (stesso numero, squadra avversaria)
  score: number[];
  pts: Record<string, number>; // punti fatti (bonus personale)
  times: Record<number, number>; // quante volte è uscito ogni numero (così tocca a tutti)
  calls: number;
  last: { team: number; by: string | null; how: string } | null;
}
type Api = MiniApi<RubaState>;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const runner = (E: RubaState, id: string) => (E.phase === 'CALL' || E.phase === 'CARRY') && (E.nums[id] ?? []).some((k) => E.called.includes(k));
const slotOf = (E: RubaState, id: string) => rubaSlot(E.team[id] ?? 0, E.nums[id]?.[0] ?? 1, E.n);

// la nonna sceglie il numero: prima quelli usciti meno, mai lo stesso di prima; ogni tanto due insieme
function pickNumbers(api: Api) {
  const E = api.ext;
  // solo i numeri che hanno qualcuno in gioco in tutte e due le squadre
  const live = (k: number, t: number) => api.inGame().some((id) => E.team[id] === t && E.nums[id]?.includes(k));
  let pool = Array.from({ length: E.n }, (_, i) => i + 1).filter((k) => live(k, 0) && live(k, 1));
  if (!pool.length) pool = Array.from({ length: E.n }, (_, i) => i + 1).filter((k) => live(k, 0) || live(k, 1));
  if (!pool.length) return [1];
  const prev = E.called;
  const pick = (from: number[]) => {
    const w = from.map((k) => (prev.includes(k) && from.length > 1 ? 0.05 : 1) / (1 + (E.times[k] ?? 0) * 1.6));
    let r = Math.random() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < from.length; i++) if ((r -= w[i]) <= 0) return from[i];
    return from[from.length - 1];
  };
  const first = pick(pool);
  const out = [first];
  if (pool.length >= 3 && E.calls >= 2 && Math.random() < 0.22) out.push(pick(pool.filter((k) => k !== first)));
  for (const k of out) E.times[k] = (E.times[k] ?? 0) + 1;
  E.calls++;
  return out;
}

function point(api: Api, team: number, by: string | null, how: string, victim: string | null) {
  const E = api.ext;
  E.score[team] += 1;
  if (by) E.pts[by] = (E.pts[by] ?? 0) + 1;
  E.last = { team, by, how };
  const p = api.pos(victim ?? by ?? E.carrier ?? '') ?? { x: 0, z: 0 };
  api.emit({ k: 'ruba_point', team, by, how, victim, x: p.x, z: p.z, sc: E.score });
  E.phase = 'POINT';
  E.at = api.now;
  E.until = api.now + RUBA.pointMs;
  E.carrier = null;
  E.chasers = [];
}

// tutti al proprio posto (i giocatori veri li rimette a posto anche il loro telefono)
function lineUp(api: Api) {
  const E = api.ext;
  for (const id of api.inGame()) {
    const s = slotOf(E, id);
    const p = api.pos(id);
    if (!p || Math.hypot(p.x - s.x, p.z - s.z) > 0.5 || p.y > 0.5) api.teleport(id, { x: s.x, y: 0, z: s.z, r: s.r });
  }
}

// il bot che corre: reazione, finte davanti allo strofinaccio, presa, fuga a casa o inseguimento
function runBot(api: Api, b: MiniBot) {
  const E = api.ext;
  const me = b.body;
  const t = E.team[b.id];
  const now = api.now;
  const home = t ? 1 : -1; // casa è verso z negativo per i rossi, positivo per i blu
  if (b.mem.call !== E.at && E.phase === 'CALL') {
    // chiamata nuova: tempo di reazione (i bravi partono prima) e un pizzico di caso
    b.mem = { call: E.at, react: E.at + 480 - b.skill * 260 + api.rand(0, 160), feintAt: 0, fx: 0, fz: home * 1.7, go: false, chaseAt: 0 };
  }
  if (E.phase === 'CARRY') {
    if (E.carrier === b.id) {
      // a casa! dritto oltre la linea, scartando di lato chi mi insegue; scatto quando mi è addosso
      let ch: { x: number; z: number; d: number } | null = null;
      for (const id of E.chasers) {
        const p = api.pos(id);
        if (!p) continue;
        const d = Math.hypot(p.x - me.x, p.z - me.z);
        if (!ch || d < ch.d) ch = { x: p.x, z: p.z, d };
      }
      const side = ch && ch.d < 4 ? Math.sign(me.x - ch.x || Math.random() - 0.5) * 1.2 : 0;
      api.go(b, clamp(me.x + side, -RUBA.halfX + 1, RUBA.halfX - 1), home * (RUBA.lineZ + 1.5));
      if (ch && ch.d < 2.6 && Math.random() < 0.08 + b.skill * 0.3) api.dash(b);
      return;
    }
    if (E.chasers.includes(b.id) && E.carrier) {
      b.mem.chaseAt ||= now + 300 - b.skill * 200 + api.rand(0, 110);
      if (now < b.mem.chaseAt) return;
      const cp = api.pos(E.carrier);
      if (!cp) return;
      const v = velOf(api, E.carrier);
      const lead = 0.12 + b.skill * 0.38;
      // taglio la strada verso la sua linea
      api.go(b, cp.x + v.vx * lead, cp.z + v.vz * lead);
      const d = Math.hypot(cp.x - me.x, cp.z - me.z);
      if (d < 3.8 && d > 1.2 && Math.random() < 0.15 + b.skill * 0.35) api.dash(b);
      return;
    }
    // l'altro numero chiamato (due numeri insieme): si torna in fila
    const s = slotOf(E, b.id);
    api.go(b, s.x, s.z, 0.7);
    return;
  }
  // CALL: reazione, poi verso lo strofinaccio
  if (now < b.mem.react) return;
  let opp: { id: string; x: number; z: number; d: number } | null = null;
  for (const id of api.inGame()) {
    if (E.team[id] === t || !runner(E, id) || !(E.nums[id] ?? []).some((k) => E.called.includes(k) && (E.nums[b.id] ?? []).includes(k))) continue;
    const p = api.pos(id);
    if (!p) continue;
    const d = Math.hypot(p.x, p.z);
    if (!opp || d < opp.d) opp = { id, x: p.x, z: p.z, d };
  }
  const dMe = Math.hypot(me.x, me.z);
  // l'avversario sta arrivando di corsa? allora non è "lontano" (lo prenderebbe subito dopo la presa)
  const ov = opp ? velOf(api, opp.id) : { vx: 0, vz: 0 };
  const coming = opp ? -(ov.vx * opp.x + ov.vz * opp.z) / (opp.d || 1) : 0;
  const far = !opp || opp.d > 4.4 || (opp.d > 3 && coming < 2.5) || dMe < opp.d * 0.35;
  if (b.mem.go || far || !opp) {
    // via libera (o deciso): dritto sullo strofinaccio (i meno bravi ci si buttano con lo scatto)
    b.mem.go = true;
    api.go(b, 0, 0);
    if (dMe < 3 && dMe > 1.2 && Math.random() < 0.25 * (1 - b.skill)) api.dash(b);
    return;
  }
  if (dMe > 2.5) {
    api.go(b, b.mem.fx, b.mem.fz);
    return;
  }
  // faccia a faccia: finte avanti e indietro, di lato; chi indietreggia o si distrae lascia la presa all'altro
  if (now >= b.mem.feintAt) {
    b.mem.feintAt = now + api.rand(320, 800);
    b.mem.fx = api.rand(-1.0, 1.0);
    b.mem.fz = home * api.rand(0.95, 1.75);
  }
  api.go(b, b.mem.fx, b.mem.fz, 0.85);
  const away = coming < -1.2; // l'avversario sta tornando indietro
  const late = now - E.at > 5000;
  const chance = (away ? 0.22 : 0.015) * (0.5 + b.skill) + (late ? 0.06 : 0) + (opp.d > 2.6 ? 0.07 : 0);
  if (Math.random() < chance) b.mem.go = true;
}

registerServerMini<RubaState>({
  kind: 'RUBABANDIERA',
  ends: 'time',
  falls: 'none',
  init: (api) => {
    const team = splitTeams(api);
    // i numeri: 1..n in ogni squadra (in ordine a caso); nella squadra più piccola qualcuno ne ha due
    const nums: Record<string, number[]> = {};
    const lists = [0, 1].map((t) => [...mates(api, team, t)].sort(() => Math.random() - 0.5));
    const n = Math.max(1, ...lists.map((l) => l.length));
    lists.forEach((l) => {
      l.forEach((id, i) => (nums[id] = [i + 1]));
      for (let k = l.length + 1; k <= n && l.length; k++) nums[l[(k - 1) % l.length]].push(k);
    });
    return { team, nums, n, phase: 'WAIT', at: 0, until: 0, called: [], carrier: null, chasers: [], score: [0, 0], pts: {}, times: {}, calls: 0, last: null };
  },
  spawn: (api, id) => ({ ...slotOf(api.ext, id), y: 0 }),
  play: (api) => {
    const E = api.ext;
    E.phase = 'WAIT';
    E.at = api.now;
    E.until = api.now + api.rand(2200, 3000);
  },
  tick(api) {
    const E = api.ext;
    const now = api.now;
    trackHumans(api);
    if (E.phase === 'WAIT') {
      if (now < E.until) return false;
      E.called = pickNumbers(api);
      E.phase = 'CALL';
      E.at = now;
      E.until = now + RUBA.noGrab;
      api.emit({ k: 'ruba_call', nums: E.called });
      return true;
    }
    if (E.phase === 'CALL') {
      // il primo che tocca lo strofinaccio (al centro) lo prende
      for (const id of api.inGame()) {
        if (!runner(E, id)) continue;
        const p = api.pos(id);
        if (!p || p.y > 2.4 || Math.hypot(p.x, p.z) > RUBA.grabR) continue;
        const mine = (E.nums[id] ?? []).filter((k) => E.called.includes(k));
        E.carrier = id;
        E.chasers = api.inGame().filter((o) => E.team[o] !== E.team[id] && (E.nums[o] ?? []).some((k) => mine.includes(k)));
        E.phase = 'CARRY';
        E.at = now;
        E.until = now + RUBA.carryMax;
        api.emit({ k: 'ruba_grab', id });
        return true;
      }
      if (now >= E.until) {
        api.emit({ k: 'ruba_none' });
        E.phase = 'POINT';
        E.at = now;
        E.until = now + 1400;
        E.last = null;
        return true;
      }
      return false;
    }
    if (E.phase === 'CARRY' && E.carrier) {
      const id = E.carrier;
      const t = E.team[id];
      const p = api.pos(id);
      if (!api.alive(id) || !p) {
        point(api, 1 - t, null, 'fuori', id);
        return true;
      }
      // toccato da chi ha lo stesso numero
      for (const ch of E.chasers) {
        const q = api.alive(ch) ? api.pos(ch) : null;
        if (q && Math.hypot(q.x - p.x, q.z - p.z) < RUBA.tagR && Math.abs(q.y - p.y) < 1.7) {
          point(api, 1 - t, ch, 'preso', id);
          return true;
        }
      }
      // a casa: oltre la propria linea
      if ((t === 0 && p.z <= -RUBA.lineZ) || (t === 1 && p.z >= RUBA.lineZ)) {
        point(api, t, id, 'casa', null);
        return true;
      }
      if (now >= E.until) {
        point(api, 1 - t, null, 'lento', id);
        return true;
      }
      return false;
    }
    if (E.phase === 'POINT' && now >= E.until) {
      if (Math.max(...E.score) >= RUBA.target) {
        api.end();
        return true;
      }
      lineUp(api);
      E.phase = 'WAIT'; // (i numeri chiamati restano: la nonna non ripete subito lo stesso)
      E.at = now;
      E.until = now + api.rand(RUBA.waitMin, RUBA.waitMax);
      return true;
    }
    return false;
  },
  bot(api, b) {
    const E = api.ext;
    if (runner(E, b.id)) runBot(api, b);
    else b.body.r = E.team[b.id] ? Math.PI : 0; // fermo al suo posto, girato verso la nonna
  },
  rank: (api) => {
    const E = api.ext;
    return teamRank(api, E.team, E.score, (id) => 2 * (E.pts[id] ?? 0), (id) => !api.alive(id));
  },
  view: (api) => {
    const E = api.ext;
    return {
      team: E.team,
      nums: E.nums,
      n: E.n,
      phase: E.phase,
      at: E.at,
      until: E.until,
      called: E.called,
      carrier: E.carrier,
      chasers: E.chasers,
      score: E.score,
      pts: E.pts,
      last: E.last,
    };
  },
});
