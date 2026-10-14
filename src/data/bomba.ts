// 💣 Passa la bomba: sillabe, categorie e lettere per le sfide

export const SILLABE = [
  'CA', 'CO', 'CI', 'CU', 'MA', 'ME', 'MI', 'MO', 'PA', 'PE', 'PI', 'PO', 'TA', 'TE', 'TI', 'TO', 'RA', 'RE', 'RI', 'RO',
  'LA', 'LE', 'LI', 'LO', 'NA', 'NE', 'NI', 'NO', 'SA', 'SE', 'SI', 'SO', 'VA', 'VE', 'VI', 'DA', 'DE', 'DI', 'GA', 'GI',
  'BA', 'BI', 'BO', 'FA', 'FI', 'FO', 'ZA', 'ZO', 'STA', 'STO', 'TRA', 'TRE', 'PRE', 'PRO', 'CHE', 'CHI', 'GLI', 'GNO',
  'SCA', 'SPA', 'ERO', 'ONE', 'INO', 'ETTO', 'ANTE', 'ENTO', 'OLA', 'ICE', 'ARE', 'URA',
  'MU', 'PU', 'TU', 'LU', 'NU', 'SU', 'RU', 'VO', 'DO', 'DU', 'GO', 'GU', 'BE', 'BU', 'FE', 'FU', 'ZE', 'ZI',
  'BRA', 'BRO', 'CRA', 'CRO', 'CRI', 'FRA', 'FRE', 'GRA', 'GRI', 'GRO', 'PIA', 'PIE', 'FIO', 'CIA', 'CIO', 'GIA', 'GIO',
  'SCI', 'SCO', 'STE', 'STI', 'SPO', 'SPE', 'TRO', 'TRI', 'QUA', 'QUI', 'DRA', 'PLA', 'GNA', 'GHI', 'GHE',
  'OSO', 'ISTA', 'ELLO', 'ELLA', 'ATO', 'ITO', 'ALE', 'OTTO', 'ARIO', 'MENTE', 'ISSIMO', 'ZIONE', 'ANZA',
];

export const CATEGORIE = [
  'Un animale', 'Un frutto', 'Una verdura', 'Una marca di auto', 'Una città italiana', 'Un paese del mondo',
  'Un cantante italiano', 'Un cantante straniero', 'Un personaggio dei cartoni', 'Qualcosa che trovi in cucina',
  'Un lavoro', 'Uno sport', 'Un film', 'Una serie TV', 'Un piatto italiano', 'Qualcosa di rosso', 'Qualcosa di giallo',
  'Qualcosa di freddo', 'Una parte del corpo', 'Un vestito', 'Qualcosa che trovi in bagno', 'Un supereroe',
  'Una squadra di calcio', 'Un calciatore', 'Un videogioco', "Un'app del telefono", 'Una bevanda', 'Un dolce',
  'Uno strumento musicale', 'Un colore', 'Un mezzo di trasporto', 'Qualcosa da portare in spiaggia',
  'Una marca di vestiti', 'Un fiore', 'Un pesce', 'Un insetto', 'Un uccello', 'Una lingua straniera',
  'Qualcosa che fa rumore', 'Qualcosa che si rompe facilmente', 'Qualcosa da mettere in valigia', 'Un gioco da tavolo',
  'Un personaggio Disney', 'Un formaggio', 'Un tipo di pasta', 'Qualcosa che trovi a scuola', 'Un regalo di Natale',
  'Un mobile di casa', 'Un elettrodomestico', 'Una marca di cibo', 'Un nome da cane', 'Un attore o attrice',
  'Una meta per le vacanze', 'Qualcosa che si mangia a colazione', 'Qualcosa di appiccicoso', 'Qualcosa che vola',
  'Qualcosa di rotondo', 'Un mostro o creatura', 'Una regione italiana', 'Un fiume, un lago o un mare',
  'Qualcosa che puzza', 'Qualcosa di morbido', 'Un gusto di gelato', 'Un condimento per la pizza',
  'Una scusa per arrivare in ritardo', 'Qualcosa che fa paura', 'Qualcosa che trovi in palestra', 'Un cartone animato',
  'Una parola in inglese', 'Qualcosa di trasparente',
  'Un personaggio di SpongeBob', 'Un rapper italiano', 'Un influencer', 'Un Pokémon', 'Una marca di telefono', 'Qualcosa che trovi in spiaggia', 'Una bibita', 'Qualcosa che si gonfia', 'Qualcosa di peloso', 'Un mestiere pericoloso', 'Una cosa che fai appena sveglio', 'Una parola che finisce in -one', 'Un tipo di scarpa', 'Un accessorio', 'Una città del mondo', 'Una capitale europea', 'Qualcosa con le ruote', 'Qualcosa che ha i tasti', 'Un cibo fritto', 'Un frutto esotico', 'Un dolce di Natale', 'Un personaggio di Harry Potter', 'Un supermercato', 'Un fast food', 'Qualcosa di verde', 'Qualcosa di blu', 'Un nome da gatto', 'Un verbo', 'Un mostro dei film horror', 'Qualcosa che fa ridere', 'Qualcosa che trovi in macchina', 'Un personaggio dei videogiochi', 'Una squadra di Serie A',
  // Animali e natura
  'Un animale della fattoria', 'Un animale della savana', 'Un animale che vive in acqua', 'Un dinosauro',
  'Una razza di cane', 'Un animale notturno', 'Un animale con le corna', 'Qualcosa di velenoso', 'Un albero',
  'Una pianta da appartamento', 'Qualcosa che trovi nel bosco', 'Qualcosa che trovi in montagna', 'Un fenomeno meteo',
  'Qualcosa nello spazio', 'Un pianeta o una stella',
  // Cibo
  'Un salume', 'Un tipo di pane', 'Un piatto di pesce', 'Un piatto della nonna', 'Un cibo da sagra',
  'Una spezia o erba aromatica', 'Qualcosa da mettere nel panino', 'Qualcosa da cuocere alla griglia', 'Un dolce regionale',
  'Uno snack da distributore', 'Un tipo di caffè', 'Un legume', 'Un piatto straniero', 'Un liquore', 'Una salsa',
  'Qualcosa che si mangia con le mani', 'Un ingrediente di una torta', 'Un tipo di pizza', 'Una marca di merendine',
  // Cinema, TV, musica
  'Un film Disney', 'Un film di Natale', 'Un film horror', 'Un personaggio dei Simpson', 'Un personaggio Marvel',
  'Un personaggio di Star Wars', 'Un cattivo dei film', 'Un programma TV italiano', 'Un conduttore TV', 'Un comico italiano',
  'Una canzone italiana', 'Una canzone da karaoke', 'Un cantante di Sanremo', 'Una band', 'Un ballo', 'Un genere musicale',
  'Un cartone degli anni 90', 'Un reality show', 'Un mago o una strega famosi', 'Un personaggio delle fiabe',
  // Casa, scuola e lavoro
  'Una materia scolastica', 'Qualcosa nell\'astuccio', 'Una facoltà universitaria', 'Qualcosa da ufficio', 'Un attrezzo da lavoro',
  'Qualcosa che trovi in ferramenta', 'Qualcosa che si ricarica', 'Qualcosa con lo schermo', 'Qualcosa nella borsa',
  'Qualcosa da campeggio', 'Qualcosa che trovi in ospedale', 'Qualcosa che trovi in aeroporto', 'Qualcosa che trovi in giardino',
  'Qualcosa che trovi in cantina', 'Qualcosa che c\'è in un castello', 'Un negozio', 'Un posto in città', 'Un lavoro che si fa di notte',
  'Un mestiere di una volta', 'Un oggetto del bagno', 'Qualcosa che si perde sempre', 'Qualcosa che si dimentica a casa',
  // Forme, colori e sensazioni
  'Qualcosa di bianco', 'Qualcosa di nero', 'Qualcosa di rosa', 'Qualcosa di arancione', 'Qualcosa di marrone',
  'Qualcosa di quadrato', 'Qualcosa di lungo', 'Qualcosa di piccolissimo', 'Qualcosa di enorme', 'Qualcosa di pesante',
  'Qualcosa di caldo', 'Qualcosa di bagnato', 'Qualcosa di piccante', 'Qualcosa di appuntito', 'Qualcosa che brilla',
  'Qualcosa con le ali', 'Qualcosa con i buchi', 'Qualcosa che costa tantissimo', 'Qualcosa che si colleziona',
  'Qualcosa che si scioglie', 'Qualcosa che galleggia', 'Qualcosa che si lancia', 'Qualcosa di Halloween', 'Qualcosa di vecchio',
  // Parole e nomi
  'Una parola che finisce in -ino', 'Una parola con la doppia Z', 'Una parola di tre lettere', 'Una parola straniera usata in italiano',
  'Un nome maschile', 'Un nome femminile', 'Un cognome italiano', 'Un nome da mucca', 'Un nome da pesce rosso', 'Un nome da barca',
  'Un modo di dire', 'Un proverbio', 'Un\'emozione', 'Un difetto', 'Un pregio', 'Un insulto da nonna',
  // Sport e luoghi
  'Uno sport invernale', 'Uno sport acquatico', 'Uno sport olimpico', 'Un tennista', 'Un pilota', 'Un allenatore di calcio',
  'Una squadra straniera', 'Un\'isola', 'Una montagna', 'Un monumento', 'Una città di mare', 'Uno stato americano',
  'Un paese europeo', 'Una catena di negozi', 'Una marca di cosmetici', 'Una marca di scarpe', 'Una marca di pasta',
  'Una cosa da fare la domenica', 'Una cosa da fare in vacanza', 'Una cosa che fa il nonno',
];

export const LETTERE = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'I', 'L', 'M', 'N', 'O', 'P', 'R', 'S', 'T', 'U', 'V', 'Z'];

// 🌶️ Categorie piccanti (stanze con i contenuti piccanti attivi): umorismo nero per adulti
export const CATEGORIE_SPICY = [
  'Una scusa per non andare in palestra', 'Una cosa che non diresti mai a tua madre', 'Una cosa che fai da ubriaco',
  'Un posto pessimo per un primo appuntamento', 'Una bugia da dire al capo', 'Un soprannome per un ex',
  'Una ricerca imbarazzante su Google', 'Un cocktail (anche inventato)', 'Una frase da non dire al primo appuntamento',
  'Una cosa nella borsa della nonna', 'Un motivo per lasciare qualcuno', 'Una cosa che puzza dopo una serata',
  'Un rimedio contro il doposbronza', 'Una scusa per arrivare tardi al lavoro', 'Un nome assurdo per una discoteca',
  'Un regalo pessimo per San Valentino', 'Una cosa che si ruba dagli hotel', 'Una cosa da non postare su Instagram',
  'Un modo per svegliare chi russa', 'Un posto dove non faresti mai pipì', 'Una cosa che dici quando hai bevuto troppo',
  'Un tatuaggio di cui pentirsi', "Un messaggio da mandare all'ex alle 3 di notte", 'Una cosa da nascondere ai genitori',
  'Una figuraccia al matrimonio',
  'Una scusa per non rispondere al telefono', 'Una cosa da fare in Erasmus', 'Un drink da discoteca', 'Una red flag in una relazione', 'Una frase da Tinder', 'Un posto dove limonare', 'Una cosa nel bagno della discoteca', 'Un motivo per litigare con il partner', 'Una scusa per andare via presto da una cena', 'Una canzone da cantare ubriachi', 'Una cosa da non fare a casa della suocera', "Un regalo per l'addio al celibato", 'Una cosa che rimpiangi della serata', 'Un soprannome per il partner', 'Un nome da drag queen',
  // Sesso (comico)
  'Un sinonimo di pene', 'Un sinonimo di sedere', 'Un sinonimo di tette', 'Un sinonimo di fare sesso',
  'Una posizione sessuale (anche inventata)', 'Un sex toy (anche inventato)', 'Un posto strano dove fare sesso',
  'Qualcosa che trovi in un sexy shop', 'Il titolo di un film porno (parodia)', 'Un nome da pornostar',
  'Una frase da non dire mai a letto', 'Una scusa per non fare sesso', 'Un afrodisiaco (anche inventato)',
  'Un oggetto di casa che diventa un sex toy', 'Un soprannome per le parti intime', 'Un rumore che si sente dalla camera accanto',
  'Una cosa che trovi nel comodino di un single', 'Una cosa che trovi nel letto dopo una notte brava', 'Un fetish (anche inventato)',
  'Una malattia che ti becchi in vacanza', 'Una frase da sexting', 'Un ortaggio dalla forma sospetta',
  'Un travestimento sexy', 'Un costume da gioco di ruolo a letto', 'Una cosa da comprare in farmacia con vergogna',
  // Corpi e fluidi
  'Un fluido corporeo', 'Una cosa che esce dal corpo', 'Una parte del corpo che puzza', 'Un sinonimo di vomitare',
  'Un modo elegante per dire scoreggia', 'Un sinonimo di cacca', 'Un posto dove fare pipì all\'aperto',
  'Una cosa che trovi in un bagno pubblico', 'Una cosa schifosa nello scarico della doccia', 'Un sintomo imbarazzante',
  'Una cosa che non vuoi trovare in piscina', 'Un pelo in un posto strano', 'Una cosa che si gratta di nascosto',
  'Una cosa che si fa da soli in bagno', 'Qualcosa che sa di ascella',
  // Alcol, fumo e sostanze
  'Un superalcolico', 'Un sinonimo di ubriaco', 'Un drink da vecchi', 'Un liquore fatto in casa dal nonno',
  'Un gioco alcolico', 'Un effetto collaterale della sbronza', 'Un posto dove vomitare con dignità',
  'Qualcosa che si fuma (anche di legale)', 'Una cosa che vedi dopo i funghetti', 'Una scusa da dire all\'alcoltest',
  'Una cosa che fai alle 5 di mattina dopo la discoteca', 'Un brindisi volgare',
  // Morte e funerali
  'Un modo stupido di morire', 'Una cosa da mettere nella bara', 'Una canzone da funerale', 'Una frase da non dire a un funerale',
  'Qualcosa che trovi in un cimitero', 'Un mestiere legato alla morte', 'Un modo di dire "è morto"', 'Un\'arma del delitto',
  'Un veleno', 'Una causa di morte ridicola', 'Un desiderio scritto nel testamento', 'Una cosa da lasciare in eredità alla suocera',
  'Un epitaffio da lapide', 'Un posto dove spargere le ceneri', 'Un ultimo desiderio del condannato',
  'Qualcosa che il morto non vorrebbe vedere al suo funerale', 'Un modo per morire in un film horror',
  // Ospedali, malattie e vecchiaia
  'Una malattia', 'Un esame medico imbarazzante', 'Qualcosa che trovi al pronto soccorso', 'Un oggetto finito dove non doveva',
  'Una medicina', 'Un medico specialista', 'Un\'operazione chirurgica', 'Un acciacco della vecchiaia',
  'Qualcosa che trovi in una casa di riposo', 'Una frase tipica dei vecchi', 'Una cosa che si perde con l\'età',
  'Una cosa che fa un nonno arrapato', 'Una cosa nel bicchiere sul comodino della nonna', 'Un rumore che fa il nonno a tavola',
  // Inferno, santi e Bibbia
  'Un peccato capitale', 'Un santo', 'Un personaggio della Bibbia', 'Un miracolo (anche inventato)', 'Un nome del diavolo',
  'Una punizione dell\'inferno', 'Qualcosa che trovi in chiesa', 'Una cosa che il prete non deve sapere',
  'Un comandamento (anche inventato)', 'Una cosa da confessare', 'Una cosa che fa una suora di nascosto',
  'Un motivo per finire all\'inferno', 'Un\'imprecazione che non sia una bestemmia', 'Un santo protettore inventato',
  'Una reliquia (anche inventata)', 'Una cosa che Gesù farebbe oggi', 'Un lavoro per Giuda dopo la pensione',
  'Un dono dei Re Magi (aggiornato al 2026)', 'Un nuovo miracolo per Padre Pio', 'Una cosa che il Papa fa in vacanza',
  'Un\'app che userebbe Dio', 'Una cosa che si dice a San Pietro per entrare',
  // VIP e personaggi famosi
  'Un VIP rifatto', 'Un cantante stonato', 'Un tormentone estivo da vietare', 'Un calciatore scarso ma pagato tanto',
  'Un VIP da spedire su un\'isola deserta', 'Un influencer insopportabile', 'Un personaggio trash della TV',
  'Un politico del passato', 'Un reality show trash', 'Un VIP che vorresti alla tua festa di laurea',
  'Una cosa nella valigia di Briatore', 'Un prodotto che la Ferragni non dovrebbe vendere', 'Un insulto alla Sgarbi',
  'Un VIP che sembra immortale', 'Un ex calciatore diventato opinionista', 'Un cantante che dovrebbe ritirarsi',
  // Vita adulta disperata
  'Una scusa per non andare a un matrimonio', 'Una bugia da dire alla suocera', 'Una cosa che fai in ufficio quando il capo non c\'è',
  'Una cosa che compri ubriaco su Amazon', 'Una cosa nel gruppo WhatsApp dei genitori', 'Una cosa da non dire al ginecologo',
  'Un motivo per divorziare', 'Un regalo per l\'amante', 'Una cosa che trovi nella cronologia del partner',
  'Una frase da dire dopo il primo bacio', 'Una cosa che non vuoi sentire in sala parto', 'Una cosa da fare in un motel a ore',
];
