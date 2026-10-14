// 🌹 Rose e teschi: tipi di quello che vede ogni telefono (niente segreti degli altri)

export type Disc = 'R' | 'S'; // rosa o teschio

export const ROSE_WIN_POINTS = 2; // sfide vinte per vincere la partita

// un posto al tavolo: solo cose che al tavolo vero si vedono (quanti dischi, non quali)
export interface RoseSeat {
  discs: number; // dischi che possiede in tutto (mano + pila)
  hand: number; // dischi ancora in mano
  stack: number; // dischi nella sua pila sul tavolo (girati compresi)
  flipped: Disc[]; // dischi della sua pila già girati, dall'alto
  points: number; // sfide vinte
  out: boolean; // eliminato (o uscito dalla stanza)
  placed: boolean; // posa iniziale: ha già messo il suo disco
  passed: boolean; // asta: ha passato
  afk: boolean; // non risponde: le sue mosse diventano automatiche e veloci
}

// cronaca delle mosse (i nomi li mette la schermata)
export type RoseLog =
  | { k: 'round'; n: number; by: string }
  | { k: 'add'; by: string }
  | { k: 'challenge'; by: string; n: number }
  | { k: 'raise'; by: string; n: number }
  | { k: 'pass'; by: string }
  | { k: 'flip'; by: string; of: string; disc: Disc }
  | { k: 'win'; by: string; points: number }
  | { k: 'skull'; by: string; of: string }
  | { k: 'lose'; by: string; left: number }
  | { k: 'out'; by: string }
  | { k: 'left'; by: string }
  | { k: 'void'; by: string }
  | { k: 'auto'; by: string };

export interface RoseResult {
  kind: 'WIN' | 'SKULL' | 'VOID'; // sfida vinta, teschio trovato, round annullato (chi sfidava è uscito)
  flipper: string;
  of: string | null; // di chi era il teschio
  out: boolean; // chi sfidava è rimasto senza dischi
  points: number; // punti di chi sfidava dopo la sfida
}

export interface RoseView {
  stage: 'PLACE' | 'PLAY' | 'BID' | 'FLIP' | 'RESULT' | 'END';
  order: string[];
  round: number;
  starter: string;
  stageEndsAt: number | null;
  stageMs: number; // durata della fase in corso (per l'anello del tempo)
  turn: string | null; // chi deve agire adesso (gioco, asta, scelta della pila)
  seats: Record<string, RoseSeat>;
  total: number; // dischi sul tavolo
  bid: { by: string; n: number } | null; // offerta più alta
  bids: { by: string; n: number }[]; // asta di questo round
  flipper: string | null;
  flippedTotal: number; // dischi già girati nella sfida
  choosing: boolean; // chi sfida deve scegliere da quale pila girare
  result: RoseResult | null;
  me: { hand: Disc[]; stack: Disc[]; lost: Disc | null } | null; // null per chi guarda e basta
  log: RoseLog[];
  logNo: number; // mosse scritte in cronaca dall'inizio (per le animazioni)
  winner: string | null;
  ranking: string[] | null; // a fine partita
  scores: Record<string, number>;
}
