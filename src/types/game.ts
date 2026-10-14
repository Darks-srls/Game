// Tipi condivisi tra il client React e il Worker Cloudflare
import type { OcaSquare } from '../data/oca';
import type { MiniKind } from '../data/party3d';

export type GameId =
  | 'SPIA'
  | 'IMPOSTORE'
  | 'TELEFONO'
  | 'DISEGNA'
  | 'BOMBA'
  | 'ARTISTA'
  | 'BATTUTE'
  | 'PREFERIRESTI'
  | 'SINTONIA'
  | 'TABU'
  | 'CHISONO'
  | 'TEATRINO'
  | 'SMORFIE'
  | 'DADI'
  | 'OCA'
  | 'NONRIDERE'
  | 'ASTRO'
  | 'PARTY3D'
  | 'HORROR1';
export type BombaMode = 'MISTO' | 'SILLABE' | 'CATEGORIE' | 'LETTERE';

// Foglio condiviso: un'operazione di disegno (coordinate da 0 a 512)
export interface DrawOp {
  g: number; // gesto: tutti i pezzi dello stesso tratto hanno lo stesso numero (serve per "annulla")
  t: 'pen' | 'line' | 'rect' | 'ellipse' | 'fill' | 'clear' | 'undo';
  c?: string; // colore
  w?: number; // spessore
  p?: number[]; // punti [x1, y1, x2, y2, ...]
}

export interface BoardInfo {
  id: number; // cambia a ogni disegno nuovo
  count: number; // quante operazioni ci sono sul foglio
}

// 💣 Passa la bomba: quello che vede ciascun giocatore (il momento dello scoppio resta segreto)
export interface BombaView {
  stage: 'LIVE' | 'BOOM' | 'END';
  order: string[];
  lives: Record<string, number>;
  maxLives: number;
  holder: string;
  prompt: { kind: 'SILLABA' | 'CATEGORIA' | 'LETTERA'; text: string };
  roundStart: number;
  round: number;
  boomVictim: string | null;
  winner: string | null;
}

export interface FeedItem {
  by: string;
  text: string;
  kind: 'guess' | 'ok' | 'close' | 'info';
}

// ✏️ Disegna e indovina
export interface DisegnaView {
  stage: 'CHOOSE' | 'DRAW' | 'REVEAL' | 'END';
  order: string[];
  scores: Record<string, number>;
  gained: Record<string, number>; // punti presi in questo turno
  round: number;
  totalRounds: number;
  drawer: string;
  stageEndsAt: number | null;
  mask: (string | null)[]; // lettere della parola: null = ancora nascosta
  word: string | null; // solo per chi disegna, chi ha indovinato, o a fine turno
  choices: string[] | null; // solo per chi disegna, mentre sceglie
  guessed: string[];
  feed: FeedItem[];
  board: BoardInfo;
}

// 🖌️ Artista impostore
export interface ArtistaView {
  stage: 'DRAW' | 'VOTE' | 'END';
  order: string[];
  colors: Record<string, string>;
  drawer: string | null;
  lap: number;
  laps: number;
  turnEndsAt: number | null;
  category: string;
  word: string | null; // null per l'impostore (fino alla fine)
  isImpostor: boolean;
  impostor: string | null; // solo alla fine
  confirmations: string[];
  board: BoardInfo;
}

// 😂 Battute al volo: una sfida tra due battute anonime
export interface BattuteMatch {
  prompt: string;
  answers: [string | null, string | null]; // null = nessuna risposta
  authors: [string, string] | null; // svelati solo nel verdetto
  votes: [string[], string[]] | null; // chi ha votato cosa: solo nel verdetto
}

export interface BattuteView {
  stage: 'WRITE' | 'VOTE' | 'RESULT' | 'END';
  order: string[];
  scores: Record<string, number>;
  gained: Record<string, number>; // punti dell'ultima sfida
  round: number;
  totalRounds: number;
  stageEndsAt: number | null;
  myPrompts: { index: number; prompt: string; answer: string | null }[]; // le mie frasi da completare
  writers: string[]; // chi scrive in questo round
  done: string[]; // mentre si scrive: chi ha finito · mentre si vota: chi ha votato
  match: BattuteMatch | null;
  matchNo: number;
  matchCount: number;
  canVote: boolean; // chi ha scritto le due battute non vota
  myVote: 0 | 1 | null;
  battutona: boolean; // tutti i voti alla stessa battuta
  forfeit: boolean; // vittoria a tavolino: una delle due risposte manca
}

// 🤔 Preferiresti?
export interface PreferirestiView {
  stage: 'VOTE' | 'REVEAL' | 'END';
  order: string[];
  scores: Record<string, number>;
  qNo: number;
  qCount: number;
  a: string;
  b: string;
  stageEndsAt: number | null;
  voted: string[];
  myVote: 0 | 1 | null;
  votes: Record<string, 0 | 1> | null; // solo nella rivelazione
}

// 📡 Sintonia: il bersaglio (0-100) lo vede solo il sensitivo, fino alla rivelazione
export interface SintoniaView {
  stage: 'CLUE' | 'GUESS' | 'REVEAL' | 'END';
  order: string[];
  scores: Record<string, number>;
  gained: Record<string, number>;
  psychic: string | null;
  turnNo: number;
  turnCount: number;
  left: string;
  right: string;
  target: number | null;
  clue: string | null;
  stageEndsAt: number | null;
  locked: string[];
  myGuess: number | null;
  guesses: Record<string, number> | null; // solo nella rivelazione
}

// 🤐 Parola proibita (a squadre)
export interface TabuCard {
  word: string;
  banned: string[];
}

export interface TabuView {
  stage: 'READY' | 'PLAY' | 'TURN_END' | 'END';
  teams: Record<string, 0 | 1>;
  scores: [number, number];
  speaker: string | null;
  speakerTeam: 0 | 1;
  turnNo: number;
  turnCount: number;
  stageEndsAt: number | null;
  card: TabuCard | null; // la vede chi parla e la squadra avversaria (che controlla)
  cardNo: number;
  role: 'SPEAKER' | 'GUESSER' | 'GUARD' | 'WATCHER';
  log: { word: string; result: 'ok' | 'skip' | 'buzz' }[]; // carte del turno
  winner: 0 | 1 | -1 | null; // -1 = pareggio
}

// 🎭 Chi sono?
export interface ChiSonoView {
  stage: 'PLAY' | 'END';
  order: string[];
  asker: string | null;
  turnEndsAt: number | null;
  characters: Record<string, string | null>; // il mio è null finché non lo scopro
  solved: string[]; // in ordine di arrivo
  gaveUp: string[];
}

// 🎭 Teatrino: chi recita sa lo stile segreto, gli altri lo indovinano tra sei
export interface TeatrinoView {
  stage: 'ACT' | 'REVEAL' | 'END';
  order: string[];
  scores: Record<string, number>;
  gained: Record<string, number>;
  actor: string | null;
  turnNo: number;
  turnCount: number;
  phrase: string;
  options: string[];
  myStyle: number | null; // solo per chi recita
  answer: number | null; // per tutti alla rivelazione
  guessed: string[];
  myGuess: number | null;
  guesses: Record<string, number> | null;
  stageEndsAt: number | null;
}

// 🤳 Smorfie: selfie su una situazione segreta, gli altri indovinano quale
export interface SmorfieView {
  stage: 'SHOOT' | 'GUESS' | 'REVEAL' | 'END';
  order: string[];
  scores: Record<string, number>;
  gained: Record<string, number>;
  round: number;
  totalRounds: number;
  stageEndsAt: number | null;
  myPrompt: string | null; // la mia situazione, mentre si scatta
  shooters: string[];
  sent: string[];
  owner: string | null;
  photo: string | null;
  photoNo: number;
  photoCount: number;
  options: string[];
  guessed: string[];
  myGuess: number | null;
  answer: number | null;
  guesses: Record<string, number> | null;
  album: { by: string; url: string; prompt: string }[] | null; // tutte le foto, a fine partita
}

// 🎲 Dadi bugiardi
export interface DadiBid {
  q: number; // quanti dadi
  f: number; // di che faccia (2-6: gli 1 sono jolly)
  by: string;
}

export interface DadiView {
  stage: 'BID' | 'REVEAL' | 'END';
  order: string[];
  counts: Record<string, number>; // dadi rimasti a ciascuno
  myDice: number[];
  allDice: Record<string, number[]> | null; // solo quando si scoprono
  current: string | null;
  bid: DadiBid | null;
  history: DadiBid[];
  totalDice: number;
  stageEndsAt: number | null;
  reveal: { caller: string; bidder: string; q: number; f: number; total: number; loser: string } | null;
  round: number;
  winner: string | null;
}

// 🦢 Gioco dell'Oca pazza
export interface OcaEvent {
  t: OcaSquare | 'WIN' | 'DARE_OK' | 'DARE_KO';
  with?: string; // scambio: con chi
}

export interface OcaView {
  stage: 'ROLL' | 'MOVE' | 'DARE' | 'END';
  order: string[];
  pos: Record<string, number>;
  skip: Record<string, number>;
  current: string | null;
  roll: number | null;
  rollNo: number; // cambia a ogni tiro di dado (animazione del dado)
  moveNo: number; // cambia a ogni spostamento (animazione della pedina)
  mover: string | null;
  path: number[]; // caselle attraversate dall'ultima mossa
  events: OcaEvent[];
  dare: { text: string; by: string; yes: number; no: number; voters: number } | null;
  myVote: 0 | 1 | null;
  stageEndsAt: number | null;
  winner: string | null;
}

// 🙊 Non ridere!
export interface NonRidereView {
  stage: 'ACT' | 'MARK' | 'REVEAL' | 'END';
  order: string[];
  scores: Record<string, number>;
  gained: Record<string, number>;
  comico: string | null;
  turnNo: number;
  turnCount: number;
  mission: string | null; // la vede solo il comico finché recita
  stageEndsAt: number | null;
  laughed: string[];
}

// 🚀 Astro Impostori (videogioco in tempo reale): quello che vede ciascun giocatore
export interface AstroView {
  stage: 'INTRO' | 'PLAY' | 'MEETING' | 'EJECT' | 'END';
  order: string[];
  colors: Record<string, number>; // indice in ASTRO_COLORS
  role: 'CREW' | 'IMPOSTOR' | 'SPECTATOR';
  impostors: string[] | null; // gli impostori conoscono i compagni; tutti a fine partita
  impostorCount: number;
  alive: boolean;
  dead: string[]; // morti che conosco (i fantasmi vedono tutto)
  tasks: { station: number; done: boolean }[];
  taskProgress: number; // compiti dell'equipaggio completati, da 0 a 1
  bodies: { id: string; x: number; y: number }[];
  killReadyAt: number | null;
  emergencies: number;
  meeting: { caller: string; body: string | null; voted: string[]; myVote: string | null; votes: Record<string, string> | null; voteFrom: number } | null;
  warp: { x: number; y: number; n: number } | null; // botola: dove sono sbucato (solo l'impostore)
  sabotage: { kind: 'lights' | 'reactor' | 'o2' | 'comms'; endsAt: number | null; fixed: string[]; holders: Record<string, string> } | null;
  closedDoors: string[]; // stanze con le porte chiuse
  sabotageReadyAt: number | null; // solo l'impostore
  doorsReadyAt: number | null;
  buttonReadyAt: number; // il pulsante della riunione si sblocca da qui (uguale per tutti)
  camsOn: boolean; // qualcuno sta guardando le telecamere (le lucine rosse lampeggiano)
  ejected: { id: string | null; wasImpostor: boolean; reason: 'VOTE' | 'TIE' | 'SKIP' } | null;
  impostorsLeft: number;
  winner: 'CREW' | 'IMPOSTORS' | null;
  winReason: string | null;
  killedBy: string | null;
  spawn: { x: number; y: number };
  spawnNo: number; // cambia quando tutti vengono riportati al tavolo
  stageEndsAt: number | null;
  killCooldown: number;
  meetingSeconds: number;
}

export interface LocationItem {
  id: string;
  name: string;
  category: string;
  icon: string;
  roles: string[];
  description?: string;
}

export interface GameSettings {
  game: GameId;
  roundTimeSeconds: number; // spia/impostore: 0 = tempo infinito
  spiesCount: number; // spia/impostore: quante spie o impostori (1-3)
  rolesEnabled: boolean; // spia
  selectedCategories: string[]; // spia
  impostorWord: boolean; // impostore: true = riceve una parola simile (e non sa di essere l'impostore), false = nessuna parola
  drawSeconds: number; // telefono: secondi per disegnare, 0 = senza limite
  bombaMode: BombaMode; // bomba: tipo di sfida
  bombaLives: number; // bomba: vite per giocatore
  drawRounds: number; // disegna e indovina: quante volte disegna ognuno
  guessSeconds: number; // disegna e indovina: secondi per turno
  customWords: string; // disegna e indovina: parole del gruppo, separate da virgola
  onlyCustom: boolean; // disegna e indovina: usa solo le parole del gruppo
  battuteRounds: number; // battute al volo: quanti round
  writeSeconds: number; // battute al volo: secondi per scrivere
  prefQuestions: number; // preferiresti: quante domande
  sintoniaLaps: number; // sintonia: quante volte fa il sensitivo ognuno
  tabuSeconds: number; // parola proibita: secondi per turno
  tabuLaps: number; // parola proibita: quante volte parla ognuno
  teatroLaps: number; // teatrino: quante volte recita ognuno
  smorfieRounds: number; // smorfie: quanti round di selfie
  diceCount: number; // dadi bugiardi: dadi a testa
  nrLaps: number; // non ridere: quante volte fa il comico ognuno
  astroTasks: number; // astro impostori: compiti a testa
  astroKill: number; // astro impostori: secondi tra un'eliminazione e l'altra
  astroMeeting: number; // astro impostori: secondi di riunione
  partyBots: number; // axend party: bot che giocano da soli
  partyRounds: number; // axend party: quanti minigiochi
  horrorPressure: number; // non lasciarmi solo: 0 tranquilla, 1 normale, 2 alta
  spicy: boolean; // contenuti piccanti: idee e parole più sgravate (per adulti)
  privateRoom: boolean; // stanza privata: non compare tra le stanze aperte
}

// Una stanza nella lista delle stanze aperte (home)
export interface RoomSummary {
  code: string;
  game: GameId;
  phase: GamePhase;
  players: number; // giocatori collegati
  full: boolean;
  spicy: boolean;
  host: { name: string; avatar: string; color: string };
}

export type GamePhase = 'LOBBY' | 'PLAYING' | 'ROUND_OVER';

// Giocatore salvato sul server
export interface Player {
  id: string;
  name: string;
  avatar: string;
  color: string;
  isOnline: boolean;
  awaySince?: number | null; // è uscito dall'app: resta "attivo" per un po' prima di risultare offline
}

// Spia/impostore: ruolo di un giocatore nel round (svelato a tutti solo a fine round)
export interface RevealEntry {
  id: string;
  name: string;
  avatar: string;
  color: string;
  role: string;
  isSpy: boolean;
}

// Impostore: la parola della maggioranza e quella dell'impostore (null = nessuna parola)
export interface SecretWords {
  civil: string;
  impostor: string | null;
}

// Telefono senza fili: una pagina dell'album (frase o disegno)
export interface TelEntry {
  type: 'text' | 'drawing';
  by: string; // id di chi l'ha fatta
  content: string | null; // testo o indirizzo del disegno; null = turno saltato
}

export interface TelChain {
  ownerId: string;
  entries: (TelEntry | null)[];
}

export interface TelPerson {
  id: string;
  name: string;
  avatar: string;
  color: string;
}

// Telefono senza fili: stato completo (solo server)
export interface TelState {
  order: string[];
  roster: TelPerson[];
  step: number;
  totalSteps: number;
  chains: TelChain[];
  submitted: string[];
  stepEndsAt: number | null;
  imageKeys: string[];
  revealChain: number;
  revealStep: number;
  revealDone: boolean;
}

// Telefono senza fili: quello che vede ciascun giocatore
export interface TelView {
  step: number;
  totalSteps: number;
  stepType: 'text' | 'drawing';
  stepEndsAt: number | null;
  inGame: boolean;
  mySubmitted: boolean;
  myInput: TelEntry | null; // cosa devo disegnare o descrivere
  roster: TelPerson[];
  album: TelChain[] | null; // solo alla fine, fin dove è stato svelato
  revealChain: number;
  revealStep: number;
  revealDone: boolean;
}

// Stato completo della stanza: resta sul server
export interface RoomState {
  roomCode: string;
  phase: GamePhase;
  players: Player[];
  hostId: string; // chi ha creato la stanza: passa ad altri solo se esce
  settings: GameSettings;
  currentRound: number;
  roundPlayerIds: string[];
  confirmations: string[];
  roster: RevealEntry[];
  startingPlayerId: string | null;
  timerEndsAt: number | null; // null = senza limite
  forcedEnd: boolean;
  secretLocation?: LocationItem;
  secretWords?: SecretWords | null;
  usedLocationIds: string[];
  tel: TelState | null;
  mg: { kind: GameId; data: any } | null; // giochi a moduli (tutti tranne Spia, Impostore e Telefono)
  lastActivity?: number;
}

// Giocatore come lo vedono gli altri (nessun segreto)
export interface PublicPlayer {
  id: string;
  name: string;
  avatar: string;
  color: string;
  isHost: boolean;
  isOnline: boolean;
  inRound: boolean;
  confirmed: boolean; // spia/impostore: ha confermato · telefono: ha consegnato il turno
}

export interface LocationSummary {
  id: string;
  name: string;
  icon: string;
}

// Stato inviato a ciascun client: contiene solo i segreti di chi lo riceve
export interface ClientGameState {
  roomCode: string;
  phase: GamePhase;
  players: PublicPlayer[];
  myId: string;
  hostId: string;
  settings: GameSettings;
  currentRound: number;
  startingPlayerId: string | null;
  timerEndsAt: number | null;
  serverNow: number;
  spiesInRound: number;
  availableLocations: LocationSummary[];
  inRound: boolean;
  isSpy: boolean; // impostore con parola simile: sempre false (non sa di esserlo)
  myRole: string; // spia: il ruolo · impostore: la parola ('' = nessuna)
  location: LocationItem | null; // spia: agenti durante il round, tutti a fine round
  words: SecretWords | null; // impostore: solo a fine round
  reveal: RevealEntry[] | null; // solo a fine round
  forcedEnd: boolean;
  tel: TelView | null; // solo durante il Telefono senza fili
  mg: ModeView | null; // solo durante i giochi a moduli
}

export type ModeView =
  | BombaView
  | DisegnaView
  | ArtistaView
  | BattuteView
  | PreferirestiView
  | SintoniaView
  | TabuView
  | ChiSonoView
  | TeatrinoView
  | SmorfieView
  | DadiView
  | OcaView
  | NonRidereView
  | AstroView
  | PartyView
  | Horror1View;

// 🔦 Non lasciarmi solo (horror cooperativo dei manutentori)
export type H1PlayerState = 'ok' | 'ferito' | 'intrappolato' | 'evacuato' | 'estratto' | 'uscito';
export interface Horror1View {
  stage: 'BRIEF' | 'PLAY' | 'EVAC' | 'END';
  startAt: number;
  briefEnds: number;
  evacEnds: number | null;
  pressure: number;
  players: Record<
    string,
    {
      state: H1PlayerState;
      carrying: 'modulo' | 'filtro' | 'batteria' | null;
      protectUntil: number;
      rescues: number;
      evacAt: number | null;
      hidden: string | null; // dentro un nascondiglio
      trap: { digits: string; revealed: number; self: number } | null; // incatenato (le cifre lette le vede solo lui)
    }
  >;
  doors: Record<string, { open: boolean; blocked: boolean; lock: '' | 'acqua' | 'test' }>;
  fermi: number; // fermi per bloccare le porte ancora disponibili
  items: { id: string; kind: 'modulo' | 'filtro' | 'batteria'; f: number; x: number; y: number; z: number; by: string | null; clean: boolean }[];
  holds: Record<string, { st: string; kind: string }>; // chi sta lavorando a cosa
  prog: Record<string, number>; // avanzamento dei lavori (0..1)
  modulo: boolean;
  luce: 'spenta' | 'test' | 'ok';
  luceTestUntil: number;
  filtro: 'sporco' | 'fuori' | 'montato';
  pompaOn: boolean;
  acqua: number;
  batteria: boolean;
  collaudo: { a: boolean; b: boolean; until: number; done: boolean };
  codes: { collaudo1: string; collaudo2: string }; // il codice che compare su ciascun display (per l'altra postazione)
  blink: number; // test luci: quante volte lampeggia la lampada di prova
  alert: { mode: 'dorme' | 'mostra' | 'ronda' | 'indaga' | 'caccia' | 'cerca' | 'ritira'; victim: string | null };
  stability: number; // 0 operativo, 1 sovraccarico, 2 instabile, 3 evacuazione
  log: { t: number; text: string; kind: 'info' | 'warn' | 'ok' | 'danger' }[];
  leak: { st: string; until: number } | null;
  chairRot: number;
  hunt: { phase: 'avviso' | 'attiva'; until: number } | null; // caccia in corso (si vede dalle luci)
  burst: string[]; // lampadine scoppiate: "piano:x:y:z"
  moved: Record<string, { k: string; seed: number; at: number }>; // oggetti spostati dal palazzo
  result: { outcome: 'completo' | 'parziale' | 'fallito'; minutes: number; done: string[]; causes: string[]; people: { id: string; how: string; helped: number }[] } | null;
  spawn: { x: number; y: number; z: number };
  deadline: number; // fine del turno di notte (poi evacuazione)
  found: string[]; // oggetti già trovati da qualcuno
  me: string;
}

// 🎉 Axend Party (minigiochi 3D)
export interface PartyView {
  kind: MiniKind;
  stage: 'INTRO' | 'PLAY' | 'RESULT' | 'END';
  round: number;
  rounds: number;
  queue: MiniKind[];
  stageEndsAt: number | null;
  playStart: number | null;
  roster: { id: string; name: string; color: string; bot: boolean }[]; // i nomi dei giocatori veri sono in state.players
  alive: Record<string, boolean>;
  out: string[];
  finished: string[];
  points: Record<string, number>;
  roundPoints: Record<string, number> | null;
  spawn: { x: number; y: number; z: number; r: number } | null;
  spawnNo: number;
  light: { state: 'GREEN' | 'TURN' | 'RED'; endsAt: number } | null;
  chairs: { phase: 'MUSIC' | 'STOP'; endsAt: number; list: { x: number; z: number; by: string | null }[]; giro: number } | null;
  snipers: string[];
  hits: Record<string, number>;
  reloadAt: number;
  balls: { id: number; x: number; t0: number; v: number }[]; // polpette rotolanti
  slams: { id: number; x: number; z: number; at: number }[]; // ciabattate della nonna
  henHolder: string | null; // chi tiene la gallina d'oro
  hold: Record<string, number>; // secondi con la gallina
  broken: string[]; // ponte di lasagne: lastre crollate ("fila:lato")
  bomb: { holder: string; hot: boolean } | null; // il petardo (hot = sta per scoppiare)
  dashReadyAt: number; // quando posso scattare di nuovo (ora del server)
  // pasta al dente: durante il via si sa solo CHI ha scolato, i tempi escono nella rivelazione
  dente: { manche: number; manches: number; target: number; phase: 'GO' | 'REVEAL'; startAt: number; endsAt: number | null; stopped: string[]; stops: Record<string, number | null> | null; err: Record<string, number> } | null;
  hex: string; // pavimento di wafer: stato delle mattonelle (0 intera, 1 si sbriciola, 2 caduta)
  // macedonia: la griglia della frutta si vede solo mentre si mostra e quando crolla (mai mentre è coperta)
  fruit: { phase: 'SHOW' | 'HIDE' | 'DROP' | 'RISE'; endsAt: number; giro: number; target: number | null; grid: number[] | null; open: boolean[] } | null;
  soccer: { team: Record<string, number>; score: [number, number]; goals: Record<string, number>; kickoffAt: number } | null; // calcetto
  doors: string[]; // corsa pazza: porte sfondate ("fila:porta")
  throwReadyAt: number; // pomodorata: quando posso lanciare di nuovo
}
