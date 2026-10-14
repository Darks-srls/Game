// 🤐 Parola proibita: "PAROLA: le cinque parole vietate"
const RAW = `
Pizza: forno, Napoli, mozzarella, pomodoro, margherita
Spiaggia: mare, sabbia, ombrellone, estate, costume
Calcio: pallone, gol, squadra, partita, porta
Natale: dicembre, regali, albero, Babbo, presepe
Gatto: miagolare, animale, topo, felino, coda
Cane: abbaiare, animale, osso, guinzaglio, cuccia
Scuola: professore, studenti, classe, compiti, lezione
Ospedale: medico, malato, infermiere, pronto soccorso, cura
Treno: binario, stazione, vagone, biglietto, ferrovia
Aereo: volare, pilota, aeroporto, ali, viaggio
Telefono: chiamare, cellulare, numero, squillare, smartphone
Gelato: freddo, cono, coppetta, gusti, estate
Caffè: bar, tazzina, espresso, moka, colazione
Compleanno: torta, candeline, festa, anni, auguri
Matrimonio: sposi, chiesa, anello, sposa, nozze
Montagna: neve, sci, vetta, alta, scalare
Cinema: film, schermo, popcorn, biglietto, sala
Chitarra: corde, suonare, strumento, musica, accordi
Dentista: denti, carie, trapano, bocca, medico
Supermercato: spesa, carrello, cassa, scaffali, comprare
Vampiro: sangue, Dracula, denti, notte, aglio
Pirata: nave, tesoro, benda, uncino, mare
Astronauta: spazio, razzo, luna, NASA, tuta
Ombrello: pioggia, aprire, bagnato, manico, ripararsi
Specchio: riflesso, guardarsi, vetro, immagine, bagno
Frigorifero: freddo, cucina, cibo, freezer, elettrodomestico
Bicicletta: pedali, ruote, sella, pedalare, catena
Libro: leggere, pagine, scrittore, biblioteca, romanzo
Orologio: ore, tempo, polso, lancette, minuti
Sole: caldo, luce, cielo, estate, stella
Luna: notte, cielo, piena, satellite, astronauta
Pioggia: acqua, ombrello, nuvole, bagnato, temporale
Neve: bianca, freddo, inverno, fiocchi, pupazzo
Polizia: agente, arresto, sirena, ladro, divisa
Pompiere: fuoco, incendio, idrante, sirena, spegnere
Cuoco: cucina, chef, ricetta, cucinare, ristorante
Banana: frutta, gialla, scimmia, buccia, sbucciare
Mela: frutta, rossa, albero, morso, Newton
Uovo: gallina, guscio, tuorlo, frittata, Pasqua
Vino: rosso, bianco, uva, bicchiere, cantina
Birra: schiuma, bionda, boccale, pub, luppolo
Spaghetti: pasta, sugo, forchetta, lunghi, carbonara
Lasagne: forno, sfoglia, ragù, besciamella, strati
Panettone: Natale, canditi, uvetta, Milano, dolce
Carnevale: maschere, coriandoli, febbraio, sfilata, costume
Halloween: zucca, dolcetto, scherzetto, ottobre, streghe
Pasqua: uovo, colomba, coniglio, aprile, cioccolato
Vacanza: viaggio, ferie, mare, riposo, estate
Valigia: viaggio, vestiti, rotelle, aeroporto, bagaglio
Passaporto: documento, viaggio, foto, estero, frontiera
Zaino: spalle, scuola, borsa, cerniera, escursione
Tenda: campeggio, dormire, picchetti, sacco a pelo, montare
Castello: re, regina, torre, principessa, medievale
Drago: fuoco, ali, cavaliere, sputare, leggenda
Fantasma: lenzuolo, spirito, paura, morto, castello
Strega: scopa, pozione, cappello, magia, Halloween
Mago: magia, bacchetta, coniglio, cappello, trucco
Robot: macchina, metallo, intelligenza, artificiale, androide
Dinosauro: estinto, T-Rex, preistoria, fossile, Jurassic
Squalo: mare, denti, pinna, pesce, attacco
Leone: re, foresta, criniera, ruggire, savana
Elefante: proboscide, grande, orecchie, Africa, avorio
Giraffa: collo, lungo, Africa, macchie, alta
Pinguino: ghiaccio, Polo, uccello, nuotare, bianco e nero
Ape: miele, pungere, alveare, insetto, fiori
Zanzara: puntura, prurito, insetto, estate, ronzio
Ragno: tela, zampe, insetto, otto, Spider-Man
Serpente: veleno, strisciare, rettile, sibilare, cobra
Coccodrillo: denti, rettile, fiume, verde, alligatore
Mucca: latte, muggire, fattoria, macchie, toro
Gallina: uovo, pollo, fattoria, coccodè, gallo
Cavallo: galoppo, sella, criniera, nitrire, cavaliere
Coniglio: carote, orecchie, saltare, Pasqua, lepre
Delfino: mare, intelligente, salto, mammifero, acquario
Farfalla: ali, bruco, colori, volare, fiori
Televisione: schermo, telecomando, canale, guardare, programma
Computer: tastiera, mouse, schermo, internet, PC
Internet: rete, Wi-Fi, sito, online, Google
Instagram: foto, social, like, storie, follower
WhatsApp: messaggi, chat, gruppo, vocale, spunta
Selfie: foto, telefono, faccia, scattare, Instagram
Videogioco: giocare, console, PlayStation, livello, joystick
Palestra: pesi, allenamento, muscoli, tapis roulant, abbonamento
Piscina: nuotare, acqua, cuffia, vasca, tuffo
Tennis: racchetta, pallina, rete, campo, set
Basket: canestro, pallone, NBA, tiro, palleggio
Sci: neve, montagna, piste, scarponi, discesa
Olimpiadi: medaglia, oro, sport, atleti, quattro anni
Ferrari: rossa, auto, Formula 1, Maranello, cavallino
Roma: capitale, Colosseo, Italia, Papa, Tevere
Venezia: gondola, canali, laguna, ponte, San Marco
Parigi: Francia, Torre Eiffel, capitale, Louvre, francese
Colosseo: Roma, gladiatori, anfiteatro, antico, monumento
Torre di Pisa: pendente, storta, Toscana, monumento, campanile
Babbo Natale: barba, regali, renne, slitta, dicembre
Befana: scopa, calza, carbone, gennaio, vecchia
Topolino: Disney, topo, Minnie, orecchie, Paperino
Harry Potter: mago, Hogwarts, bacchetta, occhiali, cicatrice
Superman: mantello, volare, Kryptonite, supereroe, Clark Kent
Batman: pipistrello, Gotham, mantello, Joker, Robin
Shrek: orco, verde, palude, Ciuchino, Fiona
Cenerentola: scarpetta, principe, mezzanotte, zucca, matrigna
Pinocchio: naso, bugie, legno, Geppetto, burattino
Biancaneve: nani, mela, specchio, strega, principe
Sirena: coda, mare, pesce, Ariel, sirenetta
Unicorno: corno, cavallo, arcobaleno, magico, bianco
Arcobaleno: colori, pioggia, cielo, sette, sole
Vulcano: lava, eruzione, Etna, fuoco, montagna
Terremoto: scossa, tremare, scala, Richter, crollo
Deserto: sabbia, caldo, cammello, Sahara, dune
Isola: mare, acqua, circondata, deserta, spiaggia
Bosco: alberi, foresta, legno, funghi, sentiero
Fiume: acqua, scorrere, ponte, Po, sponda
Ponte: attraversare, fiume, collegare, sopra, costruire
Ascensore: piani, salire, scendere, pulsante, palazzo
Scale: gradini, salire, scendere, piani, ringhiera
Letto: dormire, cuscino, materasso, lenzuola, camera
Divano: sedersi, salotto, cuscini, televisione, sdraiarsi
Doccia: acqua, lavarsi, bagno, sapone, shampoo
Spazzolino: denti, dentifricio, lavare, bagno, setole
Sveglia: mattina, suonare, svegliarsi, orologio, dormire
Lunedì: settimana, giorno, domenica, lavoro, inizio
Compiti: scuola, casa, esercizi, professore, studiare
Esame: voto, studiare, università, bocciato, prova
Lavoro: ufficio, stipendio, capo, colleghi, lavorare
Banca: soldi, conto, prestito, bancomat, cassiere
Ristorante: mangiare, cameriere, menù, cena, conto
Mancia: soldi, cameriere, extra, ristorante, lasciare
Barbiere: capelli, tagliare, barba, forbici, rasoio
Tatuaggio: pelle, inchiostro, ago, disegno, tatuatore
Occhiali: vista, lenti, occhi, vedere, montatura
Cappello: testa, indossare, berretto, sole, visiera
Scarpe: piedi, lacci, tacco, camminare, paio
Calzini: piedi, paio, lavatrice, spaiati, scarpe
Pigiama: dormire, notte, letto, vestito, camicia
Lavatrice: lavare, vestiti, bucato, centrifuga, detersivo
Aspirapolvere: polvere, pulire, pavimento, tappeto, rumore
Semaforo: rosso, verde, giallo, incrocio, strada
Autostrada: auto, casello, corsie, traffico, Autogrill
Benzina: auto, distributore, carburante, pieno, diesel
Taxi: auto, tassista, corsa, giallo, passaggio
Metropolitana: treno, sotterranea, fermata, città, binari
Bambola: giocattolo, bambina, Barbie, capelli, vestiti
Puzzle: pezzi, incastrare, immagine, gioco, tessere
Scacchi: re, regina, scacchiera, pedone, mossa
Carte: mazzo, giocare, poker, scopa, asso
Lotteria: biglietto, vincere, numeri, fortuna, premio
Autogrill: autostrada, panino, sosta, Camogli, benzina
Barbecue: griglia, carne, brace, giardino, salsiccia
Bagnino: spiaggia, fischietto, salvare, mare, piscina
Ballerina: danza, tutù, punte, ballare, teatro
Biblioteca: libri, silenzio, prestito, studiare, leggere
Bowling: birilli, palla, strike, pista, scarpe
Calcetto: amici, campo, pallone, cinque, partita
Campeggio: tenda, sacco a pelo, natura, roulotte, fuoco
Cartoleria: penne, quaderni, scuola, matite, zaino
Circo: clown, tendone, acrobata, leone, giocoliere
Cornetto: colazione, bar, crema, cappuccino, brioche
Elicottero: eliche, volare, pilota, atterrare, soccorso
Estate: caldo, vacanze, mare, luglio, agosto
Faro: luce, mare, navi, torre, costa
Farmacia: medicine, ricetta, croce verde, farmacista, pillole
Formaggio: latte, parmigiano, mozzarella, grattugiato, topo
Fotografia: foto, macchina fotografica, scatto, selfie, immagine
Fulmine: temporale, tuono, cielo, elettricità, lampo
Fungo: bosco, porcino, velenoso, Super Mario, cappello
Gioielleria: anello, oro, collana, diamante, orecchini
Hamburger: panino, McDonald's, carne, patatine, ketchup
TikTok: video, balletti, social, trend, scrollare
Netflix: serie, film, abbonamento, divano, streaming
YouTube: video, youtuber, canale, iscriviti, pubblicità
Influencer: Instagram, follower, sponsor, social, Ferragni
Playstation: console, videogiochi, Sony, joystick, giocare
Fortnite: videogioco, battle royale, balletti, skin, isola
Minecraft: blocchi, videogioco, creeper, costruire, cubi
Wi-Fi: internet, password, connessione, router, segnale
Password: segreta, accesso, lettere, dimenticata, account
Caricabatterie: telefono, cavo, presa, batteria, carica
Emoji: faccine, messaggi, WhatsApp, ridere, cuore
Weekend: sabato, domenica, riposo, uscire, settimana
Vacanze: viaggio, estate, ferie, mare, riposo
Patente: guidare, esame, macchina, scuola guida, documento
Parcheggio: macchina, posto, multa, garage, strisce
Multa: vigile, pagare, divieto, sosta, verbale
Monopattino: elettrico, ruote, città, guidare, marciapiede
Nave da crociera: mare, viaggio, cabina, turisti, porto
Sottomarino: mare, sott'acqua, periscopio, profondità, nave
Razzo: spazio, lancio, astronauta, missile, decollo
Alieno: UFO, spazio, extraterrestre, Marte, verde
Zombie: morto, vivente, cervelli, mordere, apocalisse
Supereroe: poteri, mantello, salvare, Superman, eroe
Pagliaccio: circo, naso rosso, ridere, trucco, parrucca
Cowboy: cavallo, Far West, cappello, pistola, America
Ninja: Giappone, spada, nero, arti marziali, silenzioso
Principessa: castello, principe, corona, Disney, regina
Foresta: alberi, bosco, animali, verde, legno
Oceano: mare, acqua, Pacifico, Atlantico, onde
Scimmia: banana, albero, primate, gorilla, saltare
Pizzeria: pizza, forno, pizzaiolo, margherita, cameriere
Sushi: Giappone, pesce, riso, crudo, bacchette
Kebab: carne, panino, turco, salsa, cipolla
Lasagna: pasta, forno, besciamella, ragù, strati
Carbonara: pasta, uova, guanciale, pecorino, Roma
Tiramisù: dolce, caffè, mascarpone, savoiardi, cacao
Nutella: cioccolato, nocciole, barattolo, pane, crema
Popcorn: mais, cinema, scoppiare, sale, burro
Patatine fritte: patate, sale, ketchup, McDonald's, olio
Cioccolato: dolce, cacao, tavoletta, latte, fondente
Capodanno: mezzanotte, fuochi, brindisi, anno nuovo, dicembre
Ferragosto: agosto, vacanze, mare, grigliata, quindici
San Valentino: amore, cuore, febbraio, cioccolatini, coppia
Sanremo: festival, canzoni, Ariston, Amadeus, febbraio
Eurovision: canzoni, Europa, gara, Måneskin, voti
Mondiali: calcio, nazionale, coppa, quattro anni, partite
Formula 1: macchine, Ferrari, gara, pilota, circuito
Yoga: meditazione, tappetino, posizioni, rilassarsi, respiro
Maratona: correre, chilometri, quarantadue, gara, traguardo
Pallavolo: rete, schiacciata, palla, squadra, Egonu
Arbitro: fischietto, partita, cartellino, rigore, calcio
Rigore: calcio, dischetto, portiere, tiro, fallo
Professore: scuola, insegnante, voti, lezione, cattedra
Interrogazione: scuola, professore, voto, domande, cattedra
Maturità: esame, scuola, diploma, quinta, tesina
Università: esami, laurea, studenti, facoltà, professore
Laurea: università, corona d'alloro, tesi, dottore, festa
Ufficio: lavoro, scrivania, computer, capo, colleghi
Capo: lavoro, boss, ufficio, comandare, dipendenti
Stipendio: soldi, mese, lavoro, busta paga, pagare
Bancomat: soldi, carta, prelevare, PIN, banca
Tasse: pagare, Stato, soldi, fisco, dichiarazione
Nonna: anziana, nipoti, cucinare, mamma, famiglia
Gemelli: uguali, fratelli, due, nati, identici
Neonato: bambino, pannolino, piangere, culla, latte
Pannolino: bambino, neonato, cambiare, cacca, pipì
Dentifricio: denti, spazzolino, menta, tubetto, lavarsi
Microonde: scaldare, cucina, minuti, elettrodomestico, forno
Ombrellone: spiaggia, sole, sabbia, lettino, ombra
Crema solare: sole, spiaggia, protezione, scottatura, pelle
Abbronzatura: sole, pelle, spiaggia, scura, estate
Infradito: ciabatte, piedi, estate, spiaggia, dita
Occhiali da sole: sole, lenti, estate, scuri, occhi
Piercing: orecchio, naso, buco, anello, ago
Parrucca: capelli, finti, testa, calvo, travestimento
Barba: peli, viso, rasoio, uomo, baffi
Trucco: rossetto, mascara, viso, make-up, ombretto
Profumo: odore, boccetta, spruzzare, essenza, fragranza
Mostro: paura, brutto, sotto il letto, creatura, spaventare
Incubo: sogno, paura, notte, dormire, brutto
Detective: indagine, Sherlock, crimine, colpevole, investigatore
Ladro: rubare, furto, polizia, casa, scappare
Prigione: carcere, detenuto, cella, sbarre, guardia
Tesoro: pirati, oro, mappa, forziere, nascosto
Mappa: strade, orientarsi, cartina, Google Maps, luoghi
Bussola: nord, ago, orientarsi, direzione, magnete
Pianoforte: tasti, suonare, bianco e nero, strumento, musica
Tamburo: suonare, bacchette, ritmo, percussioni, strumento
Microfono: cantare, voce, karaoke, parlare, palco
Concerto: musica, palco, cantante, biglietto, folla
Rapper: rap, rime, canzone, microfono, Sfera Ebbasta
Cuffie: musica, orecchie, ascoltare, bluetooth, auricolari
Casinò: giocare, fiches, roulette, soldi, Las Vegas
Cruciverba: parole, caselle, definizioni, giornale, incrociate
Monopoli: gioco, soldi, case, dadi, Parco della Vittoria
Uno: carte, colori, gioco, più quattro, pescare
Nascondino: gioco, contare, nascondersi, trovare, tana
Altalena: bambini, parco, dondolare, spingere, giochi
Lupo: ululare, luna, branco, Cappuccetto Rosso, bosco
Orso: miele, grosso, bruno, polare, letargo
Volpe: furba, coda, rossa, bosco, gallina
Gufo: notte, uccello, occhi, civetta, saggio
Pappagallo: parlare, uccello, colorato, ripetere, piume
Tartaruga: lenta, guscio, carapace, mare, Ninja
Polpo: tentacoli, otto, mare, inchiostro, polipo
Medusa: mare, pungere, trasparente, tentacoli, urticante
Pecora: lana, gregge, belare, pastore, agnello
Maiale: porco, fango, salame, grugnire, rosa
Asino: raglio, somaro, orecchie, testardo, mulo
Lumaca: lenta, guscio, bava, chiocciola, insalata
Formica: piccola, colonia, insetto, lavorare, formicaio
Topo: formaggio, gatto, roditore, trappola, piccolo
Zebra: strisce, bianco, nero, cavallo, Africa
Canguro: Australia, saltare, marsupio, cucciolo, tasca
Koala: Australia, eucalipto, orsetto, albero, dormire
Panda: bianco, nero, bambù, Cina, orso
Pipistrello: notte, volare, grotta, vampiro, Batman
Struzzo: uccello, collo, testa, sabbia, correre
Fenicottero: rosa, zampa, uccello, lago, una
Riccio: spine, pungere, animale, palla, porcospino
Scoiattolo: noci, coda, albero, ghiande, roditore
Criceto: gabbia, ruota, roditore, guance, piccolo
Pesce rosso: acquario, boccia, memoria, arancione, nuotare
Granchio: chele, pinze, mare, lateralmente, spiaggia
Aragosta: rossa, chele, crostaceo, costosa, mare
Balena: grande, mare, mammifero, Moby Dick, cetaceo
Camaleonte: colori, cambiare, lingua, rettile, mimetizzarsi
Tigre: strisce, felino, arancione, giungla, Tigro
Gorilla: scimmia, grande, petto, King Kong, primate
Arancino: riso, Sicilia, fritto, ragù, supplì
Cannolo: Sicilia, ricotta, dolce, cialda, croccante
Piadina: Romagna, squacquerone, crudo, tonda, panino
Focaccia: Genova, olio, pane, rosmarino, forno
Polenta: mais, gialla, Nord, farina, paiolo
Risotto: riso, Milano, zafferano, brodo, mantecare
Gnocchi: patate, giovedì, pasta, sugo, sorrentina
Ravioli: pasta, ripieno, ricotta, quadrati, tortellini
Tortellini: Bologna, brodo, pasta, ripieno, Natale
Amatriciana: guanciale, pomodoro, pecorino, bucatini, Amatrice
Pesto: basilico, Genova, pinoli, verde, trenette
Mozzarella: bufala, latte, bianca, pizza, Campania
Parmigiano: grattugiato, formaggio, Reggiano, stagionato, forma
Prosciutto: crudo, cotto, Parma, maiale, fette
Mortadella: Bologna, salume, rosa, pistacchio, fette
Salame: maiale, insaccato, fette, salume, affettato
Bistecca: carne, Fiorentina, griglia, al sangue, manzo
Cotoletta: Milano, impanata, fritta, carne, pane
Polpette: carne, sugo, tonde, nonna, macinata
Frittata: uova, padella, girare, cipolle, omelette
Toast: pane, prosciutto, formaggio, tostapane, panino
Brioche: colazione, dolce, granita, Sicilia, cornetto
Biscotto: dolce, inzuppare, latte, colazione, frollino
Torta: compleanno, candeline, dolce, fetta, forno
Crostata: marmellata, frolla, dolce, griglia, nonna
Panna cotta: dolce, budino, caramello, frutti di bosco, cucchiaio
Granita: Sicilia, ghiaccio, limone, brioche, estate
Ghiacciolo: gelato, stecco, freddo, estate, acqua
Frullato: frutta, latte, frullatore, bere, smoothie
Aperitivo: spritz, stuzzichini, sera, bar, happy hour
Colazione: mattina, caffè, cornetto, latte, biscotti
Merenda: pomeriggio, snack, bambini, scuola, Kinder
Pranzo: mezzogiorno, mangiare, tavola, pasta, primo
Cena: sera, mangiare, tavola, ristorante, ultima
Ketchup: pomodoro, salsa, rosso, patatine, maionese
Maionese: salsa, uova, bianca, patatine, ketchup
Peperoncino: piccante, rosso, Calabria, fuoco, spezia
Aglio: vampiro, odore, spicchio, alito, cipolla
Cipolla: piangere, lacrime, tagliare, strati, odore
Patata: purè, tubero, fritta, buccia, gnocchi
Pomodoro: rosso, sugo, salsa, insalata, ortaggio
Carota: arancione, coniglio, ortaggio, vista, lunga
Zucchina: verde, ortaggio, fiori, zucca, lunga
Melanzana: viola, parmigiana, ortaggio, fritta, emoji
Anguria: estate, rossa, semi, cocomero, verde
Fragola: rossa, frutto, panna, piccola, semi
Ciliegia: rossa, nocciolo, coppia, picciolo, frutto
Limone: giallo, aspro, agrume, spremuta, limonata
Arancia: agrume, spremuta, succo, vitamina C, Sicilia
Ananas: frutto, tropicale, pizza, giallo, ciuffo
Cocco: noce, palma, bianco, latte, tropicale
Miele: api, dolce, giallo, alveare, orso
Zucchero: dolce, bianco, caffè, cubetto, canna
Sale: salato, mare, bianco, cucina, pepe
Olio: oliva, extravergine, frittura, condire, bottiglia
Burro: latte, panna, spalmare, giallo, margarina
Pane: forno, fornaio, mollica, crosta, panino
Grissini: Torino, pane, croccanti, bastoncini, sottili
Pasta: spaghetti, penne, cuocere, acqua, al dente
Riso: chicchi, risotto, bianco, sushi, cinese
Brodo: caldo, malato, tortellini, carne, minestra
Minestrone: verdure, zuppa, caldo, cucchiaio, inverno
Coca-Cola: bibita, bollicine, nera, lattina, Pepsi
Acqua: bere, bottiglia, frizzante, naturale, H2O
Tè: tazza, bustina, inglese, foglie, caldo
Cappuccino: latte, caffè, schiuma, colazione, bar
Prosecco: bollicine, Veneto, brindisi, vino, spumante
Champagne: Francia, bollicine, brindisi, costoso, tappo
Milano: Duomo, Lombardia, nebbia, Navigli, moda
Napoli: pizza, Vesuvio, Maradona, Campania, golfo
Firenze: Toscana, Duomo, David, Ponte Vecchio, Arno
Torino: Mole, Piemonte, Juventus, Fiat, Po
Bologna: tortellini, Emilia, due torri, università, mortadella
Palermo: Sicilia, arancine, Mondello, capoluogo, Rosalia
Genova: pesto, Liguria, porto, focaccia, Lanterna
Sicilia: isola, Etna, cannoli, Palermo, regione
Sardegna: isola, mare, Costa Smeralda, nuraghe, porceddu
Puglia: tacco, Bari, trulli, orecchiette, mare
Toscana: Firenze, colline, Chianti, regione, cipressi
Londra: Inghilterra, Big Ben, Tamigi, capitale, regina
New York: America, Statua della Libertà, Manhattan, grattacieli, Mela
Las Vegas: casinò, deserto, America, matrimonio, Nevada
Egitto: piramidi, faraoni, Nilo, Cairo, Africa
Giappone: Tokyo, sushi, samurai, isole, Sol Levante
Stati Uniti: America, USA, dollaro, Washington, bandiera
Spagna: Madrid, paella, flamenco, Barcellona, toro
Grecia: Atene, isole, mitologia, souvlaki, Partenone
Africa: continente, savana, leoni, deserto, Sahara
Polo Nord: freddo, ghiaccio, Babbo Natale, orsi polari, neve
Luna park: giostre, montagne russe, zucchero filato, divertimento, autoscontri
Zoo: animali, gabbie, leoni, visitare, safari
Acquario: pesci, vasca, vetro, Genova, delfini
Museo: quadri, arte, visita, opere, mostra
Chiesa: prete, messa, campane, altare, Dio
Stazione: treni, binari, partenza, biglietteria, capostazione
Aeroporto: aerei, volo, check-in, gate, decollo
Porto: navi, barche, mare, molo, attraccare
Stadio: calcio, tifosi, partita, curva, spalti
Teatro: palco, attori, sipario, spettacolo, platea
Bar: caffè, barista, bancone, aperitivo, cornetto
Hotel: albergo, camera, stelle, reception, notte
Ostello: economico, letti, viaggiatori, camerata, giovani
Agriturismo: campagna, fattoria, mangiare, vacanza, animali
Fattoria: animali, contadino, mucche, campagna, trattore
Parco giochi: bambini, scivolo, altalena, giocare, sabbia
Piazza: centro, fontana, città, incontrarsi, monumento
Condominio: palazzo, vicini, amministratore, riunione, appartamento
Edicola: giornali, riviste, figurine, edicolante, chiosco
Tabaccheria: sigarette, francobolli, Gratta e Vinci, tabaccaio, insegna
Ufficio postale: Poste, fila, lettere, pacco, raccomandata
Pronto soccorso: ospedale, emergenza, codice, ambulanza, urgenza
Ambulanza: sirena, ospedale, emergenza, 118, barella
Mercato: bancarelle, frutta, verdura, comprare, piazza
Forbici: tagliare, lame, carta, capelli, punte
Martello: chiodo, battere, attrezzo, falegname, picchiare
Chiave: serratura, porta, aprire, chiudere, mazzo
Lucchetto: chiave, chiudere, combinazione, ponte, catena
Candela: cera, fiamma, accendere, stoppino, luce
Lampadina: luce, accendere, idea, Edison, LED
Cuscino: letto, dormire, testa, piume, federa
Coperta: letto, caldo, freddo, lana, piumone
Asciugamano: bagno, asciugarsi, doccia, telo, spugna
Phon: capelli, asciugare, aria, calda, asciugacapelli
Rasoio: barba, radersi, lametta, pelo, schiuma
Pettine: capelli, denti, pettinarsi, spazzola, nodi
Borsa: donna, portare, accessorio, manico, pelle
Portafoglio: soldi, tasca, carte, documenti, banconote
Anello: dito, matrimonio, fidanzamento, oro, diamante
Collana: collo, gioiello, perle, catenina, ciondolo
Cravatta: collo, nodo, camicia, giacca, elegante
Jeans: pantaloni, denim, blu, tasche, Levi's
Felpa: cappuccio, cotone, maglia, sportiva, tuta
Guanti: mani, freddo, dita, lana, inverno
Sciarpa: collo, freddo, lana, inverno, avvolgere
Stivali: scarpe, piedi, pioggia, alti, gomma
Ciabatte: casa, piedi, pantofole, morbide, infradito
Costume da bagno: mare, piscina, nuotare, bikini, slip
Tuta: sport, ginnastica, felpa, pantaloni, comoda
Giacca: cappotto, vestito, maniche, bottoni, elegante
Vestito da sposa: bianco, matrimonio, sposa, velo, abito
Sdraio: spiaggia, lettino, sedia, sole, rilassarsi
Secchiello: paletta, sabbia, spiaggia, bambini, castello
Castello di sabbia: spiaggia, secchiello, onde, costruire, torri
Salvagente: mare, galleggiare, ciambella, nuotare, bambini
Pinne: piedi, nuotare, sub, maschera, mare
Pallone: calcio, sfera, rotondo, gonfiare, giocare
Racchetta: tennis, padel, corde, pallina, colpire
Moto: due ruote, casco, motociclista, Ducati, velocità
Camion: grande, autista, camionista, trasporto, rimorchio
Trattore: campagna, contadino, campi, agricoltura, ruote
Autobus: fermata, biglietto, autista, passeggeri, mezzo
Barca: mare, vela, remi, navigare, porto
Gondola: Venezia, gondoliere, canali, barca, remo
Mongolfiera: volare, pallone, aria calda, cesto, cielo
Paracadute: lanciarsi, aereo, cielo, atterrare, cadere
Navigatore: GPS, strada, indicazioni, ricalcolo, mappa
Satellite: spazio, orbita, Terra, segnale, antenna
Pianeta: Terra, Marte, sistema solare, orbita, stella
Stella cadente: desiderio, cielo, agosto, San Lorenzo, notte
Cometa: coda, cielo, stella, Halley, presepe
Telescopio: stelle, osservare, lente, cielo, astronomo
Microscopio: piccolo, lente, laboratorio, cellule, ingrandire
Calcolatrice: numeri, conti, matematica, tasti, somma
Matita: scrivere, mina, gomma, temperino, disegnare
Penna: scrivere, inchiostro, biro, tappo, quaderno
Quaderno: scuola, pagine, scrivere, righe, quadretti
Lavagna: gesso, scuola, aula, cancellare, maestra
Astuccio: penne, matite, scuola, cerniera, zaino
Calendario: giorni, mesi, anno, date, appendere
Agenda: appuntamenti, impegni, giorni, scrivere, diario
Regalo: pacchetto, compleanno, Natale, carta, fiocco
Palloncino: gonfiare, elio, festa, scoppiare, colorato
Candeline: torta, compleanno, soffiare, anni, spegnere
Coriandoli: Carnevale, colorati, carta, lanciare, stelle filanti
Fuochi d'artificio: Capodanno, botti, cielo, esplodere, colori
Presepe: Natale, Gesù, capanna, statuine, pastori
Albero di Natale: addobbi, palline, dicembre, luci, abete
Calza della Befana: carbone, dolci, gennaio, camino, appendere
Uovo di Pasqua: cioccolato, sorpresa, rompere, aprile, coniglio
Colomba: Pasqua, dolce, uccello, pace, canditi
Zucca: Halloween, arancione, intagliare, ortaggio, Cenerentola
Medico: dottore, ospedale, visita, malato, camice
Infermiere: ospedale, siringa, puntura, medico, cura
Avvocato: tribunale, difendere, legge, causa, cliente
Giudice: tribunale, sentenza, martelletto, legge, processo
Idraulico: tubi, lavandino, perdita, acqua, Super Mario
Elettricista: corrente, fili, luce, cavi, scossa
Postino: lettere, posta, consegnare, buca, pacchi
Muratore: mattoni, cantiere, cemento, costruire, casa
Contadino: campi, trattore, terra, raccolto, agricoltore
Pescatore: pesce, canna, amo, mare, barca
Giardiniere: piante, fiori, tagliare, erba, prato
Parrucchiere: capelli, taglio, piega, phon, shampoo
Cameriere: ristorante, servire, tavolo, ordinare, mancia
Barista: bar, caffè, bancone, cocktail, servire
Pizzaiolo: pizza, forno, Napoli, impasto, pala
Pilota: aereo, volare, cabina, comandante, guidare
Hostess: aereo, volo, assistente, passeggeri, steward
Soldato: esercito, guerra, militare, divisa, arma
Re: corona, regina, trono, regno, castello
Regina: re, corona, Elisabetta, trono, scacchi
Principe: azzurro, castello, principessa, re, cavallo
Cavaliere: armatura, spada, cavallo, medievale, castello
Vichingo: elmo, corna, Nord, nave, guerriero
Gladiatore: Colosseo, Roma, combattere, arena, spada
Faraone: Egitto, piramide, mummia, re, Tutankhamon
Mummia: Egitto, bende, faraone, piramide, sarcofago
Scheletro: ossa, morto, teschio, corpo, Halloween
Yeti: neve, Himalaya, mostro, peloso, abominevole
Fata: ali, bacchetta, magica, Trilli, polvere
Elfo: orecchie, Babbo Natale, Natale, Legolas, aiutante
Gnomo: giardino, cappello, barba, piccolo, rosso
Gigante: alto, enorme, grande, Golia, fagiolo
Orco: Shrek, mostro, verde, fiabe, mangiare
Cappuccetto Rosso: lupo, nonna, bosco, cestino, fiaba
Peter Pan: Isola che non c'è, Trilli, Capitan Uncino, volare, crescere
Aladdin: lampada, genio, tappeto, Jasmine, desideri
Simba: Re Leone, leone, Mufasa, Disney, Hakuna Matata
Spider-Man: ragno, ragnatela, Peter Parker, supereroe, Marvel
Hulk: verde, arrabbiato, forte, Marvel, gigante
Iron Man: armatura, Tony Stark, Marvel, Avengers, robot
Super Mario: idraulico, Nintendo, Luigi, funghi, baffi
Pikachu: Pokémon, giallo, elettrico, Ash, topo
SpongeBob: spugna, gialla, Patrick, Bikini Bottom, mare
Sherlock Holmes: detective, Watson, lente, Londra, investigatore
Dracula: vampiro, conte, Transilvania, sangue, castello
Frankenstein: mostro, scienziato, bulloni, cadavere, creatura
Leonardo da Vinci: Gioconda, inventore, pittore, Rinascimento, Vinci
Dante: Divina Commedia, Inferno, Beatrice, poeta, Firenze
Garibaldi: Mille, camicie rosse, Unità d'Italia, eroe, generale
Cristoforo Colombo: America, caravelle, 1492, navigatore, Genova
Napoleone: Francia, imperatore, basso, Waterloo, Elba
Giulio Cesare: Roma, imperatore, Bruto, Idi di marzo, Rubicone
Einstein: relatività, genio, scienziato, E=mc2, capelli
Galileo: telescopio, Pisa, scienziato, Terra, eppur si muove
Ballare: musica, discoteca, danza, muoversi, pista
Cantare: voce, canzone, microfono, karaoke, intonato
Dormire: letto, sonno, notte, sognare, russare
Russare: dormire, rumore, naso, notte, letto
Sognare: dormire, sogno, notte, incubo, fantasia
Starnuto: naso, allergia, etciù, raffreddore, salute
Singhiozzo: hic, spavento, bere, aria, diaframma
Sbadiglio: sonno, bocca, stanco, contagioso, noia
Solletico: ridere, piedi, ascelle, dita, toccare
Abbraccio: braccia, stringere, affetto, coccole, persona
Lacrime: piangere, occhi, tristezza, gocce, fazzoletto
Risata: ridere, divertente, barzelletta, sorriso, ah ah
Barzelletta: ridere, battuta, raccontare, divertente, sai l'ultima
Indovinello: risposta, domanda, enigma, indovinare, soluzione
Segreto: nascondere, dire, confidenza, sapere, nessuno
Bugia: mentire, verità, Pinocchio, naso, falso
Promessa: giurare, mantenere, parola, impegno, giuramento
Fortuna: quadrifoglio, sorte, caso, fortunato, ferro di cavallo
Superstizione: gatto nero, specchio rotto, venerdì 17, sfortuna, scaramanzia
Oroscopo: segni zodiacali, stelle, Paolo Fox, previsioni, ascendente
Magia: mago, trucco, bacchetta, incantesimo, coniglio
Pazienza: aspettare, calma, virtù, perdere, tempo
Noia: annoiarsi, sbadiglio, niente, lento, tempo
Paura: spavento, horror, tremare, coraggio, buio
Nostalgia: passato, ricordi, mancanza, tempo, malinconia
Vergogna: imbarazzo, rosso, figuraccia, arrossire, timido
Ritardo: tardi, puntuale, orario, aspettare, treno
Fila: coda, aspettare, persone, Poste, turno
Traffico: macchine, coda, strada, clacson, ora di punta
Trasloco: casa, scatoloni, cambiare, camion, mobili
Bucato: lavatrice, panni, stendere, lavare, vestiti
Spesa: supermercato, carrello, comprare, lista, cibo
Pulizie: casa, pulire, scopa, polvere, detersivo
Dieta: dimagrire, mangiare, chili, peso, lunedì
Picnic: prato, cestino, tovaglia, panini, all'aperto
Gita: scuola, pullman, viaggio, classe, giornata
Crociera: nave, mare, viaggio, cabina, vacanza
Safari: Africa, leoni, jeep, animali, savana
Sagra: paese, festa, cibo, porchetta, stand
Fiera: stand, espositori, mostra, padiglione, Milano
Mostra: arte, quadri, museo, esposizione, opere
Partita: calcio, squadre, giocare, gol, risultato
Gol: rete, calcio, segnare, porta, pallone
Fuorigioco: calcio, arbitro, guardalinee, posizione, VAR
VAR: arbitro, calcio, video, rigore, controllo
Tifoso: squadra, stadio, sciarpa, curva, ultras
Scudetto: campionato, Serie A, vincere, tricolore, calcio
Champions League: calcio, coppa, Europa, squadre, inno
Boxe: pugni, guantoni, ring, pugile, KO
Ciclismo: bicicletta, Giro d'Italia, pedalare, maglia rosa, corsa
Nuoto: piscina, acqua, stile libero, bracciate, nuotare
Surf: onde, tavola, mare, cavalcare, Hawaii
Skateboard: tavola, ruote, trick, rampa, skater
Pattinaggio: ghiaccio, pattini, pista, scivolare, figura
Golf: mazza, buca, pallina, campo, green
Karate: arti marziali, cintura nera, Giappone, calcio, mosse
Scherma: spada, fioretto, maschera, stoccata, pedana
Equitazione: cavallo, sella, cavalcare, fantino, maneggio
Freccette: bersaglio, lanciare, centro, punti, pub
Biliardo: stecca, palle, buca, tavolo, verde
Ping pong: racchetta, pallina, tavolo, rete, tennis
Calciobalilla: biliardino, omini, tavolo, girare, bar
Tombola: numeri, cartella, Natale, cinquina, estrarre
Bingo: numeri, cartella, sala, vincere, tombola
Briscola: carte, napoletane, semi, coppia, punti
Risiko: carri armati, conquistare, territori, dadi, mondo
Dadi: lanciare, sei, facce, gioco, numeri
Lego: mattoncini, costruire, colorati, giocattolo, incastrare
Peluche: orsacchiotto, morbido, giocattolo, coccole, pupazzo
Aquilone: vento, filo, volare, cielo, spiaggia
Trottola: girare, giocattolo, punta, equilibrio, ruotare
Yo-yo: filo, su e giù, giocattolo, girare, tornare
Tablet: schermo, touch, iPad, computer, telefono
Stampante: carta, inchiostro, stampare, fogli, ufficio
Mouse: computer, cliccare, tasto, cursore, topo
Tastiera: tasti, computer, scrivere, lettere, pianoforte
Spotify: musica, playlist, ascoltare, app, canzoni
Google: cercare, internet, motore di ricerca, Chrome, sito
Amazon: comprare, online, pacco, consegna, Prime
Facebook: social, Zuckerberg, like, amici, profilo
Email: posta, messaggio, inviare, chiocciola, Gmail
Batteria: carica, telefono, scarica, energia, pila
Bluetooth: connessione, wireless, cuffie, accoppiare, dispositivo
Intelligenza artificiale: robot, computer, ChatGPT, macchina, futuro
Streaming: video, Netflix, guardare, online, diretta
Podcast: ascoltare, audio, episodi, parlare, Spotify
Meme: immagine, divertente, internet, condividere, virale
Hashtag: cancelletto, social, Instagram, parola, Twitter
Grande Fratello: casa, reality, concorrenti, telecamere, nomination
Isola dei Famosi: reality, isola, naufraghi, Honduras, fame
X Factor: talent, cantare, giudici, audizioni, Sky
Amici: Maria De Filippi, talent, ballerini, cantanti, scuola
Striscia la notizia: Gabibbo, tapiro, Canale 5, veline, tg
Telegiornale: notizie, TG, giornalista, TV, edizione
Pubblicità: spot, prodotto, interruzione, televisione, marketing
Oscar: premio, statuetta, cinema, Hollywood, attore
Hollywood: cinema, film, Los Angeles, attori, stelle
Disney: Topolino, cartoni, Walt, castello, film
Marvel: supereroi, fumetti, Avengers, Iron Man, film
Star Wars: Jedi, spada laser, Darth Vader, galassia, forza
Titanic: nave, iceberg, Jack, Rose, affondare
Il Signore degli Anelli: anello, hobbit, Frodo, Gandalf, Mordor
Pokémon: Pikachu, Ash, catturare, sfera, allenatore
Casa di carta: Professore, rapina, maschera, Netflix, Bella ciao
Fantozzi: Paolo Villaggio, ragioniere, nuvola, megaditta, sfortunato
`;

const RAW_SPICY = `
Sbronza: alcol, ubriaco, bere, vino, birra
Doposbronza: mal di testa, mattina, alcol, nausea, bere
Discoteca: ballare, musica, DJ, notte, pista
Tinder: app, incontri, match, appuntamento, profilo
Bacio: labbra, baciare, lingua, amore, bocca
Ex: fidanzato, lasciati, prima, amore, relazione
Suocera: madre, marito, moglie, famiglia, sposarsi
Addio al celibato: sposo, amici, festa, matrimonio, ultima
Spogliarello: nudo, vestiti, togliere, ballare, sexy
Mutande: intimo, slip, boxer, sotto, perizoma
Preservativo: protezione, farmacia, gravidanza, profilattico, sicuro
Motel: stanza, ore, coppia, albergo, notte
Corna: tradimento, tradire, testa, cornuto, fidanzato
Scoreggia: aria, puzza, sedere, rumore, pancia
Rutto: bocca, aria, bibita, rumore, digerire
Vomitare: stomaco, nausea, male, bagno, ubriaco
Succhiotto: collo, bacio, segno, livido, vampiro
Shottino: bicchiere, alcol, tequila, bere, piccolo
Spritz: aperitivo, Aperol, arancione, Veneto, bere
Mojito: cocktail, menta, rum, lime, Cuba
Nudista: nudo, spiaggia, vestiti, pelle, naturismo
Reggiseno: seno, intimo, donna, coppe, ferretto
Single: solo, fidanzato, libero, coppia, relazione
Luna di miele: sposi, viaggio, matrimonio, vacanza, dopo
Appuntamento al buio: sconosciuto, incontro, cena, buio, primo
Gelosia: geloso, fidanzato, tradimento, invidia, possessivo
Divorzio: separazione, matrimonio, avvocato, coppia, lasciarsi
Pancia da birra: birra, grasso, uomo, pancione, bere
Calzini con i sandali: piedi, estate, turista, ciabatte, moda
Karaoke: cantare, microfono, canzone, stonato, testo
Buttafuori: discoteca, porta, entrare, grosso, sicurezza
Notte brava: uscire, festa, alcol, mattina, divertirsi
Ubriaco: alcol, bere, sbronza, barcollare, sobrio
Bagno pubblico: toilette, sporco, carta igienica, water, fila
Carta igienica: bagno, rotolo, sedere, water, finita
Amante: tradimento, segreto, sposato, relazione, corna
Limonare: baciare, lingua, bocca, bacio, coppia
Primo appuntamento: cena, conoscersi, imbarazzo, uscire, bacio
Ghosting: sparire, messaggi, rispondere, chat, fantasma
Friendzone: amici, amore, rifiuto, solo, innamorato
Crush: cotta, piacere, innamorato, ragazzo, segreto
Situationship: relazione, coppia, ufficiale, frequentarsi, confuso
Red flag: segnale, pericolo, rosso, relazione, tossico
Anniversario: coppia, data, insieme, regalo, mesi
Kebab delle 4: notte, ubriaco, fame, carne, uscita
After: festa, mattina, discoteca, continuare, dormire
Prevendita: discoteca, biglietto, PR, entrare, lista
Tavolo in discoteca: bottiglia, privé, pagare, divanetti, serata
Narghilè: fumo, pipa, sapore, carbone, shisha
Sigaretta: fumare, accendino, tabacco, pacchetto, nicotina
Beer pong: bicchieri, pallina, tirare, bere, tavolo
Obbligo o verità: gioco, domanda, sfida, segreto, coraggio
Erasmus: università, estero, studenti, feste, scambio
Coinquilino: casa, affitto, condividere, bollette, stanza
Mammone: mamma, figlio, casa, cucinare, trentenne
Pigiama party: dormire, amiche, notte, pigiama, film
Bikini: costume, spiaggia, donna, mare, due pezzi
Lap dance: palo, ballare, sexy, locale, spogliarello
Flirtare: provarci, sguardo, conquistare, corteggiare, battuta
Rimorchiare: provarci, discoteca, conquistare, flirtare, numero
Tequila: shot, sale, limone, Messico, bere
Vodka: alcol, Russia, bianca, bere, Red Bull
Jägermeister: amaro, shot, verde, bere, cervo
Limoncello: limone, liquore, Sorrento, giallo, digestivo
Grappa: alcol, liquore, uva, forte, nonno
Vocale da ubriaco: WhatsApp, messaggio, notte, bere, imbarazzo
Spunte blu: WhatsApp, letto, messaggio, ignorare, risposta
Serenata: cantare, balcone, chitarra, fidanzata, amore
Sauna: caldo, sudare, asciugamano, vapore, nudi
Perizoma: mutande, filo, intimo, sedere, sexy
Fuga dalla finestra: genitori, scappare, notte, casa, uscire
Bacio alla francese: lingua, baciare, labbra, limonare, Francia
Bollette: luce, gas, pagare, casa, soldi
Pene: pisello, uomo, organo, maschile, erezione
Vagina: donna, organo, femminile, ginecologo, intima
Tette: seno, donna, reggiseno, petto, capezzoli
Culo: sedere, chiappe, natiche, dietro, lato B
Orgasmo: piacere, sesso, venire, culmine, finto
Sesso: fare l'amore, letto, coppia, scopare, rapporto
Sveltina: veloce, sesso, fretta, rapida, minuti
Preliminari: prima, sesso, baci, carezze, riscaldamento
Kamasutra: posizioni, sesso, India, libro, acrobazie
Pecorina: posizione, dietro, sesso, gattoni, Kamasutra
Missionario: posizione, sopra, classica, sesso, noiosa
Sessantanove: numero, posizione, reciproco, sesso, sei e nove
Vibratore: sex toy, batterie, vibrare, donna, piacere
Viagra: pillola blu, erezione, anziani, farmaco, impotenza
Pornostar: film, porno, attrice, Rocco Siffredi, set
Porno: film, video, sesso, internet, Pornhub
OnlyFans: abbonamento, foto, piattaforma, contenuti, soldi
Sexy shop: negozio, vibratori, manette, lingerie, adulti
Manette: polizia, legare, polsi, arresto, chiave
Frusta: cavallo, schiocco, sadomaso, colpire, cuoio
Lingerie: intimo, pizzo, sexy, reggiseno, mutandine
Reggicalze: calze, lingerie, sexy, gambe, giarrettiera
Bambola gonfiabile: gonfiare, plastica, finta, sesso, solitudine
Masturbazione: da soli, mano, piacere, segreto, autoerotismo
Erezione: duro, pene, Viagra, eccitazione, alzarsi
Eiaculazione precoce: veloce, troppo presto, uomo, sesso, imbarazzo
Impotenza: Viagra, non funziona, uomo, erezione, problema
Prima volta: verginità, sesso, emozione, ricordo, ansia
Scambisti: coppie, scambio, club, partner, sesso
Orgia: gruppo, sesso, tante persone, festa, ammucchiata
Tradimento: corna, amante, tradire, fedele, partner
Cornuto: corna, tradito, fidanzato, moglie, testa
Gigolò: pagato, uomo, donne, accompagnatore, sesso
Spogliarellista: spogliarello, ballare, nudo, addio al celibato, soldi
Pillola del giorno dopo: farmacia, contraccezione, emergenza, gravidanza, mattina
Test di gravidanza: incinta, positivo, due linee, farmacia, bambino
Incinta: gravidanza, pancione, bambino, nove mesi, mamma
Cicogna: neonato, uccello, portare, bambino, becco
Sexting: messaggi, foto, telefono, sexy, chat
Nudes: foto, nudo, telefono, mandare, sexy
Lubrificante: scivoloso, gel, sesso, tubetto, farmacia
Sesso telefonico: chiamare, voce, linea erotica, telefono, eccitarsi
Calendario sexy: mesi, foto, nudi, appendere, officina
Luci rosse: quartiere, Amsterdam, prostituzione, vetrine, sesso
Cintura di castità: medioevo, chiave, ferro, fedeltà, chiudere
Piattole: pidocchi, pube, prurito, insetti, sesso
Herpes: labbra, virus, bollicine, bacio, crosta
Brufolo: pelle, viso, schiacciare, acne, pus
Addio al nubilato: sposa, amiche, festa, matrimonio, spogliarellista
Matrimonio riparatore: incinta, sposarsi, fretta, fucile, obbligo
Alimenti: divorzio, ex moglie, soldi, mensile, avvocato
Diarrea: cacca, liquida, bagno, pancia, correre
Cacca: feci, bagno, water, marrone, puzza
Pipì: urina, bagno, water, gialla, fare
Moccio: naso, raffreddore, fazzoletto, verde, colare
Caccola: naso, dito, scaccolarsi, verde, mangiare
Sudore: sudare, ascelle, caldo, puzza, gocce
Alito pesante: bocca, puzza, aglio, mentina, respiro
Forfora: capelli, bianca, shampoo, testa, spalle
Cerume: orecchie, cotton fioc, giallo, tappo, cera
Emorroidi: sedere, dolore, crema, sedersi, prurito
Supposta: sedere, medicina, inserire, febbre, Tachipirina
Clistere: intestino, sedere, acqua, stitichezza, lavaggio
Stitichezza: bagno, cacca, intestino, prugne, spingere
Puzza di piedi: calzini, scarpe, odore, sudore, formaggio
Ascelle: braccia, sudore, deodorante, peli, puzza
Ceretta: peli, cera, strappo, dolore, estetista
Cellulite: buccia d'arancia, cosce, donna, pelle, crema
Calvizie: pelato, capelli, perdere, testa, trapianto
Water: bagno, tazza, sciacquone, sedersi, wc
Sciacquone: tirare, bagno, water, acqua, scarico
Bidet: bagno, lavarsi, sedere, italiano, acqua
Pannolone: anziani, incontinenza, pannolino, adulti, pipì
Dentiera: denti finti, nonno, bicchiere, colla, bocca
Unghia incarnita: piede, dolore, alluce, podologo, carne
Cocaina: droga, polvere, bianca, naso, sniffare
Canna: spinello, marijuana, fumare, erba, rollare
Marijuana: erba, canna, fumare, cannabis, foglia
Funghetti: allucinogeni, droga, trip, bosco, effetto
Spacciatore: droga, vendere, pusher, dose, polizia
Rave: festa, musica, techno, illegale, campagna
Alcoltest: palloncino, polizia, alcol, soffiare, guidare
Coma etilico: alcol, ospedale, ubriaco, svenuto, troppo
Tavernello: vino, cartone, economico, tetrapak, rosso
Negroni: cocktail, Campari, gin, vermouth, amaro
Gin tonic: cocktail, acqua tonica, limone, bicchiere, bere
Whisky: Scozia, alcol, ghiaccio, bottiglia, bourbon
Rum: pirati, Caraibi, alcol, canna da zucchero, Mojito
Amaro: digestivo, erbe, Montenegro, dopo cena, liquore
Sambuca: liquore, anice, mosca, chicchi di caffè, bianca
Slot machine: gioco, soldi, leva, casinò, vincere
Gratta e Vinci: biglietto, tabaccheria, grattare, vincere, moneta
Sigaro: fumare, Cuba, tabacco, avana, Churchill
Funerale: morto, chiesa, bara, lutto, cimitero
Bara: morto, legno, funerale, cassa, seppellire
Cimitero: tombe, morti, lapidi, fiori, camposanto
Becchino: scavare, cimitero, fossa, morti, pala
Lapide: tomba, marmo, nome, cimitero, epitaffio
Testamento: eredità, notaio, morte, parenti, lasciare
Eredità: testamento, soldi, parenti, notaio, morto
Vedova: marito, morto, nero, lutto, donna
Cremazione: ceneri, bruciare, urna, forno, morto
Urna: ceneri, cremazione, vaso, morto, elezioni
Necrologio: giornale, morto, annuncio, manifesto, lutto
Obitorio: morti, cadaveri, ospedale, freddo, autopsia
Autopsia: cadavere, medico legale, causa, morte, bisturi
Carro funebre: macchina, bara, funerale, nero, corteo
Lutto: nero, morte, dolore, funerale, piangere
Morte: falce, morire, fine, nera, scheletro
Delitto: omicidio, assassino, giallo, vittima, colpevole
Veleno: avvelenare, morire, serpente, bottiglia, cianuro
Inferno: diavolo, fuoco, dannati, Dante, peccatori
Paradiso: cielo, angeli, Dio, San Pietro, aldilà
Purgatorio: anime, attesa, Dante, peccati, aldilà
Diavolo: Satana, corna, inferno, forcone, rosso
Angelo: ali, aureola, cielo, custode, paradiso
Reincarnazione: rinascere, vita precedente, animale, anima, karma
Seduta spiritica: spiriti, medium, tavola, evocare, morti
Esorcismo: diavolo, prete, posseduto, demonio, acqua santa
Dio: Signore, cielo, creatore, Padre, onnipotente
Gesù: Cristo, croce, Nazareth, figlio di Dio, Natale
Madonna: Maria, madre, Gesù, vergine, santa
San Pietro: Paradiso, chiavi, apostolo, Vaticano, portone
Papa: Vaticano, Roma, chiesa, pontefice, Francesco
Prete: chiesa, messa, sacerdote, don, parroco
Suora: monaca, convento, velo, chiesa, sorella
Frate: convento, saio, francescano, monaco, fra'
Messa: chiesa, domenica, prete, preghiera, ostia
Confessione: peccati, prete, confessionale, perdono, penitenza
Ostia: comunione, messa, pane, bianca, prete
Acqua santa: benedetta, chiesa, acquasantiera, segno della croce, prete
Miracolo: santo, impossibile, guarigione, Lourdes, prodigio
Padre Pio: santo, stigmate, frate, San Giovanni Rotondo, Pietrelcina
Bibbia: libro, sacro, Vecchio Testamento, Vangelo, Dio
Comandamenti: dieci, Mosè, tavole, legge, Dio
Ultima cena: Gesù, apostoli, Giuda, Leonardo, pane
Giuda: tradimento, apostolo, trenta denari, bacio, Gesù
Adamo ed Eva: mela, paradiso terrestre, serpente, primi uomini, costola
Arca di Noè: diluvio, animali, coppie, barca, colomba
Mosè: Mar Rosso, comandamenti, tavole, Egitto, profeta
Peccato: confessione, sbagliare, inferno, perdono, capitale
Aureola: santo, testa, cerchio, luce, angelo
Rosario: preghiera, grani, Ave Maria, collana, nonna
Bestemmia: imprecare, Dio, parolaccia, peccato, offesa
Sacrestano: chiesa, campane, prete, sacrestia, chiavi
Processione: santo, statua, strada, fedeli, banda
Stigmate: mani, ferite, Padre Pio, santo, sangue
Vaticano: Papa, Roma, San Pietro, stato, Guardie Svizzere
Colonscopia: intestino, sonda, esame, sedere, gastroenterologo
Prostata: uomo, urologo, visita, ghiandola, anziano
Ginecologo: donna, visita, medico, utero, gravidanza
Proctologo: sedere, medico, emorroidi, visita, guanto
Catetere: tubo, vescica, pipì, ospedale, sacca
Flebo: ago, vena, ospedale, flacone, sacca
Anestesia: dormire, operazione, anestesista, puntura, dolore
Casa di riposo: anziani, ospizio, badante, vecchi, RSA
Badante: anziani, assistere, nonno, cura, aiuto
Umarell: cantiere, pensionato, guardare, mani dietro, Bologna
Botox: punture, rughe, labbra, chirurgia, viso
Chirurgia estetica: rifarsi, bisturi, naso, seno, chirurgo
Liposuzione: grasso, aspirare, chirurgia, pancia, dimagrire
Parrucchino: capelli, finto, pelato, testa, riporto
Menopausa: donna, ciclo, vampate, età, ormoni
Ipocondriaco: malattia, paura, medico, Google, sintomi
Berlusconi: Silvio, Milan, politico, Mediaset, Arcore
Andreotti: Giulio, Democrazia Cristiana, Belzebù, senatore, politico
Craxi: Bettino, socialista, Hammamet, monetine, politico
Chiara Ferragni: influencer, pandoro, Fedez, Instagram, bionda
Fedez: rapper, Ferragni, podcast, X Factor, Milano
Totti: Francesco, Roma, capitano, Ilary, Rolex
Briatore: Billionaire, Flavio, Formula 1, pizza, yacht
Sgarbi: Vittorio, capra, critico, arte, urlare
Al Bano: Romina, Felicità, Cellino San Marco, cappello, cantante
Gianni Morandi: cantante, Bologna, eterno, giovane, Fatti mandare dalla mamma
Maria De Filippi: Amici, C'è posta per te, Costanzo, Mediaset, conduttrice
Barbara D'Urso: Pomeriggio Cinque, Carmelita, trash, conduttrice, Mediaset
Fabrizio Corona: paparazzo, fotografo, prigione, tatuaggi, Belén
Vasco Rossi: Vita spericolata, rocker, Zocca, Albachiara, Komandante
Elon Musk: Tesla, Twitter, X, razzi, miliardario
Cristiano Ronaldo: CR7, Portogallo, Siuuu, Juventus, calciatore
Maradona: Diego, Napoli, mano de Dios, Argentina, calcio
Mourinho: allenatore, Special One, Inter, manette, zero tituli
Ibrahimović: Zlatan, Milan, Svezia, ego, calciatore
Gianluca Vacchi: balletti, Instagram, ricco, barba, Bologna
Wanna Marchi: televendite, truffa, d'accordo, numeri del lotto, sale
Mike Bongiorno: Allegria, quiz, Rischiatutto, conduttore, Lascia o raddoppia
Cicciolina: Ilona Staller, pornostar, Parlamento, bionda, deputata
Malgioglio: Cristiano, ciuffo, paroliere, Grande Fratello, eccentrico
Regina Elisabetta: Inghilterra, corgi, corona, longeva, Buckingham Palace
Agenzia delle Entrate: tasse, fisco, cartella, Equitalia, evasione
Evasione fiscale: tasse, nero, scontrino, Agenzia delle Entrate, fattura
Raccomandazione: spintarella, conoscenze, lavoro, posto, aiuto
`;

export interface TabuCardData {
  word: string;
  banned: string[];
}

const parse = (text: string): TabuCardData[] =>
  text
    .trim()
    .split('\n')
    .map((line) => {
      const [word, rest] = line.split(':');
      return { word: word.trim(), banned: rest.split(',').map((w) => w.trim()) };
    });

export const TABU_CARDS = parse(RAW);
export const TABU_CARDS_SPICY = parse(RAW_SPICY);
