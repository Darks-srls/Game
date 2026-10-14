import { registerBot, type FlatBot } from './types';

// Giocatore finto di Intrigo di corte: bluffa, dubita e blocca ogni tanto (per provare tutti i rami)
const BLOCKS: Record<string, string[]> = { AIUTI: ['DUCA'], ASSASSINIO: ['CONTESSA'], FURTO: ['CAPITANO', 'AMBASCIATORE'] };

export const intrigo: FlatBot = (v, me, { rand }) => {
  if (v.stage === 'END') return null;
  const live: string[] = (v.hand ?? []).filter((c: any) => !c.dead).map((c: any) => c.c);
  if (!live.length) return null;
  if (rand() < 0.45) return null; // ci pensano un po'
  const pick = <T,>(list: T[]): T => list[Math.floor(rand() * list.length)];
  const foes: string[] = v.order.filter((id: string) => id !== me && v.seats[id].alive > 0);

  if (v.stage === 'TURN' && v.turn === me) {
    const coins = v.coins[me];
    const target = pick(foes);
    if (coins >= 10 || (coins >= 7 && rand() < 0.7)) return { type: 'MG_ACT', payload: { act: 'COLPO', target } };
    const r = rand();
    if (r < 0.12) return { type: 'MG_ACT', payload: { act: 'REDDITO' } };
    if (r < 0.3) return { type: 'MG_ACT', payload: { act: 'AIUTI' } };
    if (r < 0.55) return { type: 'MG_ACT', payload: { act: 'TASSE' } };
    if (r < 0.72 && coins >= 3) return { type: 'MG_ACT', payload: { act: 'ASSASSINIO', target } };
    if (r < 0.88) {
      const rich = foes.filter((id) => v.coins[id] > 0);
      return { type: 'MG_ACT', payload: { act: 'FURTO', target: rich.length ? pick(rich) : target } };
    }
    return { type: 'MG_ACT', payload: { act: 'SCAMBIO' } };
  }

  if ((v.stage === 'CHALLENGE' || v.stage === 'BLOCK_CHALLENGE') && v.eligible.includes(me) && !v.passed.includes(me)) {
    const claim = v.stage === 'CHALLENGE' ? v.pending?.claim : v.pending?.blockAs;
    // se ho già io quella carta (o due) è più probabile che menta
    const mine = live.filter((c) => c === claim).length;
    const p = 0.12 + mine * 0.2 + (v.pending?.target === me ? 0.15 : 0);
    return rand() < p ? { type: 'MG_CHALLENGE' } : { type: 'MG_PASS' };
  }

  if (v.stage === 'BLOCK' && v.eligible.includes(me) && !v.passed.includes(me)) {
    const options = BLOCKS[v.pending?.act] ?? [];
    const real = options.filter((c) => live.includes(c));
    if (real.length && rand() < 0.8) return { type: 'MG_BLOCK', payload: { as: real[0] } };
    if (rand() < 0.25) return { type: 'MG_BLOCK', payload: { as: pick(options) } }; // bluff
    return { type: 'MG_PASS' };
  }

  if (v.stage === 'LOSE' && v.lose?.who === me) {
    const idx = (v.hand as any[]).map((c, i) => (c.dead ? -1 : i)).filter((i) => i >= 0);
    return { type: 'MG_LOSE', payload: { i: pick(idx) } };
  }

  if (v.stage === 'EXCHANGE' && v.exchange) {
    const all: number[] = v.exchange.map((_: string, i: number) => i);
    const keep: number[] = [];
    while (keep.length < v.keep) keep.push(pick(all.filter((i) => !keep.includes(i))));
    return { type: 'MG_KEEP', payload: { keep } };
  }
  return null;
};

registerBot('INTRIGO', intrigo);
