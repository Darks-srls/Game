import { LocationItem } from '../types/game';

export const LOCATION_CATEGORIES = [
  'Viaggi & Mezzi',
  'Città & Servizi',
  'Svago & Locali',
  'Lavoro & Studio',
  'Mistero & Avventura'
];

export const DEFAULT_LOCATIONS: LocationItem[] = [
  // Viaggi & Mezzi
  {
    id: 'aereo',
    name: 'Aereo di Linea',
    category: 'Viaggi & Mezzi',
    icon: '✈️',
    description: 'In volo a 10.000 metri di quota, tra turbolenze e carrelli dei pasti.',
    roles: [
      'Comandante di Volo',
      'Assistente di Volo',
      'Passeggero di Prima Classe',
      'Maresciallo dell\'Aria in Incognito',
      'Bambino Monello col Sedile Reclinato',
      'Passeggero Ansioso con Paura di Volare',
      'Co-pilota Addormentato',
      'Viaggiatore col Cane nella Borsa'
    ]
  },
  {
    id: 'sottomarino',
    name: 'Sottomarino Militare',
    category: 'Viaggi & Mezzi',
    icon: '🌊',
    description: 'Nelle profondità oceaniche, tra luci soffuse e il bip del sonar.',
    roles: [
      'Capitano di Vascello',
      'Operatore Sonar',
      'Ingegnere dei Motori Nucleari',
      'Cannoniere dei Siluri',
      'Cuoco di Bordo sotto Pressione',
      'Marinaio di Guardia al Periscopio',
      'Medico di Bordo',
      'Ufficiale alle Comunicazioni Cifrate'
    ]
  },
  {
    id: 'treno_alta_velocita',
    name: 'Treno ad Alta Velocità',
    category: 'Viaggi & Mezzi',
    icon: '🚄',
    description: 'Freccia che sfreccia a 300 km/h tra gallerie e telefonate di lavoro.',
    roles: [
      'Capotreno Severo',
      'Macchinista alla Guida',
      'Barista del Vagone Bistrò',
      'Manager con Computer Portatile',
      'Controllore dei Biglietti',
      'Passeggero che Ascolta Musica senza Cuffie',
      'Studente Pendolare che Studia',
      'Turista col Trolley Sovradimensionato'
    ]
  },
  {
    id: 'nave_crociera',
    name: 'Nave da Crociera',
    category: 'Viaggi & Mezzi',
    icon: '🚢',
    description: 'Un mastodonte dei mari con buffet 24 ore su 24 e piscine panoramiche.',
    roles: [
      'Comandante in Alta Uniforme',
      'Animatore Turistico Iperattivo',
      'Passeggero con Mal di Mare',
      'Barman di Piscina Tropicale',
      'Ballerina del Teatro di Bordo',
      'Ospite al Buffet di Mezzanotte',
      'Bagnino dell\'Idromassaggio',
      'Fotografo Ufficiale di Crociera'
    ]
  },
  {
    id: 'stazione_spaziale',
    name: 'Stazione Spaziale Internazionale',
    category: 'Viaggi & Mezzi',
    icon: '🛰️',
    description: 'In orbita terrestre in assenza di gravità e tute pressurizzate.',
    roles: [
      'Comandante della Spedizione',
      'Astrobiologo delle Piante Idroponiche',
      'Ingegnere dei Pannelli Solari',
      'Medico Spaziale',
      'Turista Miliardario Fuggito nello Spazio',
      'Cosmonauta al Braccio Robotico',
      'Pilota della Capsula di Rientro',
      'Specialista delle Telecomunicazioni con la Terra'
    ]
  },
  {
    id: 'traghetto',
    name: 'Traghetto Notturno',
    category: 'Viaggi & Mezzi',
    icon: '⛴️',
    description: 'Tra il vento sul ponte scoperto, garage colmi di auto e poltrone numerate.',
    roles: [
      'Nostromo di Bordo',
      'Addetto al Parcheggio nella Stiva',
      'Camionista in Pausa',
      'Passeggero che Dorme sul Pavimento col Sacco a Pelo',
      'Barista del Salone Panoramico',
      'Gabbiano A bordo Ponte',
      'Famiglia in Partenza per le Vacanze',
      'Timoniere sul Ponte di Comando'
    ]
  },

  // Città & Servizi
  {
    id: 'ospedale',
    name: 'Ospedale Generale',
    category: 'Città & Servizi',
    icon: '🏥',
    description: 'Sirene, camici bianchi, odore di disinfettante e annunci all\'altoparlante.',
    roles: [
      'Primario di Chirurgia',
      'Infermiere del Pronto Soccorso',
      'Paziente Ingessato su Sedia a Rotelle',
      'Anestesista Prima dell\'Intervento',
      'Parente Ansioso in Sala d\'Attesa',
      'Specializzando al Primo Giorno di Tirocinio',
      'Barelliere di Turno di Notte',
      'Addetto alle Radiografie'
    ]
  },
  {
    id: 'banca',
    name: 'Banca Centrale',
    category: 'Città & Servizi',
    icon: '🏦',
    description: 'Caveau blindati, banconote che scorrono e guardie giurate vigili.',
    roles: [
      'Direttore di Filiale',
      'Cassiere Dietro il Vetro Blindato',
      'Guardia Giurata Armata',
      'Cliente Indeciso sul Mutuo',
      'Addetto alla Custodia del Caveau',
      'Ladro in Giacca e Cravatta',
      'Pensionato che Ritira la Pensione in Contanti',
      'Tecnico dell\'Allarme e Videosorveglianza'
    ]
  },
  {
    id: 'stazione_polizia',
    name: 'Stazione di Polizia',
    category: 'Città & Servizi',
    icon: '🚔',
    description: 'Stanza degli interrogatori, schedari polverosi e caffè della macchinetta.',
    roles: [
      'Commissario di Polizia',
      'Detective in Borghese',
      'Sospettato in Manette',
      'Avvocato Difensore',
      'Agente di Pattuglia',
      'Testimone Chiave Oculare',
      'Archivista dei Casi Irrisolti',
      'Tecnico della Scientifica con le Impronte'
    ]
  },
  {
    id: 'caserma_pompieri',
    name: 'Caserma dei Pompieri',
    category: 'Città & Servizi',
    icon: '🚒',
    description: 'Palo della discesa, autopompe tirate a lucido e allarmi improvvisi.',
    roles: [
      'Caposquadra Vigili del Fuoco',
      'Autista dell\'Autopompa',
      'Idrante sul Cestello Elevatore',
      'Centralinista del 115',
      'Istruttore Cinofilo col Cane da Ricerca',
      'Pompiere Volontario Recluta',
      'Meccanico dei Mezzi Pesanti',
      'Veterano che Cucina la Pasta per Tutti'
    ]
  },
  {
    id: 'supermercato',
    name: 'Supermercato Affollato',
    category: 'Città & Servizi',
    icon: '🛒',
    description: 'Carrelli cigolanti, offerte 3x2 e annunci di casse aperte.',
    roles: [
      'Cassiera Superveloce',
      'Addetto al Banco Gastronomia',
      'Direttore del Punto Vendita',
      'Cliente che Cerca il Buono Sconto Scaduto',
      'Addetto alla Riorganizzazione Scaffali',
      'Vigilante Antitaccheggio',
      'Promoter che Fa Assaggiare Salumi',
      'Bambino Aggrappato al Carrello'
    ]
  },
  {
    id: 'tribunale',
    name: 'Tribunale di Giustizia',
    category: 'Città & Servizi',
    icon: '⚖️',
    description: 'Toghe nere, martelletti di legno e "Silenzio in aula!".',
    roles: [
      'Giudice con Martello',
      'Pubblico Ministero Accusatore',
      'Avvocato Difensore Teatrale',
      'Imputato Innervosito',
      'Cancelliere che Trascrive Tutto',
      'Presidente della Giuria Popolare',
      'Testimone sotto Giuramento',
      'Agente Penitenziario di Scorta'
    ]
  },

  // Svago & Locali
  {
    id: 'ristorante_stellato',
    name: 'Ristorante Stellato',
    category: 'Svago & Locali',
    icon: '🍽️',
    description: 'Porzioni gourmet minuscole su piatti giganteschi e calici di cristallo.',
    roles: [
      'Chef Stellato Perfezionista',
      'Maître di Sala Impeccabile',
      'Sommelier con Calice d\'Annata',
      'Critico Gastronomico Michelin Anonimo',
      'Sous-Chef nel Panico',
      'Lavapiatti Sommerso dalle Stoviglie',
      'Cliente VIP che Chiede Variazioni al Menu',
      'Cameriere con Vassoio in Equilibrio'
    ]
  },
  {
    id: 'casino',
    name: 'Casinò di Montecarlo',
    category: 'Svago & Locali',
    icon: '🎰',
    description: 'Fiches sul panno verde, roulette che gira e luci ipnotiche.',
    roles: [
      'Croupier di Blackjack',
      'Giocatore d\'Azzardo Professionista',
      'Buttafuori in Smoking',
      'Milionario che Punta Tutto sul Rosso',
      'Barman di Cocktail Martini',
      'Ispettore della Sala Conta',
      'Turista con l\'Ultima Moneta nella Slot',
      'Truccatore di Carte Nascosto'
    ]
  },
  {
    id: 'spiaggia_caraibica',
    name: 'Spiaggia Caraibica',
    category: 'Svago & Locali',
    icon: '🏖️',
    description: 'Sabbia bianca, palme ondeggianti, crema solare e onde turchesi.',
    roles: [
      'Bagnino sulla Torretta',
      'Venditore di Cocco e Cocomero',
      'Turista Totalmente Ustionato dal Sole',
      'Surfista in Attesa dell\'Onda Perfetta',
      'DJ del Chiringuito',
      'Costruttore di Castelli di Sabbia',
      'Sub con Boccaglio e Maschera',
      'Ragazzo con Cassa Bluetooth a Massimo Volume'
    ]
  },
  {
    id: 'cinema',
    name: 'Cinema Multisala',
    category: 'Svago & Locali',
    icon: '🍿',
    description: 'Odore di popcorn caldo, poltrone rosse e maxi schermi oscurati.',
    roles: [
      'Proiezionista in Cabina',
      'Maschera con Torcia Tascabile',
      'Spettatore col Secchiello Popcorn Gigante',
      'Cassiere della Biglietteria',
      'Critico Cinematografico col Taccuino',
      'Ragazzo che Fa Rumore coi Pacchetti di Patatine',
      'Coppia al Primo Appuntamento nell\'Ultima Fila',
      'Regista del Film in Visita a Sorpresa'
    ]
  },
  {
    id: 'stadio',
    name: 'Stadio di Calcio',
    category: 'Svago & Locali',
    icon: '⚽',
    description: 'Oltre 60.000 tifosi che urlano cori, fumogeni e campo verde brillante.',
    roles: [
      'Arbitro Contestato da Tutti',
      'Bomber di Punta della Squadra',
      'Capo Ultrà con Megafono',
      'Telecronista Sportivo Esaltato',
      'Allenatore Furioso a Bordo Campo',
      'Raccattapalle Distratto',
      'Venditore di Bibite e Noccioline',
      'Guardia di Sicurezza tra gli Spalti'
    ]
  },
  {
    id: 'discoteca',
    name: 'Discoteca Underground',
    category: 'Svago & Locali',
    icon: '🪩',
    description: 'Bassi martellanti, laser stroboscopici, nebbia artificiale e code ai bagni.',
    roles: [
      'DJ Resident alla Consolle',
      'Buttafuori Gigantesco all\'Ingresso',
      'Barman Acrobatico',
      'Ballerino Scatenato al Centro della Pista',
      'Promoter di Liste e Tavoli VIP',
      'Guardarobiera Disperata',
      'Festeggiato di Addio al Celibato',
      'Proprietario del Club col Sigaro'
    ]
  },
  {
    id: 'pizzeria',
    name: 'Pizzeria di Quartiere',
    category: 'Svago & Locali',
    icon: '🍕',
    description: 'Forno a legna ardente, profumo di basilico e pomodoro, e tavoli di legno.',
    roles: [
      'Pizzaiolo Campione con Pala da Forno',
      'Fattorino col Motorino e Scaldabagno Termico',
      'Fornaio che Alimenta il Fuoco coi Ciocchi',
      'Cliente Abituale al Banco',
      'Cameriere che Si Ricorda le Ordinazioni a Memoria',
      'Bambino con le Mani Imbrattate di Farina',
      'Titolare alla Cassa',
      'Fornitore di Fior di Latte della Campania'
    ]
  },
  {
    id: 'terme_spa',
    name: 'Centro Benessere & Spa',
    category: 'Svago & Locali',
    icon: '🧖',
    description: 'Vapore d\'eucalipto, musica zen tibetana e accappatoi bianchi morbidi.',
    roles: [
      'Maestro di Sauna Aufguss col Telo',
      'Massaggiatore Olistico con Oli Essenziali',
      'Cliente Addormentato sul Lettino Relax',
      'Estetista che Fa Fanghi Termali',
      'Istruttrice di Yoga Idroterapico',
      'Receptionist della Zona Benessere',
      'Ospite con Tisana Drenante in Mano',
      'Manutentore delle Vasche Idromassaggio'
    ]
  },

  // Lavoro & Studio
  {
    id: 'scuola',
    name: 'Scuola Superiore',
    category: 'Lavoro & Studio',
    icon: '🏫',
    description: 'Cancellini polverosi, campanelle che suonano e bigliettini nascosti.',
    roles: [
      'Professore di Matematica che Interroga',
      'Studente nell\'Ultimo Banco che Dorme',
      'Preside Rigido che Fa il Giro delle Aule',
      'Bidello che Custodisce i Gessetti e la Fotocopiatrice',
      'Rappresentante d\'Istituto Ribelle',
      'Secchione col Quaderno Aperto',
      'Studente che Chiede di Andare in Bagno da Mezz\'ora',
      'Insegnante di Ginnastica con Fischietto'
    ]
  },
  {
    id: 'universita',
    name: 'Aula Magna Universitaria',
    category: 'Lavoro & Studio',
    icon: '🎓',
    description: 'Cattedra in legno, gradinate piene di laptop e ansia da esame imminente.',
    roles: [
      'Professore Ordinario Emerito',
      'Studente Fuoricorso Rassegnato',
      'Dottorando Sfruttato e Stressato',
      'Matricola che Prende Appunti su Ogni Singola Parola',
      'Bibliotecario Custode dei Testi Rari',
      'Rappresentante del Collettivo Studentesco',
      'Candidato che Discute la Tesi di Laurea',
      'Tecnico che Cerca di Far Funzionare il Proiettore'
    ]
  },
  {
    id: 'ufficio_tech',
    name: 'Ufficio Startup Hi-Tech',
    category: 'Lavoro & Studio',
    icon: '💻',
    description: 'Open space, tavoli da ping-pong, post-it colorati e macchine del caffè espresso.',
    roles: [
      'CEO Visionario in Dolcevita Nero',
      'Programmatore Senior con le Cuffie Noise-Cancelling',
      'Product Manager con Trello Pieno di Task',
      'Stagista che Sistema le Sedie da Ufficio',
      'Designer UI/UX con la Tavoletta Grafica',
      'Responsabile Risorse Umane Sorridente',
      'Ingegnere DevOps che Spegne Incendi sui Server',
      'Social Media Specialist col Telefono in Mano'
    ]
  },
  {
    id: 'cantiere',
    name: 'Cantiere Edile',
    category: 'Lavoro & Studio',
    icon: '🏗️',
    description: 'Betoniere in azione, elmetti gialli, polvere di cemento e impalcature.',
    roles: [
      'Capocantiere con Voce Tonante',
      'Gruista a 60 Metri d\'Altezza',
      'Geometra con le Mappe di Progetto',
      'Muratore Maestro con la Cazzuola',
      'Ispettore della Sicurezza sul Lavoro',
      'Elettricista tra i Cavi dell\'Impianto',
      'Saldatore con la Maschera a Scudo',
      'Autista del Camion di Ghiaia'
    ]
  },
  {
    id: 'laboratorio',
    name: 'Laboratorio Scientifico Segreto',
    category: 'Lavoro & Studio',
    icon: '🧪',
    description: 'Microscopi elettronici, provette fumanti di azoto liquido e tute biohazard.',
    roles: [
      'Scienziato Premio Nobel',
      'Assistente di Laboratorio col Camice Bruciacchiato',
      'Ingegnere Genetico col Pipettatore',
      'Cavia Umana Esitante',
      'Ispettore delle Sostanze Pericolose',
      'Robot Autonomo Programmabile',
      'Fisico Teorico che Scrive Equazioni sul Vetro',
      'Guardia di Sicurezza con Scanner Retinico'
    ]
  },
  {
    id: 'museo',
    name: 'Museo di Storia e d\'Arte',
    category: 'Lavoro & Studio',
    icon: '🏛️',
    description: 'Dipinti rinascimentali inestimabili, teche di vetro e guardie con laser.',
    roles: [
      'Curatore Generale del Museo',
      'Guida Turistica con l\'Ombrellino Colorato',
      'Guardia Giurata Notturna col Fischietto',
      'Restauratore d\'Opere Antiche con Pennellino',
      'Turista Giapponese con Fotocamera Reflex',
      'Critico d\'Arte con Monocolo e Sciarpa',
      'Ladruncolo che Studia le Telecamere',
      'Scolaro che Tocca il Quadro Nonostante i Cartelli'
    ]
  },

  // Mistero & Avventura
  {
    id: 'nave_pirata',
    name: 'Galeone Pirata',
    category: 'Mistero & Avventura',
    icon: '🏴‍☠️',
    description: 'Vele nere stracciate, cannoni pronti a sparare e casse piene di dobloni d\'oro.',
    roles: [
      'Capitano Pirata con Gamba di Legno',
      'Primo Ufficiale col Pappagallo sulla Spalla',
      'Vedetta sulla Cesta dell\'Albero Maestro',
      'Cannoniere con la Miccia Accesa',
      'Prigioniero Legato all\'Asse',
      'Cuoco di Bordo che Prepara Rancio Dubbio',
      'Mozzo che Pulisce il Ponte Bagnato',
      'Marinaio Ammutinato con la Mappa del Tesoro'
    ]
  },
  {
    id: 'castello_medievale',
    name: 'Castello Medievale',
    category: 'Mistero & Avventura',
    icon: '🏰',
    description: 'Ponte levatoio, armature lucenti nella sala del trono e torce alle pareti.',
    roles: [
      'Re Seduto sul Trono',
      'Cavaliere in Armatura Completa',
      'Giullare di Corte con Sonagli',
      'Mago Consigliere Alchimista',
      'Arciere sulla Torre di Vedetta',
      'Fabbro del Castello',
      'Principessa Prigioniera della Torre',
      'Cuoco del Banchetto Medievale col Cinghiale'
    ]
  },
  {
    id: 'bunker_atomico',
    name: 'Bunker Sotterraneo Anti-Atomico',
    category: 'Mistero & Avventura',
    icon: '☢️',
    description: 'Porta d\'acciaio di 2 metri, scorte di cibo liofilizzato e contatori Geiger.',
    roles: [
      'Comandante dei Sopravvissuti',
      'Medico con Maschera Antigas',
      'Tecnico dei Generatori d\'Ossigeno',
      'Coltivatore di Piante Idroponiche',
      'Soldato Nervoso a Guardia della Botola',
      'Bambino Nato dopo l\'Apocalisse',
      'Radioamatore che Cerca Segnali di Vita Esterni',
      'Magazziniere delle Razioni Alimentari'
    ]
  },
  {
    id: 'circo',
    name: 'Circo Itinerante',
    category: 'Mistero & Avventura',
    icon: '🎪',
    description: 'Tendone a strisce rosse e bianche, musica di fanfara e spettacoli mozzafiato.',
    roles: [
      'Direttore del Circo col Cilindro',
      'Domatore di Leoni con Frusta',
      'Trapezista che Vola a 15 Metri da Terra',
      'Clown con la Scarpa Gigante',
      'Mago Illusionista con la Scatola a Doppioricamo',
      'Mangiatore di Spade e Fuoco',
      'Venditore di Zucchero Filato e Noccioline',
      'Contorsionista Flessibile'
    ]
  }
];
