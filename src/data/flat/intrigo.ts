// 👑 Intrigo di corte: personaggi, azioni e quello che vede ogni telefono

export type IChar = 'DUCA' | 'ASSASSINO' | 'CAPITANO' | 'AMBASCIATORE' | 'CONTESSA';
export type IAct = 'REDDITO' | 'AIUTI' | 'COLPO' | 'TASSE' | 'ASSASSINIO' | 'FURTO' | 'SCAMBIO';
export type IStage = 'TURN' | 'CHALLENGE' | 'BLOCK' | 'BLOCK_CHALLENGE' | 'LOSE' | 'EXCHANGE' | 'END';
// colore della riga di cronaca
export type ITone = 'info' | 'coin' | 'claim' | 'block' | 'doubt' | 'truth' | 'bluff' | 'dead' | 'out' | 'win';
// perché qualcuno perde un personaggio
export type ILoseWhy = 'DOUBT' | 'BLUFF' | 'KILL' | 'COUP';

export const I_CHAR_LIST: IChar[] = ['DUCA', 'ASSASSINO', 'CAPITANO', 'AMBASCIATORE', 'CONTESSA'];

export const I_CHARS: Record<IChar, { name: string; the: string; emoji: string; power: string; block: string | null }> = {
  DUCA: { name: 'Duca', the: 'il Duca', emoji: '🤴', power: 'Tasse: prendi 3 monete', block: 'Blocca gli aiuti esteri' },
  ASSASSINO: { name: 'Assassino', the: "l'Assassino", emoji: '🥷', power: 'Paghi 3 monete: un avversario perde un personaggio', block: null },
  CAPITANO: { name: 'Capitano', the: 'il Capitano', emoji: '🏴‍☠️', power: 'Furto: rubi 2 monete a un avversario', block: 'Blocca i furti' },
  AMBASCIATORE: { name: 'Ambasciatore', the: "l'Ambasciatore", emoji: '🕴️', power: 'Scambio: peschi 2 carte e tieni quelle che vuoi', block: 'Blocca i furti' },
  CONTESSA: { name: 'Contessa', the: 'la Contessa', emoji: '👸', power: 'Nessuna azione: è una dama che si difende', block: 'Blocca gli assassinii' },
};

export const I_ACTS: Record<
  IAct,
  { name: string; emoji: string; claim: IChar | null; cost: number; target: boolean; blockers: IChar[]; anyoneBlocks: boolean; desc: string }
> = {
  REDDITO: { name: 'Reddito', emoji: '🪙', claim: null, cost: 0, target: false, blockers: [], anyoneBlocks: false, desc: '+1 moneta, sicuro' },
  AIUTI: { name: 'Aiuti esteri', emoji: '💰', claim: null, cost: 0, target: false, blockers: ['DUCA'], anyoneBlocks: true, desc: '+2 monete (il Duca li blocca)' },
  COLPO: { name: 'Colpo di stato', emoji: '💥', claim: null, cost: 7, target: true, blockers: [], anyoneBlocks: false, desc: '7 monete: uno perde un personaggio' },
  TASSE: { name: 'Tasse', emoji: '🤴', claim: 'DUCA', cost: 0, target: false, blockers: [], anyoneBlocks: false, desc: '+3 monete' },
  ASSASSINIO: { name: 'Assassinio', emoji: '🥷', claim: 'ASSASSINO', cost: 3, target: true, blockers: ['CONTESSA'], anyoneBlocks: false, desc: '3 monete: uno perde un personaggio' },
  FURTO: { name: 'Furto', emoji: '🏴‍☠️', claim: 'CAPITANO', cost: 0, target: true, blockers: ['CAPITANO', 'AMBASCIATORE'], anyoneBlocks: false, desc: 'rubi 2 monete' },
  SCAMBIO: { name: 'Scambio', emoji: '🕴️', claim: 'AMBASCIATORE', cost: 0, target: false, blockers: [], anyoneBlocks: false, desc: 'cambi le tue carte' },
};

export const I_ACT_LIST: IAct[] = ['REDDITO', 'AIUTI', 'COLPO', 'TASSE', 'ASSASSINIO', 'FURTO', 'SCAMBIO'];

// cosa vede ciascun giocatore: le carte coperte degli altri restano segrete (si vede solo quante sono)
export interface IntrigoView {
  stage: IStage;
  order: string[];
  turn: string; // di chi è il turno
  turnNo: number;
  stageEndsAt: number | null;
  stageMs: number; // durata della fase (per il cerchio del tempo)
  coins: Record<string, number>;
  seats: Record<string, { alive: number; dead: IChar[] }>; // carte coperte e carte scoperte (perse) di ognuno
  hand: { c: IChar; dead: boolean }[] | null; // le mie carte (null per chi guarda e basta)
  deck: number;
  pending: { actor: string; act: IAct; target: string | null; claim: IChar | null; blocker: string | null; blockAs: IChar | null } | null;
  eligible: string[]; // chi può reagire nella finestra aperta
  passed: string[]; // chi ha già lasciato passare
  lose: { who: string; why: ILoseWhy } | null;
  exchange: IChar[] | null; // solo per chi scambia: le sue carte vive + le 2 pescate
  keep: number; // quante tenerne nello scambio
  away: string[]; // chi non risponde (gioca in automatico)
  out: string[]; // ordine di eliminazione
  winner: string | null;
  reveal: Record<string, IChar[]> | null; // a fine partita: le carte rimaste di tutti
  scores: Record<string, number>;
  log: { n: number; by: string | null; text: string; tone: ITone }[];
}
