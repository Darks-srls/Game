# Axend Games

Giochi di gruppo da fare in videochiamata o dal vivo: ognuno usa il proprio telefono, da qualsiasi rete.
Nella home si sceglie il gioco e si crea la stanza. Le stanze aperte compaiono in diretta nella home
e gli amici entrano con un tocco; chi crea la stanza può renderla privata (si entra col link o il codice).

- **Axend Party** (videogioco 3D, Three.js) — 7 minigiochi a punti con podio finale: Spingi giù, Luce rossa luce verde, Sedie musicali, Cecchini (in prima persona), Polpette rotolanti, Il mestolo della nonna, La gallina d'oro. Bot che giocano da soli, telecamera da trascinare, impostazioni (volume, sensibilità, grafica), funziona anche in orizzontale.
- **Astro Impostori** (videogioco in tempo reale) — astronauti su un'astronave: l'equipaggio fa i compiti, l'impostore elimina, usa le botole e sabota (porte, luci, comunicazioni, reattore, ossigeno); corpi, riunioni e voto. Joystick sul telefono, WASD/frecce sul PC.
- **La Spia** — tutti conoscono il luogo tranne la spia; domande e voti a voce, poi tutti premono Conferma.
- **L'Impostore** — tutti hanno la stessa parola, l'impostore una simile (o nessuna); indizi e voti a voce.
- **Telefono senza fili** — scrivi, disegna, indovina; alla fine si guardano gli album insieme.
- **Disegna e indovina** — uno disegna in diretta, gli altri scrivono la risposta; punti per velocità, parole personalizzate.
- **Passa la bomba** — di' ad alta voce una parola (sillaba, categoria o lettera) e passa la bomba prima che scoppi.
- **Artista impostore** — un tratto a testa sullo stesso foglio; l'impostore non sa cosa si disegna.
- **Battute al volo** — completa frasi assurde; sfide a due tra battute anonime e il gruppo vota la più divertente.
- **Preferiresti?** — dilemmi impossibili, tutti scelgono in segreto; punto a chi pensa come la maggioranza.
- **Sintonia** — il sensitivo vede un bersaglio sul quadrante e dà un indizio; gli altri girano la lancetta.
- **Parola proibita** — a squadre: fai indovinare la parola senza dire le cinque vietate (gli avversari hanno il BUZZ).
- **Chi sono?** — tutti vedono il tuo personaggio tranne te: domande sì/no a voce finché non lo scopri.

Il foglio da disegno ha 16 colori, matita, secchiello, linea, rettangolo, cerchio, gomma, spessori, annulla e cancella.

Opzione **🌶️ Contenuti piccanti** (per stanza): parole, idee, categorie e luoghi più sgravati, per adulti.
Si gioca anche dal vivo: suoni, vibrazioni e animazioni sono identici per tutti i ruoli (nessuno si tradisce)
e il tasto 🔇 in alto spegne suoni e vibrazione.

Gira su **Cloudflare Workers + Durable Objects** (piano gratuito): nessun server da tenere acceso.

## Comandi

- `npm install` — installa le dipendenze
- `npm run dev` — compila e prova in locale su http://localhost:8787
- `npm run deploy` — compila e pubblica su Cloudflare (la prima volta: `npx wrangler login`)
- `npm run chiave` — salva la chiave Gemini in `.env.local` (una volta sola)
- `npm run grafica` — crea con Gemini logo, copertine, carte e personaggi in `public/art/`
- `npm run immagini` — crea con Gemini le illustrazioni dei luoghi della Spia in `public/luoghi/`
- `npm run party` — crea con Gemini la copertina di Axend Party (i personaggi e le arene sono fatti in 3D dal codice)
- `npm run astro` — crea con Gemini gli sprite di Astro Impostori in `public/art/astro/` (sfondo reso trasparente)

Dopo aver creato le immagini: `npm run deploy`. Finché non ci sono, l'app usa le emoji.

## Struttura

- `src/` — frontend React (Vite + Tailwind)
- `src/data/` — contenuti dei giochi: luoghi e ruoli, parole, frasi, dilemmi, carte, personaggi (normali e 🌶️)
- `worker/index.ts` — Worker + Durable Object: stanze, giochi, presenza dei giocatori
- `worker/modes.ts`, `worker/party.ts` — regole dei giochi "a moduli" (disegno e bomba; giochi di gruppo)
- `worker/party3d.ts` + `src/data/party3d.ts` + `src/components/PartyView.tsx` + `src/components/party3d/` — Axend Party: regole e bot sul server (giro da 66 ms), fisica condivisa, grafica 3D, icone e sticker; posizioni con P3_MOVE / P3_POS
- `worker/astro.ts` + `src/data/astro.ts` — Astro Impostori: regole e mappa; le posizioni viaggiano a parte (RT_MOVE / RT_POS, 10 al secondo)
- `scripts/` — generatori della grafica con Gemini
- `_backup_versione_ai_studio/` — file della versione originale di AI Studio (non più usati)
