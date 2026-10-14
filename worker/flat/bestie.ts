// 🪳 Bestie bugiarde (tipo Poker degli scarafaggi): passi una carta coperta dichiarando che bestia è.
// Chi la riceve dice VERO o FALSO, oppure la guarda e la ripassa. Perde chi ha davanti 4 bestie uguali.
import type { GameSettings, Player } from '../../src/types/game';
import { BEAST_IDS, BESTIE_COPIES, BESTIE_LOSE_AT, type Beast, type BestieLog, type BestieView, type Said } from '../../src/data/flat/bestie';
import type { Ctx, Mode } from '../modes';
import { shuffle } from '../party';
import { registerFlat } from './registry';

const GIVE_MS = 45_000;
const RECEIVE_MS = 30_000;
const PEEK_MS = 35_000;
const REVEAL_MS = 6_000;
const AFK_MS = 10_000; // chi ha già fatto scadere il tempo: mosse automatiche veloci
const OFFLINE_MS = 3_000;

interface BestieState {
  order: string[];
  hands: Record<string, Beast[]>;
  front: Record<string, Beast[]>; // carte scoperte davanti
  discarded: number;
  stage: BestieView['stage'];
  stageEndsAt: number | null;
  stageMs: number;
  active: string | null;
  card: Beast | null; // segreta finché non si scopre
  from: string | null;
  claim: Beast | null;
  seen: string[];
  chain: BestieView['chain'];
  reveal: BestieView['reveal'];
  loser: string | null;
  lostBy: BestieView['lostBy'];
  gone: string[];
  afk: string[];
  turnNo: number;
  log: BestieLog[];
  logNo: number;
  ranking: string[] | null;
  scores: Record<string, number>;
}

const pick = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)];
const isBeast = (v: unknown): v is Beast => typeof v === 'string' && (BEAST_IDS as string[]).includes(v);
const inPlay = (s: BestieState) => s.order.filter((id) => !s.gone.includes(id));
const plays = (s: BestieState, id: string) => s.order.includes(id) && !s.gone.includes(id);
// a chi si può ancora ripassare la carta: chi è in gioco e non l'ha ancora vista
const candidates = (s: BestieState) => inPlay(s).filter((id) => id !== s.active && !s.seen.includes(id));
const countOf = (list: Beast[], b: Beast) => list.filter((x) => x === b).length;

function addLog(s: BestieState, e: BestieLog) {
  s.log = [...s.log, e].slice(-14);
  s.logNo = (s.logNo ?? 0) + 1;
}

function setTimer(s: BestieState, ctx: Ctx, ms: number) {
  s.stageEndsAt = ctx.now + ms;
  s.stageMs = ms;
}

const waitMs = (s: BestieState, id: string, base: number, ctx: Ctx) => (!ctx.isOnline(id) ? OFFLINE_MS : s.afk.includes(id) ? AFK_MS : base);

function markAfk(s: BestieState, id: string) {
  if (!s.afk.includes(id)) s.afk.push(id);
  addLog(s, { k: 'auto', by: id });
}

function nextInPlay(s: BestieState, from: string): string {
  const n = s.order.length;
  const i = s.order.indexOf(from);
  for (let k = 1; k <= n; k++) {
    const id = s.order[(i + k) % n];
    if (plays(s, id)) return id;
  }
  return from;
}

// tocca a "id" passare una carta (se non ne ha più, ha perso)
function startGive(s: BestieState, id: string, ctx: Ctx) {
  s.active = plays(s, id) ? id : nextInPlay(s, id);
  s.stage = 'GIVE';
  s.card = null;
  s.from = null;
  s.claim = null;
  s.seen = [];
  s.chain = [];
  if (!s.hands[s.active]?.length) {
    s.loser = s.active;
    s.lostBy = 'MANO';
    addLog(s, { k: 'empty', by: s.active });
    return finish(s);
  }
  setTimer(s, ctx, waitMs(s, s.active, GIVE_MS, ctx));
}

function give(s: BestieState, me: string, card: Beast, to: string, claim: Beast, ctx: Ctx) {
  const hand = s.hands[me];
  hand.splice(hand.indexOf(card), 1);
  s.turnNo += 1;
  s.card = card;
  s.from = me;
  s.claim = claim;
  s.seen = [me];
  s.chain = [{ from: me, to, claim }];
  s.reveal = null;
  addLog(s, { k: 'give', by: me, to, claim });
  toReceive(s, to, ctx);
}

function toReceive(s: BestieState, to: string, ctx: Ctx) {
  s.active = to;
  s.stage = 'RECEIVE';
  setTimer(s, ctx, waitMs(s, to, RECEIVE_MS, ctx));
}

function peek(s: BestieState, me: string, ctx: Ctx) {
  s.seen.push(me);
  s.stage = 'PEEK';
  setTimer(s, ctx, waitMs(s, me, PEEK_MS, ctx));
}

function passOn(s: BestieState, me: string, to: string, claim: Beast, ctx: Ctx) {
  s.from = me;
  s.claim = claim;
  s.chain = [...s.chain, { from: me, to, claim }];
  addLog(s, { k: 'pass', by: me, to, claim });
  toReceive(s, to, ctx);
}

// VERO o FALSO: si scopre la carta; chi ha ragione la mette davanti all'altro
function answer(s: BestieState, me: string, said: Said, ctx: Ctx) {
  const card = s.card!;
  const claim = s.claim!;
  const right = (said === 'VERO') === (card === claim);
  const taker = right ? s.from! : me;
  s.front[taker] = [...(s.front[taker] ?? []), card];
  const lost = plays(s, taker) && countOf(s.front[taker], card) >= BESTIE_LOSE_AT; // chi è uscito non può più perdere
  s.reveal = { by: me, said, card, claim, right, taker, lost };
  addLog(s, { k: 'answer', by: me, said, card, claim, right, taker });
  if (lost) {
    s.loser = taker;
    s.lostBy = 'QUATTRO';
    addLog(s, { k: 'four', by: taker, beast: card });
  }
  s.stage = 'REVEAL';
  s.active = null;
  setTimer(s, ctx, REVEAL_MS);
}

// la carta in viaggio non può più arrivare a nessuno (qualcuno è uscito): si scarta e riparte chi l'aveva
function discardCard(s: BestieState, restart: string, ctx: Ctx) {
  addLog(s, { k: 'discard', by: s.active ?? restart });
  s.discarded += 1;
  startGive(s, restart, ctx);
}

// classifica: chi ha perso è ultimo; gli altri con meno carte scoperte stanno più in alto
function finish(s: BestieState) {
  const others = inPlay(s)
    .filter((id) => id !== s.loser)
    .sort((a, b) => s.front[a].length - s.front[b].length);
  const ranking = [...others, ...(s.loser ? [s.loser] : []), ...s.gone.filter((id) => id !== s.loser)];
  s.scores = {};
  others.forEach((id, i) => {
    const prev = others[i - 1];
    s.scores[id] = i > 0 && s.front[prev].length === s.front[id].length ? s.scores[prev] : s.order.length - i;
  });
  for (const id of ranking) if (!(id in s.scores)) s.scores[id] = 0;
  s.ranking = ranking;
  s.stage = 'END';
  s.stageEndsAt = null;
  s.active = null;
}

// dichiarazione a caso: metà delle volte la verità
const randomClaim = (card: Beast): Beast => (Math.random() < 0.5 ? card : pick(BEAST_IDS.filter((b) => b !== card)));

// tempo scaduto (o "Avanti" di chi guida): mossa automatica
function timeout(s: BestieState, ctx: Ctx) {
  const id = s.active;
  if (s.stage === 'GIVE' && id) {
    markAfk(s, id);
    const card = pick(s.hands[id]);
    const to = pick(inPlay(s).filter((x) => x !== id));
    if (!to) return finish(s);
    give(s, id, card, to, randomClaim(card), ctx);
  } else if (s.stage === 'RECEIVE' && id) {
    markAfk(s, id);
    answer(s, id, Math.random() < 0.5 ? 'VERO' : 'FALSO', ctx);
  } else if (s.stage === 'PEEK' && id) {
    markAfk(s, id);
    const to = candidates(s);
    if (to.length) passOn(s, id, pick(to), randomClaim(s.card!), ctx);
    else discardCard(s, id, ctx);
  } else if (s.stage === 'REVEAL') {
    if (s.loser) finish(s);
    else startGive(s, s.reveal?.taker ?? s.order[0], ctx);
  }
}

export const bestie: Mode<BestieState> = {
  start(_settings: GameSettings, players: Player[], ctx) {
    const order = players.map((p) => p.id);
    // 8 bestie × 8 carte: tutte distribuite in parti uguali, le avanzate si scartano
    const deck = shuffle(BEAST_IDS.flatMap((b) => Array.from({ length: BESTIE_COPIES }, () => b)));
    const each = Math.floor(deck.length / Math.max(1, order.length));
    const s: BestieState = {
      order,
      hands: Object.fromEntries(order.map((id, i) => [id, deck.slice(i * each, (i + 1) * each)])),
      front: Object.fromEntries(order.map((id) => [id, []])),
      discarded: deck.length - each * order.length,
      stage: 'GIVE',
      stageEndsAt: null,
      stageMs: GIVE_MS,
      active: null,
      card: null,
      from: null,
      claim: null,
      seen: [],
      chain: [],
      reveal: null,
      loser: null,
      lostBy: null,
      gone: [],
      afk: [],
      turnNo: 0,
      log: [],
      logNo: 0,
      ranking: null,
      scores: {},
    };
    startGive(s, pick(order), ctx);
    return s;
  },
  action(s, me, type, payload, ctx) {
    if (s.stage === 'END') return false;
    if (type === 'MG_FORCE') {
      if (!ctx.canLead(me)) return false;
      timeout(s, ctx);
      return true;
    }
    if (!plays(s, me) || s.active !== me) return false;
    const back = () => (s.afk = s.afk.filter((x) => x !== me));
    switch (type) {
      case 'MG_GIVE': {
        const { card, claim } = payload ?? {};
        const to = String(payload?.to ?? '');
        if (s.stage !== 'GIVE' || !isBeast(card) || !isBeast(claim) || !s.hands[me].includes(card) || to === me || !plays(s, to)) return false;
        back();
        give(s, me, card, to, claim, ctx);
        return true;
      }
      case 'MG_ANSWER': {
        const said = payload?.said;
        if (s.stage !== 'RECEIVE' || (said !== 'VERO' && said !== 'FALSO')) return false;
        back();
        answer(s, me, said, ctx);
        return true;
      }
      case 'MG_PEEK':
        if (s.stage !== 'RECEIVE' || !candidates(s).length) return false;
        back();
        peek(s, me, ctx);
        return true;
      case 'MG_PASS': {
        const claim = payload?.claim;
        const to = String(payload?.to ?? '');
        if (s.stage !== 'PEEK' || !isBeast(claim) || !candidates(s).includes(to)) return false;
        back();
        passOn(s, me, to, claim, ctx);
        return true;
      }
      default:
        return false;
    }
  },
  tick(s, ctx) {
    if (s.stage === 'END' || !s.stageEndsAt || ctx.now < s.stageEndsAt) return false;
    timeout(s, ctx);
    return true;
  },
  deadline: (s) => (s.stage === 'END' ? null : s.stageEndsAt),
  view(s, me): BestieView {
    const open = s.stage === 'REVEAL' || s.stage === 'END';
    const front: BestieView['front'] = {};
    for (const id of s.order) {
      const f: Partial<Record<Beast, number>> = {};
      for (const b of s.front[id] ?? []) f[b] = (f[b] ?? 0) + 1;
      front[id] = f;
    }
    const myHand = [...(s.hands[me] ?? [])].sort((a, b) => BEAST_IDS.indexOf(a) - BEAST_IDS.indexOf(b));
    return {
      stage: s.stage,
      order: s.order,
      stageEndsAt: s.stageEndsAt,
      stageMs: s.stageMs,
      active: s.active,
      hands: Object.fromEntries(s.order.map((id) => [id, s.hands[id]?.length ?? 0])),
      front,
      myHand,
      // la carta in viaggio la vede solo chi l'ha passata o guardata (tutti quando si scopre)
      card: (s.stage === 'RECEIVE' || s.stage === 'PEEK') && s.seen.includes(me) ? s.card : open ? s.reveal?.card ?? null : null,
      from: s.from,
      claim: s.claim,
      seen: s.seen,
      candidates: s.stage === 'RECEIVE' || s.stage === 'PEEK' ? candidates(s) : [],
      chain: s.chain,
      reveal: open ? s.reveal : null,
      loser: s.loser,
      lostBy: s.lostBy,
      gone: s.gone,
      afk: s.afk,
      turnNo: s.turnNo,
      discarded: s.discarded,
      log: s.log,
      logNo: s.logNo ?? s.log.length,
      ranking: s.ranking,
      scores: s.scores,
    };
  },
  ids: (s) => s.order,
  finished: (s) => s.stage === 'END',
  leave(s, id, ctx) {
    if (s.stage === 'END' || !plays(s, id)) return false;
    s.gone.push(id);
    s.afk = s.afk.filter((x) => x !== id);
    addLog(s, { k: 'left', by: id });
    if (inPlay(s).length < 2) {
      finish(s);
      return true;
    }
    if (s.stage === 'GIVE' && s.active === id) startGive(s, nextInPlay(s, id), ctx);
    else if ((s.stage === 'RECEIVE' || s.stage === 'PEEK') && s.active === id) {
      // la carta che aveva in mano si scarta; riparte chi gliel'aveva passata
      discardCard(s, s.from && plays(s, s.from) ? s.from : nextInPlay(s, id), ctx);
    } else if (s.stage === 'PEEK' && !candidates(s).length) discardCard(s, s.active!, ctx);
    return true;
  },
};

registerFlat('BESTIE', bestie);
