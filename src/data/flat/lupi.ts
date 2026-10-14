// 🐺 Lupi mannari: i ruoli e quello che vede ogni telefono

export type LupiRole = 'LUPO' | 'VEGGENTE' | 'MEDICO' | 'CONTADINO';
export type LupiTeam = 'LUPI' | 'VILLAGGIO';

export const LUPI_ROLES: Record<LupiRole, { name: string; emoji: string; team: LupiTeam; goal: string; article: string }> = {
  LUPO: {
    name: 'Lupo mannaro',
    emoji: '🐺',
    team: 'LUPI',
    article: 'un',
    goal: 'Di notte sbrana un abitante insieme al branco. Di giorno fai l’innocente e accusa gli altri.',
  },
  VEGGENTE: {
    name: 'Veggente',
    emoji: '🔮',
    team: 'VILLAGGIO',
    article: 'la',
    goal: 'Ogni notte scopri il ruolo di un giocatore. Guida il villaggio… senza farti sbranare.',
  },
  MEDICO: {
    name: 'Medico',
    emoji: '💉',
    team: 'VILLAGGIO',
    article: 'il',
    goal: 'Ogni notte proteggi un altro giocatore: se i lupi attaccano lui, si salva. Mai lo stesso due notti di fila.',
  },
  CONTADINO: {
    name: 'Contadino',
    emoji: '🌾',
    team: 'VILLAGGIO',
    article: 'un',
    goal: 'Niente poteri, solo fiuto: ascolta, smaschera i lupi e votali di giorno.',
  },
};

// cronaca pubblica della partita
export interface LupiLogEntry {
  kind: 'NIGHT' | 'DAY' | 'LEFT';
  n: number; // notte o giorno
  id: string | null; // morto, eliminato o uscito (null = nessuno)
  role: LupiRole | null;
  votes?: number; // voti presi dall'eliminato
  tie?: boolean; // pareggio al voto
}

// cosa è successo davvero di notte (si svela ai morti e a fine partita)
export interface LupiNightSecret {
  n: number;
  wolves: string | null; // chi hanno attaccato i lupi
  random: boolean; // i lupi non hanno scelto: vittima a caso
  seer: string | null;
  medic: string | null;
  saved: boolean;
  suspects: Record<string, string>; // contadino → sospettato
}

// resoconto della MIA notte (solo per me)
export interface LupiMyNight {
  role: LupiRole;
  target: string | null;
  found?: LupiRole; // veggente: il ruolo scoperto
  killed?: string | null; // lupi: chi è stato attaccato davvero
  saved?: boolean;
}

// cosa vede ciascun giocatore (mai i ruoli segreti degli altri, tranne ai morti e a fine partita)
export interface LupiView {
  stage: 'ROLE' | 'NIGHT' | 'DAWN' | 'DAY' | 'VOTE' | 'VERDICT' | 'END';
  order: string[];
  names: Record<string, string>; // nomi salvati all'inizio (per chi esce a metà)
  n: number; // notte/giorno in corso (da 1)
  stageEndsAt: number | null;
  stageMs: number;
  alive: string[];
  counts: Partial<Record<LupiRole, number>>; // composizione pubblica (quanti lupi, veggente…)
  myRole: LupiRole | null; // null = guarda senza giocare
  roles: Record<string, LupiRole>; // ruoli che conosco: il mio, il branco, i morti, le visioni; tutti ai morti e alla fine
  ready: string[]; // carta vista / pronti a votare
  // notte: scelgono TUTTI i vivi
  targets: string[]; // chi posso toccare
  myPick: string | null;
  done: string[]; // chi ha confermato la sua scelta
  pack: Record<string, string | null> | null; // lupi: le scelte del branco (i morti vedono tutte le scelte)
  blocked: string | null; // medico: chi ha protetto la notte prima
  // alba
  victim: string | null;
  myNight: LupiMyNight | null;
  visions: { n: number; id: string; role: LupiRole }[]; // veggente
  // voto (pubblico)
  votes: Record<string, string>;
  closing: boolean; // hanno votato tutti: si chiude tra pochi secondi
  out: string | null;
  tie: boolean;
  winner: LupiTeam | null;
  log: LupiLogEntry[];
  secrets: LupiNightSecret[] | null; // ai morti e a fine partita
  scores: Record<string, number>;
}
