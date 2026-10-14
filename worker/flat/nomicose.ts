// 📝 Nomi, cose, città: esce una lettera, ognuno scrive una parola per categoria; chi ha finito può dare lo STOP.
// Poi si controlla tutto insieme: le risposte che non tornano si bocciano a maggioranza. Unica 10, uguale 5.
import type { GameSettings } from '../../src/types/game';
import { flatOpt } from '../../src/data/flatGames';
import { NC_CATS, NC_CATS_SPICY, NC_FIXED, NC_LETTERS, NC_POINTS, type NCCategory, type NCRow, type NCStatus, type NomiCoseView } from '../../src/data/flat/nomicose';
import type { Ctx, Mode } from '../modes';
import { clean, deck } from '../party';
import { registerFlat } from './registry';

const DRAW_MS = 3_500; // estrazione della lettera
const STOP_MS = 5_000; // dopo lo STOP gli altri hanno 5 secondi
const RESULT_MS = 14_000;
const reviewMs = (players: number) => Math.min(120_000, 45_000 + players * 8_000);
const N_CATS = 6;
const MAX_LEN = 32;

interface NCState {
  order: string[];
  gone: string[]; // usciti dalla stanza: non giocano più
  scores: Record<string, number>;
  gained: Record<string, number>;
  round: number;
  rounds: number;
  writeMs: number;
  usedLetters: string[];
  letter: string;
  catDeck: NCCategory[];
  cats: NCCategory[];
  stage: NomiCoseView['stage'];
  stageEndsAt: number | null;
  stoppedBy: string | null;
  answers: Record<string, string[]>;
  flags: Record<string, string[]>; // "giocatore:categoria" → chi l'ha bocciata
  done: string[];
  final: Record<string, NCStatus[]> | null; // esito deciso a fine revisione
}

// per confrontare: minuscole, senza accenti né punteggiatura
const base = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const stripArticle = (t: string) => t.replace(/^(il|lo|la|i|gli|le|l|un|uno|una)\s+/, '');
// "Il Cairo", "cairo" e "CAIRO!" sono la stessa risposta
const key = (s: string) => stripArticle(base(s)).replace(/ /g, '');
// "L'Aquila" va bene sia con la L sia con la A (tanto poi decidono gli amici)
const startsOk = (s: string, letter: string) => {
  const t = base(s);
  const l = letter.toLowerCase();
  return t.startsWith(l) || stripArticle(t).startsWith(l);
};

const active = (s: NCState) => s.order.filter((id) => !s.gone.includes(id));
const judgesFor = (s: NCState) => Math.max(0, active(s).length - 1);
const fkey = (id: string, cat: number) => `${id}:${cat}`;
const filled = (list: string[] | undefined) => (list ?? []).filter((x) => key(x)).length;

// prima della revisione: vuota o lettera sbagliata si decide da sola
function autoStatus(s: NCState, id: string, cat: number): NCStatus | null {
  const text = s.answers[id]?.[cat] ?? '';
  if (!key(text)) return 'vuota';
  if (!startsOk(text, s.letter)) return 'lettera';
  return null;
}

// bocciata se la boccia almeno metà degli altri
function rejected(s: NCState, id: string, cat: number) {
  const judges = judgesFor(s);
  const n = s.flags[fkey(id, cat)]?.length ?? 0;
  return judges > 0 && n > 0 && n * 2 >= judges;
}

// esito di tutte le risposte (in diretta durante la revisione)
function evaluate(s: NCState): Record<string, NCStatus[]> {
  const ids = active(s);
  const out: Record<string, NCStatus[]> = {};
  for (const id of ids) out[id] = Array.from({ length: N_CATS }, (_, c) => autoStatus(s, id, c) ?? (rejected(s, id, c) ? 'bocciata' : 'unica'));
  for (let c = 0; c < N_CATS; c++) {
    const count = new Map<string, number>();
    for (const id of ids) if (out[id][c] === 'unica') count.set(key(s.answers[id][c]), (count.get(key(s.answers[id][c])) ?? 0) + 1);
    for (const id of ids) if (out[id][c] === 'unica' && (count.get(key(s.answers[id][c])) ?? 0) > 1) out[id][c] = 'uguale';
  }
  return out;
}

function pickLetter(s: NCState): string {
  const pool = NC_LETTERS.filter(([l]) => !s.usedLetters.includes(l));
  const list = pool.length ? pool : NC_LETTERS;
  let r = Math.random() * list.reduce((t, [, w]) => t + w, 0);
  for (const [l, w] of list) {
    r -= w;
    if (r <= 0) return l;
  }
  return list[0][0];
}

function newRound(s: NCState, ctx: Ctx) {
  s.round += 1;
  s.letter = pickLetter(s);
  s.usedLetters.push(s.letter);
  // tre categorie dal mazzo (senza ripeterle finché non finisce)
  const extra: NCCategory[] = [];
  while (extra.length < N_CATS - NC_FIXED.length && s.catDeck.length) {
    const c = s.catDeck.shift()!;
    if (!extra.some((x) => x.n === c.n)) extra.push(c);
  }
  s.cats = [...NC_FIXED, ...extra];
  s.answers = Object.fromEntries(active(s).map((id) => [id, Array(N_CATS).fill('')]));
  s.flags = {};
  s.done = [];
  s.gained = {};
  s.final = null;
  s.stoppedBy = null;
  s.stage = 'DRAW';
  s.stageEndsAt = ctx.now + DRAW_MS;
}

function toWrite(s: NCState, ctx: Ctx) {
  s.stage = 'WRITE';
  s.stageEndsAt = ctx.now + s.writeMs;
}

function toReview(s: NCState, ctx: Ctx) {
  // se nessuno ha scritto niente di valido non c'è niente da controllare
  const ids = active(s);
  const something = ids.some((id) => s.answers[id]?.some((_, c) => !autoStatus(s, id, c)));
  if (!something) return toResult(s, ctx);
  s.stage = 'REVIEW';
  s.stageEndsAt = ctx.now + reviewMs(ids.length);
  s.done = [];
}

function toResult(s: NCState, ctx: Ctx) {
  s.final = evaluate(s);
  s.gained = {};
  for (const [id, list] of Object.entries(s.final)) {
    const pts = list.reduce((t, st) => t + NC_POINTS[st], 0);
    s.gained[id] = pts;
    s.scores[id] = (s.scores[id] ?? 0) + pts;
  }
  s.stage = 'RESULT';
  s.stageEndsAt = ctx.now + RESULT_MS;
}

function next(s: NCState, ctx: Ctx) {
  if (s.round >= s.rounds || active(s).length < 1) {
    s.stage = 'END';
    s.stageEndsAt = null;
    return;
  }
  newRound(s, ctx);
}

// ognuno manda le sue 6 risposte (ripulite)
function save(s: NCState, me: string, raw: unknown): boolean {
  if (!Array.isArray(raw)) return false;
  const list = Array.from({ length: N_CATS }, (_, c) => clean(raw[c], MAX_LEN));
  const before = filled(s.answers[me]);
  s.answers[me] = list;
  return filled(list) !== before; // si avvisano tutti solo se cambia quante ne ha compilate
}

const allDone = (s: NCState, ctx: Ctx) => active(s).filter((id) => ctx.isOnline(id)).every((id) => s.done.includes(id));

function advance(s: NCState, ctx: Ctx) {
  if (s.stage === 'DRAW') toWrite(s, ctx);
  else if (s.stage === 'WRITE') toReview(s, ctx);
  else if (s.stage === 'REVIEW') toResult(s, ctx);
  else if (s.stage === 'RESULT') next(s, ctx);
}

export const nomicose: Mode<NCState> = {
  start(settings: GameSettings, players, ctx) {
    const order = players.map((p) => p.id);
    const s: NCState = {
      order,
      gone: [],
      scores: Object.fromEntries(order.map((id) => [id, 0])),
      gained: {},
      round: 0,
      rounds: flatOpt(settings, 'NOMICOSE', 'round'),
      writeMs: flatOpt(settings, 'NOMICOSE', 'secondi') * 1000,
      usedLetters: [],
      letter: '',
      catDeck: deck(NC_CATS, NC_CATS_SPICY, settings.spicy),
      cats: [],
      stage: 'DRAW',
      stageEndsAt: null,
      stoppedBy: null,
      answers: {},
      flags: {},
      done: [],
      final: null,
    };
    newRound(s, ctx);
    return s;
  },
  action(s, me, type, payload, ctx) {
    const playing = active(s).includes(me);
    if (type === 'MG_ANSWERS') {
      if (s.stage !== 'WRITE' || !playing) return false;
      return save(s, me, payload?.answers);
    }
    if (type === 'MG_STOP') {
      if (s.stage !== 'WRITE' || !playing) return false;
      const changed = save(s, me, payload?.answers);
      // STOP solo con tutte le categorie compilate (e una volta sola)
      if (s.stoppedBy || filled(s.answers[me]) < N_CATS) return changed;
      s.stoppedBy = me;
      s.stageEndsAt = Math.min(s.stageEndsAt ?? Infinity, ctx.now + STOP_MS);
      return true;
    }
    if (type === 'MG_FLAG') {
      const id = String(payload?.id ?? '');
      const cat = Number(payload?.cat);
      if (s.stage !== 'REVIEW' || !playing || id === me || !active(s).includes(id) || !Number.isInteger(cat) || cat < 0 || cat >= N_CATS) return false;
      if (autoStatus(s, id, cat)) return false; // vuote e lettere sbagliate sono già a zero
      const k = fkey(id, cat);
      const list = s.flags[k] ?? [];
      s.flags[k] = list.includes(me) ? list.filter((x) => x !== me) : [...list, me];
      return true;
    }
    if (type === 'MG_DONE') {
      if (s.stage !== 'REVIEW' || !playing || s.done.includes(me)) return false;
      s.done.push(me);
      if (allDone(s, ctx)) toResult(s, ctx);
      return true;
    }
    if (type === 'MG_FORCE' && ctx.canLead(me) && s.stage !== 'END') {
      advance(s, ctx);
      return true;
    }
    return false;
  },
  tick(s, ctx) {
    if (s.stage === 'END') return false;
    if (s.stageEndsAt && ctx.now >= s.stageEndsAt) {
      advance(s, ctx);
      return true;
    }
    // chi mancava è uscito dall'app: si va avanti senza di lui
    if (s.stage === 'REVIEW' && s.done.length && allDone(s, ctx)) {
      toResult(s, ctx);
      return true;
    }
    return false;
  },
  deadline: (s) => s.stageEndsAt,
  view(s, me): NomiCoseView {
    const ids = active(s);
    const open = s.stage === 'REVIEW' || s.stage === 'RESULT' || s.stage === 'END';
    const status = open ? (s.final ?? evaluate(s)) : null;
    const rows: NCRow[][] = status
      ? s.cats.map((_, c) =>
          ids
            .filter((id) => status[id])
            .map((id) => {
              const flags = s.flags[fkey(id, c)] ?? [];
              return { by: id, text: s.answers[id]?.[c] ?? '', status: status[id][c], flags: flags.length, flagged: flags.includes(me) };
            })
            // le risposte uguali una vicino all'altra, le vuote in fondo
            .sort((a, b) => Number(a.status === 'vuota') - Number(b.status === 'vuota') || key(a.text).localeCompare(key(b.text))),
        )
      : [];
    return {
      stage: s.stage,
      order: s.order,
      round: s.round,
      rounds: s.rounds,
      letter: s.letter,
      cats: s.cats,
      stageEndsAt: s.stageEndsAt,
      stoppedBy: s.stoppedBy,
      myAnswers: ids.includes(me) ? (s.answers[me] ?? Array(N_CATS).fill('')) : null,
      progress: Object.fromEntries(ids.map((id) => [id, filled(s.answers[id])])),
      rows,
      judges: judgesFor(s),
      done: s.done,
      scores: s.scores,
      gained: s.gained,
    };
  },
  ids: (s) => s.order,
  finished: (s) => s.stage === 'END',
  leave(s, id, ctx) {
    if (s.stage === 'END' || !s.order.includes(id) || s.gone.includes(id)) return false;
    s.gone.push(id);
    delete s.scores[id];
    delete s.gained[id];
    for (const k of Object.keys(s.flags)) s.flags[k] = s.flags[k].filter((x) => x !== id);
    s.done = s.done.filter((x) => x !== id);
    if (s.final) delete s.final[id];
    if (!active(s).length) {
      s.stage = 'END';
      s.stageEndsAt = null;
      return true;
    }
    if (s.stage === 'REVIEW' && s.done.length && allDone(s, ctx)) toResult(s, ctx);
    return true;
  },
};

registerFlat('NOMICOSE', nomicose);
