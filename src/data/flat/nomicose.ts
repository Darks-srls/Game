// 📝 Nomi, cose, città: lettere, categorie e quello che vede ogni telefono

// come è andata una risposta: vuota, lettera sbagliata, bocciata dagli altri, uguale a quella di un altro, unica
export type NCStatus = 'vuota' | 'lettera' | 'bocciata' | 'uguale' | 'unica';

export interface NCCategory {
  n: string; // nome della categoria
  e: string; // emoji
}

export interface NCRow {
  by: string;
  text: string;
  status: NCStatus;
  flags: number; // quanti l'hanno bocciata
  flagged: boolean; // l'ho bocciata io
}

// cosa vede ciascun giocatore (le risposte degli altri solo dalla revisione in poi)
export interface NomiCoseView {
  stage: 'DRAW' | 'WRITE' | 'REVIEW' | 'RESULT' | 'END';
  order: string[];
  round: number;
  rounds: number;
  letter: string;
  cats: NCCategory[];
  stageEndsAt: number | null;
  stoppedBy: string | null; // chi ha premuto STOP
  myAnswers: string[] | null; // null per chi guarda senza giocare
  progress: Record<string, number>; // quante categorie ha compilato ciascuno (scrittura)
  rows: NCRow[][]; // per categoria: le risposte di tutti (revisione e risultati)
  judges: number; // quanti possono bocciare una risposta (tutti tranne l'autore)
  done: string[]; // chi ha finito di controllare
  scores: Record<string, number>;
  gained: Record<string, number>; // punti presi in questo round (risultati)
}

export const NC_POINTS: Record<NCStatus, number> = { vuota: 0, lettera: 0, bocciata: 0, uguale: 5, unica: 10 };

// sempre presenti
export const NC_FIXED: NCCategory[] = [
  { n: 'Nome', e: '🙋' },
  { n: 'Cosa', e: '📦' },
  { n: 'Città', e: '🏙️' },
];

// lettere estraibili con il loro peso (niente H, J, K, W, X, Y; Q e Z escono di rado)
export const NC_LETTERS: [string, number][] = [
  ['A', 3], ['B', 3], ['C', 3], ['D', 2], ['E', 2], ['F', 3], ['G', 3], ['I', 2], ['L', 3], ['M', 3],
  ['N', 2], ['O', 2], ['P', 3], ['R', 3], ['S', 3], ['T', 3], ['U', 1], ['V', 3], ['Q', 0.5], ['Z', 0.5],
];

// le altre tre categorie si pescano da qui
export const NC_CATS: NCCategory[] = [
  { n: 'Animale', e: '🐾' },
  { n: 'Frutta o verdura', e: '🍎' },
  { n: 'Mestiere', e: '👷' },
  { n: 'Film o serie TV', e: '🎬' },
  { n: 'Marca', e: '🏷️' },
  { n: 'Personaggio famoso', e: '⭐' },
  { n: 'Parte del corpo', e: '🦵' },
  { n: 'Sport', e: '⚽' },
  { n: 'Cibo o piatto', e: '🍝' },
  { n: 'Nazione', e: '🌍' },
  { n: 'Cantante o band', e: '🎤' },
  { n: 'Oggetto in cucina', e: '🍳' },
  { n: 'Scusa per non andare al lavoro', e: '🤒' },
  { n: 'Colore', e: '🎨' },
  { n: 'Fiume, lago o mare', e: '🌊' },
  { n: 'Fiore o pianta', e: '🌸' },
  { n: 'Vestito o accessorio', e: '👗' },
  { n: 'Strumento musicale', e: '🎸' },
  { n: 'Bevanda', e: '🍹' },
  { n: 'Personaggio dei cartoni', e: '📺' },
  { n: 'Squadra di calcio', e: '🏟️' },
  { n: 'Calciatore o calciatrice', e: '🥅' },
  { n: 'Cosa che trovi in spiaggia', e: '🏖️' },
  { n: 'Cosa da mettere in valigia', e: '🧳' },
  { n: 'Oggetto in bagno', e: '🛁' },
  { n: 'Malattia o malanno', e: '🤧' },
  { n: 'Nome per un cane', e: '🐶' },
  { n: 'Nome per un gatto', e: '🐱' },
  { n: 'Videogioco', e: '🎮' },
  { n: 'Parola inglese', e: '💂' },
  { n: 'Mezzo di trasporto', e: '🚗' },
  { n: 'Dolce', e: '🍰' },
  { n: 'Cosa che fa paura', e: '😱' },
  { n: 'Supereroe o cattivo', e: '🦸' },
  { n: 'Gioco (da tavolo o da cortile)', e: '🎲' },
  { n: 'Verbo', e: '🏃' },
  { n: 'Regalo riciclato', e: '🎁' },
  { n: 'Cosa rotonda', e: '🔴' },
  { n: 'Cosa che puzza', e: '🤢' },
  { n: 'Personaggio storico', e: '📜' },
  { n: 'Marca di auto', e: '🚙' },
  { n: 'App o sito', e: '📱' },
  { n: 'Scusa per arrivare in ritardo', e: '⏰' },
  { n: 'Cosa che trovi al supermercato', e: '🛒' },
  { n: 'Parola che fa ridere', e: '😂' },
  { n: 'Lavoro che non faresti mai', e: '💼' },
  { n: 'Programma TV', e: '📡' },
  { n: 'Formaggio o salume', e: '🧀' },
  { n: 'Cosa da fare in vacanza', e: '🏝️' },
  { n: 'Oggetto da ufficio', e: '🖇️' },
  { n: 'Attore o attrice', e: '🎭' },
  { n: 'Motivo per lasciarsi', e: '💔' },
  { n: 'Cosa che dice la nonna', e: '👵' },
  { n: 'Personaggio delle fiabe', e: '🧚' },
  { n: 'Ingrediente della pizza', e: '🍕' },
  { n: 'Cosa che si trova nello spazio', e: '🪐' },
  { n: 'Cosa da matrimonio', e: '💍' },
  { n: 'Cosa che c’è a scuola', e: '🏫' },
  { n: 'Cosa di Natale', e: '🎄' },
  { n: 'Cosa che si rompe', e: '🔨' },
  { n: 'Titolo di una canzone', e: '🎶' },
  { n: 'Insulto da nonna', e: '🧓' },
  { n: 'Cosa che si fa al mare', e: '🌞' },
  { n: 'Cosa che trovi in un cassetto', e: '🗃️' },
];

// 🌶️ per adulti (solo con i contenuti piccanti)
export const NC_CATS_SPICY: NCCategory[] = [
  { n: 'Cosa che non diresti a un funerale', e: '⚰️' },
  { n: 'Posto dove nasconderesti un cadavere', e: '🔪' },
  { n: 'Parolaccia', e: '🤬' },
  { n: 'Motivo per andare all’inferno', e: '🔥' },
  { n: 'Posto dove l’hai fatto (o lo faresti)', e: '🛏️' },
  { n: 'Cosa che tieni nel comodino', e: '🗄️' },
  { n: 'Scusa dopo una figuraccia a letto', e: '😳' },
  { n: 'Sinonimo di “ubriaco”', e: '🍺' },
  { n: 'Cosa che non vorresti trovare nel letto', e: '🪳' },
  { n: 'Cosa da dire al prete in confessione', e: '🙏' },
  { n: 'Modo stupido di morire', e: '💀' },
  { n: 'Cosa da non dire al primo appuntamento', e: '🍷' },
  { n: 'Nomignolo per le parti intime', e: '🍆' },
  { n: 'Regalo per l’amante', e: '💋' },
  { n: 'Cosa che il Papa fa di nascosto', e: '⛪' },
  { n: 'Frase sulla tua lapide', e: '🪦' },
  { n: 'Posto dove hai vomitato', e: '🤮' },
  { n: 'Fantasia proibita', e: '😈' },
  { n: 'Motivo per divorziare', e: '👰' },
  { n: 'Cosa da fare in bagno (oltre ai bisogni)', e: '🧻' },
  { n: 'Ultime parole prima di morire', e: '🧟' },
  { n: 'Cosa da mettere nella bara', e: '👻' },
  { n: 'Peccato che rifaresti subito', e: '😇' },
  { n: 'Cosa che hai buttato nel water', e: '🚽' },
  { n: 'Malattia imbarazzante', e: '💉' },
  { n: 'Oggetto del sexy shop', e: '🛍️' },
  { n: 'Cosa che fa Gesù nel tempo libero', e: '✝️' },
  { n: 'Cosa che puzza dopo una serata', e: '🥴' },
];
