// 🐑 Il gregge: le domande (vince chi pensa come la maggioranza) e quello che vede ogni telefono

export interface GreggeGroup {
  id: string;
  label: string; // la risposta più scritta del gruppo
  variants: string[]; // come l'hanno scritta (minuscole, senza doppioni)
  mine: boolean; // c'è dentro la mia risposta
  atoms: number; // risposte diverse unite nel gruppo (>1 = si può separare)
  members: string[] | null; // chi l'ha scritta: solo alla rivelazione
}

// cosa vede ciascun giocatore: le risposte degli altri solo dopo la scrittura, gli autori solo alla rivelazione
export interface GreggeView {
  stage: 'WRITE' | 'MERGE' | 'REVEAL' | 'END';
  order: string[];
  round: number;
  meta: number; // punti per vincere
  question: string;
  stageEndsAt: number | null;
  players: string[]; // chi gioca questo round (collegati all'inizio)
  written: string[];
  myAnswer: string | null;
  groups: GreggeGroup[];
  blank: string[]; // rivelazione: chi non ha risposto (conta come risposta unica)
  done: string[]; // chi ha finito di unire
  feed: { by: string; text: string }[]; // chi ha unito o separato cosa
  herd: string | null; // id del gruppo più numeroso (se è uno solo)
  sheepTo: string | null; // a chi va la pecora nera in questo round
  sheepFrom: string | null; // a chi è stata tolta
  sheep: string | null; // chi ha la pecora nera adesso
  scores: Record<string, number>;
  gained: Record<string, number>;
  winners: string[];
  endReason: 'meta' | 'limite' | 'ferma' | null;
}

// domande con una risposta "ovvia" che però non è mai ovvia per tutti
export const GREGGE_QUESTIONS = [
  'Un frutto giallo', 'Un animale della fattoria', 'Il gusto di gelato migliore', 'Un supereroe', 'Una città italiana', 'Un numero da 1 a 10',
  'Un colore', 'Una marca di automobili', 'Un piatto di Natale', 'Il giorno più brutto della settimana', 'Un mese dell’anno',
  'Uno sport con la palla', 'Un personaggio Disney', 'Un cartone animato', 'Una cosa che metti in valigia', 'Un oggetto della cucina',
  'Una materia scolastica', 'Un regalo per la mamma', 'Una cosa rossa', 'Un uccello', 'Un pesce', 'Un insetto', 'Un fiore', 'Un albero',
  'Una verdura verde', 'Un formaggio', 'Un tipo di pasta', 'Un sugo per la pasta', 'Un dolce italiano', 'Una bevanda calda',
  'Una bibita gassata', 'Un social network', 'Una marca di telefoni', 'Un pianeta', 'Uno strumento musicale', 'Un cantante italiano',
  'Una squadra di calcio', 'Un film di Natale', 'Un personaggio delle fiabe', 'Un mostro', 'Una parte del corpo', 'Un lavoro pericoloso',
  'Un mezzo di trasporto', 'La stagione migliore', 'Un vestito da inverno', 'Una cosa che trovi in bagno', 'Un elettrodomestico',
  'Una cosa da fare al mare', 'Un gioco di carte', 'Un gioco da tavolo', 'Un videogioco famoso', 'Un animale della savana',
  'Un animale domestico', 'Un animale che fa paura', 'Un animale lento', 'Un animale velocissimo', 'Una razza di cane', 'Un nome da cane',
  'Un nome da gatto', 'Una lingua straniera', 'Un paese europeo', 'Una capitale europea', 'Una regione italiana', 'Un monumento famoso',
  'Un fiume italiano', 'Un’isola italiana', 'Un vulcano', 'Una pizza', 'Un ingrediente della carbonara', 'Una cosa che si mangia a colazione',
  'Un frutto rosso', 'Un frutto estivo', 'Un agrume', 'Una cosa che si trova in una borsa', 'Una cosa che si trova in un astuccio',
  'Una cosa che si trova in frigo', 'Una cosa che si trova in spiaggia', 'Una cosa che si trova in un ufficio', 'Una cosa di plastica',
  'Una cosa di vetro', 'Una cosa di legno', 'Una cosa morbida', 'Una cosa che punge', 'Una cosa che vola', 'Una cosa che galleggia',
  'Una cosa rotonda', 'Una cosa quadrata', 'Una cosa bianca', 'Una cosa nera', 'Una cosa verde', 'Una cosa blu', 'Una cosa che brilla',
  'Una cosa che fa rumore', 'Una cosa calda', 'Una cosa fredda', 'Una cosa appiccicosa', 'Una cosa che si rompe facilmente',
  'Una cosa che si accende', 'Una cosa con le ruote', 'Una cosa con i bottoni', 'Una cosa con le ali', 'Una cosa che ha i denti',
  'Una cosa che si apre e si chiude', 'Un oggetto che hai in tasca', 'Un oggetto sul comodino', 'Un oggetto che perdi sempre',
  'Un’app che usi ogni giorno', 'Una serie TV famosa', 'Un film horror', 'Un film d’animazione', 'Un personaggio di Harry Potter',
  'Un personaggio dei Simpson', 'Un personaggio di Star Wars', 'Un cattivo dei cartoni', 'Una principessa Disney', 'Un mago famoso',
  'Un pirata famoso', 'Un dinosauro', 'Un animale marino', 'Un animale con la coda lunga', 'Un animale notturno', 'Un animale del bosco',
  'Un animale che salta', 'Un animale con le corna', 'Un animale a strisce', 'Un animale a macchie', 'Un rettile', 'Un animale australiano',
  'Uno sport invernale', 'Uno sport olimpico', 'Uno sport noioso da guardare', 'Un ruolo nel calcio', 'Un attrezzo da palestra',
  'Una cosa che si fa in palestra', 'Un lavoro che fanno i bambini da grandi', 'Un mestiere con la divisa', 'Un lavoro in ospedale',
  'Un negozio del centro', 'Una catena di fast food', 'Una marca di pasta', 'Una marca di vestiti sportivi', 'Una marca di cioccolato',
  'Una merendina', 'Una caramella', 'Un biscotto famoso', 'Un tipo di pane', 'Un salume', 'Un piatto napoletano', 'Un piatto romano',
  'Un piatto milanese', 'Un piatto siciliano', 'Un piatto cinese', 'Un piatto giapponese', 'Un cibo da fast food', 'Un cibo piccante',
  'Un cibo che non piace ai bambini', 'Una verdura da minestrone', 'Un condimento per l’insalata', 'Una spezia', 'Un cocktail famoso',
  'Una cosa che si mette sulla pizza', 'Un gusto di patatine', 'Una torta di compleanno', 'Un dolce di Pasqua', 'Una cosa che si fa a Capodanno',
  'Una cosa che si fa a Natale', 'Un personaggio del presepe', 'Una decorazione di Natale', 'Un costume di Carnevale', 'Una cosa di Halloween',
  'Una festa italiana', 'Un regalo di compleanno', 'Un regalo da riciclare', 'Un fiore da regalare', 'Una canzone di Natale',
  'Un cantante straniero', 'Una band famosa', 'Un genere musicale', 'Uno strumento a fiato', 'Un ballo', 'Un programma TV',
  'Un presentatore TV', 'Un attore italiano', 'Un attore di Hollywood', 'Un comico italiano', 'Un calciatore famoso', 'Un pilota di Formula 1',
  'Uno scienziato famoso', 'Un pittore famoso', 'Uno scrittore italiano', 'Un personaggio storico', 'Un imperatore romano', 'Un dio greco',
  'Una meraviglia del mondo', 'Una città americana', 'Un paese caldo', 'Un paese freddo', 'Un posto per la luna di miele', 'Una meta per il weekend',
  'Una cosa da vedere a Roma', 'Una cosa da vedere a Parigi', 'Un posto dove vai in vacanza', 'Un mezzo per andare in vacanza',
  'Una cosa che dimentichi sempre in vacanza', 'Una cosa che si compra in autogrill', 'Una cosa da fare quando piove',
  'Una cosa che si fa la domenica', 'Una cosa che fai appena sveglio', 'Una cosa che fai prima di dormire', 'Una cosa che fa la nonna',
  'Una frase che dice sempre la mamma', 'Una scusa per non andare a scuola', 'Una materia odiata', 'Una cosa nello zaino di scuola',
  'Un gioco da cortile', 'Un giocattolo', 'Un gioco da spiaggia', 'Una cosa che collezionano i bambini', 'Un supereroe Marvel',
  'Un personaggio dei videogiochi', 'Una console', 'Un oggetto tecnologico', 'Una cosa che si ricarica', 'Una password troppo facile',
  'Un emoji', 'Una parola inglese che usano tutti', 'Una parola difficile da scrivere', 'Una parolaccia leggera', 'Un modo di salutare',
  'Un colore di capelli', 'Una pettinatura', 'Un accessorio', 'Un gioiello', 'Un capo d’abbigliamento estivo', 'Un tipo di scarpe',
  'Una cosa che si fa in bicicletta', 'Un pezzo dell’automobile', 'Un segnale stradale', 'Una cosa che si trova in un parco',
  'Una stanza della casa', 'Un mobile', 'Una cosa che si trova in giardino', 'Un attrezzo da giardino', 'Un attrezzo da lavoro',
  'Una cosa che si fa in cucina', 'Un modo di cuocere le uova', 'Una cosa che si fa col pane', 'Un frutto secco', 'Una cosa che si spalma',
  'Un sapore', 'Un odore buono', 'Un odore cattivo', 'Un rumore fastidioso', 'Una paura comune', 'Un superpotere', 'Un desiderio',
  'Una cosa che rende felici', 'Una cosa che si fa in coppia', 'Un posto per un primo appuntamento', 'Una cosa romantica',
];

// 🌶️ per adulti: sporche, cattive, humor nero e sacro/profano (solo con i contenuti piccanti)
export const GREGGE_QUESTIONS_SPICY = [
  'Un posto dove fare sesso', 'Una posizione sessuale', 'Un superalcolico', 'Un modo per dire “sedere”', 'Una parolaccia',
  'Una cosa che si fa da ubriachi', 'Un giocattolo erotico', 'Una scusa per non fare sesso', 'Un vip da portarsi a letto',
  'Un santo', 'Un peccato capitale', 'Un comandamento', 'Un modo stupido di morire', 'Una cosa da mettere nella bara',
  'Una malattia imbarazzante', 'Un fluido corporeo', 'Un rumore che fa il corpo', 'Una cosa sotto il letto di un single',
  'Un attore porno famoso', 'Una scusa di chi torna a casa all’alba', 'Un posto dove non baceresti mai nessuno',
  'Una cosa che i preti fanno di nascosto', 'Un personaggio della Bibbia', 'Un miracolo di Gesù', 'Una cosa da fare in luna di miele',
  'Un capo di biancheria sexy', 'Un nome da pornostar', 'Un motivo per lasciarsi', 'Una bevanda per ubriacarsi', 'Una cosa nel comodino',
  'Una cosa schifosa nei bagni pubblici', 'Una scusa per una macchia sui pantaloni', 'Un politico da mandare su Marte',
  'Un vip insopportabile', 'Un vip che è sicuramente un alieno', 'Un influencer insopportabile', 'Una cosa da non dire in chiesa',
  'Un santo da invocare quando sbatti il mignolo', 'Una cosa che fa il Papa in bagno', 'Una cosa che fa il diavolo all’inferno',
  'Un posto dove nascondere un cadavere', 'Un’arma del delitto', 'Un veleno', 'Una cosa che si dice a un funerale',
  'Una cosa che non si dice a un funerale', 'Una canzone da funerale', 'Un fiore da funerale', 'Una cosa che fa un becchino',
  'Una cosa che si trova in un cimitero', 'Un modo di dire “è morto”', 'Un’ultima cena perfetta', 'Una cosa da scrivere sulla lapide',
  'Una parte del corpo che non mostreresti mai', 'Una parte del corpo sexy', 'Un difetto fisico del partner', 'Una cosa che puzza nel corpo',
  'Una cosa che fai in bagno col telefono', 'Una cosa che si trova nel naso', 'Un nome volgare per il seno', 'Un nome volgare per il pene',
  'Un nome volgare per la vagina', 'Una cosa che si fa sotto la doccia', 'Un posto per un’avventura di una notte', 'Una frase dopo il sesso',
  'Una frase durante il sesso', 'Un’app per incontri', 'Una bugia su Tinder', 'Una cosa che non vuoi vedere in una foto di Tinder',
  'Un regalo erotico', 'Un costume sexy', 'Un fetish', 'Una cosa da fare in un motel', 'Una cosa che si compra in farmacia con imbarazzo',
  'Un contraccettivo', 'Un sintomo dei postumi', 'Un rimedio contro la sbornia', 'Una cosa che succede all’addio al celibato',
  'Una cosa che si fa all’addio al nubilato', 'Un cocktail che ti stende', 'Un vino da due soldi', 'Una birra', 'Un posto dove vomitare',
  'Una cosa che si perde da ubriachi', 'Un messaggio da mandare ubriachi', 'Un modo per tradire', 'Una scusa per un tradimento',
  'Un posto dove incontrare l’amante', 'Una cosa che fa la suocera', 'Un insulto per la suocera', 'Una bestemmia “pulita”',
  'Un’imprecazione napoletana', 'Una cosa che si confessa al prete', 'Una cosa che fanno le suore di notte', 'Un apostolo',
  'Una piaga d’Egitto', 'Un sacramento', 'Un oggetto da chiesa', 'Una cosa che fa Gesù nel tempo libero', 'Un supereroe col pene piccolo',
  'Un vip con cui tradiresti il partner', 'Un attore di Hollywood sexy', 'Un cantante italiano con cui andresti a letto',
  'Una cosa che il dentista non dovrebbe vedere', 'Una visita medica imbarazzante', 'Una malattia venerea', 'Un medicinale da vecchi',
  'Una cosa che fanno i vecchi al mare', 'Un modo per farsi lasciare',
];
