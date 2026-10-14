// 🐺 Lupi mannari: di notte TUTTI scelgono qualcuno sul telefono (lupi, veggente, medico e contadini),
// così dal vivo nessuno si tradisce; di giorno si discute a voce e si vota chi eliminare.
import type { GameSettings } from '../../src/types/game';
import { flatOpt } from '../../src/data/flatGames';
import { LUPI_ROLES, type LupiLogEntry, type LupiMyNight, type LupiNightSecret, type LupiRole, type LupiTeam, type LupiView } from '../../src/data/flat/lupi';
import type { Ctx, Mode } from '../modes';
import { shuffle } from '../party';
import { registerFlat } from './registry';

const ROLE_MS = 30_000;
const NIGHT_MS = 45_000;
const DAWN_MS = 10_000;
const VOTE_MS = 45_000;
const VOTE_GRACE_MS = 5_000; // hanno votato tutti: ultimi secondi per cambiare idea
const VERDICT_MS = 10_000;

interface LupiState {
  order: string[];
  names: Record<string, string>;
  roles: Record<string, LupiRole>;
  counts: Partial<Record<LupiRole, number>>;
  alive: string[];
  stage: LupiView['stage'];
  stageEndsAt: number | null;
  stageMs: number;
  dayMs: number;
  n: number;
  ready: string[];
  picks: Record<string, string>; // scelte della notte
  done: string[];
  lastSaved: string | null; // il medico non può proteggere lo stesso due notti di fila
  victim: string | null;
  reports: Record<string, LupiMyNight>;
  visions: { n: number; id: string; role: LupiRole }[];
  votes: Record<string, string>;
  closing: boolean;
  out: string | null;
  tie: boolean;
  winner: LupiTeam | null;
  log: LupiLogEntry[];
  secrets: LupiNightSecret[];
  scores: Record<string, number>;
}

const pick = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)];
const isWolf = (s: LupiState, id: string) => s.roles[id] === 'LUPO';
const aliveOnline = (s: LupiState, ctx: Ctx) => s.alive.filter((id) => ctx.isOnline(id));

// Auto: 5-6 giocatori 1 lupo, 7-10 due, 11+ tre. Forzati: sempre meno della metà ANCHE dopo la prima notte
// (2 lupi su 5 o 3 su 7 vincerebbero alla prima alba senza giocare)
export function wolvesFor(n: number, forced: number): number {
  const auto = n <= 6 ? 1 : n <= 10 ? 2 : 3;
  return Math.max(1, Math.min(forced || auto, Math.floor((n - 2) / 2)));
}

// chi posso toccare di notte (i lupi non si mangiano tra loro, il medico non ripete la stessa persona)
function targetsFor(s: LupiState, id: string): string[] {
  if (!s.alive.includes(id)) return [];
  const role = s.roles[id];
  if (role === 'LUPO') return s.alive.filter((x) => !isWolf(s, x));
  if (role === 'MEDICO') return s.alive.filter((x) => x !== s.lastSaved);
  return s.alive.filter((x) => x !== id);
}

function setStage(s: LupiState, stage: LupiView['stage'], ms: number, ctx: Ctx) {
  s.stage = stage;
  s.stageMs = ms;
  s.stageEndsAt = ms ? ctx.now + ms : null;
}

function checkWin(s: LupiState): LupiTeam | null {
  const wolves = s.alive.filter((id) => isWolf(s, id)).length;
  if (!wolves) return 'VILLAGGIO';
  if (wolves >= s.alive.length - wolves) return 'LUPI';
  return null;
}

function finish(s: LupiState, winner: LupiTeam, ctx: Ctx) {
  s.winner = winner;
  // vincitori 3 punti, chi è ancora vivo +1
  for (const id of s.order) {
    if (LUPI_ROLES[s.roles[id]].team === winner) s.scores[id] += 3;
    if (s.alive.includes(id)) s.scores[id] += 1;
  }
  setStage(s, 'END', 0, ctx);
}

function toNight(s: LupiState, ctx: Ctx) {
  s.picks = {};
  s.done = [];
  s.reports = {};
  s.victim = null;
  setStage(s, 'NIGHT', NIGHT_MS, ctx);
}

// fine della notte: il branco attacca, il medico salva, la veggente scopre
function endNight(s: LupiState, ctx: Ctx) {
  const chosen = (id: string) => (s.picks[id] && targetsFor(s, id).includes(s.picks[id]) ? s.picks[id] : null);
  const wolves = s.alive.filter((id) => isWolf(s, id));
  const tally: Record<string, number> = {};
  for (const w of wolves) {
    const t = chosen(w);
    if (t) tally[t] = (tally[t] ?? 0) + 1;
  }
  const top = Math.max(0, ...Object.values(tally));
  const best = Object.keys(tally).filter((id) => tally[id] === top);
  // il branco non ha scelto (o non c'è nessuno collegato): la fame decide a caso
  const prey = s.alive.filter((id) => !isWolf(s, id));
  const random = !best.length;
  const attacked = best.length ? pick(best) : prey.length ? pick(prey) : null;

  const medic = s.alive.find((id) => s.roles[id] === 'MEDICO') ?? null;
  const seer = s.alive.find((id) => s.roles[id] === 'VEGGENTE') ?? null;
  const medicPick = medic ? chosen(medic) : null;
  const seerPick = seer ? chosen(seer) : null;
  const saved = !!attacked && attacked === medicPick;
  s.lastSaved = medicPick;

  const suspects: Record<string, string> = {};
  for (const id of s.alive) {
    const t = chosen(id);
    if (s.roles[id] === 'CONTADINO' && t) suspects[id] = t;
  }

  // il resoconto privato di ognuno (si legge all'alba)
  s.reports = {};
  for (const id of s.alive) {
    const role = s.roles[id];
    const target = chosen(id);
    if (role === 'LUPO') s.reports[id] = { role, target: attacked, killed: saved ? null : attacked };
    else if (role === 'VEGGENTE') s.reports[id] = { role, target, found: target ? s.roles[target] : undefined };
    else if (role === 'MEDICO') s.reports[id] = { role, target, saved };
    else s.reports[id] = { role, target };
  }
  if (seer && seerPick) s.visions.push({ n: s.n, id: seerPick, role: s.roles[seerPick] });

  s.secrets.push({ n: s.n, wolves: attacked, random, seer: seerPick, medic: medicPick, saved, suspects });
  s.victim = attacked && !saved ? attacked : null;
  if (s.victim) s.alive = s.alive.filter((id) => id !== s.victim);
  s.log.push({ kind: 'NIGHT', n: s.n, id: s.victim, role: s.victim ? s.roles[s.victim] : null });
  setStage(s, 'DAWN', DAWN_MS, ctx);
}

function toDay(s: LupiState, ctx: Ctx) {
  const w = checkWin(s);
  if (w) return finish(s, w, ctx);
  s.ready = [];
  setStage(s, 'DAY', s.dayMs, ctx);
}

function toVote(s: LupiState, ctx: Ctx) {
  s.votes = {};
  s.closing = false;
  setStage(s, 'VOTE', VOTE_MS, ctx);
}

// il più votato è eliminato; pareggio (o nessun voto) = nessuno
function endVote(s: LupiState, ctx: Ctx) {
  const tally: Record<string, number> = {};
  for (const [voter, t] of Object.entries(s.votes)) if (s.alive.includes(voter) && s.alive.includes(t)) tally[t] = (tally[t] ?? 0) + 1;
  const top = Math.max(0, ...Object.values(tally));
  const best = Object.keys(tally).filter((id) => tally[id] === top);
  s.tie = best.length > 1;
  s.out = best.length === 1 ? best[0] : null;
  if (s.out) s.alive = s.alive.filter((id) => id !== s.out);
  s.log.push({ kind: 'DAY', n: s.n, id: s.out, role: s.out ? s.roles[s.out] : null, votes: s.out ? top : undefined, tie: s.tie });
  setStage(s, 'VERDICT', VERDICT_MS, ctx);
}

function afterVerdict(s: LupiState, ctx: Ctx) {
  const w = checkWin(s);
  if (w) return finish(s, w, ctx);
  s.n += 1;
  s.out = null;
  s.tie = false;
  toNight(s, ctx);
}

// passa alla fase dopo (tempo scaduto o "Avanti" di chi guida)
function advance(s: LupiState, ctx: Ctx) {
  if (s.stage === 'ROLE') toNight(s, ctx);
  else if (s.stage === 'NIGHT') endNight(s, ctx);
  else if (s.stage === 'DAWN') toDay(s, ctx);
  else if (s.stage === 'DAY') toVote(s, ctx);
  else if (s.stage === 'VOTE') endVote(s, ctx);
  else if (s.stage === 'VERDICT') afterVerdict(s, ctx);
}

// le fasi che aspettano tutti vanno avanti appena hanno fatto tutti i collegati
function checkAllDone(s: LupiState, ctx: Ctx) {
  const people = s.stage === 'ROLE' ? s.order.filter((id) => ctx.isOnline(id)) : aliveOnline(s, ctx);
  if (!people.length) return;
  if ((s.stage === 'ROLE' || s.stage === 'DAY') && people.every((id) => s.ready.includes(id))) advance(s, ctx);
  else if (s.stage === 'NIGHT' && people.every((id) => s.done.includes(id))) endNight(s, ctx);
  else if (s.stage === 'VOTE' && !s.closing && people.every((id) => id in s.votes)) {
    s.closing = true;
    s.stageEndsAt = Math.min(s.stageEndsAt ?? Infinity, ctx.now + VOTE_GRACE_MS);
  }
}

export const lupi: Mode<LupiState> = {
  start(settings: GameSettings, players, ctx) {
    const order = players.map((p) => p.id);
    const n = order.length;
    const wolves = wolvesFor(n, flatOpt(settings, 'LUPI', 'lupi'));
    const special = flatOpt(settings, 'LUPI', 'speciali') === 1;
    const deal: LupiRole[] = Array.from({ length: wolves }, () => 'LUPO' as LupiRole);
    if (special) deal.push('VEGGENTE');
    if (special && n >= 6) deal.push('MEDICO');
    while (deal.length < n) deal.push('CONTADINO');
    const mixed = shuffle(order);
    const roles: Record<string, LupiRole> = Object.fromEntries(mixed.map((id, i) => [id, deal[i]]));
    const counts: Partial<Record<LupiRole, number>> = {};
    for (const r of deal) counts[r] = (counts[r] ?? 0) + 1;
    const s: LupiState = {
      order,
      names: Object.fromEntries(players.map((p) => [p.id, p.name])),
      roles,
      counts,
      alive: [...order],
      stage: 'ROLE',
      stageEndsAt: null,
      stageMs: 0,
      dayMs: flatOpt(settings, 'LUPI', 'giorno') * 1000,
      n: 1,
      ready: [],
      picks: {},
      done: [],
      lastSaved: null,
      victim: null,
      reports: {},
      visions: [],
      votes: {},
      closing: false,
      out: null,
      tie: false,
      winner: null,
      log: [],
      secrets: [],
      scores: Object.fromEntries(order.map((id) => [id, 0])),
    };
    setStage(s, 'ROLE', ROLE_MS, ctx);
    return s;
  },
  action(s, me, type, payload, ctx) {
    const alive = s.alive.includes(me);
    if (type === 'MG_READY') {
      // carta vista (tutti) o pronti a votare (solo i vivi); si può annullare
      if (!s.order.includes(me) || !(s.stage === 'ROLE' || (s.stage === 'DAY' && alive))) return false;
      s.ready = s.ready.includes(me) ? s.ready.filter((x) => x !== me) : [...s.ready, me];
      checkAllDone(s, ctx);
      return true;
    }
    if (type === 'MG_PICK') {
      const id = String(payload?.id ?? '');
      if (s.stage !== 'NIGHT' || !alive || !targetsFor(s, me).includes(id)) return false;
      if (s.picks[me] === id) return false;
      s.picks[me] = id;
      s.done = s.done.filter((x) => x !== me); // cambiare idea toglie la conferma
      return true;
    }
    if (type === 'MG_LOCK') {
      if (s.stage !== 'NIGHT' || !alive || !s.picks[me] || s.done.includes(me)) return false;
      s.done.push(me);
      checkAllDone(s, ctx);
      return true;
    }
    if (type === 'MG_VOTE') {
      const id = String(payload?.id ?? '');
      if (s.stage !== 'VOTE' || !alive || id === me || !s.alive.includes(id) || s.votes[me] === id) return false;
      s.votes[me] = id;
      checkAllDone(s, ctx);
      return true;
    }
    if (type === 'MG_FORCE' && ctx.canLead(me) && s.stage !== 'END') {
      advance(s, ctx);
      return true;
    }
    return false;
  },
  tick(s, ctx) {
    if (!s.stageEndsAt || ctx.now < s.stageEndsAt || s.stage === 'END') return false;
    advance(s, ctx);
    return true;
  },
  deadline: (s) => s.stageEndsAt,
  view(s, me): LupiView {
    const inGame = s.order.includes(me);
    const myRole = inGame ? s.roles[me] : null;
    const dead = inGame && !s.alive.includes(me);
    const end = s.stage === 'END';
    const seeAll = dead || end; // i morti (e tutti a fine partita) vedono tutto ma non agiscono più
    const roles: Record<string, LupiRole> = {};
    if (seeAll) Object.assign(roles, s.roles);
    else {
      for (const id of s.order) if (!s.alive.includes(id)) roles[id] = s.roles[id]; // i morti si svelano
      if (myRole === 'LUPO') for (const id of s.order) if (isWolf(s, id)) roles[id] = 'LUPO';
      if (myRole === 'VEGGENTE') for (const v of s.visions) roles[v.id] = v.role;
      if (myRole) roles[me] = myRole;
    }
    const night = s.stage === 'NIGHT';
    let pack: Record<string, string | null> | null = null;
    if (night && dead) pack = Object.fromEntries(s.alive.map((id) => [id, s.picks[id] ?? null]));
    else if (night && myRole === 'LUPO' && !dead) pack = Object.fromEntries(s.alive.filter((id) => isWolf(s, id)).map((id) => [id, s.picks[id] ?? null]));
    return {
      stage: s.stage,
      order: s.order,
      names: s.names,
      n: s.n,
      stageEndsAt: s.stageEndsAt,
      stageMs: s.stageMs,
      alive: s.alive,
      counts: s.counts,
      myRole,
      roles,
      ready: s.ready,
      targets: night ? targetsFor(s, me) : [],
      myPick: night ? (s.picks[me] ?? null) : null,
      done: night ? s.done : [],
      pack,
      blocked: myRole === 'MEDICO' || seeAll ? s.lastSaved : null,
      victim: s.stage === 'DAWN' || s.stage === 'DAY' ? s.victim : null,
      myNight: s.stage === 'DAWN' ? (s.reports[me] ?? null) : null,
      visions: myRole === 'VEGGENTE' || seeAll ? s.visions : [],
      votes: s.stage === 'VOTE' || s.stage === 'VERDICT' ? s.votes : {},
      closing: s.closing,
      out: s.out,
      tie: s.tie,
      winner: s.winner,
      log: s.log,
      secrets: seeAll ? s.secrets : null,
      scores: s.scores,
    };
  },
  ids: (s) => s.order,
  finished: (s) => s.stage === 'END',
  leave(s, id, ctx) {
    if (s.stage === 'END' || !s.order.includes(id)) return false;
    // chi se ne va esce dal villaggio: si svela il ruolo e si controlla se qualcuno ha vinto
    if (s.alive.includes(id)) {
      s.alive = s.alive.filter((x) => x !== id);
      s.log.push({ kind: 'LEFT', n: s.n, id, role: s.roles[id] });
      delete s.picks[id];
      for (const [voter, t] of Object.entries(s.votes)) if (voter === id || t === id) delete s.votes[voter];
      const w = checkWin(s);
      if (w) {
        finish(s, w, ctx);
        return true;
      }
    }
    checkAllDone(s, ctx);
    return true;
  },
};

registerFlat('LUPI', lupi);
