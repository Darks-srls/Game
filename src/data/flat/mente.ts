// 🧠 Mente unica (cooperativo in tempo reale): livelli, premi e quello che vede ogni telefono

export type MenteReward = 'life' | 'star';

// cosa è appena successo (errore, stellina, troppo silenzio, qualcuno uscito): si mostra a tutti
export interface MenteEvent {
  kind: 'oops' | 'star' | 'idle' | 'leave';
  by: string | null; // chi ha giocato la carta (o proposto la stellina, o è uscito)
  card: number | null; // la carta giocata
  lost: { id: string; cards: number[] }[]; // carte scartate (scoperte)
}

export interface MenteView {
  stage: 'READY' | 'PLAY' | 'PAUSE' | 'CLEAR' | 'END';
  order: string[];
  gone: string[];
  level: number;
  maxLevel: number;
  lives: number;
  stars: number;
  counts: Record<string, number>; // quante carte ha in mano ciascuno
  myCards: number[] | null; // null per chi guarda senza giocare
  top: number | null; // l'ultima carta sulla pila
  topBy: string | null;
  trail: { card: number; by: string; bad: boolean }[]; // le ultime carte giocate (la più recente in fondo)
  played: number; // carte giocate o scartate in questo livello
  total: number; // carte distribuite in questo livello
  ready: string[];
  stageEndsAt: number | null; // PLAY: se nessuno gioca entro allora si perde una vita
  starVote: { by: string; yes: string[]; endsAt: number } | null;
  event: MenteEvent | null;
  eventNo: number;
  reward: MenteReward | null; // premio del livello appena superato
  rewardWasted: boolean; // premio già al massimo
  result: 'WIN' | 'LOSE' | null;
  mistakes: number;
  reveal: Record<string, number[]> | null; // a fine partita: le carte rimaste in mano a tutti
}

export const MENTE_MAX_LIVES = 5;
export const MENTE_MAX_STARS = 3;

// livelli da superare: in due si va più lontano
export const menteLevels = (players: number) => (players <= 2 ? 12 : players === 3 ? 10 : 8);

// premio per chi supera il livello
export const MENTE_REWARDS: Record<number, MenteReward> = { 2: 'star', 3: 'life', 5: 'star', 6: 'life', 8: 'star', 9: 'life' };
