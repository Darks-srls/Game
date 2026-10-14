// 🎉 Axend Party: come è fatto un minigioco "a moduli" sul telefono (grafica 3D, pulsanti, scritte).
// Ogni minigioco nuovo sta in src/components/party3d/minis/<nome>.tsx e si registra con registerClientMini().
// La grafica si fa con Three.js e i pezzi pronti di ../scene (toy, matte, glow, rbox, outlined, shadowy, canvasTex, balloon…).
import type { ReactNode } from 'react';
import type { PartyView } from '../../../types/game';
import type { Body, ExtKind, NetPos } from '../../../data/party3d';
import type { Avatar, World } from '../scene';

// un personaggio degli altri (posizione già ammorbidita tra un aggiornamento di rete e l'altro)
export interface OtherPos {
  x: number;
  y: number;
  z: number;
  r: number;
  a: number;
  vx?: number;
  vz?: number;
}

// quello che il minigioco riceve a ogni fotogramma
export interface MiniFrame {
  t: number; // secondi (orologio del telefono, per le animazioni)
  dt: number;
  playT: number; // secondi dal VIA (0 durante l'introduzione)
  now: number; // ora del server (ms)
  view: PartyView; // stato della partita (view.ext = dati del minigioco dal server)
  ext: any;
  myId: string;
  me: Body; // il mio personaggio (si può spostare: es. una spinta locale)
  latest: Map<string, NetPos>; // ultime posizioni dal server: personaggi e oggetti (chiavi libere dei minigiochi, es. 'egg3')
  others: Map<string, OtherPos>; // gli altri personaggi, ammorbiditi
}

// per scritte e pulsanti
export interface HudCtx {
  view: PartyView;
  ext: any;
  myId: string;
  me: Body;
  now: number; // ora del server (ms)
  coarse: boolean; // telefono (dita) o PC (mouse)
  alive: boolean;
  finished: boolean;
  yaw: number; // dove guarda la telecamera (radianti, 0 = +z)
  others: Map<string, OtherPos>;
  nameOf: (id: string) => string;
  colorOf: (id: string) => string;
  act: (type: string, payload?: unknown) => void; // azione al server (MG_...)
}

// il pulsante grande rosso (al posto di SCHIAFFO)
export interface MiniButton {
  icon: ReactNode; // es. <UiIcon name="tomato" size={32} /> oppure un piccolo SVG
  label: string;
  cls: string; // sc-red, sc-yellow, sc-blue, sc-green, sc-purple, sc-dark
  keyHint?: string; // sul PC
  size?: number;
  disabled?: boolean;
  cooldown?: { until: number; total: number }; // anello di ricarica (ms, orologio del telefono: Date.now())
  press: () => void;
}

// per gli effetti che arrivano dal server (P3_FX)
export interface FxCtx {
  world: World;
  myId: string;
  me: Body;
  view: PartyView;
  where: (id: string) => { x: number; y: number; z: number } | undefined; // posizione di un personaggio (anche il mio)
  avatar: (id: string) => Avatar | undefined;
  nameOf: (id: string) => string;
  feed: (text: string) => void; // riga nella cronaca in alto a destra
  sticker: (mood: 'win' | 'lose' | 'out' | 'king', text?: string) => void; // adesivo grande al centro (usare poco)
  shake: (amount: number) => void; // scossone della telecamera (0.3 leggero, 1 forte)
}

export interface ClientMini {
  kind: ExtKind;
  orbit: { c: [number, number, number]; r: number }; // giro panoramico (introduzione) e vista dall'alto di chi è fuori: centro e raggio
  highCam?: boolean; // telecamera più alta (arene rotonde dove si vede tutto)
  faceSpawn?: boolean; // la telecamera parte girata come il personaggio
  icon: (size: number) => ReactNode; // stemma rotondo del minigioco (stile MiniIcon: Badge + disegno SVG)
  build: (world: World) => (f: MiniFrame) => void; // costruisce l'arena in world.arena e ritorna l'animazione di ogni fotogramma
  local?: (f: MiniFrame, world: World) => void;
  speed?: (f: MiniFrame) => number; // moltiplicatore della MIA velocità (es. 0.8 mentre porto un uovo); i bot lo fanno con ServerMini.speed // logica sul mio telefono a ogni fotogramma (dopo la mia fisica)
  decorate?: (av: Avatar, id: string, f: MiniFrame) => void; // cappelli, code, macchinine… (av.deco / av.headDeco si svuotano da soli a fine minigioco)
  status?: (h: HudCtx) => { text: string; cls: string } | null; // scritta di stato in basso (sc-green, sc-red pulse-soft, sc-yellow, sc-purple, sc-dark)
  button?: (h: HudCtx) => MiniButton | null; // pulsante principale (null = schiaffo normale; con noPush nessun pulsante)
  hud?: (h: HudCtx) => ReactNode; // pezzi in più a schermo (punteggi, classifiche dal vivo…)
  fx?: (p: any, c: FxCtx) => void; // effetti del server (P3_FX con k del minigioco)
  hint?: string; // comandi sul PC (riga in basso)
  feed?: Record<string, string[]>; // frasi per le eliminazioni, per ragione: '{n} è finito nel sugo'
}

export const CLIENT_MINIS: Partial<Record<ExtKind, ClientMini>> = {};
export function registerClientMini(m: ClientMini) {
  CLIENT_MINIS[m.kind] = m;
}
