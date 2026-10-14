// ❓ Quizzone: domande a risposta multipla. Giusta = 500 punti + fino a 500 per la velocità (tempo misurato dal server)
// + bonus serie; si passa avanti appena hanno risposto tutti i collegati. Ogni 5 domande la classifica.
import type { GameSettings } from '../../src/types/game';
import { flatOpt } from '../../src/data/flatGames';
import { QZ_CATS, QZ_QUESTIONS, QZ_SPICY, type QuizzoneView, type QzQuestion } from '../../src/data/flat/quizzone';
import type { Ctx, Mode } from '../modes';
import { shuffle } from '../party';
import { registerFlat } from './registry';

const READY_MS = 3_000; // si legge la domanda, poi compaiono le risposte
const ANSWER_MS = 15_000;
const REVEAL_MS = 4_000;
const RANKING_MS = 6_000;
const RANK_EVERY = 5; // classifica ogni 5 domande
const STREAK_STEP = 100; // +100 per ogni risposta giusta di fila dalla seconda…
const STREAK_MAX = 500; // …fino a un massimo di +500 (se no con 20 domande la serie conterebbe più della risposta)
const SPICY_SHARE = 0.35; // con i contenuti piccanti, circa una domanda su tre è 🌶️

type Stage = QuizzoneView['stage'];

interface QZQuestion {
  c: QzQuestion['c'];
  d: QzQuestion['d'];
  q: string;
  a: string[]; // già mescolate
  ok: number; // indice della giusta
}

interface QZState {
  order: string[];
  qs: QZQuestion[];
  qNo: number;
  stage: Stage;
  stageEndsAt: number | null;
  startedAt: number; // quando sono comparse le risposte
  picks: Record<string, number>;
  times: Record<string, number>; // ms per rispondere
  gained: Record<string, number>;
  bonus: Record<string, number>;
  streak: Record<string, number>;
  scores: Record<string, number>;
  stats: Record<string, { ok: number; fast: number; best: number }>;
  fastest: { id: string; ms: number } | null;
  prevRank: string[];
}

// domande uscite di recente su questo server: si evitano finché ce ne sono di nuove (le partite si ripetono spesso)
const recent: string[] = [];
const RECENT_MAX = 300;

// difficoltà che sale: all'inizio più facili, alla fine più toste
function wantDiff(i: number, n: number): 1 | 2 | 3 {
  const t = n <= 1 ? 0.5 : i / (n - 1);
  const w = [Math.max(0.15, 1.6 * (1 - t)), 1.2, Math.max(0.1, 1.6 * t)];
  let r = Math.random() * (w[0] + w[1] + w[2]);
  for (let d = 0; d < 3; d++) {
    if ((r -= w[d]) < 0) return (d + 1) as 1 | 2 | 3;
  }
  return 2;
}

function pickFrom(pool: QzQuestion[], used: Set<string>, prevCat: string | null, d: number | null): QzQuestion | null {
  const ok = (q: QzQuestion, strict: boolean) => !used.has(q.q) && (!strict || q.c !== prevCat) && (d === null || !strict || q.d === d);
  const fresh = pool.filter((q) => !recent.includes(q.q));
  for (const list of [fresh, pool]) {
    for (const strict of [true, false]) {
      const c = list.filter((q) => ok(q, strict));
      if (c.length) return c[Math.floor(Math.random() * c.length)];
    }
  }
  return null;
}

function buildQuiz(n: number, spicy: boolean): QZQuestion[] {
  const used = new Set<string>();
  const spicyCount = spicy ? Math.round(n * SPICY_SHARE) : 0;
  // posizioni delle domande piccanti: mai la prima (si parte tranquilli)
  const spicySlots = new Set(shuffle(Array.from({ length: Math.max(0, n - 1) }, (_, i) => i + 1)).slice(0, spicyCount));
  const out: QZQuestion[] = [];
  for (let i = 0; i < n; i++) {
    const prev = out[i - 1]?.c ?? null;
    const q = spicySlots.has(i) ? pickFrom(QZ_SPICY, used, prev, null) : pickFrom(QZ_QUESTIONS, used, prev, wantDiff(i, n));
    if (!q) continue;
    used.add(q.q);
    recent.push(q.q);
    // le risposte si mescolano: la giusta (a[0]) finisce in un posto a caso
    const idx = shuffle([0, 1, 2, 3]);
    out.push({ c: q.c, d: q.d, q: q.q, a: idx.map((k) => q.a[k]), ok: idx.indexOf(0) });
  }
  if (recent.length > RECENT_MAX) recent.splice(0, recent.length - RECENT_MAX);
  return out;
}

const ranking = (s: QZState) => [...s.order].sort((a, b) => (s.scores[b] ?? 0) - (s.scores[a] ?? 0));
const allAnswered = (s: QZState, ctx: Ctx) => s.order.filter((id) => ctx.isOnline(id)).every((id) => id in s.picks);

function toReady(s: QZState, ctx: Ctx) {
  s.stage = 'READY';
  s.stageEndsAt = ctx.now + READY_MS;
  s.picks = {};
  s.times = {};
  s.gained = {};
  s.bonus = {};
  s.fastest = null;
}

function toQuestion(s: QZState, ctx: Ctx) {
  s.stage = 'QUESTION';
  s.startedAt = ctx.now;
  s.stageEndsAt = ctx.now + ANSWER_MS;
}

// rivelazione: si contano i punti (base + velocità + serie)
function toReveal(s: QZState, ctx: Ctx) {
  const q = s.qs[s.qNo - 1];
  s.gained = {};
  s.bonus = {};
  s.fastest = null;
  for (const id of s.order) {
    const st = (s.stats[id] ??= { ok: 0, fast: 0, best: 0 });
    if (s.picks[id] === q.ok) {
      const ms = Math.max(0, Math.min(ANSWER_MS, s.times[id] ?? ANSWER_MS));
      const streak = (s.streak[id] ?? 0) + 1;
      const bonus = Math.min(STREAK_MAX, STREAK_STEP * (streak - 1));
      const pts = 500 + Math.round(500 * (1 - ms / ANSWER_MS)) + bonus;
      s.streak[id] = streak;
      s.gained[id] = pts;
      if (bonus) s.bonus[id] = bonus;
      s.scores[id] = (s.scores[id] ?? 0) + pts;
      st.ok += 1;
      st.best = Math.max(st.best, streak);
      if (!s.fastest || ms < s.fastest.ms) s.fastest = { id, ms };
    } else {
      s.streak[id] = 0;
    }
  }
  if (s.fastest) s.stats[s.fastest.id].fast += 1;
  s.stage = 'REVEAL';
  s.stageEndsAt = ctx.now + REVEAL_MS;
}

function afterReveal(s: QZState, ctx: Ctx) {
  if (s.qNo >= s.qs.length) {
    s.stage = 'END';
    s.stageEndsAt = null;
    return;
  }
  if (s.qNo % RANK_EVERY === 0) {
    s.stage = 'RANKING';
    s.stageEndsAt = ctx.now + RANKING_MS;
    return;
  }
  nextQuestion(s, ctx);
}

function nextQuestion(s: QZState, ctx: Ctx) {
  if (s.stage === 'RANKING') s.prevRank = ranking(s); // le frecce della prossima classifica partono da qui
  s.qNo += 1;
  toReady(s, ctx);
}

// avanti di una fase (tempo scaduto o "Avanti" di chi guida)
function advance(s: QZState, ctx: Ctx) {
  if (s.stage === 'READY') toQuestion(s, ctx);
  else if (s.stage === 'QUESTION') toReveal(s, ctx);
  else if (s.stage === 'REVEAL') afterReveal(s, ctx);
  else if (s.stage === 'RANKING') nextQuestion(s, ctx);
}

export const quizzone: Mode<QZState> = {
  start(settings: GameSettings, players, ctx) {
    const order = players.map((p) => p.id);
    const qs = buildQuiz(flatOpt(settings, 'QUIZZONE', 'domande'), !!settings.spicy);
    const s: QZState = {
      order,
      qs,
      qNo: 1,
      stage: 'READY',
      stageEndsAt: null,
      startedAt: ctx.now,
      picks: {},
      times: {},
      gained: {},
      bonus: {},
      streak: Object.fromEntries(order.map((id) => [id, 0])),
      scores: Object.fromEntries(order.map((id) => [id, 0])),
      stats: Object.fromEntries(order.map((id) => [id, { ok: 0, fast: 0, best: 0 }])),
      fastest: null,
      prevRank: [...order],
    };
    toReady(s, ctx);
    return s;
  },
  action(s, me, type, payload, ctx) {
    if (type === 'MG_ANSWER') {
      const i = Number(payload?.i);
      if (s.stage !== 'QUESTION' || !s.order.includes(me) || me in s.picks || !Number.isInteger(i) || i < 0 || i > 3) return false;
      s.picks[me] = i;
      s.times[me] = Math.max(0, ctx.now - s.startedAt);
      if (allAnswered(s, ctx)) toReveal(s, ctx);
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
  view(s, me): QuizzoneView {
    const q = s.qs[Math.min(s.qNo, s.qs.length) - 1];
    const open = s.stage === 'REVEAL' || s.stage === 'RANKING' || s.stage === 'END';
    return {
      stage: s.stage,
      order: s.order,
      qNo: s.qNo,
      qCount: s.qs.length,
      cat: q.c,
      catName: QZ_CATS[q.c].name,
      catIcon: QZ_CATS[q.c].icon,
      diff: q.d,
      question: q.q,
      answers: s.stage === 'READY' ? null : q.a,
      stageEndsAt: s.stageEndsAt,
      answerMs: ANSWER_MS,
      answered: Object.keys(s.picks),
      myPick: s.picks[me] ?? null,
      myMs: s.times[me] ?? null,
      correct: open ? q.ok : null,
      picks: open ? s.picks : null,
      fastest: open ? s.fastest : null,
      gained: open ? s.gained : {},
      streakBonus: open ? s.bonus : {},
      streaks: s.streak,
      scores: s.scores,
      prevRank: s.prevRank,
      stats: s.stats,
    };
  },
  ids: (s) => s.order,
  finished: (s) => s.stage === 'END',
  leave(s, id, ctx) {
    if (!s.order.includes(id)) return false;
    // chi esce sparisce dalla classifica (se no resterebbe un "?" sul podio)
    s.order = s.order.filter((x) => x !== id);
    s.prevRank = s.prevRank.filter((x) => x !== id);
    delete s.scores[id];
    delete s.streak[id];
    delete s.stats[id];
    delete s.picks[id];
    delete s.gained[id];
    if (s.fastest?.id === id) s.fastest = null;
    if (s.stage === 'END') return true;
    // se mancava solo lui a rispondere si rivela subito
    if (s.stage === 'QUESTION' && Object.keys(s.picks).length && allAnswered(s, ctx)) toReveal(s, ctx);
    return true;
  },
};

registerFlat('QUIZZONE', quizzone);
