// ⚡ Microsfide (stile WarioWare): tutti insieme, una sfida lampo dopo l'altra. Il server sceglie la sfida (senza
// ripetere finché può), il seme e la difficoltà; ogni telefono genera la STESSA sfida dal seme, la gioca e manda
// {ok, ms}. Il server accetta un solo risultato a testa, entro la fine più una piccola tolleranza, e controlla i tempi.
import type { GameSettings } from '../../src/types/game';
import { flatOpt } from '../../src/data/flatGames';
import {
  FAST_PTS,
  FIRST_INTRO_MS,
  INTRO_MS,
  OK_PTS,
  RANK_EVERY,
  RANK_MS,
  RESULT_MS,
  SFIDA,
  SFIDA_IDS,
  durOf,
  sfidaDiff,
  type MicrosfideView,
  type MsResult,
  type SfidaId,
} from '../../src/data/flat/microsfide';
import type { Ctx, Mode } from '../modes';
import { shuffle } from '../party';
import { registerFlat } from './registry';

const GRACE_MS = 1000; // i risultati possono arrivare un po' dopo la fine (rete lenta)
const LAG_MS = 2500; // ritardo massimo credibile tra la fine sul telefono e l'arrivo al server
const EARLY_MS = 300; // orologi dei telefoni un filo avanti

interface MsState {
  order: string[];
  scores: Record<string, number>;
  before: Record<string, number>;
  wins: Record<string, number>;
  firsts: Record<string, number>;
  total: number;
  deck: SfidaId[];
  n: number;
  game: SfidaId;
  seed: number;
  diff: number;
  playAt: number;
  endAt: number;
  stage: MicrosfideView['stage'];
  stageEndsAt: number | null;
  res: Record<string, { ok: boolean; ms: number; at: number }>;
  results: MsResult[];
}

const zeros = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, 0]));

// mazzo di sfide mescolato; quando finisce si rimescola (senza ripetere subito l'ultima)
function draw(s: MsState): SfidaId {
  if (!s.deck.length) {
    s.deck = shuffle(SFIDA_IDS);
    if (s.deck[0] === s.game && s.deck.length > 1) s.deck.push(s.deck.shift()!);
  }
  return s.deck.shift()!;
}

function newChallenge(s: MsState, ctx: Ctx) {
  s.n += 1;
  s.game = draw(s);
  s.seed = Math.floor(Math.random() * 2 ** 31);
  s.diff = sfidaDiff(s.n, s.total);
  s.playAt = ctx.now + (s.n === 1 ? FIRST_INTRO_MS : INTRO_MS);
  s.endAt = s.playAt + durOf(s.game, s.diff);
  s.stage = 'INTRO';
  s.stageEndsAt = s.playAt;
  s.res = {};
  s.results = [];
}

function toPlay(s: MsState) {
  s.stage = 'PLAY';
  s.stageEndsAt = s.endAt + GRACE_MS;
}

// fine della sfida: +3 a chi ce l'ha fatta, +3/+2/+1 ai tre più veloci (non nelle sfide "resisti")
function finishPlay(s: MsState, ctx: Ctx) {
  const info = SFIDA[s.game];
  const okIds = s.order.filter((id) => s.res[id]?.ok);
  const fast = info.survive ? [] : [...okIds].sort((a, b) => s.res[a].ms - s.res[b].ms || s.res[a].at - s.res[b].at).slice(0, FAST_PTS.length);
  s.results = s.order.map((id) => {
    const r = s.res[id];
    const place = fast.indexOf(id) + 1;
    const pts = r?.ok ? OK_PTS + (place ? FAST_PTS[place - 1] : 0) : 0;
    s.scores[id] = (s.scores[id] ?? 0) + pts;
    if (r?.ok) s.wins[id] = (s.wins[id] ?? 0) + 1;
    if (place === 1) s.firsts[id] = (s.firsts[id] ?? 0) + 1;
    return { id, ok: !!r?.ok, ms: r ? r.ms : null, pts, place };
  });
  s.stage = 'RESULT';
  s.stageEndsAt = ctx.now + RESULT_MS;
}

function next(s: MsState, ctx: Ctx) {
  if (s.n >= s.total) {
    s.stage = 'END';
    s.stageEndsAt = null;
    return;
  }
  // ogni 5 sfide la classifica
  if (s.stage === 'RESULT' && s.n % RANK_EVERY === 0) {
    s.stage = 'RANK';
    s.stageEndsAt = ctx.now + RANK_MS;
    return;
  }
  if (s.stage === 'RANK') s.before = { ...s.scores };
  newChallenge(s, ctx);
}

// tutti i giocatori collegati hanno mandato il risultato: inutile aspettare
const allDone = (s: MsState, ctx: Ctx) => s.order.filter((id) => ctx.isOnline(id)).every((id) => s.res[id]);

function advance(s: MsState, ctx: Ctx) {
  if (s.stage === 'INTRO') toPlay(s);
  else if (s.stage === 'PLAY') finishPlay(s, ctx);
  else if (s.stage === 'RESULT' || s.stage === 'RANK') next(s, ctx);
}

export const microsfide: Mode<MsState> = {
  start(settings: GameSettings, players, ctx) {
    const order = players.map((p) => p.id);
    const s: MsState = {
      order,
      scores: zeros(order),
      before: zeros(order),
      wins: zeros(order),
      firsts: zeros(order),
      total: flatOpt(settings, 'MICROSFIDE', 'sfide'),
      deck: shuffle(SFIDA_IDS),
      n: 0,
      game: SFIDA_IDS[0],
      seed: 0,
      diff: 0,
      playAt: 0,
      endAt: 0,
      stage: 'INTRO',
      stageEndsAt: null,
      res: {},
      results: [],
    };
    newChallenge(s, ctx);
    return s;
  },
  action(s, me, type, payload, ctx) {
    if (type === 'MG_DONE') {
      let changed = false;
      // il telefono è già partito (l'orologio del server si sveglia un attimo dopo)
      if (s.stage === 'INTRO' && ctx.now >= s.playAt - EARLY_MS) {
        toPlay(s);
        changed = true;
      }
      if (s.stage !== 'PLAY' || !s.order.includes(me) || s.res[me] || Number(payload?.n) !== s.n) return changed;
      if (typeof payload?.ok !== 'boolean') return changed;
      const raw = Number(payload?.ms);
      if (!Number.isFinite(raw)) return changed;
      const dur = s.endAt - s.playAt;
      const elapsed = ctx.now - s.playAt;
      let ok = payload.ok as boolean;
      // tempo impossibile: risultato finto
      if (raw < 0 || raw > dur + 1000) ok = false;
      let ms = Math.round(Math.max(0, Math.min(dur, raw)));
      // non si può dire di aver finito molto prima di quando arriva il messaggio
      ms = Math.max(ms, Math.min(dur, Math.round(elapsed - LAG_MS)));
      // più veloce dell'umanamente possibile (o prima che succeda la cosa da vedere): non vale
      if (ok && ms < SFIDA[s.game].minMs(s.seed, s.diff)) ok = false;
      s.res[me] = { ok, ms, at: ctx.now };
      if (allDone(s, ctx)) finishPlay(s, ctx);
      return true;
    }
    if (type === 'MG_FORCE' && ctx.canLead(me) && s.stage !== 'END') {
      advance(s, ctx);
      return true;
    }
    return false;
  },
  tick(s, ctx) {
    if (!s.stageEndsAt || ctx.now < s.stageEndsAt) return false;
    advance(s, ctx);
    return true;
  },
  deadline: (s) => s.stageEndsAt,
  view(s, me): MicrosfideView {
    const mine = s.res[me];
    return {
      stage: s.stage,
      order: s.order,
      n: s.n,
      total: s.total,
      game: s.game,
      seed: s.seed,
      diff: s.diff,
      playAt: s.playAt,
      endAt: s.endAt,
      stageEndsAt: s.stageEndsAt,
      done: Object.keys(s.res),
      mine: mine ? { ok: mine.ok, ms: mine.ms } : null,
      results: s.results,
      scores: s.scores,
      before: s.before,
      wins: s.wins,
      firsts: s.firsts,
    };
  },
  ids: (s) => s.order,
  finished: (s) => s.stage === 'END',
  leave(s, _id, ctx) {
    // se mancava solo lui, la sfida finisce subito
    if (s.stage === 'PLAY' && allDone(s, ctx)) {
      finishPlay(s, ctx);
      return true;
    }
    return false;
  },
};

registerFlat('MICROSFIDE', microsfide);
