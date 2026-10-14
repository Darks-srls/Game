// 💌 Lettere a corte (regole tipo Love Letter): le 8 carte del mazzo e quello che vede ogni telefono

export type CStage = 'TURN' | 'ROUND' | 'END';
export type CTone = 'info' | 'play' | 'hit' | 'miss' | 'out' | 'safe' | 'win';
export type CHow = 'PRETE' | 'BARONE' | 'RE';

// valore → personaggio (16 carte in tutto)
export const C_CARDS: Record<number, { name: string; the: string; emoji: string; count: number; power: string; target: boolean }> = {
  1: { name: 'Guardia', the: 'la Guardia', emoji: '💂', count: 5, power: 'Indovina la carta di un altro (non Guardia): se ci prendi è fuori', target: true },
  2: { name: 'Prete', the: 'il Prete', emoji: '⛪', count: 2, power: 'Guarda di nascosto la carta di un altro', target: true },
  3: { name: 'Barone', the: 'il Barone', emoji: '🧐', count: 2, power: 'Confronta la tua carta con un altro: il più basso è fuori', target: true },
  4: { name: 'Ancella', the: "l'Ancella", emoji: '💁‍♀️', count: 2, power: 'Sei protetto fino al tuo prossimo turno', target: false },
  5: { name: 'Principe', the: 'il Principe', emoji: '🤴', count: 2, power: 'Un giocatore (anche tu) scarta la sua carta e ne pesca un’altra', target: true },
  6: { name: 'Re', the: 'il Re', emoji: '👑', count: 1, power: 'Scambia la tua carta con quella di un altro', target: true },
  7: { name: 'Contessa', the: 'la Contessa', emoji: '💃', count: 1, power: 'Va giocata se hai anche il Re o il Principe', target: false },
  8: { name: 'Principessa', the: 'la Principessa', emoji: '👸', count: 1, power: 'Se la scarti (o te la fanno scartare) sei fuori', target: false },
};

export const C_VALUES = [1, 2, 3, 4, 5, 6, 7, 8];

// cosa vede ciascun giocatore: la sua carta, gli scarti di tutti, chi è protetto; quello che ha scoperto lo vede solo lui
export interface CorteView {
  stage: CStage;
  order: string[];
  round: number;
  goal: number; // lettere per vincere
  letters: Record<string, number>;
  turn: string;
  turnNo: number;
  stageEndsAt: number | null;
  stageMs: number;
  deck: number; // carte ancora nel mazzo
  faceUp: number[]; // carte tolte scoperte (in 2 giocatori)
  seats: Record<string, { inRound: boolean; out: boolean; safe: boolean; cards: number; discards: { v: number; forced: boolean }[]; gone: boolean }>;
  hand: number[] | null; // le mie carte (null per chi guarda)
  mustContessa: boolean; // ho la Contessa con Re o Principe: devo giocarla
  notes: { about: string; card: number; how: CHow; stale: boolean }[]; // le mie informazioni segrete di questo giro
  lastPlay: { n: number; by: string; v: number; target: string | null; guess: number | null; text: string } | null;
  roundEnd: { winners: string[]; hands: Record<string, number>; how: 'LAST' | 'HIGH'; burned: number | null } | null;
  ready: string[];
  winners: string[];
  scores: Record<string, number>;
  log: { n: number; by: string | null; text: string; tone: CTone }[];
}
