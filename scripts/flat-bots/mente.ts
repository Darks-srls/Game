import { registerBot, type FlatBot } from './types';

// "sentono" il momento: più la loro carta è vicina all'ultima giocata, più è facile che la giochino (e a volte sbagliano)
export const mente: FlatBot = (v, me, { rand }) => {
  if (!v.myCards) return null;
  if (v.stage === 'READY') return !v.ready.includes(me) && rand() < 0.4 ? { type: 'MG_READY' } : null;
  if (v.stage !== 'PLAY') return null;
  if (v.starVote) {
    if (v.starVote.yes.includes(me) || rand() < 0.5) return null;
    return rand() < 0.85 ? { type: 'MG_STAR_YES' } : { type: 'MG_STAR_NO' };
  }
  const card: number | undefined = v.myCards[0];
  if (card === undefined) return null;
  const top = v.top ?? 0;
  const gap = card - top;
  // distanza "attesa" tra una carta e l'altra, viste le carte rimaste a tutti
  const left = Object.values(v.counts as Record<string, number>).reduce((t, n) => t + n, 0);
  const r = gap / Math.max(1, (100 - top) / (left + 1));
  // la stellina quando le carte sono tante e lontane
  if (v.stars > 0 && left > 4 && r > 2 && rand() < 0.01) return { type: 'MG_STAR' };
  const p = 0.5 * Math.exp(-2.5 * r) + 0.02;
  // ogni tanto un tocco doppio: il secondo non deve giocare la carta dopo
  if (rand() < p) return { type: 'MG_PLAY', payload: { card: rand() < 0.05 ? card - 1 : card } };
  return null;
};

registerBot('MENTE', mente);
