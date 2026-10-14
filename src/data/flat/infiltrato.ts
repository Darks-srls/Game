// 🎩 L'infiltrato: le parole segrete (cose concrete da indovinare con domande sì/no) e quello che vede ogni telefono

export type InfRole = 'MAESTRO' | 'INFILTRATO' | 'CITTADINO';
export type InfAnswer = 'SI' | 'NO' | 'FORSE' | 'QUASI';
export type InfOutcome = 'FOUND' | 'ESCAPED' | 'TIMEOUT';

export const INF_ANSWERS: Record<InfAnswer, { label: string; emoji: string; bg: string }> = {
  SI: { label: 'SÌ', emoji: '👍', bg: 'from-emerald-400 to-teal-600' },
  NO: { label: 'NO', emoji: '👎', bg: 'from-rose-500 to-red-700' },
  FORSE: { label: 'NON SO', emoji: '🤷', bg: 'from-slate-400 to-slate-600' },
  QUASI: { label: 'CI SEI QUASI!', emoji: '🔥', bg: 'from-amber-300 to-orange-500' },
};

export interface InfRoundLog {
  word: string;
  maestro: string;
  infiltrato: string;
  outcome: InfOutcome;
  guessedBy: string | null;
}

// cosa vede ciascun giocatore: la parola solo il Maestro e l'Infiltrato (tutti dopo che è stata indovinata)
export interface InfiltratoView {
  stage: 'ROLE' | 'ASK' | 'VOTE' | 'REVEAL' | 'END';
  order: string[];
  names: Record<string, string>;
  round: number; // da 1
  rounds: number;
  stageEndsAt: number | null;
  stageMs: number;
  maestro: string; // il Maestro è pubblico
  myRole: InfRole | null; // null = guarda senza giocare
  word: string | null;
  choices: string[] | null; // solo il Maestro, mentre sceglie
  wordChosen: boolean;
  ready: string[];
  answers: InfAnswer[]; // le ultime risposte del Maestro (la più recente in fondo)
  answerNo: number; // quante risposte in tutto
  counts: Record<InfAnswer, number>;
  guessedBy: string | null;
  voted: string[]; // chi ha votato (non chi)
  myVote: string | null;
  votes: Record<string, string> | null; // svelati alla fine del round
  infiltrato: string | null; // svelato alla fine del round (o a lui stesso)
  accused: string | null;
  outcome: InfOutcome | null;
  gained: Record<string, number>;
  history: InfRoundLog[];
  scores: Record<string, number>;
}

export const INF_WORDS = [
  // animali
  'gatto', 'cane', 'cavallo', 'mucca', 'maiale', 'pecora', 'capra', 'coniglio', 'criceto', 'pappagallo', 'gallina', 'papera', 'tacchino',
  'leone', 'tigre', 'elefante', 'giraffa', 'zebra', 'ippopotamo', 'rinoceronte', 'coccodrillo', 'serpente', 'tartaruga', 'rana', 'lumaca',
  'ape', 'zanzara', 'formica', 'ragno', 'farfalla', 'pipistrello', 'gufo', 'aquila', 'pinguino', 'delfino', 'squalo', 'balena', 'polpo',
  'medusa', 'granchio', 'canguro', 'koala', 'panda', 'scimmia', 'orso', 'lupo', 'volpe', 'cammello', 'struzzo', 'fenicottero', 'scoiattolo',
  'riccio', 'talpa', 'topo', 'piccione', 'cigno', 'dinosauro', 'unicorno',
  // cibo e bevande
  'pizza', 'lasagna', 'spaghetti', 'tiramisù', 'gelato', 'panettone', 'cornetto', 'cappuccino', 'mozzarella', 'parmigiano', 'prosciutto',
  'mortadella', 'arancino', 'cannolo', 'nutella', 'cioccolato', 'popcorn', 'hamburger', 'patatine fritte', 'sushi', 'kebab', 'uovo', 'banana',
  'anguria', 'ananas', 'fragola', 'limone', 'cipolla', 'aglio', 'peperoncino', 'carota', 'pomodoro', 'melanzana', 'zucca', 'fungo',
  'noce di cocco', 'miele', 'pane', 'biscotto', 'torta', 'caramella', 'chewing gum', 'olio', 'ketchup', 'birra', 'vino', 'spritz', 'caffè',
  // casa e oggetti
  'frigorifero', 'lavatrice', 'forno', 'microonde', 'divano', 'letto', 'cuscino', 'sveglia', 'specchio', 'lampadina', 'candela', 'ombrello',
  'chiave', 'forbici', 'martello', 'cacciavite', 'scopa', 'aspirapolvere', 'ferro da stiro', 'spazzolino', 'dentifricio', 'asciugamano',
  'sapone', 'phon', 'rubinetto', 'vasca da bagno', 'tappeto', 'televisione', 'telecomando', 'telefono', 'computer', 'tastiera', 'cuffie',
  'macchina fotografica', 'orologio', 'occhiali', 'portafoglio', 'zaino', 'valigia', 'bicicletta', 'monopattino', 'skateboard', 'pallone',
  'racchetta', 'chitarra', 'pianoforte', 'batteria', 'violino', 'tromba', 'microfono', 'libro', 'quaderno', 'matita', 'gomma', 'colla',
  'calcolatrice', 'mappamondo', 'sedia', 'tavolo', 'scala', 'cassaforte', 'lucchetto', 'pentola', 'padella', 'forchetta', 'cucchiaio',
  'coltello', 'tazza', 'bottiglia', 'cavatappi', 'frullatore', 'moka', 'tostapane', 'pigiama', 'ciabatte', 'cravatta', 'sciarpa', 'guanti',
  'stivali', 'cappello', 'costume da bagno', 'parrucca',
  // luoghi
  'spiaggia', 'montagna', 'vulcano', 'deserto', 'foresta', 'isola', 'grotta', 'cascata', 'lago', 'fiume', 'ospedale', 'scuola', 'chiesa',
  'castello', 'museo', 'cinema', 'teatro', 'discoteca', 'palestra', 'piscina', 'stadio', 'aeroporto', 'stazione', 'supermercato', 'farmacia',
  'biblioteca', 'prigione', 'zoo', 'circo', 'luna park', 'campeggio', 'faro', 'ponte', 'grattacielo', 'Colosseo', 'Torre di Pisa', 'Venezia',
  'Polo Nord', 'Luna',
  // mezzi
  'aereo', 'elicottero', 'treno', 'metropolitana', 'autobus', 'taxi', 'ambulanza', 'camion', 'trattore', 'nave', 'sottomarino', 'gommone',
  'razzo', 'mongolfiera', 'Ferrari', 'Vespa', 'carrozza',
  // persone e personaggi
  'pompiere', 'poliziotto', 'dentista', 'cuoco', 'pizzaiolo', 'idraulico', 'parrucchiere', 'astronauta', 'pirata', 'ninja', 'cowboy', 'mago',
  'strega', 'vampiro', 'fantasma', 'zombie', 'robot', 'supereroe', 'Babbo Natale', 'Befana', 'regina', 'principessa', 'cavaliere', 'clown',
  'postino', 'bagnino', 'pescatore', 'arbitro', 'Pinocchio', 'Superman', 'Topolino',
  // natura e cose varie
  'sole', 'stella', 'arcobaleno', 'fulmine', 'neve', 'pupazzo di neve', 'nuvola', 'tornado', 'fuoco', 'ghiaccio', 'sabbia', 'conchiglia',
  'girasole', 'rosa', 'cactus', 'albero di Natale', 'tatuaggio', 'regalo', 'palloncino', 'fuochi d’artificio', 'bandiera', 'corona', 'spada',
  'tesoro', 'mappa', 'bussola', 'aquilone', 'altalena', 'scivolo', 'puzzle', 'cubo di Rubik', 'dado', 'carte da gioco', 'scacchi',
  'biglietto della lotteria', 'banconota', 'salvadanaio', 'carta di credito', 'francobollo', 'Lego', 'Barbie', 'videogioco', 'joystick',
  'semaforo', 'ascensore', 'tenda', 'sacco a pelo', 'torcia', 'pistola ad acqua', 'trampolino', 'paracadute',
];

// 🌶️ per adulti (solo con i contenuti piccanti): sesso, schifezze, morte, santi e famosi
export const INF_WORDS_SPICY = [
  // sotto le lenzuola
  'preservativo', 'vibratore', 'manette', 'frusta', 'perizoma', 'reggiseno', 'tanga', 'lingerie', 'spogliarellista', 'pornostar', 'sexy shop',
  'bambola gonfiabile', 'Kamasutra', 'sveltina', 'orgia', 'motel', 'viagra', 'pillola del giorno dopo', 'test di gravidanza', 'lap dance',
  'OnlyFans', 'succhiotto', 'tette', 'chiappe', 'pisello', 'ginecologo', 'proctologo', 'calze a rete', 'lubrificante', 'addio al celibato',
  // schifezze
  'cacca', 'pipì', 'vomito', 'scoreggia', 'rutto', 'moccolo', 'brufolo', 'forfora', 'pidocchi', 'piattole', 'emorroidi', 'supposta', 'clistere',
  'pannolone', 'dentiera', 'alito pesante', 'ascella sudata', 'cerume', 'unghia incarnita', 'carta igienica', 'sturalavandini', 'bagno chimico',
  'assorbente', 'diarrea', 'colonscopia', 'parrucchino',
  // alcol
  'sbronza', 'grappa', 'tequila', 'canna', 'etilometro', 'postumi',
  // morte e humor nero
  'bara', 'funerale', 'carro funebre', 'cimitero', 'cremazione', 'urna cineraria', 'becchino', 'testamento', 'autopsia', 'obitorio', 'necrologio',
  'lapide', 'sedia elettrica', 'ghigliottina', 'vedova allegra',
  // cielo e dintorni
  'Gesù', 'Madonna', 'Papa', 'Padre Pio', 'San Gennaro', 'San Pietro', 'Giuda', 'Mosè', 'Noè', 'Adamo ed Eva', 'Satana', 'inferno', 'paradiso',
  'purgatorio', 'esorcista', 'ostia', 'acqua santa', 'confessionale', 'crocifisso', 'suora', 'prete', 'frate', 'Ultima Cena', 'miracolo',
  'stigmate', 'aureola', 'rosario', 'papamobile', 'angelo custode', 'Re Magi',
  // famosi
  'Berlusconi', 'Chiara Ferragni', 'Fedez', 'Elon Musk', 'Donald Trump', 'Maria De Filippi', 'Barbara D’Urso', 'Fabrizio Corona', 'Belén',
  'Rocco Siffredi', 'Cicciolina', 'Vasco Rossi', 'Al Bano', 'Gerry Scotti', 'Valentino Rossi', 'Francesco Totti', 'Vittorio Sgarbi',
  'Sfera Ebbasta', 'Kim Kardashian', 'Cristiano Ronaldo',
];
