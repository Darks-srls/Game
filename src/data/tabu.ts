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
Calzini con i sandali: piedi, estate, turista, tedesco, moda
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
