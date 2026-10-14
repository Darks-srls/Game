import { registerBot, type FlatBot } from './types';

// giocatore finto dei Lupi: di notte sceglie (i lupi seguono il compagno), di giorno vota a caso (i lupi non votano lupi)
export const lupi: FlatBot = (v, me, { rand }) => {
  if (rand() < 0.5) return null; // pensano un po'
  const any = (list: string[]) => list[Math.floor(rand() * list.length)];
  if (v.stage === 'ROLE' && !v.ready.includes(me)) return { type: 'MG_READY' };
  if (!v.alive.includes(me)) return null;
  if (v.stage === 'NIGHT' && !v.done.includes(me) && v.targets.length) {
    if (!v.myPick) {
      // il lupo segue la scelta di un compagno, se c'è
      const mate = v.pack ? (Object.entries(v.pack).find(([id, t]) => id !== me && t) as [string, string] | undefined) : undefined;
      return { type: 'MG_PICK', payload: { id: mate && rand() < 0.8 ? mate[1] : any(v.targets) } };
    }
    if (rand() < 0.15) return { type: 'MG_PICK', payload: { id: any(v.targets) } }; // ci ripensa
    return { type: 'MG_LOCK' };
  }
  if (v.stage === 'DAY' && !v.ready.includes(me) && rand() < 0.1) return { type: 'MG_READY' };
  if (v.stage === 'VOTE' && (!v.votes[me] || rand() < 0.03)) {
    const wolf = v.myRole === 'LUPO';
    const options = v.alive.filter((id: string) => id !== me && !(wolf && v.roles[id] === 'LUPO'));
    if (!options.length || rand() < 0.1) return null; // qualcuno non vota
    return { type: 'MG_VOTE', payload: { id: any(options) } };
  }
  return null;
};

registerBot('LUPI', lupi);
