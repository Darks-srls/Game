import { registerBot, type FlatBot } from './types';

const BEASTS = ['SCARAFAGGIO', 'TOPO', 'PIPISTRELLO', 'MOSCA', 'ROSPO', 'RAGNO', 'SCORPIONE', 'PUZZOLA'];

// giocatore finto di Bestie bugiarde: bluffa circa metà delle volte, a volte guarda e ripassa,
// e quando risponde ragiona un po' (se la bestia dichiarata ce l'ha in mano in tante copie, sospetta la bugia)
export const bestie: FlatBot = (v, me, { rand }) => {
  if (rand() < 0.5 || v.active !== me) return null;
  const others = v.order.filter((id: string) => id !== me && !v.gone.includes(id));
  const lie = (card: string) => BEASTS.filter((b) => b !== card)[Math.floor(rand() * 7)];
  // dichiarazione: verità o bugia; ogni tanto la bestia che l'altro ha già 3 volte (cattiveria)
  const claimFor = (card: string) => (rand() < 0.45 ? card : lie(card));

  if (v.stage === 'GIVE' && v.myHand.length) {
    const card = v.myHand[Math.floor(rand() * v.myHand.length)];
    // passa più volentieri a chi ha già tante carte scoperte
    const byFront = [...others].sort((a, b) => total(v, b) - total(v, a));
    const to = rand() < 0.5 ? byFront[0] : others[Math.floor(rand() * others.length)];
    return { type: 'MG_GIVE', payload: { card, to, claim: claimFor(card) } };
  }
  if (v.stage === 'RECEIVE' && v.claim) {
    if (v.candidates.length && rand() < 0.3) return { type: 'MG_PEEK' };
    // quante copie della bestia dichiarata conosco (in mano e scoperte sul tavolo): più sono, meno è probabile
    const known = v.myHand.filter((b: string) => b === v.claim).length + v.order.reduce((n: number, id: string) => n + (v.front[id]?.[v.claim] ?? 0), 0);
    const pTrue = Math.max(0.1, 0.55 - known * 0.08);
    return { type: 'MG_ANSWER', payload: { said: rand() < pTrue ? 'VERO' : 'FALSO' } };
  }
  if (v.stage === 'PEEK' && v.card && v.candidates.length) {
    const to = v.candidates[Math.floor(rand() * v.candidates.length)];
    return { type: 'MG_PASS', payload: { to, claim: claimFor(v.card) } };
  }
  return null;
};

const total = (v: any, id: string) => Object.values(v.front[id] ?? {}).reduce((n: number, x: any) => n + x, 0);

registerBot('BESTIE', bestie);
