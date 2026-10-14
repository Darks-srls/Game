// Giochi di gruppo di Axend Games: Battute al volo, Preferiresti?, Sintonia, Parola proibita, Chi sono?
// Ogni gioco tiene il suo stato dentro la stanza; il Durable Object chiama queste funzioni (vedi Mode in modes.ts).
import type { BattuteView, ChiSonoView, GameId, PreferirestiView, SintoniaView, TabuCard, TabuView } from '../src/types/game';
import type { Ctx, Mode } from './modes';
import { BATTUTE, BATTUTE_SPICY } from '../src/data/battute';
import { PREFERIRESTI, PREFERIRESTI_SPICY } from '../src/data/preferiresti';
import { SPECTRA, SPECTRA_SPICY } from '../src/data/sintonia';
import { TABU_CARDS, TABU_CARDS_SPICY } from '../src/data/tabu';
import { PERSONAGGI, PERSONAGGI_SPICY } from '../src/data/chisono';

export const clean = (v: unknown, max: number) => String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, max);

export function shuffle<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 🌶️ Con i contenuti piccanti, quelli sgravati escono più spesso; poi si mescola senza doppioni
export const deck = <T,>(normal: T[], spicy: T[], on: boolean): T[] => [...new Set(shuffle(on ? [...normal, ...spicy, ...spicy] : normal))];

// ---------------------------------------------------------------- 😂 Battute al volo

interface BattuteMatchState {
  prompt: string;
  authors: [string, string];
  answers: [string | null, string | null];
  votes: Record<string, 0 | 1>;
}

interface BattuteState {
  order: string[];
  scores: Record<string, number>;
  gained: Record<string, number>;
  round: number;
  totalRounds: number;
  writeMs: number;
  stage: BattuteView['stage'];
  stageEndsAt: number | null;
  writers: string[];
  matches: BattuteMatchState[];
  current: number;
  pool: string[];
  used: string[];
  battutona: boolean;
  forfeit: boolean;
}

const BATTUTE_VOTE_MS = 25_000;
const BATTUTE_RESULT_MS = 7_000;

// Ogni frase va a due giocatori: ognuno ne completa due, e ogni sfida è uno contro uno
function battuteRound(s: BattuteState, ctx: Ctx) {
  const writers = shuffle(s.order.filter((id) => ctx.isOnline(id)));
  if (writers.length < 2) {
    s.stage = 'END';
    s.stageEndsAt = null;
    return;
  }
  const fresh = s.pool.filter((p) => !s.used.includes(p));
  const prompts = shuffle(fresh.length >= writers.length ? fresh : s.pool).slice(0, writers.length);
  s.used = [...s.used, ...prompts].slice(-300);
  s.writers = writers;
  s.matches = prompts.map((prompt, k) => ({ prompt, authors: [writers[k], writers[(k + 1) % writers.length]], answers: [null, null], votes: {} }));
  s.current = -1;
  s.round += 1;
  s.gained = {};
  s.stage = 'WRITE';
  s.stageEndsAt = ctx.now + s.writeMs;
}

const pendingWriters = (s: BattuteState, ctx: Ctx) =>
  s.writers.filter((id) => ctx.isOnline(id) && s.matches.some((m) => m.authors.some((a, i) => a === id && m.answers[i] === null)));

const battuteVoters = (s: BattuteState, m: BattuteMatchState, ctx: Ctx) => s.order.filter((id) => ctx.isOnline(id) && !m.authors.includes(id));

function battuteResult(s: BattuteState, ctx: Ctx, forfeit: boolean) {
  const m = s.matches[s.current];
  const counts = [0, 0];
  for (const v of Object.values(m.votes)) counts[v]++;
  const total = counts[0] + counts[1];
  s.gained = {};
  s.forfeit = forfeit;
  s.battutona = !forfeit && total >= 2 && (counts[0] === total || counts[1] === total);
  if (forfeit) {
    s.gained[m.authors[m.answers[0] !== null ? 0 : 1]] = 100; // vittoria a tavolino
  } else {
    for (const i of [0, 1]) {
      const points = counts[i] * 100 + (s.battutona && counts[i] === total ? 250 : 0);
      if (points) s.gained[m.authors[i]] = (s.gained[m.authors[i]] ?? 0) + points;
    }
  }
  for (const [id, points] of Object.entries(s.gained)) s.scores[id] = (s.scores[id] ?? 0) + points;
  s.stage = 'RESULT';
  s.stageEndsAt = ctx.now + BATTUTE_RESULT_MS;
}

// Prossima sfida da votare (si saltano quelle senza risposte); finite le sfide, nuovo round o classifica
function battuteNext(s: BattuteState, ctx: Ctx) {
  for (s.current += 1; s.current < s.matches.length; s.current++) {
    const m = s.matches[s.current];
    const has = m.answers.map((a) => a !== null);
    if (!has[0] && !has[1]) continue;
    if (has[0] !== has[1]) return battuteResult(s, ctx, true);
    s.stage = 'VOTE';
    s.stageEndsAt = ctx.now + BATTUTE_VOTE_MS;
    s.gained = {};
    s.battutona = false;
    s.forfeit = false;
    if (!battuteVoters(s, m, ctx).length) battuteResult(s, ctx, false);
    return;
  }
  if (s.round >= s.totalRounds) {
    s.stage = 'END';
    s.stageEndsAt = null;
  } else battuteRound(s, ctx);
}

// Tempo scaduto (o "continua" di chi guida la stanza): si va alla fase successiva
function battuteAdvance(s: BattuteState, ctx: Ctx) {
  if (s.stage === 'WRITE') battuteNext(s, ctx);
  else if (s.stage === 'VOTE') battuteResult(s, ctx, false);
  else if (s.stage === 'RESULT') battuteNext(s, ctx);
}

export const battute: Mode<BattuteState> = {
  start(settings, players, ctx) {
    const order = players.map((p) => p.id);
    const s: BattuteState = {
      order,
      scores: Object.fromEntries(order.map((id) => [id, 0])),
      gained: {},
      round: 0,
      totalRounds: settings.battuteRounds,
      writeMs: settings.writeSeconds * 1000,
      stage: 'WRITE',
      stageEndsAt: null,
      writers: [],
      matches: [],
      current: -1,
      pool: deck(BATTUTE, BATTUTE_SPICY, settings.spicy),
      used: [],
      battutona: false,
      forfeit: false,
    };
    battuteRound(s, ctx);
    return s;
  },
  action(s, me, type, payload, ctx) {
    switch (type) {
      case 'MG_ANSWER': {
        const m = s.stage === 'WRITE' ? s.matches[Number(payload.index)] : undefined;
        const slot = m ? m.authors.indexOf(me) : -1;
        const text = clean(payload.text, 90);
        if (!m || slot < 0 || !text) return false;
        m.answers[slot] = text;
        if (!pendingWriters(s, ctx).length) battuteNext(s, ctx);
        return true;
      }
      case 'MG_VOTE': {
        const m = s.stage === 'VOTE' ? s.matches[s.current] : undefined;
        const choice = payload.choice === 0 || payload.choice === 1 ? (payload.choice as 0 | 1) : null;
        if (!m || choice === null || m.authors.includes(me) || !s.order.includes(me)) return false;
        m.votes[me] = choice;
        if (battuteVoters(s, m, ctx).every((id) => id in m.votes)) battuteResult(s, ctx, false);
        return true;
      }
      case 'MG_FORCE':
        if (!ctx.canLead(me) || s.stage === 'END') return false;
        battuteAdvance(s, ctx);
        return true;
      default:
        return false;
    }
  },
  tick(s, ctx) {
    if (!s.stageEndsAt || ctx.now < s.stageEndsAt) return false;
    battuteAdvance(s, ctx);
    return true;
  },
  deadline: (s) => s.stageEndsAt,
  view(s, me) {
    const m = s.stage === 'VOTE' || s.stage === 'RESULT' ? s.matches[s.current] : null;
    const result = s.stage === 'RESULT';
    const voters = (choice: 0 | 1) => (m ? Object.keys(m.votes).filter((id) => m.votes[id] === choice) : []);
    return {
      stage: s.stage,
      order: s.order,
      scores: s.scores,
      gained: s.gained,
      round: s.round,
      totalRounds: s.totalRounds,
      stageEndsAt: s.stageEndsAt,
      myPrompts:
        s.stage === 'WRITE'
          ? s.matches.flatMap((mm, index) => {
              const slot = mm.authors.indexOf(me);
              return slot < 0 ? [] : [{ index, prompt: mm.prompt, answer: mm.answers[slot] }];
            })
          : [],
      writers: s.writers,
      done:
        s.stage === 'WRITE'
          ? s.writers.filter((id) => !s.matches.some((mm) => mm.authors.some((a, i) => a === id && mm.answers[i] === null)))
          : m
            ? Object.keys(m.votes)
            : [],
      // le battute sono anonime finché non arriva il verdetto
      match: m ? { prompt: m.prompt, answers: m.answers, authors: result ? m.authors : null, votes: result ? [voters(0), voters(1)] : null } : null,
      matchNo: s.current + 1,
      matchCount: s.matches.length,
      canVote: !!m && s.stage === 'VOTE' && !m.authors.includes(me) && s.order.includes(me),
      myVote: m && me in m.votes ? m.votes[me] : null,
      battutona: result && s.battutona,
      forfeit: result && s.forfeit,
    };
  },
  ids: (s) => s.order,
  finished: (s) => s.stage === 'END',
  leave(s, _id, ctx) {
    if (s.stage === 'WRITE' && !pendingWriters(s, ctx).length) {
      battuteNext(s, ctx);
      return true;
    }
    if (s.stage === 'VOTE') {
      const m = s.matches[s.current];
      if (battuteVoters(s, m, ctx).every((id) => id in m.votes)) {
        battuteResult(s, ctx, false);
        return true;
      }
    }
    return false;
  },
};

// ---------------------------------------------------------------- 🤔 Preferiresti?

interface PreferirestiState {
  order: string[];
  scores: Record<string, number>;
  questions: [string, string][];
  q: number;
  stage: PreferirestiView['stage'];
  stageEndsAt: number | null;
  votes: Record<string, 0 | 1>;
}

const PREF_VOTE_MS = 20_000;
const PREF_REVEAL_MS = 8_000;

function prefReveal(s: PreferirestiState, ctx: Ctx) {
  const counts = [0, 0];
  for (const v of Object.values(s.votes)) counts[v]++;
  // chi ha scelto come la maggioranza prende un punto (in caso di pareggio nessuno)
  if (counts[0] !== counts[1]) {
    const majority = counts[0] > counts[1] ? 0 : 1;
    for (const [id, v] of Object.entries(s.votes)) if (v === majority) s.scores[id] = (s.scores[id] ?? 0) + 1;
  }
  s.stage = 'REVEAL';
  s.stageEndsAt = ctx.now + PREF_REVEAL_MS;
}

function prefNext(s: PreferirestiState, ctx: Ctx) {
  if (s.q + 1 >= s.questions.length) {
    s.stage = 'END';
    s.stageEndsAt = null;
    return;
  }
  s.q += 1;
  s.votes = {};
  s.stage = 'VOTE';
  s.stageEndsAt = ctx.now + PREF_VOTE_MS;
}

const prefAllVoted = (s: PreferirestiState, ctx: Ctx) => s.order.every((id) => !ctx.isOnline(id) || id in s.votes);

export const preferiresti: Mode<PreferirestiState> = {
  start(settings, players, ctx) {
    const order = players.map((p) => p.id);
    return {
      order,
      scores: Object.fromEntries(order.map((id) => [id, 0])),
      questions: deck(PREFERIRESTI, PREFERIRESTI_SPICY, settings.spicy).slice(0, settings.prefQuestions),
      q: 0,
      stage: 'VOTE',
      stageEndsAt: ctx.now + PREF_VOTE_MS,
      votes: {},
    };
  },
  action(s, me, type, payload, ctx) {
    if (type === 'MG_PICK') {
      const choice = payload.choice === 0 || payload.choice === 1 ? (payload.choice as 0 | 1) : null;
      if (s.stage !== 'VOTE' || choice === null || !s.order.includes(me)) return false;
      s.votes[me] = choice; // si può cambiare idea finché non si svela
      if (prefAllVoted(s, ctx)) prefReveal(s, ctx);
      return true;
    }
    if (type === 'MG_FORCE' && ctx.canLead(me) && s.stage !== 'END') {
      if (s.stage === 'VOTE') prefReveal(s, ctx);
      else prefNext(s, ctx);
      return true;
    }
    return false;
  },
  tick(s, ctx) {
    if (!s.stageEndsAt || ctx.now < s.stageEndsAt) return false;
    if (s.stage === 'VOTE') prefReveal(s, ctx);
    else prefNext(s, ctx);
    return true;
  },
  deadline: (s) => s.stageEndsAt,
  view(s, me) {
    const [a, b] = s.questions[s.q];
    return {
      stage: s.stage,
      order: s.order,
      scores: s.scores,
      qNo: s.q + 1,
      qCount: s.questions.length,
      a,
      b,
      stageEndsAt: s.stageEndsAt,
      voted: Object.keys(s.votes),
      myVote: s.votes[me] ?? null,
      votes: s.stage === 'VOTE' ? null : s.votes,
    };
  },
  ids: (s) => s.order,
  finished: (s) => s.stage === 'END',
  leave(s, _id, ctx) {
    if (s.stage === 'VOTE' && Object.keys(s.votes).length && prefAllVoted(s, ctx)) {
      prefReveal(s, ctx);
      return true;
    }
    return false;
  },
};

// ---------------------------------------------------------------- 📡 Sintonia

interface SintoniaState {
  order: string[];
  scores: Record<string, number>;
  gained: Record<string, number>;
  turn: number;
  turnCount: number;
  psychic: string;
  cards: [string, string][];
  card: [string, string];
  target: number;
  clue: string | null;
  stage: SintoniaView['stage'];
  stageEndsAt: number | null;
  guesses: Record<string, number>;
}

const CLUE_MS = 75_000;
const DIAL_MS = 45_000;
const DIAL_REVEAL_MS = 9_000;

// Punti in base alla distanza dal bersaglio: 4 in pieno centro, poi 3 e 2
export const dialPoints = (guess: number, target: number): number => {
  const d = Math.abs(guess - target);
  return d <= 4 ? 4 : d <= 9 ? 3 : d <= 15 ? 2 : 0;
};

// Prossimo sensitivo collegato: nuova carta e nuovo bersaglio segreto
function sintoniaTurn(s: SintoniaState, ctx: Ctx) {
  for (s.turn += 1; s.turn < s.turnCount; s.turn++) {
    const psychic = s.order[s.turn % s.order.length];
    if (!ctx.isOnline(psychic)) continue;
    s.psychic = psychic;
    s.card = s.cards[s.turn % s.cards.length];
    s.target = 4 + Math.floor(Math.random() * 93);
    s.clue = null;
    s.guesses = {};
    s.gained = {};
    s.stage = 'CLUE';
    s.stageEndsAt = ctx.now + CLUE_MS;
    return;
  }
  s.stage = 'END';
  s.stageEndsAt = null;
}

const dialGuessers = (s: SintoniaState, ctx: Ctx) => s.order.filter((id) => id !== s.psychic && ctx.isOnline(id));

function sintoniaReveal(s: SintoniaState, ctx: Ctx) {
  s.gained = {};
  const points = Object.entries(s.guesses).map(([id, g]) => {
    const p = dialPoints(g, s.target);
    s.gained[id] = p;
    s.scores[id] = (s.scores[id] ?? 0) + p;
    return p;
  });
  // il sensitivo prende la media dei punti di chi ha indovinato
  if (points.length) {
    const avg = Math.round(points.reduce((a, b) => a + b, 0) / points.length);
    s.gained[s.psychic] = avg;
    s.scores[s.psychic] = (s.scores[s.psychic] ?? 0) + avg;
  }
  s.stage = 'REVEAL';
  s.stageEndsAt = ctx.now + DIAL_REVEAL_MS;
}

function sintoniaAdvance(s: SintoniaState, ctx: Ctx) {
  if (s.stage === 'GUESS') sintoniaReveal(s, ctx);
  else if (s.stage === 'CLUE' || s.stage === 'REVEAL') sintoniaTurn(s, ctx); // senza indizio il turno salta
}

export const sintonia: Mode<SintoniaState> = {
  start(settings, players, ctx) {
    const order = players.map((p) => p.id);
    const s: SintoniaState = {
      order,
      scores: Object.fromEntries(order.map((id) => [id, 0])),
      gained: {},
      turn: -1,
      turnCount: order.length * settings.sintoniaLaps,
      psychic: order[0],
      cards: deck(SPECTRA, SPECTRA_SPICY, settings.spicy),
      card: ['', ''],
      target: 50,
      clue: null,
      stage: 'CLUE',
      stageEndsAt: null,
      guesses: {},
    };
    sintoniaTurn(s, ctx);
    return s;
  },
  action(s, me, type, payload, ctx) {
    switch (type) {
      case 'MG_CLUE': {
        const clue = clean(payload.text, 60);
        if (s.stage !== 'CLUE' || me !== s.psychic || !clue) return false;
        s.clue = clue;
        s.stage = 'GUESS';
        s.stageEndsAt = ctx.now + DIAL_MS;
        return true;
      }
      case 'MG_DIAL': {
        const value = Number(payload.value);
        if (s.stage !== 'GUESS' || me === s.psychic || !s.order.includes(me) || me in s.guesses || !Number.isFinite(value)) return false;
        s.guesses[me] = Math.max(0, Math.min(100, Math.round(value)));
        if (dialGuessers(s, ctx).every((id) => id in s.guesses)) sintoniaReveal(s, ctx);
        return true;
      }
      case 'MG_FORCE':
        if (!ctx.canLead(me) || s.stage === 'END') return false;
        sintoniaAdvance(s, ctx);
        return true;
      default:
        return false;
    }
  },
  tick(s, ctx) {
    if (!s.stageEndsAt || ctx.now < s.stageEndsAt) return false;
    sintoniaAdvance(s, ctx);
    return true;
  },
  deadline: (s) => s.stageEndsAt,
  view(s, me) {
    const reveal = s.stage === 'REVEAL';
    return {
      stage: s.stage,
      order: s.order,
      scores: s.scores,
      gained: s.gained,
      psychic: s.stage === 'END' ? null : s.psychic,
      turnNo: Math.min(s.turn + 1, s.turnCount),
      turnCount: s.turnCount,
      left: s.card[0],
      right: s.card[1],
      target: s.stage !== 'END' && (me === s.psychic || reveal) ? s.target : null,
      clue: s.clue,
      stageEndsAt: s.stageEndsAt,
      locked: Object.keys(s.guesses),
      myGuess: s.guesses[me] ?? null,
      guesses: reveal ? s.guesses : null,
    };
  },
  ids: (s) => s.order,
  finished: (s) => s.stage === 'END',
  leave(s, id, ctx) {
    if ((s.stage === 'CLUE' || s.stage === 'GUESS') && id === s.psychic) {
      sintoniaTurn(s, ctx);
      return true;
    }
    if (s.stage === 'GUESS' && Object.keys(s.guesses).length && dialGuessers(s, ctx).every((g) => g in s.guesses)) {
      sintoniaReveal(s, ctx);
      return true;
    }
    return false;
  },
};

// ---------------------------------------------------------------- 🤐 Parola proibita

interface TabuState {
  teams: Record<string, 0 | 1>;
  scores: [number, number];
  speakers: string[];
  turn: number;
  stage: TabuView['stage'];
  stageEndsAt: number | null;
  turnMs: number;
  cards: TabuCard[];
  cardPos: number;
  cardNo: number;
  log: TabuView['log'];
  lastAction: number;
}

const TABU_READY_MS = 20_000;
const TABU_TURN_END_MS = 7_000;

const tabuSpeaker = (s: TabuState) => s.speakers[s.turn];

function tabuReady(s: TabuState, ctx: Ctx) {
  for (s.turn += 1; s.turn < s.speakers.length; s.turn++) {
    if (!ctx.isOnline(s.speakers[s.turn])) continue;
    s.stage = 'READY';
    s.stageEndsAt = ctx.now + TABU_READY_MS;
    s.log = [];
    return;
  }
  s.stage = 'END';
  s.stageEndsAt = null;
}

function tabuNextCard(s: TabuState) {
  s.cardPos += 1;
  if (s.cardPos >= s.cards.length) {
    s.cards = shuffle(s.cards);
    s.cardPos = 0;
  }
  s.cardNo += 1;
}

function tabuPlay(s: TabuState, ctx: Ctx) {
  s.stage = 'PLAY';
  s.stageEndsAt = ctx.now + s.turnMs;
  tabuNextCard(s);
}

function tabuTurnEnd(s: TabuState, ctx: Ctx) {
  s.stage = 'TURN_END';
  s.stageEndsAt = ctx.now + TABU_TURN_END_MS;
}

export const tabu: Mode<TabuState> = {
  start(settings, players, ctx) {
    const order = shuffle(players.map((p) => p.id));
    // due squadre: 🔴 Rossi e 🔵 Blu, alternando
    const teams: Record<string, 0 | 1> = Object.fromEntries(order.map((id, i) => [id, (i % 2) as 0 | 1]));
    const red = order.filter((id) => teams[id] === 0);
    const blue = order.filter((id) => teams[id] === 1);
    const perTeam = Math.max(red.length, blue.length) * settings.tabuLaps;
    const speakers: string[] = [];
    for (let k = 0; k < perTeam; k++) speakers.push(red[k % red.length], blue[k % blue.length]);
    const s: TabuState = {
      teams,
      scores: [0, 0],
      speakers,
      turn: -1,
      stage: 'READY',
      stageEndsAt: null,
      turnMs: settings.tabuSeconds * 1000,
      cards: deck(TABU_CARDS, TABU_CARDS_SPICY, settings.spicy),
      cardPos: -1,
      cardNo: 0,
      log: [],
      lastAction: 0,
    };
    tabuReady(s, ctx);
    return s;
  },
  action(s, me, type, payload, ctx) {
    const speaker = tabuSpeaker(s);
    const team = s.teams[speaker];
    // un doppio tocco non deve far saltare due carte
    const cardAction = s.stage === 'PLAY' && payload.card === s.cardNo && ctx.now - s.lastAction > 400;
    const word = s.cards[s.cardPos]?.word ?? '';
    switch (type) {
      case 'MG_GO':
        if (s.stage !== 'READY' || me !== speaker) return false;
        tabuPlay(s, ctx);
        return true;
      case 'MG_OK':
      case 'MG_SKIP':
        if (!cardAction || me !== speaker) return false;
        if (type === 'MG_OK') s.scores[team] += 1;
        s.log = [...s.log, { word, result: type === 'MG_OK' ? 'ok' : 'skip' }];
        s.lastAction = ctx.now;
        tabuNextCard(s);
        return true;
      case 'MG_BUZZ':
        // la squadra avversaria ha sentito una parola proibita
        if (!cardAction || s.teams[me] === undefined || s.teams[me] === team) return false;
        s.scores[team] -= 1;
        s.log = [...s.log, { word, result: 'buzz' }];
        s.lastAction = ctx.now;
        tabuNextCard(s);
        return true;
      case 'MG_FORCE':
        if (!ctx.canLead(me) || s.stage === 'END') return false;
        if (s.stage === 'PLAY') tabuTurnEnd(s, ctx);
        else tabuReady(s, ctx); // turno saltato o riepilogo chiuso
        return true;
      default:
        return false;
    }
  },
  tick(s, ctx) {
    if (!s.stageEndsAt || ctx.now < s.stageEndsAt) return false;
    if (s.stage === 'READY') tabuPlay(s, ctx); // chi parla non ha premuto "Via": si parte lo stesso
    else if (s.stage === 'PLAY') tabuTurnEnd(s, ctx);
    else tabuReady(s, ctx);
    return true;
  },
  deadline: (s) => s.stageEndsAt,
  view(s, me) {
    const speaker = tabuSpeaker(s) ?? null;
    const speakerTeam = speaker ? s.teams[speaker] : 0;
    const myTeam = s.teams[me];
    const role: TabuView['role'] = me === speaker ? 'SPEAKER' : myTeam === undefined ? 'WATCHER' : myTeam === speakerTeam ? 'GUESSER' : 'GUARD';
    return {
      stage: s.stage,
      teams: s.teams,
      scores: s.scores,
      speaker: s.stage === 'END' ? null : speaker,
      speakerTeam,
      turnNo: Math.min(s.turn + 1, s.speakers.length),
      turnCount: s.speakers.length,
      stageEndsAt: s.stageEndsAt,
      // la carta la vede chi parla e chi controlla (mai chi deve indovinare)
      card: s.stage === 'PLAY' && role !== 'GUESSER' ? s.cards[s.cardPos] : null,
      cardNo: s.cardNo,
      role,
      log: s.log,
      winner: s.stage !== 'END' ? null : s.scores[0] === s.scores[1] ? -1 : s.scores[0] > s.scores[1] ? 0 : 1,
    };
  },
  ids: (s) => Object.keys(s.teams),
  finished: (s) => s.stage === 'END',
  leave(s, id, ctx) {
    if ((s.stage === 'READY' || s.stage === 'PLAY') && id === tabuSpeaker(s)) {
      tabuReady(s, ctx);
      return true;
    }
    return false;
  },
};

// ---------------------------------------------------------------- 🎭 Chi sono?

interface ChiSonoState {
  order: string[];
  characters: Record<string, string>;
  asker: number;
  turnEndsAt: number | null;
  solved: string[];
  gaveUp: string[];
  stage: ChiSonoView['stage'];
}

const ASK_MS = 60_000;

const stillPlaying = (s: ChiSonoState, id: string) => !s.solved.includes(id) && !s.gaveUp.includes(id);

// Tocca al prossimo che deve ancora scoprire chi è; se non resta nessuno, fine
function chiSonoNext(s: ChiSonoState, ctx: Ctx) {
  const n = s.order.length;
  for (let k = 1; k <= n; k++) {
    const i = (s.asker + k) % n;
    if (stillPlaying(s, s.order[i]) && ctx.isOnline(s.order[i])) {
      s.asker = i;
      s.turnEndsAt = ctx.now + ASK_MS;
      return;
    }
  }
  s.stage = 'END';
  s.turnEndsAt = null;
}

export const chisono: Mode<ChiSonoState> = {
  start(settings, players, ctx) {
    const order = shuffle(players.map((p) => p.id));
    const names = deck(PERSONAGGI, PERSONAGGI_SPICY, settings.spicy);
    const s: ChiSonoState = {
      order,
      characters: Object.fromEntries(order.map((id, i) => [id, names[i % names.length]])),
      asker: -1,
      turnEndsAt: null,
      solved: [],
      gaveUp: [],
      stage: 'PLAY',
    };
    chiSonoNext(s, ctx);
    return s;
  },
  action(s, me, type, _payload, ctx) {
    if (s.stage !== 'PLAY') return false;
    const myTurn = s.order[s.asker] === me;
    switch (type) {
      case 'MG_PASS':
        if (!myTurn && !ctx.canLead(me)) return false;
        chiSonoNext(s, ctx);
        return true;
      case 'MG_SOLVED':
      case 'MG_GIVEUP':
        if (!s.order.includes(me) || !stillPlaying(s, me)) return false;
        (type === 'MG_SOLVED' ? s.solved : s.gaveUp).push(me);
        if (myTurn || !s.order.some((id) => stillPlaying(s, id) && ctx.isOnline(id))) chiSonoNext(s, ctx);
        return true;
      case 'MG_FORCE':
        if (!ctx.canLead(me)) return false;
        s.stage = 'END';
        s.turnEndsAt = null;
        return true;
      default:
        return false;
    }
  },
  tick(s, ctx) {
    if (s.stage !== 'PLAY' || !s.turnEndsAt || ctx.now < s.turnEndsAt) return false;
    chiSonoNext(s, ctx);
    return true;
  },
  deadline: (s) => (s.stage === 'PLAY' ? s.turnEndsAt : null),
  view(s, me) {
    const end = s.stage === 'END';
    return {
      stage: s.stage,
      order: s.order,
      asker: end ? null : s.order[s.asker] ?? null,
      turnEndsAt: s.turnEndsAt,
      // il mio personaggio resta nascosto finché non lo scopro (o mi arrendo)
      characters: Object.fromEntries(s.order.map((id) => [id, id !== me || end || !stillPlaying(s, me) ? s.characters[id] : null])),
      solved: s.solved,
      gaveUp: s.gaveUp,
    };
  },
  ids: (s) => s.order,
  finished: (s) => s.stage === 'END',
  leave(s, id, ctx) {
    if (s.stage === 'PLAY' && (s.order[s.asker] === id || !s.order.some((x) => stillPlaying(s, x) && ctx.isOnline(x)))) {
      chiSonoNext(s, ctx);
      return true;
    }
    return false;
  },
};

export const PARTY_MODES: Partial<Record<GameId, Mode<any>>> = {
  BATTUTE: battute,
  PREFERIRESTI: preferiresti,
  SINTONIA: sintonia,
  TABU: tabu,
  CHISONO: chisono,
};
