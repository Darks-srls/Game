// 🧠 Mente unica (cooperativo, in tempo reale, tipo The Mind): ognuno ha N carte da 1 a 100 al livello N e insieme
// dovete giocarle tutte in ordine crescente, senza turni e senza parlare. Le azioni arrivano subito: il server le
// gestisce nell'ordine d'arrivo e ogni giocata dice QUALE carta si voleva giocare (un doppio tocco non ne gioca due).
import type { GameSettings } from '../../src/types/game';
import { MENTE_MAX_LIVES, MENTE_MAX_STARS, MENTE_REWARDS, menteLevels, type MenteEvent, type MenteView } from '../../src/data/flat/mente';
import type { Ctx, Mode } from '../modes';
import { shuffle } from '../party';
import { registerFlat } from './registry';

const READY_MS = 30_000; // concentrazione: poi si parte comunque
const IDLE_MS = 90_000; // se nessuno gioca per tanto tempo, si perde una vita (qualcuno è sparito)
const PAUSE_MS = 3_500; // dopo un errore o una stellina: tutti guardano le carte scartate
const CLEAR_MS = 5_000;
const STAR_MS = 12_000; // tempo per accettare la stellina

interface MenteState {
  order: string[];
  gone: string[];
  level: number;
  maxLevel: number;
  lives: number;
  stars: number;
  hands: Record<string, number[]>; // sempre in ordine crescente
  pile: { card: number; by: string; bad: boolean }[];
  discarded: number;
  total: number;
  stage: MenteView['stage'];
  stageEndsAt: number | null;
  ready: string[];
  starVote: { by: string; yes: string[]; endsAt: number } | null;
  event: MenteEvent | null;
  eventNo: number;
  reward: MenteView['reward'];
  rewardWasted: boolean;
  result: MenteView['result'];
  mistakes: number;
}

const active = (s: MenteState) => s.order.filter((id) => !s.gone.includes(id));
const cardsLeft = (s: MenteState) => active(s).reduce((t, id) => t + (s.hands[id]?.length ?? 0), 0);
const needed = (s: MenteState, ctx: Ctx) => active(s).filter((id) => ctx.isOnline(id));
const allReady = (s: MenteState, ctx: Ctx) => needed(s, ctx).every((id) => s.ready.includes(id));
const allYes = (s: MenteState, ctx: Ctx) => !!s.starVote && needed(s, ctx).every((id) => s.starVote!.yes.includes(id));

function deal(s: MenteState, ctx: Ctx) {
  const ids = active(s);
  const nums = shuffle(Array.from({ length: 100 }, (_, i) => i + 1));
  s.hands = {};
  ids.forEach((id, k) => (s.hands[id] = nums.slice(k * s.level, (k + 1) * s.level).sort((a, b) => a - b)));
  s.pile = [];
  s.discarded = 0;
  s.total = ids.length * s.level;
  s.ready = [];
  s.starVote = null;
  s.event = null;
  s.reward = null;
  s.rewardWasted = false;
  s.stage = 'READY';
  s.stageEndsAt = ctx.now + READY_MS;
}

function startPlay(s: MenteState, ctx: Ctx) {
  s.stage = 'PLAY';
  s.stageEndsAt = ctx.now + IDLE_MS;
  s.starVote = null;
}

function finish(s: MenteState, result: 'WIN' | 'LOSE') {
  s.stage = 'END';
  s.result = result;
  s.stageEndsAt = null;
  s.starVote = null;
}

function levelClear(s: MenteState, ctx: Ctx) {
  if (s.level >= s.maxLevel) return finish(s, 'WIN');
  const r = MENTE_REWARDS[s.level] ?? null;
  s.reward = r;
  s.rewardWasted = false;
  if (r === 'life') {
    if (s.lives < MENTE_MAX_LIVES) s.lives += 1;
    else s.rewardWasted = true;
  }
  if (r === 'star') {
    if (s.stars < MENTE_MAX_STARS) s.stars += 1;
    else s.rewardWasted = true;
  }
  s.starVote = null;
  s.stage = 'CLEAR';
  s.stageEndsAt = ctx.now + CLEAR_MS;
}

// dopo un errore, una stellina o un'uscita: si guarda cosa è successo, poi si riprende
function afterEvent(s: MenteState, ctx: Ctx) {
  if (s.lives <= 0) return finish(s, 'LOSE');
  if (!cardsLeft(s)) return levelClear(s, ctx);
  s.stage = 'PAUSE';
  s.stageEndsAt = ctx.now + PAUSE_MS;
}

// una carta sulla pila: chi aveva carte più basse le scarta e si perde una vita
function play(s: MenteState, id: string, card: number, ctx: Ctx, idle: boolean) {
  s.hands[id] = s.hands[id].filter((c) => c !== card);
  const lost: MenteEvent['lost'] = [];
  for (const other of active(s)) {
    const low = (s.hands[other] ?? []).filter((c) => c < card);
    if (!low.length) continue;
    lost.push({ id: other, cards: low });
    s.hands[other] = s.hands[other].filter((c) => c > card);
  }
  s.pile.push({ card, by: id, bad: lost.length > 0 });
  s.discarded += lost.reduce((t, l) => t + l.cards.length, 0);
  s.starVote = null; // chi gioca annulla la proposta di stellina
  if (idle || lost.length) {
    s.lives -= 1;
    s.mistakes += 1;
    s.event = { kind: idle ? 'idle' : 'oops', by: id, card, lost };
    s.eventNo += 1;
    return afterEvent(s, ctx);
  }
  if (!cardsLeft(s)) return levelClear(s, ctx);
  s.stageEndsAt = ctx.now + IDLE_MS;
}

// troppo silenzio: la carta più bassa in gioco va sulla pila da sola, ma costa una vita
function idlePenalty(s: MenteState, ctx: Ctx) {
  let who: string | null = null;
  for (const id of active(s)) if (s.hands[id]?.length && (!who || s.hands[id][0] < s.hands[who][0])) who = id;
  if (!who) return levelClear(s, ctx);
  play(s, who, s.hands[who][0], ctx, true);
}

// stellina accettata da tutti: ognuno scarta (scoperta) la sua carta più bassa
function useStar(s: MenteState, ctx: Ctx) {
  const by = s.starVote?.by ?? null;
  s.stars -= 1;
  const lost: MenteEvent['lost'] = [];
  for (const id of active(s)) {
    const h = s.hands[id];
    if (h?.length) lost.push({ id, cards: [h.shift()!] });
  }
  s.discarded += lost.length;
  s.event = { kind: 'star', by, card: null, lost };
  s.eventNo += 1;
  s.starVote = null;
  afterEvent(s, ctx);
}

function advance(s: MenteState, ctx: Ctx) {
  if (s.stage === 'READY') startPlay(s, ctx);
  else if (s.stage === 'PLAY') idlePenalty(s, ctx);
  else if (s.stage === 'PAUSE') {
    s.stage = 'PLAY';
    s.stageEndsAt = ctx.now + IDLE_MS;
  } else if (s.stage === 'CLEAR') {
    s.level += 1;
    deal(s, ctx);
  }
}

export const mente: Mode<MenteState> = {
  start(_settings: GameSettings, players, ctx) {
    const order = shuffle(players.map((p) => p.id));
    const s: MenteState = {
      order,
      gone: [],
      level: 1,
      maxLevel: menteLevels(order.length),
      lives: Math.min(MENTE_MAX_LIVES, order.length),
      stars: 1,
      hands: {},
      pile: [],
      discarded: 0,
      total: 0,
      stage: 'READY',
      stageEndsAt: null,
      ready: [],
      starVote: null,
      event: null,
      eventNo: 0,
      reward: null,
      rewardWasted: false,
      result: null,
      mistakes: 0,
    };
    deal(s, ctx);
    return s;
  },
  action(s, me, type, payload, ctx) {
    if (s.stage === 'END') return false;
    const playing = active(s).includes(me);
    if (type === 'MG_READY') {
      if (s.stage !== 'READY' || !playing || s.ready.includes(me)) return false;
      s.ready.push(me);
      if (allReady(s, ctx)) startPlay(s, ctx);
      return true;
    }
    if (type === 'MG_PLAY') {
      // si gioca solo la propria carta più bassa, e solo se è quella che il telefono vedeva:
      // se nel frattempo è stata scartata (errore di un altro, stellina) la mossa non vale
      const card = Number(payload?.card);
      if (s.stage !== 'PLAY' || !playing || !Number.isInteger(card) || s.hands[me]?.[0] !== card) return false;
      play(s, me, card, ctx, false);
      return true;
    }
    if (type === 'MG_STAR') {
      if (s.stage !== 'PLAY' || !playing || s.stars <= 0 || s.starVote || !cardsLeft(s)) return false;
      s.starVote = { by: me, yes: [me], endsAt: ctx.now + STAR_MS };
      if (allYes(s, ctx)) useStar(s, ctx);
      return true;
    }
    if (type === 'MG_STAR_YES') {
      if (s.stage !== 'PLAY' || !playing || !s.starVote || s.starVote.yes.includes(me)) return false;
      s.starVote.yes.push(me);
      if (allYes(s, ctx)) useStar(s, ctx);
      return true;
    }
    if (type === 'MG_STAR_NO') {
      if (s.stage !== 'PLAY' || !playing || !s.starVote) return false;
      s.starVote = null;
      return true;
    }
    if (type === 'MG_FORCE' && ctx.canLead(me)) {
      advance(s, ctx);
      return true;
    }
    return false;
  },
  tick(s, ctx) {
    if (s.stage === 'END') return false;
    let changed = false;
    if (s.starVote && ctx.now >= s.starVote.endsAt) {
      s.starVote = null;
      changed = true;
    }
    if (s.stageEndsAt && ctx.now >= s.stageEndsAt) {
      advance(s, ctx);
      return true;
    }
    // chi mancava è uscito dall'app: si va avanti senza aspettarlo
    if (s.stage === 'READY' && s.ready.length && allReady(s, ctx)) {
      startPlay(s, ctx);
      return true;
    }
    if (s.stage === 'PLAY' && s.starVote && allYes(s, ctx)) {
      useStar(s, ctx);
      return true;
    }
    return changed;
  },
  deadline(s) {
    const next = Math.min(s.stageEndsAt ?? Infinity, s.starVote?.endsAt ?? Infinity);
    return next === Infinity ? null : next;
  },
  view(s, me): MenteView {
    const ids = active(s);
    const last = s.pile[s.pile.length - 1];
    return {
      stage: s.stage,
      order: s.order,
      gone: s.gone,
      level: s.level,
      maxLevel: s.maxLevel,
      lives: s.lives,
      stars: s.stars,
      counts: Object.fromEntries(ids.map((id) => [id, s.hands[id]?.length ?? 0])),
      myCards: ids.includes(me) ? (s.hands[me] ?? []) : null,
      top: last?.card ?? null,
      topBy: last?.by ?? null,
      trail: s.pile.slice(-8),
      played: s.pile.length + s.discarded,
      total: s.total,
      ready: s.ready,
      stageEndsAt: s.stageEndsAt,
      starVote: s.starVote,
      event: s.event,
      eventNo: s.eventNo,
      reward: s.reward,
      rewardWasted: s.rewardWasted,
      result: s.result,
      mistakes: s.mistakes,
      reveal: s.stage === 'END' ? Object.fromEntries(ids.map((id) => [id, s.hands[id] ?? []])) : null,
    };
  },
  ids: (s) => s.order,
  finished: (s) => s.stage === 'END',
  leave(s, id, ctx) {
    if (s.stage === 'END' || !s.order.includes(id) || s.gone.includes(id)) return false;
    s.gone.push(id);
    const hand = s.hands[id] ?? [];
    s.hands[id] = [];
    s.ready = s.ready.filter((x) => x !== id);
    if (s.starVote) {
      if (s.starVote.by === id) s.starVote = null;
      else s.starVote.yes = s.starVote.yes.filter((x) => x !== id);
    }
    if (!active(s).length) {
      finish(s, 'LOSE');
      return true;
    }
    // le sue carte si scartano scoperte, senza perdere vite
    if (hand.length && s.stage !== 'CLEAR') {
      s.discarded += hand.length;
      s.event = { kind: 'leave', by: id, card: null, lost: [{ id, cards: hand }] };
      s.eventNo += 1;
      if (!cardsLeft(s)) {
        levelClear(s, ctx);
        return true;
      }
      if (s.stage === 'PLAY') {
        s.stage = 'PAUSE';
        s.stageEndsAt = ctx.now + PAUSE_MS;
      }
    }
    if (s.stage === 'READY' && s.ready.length && allReady(s, ctx)) startPlay(s, ctx);
    if (s.stage === 'PLAY' && s.starVote && allYes(s, ctx)) useStar(s, ctx);
    return true;
  },
};

registerFlat('MENTE', mente);
