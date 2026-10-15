# Axend Turbo — calcio con le macchine come Rocket League

Gioco `TURBO`: 1 contro 1, 2 contro 2 o 3 contro 3 (i posti vuoti li prendono i bot), partite da 5 minuti con supplementari
a golden goal. Fisica, misure del campo, macchina e palla ricalcano Rocket League (costanti di RocketSim e misure di RLBot):
pinch, flip reset, guida sui muri, demolizioni e tutti i salti/flip funzionano come nel gioco vero.

## Dove sta cosa

- `src/game/turbo/` — la fisica, uguale per server e telefono (deterministica, 120 passi al secondo)
  - `consts.ts` — tutte le costanti (unità uu = cm; x di lato, y verso la porta arancione, z in alto)
  - `arena.ts` — il campo come funzione di distanza (ottagono 8192×10240, raccordi, porte 1785×643 profonde 880)
  - `car.ts` — macchina: ruote a raggio (anche sulla palla: così nasce il flip reset), sospensioni, attrito, salti, flip, aria, boost
  - `ball.ts` — palla: rimbalzi con l'effetto di Rocket League, attrito dell'aria
  - `world.ts` — partita: calcio d'inizio, urti macchina–palla (con la spinta extra di Psyonix), urti e demolizioni, gol, statistiche, foto dello stato (`snapshot`/`load`)
  - `bot.ts` + `bot/` — i bot (riempiono le squadre) e l'ASSISTITO (`assistControls`, `airAssist`)
  - `room.ts` — quello che il server dice della partita (squadre, punteggio, fine) e le opzioni della stanza
- `worker/turbo.ts` — server: la partita gira nel Durable Object (giro da 60 Hz con recupero dei passi), applica i comandi per passo, manda la foto del campo 30 volte al secondo (`FAST`)
- `src/components/turbo/` — telefono/PC
  - `engine.ts` — rete: previsione della mia macchina e correzione a ogni foto (rifà i passi coi miei comandi), anticipo che si regola da solo
  - `TurboView.tsx` — la schermata: unisce motore, grafica, comandi, assistito e scritte
  - `render/` — grafica 3D (Three.js): stadio, macchine, palla, effetti, telecamera come Rocket League
  - `input/` — tastiera e mouse riassegnabili, controller, comandi touch (joystick + SALTA/BOOST/DRIFT/RETRO/ASSISTITO)
  - `hud/` — punteggio e orologio, boost, conto alla rovescia, gol, notizie, tabellone, fine partita, impostazioni

## Rete (in breve)

- Il server è l'unico arbitro. I telefoni mandano i comandi per passo (`FAST_IN`, ogni 4 passi con gli ultimi 8 ripetuti: se un pacchetto si perde arriva col successivo).
- Il telefono gira qualche passo "avanti" rispetto al server (l'anticipo, misurato dal server in ogni foto), così la propria macchina risponde subito.
- A ogni foto si riparte da lì e si rifanno i passi coi propri comandi; la differenza diventa una correzione visiva che si smorza in un decimo di secondo.
- Un telefono muto per mezzo secondo (app in pausa, linea persa) ha la macchina ferma; chi esce viene sostituito da un bot.

## Prove

- `npx tsx scripts/prova-turbo.ts` — banco della fisica (velocità massime, salti, flip, giri, muri, soffitto, rimbalzi, flip reset, demolizioni…)
- `npx tsx scripts/prova-turbo-rete.ts` — server e due telefoni finti con ritardo, sbalzi e pacchetti persi: la previsione deve combaciare col server
