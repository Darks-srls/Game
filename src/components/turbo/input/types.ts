// ⚽🚗 Axend Turbo — tipi comuni dei comandi (tastiera, controller, tocco).
import type { Binding, TurboAction } from '../contract';

export type { TurboAction };

// tutte le azioni assegnabili del contratto
export type BindAction = Binding['action'];
// quelle che vanno su un tasto/pulsante (gli assi sterzo/beccheggio/imbardata/rollio si fanno con le coppie sinistra/destra)
export type KeyAction = Exclude<BindAction, 'steer' | 'pitch' | 'yaw' | 'roll'>;
// due posti per ogni azione: principale e alternativo ('' = vuoto)
export type KeySlots = [string, string];
export type KeyMap = Record<KeyAction, KeySlots>;

export const TURBO_ACTIONS: readonly TurboAction[] = ['ballCam', 'scoreboard', 'assist', 'menu', 'lookBack'];

export type ActionFlags = Record<TurboAction, boolean>;
export const noActions = (): ActionFlags => ({ ballCam: false, scoreboard: false, assist: false, menu: false, lookBack: false });

// quello che legge ogni dispositivo a ogni passo (prima di unirli)
export interface RawInput {
  throttle: number; // −1…1
  steer: number; // −1…1 (+ destra)
  pitch: number; // −1…1 (+ muso su)
  yaw: number; // −1…1 (+ destra)
  roll: number; // −1…1 (+ rollio a destra), dai tasti di rollio diretto
  jump: boolean;
  boost: boolean;
  handbrake: boolean;
  airRoll: boolean; // rollio libero: in aria sinistra/destra diventano rollio
  held: ActionFlags; // tenute giù adesso
  pressed: ActionFlags; // appena premute (dall'ultima lettura)
  look: { x: number; y: number }; // sguardo libero −1…1
  used: boolean; // il giocatore ha usato questo dispositivo dall'ultima lettura
}

export const emptyRaw = (): RawInput => ({
  throttle: 0,
  steer: 0,
  pitch: 0,
  yaw: 0,
  roll: 0,
  jump: false,
  boost: false,
  handbrake: false,
  airRoll: false,
  held: noActions(),
  pressed: noActions(),
  look: { x: 0, y: 0 },
  used: false,
});

// da "quanto è premuta ogni azione" (0…1) e "appena premuta" a RawInput (uguale per tastiera e pulsanti del controller)
export function rawFromActions(value: (a: KeyAction) => number, justPressed: (a: KeyAction) => boolean): RawInput {
  const r = emptyRaw();
  const on = (a: KeyAction) => value(a) > 0.5;
  r.throttle = clamp1(value('throttle') - value('throttleBack'));
  r.steer = clamp1(value('steerRight') - value('steerLeft'));
  r.pitch = clamp1(value('pitchUp') - value('pitchDown'));
  r.yaw = clamp1(value('yawRight') - value('yawLeft'));
  r.roll = clamp1(value('rollRight') - value('rollLeft'));
  r.jump = on('jump');
  r.boost = on('boost');
  r.handbrake = on('handbrake');
  r.airRoll = on('airRoll');
  for (const a of TURBO_ACTIONS) {
    r.held[a] = on(a);
    r.pressed[a] = justPressed(a);
  }
  return r;
}

export const clamp1 = (v: number) => (v > 1 ? 1 : v < -1 ? -1 : v);

// carica/salva una mappa di tasti unendo quella salvata con le predefinite (così le azioni nuove hanno sempre un tasto)
export function loadMap(storageKey: string, defaults: KeyMap): KeyMap {
  const out = cloneMap(defaults);
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null') as Partial<Record<string, unknown>> | null;
    if (saved && typeof saved === 'object')
      for (const a of Object.keys(out) as KeyAction[]) {
        const v = saved[a];
        if (Array.isArray(v) && v.length === 2 && v.every((x) => typeof x === 'string')) out[a] = [v[0] as string, v[1] as string];
      }
  } catch {
    // memoria del browser non disponibile o rovinata: si usano le predefinite
  }
  return out;
}

export function saveMap(storageKey: string, map: KeyMap) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(map));
  } catch {
    // memoria del browser non disponibile
  }
}

export function cloneMap(map: KeyMap): KeyMap {
  const out = {} as KeyMap;
  for (const a of Object.keys(map) as KeyAction[]) out[a] = [map[a][0], map[a][1]];
  return out;
}

// la lista "piatta" del contratto (una voce per ogni tasto assegnato)
export function mapToBindings(map: KeyMap): Binding[] {
  const out: Binding[] = [];
  for (const a of Object.keys(map) as KeyAction[]) for (const key of map[a]) if (key) out.push({ action: a, key });
  return out;
}

// elementi dell'interfaccia: un clic lì sopra non è un comando di gioco
export function isUiTarget(t: EventTarget | null): boolean {
  const el = t as Element | null;
  return !!el && typeof el.closest === 'function' && !!el.closest('button, a, input, select, textarea, label, [contenteditable="true"], [data-turbo-ui]');
}

export function isTypingTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}
