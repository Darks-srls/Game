// 💌 Lettere a corte (regole tipo Love Letter classico): una carta in mano, al tuo turno ne peschi una e ne giochi una.
// Il giro finisce quando resta uno solo o finisce il mazzo (vince la carta più alta); chi vince il giro prende una lettera.
import type { GameSettings, Player } from '../../src/types/game';
import { flatOpt } from '../../src/data/flatGames';
import { C_CARDS, C_VALUES, type CHow, type CorteView, type CStage, type CTone } from '../../src/data/flat/corte';
import type { Ctx, Mode } from '../modes';
import { shuffle } from '../party';
import { registerFlat } from './registry';

const TURN_MS = 30_000;
const AWAY_TURN_MS = 5_000; // chi ha lasciato scadere due turni di fila gioca in automatico, più in fretta
const ROUND_MS = 12_000;
const LOG_MAX = 14;

interface Note {
  about: string;
  card: number;
  how: CHow;
  stale: boolean;
}

interface CState {
  order: string[];
  names: Record<string, string>;
  goal: number;
  letters: Record<string, number>;
  gone: string[]; // usciti dalla partita
  round: number;
  starter: string | null; // chi comincia il prossimo giro (il vincitore dell'ultimo)
  deck: number[];
  burned: number | null; // la carta tolta coperta a inizio giro
  burnedUsed: boolean;
  faceUp: number[];
  players: string[]; // chi gioca questo giro
  hands: Record<string, number[]>;
  discards: Record<string, { v: number; forced: boolean }[]>;
  out: string[]; // fuori dal giro
  safe: string[]; // protetti dall'Ancella
  turn: string;
  turnNo: number;
  stage: CStage;
  stageEndsAt: number | null;
  stageMs: number;
  notes: Record<string, Note[]>; // informazioni segrete di ciascuno (Prete, Barone, Re)
  lastPlay: CorteView['lastPlay'];
  roundEnd: CorteView['roundEnd'];
  ready: string[];
  away: Record<string, number>;
  winners: string[];
  log: CorteView['log'];
  logN: number;
}

// --------------------------------------------------------------- aiutanti

const nm = (s: CState, id: string | null) => (id ? (s.names[id] ?? '?') : '?');
const card = (v: number) => `${C_CARDS[v].emoji} ${C_CARDS[v].name}`;
const alivePlayers = (s: CState) => s.players.filter((id) => !s.out.includes(id));
const isAway = (s: CState, id: string, ctx: Ctx) => !ctx.isOnline(id) || (s.away[id] ?? 0) >= 2;
const mustContessa = (hand: number[]) => hand.includes(7) && (hand.includes(5) || hand.includes(6));
// bersagli possibili: in gioco e non protetti (il Principe può puntare anche su chi gioca)
const targets = (s: CState, me: string, self: boolean) => alivePlayers(s).filter((id) => (id !== me && !s.safe.includes(id)) || (self && id === me));
const pick = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

function say(s: CState, by: string | null, text: string, tone: CTone) {
  s.logN += 1;
  s.log = [...s.log, { n: s.logN, by, text, tone }].slice(-LOG_MAX);
}

function setStage(s: CState, stage: CStage, ms: number, ctx: Ctx) {
  s.stage = stage;
  s.stageMs = ms;
  s.stageEndsAt = ctx.now + ms;
}

// le informazioni su un giocatore non valgono più (ha scartato quella carta, ha scambiato, è uscito…)
function staleAbout(s: CState, id: string, v?: number) {
  for (const list of Object.values(s.notes)) for (const n of list) if (n.about === id && (v === undefined || n.card === v)) n.stale = true;
}

function addNote(s: CState, viewer: string, about: string, cardV: number, how: CHow) {
  s.notes[viewer] = [...(s.notes[viewer] ?? []), { about, card: cardV, how, stale: false }].slice(-8);
}

function knockOut(s: CState, id: string) {
  if (s.out.includes(id)) return;
  s.out.push(id);
  // la carta in mano si scopre davanti a tutti
  for (const v of s.hands[id] ?? []) s.discards[id].push({ v, forced: true });
  s.hands[id] = [];
  s.safe = s.safe.filter((x) => x !== id);
  staleAbout(s, id);
}

// carta più probabile per la Guardia: quella con più copie ancora invisibili
function bestGuess(s: CState, me: string): number {
  const seen: Record<number, number> = {};
  const add = (v: number) => (seen[v] = (seen[v] ?? 0) + 1);
  Object.values(s.discards).forEach((list) => list.forEach((d) => add(d.v)));
  s.faceUp.forEach(add);
  (s.hands[me] ?? []).forEach(add);
  const left = C_VALUES.filter((v) => v > 1).map((v) => ({ v, n: C_CARDS[v].count - (seen[v] ?? 0) }));
  const top = Math.max(...left.map((x) => x.n));
  return pick(left.filter((x) => x.n === top)).v;
}

// --------------------------------------------------------------- giri e turni

function startRound(s: CState, ctx: Ctx): void {
  s.round += 1;
  s.players = s.order.filter((id) => !s.gone.includes(id));
  const deck = shuffle(C_VALUES.flatMap((v) => Array.from({ length: C_CARDS[v].count }, () => v)));
  s.burned = deck.pop()!;
  s.burnedUsed = false;
  // in due giocatori si tolgono anche 3 carte scoperte
  s.faceUp = s.players.length === 2 ? deck.splice(deck.length - 3, 3) : [];
  s.hands = Object.fromEntries(s.players.map((id) => [id, [deck.pop()!]]));
  s.deck = deck;
  s.discards = Object.fromEntries(s.players.map((id) => [id, []]));
  s.out = [];
  s.safe = [];
  s.notes = {};
  s.lastPlay = null;
  s.roundEnd = null;
  s.ready = [];
  say(s, null, `💌 Giro ${s.round}: una carta coperta a testa${s.faceUp.length ? ' (e 3 carte tolte scoperte)' : ''}. Via!`, 'info');
  const first = s.starter && s.players.includes(s.starter) ? s.starter : s.players[(s.round - 1) % s.players.length];
  startTurn(s, first, ctx);
}

function startTurn(s: CState, id: string, ctx: Ctx): void {
  s.turn = id;
  s.turnNo += 1;
  s.safe = s.safe.filter((x) => x !== id); // la protezione dell'Ancella finisce al proprio turno
  s.hands[id].push(s.deck.pop()!);
  setStage(s, 'TURN', isAway(s, id, ctx) ? AWAY_TURN_MS : TURN_MS, ctx);
}

// resta uno solo: giro finito
function checkLast(s: CState, ctx: Ctx): boolean {
  const alive = alivePlayers(s);
  if (alive.length > 1) return false;
  endRound(s, alive, 'LAST', ctx);
  return true;
}

function nextTurn(s: CState, ctx: Ctx): void {
  if (checkLast(s, ctx)) return;
  // mazzo finito: si confrontano le carte
  if (!s.deck.length) return endRound(s, alivePlayers(s), 'HIGH', ctx);
  const i = s.players.indexOf(s.turn);
  for (let k = 1; k <= s.players.length; k++) {
    const id = s.players[(i + k) % s.players.length];
    if (!s.out.includes(id)) return startTurn(s, id, ctx);
  }
}

function endRound(s: CState, alive: string[], how: 'LAST' | 'HIGH', ctx: Ctx): void {
  let winners = alive;
  if (how === 'HIGH' && alive.length > 1) {
    const val = (id: string) => s.hands[id][0] ?? 0;
    const best = Math.max(...alive.map(val));
    winners = alive.filter((id) => val(id) === best);
    // pari: vince chi ha la somma degli scarti più alta
    if (winners.length > 1) {
      const sum = (id: string) => s.discards[id].reduce((a, d) => a + d.v, 0);
      const top = Math.max(...winners.map(sum));
      winners = winners.filter((id) => sum(id) === top);
    }
  }
  for (const w of winners) s.letters[w] = (s.letters[w] ?? 0) + 1;
  s.starter = winners[0] ?? null;
  s.roundEnd = { winners, hands: Object.fromEntries(alive.map((id) => [id, s.hands[id][0] ?? 0])), how, burned: s.burned };
  s.ready = [];
  const names = winners.map((id) => nm(s, id)).join(' e ');
  if (!winners.length) say(s, null, 'Nessuno è rimasto: giro senza vincitori', 'info');
  else if (how === 'LAST') say(s, winners[0], `💌 ${names} è l'unico rimasto: vince il giro e una lettera!`, 'win');
  else {
    const v = s.hands[winners[0]][0];
    say(s, winners[0], `💌 Mazzo finito! ${names} ${winners.length > 1 ? 'vincono' : 'vince'} con ${card(v)} (${v}) e ${winners.length > 1 ? 'prendono' : 'prende'} una lettera`, 'win');
  }
  setStage(s, 'ROUND', ROUND_MS, ctx);
}

function finishGame(s: CState): void {
  const active = s.order.filter((id) => !s.gone.includes(id));
  const pool = active.length ? active : s.order;
  const top = Math.max(...pool.map((id) => s.letters[id] ?? 0));
  s.winners = pool.filter((id) => (s.letters[id] ?? 0) === top);
  s.stage = 'END';
  s.stageEndsAt = null;
  say(s, s.winners[0] ?? null, `🏆 ${s.winners.map((id) => nm(s, id)).join(' e ')} conquista il cuore della Principessa con ${top} 💌!`, 'win');
}

// dopo il riepilogo del giro: si ricomincia o si chiude la partita
function afterRound(s: CState, ctx: Ctx): void {
  const active = s.order.filter((id) => !s.gone.includes(id));
  if (active.length < 2 || s.order.some((id) => (s.letters[id] ?? 0) >= s.goal)) return finishGame(s);
  startRound(s, ctx);
}

function checkReady(s: CState, ctx: Ctx): boolean {
  if (s.stage !== 'ROUND') return false;
  const need = s.order.filter((id) => !s.gone.includes(id) && !isAway(s, id, ctx));
  if (need.some((id) => !s.ready.includes(id))) return false;
  afterRound(s, ctx);
  return true;
}

// --------------------------------------------------------------- giocare una carta

function play(s: CState, me: string, idx: number, target: string | null, guess: number, ctx: Ctx, auto: boolean): boolean {
  const hand = s.hands[me];
  if (!hand || hand.length !== 2 || (idx !== 0 && idx !== 1)) return false;
  const v = hand[idx];
  if (mustContessa(hand) && v !== 7) return false; // la Contessa va giocata
  const C = C_CARDS[v];
  let tgt: string | null = null;
  if (C.target) {
    const opts = targets(s, me, v === 5);
    // se tutti gli altri sono protetti la carta si gioca senza effetto
    if (opts.length) {
      if (!target || !opts.includes(target)) return false;
      tgt = target;
    }
  }
  if (v === 1 && tgt && !(Number.isInteger(guess) && guess >= 2 && guess <= 8)) return false;

  hand.splice(idx, 1);
  s.discards[me].push({ v, forced: false });
  staleAbout(s, me, v);
  const who = nm(s, me);
  const t = nm(s, tgt);
  let text = '';
  let tone: CTone = 'play';
  if (C.target && !tgt) text = `${who} gioca ${card(v)}, ma sono tutti protetti: nessun effetto`;
  else if (v === 1 && tgt) {
    const hit = s.hands[tgt][0] === guess;
    text = `${who} gioca ${card(1)} su ${t}: «Hai ${C_CARDS[guess].the}?» ${hit ? `Sì! ${t} è fuori 💥` : 'No ❌'}`;
    tone = hit ? 'hit' : 'miss';
    if (hit) knockOut(s, tgt);
  } else if (v === 2 && tgt) {
    addNote(s, me, tgt, s.hands[tgt][0], 'PRETE');
    text = `${who} gioca ${card(2)} e sbircia la carta di ${t} 👀`;
  } else if (v === 3 && tgt) {
    const a = s.hands[me][0];
    const b = s.hands[tgt][0];
    addNote(s, me, tgt, b, 'BARONE');
    addNote(s, tgt, me, a, 'BARONE');
    if (a === b) text = `${who} gioca ${card(3)} contro ${t}: pareggio, nessuno esce 🤝`;
    else {
      const loser = a > b ? tgt : me;
      text = `${who} gioca ${card(3)} contro ${t}: ${nm(s, loser)} ha la carta più bassa (${card(a > b ? b : a)}) ed è fuori 💥`;
      tone = 'hit';
      knockOut(s, loser);
    }
  } else if (v === 4) {
    s.safe.push(me);
    text = `${who} gioca ${card(4)}: è protetto fino al suo prossimo turno 🛡️`;
    tone = 'safe';
  } else if (v === 5 && tgt) {
    const d = s.hands[tgt].pop()!;
    s.discards[tgt].push({ v: d, forced: true });
    staleAbout(s, tgt);
    const whom = tgt === me ? 'su sé stesso' : `su ${t}`;
    if (d === 8) {
      text = `${who} gioca ${card(5)} ${whom}: ${t} scarta ${card(8)} ed è fuori! 😱`;
      tone = 'hit';
      knockOut(s, tgt);
    } else {
      // mazzo vuoto: si pesca la carta tolta a inizio giro
      const nv = s.deck.length ? s.deck.pop() : !s.burnedUsed && s.burned !== null ? ((s.burnedUsed = true), s.burned) : undefined;
      if (nv !== undefined) s.hands[tgt].push(nv);
      text = `${who} gioca ${card(5)} ${whom}: ${t} scarta ${card(d)} e pesca una carta nuova`;
      if (nv === undefined) knockOut(s, tgt);
    }
  } else if (v === 6 && tgt) {
    const mine = s.hands[me];
    s.hands[me] = s.hands[tgt];
    s.hands[tgt] = mine;
    staleAbout(s, me);
    staleAbout(s, tgt);
    addNote(s, me, tgt, s.hands[tgt][0], 'RE');
    addNote(s, tgt, me, s.hands[me][0], 'RE');
    text = `${who} gioca ${card(6)} e scambia la sua carta con quella di ${t} 🔄`;
  } else if (v === 7) {
    text = `${who} gioca ${card(7)}… avrà il Re o il Principe? 🤔`;
  } else if (v === 8) {
    text = `${who} gioca ${card(8)}… ed è fuori! 🙈`;
    tone = 'out';
    knockOut(s, me);
  }
  say(s, me, `${auto ? '⏰ ' : ''}${text}`, tone);
  s.lastPlay = { n: s.logN, by: me, v, target: tgt, guess: v === 1 && tgt ? guess : null, text };
  nextTurn(s, ctx);
  return true;
}

// tempo scaduto: si gioca la carta più bassa (mai la Principessa) su un bersaglio a caso
function autoPlay(s: CState, ctx: Ctx): void {
  const me = s.turn;
  const hand = s.hands[me];
  s.away[me] = (s.away[me] ?? 0) + 1;
  let idx = hand[0] <= hand[1] ? 0 : 1;
  if (mustContessa(hand)) idx = hand.indexOf(7);
  else if (hand[idx] === 8) idx = 1 - idx;
  for (const i of [idx, 1 - idx]) {
    const v = hand[i];
    const opts = targets(s, me, false);
    const target = C_CARDS[v].target ? (opts.length ? pick(opts) : v === 5 ? me : null) : null;
    if (play(s, me, i, target, bestGuess(s, me), ctx, true)) return;
  }
  // non dovrebbe mai succedere: per non bloccare il gioco si passa oltre
  knockOut(s, me);
  nextTurn(s, ctx);
}

function timeout(s: CState, ctx: Ctx): void {
  if (s.stage === 'TURN') autoPlay(s, ctx);
  else if (s.stage === 'ROUND') afterRound(s, ctx);
}

// --------------------------------------------------------------- il gioco

export const corte: Mode<CState> = {
  start(settings: GameSettings, players: Player[], ctx) {
    const order = shuffle(players.map((p) => p.id));
    const s: CState = {
      order,
      names: Object.fromEntries(players.map((p) => [p.id, p.name])),
      goal: flatOpt(settings, 'CORTE', 'cuori'),
      letters: Object.fromEntries(order.map((id) => [id, 0])),
      gone: [],
      round: 0,
      starter: null,
      deck: [],
      burned: null,
      burnedUsed: false,
      faceUp: [],
      players: [],
      hands: {},
      discards: {},
      out: [],
      safe: [],
      turn: order[0],
      turnNo: 0,
      stage: 'TURN',
      stageEndsAt: null,
      stageMs: TURN_MS,
      notes: {},
      lastPlay: null,
      roundEnd: null,
      ready: [],
      away: {},
      winners: [],
      log: [],
      logN: 0,
    };
    startRound(s, ctx);
    return s;
  },

  action(s, me, type, payload, ctx) {
    if (s.stage === 'END') return false;
    if (type === 'MG_FORCE') {
      if (!ctx.canLead(me)) return false;
      timeout(s, ctx);
      return true;
    }
    if (type === 'MG_PLAY') {
      if (s.stage !== 'TURN' || s.turn !== me) return false;
      const target = payload?.target ? String(payload.target) : null;
      if (!play(s, me, Number(payload?.i), target, Number(payload?.guess), ctx, false)) return false;
      s.away[me] = 0;
      return true;
    }
    if (type === 'MG_READY') {
      if (s.stage !== 'ROUND' || !s.order.includes(me) || s.ready.includes(me)) return false;
      s.away[me] = 0;
      s.ready.push(me);
      checkReady(s, ctx);
      return true;
    }
    return false;
  },

  tick(s, ctx) {
    if (s.stage === 'END') return false;
    if (checkReady(s, ctx)) return true;
    if (!s.stageEndsAt || ctx.now < s.stageEndsAt) return false;
    timeout(s, ctx);
    return true;
  },

  deadline: (s) => s.stageEndsAt,

  view(s, me): CorteView {
    const mine = s.players.includes(me) ? (s.hands[me] ?? []) : null;
    return {
      stage: s.stage,
      order: s.order,
      round: s.round,
      goal: s.goal,
      letters: s.letters,
      turn: s.turn,
      turnNo: s.turnNo,
      stageEndsAt: s.stageEndsAt,
      stageMs: s.stageMs,
      deck: s.deck.length,
      faceUp: s.faceUp,
      seats: Object.fromEntries(
        s.order.map((id) => [
          id,
          {
            inRound: s.players.includes(id),
            out: s.out.includes(id),
            safe: s.safe.includes(id),
            cards: s.hands[id]?.length ?? 0,
            discards: s.discards[id] ?? [],
            gone: s.gone.includes(id),
          },
        ]),
      ),
      hand: mine ? [...mine] : null,
      mustContessa: !!mine && s.stage === 'TURN' && s.turn === me && mustContessa(mine),
      notes: s.notes[me] ?? [],
      lastPlay: s.lastPlay,
      roundEnd: s.roundEnd,
      ready: s.ready,
      winners: s.winners,
      scores: s.letters,
      log: s.log.slice(-10),
    };
  },

  ids: (s) => s.order,
  finished: (s) => s.stage === 'END',

  leave(s, id, ctx) {
    if (s.stage === 'END' || !s.order.includes(id) || s.gone.includes(id)) return false;
    s.gone.push(id);
    say(s, id, `🚪 ${nm(s, id)} ha lasciato la corte`, 'out');
    if (s.order.filter((x) => !s.gone.includes(x)).length < 2) {
      finishGame(s);
      return true;
    }
    if (s.stage === 'TURN' && s.players.includes(id) && !s.out.includes(id)) {
      knockOut(s, id);
      if (s.turn === id) nextTurn(s, ctx);
      else checkLast(s, ctx);
    } else if (s.stage === 'ROUND') checkReady(s, ctx);
    return true;
  },
};

registerFlat('CORTE', corte);
