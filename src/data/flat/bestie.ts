// 🪳 Bestie bugiarde: le 8 bestie schifose e quello che vede ogni telefono (niente carte degli altri)

export type Beast = 'SCARAFAGGIO' | 'TOPO' | 'PIPISTRELLO' | 'MOSCA' | 'ROSPO' | 'RAGNO' | 'SCORPIONE' | 'PUZZOLA';

export interface BeastInfo {
  id: Beast;
  emoji: string;
  name: string; // "ragno"
  plural: string; // "ragni"
  art: string; // con l'articolo: "un ragno"
  c1: string; // colori della carta (sfumatura)
  c2: string;
  ink: string; // colore delle scritte sulla fascia
}

export const BEASTS: BeastInfo[] = [
  { id: 'SCARAFAGGIO', emoji: '🪳', name: 'scarafaggio', plural: 'scarafaggi', art: 'uno scarafaggio', c1: '#d97706', c2: '#78350f', ink: '#451a03' },
  { id: 'TOPO', emoji: '🐀', name: 'topo', plural: 'topi', art: 'un topo', c1: '#94a3b8', c2: '#334155', ink: '#0f172a' },
  { id: 'PIPISTRELLO', emoji: '🦇', name: 'pipistrello', plural: 'pipistrelli', art: 'un pipistrello', c1: '#a855f7', c2: '#3b0764', ink: '#2e1065' },
  { id: 'MOSCA', emoji: '🪰', name: 'mosca', plural: 'mosche', art: 'una mosca', c1: '#2dd4bf', c2: '#115e59', ink: '#042f2e' },
  { id: 'ROSPO', emoji: '🐸', name: 'rospo', plural: 'rospi', art: 'un rospo', c1: '#a3e635', c2: '#3f6212', ink: '#1a2e05' },
  { id: 'RAGNO', emoji: '🕷️', name: 'ragno', plural: 'ragni', art: 'un ragno', c1: '#52525b', c2: '#09090b', ink: '#18181b' },
  { id: 'SCORPIONE', emoji: '🦂', name: 'scorpione', plural: 'scorpioni', art: 'uno scorpione', c1: '#fb923c', c2: '#9a3412', ink: '#431407' },
  { id: 'PUZZOLA', emoji: '🦨', name: 'puzzola', plural: 'puzzole', art: 'una puzzola', c1: '#38bdf8', c2: '#1e3a8a', ink: '#172554' },
];

export const BEAST_IDS = BEASTS.map((b) => b.id);
export const beastInfo = (id: Beast | string | null | undefined): BeastInfo => BEASTS.find((b) => b.id === id) ?? BEASTS[0];
export const BESTIE_COPIES = 8; // carte per bestia
export const BESTIE_LOSE_AT = 4; // con 4 bestie uguali davanti si perde

export type Said = 'VERO' | 'FALSO';

// cronaca delle mosse
export type BestieLog =
  | { k: 'give'; by: string; to: string; claim: Beast }
  | { k: 'pass'; by: string; to: string; claim: Beast } // l'ha guardata e ripassata
  | { k: 'answer'; by: string; said: Said; card: Beast; claim: Beast; right: boolean; taker: string }
  | { k: 'four'; by: string; beast: Beast }
  | { k: 'empty'; by: string }
  | { k: 'left'; by: string }
  | { k: 'discard'; by: string }
  | { k: 'auto'; by: string };

export interface BestieView {
  stage: 'GIVE' | 'RECEIVE' | 'PEEK' | 'REVEAL' | 'END';
  order: string[];
  stageEndsAt: number | null;
  stageMs: number;
  active: string | null; // GIVE: chi passa una carta · RECEIVE/PEEK: chi l'ha in mano adesso
  hands: Record<string, number>; // quante carte in mano (non quali)
  front: Record<string, Partial<Record<Beast, number>>>; // carte scoperte davanti a ognuno, per bestia
  myHand: Beast[]; // le mie carte (solo io le vedo)
  card: Beast | null; // la carta in viaggio: solo per chi l'ha vista (a tutti quando si scopre)
  from: string | null; // chi l'ha passata per ultimo
  claim: Beast | null; // cosa ha dichiarato
  seen: string[]; // chi conosce la carta in viaggio
  candidates: string[]; // a chi si può ancora ripassare (chi non l'ha vista)
  chain: { from: string; to: string; claim: Beast }[]; // i passaggi di questa carta
  reveal: { by: string; said: Said; card: Beast; claim: Beast; right: boolean; taker: string; lost: boolean } | null;
  loser: string | null;
  lostBy: 'QUATTRO' | 'MANO' | null;
  gone: string[]; // usciti dalla stanza
  afk: string[];
  turnNo: number; // carte giocate (per le animazioni)
  discarded: number; // carte avanzate e messe via
  log: BestieLog[];
  logNo: number; // mosse scritte in cronaca dall'inizio (per le animazioni)
  ranking: string[] | null;
  scores: Record<string, number>;
}
