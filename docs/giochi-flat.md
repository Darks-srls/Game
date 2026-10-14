# Axend Games — come si fa un gioco "flat" a moduli

I giochi flat sono quelli sul telefono senza 3D (come La Spia, L'Impostore, Passa la bomba): si gioca in videochiamata
o seduti allo stesso tavolo, ognuno col suo telefono. Il server (Cloudflare Durable Object) tiene lo stato e manda a
ogni telefono **solo quello che quel giocatore può vedere**.

**Modello da copiare: "Una parola sola" (`PAROLAUNICA`)** — leggilo tutto prima di iniziare:
- `src/data/flat/parolaunica.ts` — contenuti (parole normali e 🌶️) e il tipo della vista (`ParolaUnicaView`)
- `worker/flat/parolaunica.ts` — server: un oggetto `Mode` (start, action, tick, deadline, view, ids, finished, leave) + `registerFlat(...)`
- `src/components/flat/ParolaUnicaView.tsx` — la schermata (React + Tailwind), `export default`
- `scripts/flat-bots/parolaunica.ts` — il "giocatore finto" per il banco di prova (`registerBot(...)`)

Leggi anche: `Mode` e `Ctx` in `worker/modes.ts`, `FLAT_GAMES` in `src/data/flatGames.ts` (nome, regole, minimo
giocatori e impostazioni del tuo gioco sono GIÀ lì: rispettali; se le regole scritte lì non tornano col gioco che fai,
scrivilo nel resoconto finale), gli aiutanti `clean`, `deck`, `shuffle` in `worker/party.ts`, e per lo stile
`src/components/PreferirestiView.tsx` e `src/components/fx.tsx` (TimerRing, GameChip, Podium, PointsPop), `src/components/ui.tsx`
(Avatar, BottomBar, EndBar, Ranking, Segmented, `type ModeProps`).

## File da creare (per il gioco `XYZ`, nomi in minuscolo; la vista in PascalCase)

1. `src/data/flat/xyz.ts` — contenuti + `export interface XyzView { stage: ...; ... }`
2. `worker/flat/xyz.ts` — `export const xyz: Mode<StatoXyz> = {...}` e in fondo `registerFlat('XYZ', xyz)`
3. `src/components/flat/XyzView.tsx` — `export default function XyzView(props: ModeProps)`
4. `scripts/flat-bots/xyz.ts` — `registerBot('XYZ', (view, me, { rand }) => mossa | null)`

**Non modificare file condivisi** (index.ts, registry, flatGames.ts, types/game.ts, App.tsx, LobbyView, worker/index.ts…):
la registrazione la fa il coordinatore. Le impostazioni del gioco si leggono con `flatOpt(settings, 'XYZ', 'chiave')`.
`settings.spicy` = contenuti piccanti attivi.

## Come provare (obbligatorio)

```
npx tsc --noEmit -p .        # i tuoi file non devono avere errori (ignora quelli di file altrui in lavorazione)
npx tsc --noEmit -p tsconfig.giochi.json   # controlla anche i file del server (worker/) e dei banchi di prova
npx tsx scripts/prova-flat.ts XYZ 5 3 --mod worker/flat/xyz.ts --mod scripts/flat-bots/xyz.ts
npx tsx scripts/prova-flat.ts XYZ <minimo> 2 --mod ...      # anche col minimo di giocatori (e col massimo, se c'è)
```
Il banco di prova fa giocare i giocatori finti (ogni 0,4 s simulati guardano la loro vista e forse fanno una mossa;
i tempi scaduti fanno avanzare le fasi): la partita deve **finire sempre**, senza errori, passando da tutte le fasi.
Fai giocare il giocatore finto in modo sensato (anche con errori e bluff, così provi tutti i rami). Prova anche che il
gioco vada avanti quando i giocatori NON fanno niente (tempi scaduti). Non usare il browser, non avviare server, niente commit.

## Regole del server

- `action(s, me, type, payload, ctx)`: azioni `MG_...` dai telefoni. **Controlla sempre tutto** (fase giusta, che sia il
  suo turno, valori validi, testi ripuliti con `clean(testo, max)`): i telefoni possono mandare qualunque cosa.
  Ritorna `true` solo se lo stato è cambiato (= si manda a tutti e si salva).
- `MG_FORCE` (solo `ctx.canLead(me)`): chi guida la stanza fa avanzare la fase bloccata (qualcuno non risponde).
- Tempi: `stageEndsAt` + `deadline(s)` + `tick(s, ctx)` (il server si sveglia alla scadenza). Ogni fase che aspetta
  qualcuno deve avere un tempo massimo, e deve andare avanti da sola quando tutti i collegati (`ctx.isOnline`) hanno fatto.
- `leave(s, id, ctx)`: qualcuno esce a metà: il gioco non deve bloccarsi (salta il suo turno, toglilo dai conteggi…).
- `view(s, me)`: **mai segreti degli altri** (carte in mano, ruoli, voti prima della rivelazione, la parola a chi non
  deve saperla). Chi guarda senza giocare (entrato dopo: non è in `order`) deve vedere una schermata sensata.
- `ctx.emit` NON arriva alle schermate flat: per mostrare qualcosa cambia lo stato e ritorna `true`.
- Punteggi in `scores: Record<id, number>` (così il banco di prova li stampa). Fine partita: `stage: 'END'` → `finished`.
- Stato piccolo (< 8 KB per vista): niente elenchi enormi nella vista.

## Regole della schermata

- Telefono in verticale prima di tutto (larghezza ~380 px), si usa con un pollice: pulsanti grandi in basso con
  `BottomBar`, testi grandi, colori vivaci, animazioni brevi (`pop`, `stagger`, `reveal-pop`, `shine` sono già nel CSS).
- In alto: `GameChip` (es. "🐺 Notte 2") e `TimerRing` (secondi con `useCountdown(stageEndsAt, clockOffset)`).
- Fine partita: `Podium` + `Ranking` + `EndBar` (nuova partita / cambia gioco) come in PreferirestiView.
- Chi guida la stanza vede un pulsante "Avanti" (`onForce`) per sbloccare le fasi.
- **Ruoli segreti senza tradirsi**: si gioca anche dal vivo attorno a un tavolo, quindi suoni, vibrazioni, colori,
  animazioni e TEMPI devono essere identici per tutti i ruoli (stesso colore della carta, stesso suono, stessa durata;
  cambiano solo testo/disegno). Se un ruolo deve agire di notte, fanno qualcosa anche gli altri (così nessuno si tradisce).
- Suoni (uguali per tutti): `soundManager.playReveal/playSuccess/playError/playPop/playVictory/playClick/playTick/playDrumroll`.
  Vibrazione con `haptic(ms)` solo per azioni proprie (non legate a segreti). Coriandoli con `canvas-confetti` alle vittorie.
- Testi in italiano, simpatici e chiarissimi: deve capirsi cosa fare in ogni momento ("Tocca a te", "Aspetta Gino…").
- Emoji sì nei testi; immagini no (non ci sono ancora copertine per i giochi nuovi).

## Contenuti (parole, domande, frasi)

- Tanti e vari (le partite si ripetono spesso: meglio 300 elementi che 50), in italiano corretto, adatti a italiani.
- **I fatti devono essere VERI**: domande di quiz, numeri, definizioni del dizionario, soluzioni: metti solo cose di cui
  sei sicuro al 100%. Se hai un dubbio su una risposta, scarta la domanda.
- 🌶️ piccanti (solo con `settings.spicy`, mescolati a quelli normali come fa `deck()`): per adulti, sporchi e cattivi,
  humor nero pesante: sesso, corpi, alcol, morte, funerali, malattie, roba schifosa, blasfemia scherzosa su Dio, Gesù,
  santi, Papa, preti, e frecciate a personaggi famosi. **Mai** prese in giro su razza, etnia, provenienza o disabilità,
  niente insulti razzisti, niente contenuti sessuali che coinvolgono minori, niente domande "chi di noi…" che chiedono
  di scrivere i nomi degli amici.

## Stile del codice

TypeScript come il resto del progetto: commenti brevi in italiano che spiegano il perché, nomi chiari, 2 spazi, apici
singoli, punto e virgola, righe lunghe fino a ~160 caratteri, Tailwind per lo stile. Niente librerie nuove.
