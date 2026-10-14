import { registerBot, type FlatBot } from './types';

// giocatore finto di Rose e teschi: mette a volte il teschio, sfida quando conosce le sue rose e ogni tanto bluffa
export const rose: FlatBot = (v, me, { rand }) => {
  if (rand() < 0.5) return null; // ci pensa un po'
  const my = v.me;
  const seat = v.seats?.[me];
  if (!my || !seat || seat.out) return null;
  const roses = my.hand.filter((d: string) => d === 'R').length;
  const hasSkull = my.hand.includes('S');
  const pickDisc = () => (hasSkull && (roses === 0 || rand() < 0.3) ? 'S' : 'R');
  // rose sicure: la mia pila se non ci ho messo il teschio
  const safe = my.stack.includes('S') ? 0 : my.stack.length;

  if (v.stage === 'PLACE' && !seat.placed) return { type: 'MG_PLACE', payload: { disc: pickDisc() } };
  if (v.turn !== me) return null;

  if (v.stage === 'PLAY') {
    const canAdd = my.hand.length > 0;
    if (!canAdd || rand() < 0.12 + v.total * 0.035) {
      // sfida onesta (quante rose so di avere, +1 di azzardo) o bluff col teschio sotto
      const n = safe > 0 ? safe + (rand() < 0.4 ? 1 : 0) : 1 + Math.floor(rand() * 2);
      return { type: 'MG_CHALLENGE', payload: { n: Math.max(1, Math.min(v.total, n)) } };
    }
    return { type: 'MG_ADD', payload: { disc: pickDisc() } };
  }
  if (v.stage === 'BID' && v.bid) {
    const n = v.bid.n + 1;
    const keen = n <= safe + 1 ? 0.55 : 0.12; // a volte rilancia anche alla cieca
    if (n <= v.total && rand() < keen) return { type: 'MG_RAISE', payload: { n } };
    return { type: 'MG_PASS' };
  }
  if (v.stage === 'FLIP' && v.choosing && v.flipper === me) {
    const piles = v.order.filter((id: string) => id !== me && v.seats[id].stack - v.seats[id].flipped.length > 0);
    if (piles.length) return { type: 'MG_FLIP', payload: { of: piles[Math.floor(rand() * piles.length)] } };
  }
  return null;
};

registerBot('ROSE', rose);
