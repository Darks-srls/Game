// ⚽🚗 Axend Turbo — quello che il server dice ai telefoni sulla partita (oltre allo stato del campo che viaggia a parte)
import type { Stats } from './world';

export interface TurboRoomView {
  stage: 'PLAY' | 'END';
  size: number; // giocatori per squadra (1, 2 o 3)
  teams: Record<string, 0 | 1>; // tutti: giocatori veri e bot
  names: Record<string, string>; // nomi dei bot (i giocatori veri sono in state.players)
  bots: string[];
  score: [number, number];
  winner: 0 | 1 | -1 | null; // a fine partita
  stats: Record<string, Stats> | null; // a fine partita
  mvp: string | null;
  startAt: number; // ms (ora del server) del passo 0
}

// impostazioni nella stanza (settings.extra)
export const TURBO_OPTIONS = {
  size: { key: 'turboSize', values: [1, 2, 3], def: 2 },
  skill: { key: 'turboSkill', values: [0, 1, 2], def: 1 }, // facili, medi, forti
};
export const SKILL_LEVEL = [0.35, 0.65, 0.95];
