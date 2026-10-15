// ⚽🚗 Axend Turbo — il "contratto" tra le parti del gioco sul telefono:
// motore (engine.ts: rete e previsione), grafica 3D (render/), comandi e scritte (input/, hud/), bot e assistito (game/turbo/bot.ts).
// La fisica è in src/game/turbo (World, Car, Ball): unità uu (1 uu = 1 cm), x di lato, y verso la porta arancione, z in alto.
import type { Controls } from '../../game/turbo/car';
import type { V3 } from '../../game/turbo/math';
import type { TurboEvent, World } from '../../game/turbo/world';

export type { Controls, TurboEvent, World };

// squadre: 0 = blu (difende y−, attacca y+), 1 = arancione
export const TEAM_COLORS = ['#2f7bff', '#ff8a1f'] as const;
export const TEAM_NAMES = ['BLU', 'ARANCIONI'] as const;

// ---------------------------------------------------------------- grafica 3D (render/)

// impostazioni della telecamera come in Rocket League (valori predefiniti del gioco)
export interface CamSettings {
  fov: number; // gradi (60–110)
  distance: number; // uu dietro la macchina (100–400)
  height: number; // uu sopra (40–200)
  angle: number; // gradi di inclinazione (−15…0)
  stiffness: number; // 0 (morbida) … 1 (rigida)
  swivel: number; // velocità di rotazione dello sguardo libero
  ballCam: boolean; // telecamera sulla palla
}
export const DEFAULT_CAM: CamSettings = { fov: 105, distance: 270, height: 100, angle: -4, stiffness: 0.5, swivel: 4.5, ballCam: true };

export type Quality = 'alta' | 'media' | 'bassa';

export interface RenderFrame {
  world: World; // lo stato da disegnare (già previsto: la mia macchina è "nel presente")
  myId: string; // la mia macchina (può non esserci: spettatore)
  t: number; // secondi (orologio del telefono, per le animazioni)
  dt: number; // secondi dall'ultimo fotogramma
  cam: CamSettings;
  look: { x: number; y: number }; // sguardo libero (levetta destra / trascinamento), −1…1
  offsets: Map<string, V3>; // correzioni visive da SOMMARE alle posizioni (id macchina, e 'ball' per la palla): si smorzano da sole
  events: TurboEvent[]; // eventi nuovi in questo fotogramma (effetti e suoni)
  names: Record<string, string>; // id → nome da scrivere sopra le macchine
  quality: Quality;
}

export interface TurboScene {
  render(f: RenderFrame): void;
  resize(width: number, height: number): void;
  setQuality(q: Quality): void;
  dispose(): void;
}
// render/index.ts esporta: createTurboScene(canvas, { lowPower }) => TurboScene
export type CreateTurboScene = (canvas: HTMLCanvasElement, opts: { lowPower: boolean }) => TurboScene;

// ---------------------------------------------------------------- comandi (input/)

// azioni che non sono "comandi della macchina"
export type TurboAction = 'ballCam' | 'scoreboard' | 'assist' | 'menu' | 'lookBack';

// un'azione da tastiera/controller assegnabile: nome, tasto o pulsante
export interface Binding {
  action: keyof Controls | 'throttleBack' | 'steerLeft' | 'steerRight' | 'pitchUp' | 'pitchDown' | 'yawLeft' | 'yawRight' | 'rollLeft' | 'rollRight' | 'airRoll' | TurboAction;
  key: string; // KeyboardEvent.code (es. 'KeyW', 'Space', 'ShiftLeft') o 'Mouse0'/'Mouse2'
}

// ---------------------------------------------------------------- assistito (motore + bot)

// il pulsante ASSISTITO: per 5 secondi guida il bot (parate, passaggi, tiri al volo), poi 4 secondi di ricarica
export const ASSIST = { duration: 5, cooldown: 4 };
export interface AssistState {
  active: boolean;
  endsAt: number; // ms (Date.now) fine dell'aiuto
  readyAt: number; // ms quando si può riusare
}
