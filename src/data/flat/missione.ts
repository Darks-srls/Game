// 🕶️ Missione segreta (agenti contro spie): tabelle del gioco e quello che vede ogni telefono

export type MissioneRole = 'AGENTE' | 'VEGGENTE' | 'SPIA' | 'SICARIO';
export type MissioneTeam = 'AGENTI' | 'SPIE';

// spie per numero di giocatori (5→2, 6→2, 7→3, 8→3, 9→3, 10→4)
export const MI_SPIES: Record<number, number> = { 5: 2, 6: 2, 7: 3, 8: 3, 9: 3, 10: 4 };
// quanti vanno in ognuna delle 5 missioni
export const MI_TEAMS: Record<number, number[]> = {
  5: [2, 3, 2, 3, 3],
  6: [2, 3, 4, 3, 4],
  7: [2, 3, 3, 4, 4],
  8: [3, 4, 4, 5, 5],
  9: [3, 4, 4, 5, 5],
  10: [3, 4, 4, 5, 5],
};
// sabotaggi che servono per far fallire la missione (la 4ª con 7+ giocatori ne vuole due)
export const miFailsNeeded = (players: number, mission: number) => (mission === 3 && players >= 7 ? 2 : 1);

export const MI_ROLES: Record<MissioneRole, { name: string; emoji: string; team: MissioneTeam; goal: string }> = {
  AGENTE: { name: 'Agente', emoji: '🕵️', team: 'AGENTI', goal: 'Fai riuscire 3 missioni. Le spie sono tra voi: non mandarle in missione!' },
  VEGGENTE: {
    name: 'Veggente',
    emoji: '🔮',
    team: 'AGENTI',
    goal: 'Sei un agente e sai chi sono le spie. Aiuta gli altri senza farti scoprire: alla fine il Sicario ti cerca!',
  },
  SPIA: { name: 'Spia', emoji: '🕶️', team: 'SPIE', goal: 'Infiltrati nelle squadre e sabota 3 missioni senza farti scoprire.' },
  SICARIO: {
    name: 'Sicario',
    emoji: '🗡️',
    team: 'SPIE',
    goal: 'Sei una spia: sabota le missioni. Se gli agenti vincono, hai un colpo solo per trovare il Veggente.',
  },
};

export type MissioneEnd = 'TRE_OK' | 'TRE_KO' | 'BOCCIATE' | 'VEGGENTE_PRESO' | 'VEGGENTE_SALVO';

export interface MissioneProposal {
  mission: number; // 0-4
  leader: number; // indice in order (compatto: la cronaca dei voti è pubblica e si vede sempre)
  team: number[];
  yes: number[]; // chi ha approvato
  no: number[]; // chi ha bocciato (chi manca non ha votato)
  approved: boolean;
  auto?: boolean; // squadra completata a caso (tempo scaduto)
}

export interface MissioneView {
  stage: 'ROLE' | 'TEAM' | 'VOTE' | 'VOTE_RESULT' | 'MISSION' | 'MISSION_RESULT' | 'ASSASSIN' | 'END';
  order: string[];
  names: Record<string, string>;
  stageEndsAt: number | null;
  stageMs: number;
  myRole: MissioneRole | null; // null = guarda senza giocare
  spies: string[]; // le spie che conosco (spie e Veggente; tutti dal Sicario in poi)
  sicario: string | null; // per le spie (e per tutti alla fine)
  seer: string | null; // il Veggente: si svela solo alla fine
  withSeer: boolean;
  spyCount: number;
  sizes: number[];
  needs: number[]; // sabotaggi che servono per ogni missione
  results: ({ ok: boolean; fails: number } | null)[]; // le 5 missioni
  mission: number; // missione in corso (0-4)
  leader: string;
  team: string[];
  ready: string[];
  voted: string[]; // chi ha votato (non cosa)
  myVote: boolean | null;
  rejects: number; // squadre bocciate di fila
  played: string[]; // chi della squadra ha consegnato la carta
  myPlayed: boolean;
  cards: ('S' | 'F')[] | null; // le carte della missione, mescolate
  last: MissioneProposal | null; // l'ultima proposta (con i voti svelati)
  assassinPick: string | null; // la scelta del Sicario (pubblica: si discute tra spie a voce)
  winner: MissioneTeam | null;
  endReason: MissioneEnd | null;
  history: MissioneProposal[]; // tutte le squadre proposte, con i voti (pubblici dopo lo spoglio)
  scores: Record<string, number>;
}
