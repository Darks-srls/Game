// 🃏 Giochi "flat" a moduli (sul telefono, senza 3D): elenco, impostazioni e regole.
// Ogni gioco ha il server in worker/flat/<id>.ts, la schermata in src/components/flat/<Nome>View.tsx
// e i contenuti (parole, domande…) in src/data/flat/<id>.ts. Qui solo quello che serve a home, stanza e server.

export type FlatId =
  | 'LUPI'
  | 'MISSIONE'
  | 'INFILTRATO'
  | 'ROSE'
  | 'BESTIE'
  | 'INTRIGO'
  | 'CORTE'
  | 'DIZIONARIO'
  | 'CODICI'
  | 'PAROLAUNICA'
  | 'SCALA10'
  | 'GREGGE'
  | 'MENTE'
  | 'NOMICOSE'
  | 'QUIZZONE'
  | 'EMOJI'
  | 'GHIGLIOTTINA'
  | 'STIMA'
  | 'CINQUE'
  | 'MICROSFIDE';

export type FlatCategory = 'ruoli' | 'bluff' | 'quiz' | 'voce' | 'risate' | 'video';

export interface FlatOption {
  key: string; // nome dell'impostazione (unico per gioco), salvato in settings.extra
  label: string;
  values: [number, string][]; // valori ammessi e come si vedono
  def: number; // valore iniziale
}

export interface FlatInfo {
  id: FlatId;
  name: string;
  desc: string; // una riga per la home
  emoji: string; // ripiego se manca la copertina
  cat: FlatCategory;
  min: number; // giocatori minimi
  max?: number; // giocatori massimi
  spicy?: boolean; // ha contenuti 🌶️ (parole/domande più sgravate)
  options: FlatOption[];
  rules: string[]; // come si gioca, a punti
}

const ROUNDS = (key: string, vals: number[], def: number, label = 'Quanti round'): FlatOption => ({ key, label, values: vals.map((v) => [v, String(v)]), def });

export const FLAT_GAMES: FlatInfo[] = [
  {
    id: 'LUPI',
    name: 'Lupi mannari',
    desc: 'Di notte i lupi sbranano, di giorno il villaggio vota chi impiccare',
    emoji: '🐺',
    cat: 'ruoli',
    min: 5,
    max: 16,
    options: [
      { key: 'lupi', label: '🐺 Quanti lupi', values: [[0, 'Auto'], [1, '1'], [2, '2'], [3, '3']], def: 0 },
      { key: 'speciali', label: '🔮 Ruoli speciali (veggente, medico)', values: [[1, 'Sì'], [0, 'No']], def: 1 },
      { key: 'giorno', label: '☀️ Secondi di discussione', values: [[60, '60'], [120, '120'], [180, '180'], [300, '300']], def: 120 },
    ],
    rules: [
      'Ognuno riceve un ruolo segreto: lupi (si conoscono tra loro), veggente, medico o contadini.',
      'Di notte tutti toccano il telefono: i lupi scelgono chi sbranare, il veggente scopre il ruolo di uno, il medico salva qualcuno. Anche i contadini scelgono un sospetto (così nessuno si tradisce).',
      'Di giorno si scopre chi è morto, si discute a voce e si vota chi eliminare.',
      'Vince il villaggio se elimina tutti i lupi; vincono i lupi se diventano tanti quanti gli altri.',
    ],
  },
  {
    id: 'MISSIONE',
    name: 'Missione segreta',
    desc: 'Agenti contro spie: chi sabota le missioni?',
    emoji: '🕶️',
    cat: 'ruoli',
    min: 5,
    max: 10,
    options: [{ key: 'veggente', label: '🔮 Con il Veggente (e il Sicario)', values: [[1, 'Sì'], [0, 'No']], def: 0 }],
    rules: [
      'Le spie (circa un terzo) si conoscono; gli agenti no.',
      'A turno un capo propone la squadra per la missione e tutti votano in palese se approvarla.',
      'Chi va in missione sceglie in segreto SUCCESSO o SABOTAGGIO: basta un sabotaggio e la missione fallisce (alla 4ª con 7+ giocatori ne servono due).',
      'Tre missioni riuscite: vincono gli agenti. Tre fallite (o cinque squadre bocciate di fila): vincono le spie.',
      'Con il Veggente: lui conosce le spie, ma se alla fine il Sicario delle spie lo indovina, vincono le spie.',
    ],
  },
  {
    id: 'INFILTRATO',
    name: 'L’infiltrato',
    desc: 'Indovinate la parola con domande sì/no… ma uno la sa già',
    emoji: '🎩',
    cat: 'ruoli',
    min: 4,
    max: 12,
    spicy: true,
    options: [{ key: 'tempo', label: '⏱️ Minuti per indovinare', values: [[3, '3'], [4, '4'], [5, '5']], def: 4 }],
    rules: [
      'Il Maestro conosce la parola segreta e risponde sì/no col telefono. Anche l’Infiltrato la conosce, ma nessuno sa chi è.',
      'Tutti fanno domande a voce: l’Infiltrato deve guidare il gruppo verso la parola senza farsi scoprire.',
      'Se indovinate in tempo, avete pochi secondi per votare chi era l’Infiltrato. Se non indovinate, perdete tutti!',
    ],
  },
  {
    id: 'ROSE',
    name: 'Rose e teschi',
    desc: 'Bluff puro: scommetti di girare solo rose',
    emoji: '🌹',
    cat: 'bluff',
    min: 3,
    max: 6,
    options: [],
    rules: [
      'Ognuno ha 3 rose e 1 teschio. All’inizio tutti mettono un disco coperto sulla propria pila.',
      'Quando tocca a te puoi aggiungere un disco o lanciare la sfida: “ne giro N senza trovare teschi”.',
      'Gli altri rilanciano o passano. Chi vince l’asta gira prima tutti i suoi dischi, poi quelli degli altri.',
      'Solo rose: un punto (due punti vincono). Un teschio: perdi un disco a caso. Chi resta senza dischi è fuori.',
    ],
  },
  {
    id: 'BESTIE',
    name: 'Bestie bugiarde',
    desc: '“Ti passo un rospo”… sarà vero?',
    emoji: '🪳',
    cat: 'bluff',
    min: 3,
    max: 6,
    options: [],
    rules: [
      'Le carte sono 8 bestie schifose. Passi una carta coperta a qualcuno dicendo che bestia è (vero o falso).',
      'Chi la riceve dice VERO o FALSO: se indovina, la carta va scoperta davanti a te; se sbaglia, va davanti a lui.',
      'Oppure la guarda e la ripassa a un altro, con una nuova dichiarazione.',
      'Perde chi si ritrova davanti 4 bestie uguali (o chi resta senza carte quando tocca a lui).',
    ],
  },
  {
    id: 'INTRIGO',
    name: 'Intrigo di corte',
    desc: 'Duchi, assassini e contesse: menti per sopravvivere',
    emoji: '👑',
    cat: 'bluff',
    min: 3,
    max: 6,
    options: [],
    rules: [
      'Hai 2 personaggi coperti e 2 monete. A turno fai un’azione: prendere monete, rubare, assassinare, cambiare carte o il colpo di stato (7 monete).',
      'Puoi dichiarare QUALSIASI personaggio, anche se non ce l’hai: gli altri possono dire “Dubito!”.',
      'Chi viene smascherato (o dubita a torto) perde un personaggio. Senza personaggi sei fuori.',
      'Vince l’ultimo con almeno un personaggio.',
    ],
  },
  {
    id: 'CORTE',
    name: 'Lettere a corte',
    desc: 'Fai arrivare la tua lettera alla principessa',
    emoji: '💌',
    cat: 'bluff',
    min: 2,
    max: 6,
    options: [ROUNDS('cuori', [3, 4, 5], 4, '💌 Lettere per vincere')],
    rules: [
      'Ognuno ha una carta in mano. Al tuo turno peschi e ne giochi una delle due: ogni personaggio ha un effetto (indovinare la carta di un altro, sbirciare, confrontare…).',
      'Chi viene beccato o resta con la carta più bassa a fine mazzo è fuori dal giro.',
      'Chi vince il giro guadagna una lettera: vince chi ne raccoglie abbastanza.',
    ],
  },
  {
    id: 'DIZIONARIO',
    name: 'Il dizionario',
    desc: 'Inventa definizioni di parole vere (e assurde)',
    emoji: '📖',
    cat: 'bluff',
    min: 3,
    spicy: true,
    options: [ROUNDS('round', [5, 8, 10], 8)],
    rules: [
      'Esce una parola italiana vera ma rarissima. Ognuno scrive una definizione inventata, credibile.',
      'Si vedono tutte insieme, con quella vera mescolata: votate quella che pensate sia giusta.',
      '+2 se indovini la vera, +1 per ogni amico che vota la tua bugia, +3 se scrivi proprio la definizione giusta.',
    ],
  },
  {
    id: 'CODICI',
    name: 'Nomi in codice',
    desc: 'Rossi contro blu: un indizio, tante parole',
    emoji: '🗝️',
    cat: 'voce',
    min: 4,
    spicy: true,
    options: [],
    rules: [
      'Due squadre, rossi e blu. In ogni squadra c’è un capitano che vede quali delle 25 parole sono della sua squadra.',
      'Il capitano dà UNA parola e un numero (es. “mare 2”): i compagni toccano le parole che pensano siano collegate.',
      'Parola giusta: continuate. Neutra o avversaria: tocca agli altri. L’assassino: avete perso!',
      'Vince la squadra che scopre per prima tutte le sue parole.',
    ],
  },
  {
    id: 'PAROLAUNICA',
    name: 'Una parola sola',
    desc: 'Indizi di una parola: ma quelli uguali si annullano!',
    emoji: '☝️',
    cat: 'voce',
    min: 3,
    spicy: true,
    options: [ROUNDS('carte', [8, 13], 13, '🃏 Quante parole')],
    rules: [
      'A turno uno deve indovinare una parola che non vede. Tutti gli altri scrivono un indizio di UNA sola parola.',
      'Gli indizi uguali (o vietati) si cancellano prima che lui li veda: siate originali!',
      'Gioco di squadra: contate quante parole indovinate in tutto.',
    ],
  },
  {
    id: 'SCALA10',
    name: 'Da 1 a 10',
    desc: 'Rispondi al tema col tuo numero segreto: il capitano deve metterli in fila',
    emoji: '🔟',
    cat: 'voce',
    min: 4,
    spicy: true,
    options: [ROUNDS('round', [4, 6, 8], 6)],
    rules: [
      'Esce un tema, per esempio “cosa porteresti su un’isola deserta, da 1 (inutile) a 10 (indispensabile)”.',
      'Ognuno riceve un numero segreto da 1 a 10 e scrive una risposta che “valga” quel numero.',
      'Il capitano legge le risposte e le mette in ordine. Ogni errore costa una vita alla squadra.',
    ],
  },
  {
    id: 'GREGGE',
    name: 'Il gregge',
    desc: 'Pensa come la maggioranza… e non restare la pecora nera',
    emoji: '🐑',
    cat: 'risate',
    min: 4,
    spicy: true,
    options: [{ key: 'meta', label: '🏁 Punti per vincere', values: [[6, '6'], [8, '8'], [10, '10']], def: 8 }],
    rules: [
      'Esce una domanda (“un frutto giallo”, “un posto dove non baceresti mai nessuno”). Tutti scrivono una risposta in segreto.',
      'Poi le risposte uguali si raggruppano da sole (e potete unire o separare i gruppi a mano).',
      'Chi ha scritto la risposta più comune prende un punto; se i gruppi più grandi sono pari, nessun punto.',
      'Se UNO SOLO ha una risposta diversa da tutti, prende la pecora nera: finché ce l’ha non può vincere.',
      'Vince chi arriva ai punti senza la pecora nera.',
    ],
  },
  {
    id: 'MENTE',
    name: 'Mente unica',
    desc: 'Giocate le carte in ordine… senza parlare',
    emoji: '🧠',
    cat: 'risate',
    min: 2,
    max: 8,
    options: [],
    rules: [
      'Gioco di squadra in silenzio. Al livello 1 avete una carta a testa (da 1 a 100), al livello 2 due, e così via.',
      'Tutti insieme dovete giocare le carte in ordine crescente, senza dirvi niente: si gioca toccando, quando “sentite” che è il momento.',
      'Se qualcuno aveva una carta più bassa di quella giocata perdete una vita. Le stelline permettono di scartare la carta più bassa di tutti.',
      'Se nessuno gioca per 90 secondi, la carta più bassa va in tavola da sola (e costa una vita).',
    ],
  },
  {
    id: 'NOMICOSE',
    name: 'Nomi, cose, città',
    desc: 'Il classico: una lettera, tante categorie, STOP!',
    emoji: '📝',
    cat: 'quiz',
    min: 2,
    spicy: true,
    options: [
      ROUNDS('round', [3, 5, 8], 5),
      { key: 'secondi', label: '⏱️ Secondi per scrivere', values: [[60, '60'], [90, '90'], [120, '120']], def: 90 },
    ],
    rules: [
      'Esce una lettera: scrivete una parola per ogni categoria (nome, cosa, città, animale…).',
      'Chi finisce può premere STOP: gli altri hanno 5 secondi.',
      'Poi si controllano le risposte insieme: quelle sbagliate si bocciano a maggioranza.',
      'Risposta unica 10 punti, uguale a un altro 5, vuota o bocciata 0.',
    ],
  },
  {
    id: 'QUIZZONE',
    name: 'Quizzone',
    desc: 'Quiz a risposta multipla: vince il più veloce',
    emoji: '❓',
    cat: 'quiz',
    min: 2,
    spicy: true,
    options: [ROUNDS('domande', [10, 15, 20], 15, '❓ Quante domande')],
    rules: [
      'Domande di cultura generale, cinema, sport, cibo, Italia… quattro risposte, una giusta.',
      'Più rispondi in fretta più punti prendi; le risposte giuste di fila valgono il bonus serie.',
    ],
  },
  {
    id: 'EMOJI',
    name: 'Emoji quiz',
    desc: 'Film, canzoni e proverbi scritti in emoji',
    emoji: '🎬',
    cat: 'quiz',
    min: 2,
    spicy: true,
    options: [ROUNDS('round', [10, 15, 20], 15)],
    rules: [
      'Compare una fila di emoji: è un film, una canzone, un proverbio, un personaggio, una serie TV o un cartone.',
      'Scrivete la risposta: più siete veloci più punti prendete. Dopo un po’ arrivano gli aiutini.',
    ],
  },
  {
    id: 'GHIGLIOTTINA',
    name: 'La ghigliottina',
    desc: 'Cinque parole, un solo collegamento',
    emoji: '🪓',
    cat: 'quiz',
    min: 2,
    spicy: true,
    options: [ROUNDS('round', [5, 8, 10], 8)],
    rules: [
      'Escono cinque parole, una alla volta: c’è una sola parola che le collega tutte (es. OCCHIALI, COLPO, GIRA, TRAMONTO, CREMA → SOLE).',
      'Scrivete la soluzione appena la capite: prima la indovinate, più punti prendete.',
    ],
  },
  {
    id: 'STIMA',
    name: 'Più o meno',
    desc: 'Domande con un numero: scommetti sulla risposta più vicina',
    emoji: '🎯',
    cat: 'quiz',
    min: 3,
    spicy: true,
    options: [ROUNDS('round', [5, 7, 10], 7)],
    rules: [
      'Esce una domanda con un numero (“quanti gradini ha la Torre Eiffel?”). Ognuno scrive la sua stima.',
      'Poi le stime si mettono in fila e ognuno scommette le sue fiches su quella che pensa sia la più vicina senza superare la verità.',
      'Le risposte agli estremi pagano di più. Vince chi ha più fiches alla fine.',
    ],
  },
  {
    id: 'CINQUE',
    name: 'Cinque lettere',
    desc: 'La parola segreta di 5 lettere: chi la trova prima?',
    emoji: '🟩',
    cat: 'quiz',
    min: 1,
    spicy: true,
    options: [ROUNDS('round', [3, 5, 7], 5)],
    rules: [
      'Tutti cercano la stessa parola di 5 lettere, con 6 tentativi.',
      'Verde: lettera giusta al posto giusto. Giallo: c’è ma in un altro posto. Grigio: non c’è.',
      'Vedete i colori degli altri (non le lettere!): chi la trova prima e con meno tentativi prende più punti.',
    ],
  },
  {
    id: 'MICROSFIDE',
    name: 'Microsfide',
    desc: 'Sfide lampo da 5 secondi: tocca, schiva, conta, reagisci!',
    emoji: '⚡',
    cat: 'video',
    min: 2,
    options: [ROUNDS('sfide', [10, 15, 20], 15, '⚡ Quante sfide')],
    rules: [
      'Tutti insieme, una sfida lampo dopo l’altra: tocca il bersaglio, non toccare la bomba, conta le pecore, trova l’intruso…',
      'Chi riesce prende punti, il più veloce prende il bonus. Le sfide diventano sempre più veloci!',
    ],
  },
];

export const FLAT_IDS = FLAT_GAMES.map((g) => g.id);
export const flatInfo = (id: string) => FLAT_GAMES.find((g) => g.id === id);

// legge un'impostazione del gioco dalla stanza (o il valore iniziale)
export function flatOpt(settings: { extra?: Record<string, number> }, game: FlatId, key: string): number {
  const o = flatInfo(game)?.options.find((x) => x.key === key);
  const v = settings.extra?.[key];
  return o && typeof v === 'number' && o.values.some(([x]) => x === v) ? v : (o?.def ?? 0);
}
