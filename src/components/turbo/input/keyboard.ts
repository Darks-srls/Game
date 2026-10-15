// ⌨️ Axend Turbo — tastiera e mouse, disposizione di Rocket League su PC (riassegnabile, salvata nel browser).
//   W/S (o ↑/↓)  acceleratore/retromarcia, in aria muso giù/su
//   A/D (o ←/→)  sterzo, in aria imbardata (con il rollio libero premuto diventano rollio)
//   Spazio (o clic destro) salto · Shift sinistro (o clic sinistro) boost
//   Ctrl sinistro freno a mano + rollio libero · Q/E rollio a sinistra/destra
//   C (o rotella) telecamera palla · Tab tabellone · F assistito · X guarda dietro · Esc menu
import { ACTION_INFO } from './labels';
import { cloneMap, isTypingTarget, isUiTarget, loadMap, rawFromActions, saveMap, type KeyAction, type KeyMap, type RawInput } from './types';

export const KEYS_STORAGE = 'axend_turbo_keys';

export const DEFAULT_KEYS: KeyMap = {
  throttle: ['KeyW', 'ArrowUp'],
  throttleBack: ['KeyS', 'ArrowDown'],
  steerLeft: ['KeyA', 'ArrowLeft'],
  steerRight: ['KeyD', 'ArrowRight'],
  pitchDown: ['KeyW', 'ArrowUp'],
  pitchUp: ['KeyS', 'ArrowDown'],
  yawLeft: ['KeyA', 'ArrowLeft'],
  yawRight: ['KeyD', 'ArrowRight'],
  rollLeft: ['KeyQ', ''],
  rollRight: ['KeyE', ''],
  airRoll: ['ControlLeft', ''],
  jump: ['Space', 'Mouse2'],
  boost: ['ShiftLeft', 'Mouse0'],
  handbrake: ['ControlLeft', ''],
  ballCam: ['KeyC', 'Mouse1'],
  scoreboard: ['Tab', ''],
  assist: ['KeyF', ''],
  menu: ['Escape', ''],
  lookBack: ['KeyX', ''],
};

// le azioni da mostrare nella lista "Comandi" della tastiera (tutte)
export const KEY_ACTIONS: KeyAction[] = ACTION_INFO.map((a) => a.action);

export const loadKeyMap = (): KeyMap => loadMap(KEYS_STORAGE, DEFAULT_KEYS);
export const saveKeyMap = (map: KeyMap) => saveMap(KEYS_STORAGE, map);

// nome del tasto da scrivere sullo schermo
const NAMES: Record<string, string> = {
  Space: 'SPAZIO',
  ShiftLeft: 'SHIFT SX',
  ShiftRight: 'SHIFT DX',
  ControlLeft: 'CTRL SX',
  ControlRight: 'CTRL DX',
  AltLeft: 'ALT',
  AltRight: 'ALT GR',
  MetaLeft: 'WIN',
  MetaRight: 'WIN DX',
  Tab: 'TAB',
  Escape: 'ESC',
  Enter: 'INVIO',
  NumpadEnter: 'INVIO TN',
  Backspace: '⌫',
  Delete: 'CANC',
  CapsLock: 'BLOC MAIUSC',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Mouse0: 'CLIC SX',
  Mouse1: 'ROTELLA',
  Mouse2: 'CLIC DX',
  Mouse3: 'MOUSE 4',
  Mouse4: 'MOUSE 5',
  Backquote: '\\',
  Minus: "'",
  Equal: 'ì',
  BracketLeft: 'è',
  BracketRight: '+',
  Semicolon: 'ò',
  Quote: 'à',
  Backslash: 'ù',
  Comma: ',',
  Period: '.',
  Slash: '-',
  IntlBackslash: '<',
  Insert: 'INS',
  Home: 'INIZIO',
  End: 'FINE',
  PageUp: 'PAG ↑',
  PageDown: 'PAG ↓',
};
export function keyLabel(code: string): string {
  if (!code) return '—';
  if (NAMES[code]) return NAMES[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `TN ${code.slice(6)}`;
  if (code.startsWith('Pad')) return padLabel(code);
  return code.toUpperCase();
}

// pulsanti del controller (mappatura standard, nomi Xbox come in Rocket League)
const PAD_NAMES = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'BACK', 'START', 'L3', 'R3', 'CROCE ↑', 'CROCE ↓', 'CROCE ←', 'CROCE →', 'HOME'];
export function padLabel(code: string): string {
  if (!code) return '—';
  const i = Number(code.slice(3));
  return PAD_NAMES[i] ?? `TASTO ${i}`;
}

// bit di PointerEvent.buttons → codice del pulsante del mouse
const MOUSE_BITS: [number, string][] = [
  [1, 'Mouse0'],
  [4, 'Mouse1'],
  [2, 'Mouse2'],
  [8, 'Mouse3'],
  [16, 'Mouse4'],
];

type CaptureCb = (code: string | null) => void;

export class KeyboardInput {
  map: KeyMap;
  enabled = true; // spento = nessun comando (ma i tasti si contano lo stesso per non restare "incollati")
  private down = new Set<string>(); // codici giù adesso (tasti e Mouse0…4)
  private tapped = new Set<string>(); // premuti dall'ultima lettura (anche se già rilasciati: i colpetti veloci non si perdono)
  private mouseOwned = false; // il clic è cominciato sul gioco (non su un pulsante dell'interfaccia)
  private used = false;
  private capture: CaptureCb | null = null;
  private mouseTarget: HTMLElement | Window | null = null;
  private boundCodes = new Set<string>();

  constructor(map: KeyMap = loadKeyMap()) {
    this.map = map;
    this.refreshBound();
  }

  // tasti sulla finestra, mouse sull'elemento del gioco (o sulla finestra)
  attach(mouseTarget: HTMLElement | Window = window) {
    if (this.mouseTarget) this.detach();
    this.mouseTarget = mouseTarget;
    window.addEventListener('keydown', this.onKeyDown, true);
    window.addEventListener('keyup', this.onKeyUp, true);
    window.addEventListener('blur', this.clear);
    document.addEventListener('visibilitychange', this.onVisibility);
    document.addEventListener('fullscreenchange', this.onFullscreen);
    window.addEventListener('beforeunload', this.onBeforeUnload);
    mouseTarget.addEventListener('pointerdown', this.onPointerDown as EventListener);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    mouseTarget.addEventListener('mousedown', this.onMouseDown as EventListener);
    mouseTarget.addEventListener('auxclick', this.onAuxClick as EventListener);
    mouseTarget.addEventListener('contextmenu', this.onContextMenu);
    this.onFullscreen();
  }

  detach() {
    window.removeEventListener('keydown', this.onKeyDown, true);
    window.removeEventListener('keyup', this.onKeyUp, true);
    window.removeEventListener('blur', this.clear);
    document.removeEventListener('visibilitychange', this.onVisibility);
    document.removeEventListener('fullscreenchange', this.onFullscreen);
    window.removeEventListener('beforeunload', this.onBeforeUnload);
    const t = this.mouseTarget;
    if (t) {
      t.removeEventListener('pointerdown', this.onPointerDown as EventListener);
      t.removeEventListener('mousedown', this.onMouseDown as EventListener);
      t.removeEventListener('auxclick', this.onAuxClick as EventListener);
      t.removeEventListener('contextmenu', this.onContextMenu);
    }
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    window.removeEventListener('pointerdown', this.onCapturePointer, true);
    this.mouseTarget = null;
    this.capture = null;
    this.clear();
    keyboardApi()?.unlock?.();
  }

  setMap(map: KeyMap, save = true) {
    this.map = cloneMap(map);
    this.refreshBound();
    if (save) saveKeyMap(this.map);
  }

  resetMap() {
    this.setMap(DEFAULT_KEYS);
  }

  // assegna un tasto a un'azione (slot 0 = principale, 1 = alternativo)
  bind(action: KeyAction, slot: 0 | 1, code: string) {
    const next = cloneMap(this.map);
    next[action][slot] = code;
    this.setMap(next);
  }

  isDown(action: KeyAction) {
    return this.map[action].some((c) => !!c && (this.down.has(c) || this.tapped.has(c)));
  }

  // il prossimo tasto o clic va all'azione da riassegnare: cb(codice), cb('') per togliere (Canc/⌫), cb(null) se annullato (Esc)
  captureNext(cb: CaptureCb): () => void {
    this.capture = cb;
    window.addEventListener('pointerdown', this.onCapturePointer, true);
    return () => {
      if (this.capture === cb) this.capture = null;
      window.removeEventListener('pointerdown', this.onCapturePointer, true);
    };
  }

  get capturing() {
    return !!this.capture;
  }

  read(): RawInput {
    const val = (a: KeyAction) => (this.enabled && this.isDown(a) ? 1 : 0);
    const just = (a: KeyAction) => this.enabled && this.map[a].some((c) => !!c && this.tapped.has(c));
    const r = rawFromActions(val, just);
    r.used = this.used;
    this.used = false;
    this.tapped.clear();
    return r;
  }

  // ---------------------------------------------------------------- eventi
  private refreshBound() {
    this.boundCodes = new Set(Object.values(this.map).flat().filter(Boolean));
  }

  private press(code: string) {
    if (!this.down.has(code)) this.tapped.add(code);
    this.down.add(code);
    this.used = true;
  }

  private onKeyDown = (e: KeyboardEvent) => {
    const code = e.code || e.key;
    if (this.capture) {
      e.preventDefault();
      e.stopPropagation();
      const cb = this.capture;
      this.capture = null;
      window.removeEventListener('pointerdown', this.onCapturePointer, true);
      cb(code === 'Escape' ? null : code === 'Backspace' || code === 'Delete' ? '' : code);
      return;
    }
    // scrivendo in un campo (o con un cursore delle impostazioni selezionato) vale solo il tasto del menu
    if (isTypingTarget(e.target) && !this.map.menu.includes(code)) return;
    if (!this.boundCodes.has(code)) return;
    // niente scorrimento con spazio/frecce, niente Tab che cambia campo, niente scorciatoie del browser con Ctrl (dove si può)
    if (code !== 'Escape') e.preventDefault();
    if (e.repeat) return;
    this.press(code);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    const code = e.code || e.key;
    this.down.delete(code);
    // con Ctrl/Shift lasciati fuori dalla finestra il browser a volte non manda il keyup: si sistema al tasto successivo
    if (!e.ctrlKey) this.down.delete('ControlLeft'), this.down.delete('ControlRight');
    if (!e.shiftKey) this.down.delete('ShiftLeft'), this.down.delete('ShiftRight');
    if (!e.altKey) this.down.delete('AltLeft'), this.down.delete('AltRight');
    if (this.boundCodes.has(code)) e.preventDefault();
  };

  private setMouse(buttons: number) {
    for (const [bit, code] of MOUSE_BITS) {
      if (buttons & bit) this.press(code);
      else this.down.delete(code);
    }
  }

  private onPointerDown = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || isUiTarget(e.target)) return;
    this.mouseOwned = true;
    this.setMouse(e.buttons);
    if (e.button === 1) e.preventDefault(); // niente scorrimento automatico con la rotella
  };

  private onPointerMove = (e: PointerEvent) => {
    // un secondo pulsante premuto mentre il primo è giù arriva come "move" (pulsanti in accordo)
    if (e.pointerType === 'mouse' && this.mouseOwned) this.setMouse(e.buttons);
  };

  private onPointerUp = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    if (this.mouseOwned) this.setMouse(e.buttons);
    if (!e.buttons) this.mouseOwned = false;
  };

  private onMouseDown = (e: MouseEvent) => {
    if (e.button === 1 && !isUiTarget(e.target)) e.preventDefault();
  };

  private onAuxClick = (e: MouseEvent) => {
    if (!isUiTarget(e.target)) e.preventDefault();
  };

  private onContextMenu = (e: Event) => {
    e.preventDefault();
  };

  private onCapturePointer = (e: PointerEvent) => {
    if (!this.capture || e.pointerType !== 'mouse') return;
    e.preventDefault();
    e.stopPropagation();
    const cb = this.capture;
    this.capture = null;
    window.removeEventListener('pointerdown', this.onCapturePointer, true);
    // il clic che ha assegnato il tasto non deve anche premere il pulsante sotto
    const swallow = (ev: Event) => {
      ev.stopPropagation();
      ev.preventDefault();
    };
    window.addEventListener('click', swallow, { capture: true, once: true });
    window.addEventListener('contextmenu', swallow, { capture: true, once: true });
    setTimeout(() => {
      window.removeEventListener('click', swallow, true);
      window.removeEventListener('contextmenu', swallow, true);
    }, 400);
    cb(`Mouse${e.button}`);
  };

  private clear = () => {
    this.down.clear();
    this.tapped.clear();
    this.mouseOwned = false;
  };

  private onVisibility = () => {
    if (document.hidden) this.clear();
  };

  // Ctrl+W chiuderebbe la scheda mentre si tiene il rollio libero: a schermo intero lo si blocca col Keyboard Lock (Chrome/Edge)
  private onFullscreen = () => {
    const kb = keyboardApi();
    if (!kb) return;
    if (document.fullscreenElement) kb.lock?.().catch(() => undefined);
    else kb.unlock?.();
  };

  // fuori dallo schermo intero: se si stanno tenendo i tasti di gioco, il browser chiede conferma prima di chiudere
  private onBeforeUnload = (e: BeforeUnloadEvent) => {
    if (this.down.size > 0) {
      e.preventDefault();
      e.returnValue = '';
    }
  };
}

interface KeyboardLockApi {
  lock?: (codes?: string[]) => Promise<void>;
  unlock?: () => void;
}
function keyboardApi(): KeyboardLockApi | null {
  if (typeof navigator === 'undefined') return null;
  return ((navigator as Navigator & { keyboard?: KeyboardLockApi }).keyboard ?? null) as KeyboardLockApi | null;
}
