// 👑 Intrigo di corte (regole tipo Coup): 2 personaggi coperti a testa, si dichiara quello che si vuole (anche mentendo)
// e gli altri possono dire DUBITO. Macchina a stati: azione → dubbi → blocco → dubbi sul blocco → effetto.
// Chi perde un personaggio sceglie quale scoprire; senza personaggi si è fuori; vince l'ultimo rimasto.
import type { GameSettings, Player } from '../../src/types/game';
import { I_ACTS, I_CHAR_LIST, I_CHARS, type IAct, type IChar, type ILoseWhy, type IntrigoView, type IStage, type ITone } from '../../src/data/flat/intrigo';
import type { Ctx, Mode } from '../modes';
import { shuffle } from '../party';
import { registerFlat } from './registry';

const TURN_MS = 30_000;
const REACT_MS = 8_000; // finestre DUBITO / BLOCCO
const LOSE_MS = 15_000;
const EXCHANGE_MS = 25_000;
// chi lascia scadere due decisioni di fila (o è scollegato) gioca in automatico e più in fretta
const AWAY_TURN_MS = 6_000;
const AWAY_MS = 4_000;
const START_COINS = 2;
const MUST_COUP = 10;
const LOG_MAX = 14;

interface Card {
  c: IChar;
  dead: boolean;
}

interface Pending {
  actor: string;
  act: IAct;
  target: string | null;
  claim: IChar | null;
  blocker: string | null;
  blockAs: IChar | null;
  drawn: IChar[]; // scambio: le carte pescate
}

// dove si riprende dopo che qualcuno ha perso un personaggio
type Resume = 'BLOCK' | 'EFFECT' | 'DONE';

interface IState {
  order: string[];
  names: Record<string, string>;
  cards: Record<string, Card[]>;
  coins: Record<string, number>;
  deck: IChar[];
  turn: string;
  turnNo: number;
  stage: IStage;
  stageEndsAt: number | null;
  stageMs: number;
  pending: Pending | null;
  eligible: string[];
  passed: string[];
  lose: { who: string; why: ILoseWhy; then: Resume } | null;
  away: Record<string, number>; // decisioni proprie scadute di fila
  out: string[];
  winner: string | null;
  scores: Record<string, number>;
  log: IntrigoView['log'];
  logN: number;
}

// --------------------------------------------------------------- aiutanti

const alive = (s: IState, id: string) => !!s.cards[id]?.some((c) => !c.dead);
const living = (s: IState) => s.order.filter((id) => alive(s, id));
const nm = (s: IState, id: string | null) => (id ? (s.names[id] ?? '?') : '?');
const isAway = (s: IState, id: string, ctx: Ctx) => !ctx.isOnline(id) || (s.away[id] ?? 0) >= 2;
const ch = (c: IChar) => `${I_CHARS[c].the} ${I_CHARS[c].emoji}`;
const isWindow = (st: IStage) => st === 'CHALLENGE' || st === 'BLOCK' || st === 'BLOCK_CHALLENGE';

function say(s: IState, by: string | null, text: string, tone: ITone) {
  s.logN += 1;
  s.log = [...s.log, { n: s.logN, by, text, tone }].slice(-LOG_MAX);
}

function setStage(s: IState, stage: IStage, ms: number, ctx: Ctx) {
  s.stage = stage;
  s.stageMs = ms;
  s.stageEndsAt = ctx.now + ms;
}

// la carta che conviene perdere quando non si sceglie (si tengono Duca e Contessa, le più utili)
const LOSE_FIRST: IChar[] = ['AMBASCIATORE', 'CAPITANO', 'ASSASSINO', 'CONTESSA', 'DUCA'];
function worstCard(s: IState, id: string): number {
  let best = -1;
  s.cards[id].forEach((c, i) => {
    if (c.dead) return;
    if (best < 0 || LOSE_FIRST.indexOf(c.c) < LOSE_FIRST.indexOf(s.cards[id][best].c)) best = i;
  });
  return best;
}

// --------------------------------------------------------------- turni e fine partita

function checkEnd(s: IState): boolean {
  if (s.stage === 'END') return true;
  const left = living(s);
  if (left.length > 1) return false;
  s.winner = left[0] ?? null;
  // punti per ordine di eliminazione: il primo uscito 1 punto, il vincitore tanti quanti i giocatori
  s.out.forEach((id, i) => (s.scores[id] = i + 1));
  if (s.winner) s.scores[s.winner] = s.order.length;
  s.stage = 'END';
  s.stageEndsAt = null;
  s.pending = null;
  s.lose = null;
  s.eligible = [];
  s.passed = [];
  if (s.winner) say(s, s.winner, `👑 ${nm(s, s.winner)} è l'ultimo intrigante rimasto: ha vinto!`, 'win');
  return true;
}

function startTurn(s: IState, id: string, ctx: Ctx): void {
  s.turn = id;
  s.turnNo += 1;
  s.pending = null;
  s.lose = null;
  s.eligible = [];
  s.passed = [];
  setStage(s, 'TURN', isAway(s, id, ctx) ? AWAY_TURN_MS : TURN_MS, ctx);
}

function nextTurn(s: IState, ctx: Ctx): void {
  if (checkEnd(s)) return;
  const i = s.order.indexOf(s.turn);
  for (let k = 1; k <= s.order.length; k++) {
    const id = s.order[(i + k) % s.order.length];
    if (alive(s, id)) return startTurn(s, id, ctx);
  }
}

// --------------------------------------------------------------- perdere un personaggio

function kill(s: IState, who: string, i: number) {
  const card = s.cards[who][i];
  if (!card || card.dead) return;
  card.dead = true;
  say(s, who, `💔 ${nm(s, who)} scopre e perde ${ch(card.c)}`, 'dead');
  if (!alive(s, who)) {
    s.out.push(who);
    s.coins[who] = 0;
    say(s, who, `💀 ${nm(s, who)} è fuori dalla corte!`, 'out');
  }
}

function startLose(s: IState, who: string, why: ILoseWhy, then: Resume, ctx: Ctx): void {
  const live = s.cards[who].filter((c) => !c.dead);
  // con un solo personaggio non c'è niente da scegliere
  if (live.length <= 1) {
    if (live.length) kill(s, who, s.cards[who].indexOf(live[0]));
    return proceed(s, then, ctx);
  }
  s.lose = { who, why, then };
  s.eligible = [];
  s.passed = [];
  setStage(s, 'LOSE', isAway(s, who, ctx) ? AWAY_MS : LOSE_MS, ctx);
}

// --------------------------------------------------------------- azione → dubbi → blocco → dubbi → effetto

function proceed(s: IState, then: Resume, ctx: Ctx): void {
  if (checkEnd(s)) return;
  const p = s.pending;
  if (!p || then === 'DONE' || !alive(s, p.actor)) return nextTurn(s, ctx);
  if (then === 'BLOCK') return openBlock(s, ctx);
  return effect(s, ctx);
}

// dopo i dubbi sull'azione: c'è da chiedere il blocco?
const afterClaim = (p: Pending): Resume => (I_ACTS[p.act].blockers.length ? 'BLOCK' : 'EFFECT');

function openWindow(s: IState, stage: IStage, eligible: string[], ctx: Ctx): void {
  s.eligible = eligible;
  s.passed = [];
  setStage(s, stage, REACT_MS, ctx);
  checkWindow(s, ctx);
}

// chi stiamo ancora aspettando nella finestra (chi è assente lascia passare da solo)
const waitingOn = (s: IState, ctx: Ctx) => s.eligible.filter((id) => alive(s, id) && !s.passed.includes(id) && !isAway(s, id, ctx));

function checkWindow(s: IState, ctx: Ctx): boolean {
  if (!isWindow(s.stage) || waitingOn(s, ctx).length) return false;
  closeWindow(s, ctx);
  return true;
}

// la finestra si chiude senza obiezioni (tutti hanno lasciato passare o il tempo è finito)
function closeWindow(s: IState, ctx: Ctx): void {
  const p = s.pending;
  if (!p) return nextTurn(s, ctx);
  if (s.stage === 'CHALLENGE') return proceed(s, afterClaim(p), ctx);
  if (s.stage === 'BLOCK') return proceed(s, 'EFFECT', ctx);
  // BLOCK_CHALLENGE: nessuno dubita, il blocco regge
  say(s, p.blocker, `🛡️ Il blocco di ${nm(s, p.blocker)} regge: ${nm(s, p.actor)} resta a mani vuote`, 'block');
  nextTurn(s, ctx);
}

function openBlock(s: IState, ctx: Ctx): void {
  const p = s.pending!;
  const A = I_ACTS[p.act];
  if (!A.blockers.length) return effect(s, ctx);
  const eligible = A.anyoneBlocks ? living(s).filter((id) => id !== p.actor) : p.target && alive(s, p.target) ? [p.target] : [];
  if (!eligible.length) return effect(s, ctx);
  openWindow(s, 'BLOCK', eligible, ctx);
}

function declare(s: IState, act: IAct, target: string | null, ctx: Ctx): void {
  const a = s.turn;
  const A = I_ACTS[act];
  s.coins[a] -= A.cost;
  s.pending = { actor: a, act, target, claim: A.claim, blocker: null, blockAs: null, drawn: [] };
  const who = nm(s, a);
  const tgt = nm(s, target);
  switch (act) {
    case 'REDDITO':
      s.coins[a] += 1;
      say(s, a, `${who} prende il reddito: +1 🪙`, 'coin');
      return nextTurn(s, ctx);
    case 'COLPO':
      say(s, a, `💥 ${who} paga 7 🪙 e fa un COLPO DI STATO contro ${tgt}!`, 'claim');
      return effect(s, ctx);
    case 'AIUTI':
      say(s, a, `${who} chiede gli aiuti esteri (+2 🪙): qualcuno lo blocca col Duca?`, 'claim');
      return openBlock(s, ctx);
    case 'TASSE':
      say(s, a, `${who} dichiara ${ch('DUCA')} e vuole riscuotere le tasse (+3 🪙)`, 'claim');
      break;
    case 'ASSASSINIO':
      say(s, a, `${who} dichiara ${ch('ASSASSINO')}, paga 3 🪙 e punta il pugnale su ${tgt}`, 'claim');
      break;
    case 'FURTO':
      say(s, a, `${who} dichiara ${ch('CAPITANO')} e vuole rubare 2 🪙 a ${tgt}`, 'claim');
      break;
    case 'SCAMBIO':
      say(s, a, `${who} dichiara ${ch('AMBASCIATORE')} e vuole scambiare le sue carte`, 'claim');
      break;
  }
  openWindow(
    s,
    'CHALLENGE',
    living(s).filter((id) => id !== a),
    ctx,
  );
}

// DUBITO! Se il dichiarante ha la carta la mostra, la rimescola e ne pesca un'altra (e chi dubitava perde);
// se mentiva perde lui (e l'azione, o il blocco, salta)
function challenge(s: IState, challenger: string, ctx: Ctx): void {
  const p = s.pending!;
  const onBlock = s.stage === 'BLOCK_CHALLENGE';
  const claimant = onBlock ? p.blocker! : p.actor;
  const c = onBlock ? p.blockAs! : p.claim!;
  say(s, challenger, `🤨 ${nm(s, challenger)}: «DUBITO!» ${nm(s, claimant)} ha davvero ${I_CHARS[c].the}?`, 'doubt');
  const i = s.cards[claimant].findIndex((x) => !x.dead && x.c === c);
  if (i >= 0) {
    s.deck = shuffle([...s.deck, c]);
    s.cards[claimant][i] = { c: s.deck.pop()!, dead: false };
    say(
      s,
      claimant,
      `✅ ${nm(s, claimant)} mostra ${ch(c)}: diceva il vero! (la rimescola e ne pesca un'altra) ${onBlock ? 'Il blocco regge.' : "L'azione va avanti."}`,
      'truth',
    );
    return startLose(s, challenger, 'DOUBT', onBlock ? 'DONE' : afterClaim(p), ctx);
  }
  say(s, claimant, `🤥 ${nm(s, claimant)} bluffava: non ha ${I_CHARS[c].the}! ${onBlock ? 'Il blocco salta.' : "L'azione fallisce."}`, 'bluff');
  startLose(s, claimant, 'BLUFF', onBlock ? 'EFFECT' : 'DONE', ctx);
}

function effect(s: IState, ctx: Ctx): void {
  const p = s.pending!;
  const a = p.actor;
  const who = nm(s, a);
  const t = p.target;
  switch (p.act) {
    case 'AIUTI':
      s.coins[a] += 2;
      say(s, a, `${who} incassa gli aiuti esteri: +2 🪙`, 'coin');
      break;
    case 'TASSE':
      s.coins[a] += 3;
      say(s, a, `${who} riscuote le tasse: +3 🪙`, 'coin');
      break;
    case 'FURTO':
      if (t && alive(s, t)) {
        const n = Math.min(2, s.coins[t]);
        s.coins[t] -= n;
        s.coins[a] += n;
        say(s, a, n ? `${who} ruba ${n} 🪙 a ${nm(s, t)}` : `${who} fruga nelle tasche di ${nm(s, t)}… vuote!`, 'coin');
      }
      break;
    case 'SCAMBIO': {
      const n = Math.min(2, s.deck.length);
      p.drawn = s.deck.splice(s.deck.length - n, n);
      setStage(s, 'EXCHANGE', isAway(s, a, ctx) ? AWAY_MS : EXCHANGE_MS, ctx);
      return;
    }
    case 'ASSASSINIO':
    case 'COLPO':
      if (t && alive(s, t)) {
        if (p.act === 'ASSASSINIO') say(s, a, `🗡️ L'assassinio va a segno: ${nm(s, t)} perde un personaggio`, 'dead');
        return startLose(s, t, p.act === 'COLPO' ? 'COUP' : 'KILL', 'DONE', ctx);
      }
      break;
  }
  nextTurn(s, ctx);
}

// fine dello scambio: si tengono le carte scelte (indici nella lista "carte vive + pescate"), le altre tornano nel mazzo
function finishExchange(s: IState, keep: number[] | null) {
  const p = s.pending!;
  const mine = s.cards[p.actor];
  const liveIdx = mine.map((c, i) => (c.dead ? -1 : i)).filter((i) => i >= 0);
  const options = [...liveIdx.map((i) => mine[i].c), ...p.drawn];
  const chosen = keep ?? liveIdx.map((_, k) => k); // tempo scaduto: tiene le sue
  const back = options.filter((_, k) => !chosen.includes(k));
  liveIdx.forEach((i, k) => (mine[i] = { c: options[chosen[k]], dead: false }));
  s.deck = shuffle([...s.deck, ...back]);
  p.drawn = [];
  say(s, p.actor, keep ? `🔄 ${nm(s, p.actor)} ha scambiato le carte` : `${nm(s, p.actor)} si tiene le sue carte`, 'info');
}

// --------------------------------------------------------------- tempo scaduto (o "Avanti" di chi guida)

function timeout(s: IState, ctx: Ctx): void {
  const p = s.pending;
  if (s.stage === 'TURN') {
    // scelta automatica: colpo di stato se può (contro il più forte), altrimenti reddito
    const me = s.turn;
    s.away[me] = (s.away[me] ?? 0) + 1;
    if (s.coins[me] >= 7) {
      const foes = living(s).filter((id) => id !== me);
      const power = (id: string) => s.cards[id].filter((c) => !c.dead).length * 100 + s.coins[id];
      const target = foes.sort((x, y) => power(y) - power(x))[0];
      return declare(s, 'COLPO', target, ctx);
    }
    return declare(s, 'REDDITO', null, ctx);
  }
  if (isWindow(s.stage)) return closeWindow(s, ctx);
  if (s.stage === 'LOSE' && s.lose) {
    const { who, then } = s.lose;
    s.away[who] = (s.away[who] ?? 0) + 1;
    kill(s, who, worstCard(s, who));
    s.lose = null;
    return proceed(s, then, ctx);
  }
  if (s.stage === 'EXCHANGE' && p) {
    s.away[p.actor] = (s.away[p.actor] ?? 0) + 1;
    finishExchange(s, null);
    return nextTurn(s, ctx);
  }
}

// --------------------------------------------------------------- il gioco

export const intrigo: Mode<IState> = {
  start(_settings: GameSettings, players: Player[], ctx) {
    const order = shuffle(players.map((p) => p.id));
    const deck = shuffle(I_CHAR_LIST.flatMap((c) => [c, c, c]));
    const s: IState = {
      order,
      names: Object.fromEntries(players.map((p) => [p.id, p.name])),
      cards: Object.fromEntries(order.map((id) => [id, [deck.pop()!, deck.pop()!].map((c) => ({ c, dead: false }))])),
      coins: Object.fromEntries(order.map((id) => [id, START_COINS])),
      deck,
      turn: order[order.length - 1],
      turnNo: 0,
      stage: 'TURN',
      stageEndsAt: null,
      stageMs: TURN_MS,
      pending: null,
      eligible: [],
      passed: [],
      lose: null,
      away: {},
      out: [],
      winner: null,
      scores: Object.fromEntries(order.map((id) => [id, 0])),
      log: [],
      logN: 0,
    };
    say(s, null, '👑 La corte è riunita: 2 personaggi coperti e 2 monete a testa. Che l’intrigo abbia inizio!', 'info');
    nextTurn(s, ctx);
    return s;
  },

  action(s, me, type, payload, ctx) {
    if (s.stage === 'END') return false;
    if (type === 'MG_FORCE') {
      if (!ctx.canLead(me)) return false;
      timeout(s, ctx);
      return true;
    }
    if (!alive(s, me)) return false;
    const p = s.pending;

    if (type === 'MG_ACT') {
      if (s.stage !== 'TURN' || me !== s.turn) return false;
      const act = String(payload?.act ?? '') as IAct;
      const A = I_ACTS[act];
      if (!A || s.coins[me] < A.cost) return false;
      if (s.coins[me] >= MUST_COUP && act !== 'COLPO') return false; // con 10 monete il colpo di stato è obbligatorio
      let target: string | null = null;
      if (A.target) {
        target = String(payload?.target ?? '');
        if (target === me || !alive(s, target)) return false;
      }
      s.away[me] = 0;
      declare(s, act, target, ctx);
      return true;
    }

    if (type === 'MG_PASS') {
      if (!isWindow(s.stage) || !s.eligible.includes(me) || s.passed.includes(me)) return false;
      s.away[me] = 0;
      s.passed.push(me);
      checkWindow(s, ctx);
      return true;
    }

    if (type === 'MG_CHALLENGE') {
      if ((s.stage !== 'CHALLENGE' && s.stage !== 'BLOCK_CHALLENGE') || !s.eligible.includes(me) || s.passed.includes(me) || !p) return false;
      s.away[me] = 0;
      challenge(s, me, ctx);
      return true;
    }

    if (type === 'MG_BLOCK') {
      if (s.stage !== 'BLOCK' || !s.eligible.includes(me) || s.passed.includes(me) || !p) return false;
      const as = String(payload?.as ?? '') as IChar;
      if (!I_ACTS[p.act].blockers.includes(as)) return false;
      s.away[me] = 0;
      p.blocker = me;
      p.blockAs = as;
      say(s, me, `🛡️ ${nm(s, me)} blocca dichiarando ${ch(as)}`, 'block');
      openWindow(
        s,
        'BLOCK_CHALLENGE',
        living(s).filter((id) => id !== me),
        ctx,
      );
      return true;
    }

    if (type === 'MG_LOSE') {
      if (s.stage !== 'LOSE' || !s.lose || s.lose.who !== me) return false;
      const i = Number(payload?.i);
      if (!Number.isInteger(i) || !s.cards[me][i] || s.cards[me][i].dead) return false;
      s.away[me] = 0;
      const then = s.lose.then;
      kill(s, me, i);
      s.lose = null;
      proceed(s, then, ctx);
      return true;
    }

    if (type === 'MG_KEEP') {
      if (s.stage !== 'EXCHANGE' || !p || p.actor !== me) return false;
      const need = s.cards[me].filter((c) => !c.dead).length;
      const total = need + p.drawn.length;
      const raw: unknown[] = Array.isArray(payload?.keep) ? payload.keep : [];
      const keep = [...new Set(raw.map(Number))].filter((k) => Number.isInteger(k) && k >= 0 && k < total);
      if (keep.length !== need) return false;
      s.away[me] = 0;
      finishExchange(s, keep);
      nextTurn(s, ctx);
      return true;
    }
    return false;
  },

  tick(s, ctx) {
    if (s.stage === 'END') return false;
    // chi è uscito dall'app non fa aspettare la finestra
    if (checkWindow(s, ctx)) return true;
    if (!s.stageEndsAt || ctx.now < s.stageEndsAt) return false;
    timeout(s, ctx);
    return true;
  },

  deadline: (s) => s.stageEndsAt,

  view(s, me): IntrigoView {
    const p = s.pending;
    const end = s.stage === 'END';
    let exchange: IntrigoView['exchange'] = null;
    let keep = 0;
    if (s.stage === 'EXCHANGE' && p && p.actor === me) {
      const live = s.cards[me].filter((c) => !c.dead).map((c) => c.c);
      exchange = [...live, ...p.drawn];
      keep = live.length;
    }
    return {
      stage: s.stage,
      order: s.order,
      turn: s.turn,
      turnNo: s.turnNo,
      stageEndsAt: s.stageEndsAt,
      stageMs: s.stageMs,
      coins: s.coins,
      seats: Object.fromEntries(
        s.order.map((id) => [id, { alive: s.cards[id].filter((c) => !c.dead).length, dead: s.cards[id].filter((c) => c.dead).map((c) => c.c) }]),
      ),
      hand: s.cards[me] ? s.cards[me].map((c) => ({ c: c.c, dead: c.dead })) : null,
      deck: s.deck.length,
      pending: p ? { actor: p.actor, act: p.act, target: p.target, claim: p.claim, blocker: p.blocker, blockAs: p.blockAs } : null,
      eligible: isWindow(s.stage) ? s.eligible.filter((id) => alive(s, id)) : [],
      passed: s.passed,
      lose: s.lose ? { who: s.lose.who, why: s.lose.why } : null,
      exchange,
      keep,
      away: s.order.filter((id) => (s.away[id] ?? 0) >= 2 && alive(s, id)),
      out: s.out,
      winner: s.winner,
      // a fine partita si scoprono le carte rimaste
      reveal: end ? Object.fromEntries(s.order.map((id) => [id, s.cards[id].filter((c) => !c.dead).map((c) => c.c)])) : null,
      scores: s.scores,
      log: s.log.slice(-10),
    };
  },

  ids: (s) => s.order,
  finished: (s) => s.stage === 'END',

  leave(s, id, ctx) {
    if (s.stage === 'END' || !s.order.includes(id) || !alive(s, id)) return false;
    // chi se ne va perde tutti i personaggi
    for (const c of s.cards[id]) c.dead = true;
    s.out.push(id);
    s.coins[id] = 0;
    say(s, id, `🚪 ${nm(s, id)} ha lasciato la corte`, 'out');
    if (checkEnd(s)) return true;
    const p = s.pending;
    if (s.stage === 'TURN' && s.turn === id) nextTurn(s, ctx);
    else if (s.stage === 'EXCHANGE' && p?.actor === id) {
      s.deck = shuffle([...s.deck, ...p.drawn]);
      p.drawn = [];
      nextTurn(s, ctx);
    } else if (p && p.actor === id) nextTurn(s, ctx);
    else if (s.stage === 'LOSE' && s.lose?.who === id) {
      const then = s.lose.then;
      s.lose = null;
      proceed(s, then, ctx);
    } else if (s.stage === 'BLOCK_CHALLENGE' && p?.blocker === id) {
      // il blocco se ne va con lui
      say(s, null, `Il blocco di ${nm(s, id)} salta`, 'info');
      proceed(s, 'EFFECT', ctx);
    } else checkWindow(s, ctx);
    return true;
  },
};

registerFlat('INTRIGO', intrigo);
