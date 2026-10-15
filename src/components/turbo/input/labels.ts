// ⚽🚗 Axend Turbo — i nomi delle azioni da mostrare nelle impostazioni (in italiano, come le voci di Rocket League).
import type { KeyAction } from './types';

export type ActionGroup = 'Guida' | 'In aria' | 'Partita';
export interface ActionInfo {
  action: KeyAction;
  label: string;
  group: ActionGroup;
  hint?: string;
}

export const ACTION_INFO: ActionInfo[] = [
  { action: 'throttle', label: 'Accelera', group: 'Guida' },
  { action: 'throttleBack', label: 'Frena / retromarcia', group: 'Guida' },
  { action: 'steerLeft', label: 'Sterza a sinistra', group: 'Guida' },
  { action: 'steerRight', label: 'Sterza a destra', group: 'Guida' },
  { action: 'jump', label: 'Salto', group: 'Guida', hint: 'due volte = doppio salto, con una direzione = capriola' },
  { action: 'boost', label: 'Boost', group: 'Guida' },
  { action: 'handbrake', label: 'Freno a mano (drift)', group: 'Guida' },
  { action: 'pitchDown', label: 'Muso giù', group: 'In aria' },
  { action: 'pitchUp', label: 'Muso su', group: 'In aria' },
  { action: 'yawLeft', label: 'Gira a sinistra', group: 'In aria' },
  { action: 'yawRight', label: 'Gira a destra', group: 'In aria' },
  { action: 'airRoll', label: 'Rollio libero', group: 'In aria', hint: 'tienilo premuto: sinistra e destra fanno rollare' },
  { action: 'rollLeft', label: 'Rollio a sinistra', group: 'In aria' },
  { action: 'rollRight', label: 'Rollio a destra', group: 'In aria' },
  { action: 'ballCam', label: 'Telecamera palla', group: 'Partita' },
  { action: 'lookBack', label: 'Guarda dietro', group: 'Partita' },
  { action: 'scoreboard', label: 'Tabellone (tieni premuto)', group: 'Partita' },
  { action: 'assist', label: 'Assistito', group: 'Partita', hint: '5 secondi di aiuto, poi 4 di ricarica' },
  { action: 'menu', label: 'Menu', group: 'Partita' },
];

export const actionLabel = (a: KeyAction) => ACTION_INFO.find((i) => i.action === a)?.label ?? a;
