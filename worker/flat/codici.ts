// 🗝️ Nomi in codice (tipo Codenames): rossi contro blu su una griglia 5×5 di parole. Il capitano di ogni squadra vede
// la chiave (di chi è ogni parola) e dà UNA parola + un numero; i compagni indicano le carte e le scoprono.
import type { GameSettings } from '../../src/types/game';
import { CODICI_WORDS, CODICI_WORDS_SPICY, codiciClash, type CodiciColor, type CodiciView } from '../../src/data/flat/codici';
import type { Ctx, Mode } from '../modes';
import { clean, deck, shuffle } from '../party';
import { registerFlat } from './registry';

const INTRO_MS = 25_000;
const CLUE_MS = 120_000;
const GUESS_MS = 180_000;
const MAX_IDLE = 4; // turni di fila senza scoprire niente: la partita si ferma (nessuno sta giocando)
const COLOR: [CodiciColor, CodiciColor] = ['R', 'B'];

type Team = 0 | 1;

interface CodiciState {
  order: string[];
  teams: Record<string, Team>;
  captains: [string, string];
  words: string[];
  key: CodiciColor[];
  open: boolean[];
  picks: Record<string, number>; // giocatore → carta che indica
  starter: Team;
  turn: Team;
  turnNo: number;
  stage: CodiciView['stage'];
  stageEndsAt: number | null;
  clue: { word: string; n: number } | null;
  guesses: number;
  ready: string[];
  last: CodiciView['last'];
  revealNo: number;
  log: CodiciView['log'];
  idle: number;
  winner: Team | null;
  endReason: CodiciView['endReason'];
  scores: Record<string, number>;
}

// Capitani: tra una partita e l'altra si preferisce chi l'ha fatto meno volte (memoria del server, finché resta acceso)
const captainTimes = new Map<string, number>();
function pickCaptain(ids: string[]): string {
  const times = (id: string) => captainTimes.get(id) ?? 0;
  const min = Math.min(...ids.map(times));
  const pool = ids.filter((id) => times(id) === min);
  const id = pool[Math.floor(Math.random() * pool.length)];
  captainTimes.set(id, min + 1);
  if (captainTimes.size > 2000) captainTimes.delete(captainTimes.keys().next().value as string);
  return id;
}

// 25 parole senza doppioni della stessa famiglia (gatto e gattino non stanno insieme sul tabellone)
function pickWords(spicy: boolean): string[] {
  const out: string[] = [];
  for (const w of deck(CODICI_WORDS, CODICI_WORDS_SPICY, spicy)) {
    if (out.some((x) => codiciClash(x, w))) continue;
    out.push(w);
    if (out.length === 25) break;
  }
  return out;
}

const other = (t: Team): Team => (t === 0 ? 1 : 0);
const members = (s: CodiciState, t: Team) => s.order.filter((id) => s.teams[id] === t);
// chi indovina: i compagni del capitano (se il capitano è rimasto da solo, gioca lui)
function guessers(s: CodiciState, t: Team): string[] {
  const list = members(s, t).filter((id) => id !== s.captains[t]);
  return list.length ? list : members(s, t);
}
const leftOf = (s: CodiciState, t: Team) => s.key.filter((k, i) => k === COLOR[t] && !s.open[i]).length;
const maxGuesses = (s: CodiciState) => (!s.clue || s.clue.n <= 0 ? null : s.clue.n + 1);

function finish(s: CodiciState, winner: Team | null, reason: NonNullable<CodiciView['endReason']>) {
  s.stage = 'END';
  s.stageEndsAt = null;
  s.winner = winner;
  s.endReason = reason;
  s.picks = {};
  if (winner === null) return;
  // vincenti 3 punti, il loro capitano uno in più
  for (const id of members(s, winner)) s.scores[id] = (s.scores[id] ?? 0) + 3 + (id === s.captains[winner] ? 1 : 0);
}

// tocca a una squadra: prima l'indizio del capitano
function toClue(s: CodiciState, t: Team, ctx: Ctx) {
  s.turn = t;
  s.turnNo += 1;
  s.stage = 'CLUE';
  s.stageEndsAt = ctx.now + CLUE_MS;
  s.clue = null;
  s.guesses = 0;
  s.picks = {};
  // capitano scollegato: passa il ruolo a un compagno collegato (vedrà la chiave da qui in poi)
  if (!ctx.isOnline(s.captains[t])) {
    const sub = members(s, t).find((id) => ctx.isOnline(id));
    if (sub) s.captains[t] = sub;
  }
}

// fine turno: se nessuno ha scoperto niente per troppi turni di fila, la partita si ferma
function endTurn(s: CodiciState, ctx: Ctx) {
  s.idle = s.guesses > 0 ? 0 : s.idle + 1;
  if (s.idle >= MAX_IDLE) return finish(s, null, 'ferma');
  toClue(s, other(s.turn), ctx);
}

function reveal(s: CodiciState, i: number, by: string, ctx: Ctx) {
  const t = s.turn;
  const color = s.key[i];
  s.open[i] = true;
  s.guesses += 1;
  s.revealNo += 1;
  s.last = { i, by, no: s.revealNo };
  s.log[s.log.length - 1]?.hits.push(color);
  for (const [id, p] of Object.entries(s.picks)) if (p === i) delete s.picks[id];
  if (color === 'X') return finish(s, other(t), 'assassino');
  // una carta può completare le parole di una delle due squadre (anche quella avversaria!)
  if (leftOf(s, t) === 0) return finish(s, t, 'tutte');
  if (leftOf(s, other(t)) === 0) return finish(s, other(t), 'tutte');
  if (color !== COLOR[t]) return endTurn(s, ctx); // neutra o avversaria
  const max = maxGuesses(s);
  if (max !== null && s.guesses >= max) endTurn(s, ctx);
}

const allReady = (s: CodiciState, ctx: Ctx) => s.order.filter((id) => ctx.isOnline(id)).every((id) => s.ready.includes(id));

export const codici: Mode<CodiciState> = {
  start(settings: GameSettings, players, ctx) {
    // squadre bilanciate a caso, un capitano per squadra
    const order = shuffle(players.map((p) => p.id));
    const teams: Record<string, Team> = Object.fromEntries(order.map((id, i) => [id, (i % 2) as Team]));
    const starter: Team = Math.random() < 0.5 ? 0 : 1;
    // chiave: chi inizia ha 9 parole, gli altri 8, 7 passanti e 1 assassino
    const key = shuffle<CodiciColor>([
      ...Array<CodiciColor>(9).fill(COLOR[starter]),
      ...Array<CodiciColor>(8).fill(COLOR[other(starter)]),
      ...Array<CodiciColor>(7).fill('N'),
      'X',
    ]);
    const s: CodiciState = {
      order,
      teams,
      captains: ['', ''],
      words: pickWords(!!settings.spicy),
      key,
      open: Array(25).fill(false),
      picks: {},
      starter,
      turn: starter,
      turnNo: 0,
      stage: 'INTRO',
      stageEndsAt: ctx.now + INTRO_MS,
      clue: null,
      guesses: 0,
      ready: [],
      last: null,
      revealNo: 0,
      log: [],
      idle: 0,
      winner: null,
      endReason: null,
      scores: Object.fromEntries(order.map((id) => [id, 0])),
    };
    s.captains = [pickCaptain(members(s, 0)), pickCaptain(members(s, 1))];
    return s;
  },
  action(s, me, type, payload, ctx) {
    if (type === 'MG_READY') {
      if (s.stage !== 'INTRO' || !s.order.includes(me) || s.ready.includes(me)) return false;
      s.ready.push(me);
      if (allReady(s, ctx)) toClue(s, s.starter, ctx);
      return true;
    }
    if (type === 'MG_CLUE') {
      if (s.stage !== 'CLUE' || me !== s.captains[s.turn]) return false;
      // UNA parola (si tiene il primo pezzo), almeno due lettere, e non una parola ancora coperta sul tabellone
      const word = clean(payload?.word, 24).split(' ')[0];
      const n = Number(payload?.n);
      if (!/\p{L}.*\p{L}/u.test(word) || !Number.isInteger(n) || n < -1 || n > 9) return false;
      if (s.words.some((w, i) => !s.open[i] && codiciClash(w, word))) return false;
      s.clue = { word, n };
      s.log = [...s.log, { team: s.turn, word, n, hits: [] }].slice(-30);
      s.stage = 'GUESS';
      s.stageEndsAt = ctx.now + GUESS_MS;
      return true;
    }
    if (type === 'MG_PICK') {
      const i = Number(payload?.i);
      if (s.stage !== 'GUESS' || !guessers(s, s.turn).includes(me)) return false;
      if (!Number.isInteger(i) || i < 0 || i >= 25 || s.open[i]) return false;
      // ritoccare la stessa carta toglie l'indicazione
      if (s.picks[me] === i) delete s.picks[me];
      else s.picks[me] = i;
      return true;
    }
    if (type === 'MG_REVEAL') {
      const i = Number(payload?.i);
      if (s.stage !== 'GUESS' || !guessers(s, s.turn).includes(me) || s.picks[me] !== i || s.open[i]) return false;
      reveal(s, i, me, ctx);
      return true;
    }
    if (type === 'MG_PASS') {
      // si passa solo dopo aver scoperto almeno una carta
      if (s.stage !== 'GUESS' || !guessers(s, s.turn).includes(me) || s.guesses < 1) return false;
      endTurn(s, ctx);
      return true;
    }
    if (type === 'MG_FORCE' && ctx.canLead(me) && s.stage !== 'END') {
      if (s.stage === 'INTRO') toClue(s, s.starter, ctx);
      else endTurn(s, ctx);
      return true;
    }
    return false;
  },
  tick(s, ctx) {
    if (!s.stageEndsAt || ctx.now < s.stageEndsAt) return false;
    if (s.stage === 'INTRO') toClue(s, s.starter, ctx);
    else if (s.stage === 'CLUE' || s.stage === 'GUESS') endTurn(s, ctx); // tempo scaduto: tocca agli altri
    return true;
  },
  deadline: (s) => s.stageEndsAt,
  view(s, me): CodiciView {
    const myTeam = me in s.teams ? s.teams[me] : null;
    const amCaptain = s.captains.includes(me);
    const all = amCaptain || s.stage === 'END';
    const picksOf = (i: number) => Object.keys(s.picks).filter((id) => s.picks[id] === i);
    return {
      stage: s.stage,
      order: s.order,
      teams: s.teams,
      captains: s.captains,
      myTeam,
      amCaptain,
      starter: s.starter,
      turn: s.turn,
      turnNo: s.turnNo,
      stageEndsAt: s.stageEndsAt,
      // la chiave la vedono solo i capitani (e tutti a fine partita)
      cards: s.words.map((word, i) => ({ word, color: s.open[i] || all ? s.key[i] : null, open: s.open[i], picks: picksOf(i) })),
      left: [leftOf(s, 0), leftOf(s, 1)],
      clue: s.clue,
      guesses: s.guesses,
      maxGuesses: maxGuesses(s),
      ready: s.ready,
      last: s.last,
      log: s.log,
      winner: s.winner,
      endReason: s.endReason,
      scores: s.scores,
    };
  },
  ids: (s) => s.order,
  finished: (s) => s.stage === 'END',
  leave(s, id, ctx) {
    if (s.stage === 'END' || !s.order.includes(id)) return false;
    const t = s.teams[id];
    s.order = s.order.filter((x) => x !== id);
    delete s.teams[id];
    delete s.picks[id];
    delete s.scores[id];
    s.ready = s.ready.filter((x) => x !== id);
    // squadra rimasta vuota: vincono gli altri a tavolino
    if (!members(s, t).length) {
      finish(s, other(t), 'ritiro');
      return true;
    }
    if (s.captains[t] === id) {
      const rest = members(s, t);
      s.captains[t] = rest.find((x) => ctx.isOnline(x)) ?? rest[0];
    }
    if (s.stage === 'INTRO' && allReady(s, ctx)) toClue(s, s.starter, ctx);
    return true;
  },
};

registerFlat('CODICI', codici);
