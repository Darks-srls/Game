import { registerBot, type FlatBot } from './types';

// giocatore finto di Missione segreta: il capo sceglie a caso, i voti sono un po' a caso, le spie sabotano spesso
export const missione: FlatBot = (v, me, { rand }) => {
  if (rand() < 0.5) return null; // pensano un po'
  const spy = v.myRole === 'SPIA' || v.myRole === 'SICARIO';
  if (v.stage === 'ROLE' && !v.ready.includes(me)) return { type: 'MG_READY' };
  if (v.stage === 'TEAM' && v.leader === me) {
    const need = v.sizes[v.mission];
    if (v.team.length < need) {
      const free = v.order.filter((id: string) => !v.team.includes(id));
      return { type: 'MG_TOGGLE', payload: { id: free[Math.floor(rand() * free.length)] } };
    }
    if (rand() < 0.1) return { type: 'MG_TOGGLE', payload: { id: v.team[0] } }; // ci ripensa
    return { type: 'MG_PROPOSE' };
  }
  if (v.stage === 'VOTE' && v.myVote === null) {
    // le spie approvano le squadre con una spia dentro, gli agenti approvano spesso
    const spyIn = v.team.some((id: string) => v.spies.includes(id));
    return { type: 'MG_VOTE', payload: { ok: spy ? spyIn || rand() < 0.3 : rand() < 0.7 } };
  }
  if (v.stage === 'MISSION' && v.team.includes(me) && !v.myPlayed) return { type: 'MG_PLAY', payload: { fail: spy ? rand() < 0.6 : rand() < 0.1 } };
  if (v.stage === 'ASSASSIN' && v.myRole === 'SICARIO') {
    if (!v.assassinPick) {
      const agents = v.order.filter((id: string) => !v.spies.includes(id));
      return { type: 'MG_AIM', payload: { id: agents[Math.floor(rand() * agents.length)] } };
    }
    return { type: 'MG_SHOOT' };
  }
  return null;
};

registerBot('MISSIONE', missione);
