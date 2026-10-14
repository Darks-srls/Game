// 🗝️ Nomi in codice: le parole del tabellone e quello che vede ogni telefono

// colore di una carta: rossi, blu, neutra (passante) o assassino
export type CodiciColor = 'R' | 'B' | 'N' | 'X';

export interface CodiciCard {
  word: string;
  color: CodiciColor | null; // null = coperta e tu non sai di chi è (i capitani la vedono sempre)
  open: boolean; // scoperta
  picks: string[]; // compagni che la stanno indicando (si vede la loro faccina)
}

// cosa vede ciascun giocatore: i colori delle carte coperte solo i capitani
export interface CodiciView {
  stage: 'INTRO' | 'CLUE' | 'GUESS' | 'END';
  order: string[];
  teams: Record<string, 0 | 1>; // 0 = rossi, 1 = blu
  captains: [string, string];
  myTeam: 0 | 1 | null; // null = guarda e basta
  amCaptain: boolean;
  starter: 0 | 1; // chi inizia ha 9 parole, gli altri 8
  turn: 0 | 1; // squadra di turno
  turnNo: number;
  stageEndsAt: number | null;
  cards: CodiciCard[];
  left: [number, number]; // parole ancora da scoprire per rossi e blu
  clue: { word: string; n: number } | null; // n da 0 a 9, -1 = ∞
  guesses: number; // carte scoperte in questo turno
  maxGuesses: number | null; // null = senza limite (indizio 0 o ∞)
  ready: string[];
  last: { i: number; by: string; no: number } | null; // ultima carta scoperta (per animazione e suono)
  log: { team: 0 | 1; word: string; n: number; hits: CodiciColor[] }[];
  winner: 0 | 1 | null;
  endReason: 'tutte' | 'assassino' | 'ferma' | 'ritiro' | null;
  scores: Record<string, number>;
}

// per confrontare l'indizio con le parole del tabellone: minuscole, senza accenti né spazi
export const codiciNorm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');

// radice di una parola: senza vocale finale (gatto/gatti/gatta, arancia/arance, banco/banchi)
function stem(w: string): string {
  let s = w.replace(/[aeiou]$/, '');
  if (s.length >= 4 && s.endsWith('i')) s = s.slice(0, -1);
  if (/[cg]h$/.test(s)) s = s.slice(0, -1);
  return s;
}

// stessa parola, plurale/femminile o parola composta (sole/girasole, porta/portafoglio): vietato come indizio,
// e due parole così non finiscono sullo stesso tabellone
export function codiciClash(a: string, b: string): boolean {
  const x = codiciNorm(a);
  const y = codiciNorm(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const sx = stem(x);
  if (sx.length >= 3 && sx === stem(y)) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.length >= 4 && (long.startsWith(short) || long.endsWith(short));
}

// sostantivi concreti e astratti, tanti con più significati (è lì che il capitano si diverte)
export const CODICI_WORDS = [
  // doppi sensi
  'pianta', 'rete', 'carta', 'banco', 'chiave', 'lingua', 'collo', 'pesca', 'riso', 'lama', 'mora', 'porto', 'stella', 'tempo', 'vite',
  'corno', 'campo', 'spina', 'cassa', 'nota', 'radice', 'ala', 'piano', 'pila', 'palla', 'punto', 'rosa', 'colpo', 'testa', 'fondo',
  'canna', 'capo', 'cella', 'corrente', 'credito', 'cresta', 'dama', 'disco', 'fiamma', 'foglio', 'gomma', 'granata', 'lente', 'lettera',
  'linea', 'marcia', 'miniera', 'onda', 'ordine', 'pagina', 'pedina', 'polo', 'ponte', 'porta', 'posta', 'ramo', 'riga', 'ruota',
  'salto', 'scala', 'segno', 'spirito', 'stampa', 'tavola', 'terra', 'torre', 'tromba', 'tubo', 'vela', 'volo', 'gru', 'mouse', 'botte',
  'busta', 'mosca', 'coda', 'conto', 'mina', 'ciglio', 'fascia', 'palma', 'tasso', 'riccio', 'lira', 'miglio', 'franco', 'tappo', 'manica',
  'tasto', 'capitale', 'borsa', 'lancia', 'arco', 'piatto', 'pallone', 'mano', 'pugno', 'calcio', 'rigore', 'fallo', 'voto', 'quadro',
  'opera', 'galleria', 'margherita', 'vespa', 'scorpione', 'toro', 'radio', 'virus', 'codice', 'credenza', 'pupilla', 'cavalletto',
  'stazione', 'pressione', 'chiodo', 'bacchetta', 'cartella', 'cuffia', 'grillo', 'fronte', 'giro', 'sorte', 'nodo', 'cozza',
  'uccello', 'pisello', 'cetriolo', 'patata', 'mazza', 'cappello', 'cappotto', 'ferro', 'lampo', 'rombo', 'cerchio', 'stelo',
  // persone e personaggi
  'pirata', 'ninja', 'cowboy', 'samurai', 'cavaliere', 'principe', 'regina', 'spia', 'detective', 'ladro', 'giudice', 'avvocato', 'medico',
  'cuoco', 'pompiere', 'astronauta', 'pilota', 'marinaio', 'soldato', 'generale', 'capitano', 'professore', 'scienziato', 'pittore',
  'poeta', 'cantante', 'ballerina', 'attore', 'regista', 'clown', 'acrobata', 'contadino', 'pescatore', 'cacciatore', 'banchiere', 'mago',
  'strega', 'fata', 'gigante', 'nano', 'orco', 'drago', 'unicorno', 'fantasma', 'vampiro', 'mummia', 'zombie', 'angelo', 'diavolo',
  'genio', 'robot', 'alieno', 'sirena', 'centauro', 'ciclope', 'nonna', 'suocero', 'gemello', 'vicino', 'turista', 'vigile', 'postino',
  'Pinocchio', 'Dracula', 'Zorro', 'Befana',
  // luoghi
  'Roma', 'Venezia', 'Napoli', 'Parigi', 'Londra', 'Atlantide', 'Olimpo', 'deserto', 'giungla', 'foresta', 'bosco', 'prato', 'collina',
  'montagna', 'valle', 'grotta', 'isola', 'spiaggia', 'scoglio', 'lago', 'fiume', 'cascata', 'oceano', 'palude', 'ghiacciaio', 'cratere',
  'vulcano', 'castello', 'palazzo', 'prigione', 'banca', 'mercato', 'negozio', 'bar', 'ristorante', 'albergo', 'campeggio', 'circo', 'zoo',
  'fattoria', 'stalla', 'mulino', 'fabbrica', 'laboratorio', 'ufficio', 'aeroporto', 'autostrada', 'piazza', 'fontana', 'piramide',
  'tempio', 'labirinto', 'pozzo', 'chiesa', 'ospedale', 'farmacia', 'scuola', 'biblioteca', 'museo', 'teatro', 'cinema', 'stadio', 'arena',
  'palestra', 'piscina', 'giardino', 'cantina', 'soffitta', 'cucina', 'bagno', 'ascensore', 'corridoio', 'tetto', 'camino', 'cancello',
  'muro', 'finestra', 'frontiera', 'dogana', 'faro', 'molo', 'luna',
  // oggetti
  'ago', 'anello', 'freccia', 'arpa', 'tamburo', 'violino', 'chitarra', 'flauto', 'campana', 'sveglia', 'orologio', 'bussola', 'mappa',
  'telescopio', 'microscopio', 'binocolo', 'lampada', 'candela', 'lanterna', 'torcia', 'ombrello', 'corona', 'maschera', 'guanto',
  'scarpa', 'stivale', 'calza', 'cintura', 'cravatta', 'bottone', 'zaino', 'valigia', 'portafoglio', 'moneta', 'diamante', 'perla', 'oro',
  'argento', 'rame', 'piombo', 'carbone', 'petrolio', 'plastica', 'legno', 'mattone', 'sabbia', 'fango', 'specchio', 'trono', 'tesoro',
  'forziere', 'secchio', 'barile', 'bottiglia', 'bicchiere', 'tazza', 'forchetta', 'coltello', 'cucchiaio', 'pentola', 'padella', 'forno',
  'frigorifero', 'lavatrice', 'scopa', 'spugna', 'sapone', 'spazzola', 'pettine', 'rasoio', 'forbici', 'colla', 'nastro', 'filo', 'corda',
  'catena', 'lucchetto', 'martello', 'cacciavite', 'trapano', 'sega', 'pala', 'piccone', 'ascia', 'falce', 'rastrello', 'vaso', 'telefono',
  'computer', 'antenna', 'schermo', 'batteria', 'cavo', 'presa', 'lampadina', 'motore', 'freno', 'volante', 'dado', 'puzzle', 'bambola',
  'aquilone', 'altalena', 'scivolo', 'giostra', 'trottola', 'pistola', 'cannone', 'bomba', 'spada', 'scudo', 'elmo', 'armatura', 'siringa',
  'cerotto', 'termometro', 'stampella', 'occhiali', 'pennello', 'matita', 'gesso', 'lavagna', 'libro', 'giornale', 'fumetto', 'cornice',
  'tenda', 'tappeto', 'cuscino', 'coperta', 'materasso', 'divano', 'poltrona', 'sedia', 'culla', 'bara', 'pandoro',
  // mezzi di trasporto e spazio
  'treno', 'binario', 'tram', 'metro', 'autobus', 'taxi', 'camion', 'trattore', 'bicicletta', 'moto', 'elicottero', 'aereo', 'nave',
  'barca', 'sottomarino', 'zattera', 'canoa', 'ancora', 'razzo', 'astronave', 'pianeta', 'cometa', 'satellite', 'galassia', 'sole',
  'eclissi', 'meteorite',
  // natura e meteo
  'neve', 'ghiaccio', 'nebbia', 'fulmine', 'tuono', 'pioggia', 'grandine', 'arcobaleno', 'tornado', 'uragano', 'terremoto', 'vento',
  'fuoco', 'fumo', 'cenere', 'seme', 'foglia', 'fiore', 'tronco', 'quercia', 'pino', 'cactus', 'fungo', 'erba', 'girasole', 'tulipano',
  'ulivo', 'conchiglia', 'alga', 'corallo',
  // cibo
  'uva', 'arancia', 'limone', 'banana', 'fragola', 'ciliegia', 'pera', 'mela', 'anguria', 'cocco', 'ananas', 'noce', 'castagna',
  'pomodoro', 'carota', 'cipolla', 'aglio', 'peperoncino', 'zucca', 'melanzana', 'fagiolo', 'grano', 'pane', 'pizza', 'pasta', 'lasagna',
  'gnocco', 'polpetta', 'salame', 'prosciutto', 'mortadella', 'formaggio', 'mozzarella', 'burro', 'latte', 'miele', 'zucchero',
  'cioccolato', 'gelato', 'torta', 'biscotto', 'caramella', 'panettone', 'cornetto', 'caffè', 'vino', 'birra', 'brodo', 'olio', 'aceto',
  'pepe', 'sale', 'uovo', 'popcorn', 'hamburger', 'sushi',
  // animali
  'leone', 'tigre', 'elefante', 'giraffa', 'zebra', 'cammello', 'canguro', 'koala', 'panda', 'orso', 'volpe', 'lupo', 'cervo',
  'cinghiale', 'coniglio', 'scoiattolo', 'talpa', 'castoro', 'pipistrello', 'gufo', 'pappagallo', 'pinguino', 'struzzo', 'pavone',
  'cigno', 'oca', 'gallo', 'gallina', 'pulcino', 'tacchino', 'piccione', 'aquila', 'corvo', 'delfino', 'balena', 'squalo', 'polpo',
  'medusa', 'tartaruga', 'coccodrillo', 'lucertola', 'rana', 'lumaca', 'ape', 'farfalla', 'zanzara', 'formica', 'ragno', 'pidocchio',
  'pulce', 'verme', 'mucca', 'pecora', 'capra', 'maiale', 'asino', 'cavallo', 'cane', 'gatto', 'topo', 'scimmia', 'gorilla',
  'ippopotamo', 'dinosauro', 'mammut', 'foca', 'granchio', 'serpente', 'pesce',
  // corpo
  'occhio', 'naso', 'bocca', 'dente', 'orecchio', 'braccio', 'dito', 'unghia', 'ginocchio', 'piede', 'tallone', 'schiena', 'pancia',
  'cervello', 'sangue', 'osso', 'scheletro', 'pelle', 'capello', 'barba', 'baffo', 'cuore',
  // astratti, feste e tempo
  'amore', 'odio', 'paura', 'gioia', 'rabbia', 'noia', 'invidia', 'gelosia', 'vergogna', 'orgoglio', 'fortuna', 'destino', 'sogno',
  'incubo', 'ricordo', 'segreto', 'bugia', 'verità', 'giustizia', 'libertà', 'pace', 'guerra', 'vittoria', 'potere', 'gloria', 'fama',
  'silenzio', 'rumore', 'eco', 'ombra', 'buio', 'luce', 'magia', 'miracolo', 'mistero', 'enigma', 'avventura', 'viaggio', 'vacanza',
  'festa', 'compleanno', 'matrimonio', 'funerale', 'esame', 'lezione', 'gara', 'sfida', 'duello', 'scommessa', 'premio', 'medaglia',
  'trofeo', 'record', 'tennis', 'golf', 'boxe', 'scacchi', 'gioco', 'alba', 'tramonto', 'notte', 'mezzanotte', 'estate', 'inverno',
  'primavera', 'autunno', 'secolo', 'minuto', 'lunedì', 'Natale', 'Pasqua', 'Carnevale', 'Capodanno', 'Ferragosto',
  // cultura e tecnologia
  'film', 'romanzo', 'rivista', 'canzone', 'concerto', 'foto', 'video', 'selfie', 'internet', 'password', 'sms', 'emoji', 'mostro',
  'bacio', 'abbraccio', 'carezza', 'schiaffo', 'sorriso', 'lacrima', 'occhiolino', 'tatuaggio', 'parrucca', 'trucco', 'profumo',
];

// 🌶️ per adulti: sporche, humor nero, sacro e profano (solo con i contenuti piccanti)
export const CODICI_WORDS_SPICY = [
  'preservativo', 'vibratore', 'perizoma', 'mutande', 'reggiseno', 'tette', 'chiappe', 'culo', 'passera', 'fava', 'topa', 'gnocca',
  'pacco', 'arnese', 'manganello', 'pompa', 'orgasmo', 'sveltina', 'orgia', 'scambisti', 'amante', 'corna', 'cornuto', 'manette',
  'frusta', 'lingerie', 'spogliarello', 'pornostar', 'porno', 'nudista', 'capezzolo', 'ascella', 'ceretta', 'brufolo', 'emorroidi',
  'supposta', 'clistere', 'lassativo', 'diarrea', 'scoreggia', 'rutto', 'vomito', 'moccolo', 'bestemmia', 'sbronza', 'postumi', 'grappa',
  'tequila', 'spinello', 'cadavere', 'cimitero', 'becchino', 'loculo', 'urna', 'testamento', 'vedova', 'necrologio', 'obitorio',
  'autopsia', 'esorcista', 'acquasanta', 'ostia', 'confessione', 'suora', 'prete', 'Papa', 'cardinale', 'crocifisso', 'aureola',
  'reliquia', 'apocalisse', 'inferno', 'purgatorio', 'peccato', 'Satana', 'Giuda', 'Lazzaro', 'Madonna', 'rosario', 'Vaticano',
  'scomunica', 'suocera', 'divorzio', 'tradimento', 'motel', 'bordello', 'gigolò', 'prostata', 'viagra', 'dentiera', 'pannolone',
  'badante', 'catetere', 'colonscopia', 'ciclo', 'assorbente', 'tampone', 'erezione', 'succhiotto', 'sesso', 'kamasutra', 'tanga',
  'sadomaso', 'frustino', 'cesso', 'stronzo', 'cacca', 'bidet', 'lapide', 'epitaffio', 'teschio', 'veleno', 'cianuro', 'boia', 'forca',
  'ghigliottina', 'Mosè', 'diluvio', 'parroco', 'elemosina', 'limbo', 'Siffredi', 'Cicciolina', 'escort', 'sedere', 'puzza', 'alito',
];
