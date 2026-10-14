# Axend Party — come si fa un minigioco 3D "a moduli"

Axend Party (gioco `PARTY3D`) è un videogioco 3D a minigiochi stile Fall Guys/Stumble Guys, in Three.js, per telefono e PC.
I 15 minigiochi storici stanno tutti in `worker/party3d.ts`, `src/data/party3d.ts`, `src/components/PartyView.tsx` e
`src/components/party3d/scene.ts`: **non si toccano**. I minigiochi nuovi stanno ognuno nei suoi file.

**Modello da copiare: "Il re della pizza" (`RE`)** — leggilo tutto prima di iniziare:
- `src/data/minis/re.ts` — regole fisiche dell'arena (uguali per telefono e server) + nome, regole, durata
- `worker/minis/re.ts` — server: partenze, regole, punti, cervello dei bot, dati per i telefoni
- `src/components/party3d/minis/re.tsx` — telefono: arena 3D, animazioni, decorazioni dei personaggi, scritte, effetti

I contratti (leggili: sono commentati riga per riga):
- `SharedMini` in `src/data/party3d.ts` (cerca "minigiochi a moduli")
- `ServerMini` / `MiniApi` / `MiniBot` in `worker/minis/types.ts`
- `ClientMini` / `MiniFrame` / `HudCtx` / `FxCtx` / `MiniButton` in `src/components/party3d/minis/types.ts`

## File da creare (per il minigioco `XYZ`, nome file in minuscolo)

1. `src/data/minis/xyz.ts` → `registerMini({ kind: 'XYZ', name, tag, rules, seconds, ground, clamp, ... })` + costanti dell'arena esportate
2. `worker/minis/xyz.ts` → `registerServerMini<Stato>({ kind: 'XYZ', ... })`
3. `src/components/party3d/minis/xyz.tsx` → `registerClientMini({ kind: 'XYZ', ... })`

Il `kind` è già nell'elenco `ExtKind` di `src/data/party3d.ts`. **Non modificare file condivisi** (index.ts dei minis,
types.ts, party3d.ts, PartyView.tsx, scene.ts, worker/party3d.ts, icons.tsx…): la registrazione negli `index.ts` la fa
il coordinatore. Se ti serve un "gancio" che non c'è, aggiralo dentro i tuoi file (spesso basta `local`, `decorate`,
`fx`, `api.setObj`, `api.teleport`, `api.fling`) oppure scrivilo nel resoconto finale.

## Come provare (obbligatorio)

```
npx tsc --noEmit -p .                         # i tuoi file non devono avere errori (ignora quelli di file altrui in lavorazione)
npx tsc --noEmit -p tsconfig.giochi.json   # controlla anche i file del server (worker/) e dei banchi di prova
npx tsx scripts/prova-party.ts XYZ 7 --mod src/data/minis/xyz.ts --mod worker/minis/xyz.ts
npx tsx scripts/prova-party.ts XYZ 2 --mod src/data/minis/xyz.ts --mod worker/minis/xyz.ts   # anche con pochi giocatori
```
Il banco di prova fa giocare i bot (più un "giocatore vero" finto che gironzola) a tempo accelerato: il minigioco deve
**finire da solo**, dare punti sensati (non tutti uguali), non andare in errore, e lo stato per i telefoni deve restare
piccolo (sotto ~4 KB). Guarda i conteggi degli effetti: servono a capire se i bot giocano davvero (es. raccolgono, segnano, cadono).
Ripeti la prova 3-4 volte: i risultati devono cambiare e i bot più bravi devono vincere più spesso.
Non usare il browser, non avviare server, non fare commit: la prova visiva la fa il coordinatore.

## Regole di gioco e di qualità (importanti per chi ci gioca)

- Deve essere **un vero videogioco di abilità**: correre, saltare, schivare, spingere, mirare, ricordare. Niente fortuna
  pura, niente "recita questa frase". Partite brevi (45–100 s), regole che si capiscono in una riga, caos divertente.
- Comandi disponibili: joystick/WASD, SALTA (doppio salto), SCATTO/TUFFO (dash: per un attimo schivi tutto), e UN
  pulsante principale (di solito SCHIAFFO; con `button` puoi farne uno tuo: LANCIA, PRENDI, COLPISCI…).
- I bot (riempiono le partite) devono giocare in modo credibile, con bravura diversa (`b.skill` 0.35–0.9): non
  devono bloccarsi contro i muri, devono evitare di cadere da soli, e i più bravi devono essere un po' più forti.
- Chi esce o è offline viene eliminato da solo; chi cade sotto `fallOut` è fuori (oppure `falls: 'none'` e lo rimetti
  in gioco tu con `api.teleport`). Fine automatica con `ends` ('last' | 'all' | 'time') o chiamando `api.end()`.
- Classifica: `rank` ritorna i punti per giocatore (Record) oppure i gruppi dal primo all'ultimo (si usano i POINTS 10, 8, 6, 5, 4…).
- Squadre: tienile in `api.ext`; mostra il colore con `decorate` (anello `av.ring` o un oggetto in `av.deco`). Colori
  squadra già usati nel calcetto: rosso `#ff3b5c`, blu `#3a86ff`.

## Rete, prestazioni, telefoni

- Il server gira 15 volte al secondo (`tick`). **Ritorna `true` da `tick` solo quando cambia qualcosa di importante**:
  ogni `true` manda lo stato a tutti E lo salva nel database (costa). Per numeri che cambiano di continuo (punti dal
  vivo, timer) usa `api.emit({ k: 'xyz_score', ... })` ogni ~0,5 s e tienili in una variabile del modulo sul telefono
  (come `live` in re.tsx); l'HUD si ridisegna 4 volte al secondo da solo.
- Oggetti mossi dal server (palle, uova, monete…): `api.setObj('xyz_ball3', { x, y, z, r, a })` → sul telefono li trovi
  in `f.latest.get('xyz_ball3')` (aggiornati ~15 volte al secondo: ammorbidisci tu il movimento). Prefissa le chiavi
  col nome del minigioco. Gli oggetti spariti non vengono tolti dalla mappa: tieni in `ext` l'elenco di quelli vivi.
- Il mio personaggio si muove sul mio telefono (fisica locale con `stepBody`); il server conosce la mia posizione
  ~15 volte al secondo. Il server non può spostarmi direttamente: usa `api.fling` (spinta) o `api.teleport`.
  Le cose che devono sembrare istantanee sul mio personaggio (trampolini, nastri) le fai anche in `local` sul telefono.
- `ground`/`clamp`/`groundVel` girano sia sul telefono sia sul server per ogni corpo, a ogni passo: devono essere
  velocissimi (niente allocazioni, niente cicli enormi). Se dipendono da stato che cambia (mattonelle, piattaforme),
  tienilo in una variabile del modulo e aggiornalo con `sync(ext)` (`ext` = quello che ritorna la `view` del server).
- Grafica: deve girare a 60 fps su un telefono medio. Riusa geometrie e materiali, usa `THREE.InstancedMesh` per tanti
  oggetti uguali, niente `new` dentro la funzione di ogni fotogramma, texture da canvas piccole (≤1024). Le ombre le
  fa già il mondo (`shadowy(obj)` per attivarle). L'arena si costruisce in `world.arena` (si svuota da sola).
- Stile grafico: cartoon lucido alla Fall Guys, colori saturi, contorni scuri (`outlined(mesh)`), tema **cibo e cucina
  italiana esagerata** (pizze, lasagne, polpette, mattarelli, nonne…), decorazioni intorno (palloncini, bandierine,
  oggetti giganti), qualcosa che si muove anche sullo sfondo. Pezzi pronti in `../scene`: `toy`, `matte`, `glow`,
  `rbox`, `outlined`, `shadowy`, `canvasTex`, `balloon`, `flagLine`, `finishArch`, `burst`, `dust`, `poof`,
  `popText`, `ringPulse`, `splat`, `makeTomato`.
- Telecamera: sta ~9,5 m dietro e ~4 m sopra il personaggio. Muri, stanze e decorazioni alte vicino a dove si gioca
  vanno aggiunti a `world.camBlockers` (in build): la telecamera si avvicina invece di finirci dietro. Le decorazioni
  grandi tienile lontane dal bordo (oltre ~12 m) o basse. Niente luci/emissivi fortissimi al centro (il bagliore copre tutto).
- Icona del minigioco: `icon(size)` con `Badge` + disegno SVG semplice (vedi re.tsx e `MiniIcon` in icons.tsx).
- **Niente adesivi grandi al centro dello schermo** (il giocatore li odia): non usare `c.sticker`. Per i momenti
  importanti: `popText` nel mondo 3D, una riga in cronaca (`c.feed`), suono, scossone leggero.
- Testi sempre in italiano, brevi e simpatici; la scritta di stato (`status`) in MAIUSCOLO come le altre.
- Suoni: `soundManager.playPop/playSuccess/playBonk/playBoom/playWhoosh/playJump/playFall/playError/playShot/playDoor/playTick`.

## Stile del codice

TypeScript come il resto del progetto: commenti brevi in italiano che spiegano il perché, nomi chiari, 2 spazi,
apici singoli, punto e virgola, righe lunghe fino a ~160 caratteri. Niente librerie nuove.
