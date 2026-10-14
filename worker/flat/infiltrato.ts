// 🎩 L'infiltrato: il Maestro (pubblico) e l'Infiltrato (segreto) conoscono la parola; tutti fanno domande sì/no
// a voce e il Maestro risponde (anche coi pulsanti). Se la indovinate, votate chi era l'Infiltrato.
import type { GameSettings } from '../../src/types/game';
import { flatOpt } from '../../src/data/flatGames';
import { INF_WORDS, INF_WORDS_SPICY, type InfAnswer, type InfOutcome, type InfRole, type InfRoundLog, type InfiltratoView } from '../../src/data/flat/infiltrato';
import type { Ctx, Mode } from '../modes';
import { deck, shuffle } from '../party';
import { registerFlat } from './registry';

const ROLE_MS = 35_000;
const VOTE_MS = 60_000;
const REVEAL_MS = 12_000;
const MAX_ROUNDS = 6;
const ANSWERS: InfAnswer[] = ['SI', 'NO', 'FORSE', 'QUASI'];

interface InfState {
  order: string[];
  names: Record<string, string>;
  rounds: number;
  round: number; // da 1
  first: number; // primo Maestro (indice in order)
  turn: number;
  maestro: string;
  infiltrato: string;
  words: string[];
  wordPos: number;
  choices: string[];
  word: string | null;
  stage: InfiltratoView['stage'];
  stageEndsAt: number | null;
  stageMs: number;
  askMs: number;
  ready: string[];
  answers: InfAnswer[];
  answerNo: number;
  counts: Record<InfAnswer, number>;
  lastAnswer: number;
  guessedBy: string | null;
  votes: Record<string, string>;
  accused: string | null;
  outcome: InfOutcome | null;
  gained: Record<string, number>;
  history: InfRoundLog[];
  scores: Record<string, number>;
}

const pick = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

function setStage(s: InfState, stage: InfiltratoView['stage'], ms: number, ctx: Ctx) {
  s.stage = stage;
  s.stageMs = ms;
  s.stageEndsAt = ms ? ctx.now + ms : null;
}

// nuovo round: Maestro a turno (collegato), Infiltrato a caso tra gli altri, tre parole tra cui scegliere
function startRound(s: InfState, ctx: Ctx) {
  const n = s.order.length;
  let idx = (s.first + s.turn) % n;
  for (let k = 0; k < n && !ctx.isOnline(s.order[idx]); k++) {
    s.turn += 1;
    idx = (s.first + s.turn) % n;
  }
  s.maestro = s.order[idx];
  const others = s.order.filter((id) => id !== s.maestro);
  const onlineOthers = others.filter((id) => ctx.isOnline(id));
  s.infiltrato = pick(onlineOthers.length ? onlineOthers : others);
  s.choices = [0, 1, 2].map((k) => s.words[(s.wordPos + k) % s.words.length]);
  s.wordPos += 3;
  s.word = null;
  s.ready = [];
  s.answers = [];
  s.answerNo = 0;
  s.counts = { SI: 0, NO: 0, FORSE: 0, QUASI: 0 };
  s.guessedBy = null;
  s.votes = {};
  s.accused = null;
  s.outcome = null;
  s.gained = {};
  setStage(s, 'ROLE', ROLE_MS, ctx);
}

function toAsk(s: InfState, ctx: Ctx) {
  if (!s.word) s.word = s.choices[0];
  setStage(s, 'ASK', s.askMs, ctx);
}

// fine del round: punti e cronaca
function reveal(s: InfState, outcome: InfOutcome, ctx: Ctx) {
  s.outcome = outcome;
  s.gained = {};
  const add = (id: string, p: number) => {
    s.scores[id] = (s.scores[id] ?? 0) + p;
    s.gained[id] = (s.gained[id] ?? 0) + p;
  };
  if (outcome === 'FOUND') {
    for (const id of s.order) if (id !== s.infiltrato) add(id, 1);
    if (s.guessedBy && s.guessedBy !== s.infiltrato) add(s.guessedBy, 1);
  } else if (outcome === 'ESCAPED') add(s.infiltrato, 3);
  s.history.push({ word: s.word ?? '', maestro: s.maestro, infiltrato: s.infiltrato, outcome, guessedBy: s.guessedBy });
  setStage(s, 'REVEAL', REVEAL_MS, ctx);
}

// il più votato è l'accusato; in caso di pareggio decide il voto del Maestro
function endVote(s: InfState, ctx: Ctx) {
  const tally: Record<string, number> = {};
  for (const t of Object.values(s.votes)) tally[t] = (tally[t] ?? 0) + 1;
  const top = Math.max(0, ...Object.values(tally));
  const best = Object.keys(tally).filter((id) => tally[id] === top);
  const mv = s.votes[s.maestro];
  s.accused = best.length === 1 ? best[0] : mv && best.includes(mv) ? mv : null;
  reveal(s, s.accused === s.infiltrato ? 'FOUND' : 'ESCAPED', ctx);
}

function nextRound(s: InfState, ctx: Ctx) {
  if (s.round >= s.rounds) {
    setStage(s, 'END', 0, ctx);
    return;
  }
  s.round += 1;
  s.turn += 1;
  startRound(s, ctx);
}

function advance(s: InfState, ctx: Ctx) {
  if (s.stage === 'ROLE') toAsk(s, ctx);
  else if (s.stage === 'ASK') reveal(s, 'TIMEOUT', ctx);
  else if (s.stage === 'VOTE') endVote(s, ctx);
  else if (s.stage === 'REVEAL') nextRound(s, ctx);
}

const candidates = (s: InfState, voter: string) => s.order.filter((id) => id !== voter && id !== s.maestro);

function checkAllDone(s: InfState, ctx: Ctx) {
  const online = s.order.filter((id) => ctx.isOnline(id));
  if (!online.length) return;
  if (s.stage === 'ROLE' && s.word && online.every((id) => s.ready.includes(id))) toAsk(s, ctx);
  else if (s.stage === 'VOTE' && online.every((id) => id in s.votes)) endVote(s, ctx);
}

export const infiltrato: Mode<InfState> = {
  start(settings: GameSettings, players, ctx) {
    const order = shuffle(players.map((p) => p.id));
    const s: InfState = {
      order,
      names: Object.fromEntries(players.map((p) => [p.id, p.name])),
      rounds: Math.min(order.length, MAX_ROUNDS),
      round: 1,
      first: 0,
      turn: 0,
      maestro: '',
      infiltrato: '',
      words: deck(INF_WORDS, INF_WORDS_SPICY, settings.spicy),
      wordPos: 0,
      choices: [],
      word: null,
      stage: 'ROLE',
      stageEndsAt: null,
      stageMs: 0,
      askMs: flatOpt(settings, 'INFILTRATO', 'tempo') * 60_000,
      ready: [],
      answers: [],
      answerNo: 0,
      counts: { SI: 0, NO: 0, FORSE: 0, QUASI: 0 },
      lastAnswer: 0,
      guessedBy: null,
      votes: {},
      accused: null,
      outcome: null,
      gained: {},
      history: [],
      scores: Object.fromEntries(order.map((id) => [id, 0])),
    };
    startRound(s, ctx);
    return s;
  },
  action(s, me, type, payload, ctx) {
    if (!s.order.includes(me)) return false;
    if (type === 'MG_WORD') {
      // il Maestro sceglie una delle tre parole
      const w = String(payload?.word ?? '');
      if (s.stage !== 'ROLE' || me !== s.maestro || !s.choices.includes(w) || s.word === w) return false;
      s.word = w;
      checkAllDone(s, ctx);
      return true;
    }
    if (type === 'MG_READY') {
      if (s.stage !== 'ROLE') return false;
      s.ready = s.ready.includes(me) ? s.ready.filter((x) => x !== me) : [...s.ready, me];
      checkAllDone(s, ctx);
      return true;
    }
    if (type === 'MG_ANSWER') {
      const a = payload?.a as InfAnswer;
      if (s.stage !== 'ASK' || me !== s.maestro || !ANSWERS.includes(a) || ctx.now - s.lastAnswer < 300) return false;
      s.lastAnswer = ctx.now;
      s.answers = [...s.answers, a].slice(-12);
      s.answerNo += 1;
      s.counts[a] += 1;
      return true;
    }
    if (type === 'MG_GUESSED') {
      // "HANNO INDOVINATO!": si passa al voto (e si segna chi l'ha detta, se il Maestro lo indica)
      const by = payload?.by ? String(payload.by) : null;
      if (s.stage !== 'ASK' || me !== s.maestro || (by && (!s.order.includes(by) || by === s.maestro))) return false;
      s.guessedBy = by;
      s.votes = {};
      setStage(s, 'VOTE', VOTE_MS, ctx);
      return true;
    }
    if (type === 'MG_VOTE') {
      const id = String(payload?.id ?? '');
      if (s.stage !== 'VOTE' || !candidates(s, me).includes(id) || s.votes[me] === id) return false;
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
  view(s, me): InfiltratoView {
    const inGame = s.order.includes(me);
    const myRole: InfRole | null = !inGame ? null : me === s.maestro ? 'MAESTRO' : me === s.infiltrato ? 'INFILTRATO' : 'CITTADINO';
    const open = s.stage === 'REVEAL' || s.stage === 'END';
    const wordKnown = s.stage === 'VOTE' || open || myRole === 'MAESTRO' || myRole === 'INFILTRATO';
    return {
      stage: s.stage,
      order: s.order,
      names: s.names,
      round: s.round,
      rounds: s.rounds,
      stageEndsAt: s.stageEndsAt,
      stageMs: s.stageMs,
      maestro: s.maestro,
      myRole,
      word: wordKnown ? s.word : null,
      choices: s.stage === 'ROLE' && myRole === 'MAESTRO' ? s.choices : null,
      wordChosen: !!s.word,
      ready: s.ready,
      answers: s.answers,
      answerNo: s.answerNo,
      counts: s.counts,
      guessedBy: s.guessedBy,
      voted: s.stage === 'VOTE' ? Object.keys(s.votes) : [],
      myVote: s.stage === 'VOTE' ? (s.votes[me] ?? null) : null,
      votes: open ? s.votes : null,
      infiltrato: open || myRole === 'INFILTRATO' ? s.infiltrato : null,
      accused: open ? s.accused : null,
      outcome: s.outcome,
      gained: open ? s.gained : {},
      history: s.history,
      scores: s.scores,
    };
  },
  ids: (s) => s.order,
  finished: (s) => s.stage === 'END',
  leave(s, id, ctx) {
    if (s.stage === 'END' || !s.order.includes(id)) return false;
    // se esce il Maestro o l'Infiltrato il round non ha più senso: si passa al prossimo
    if ((id === s.maestro || id === s.infiltrato) && (s.stage === 'ROLE' || s.stage === 'ASK' || s.stage === 'VOTE')) {
      if (s.round >= s.rounds) setStage(s, 'END', 0, ctx);
      else {
        s.round += 1;
        s.turn += 1;
        startRound(s, ctx);
      }
      return true;
    }
    delete s.votes[id];
    for (const [voter, t] of Object.entries(s.votes)) if (t === id) delete s.votes[voter];
    checkAllDone(s, ctx);
    return true;
  },
};

registerFlat('INFILTRATO', infiltrato);
