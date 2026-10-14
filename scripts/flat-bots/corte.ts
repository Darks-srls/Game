import { registerBot, type FlatBot } from './types';

// Giocatore finto di Lettere a corte: gioca quasi sempre in modo sensato, ogni tanto sbaglia (anche mosse non valide)
const TARGETED = [1, 2, 3, 5, 6];

export const corte: FlatBot = (v, me, { rand }) => {
  if (v.stage === 'ROUND') return rand() < 0.3 ? { type: 'MG_READY' } : null;
  if (v.stage !== 'TURN' || v.turn !== me || !v.hand || v.hand.length !== 2) return null;
  if (rand() < 0.5) return null; // ci pensa
  const hand: number[] = v.hand;
  const pick = <T,>(list: T[]): T => list[Math.floor(rand() * list.length)];
  let i = hand[0] <= hand[1] ? 0 : 1;
  if (rand() < 0.25) i = 1 - i; // a volte gioca l'altra
  if (v.mustContessa && rand() < 0.9) i = hand.indexOf(7);
  if (hand[i] === 8 && rand() < 0.95) i = 1 - i;
  const c = hand[i];
  const foes = v.order.filter((id: string) => id !== me && v.seats[id].inRound && !v.seats[id].out && !v.seats[id].safe);
  let target: string | null = null;
  if (TARGETED.includes(c)) target = foes.length ? pick(foes) : c === 5 ? me : null;
  if (c === 5 && rand() < 0.1) target = me;
  // la Guardia prova a usare quello che ha visto col Prete
  const note = v.notes.find((n: any) => !n.stale && n.about === target && n.card > 1);
  const guess = note ? note.card : 2 + Math.floor(rand() * 7);
  return { type: 'MG_PLAY', payload: { i, target, guess } };
};

registerBot('CORTE', corte);
