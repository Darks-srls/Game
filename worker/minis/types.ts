// 🎉 Axend Party: come è fatto un minigioco "a moduli" lato server.
// Ogni minigioco nuovo sta in worker/minis/<nome>.ts e si registra con registerServerMini();
// la partita (worker/party3d.ts) gli passa un'"api" con tutto quello che serve: posizioni, eliminazioni, bot, effetti.
import type { Body, ExtKind, Input, NetPos } from '../../src/data/party3d';
import type { Ctx } from '../modes';

// un bot visto dal minigioco (il corpo si muove da solo con la fisica: il minigioco decide solo b.input)
export interface MiniBot {
  id: string;
  name: string;
  skill: number; // 0.35 (scarso) … 0.9 (forte)
  body: Body;
  input: Input; // azzerato prima di ogni giro di pensiero: x, z (-1..1, direzione nel mondo), jump, dash
  thinkAt: number;
  goal: { x: number; z: number; row?: number } | null;
  waitUntil: number;
  reactAt: number;
  pushAnimUntil: number; // animazione dello schiaffo/lancio fino a qui
  mem: any; // memoria libera del minigioco (si azzera a ogni giro)
}

export interface MiniApi<E = any> {
  ext: E; // stato del minigioco (si azzera a ogni giro: vedi init)
  ctx: Ctx;
  now: number; // ora del server (ms)
  t: number; // secondi dal VIA (0 durante l'introduzione)
  stage: 'INTRO' | 'PLAY' | 'RESULT' | 'END';
  stageEndsAt: number | null;
  ids: () => string[]; // tutti: giocatori veri e bot
  inGame: () => string[]; // ancora in gioco: non eliminati e non arrivati
  humans: string[];
  bots: MiniBot[];
  bot: (id: string) => MiniBot | undefined;
  alive: (id: string) => boolean; // non eliminato
  finished: (id: string) => boolean; // arrivato al traguardo
  pos: (id: string) => NetPos | null; // ultima posizione nota (x, y, z, r = verso, a = animazione)
  vel: (id: string) => { vx: number; vz: number }; // velocità (stimata per i giocatori veri)
  color: (id: string) => string;
  name: (id: string) => string; // nome dei bot ('' per i giocatori veri: il nome lo sa il telefono)
  eliminate: (id: string, reason: string) => void; // fuori (P3_FX 'out' con la ragione: vedi FEED in PartyView)
  finish: (id: string) => void; // arrivato: entra nella classifica d'arrivo
  fling: (id: string, v: { vx: number; vy: number; vz: number }) => void; // spinta (bot subito, giocatore vero sul telefono)
  teleport: (id: string, p: { x: number; y: number; z: number; r?: number }) => void; // rimette qualcuno in un punto (es. dopo una caduta)
  dodging: (id: string) => boolean; // sta scattando: schiva colpi e spinte
  emit: (fx: Record<string, unknown>) => void; // effetto a tutti (P3_FX): { k: 'nome', ... }
  end: () => void; // fine del minigioco: classifica (rank) e punti
  setObj: (key: string, p: NetPos) => void; // oggetto mosso dal server (palla, uova…): viaggia con le posizioni, chiave libera
  go: (b: MiniBot, x: number, z: number, speed?: number) => number; // il bot cammina verso (x, z); ritorna la distanza
  push: (b: MiniBot, x?: number, z?: number) => void; // il bot dà uno schiaffo (girato verso x, z se indicati)
  dash: (b: MiniBot) => void; // il bot scatta (se può)
  rand: (a: number, b: number) => number;
}

export interface ServerMini<E = any> {
  kind: ExtKind;
  init?: (api: MiniApi<E>) => E; // inizio del giro (introduzione): stato iniziale del minigioco
  spawn?: (api: MiniApi<E>, id: string, i: number, n: number) => { x: number; y: number; z: number; r: number }; // posto di partenza (i di n, già mescolati)
  play?: (api: MiniApi<E>) => void; // al VIA
  tick?: (api: MiniApi<E>, dt: number) => boolean; // ~15 volte al secondo durante il gioco: true = manda lo stato nuovo a tutti
  bot?: (api: MiniApi<E>, b: MiniBot) => void; // cervello del bot (solo se è in gioco)
  rank?: (api: MiniApi<E>) => Record<string, number> | string[][]; // punti del giro per ognuno, oppure gruppi dal primo all'ultimo
  actions?: Record<string, (api: MiniApi<E>, me: string, payload: any) => boolean>; // azioni dai telefoni (MG_...)
  push?: (api: MiniApi<E>, by: string) => boolean | undefined; // schiaffo tutto suo (undefined = schiaffo normale)
  onPush?: (api: MiniApi<E>, by: string, hit: string[]) => void; // dopo uno schiaffo normale (chi è stato colpito)
  view?: (api: MiniApi<E>, me: string) => unknown; // dati per i telefoni (PartyView.ext): niente segreti degli altri!
  speed?: (api: MiniApi<E>, id: string) => number; // moltiplicatore di velocità dei bot (es. chi porta qualcosa)
  falls?: 'out' | 'none'; // chi cade sotto fallOut: fuori (di solito) o niente (ci pensa il minigioco, es. ripartenza)
  ends?: 'last' | 'all' | 'time'; // fine automatica: ne resta uno (di solito) / nessuno in gioco / solo allo scadere
}

export const SERVER_MINIS: Partial<Record<ExtKind, ServerMini>> = {};
export function registerServerMini<E>(m: ServerMini<E>) {
  SERVER_MINIS[m.kind] = m as ServerMini;
}
