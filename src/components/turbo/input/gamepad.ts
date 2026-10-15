// 🎮 Axend Turbo — controller (Gamepad API, mappatura standard), disposizione di Rocket League:
//   RT acceleratore · LT retromarcia · levetta sinistra sterzo / muso su-giù / imbardata
//   A salto · B boost · X freno a mano + rollio libero · Y telecamera palla · LB/RB rollio sinistra/destra
//   levetta destra sguardo libero · BACK tabellone · START menu · croce ↑ assistito · R3 guarda dietro
// I pulsanti si possono riassegnare (salvati in 'axend_turbo_pad'); le levette restano quelle.
import { ACTION_INFO } from './labels';
import { clamp1, cloneMap, emptyRaw, loadMap, rawFromActions, saveMap, type KeyAction, type KeyMap, type RawInput } from './types';

export const PAD_STORAGE = 'axend_turbo_pad';

export const DEFAULT_PAD: KeyMap = {
  throttle: ['Pad7', ''],
  throttleBack: ['Pad6', ''],
  steerLeft: ['', ''],
  steerRight: ['', ''],
  pitchDown: ['', ''],
  pitchUp: ['', ''],
  yawLeft: ['', ''],
  yawRight: ['', ''],
  rollLeft: ['Pad4', ''],
  rollRight: ['Pad5', ''],
  airRoll: ['Pad2', ''],
  jump: ['Pad0', ''],
  boost: ['Pad1', ''],
  handbrake: ['Pad2', ''],
  ballCam: ['Pad3', ''],
  scoreboard: ['Pad8', ''],
  assist: ['Pad12', ''],
  menu: ['Pad9', ''],
  lookBack: ['Pad11', ''],
};

// sul controller sterzo e beccheggio sono sulla levetta: nella lista si riassegnano solo i pulsanti
const STICK: KeyAction[] = ['steerLeft', 'steerRight', 'pitchDown', 'pitchUp', 'yawLeft', 'yawRight'];
export const PAD_ACTIONS: KeyAction[] = ACTION_INFO.map((a) => a.action).filter((a) => !STICK.includes(a));

export const loadPadMap = (): KeyMap => loadMap(PAD_STORAGE, DEFAULT_PAD);
export const savePadMap = (map: KeyMap) => saveMap(PAD_STORAGE, map);

const PRESS = 0.5; // un pulsante (o grilletto) conta "premuto" da metà corsa

// zona morta circolare, poi si riscala così appena fuori dalla zona si parte da 0 e non da 0,15
export function radialDeadzone(x: number, y: number, dz: number): [number, number] {
  const m = Math.hypot(x, y);
  if (m <= dz || m === 0) return [0, 0];
  const k = Math.min(1, (m - dz) / (1 - dz)) / m;
  return [clamp1(x * k), clamp1(y * k)];
}

export class GamepadInput {
  map: KeyMap;
  deadzone = 0.15;
  enabled = true;
  private prev = new Set<string>(); // pulsanti giù alla lettura precedente
  private capturing = false; // si sta riassegnando un pulsante: niente comandi di gioco

  constructor(map: KeyMap = loadPadMap()) {
    this.map = map;
  }

  setMap(map: KeyMap, save = true) {
    this.map = cloneMap(map);
    if (save) savePadMap(this.map);
  }

  resetMap() {
    this.setMap(DEFAULT_PAD);
  }

  bind(action: KeyAction, slot: 0 | 1, code: string) {
    const next = cloneMap(this.map);
    next[action][slot] = code;
    this.setMap(next);
  }

  // il controller in uso (quello toccato per ultimo)
  pad(): Gamepad | null {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
    let pads: (Gamepad | null)[] = [];
    try {
      pads = Array.from(navigator.getGamepads());
    } catch {
      return null;
    }
    let best: Gamepad | null = null;
    for (const p of pads) {
      if (!p || !p.connected) continue;
      if (!best || p.timestamp > best.timestamp) best = p;
    }
    return best;
  }

  // nome del controller collegato (per le impostazioni), null se non c'è
  name(): string | null {
    const p = this.pad();
    if (!p) return null;
    return p.id.replace(/\s*\(.*?\)\s*/g, ' ').trim() || 'Controller';
  }

  read(): RawInput {
    const p = this.pad();
    if (!p || !this.enabled) {
      this.prev.clear();
      return emptyRaw();
    }
    const value = (code: string) => {
      if (!code.startsWith('Pad')) return 0;
      const b = p.buttons[Number(code.slice(3))];
      return b ? (b.value || (b.pressed ? 1 : 0)) : 0;
    };
    const now = new Set<string>();
    p.buttons.forEach((b, i) => {
      if ((b.value || (b.pressed ? 1 : 0)) >= PRESS) now.add(`Pad${i}`);
    });
    if (this.capturing) {
      this.prev = now;
      return emptyRaw();
    }
    const val = (a: KeyAction) => Math.max(0, ...this.map[a].map((c) => (c ? value(c) : 0)));
    const just = (a: KeyAction) => this.map[a].some((c) => !!c && now.has(c) && !this.prev.has(c));
    const r = rawFromActions(val, just);
    // levetta sinistra: sterzo/imbardata in orizzontale, beccheggio in verticale (avanti = muso giù, come Rocket League)
    const [lx, ly] = radialDeadzone(p.axes[0] ?? 0, p.axes[1] ?? 0, this.deadzone);
    const [rx, ry] = radialDeadzone(p.axes[2] ?? 0, p.axes[3] ?? 0, this.deadzone);
    r.steer = clamp1(r.steer + lx);
    r.yaw = clamp1(r.yaw + lx);
    r.pitch = clamp1(r.pitch + ly);
    r.look = { x: rx, y: ry };
    r.used = now.size > 0 || lx !== 0 || ly !== 0 || rx !== 0 || ry !== 0;
    this.prev = now;
    return r;
  }

  // il prossimo pulsante premuto (che non era già giù) va all'azione: cb(codice), cb(null) se annullato
  captureNext(cb: (code: string | null) => void, timeoutMs = 8000): () => void {
    const start = this.pad();
    const held = new Set<string>();
    start?.buttons.forEach((b, i) => b.pressed && held.add(`Pad${i}`));
    let raf = 0;
    const t0 = performance.now();
    this.capturing = true;
    const finish = (code: string | null) => {
      this.capturing = false;
      if (code) this.prev.add(code); // non vale anche come pressione di gioco
      cb(code);
    };
    const loop = () => {
      const p = this.pad();
      if (p) {
        for (let i = 0; i < p.buttons.length; i++) {
          const code = `Pad${i}`;
          const b = p.buttons[i];
          const on = (b.value || (b.pressed ? 1 : 0)) >= PRESS;
          if (on && !held.has(code)) return finish(code);
          if (!on) held.delete(code);
        }
      }
      if (performance.now() - t0 > timeoutMs) return finish(null);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      this.capturing = false;
    };
  }
}
