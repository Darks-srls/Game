// ☝️ Una parola sola: le parole da indovinare e quello che vede ogni telefono

// cosa vede ciascun giocatore (niente segreti degli altri: chi indovina non vede la parola)
export interface ParolaUnicaView {
  stage: 'CLUE' | 'CHECK' | 'GUESS' | 'RESULT' | 'END';
  order: string[];
  guesser: string;
  cardNo: number; // carta in gioco (da 1)
  cards: number; // carte totali (le sbagliate ne bruciano una in più)
  left: number; // carte ancora nel mazzo
  word: string | null; // null per chi indovina (fino al risultato)
  stageEndsAt: number | null;
  written: string[]; // chi ha già scritto il suo indizio
  myClue: string | null;
  // indizi: per chi li scrive tutti (dal controllo in poi); per chi indovina solo quelli validi (dall'indovinare)
  clues: { by: string; text: string | null; cancelled: boolean; why: 'uguale' | 'vietato' | 'bocciato' | null; flags: number }[];
  myFlags: string[]; // indizi che ho segnalato come non validi
  okBy: string[]; // chi ha finito di controllare
  guess: string | null;
  result: 'OK' | 'KO' | 'PASS' | null;
  score: number; // parole indovinate
  history: { word: string; guesser: string; result: 'OK' | 'KO' | 'PASS'; guess: string | null }[];
}

export const PU_WORDS = [
  'casa', 'mare', 'sole', 'luna', 'pizza', 'gatto', 'cane', 'treno', 'aereo', 'libro', 'chitarra', 'pianoforte', 'montagna', 'neve',
  'spiaggia', 'ombrello', 'telefono', 'computer', 'scuola', 'ospedale', 'cuoco', 'pompiere', 'ladro', 'pirata', 'drago', 'castello',
  'principessa', 'regina', 'fantasma', 'vampiro', 'zombie', 'robot', 'astronauta', 'razzo', 'pianeta', 'stella', 'cometa', 'vulcano',
  'deserto', 'cammello', 'giraffa', 'elefante', 'leone', 'tigre', 'scimmia', 'pinguino', 'delfino', 'squalo', 'balena', 'polpo',
  'granchio', 'farfalla', 'ape', 'ragno', 'formica', 'serpente', 'coccodrillo', 'dinosauro', 'uovo', 'gallina', 'mucca', 'maiale',
  'cavallo', 'unicorno', 'arcobaleno', 'pioggia', 'fulmine', 'vento', 'nuvola', 'ghiaccio', 'fuoco', 'candela', 'lampadina', 'specchio',
  'finestra', 'chiave', 'tesoro', 'mappa', 'bussola', 'nave', 'sottomarino', 'isola', 'faro', 'bicicletta', 'moto', 'camion',
  'autobus', 'semaforo', 'ponte', 'aeroporto', 'valigia', 'passaporto', 'vacanza', 'albergo', 'piscina', 'palestra', 'calcio', 'arbitro',
  'rigore', 'tennis', 'sci', 'medaglia', 'coppa', 'olimpiadi', 'maratona', 'discoteca', 'concerto', 'microfono', 'radio', 'televisione',
  'cinema', 'popcorn', 'teatro', 'attore', 'fotografia', 'pittore', 'museo', 'statua', 'colosseo', 'gondola', 'pasta', 'lasagna',
  'risotto', 'gelato', 'cioccolato', 'torta', 'compleanno', 'regalo', 'palloncino', 'natale', 'presepe', 'befana', 'carnevale', 'maschera',
  'pasqua', 'panettone', 'caffè', 'cappuccino', 'cornetto', 'cameriere', 'ristorante', 'forchetta', 'cucchiaio', 'bicchiere', 'bottiglia',
  'vino', 'formaggio', 'mozzarella', 'pomodoro', 'basilico', 'aglio', 'cipolla', 'patata', 'carota', 'banana', 'mela', 'fragola',
  'anguria', 'limone', 'arancia', 'ciliegia', 'nonna', 'matrimonio', 'anello', 'bacio', 'cuore', 'segreto', 'bugia', 'sogno', 'incubo',
  'cuscino', 'pigiama', 'sveglia', 'orologio', 'calendario', 'matematica', 'professore', 'esame', 'ufficio', 'stipendio', 'banca',
  'portafoglio', 'penna', 'zaino', 'giardino', 'fiore', 'girasole', 'cactus', 'bosco', 'lupo', 'orso', 'volpe', 'gufo', 'pipistrello',
  'lumaca', 'rana', 'tartaruga', 'conchiglia', 'sirena', 'mago', 'strega', 'scopa', 'bacchetta', 'cappello', 'occhiali', 'sciarpa',
  'guanti', 'stivali', 'cravatta', 'zaino', 'tenda', 'campeggio', 'falò', 'marshmallow', 'barbecue', 'salsiccia', 'hamburger', 'sushi',
  'kebab', 'frigorifero', 'lavatrice', 'aspirapolvere', 'divano', 'telecomando', 'videogioco', 'joystick', 'internet', 'password', 'selfie',
  'influencer', 'emoji', 'podcast', 'supereroe', 'mantello', 'spada', 'scudo', 'cavaliere', 'armatura', 'cannone', 'bomba', 'detective',
  'impronta', 'carcere', 'giudice', 'avvocato', 'elezioni', 'sindaco', 'bandiera', 'inno', 'circo', 'clown', 'giocoliere', 'trapezio',
  'giostra', 'zucchero', 'sale', 'pepe', 'miele', 'marmellata', 'nutella', 'biscotto', 'colazione', 'merenda', 'cena', 'dieta',
];

// 🌶️ per adulti (solo con i contenuti piccanti)
export const PU_WORDS_SPICY = [
  'mutande', 'reggiseno', 'perizoma', 'preservativo', 'succhiotto', 'sbronza', 'postumi', 'tinder', 'corna', 'amante', 'motel',
  'spogliarello', 'manette', 'frusta', 'nudista', 'rutto', 'scoreggia', 'vibratore', 'lingerie', 'limonare', 'sveltina', 'preliminari',
  'orgasmo', 'ciucciotto', 'ascella', 'depilazione', 'ceretta', 'sexy', 'ubriaco', 'karaoke', 'addio al celibato', 'ex', 'gelosia',
  'tradimento', 'suocera', 'bidet', 'lassativo', 'emorroidi', 'parrucchino', 'toupet', 'viagra', 'massaggio', 'jacuzzi', 'nudo',
  'pettorali', 'tanga', 'chiappe', 'tette', 'scollatura', 'calze a rete', 'cubista', 'buttafuori', 'vomito', 'mojito', 'tequila',
  'shottino', 'hangover', 'walk of shame', 'ghosting', 'sexting', 'scappatella', 'motorino', 'divorzio',
];
