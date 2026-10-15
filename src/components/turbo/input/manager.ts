// ⚽🚗 Axend Turbo — il "centralino" dei comandi: unisce tastiera + mouse, controller e tocco
// e a ogni passo dà i `Controls` della macchina più le azioni (telecamera palla, tabellone, assistito, menu, guarda dietro).
//
// ================================================================ COME SI USA (per il coordinatore della schermata)
//
//   import { TurboInput } from './input/manager';
//   import { TouchControls } from './input/touch';
//
//   const input = useMemo(() => new TurboInput(), []);          // legge da solo le impostazioni salvate
//   useEffect(() => { input.attach(wrapRef.current!); return () => input.detach(); }, [input]);
//   //   attach(el): tasti sulla finestra, clic del mouse solo su `el` (la schermata del gioco: i clic su pulsanti/menu non contano)
//
//   // a ogni passo di fisica (120 al secondo) o a ogni fotogramma:
//   const f = input.poll(world.car(myId));   // la macchina serve per "orientamento automatico in aria" (può essere undefined)
//   f.controls          → Controls da mandare al motore / alla previsione
//   f.pressed.assist    → appena premuto ASSISTITO (il coordinatore gestisce AssistState: 5 s attivo + 4 s ricarica)
//   f.pressed.menu      → apri/chiudi il menu (Esc / START)
//   f.held.scoreboard   → mostra <Scoreboard> finché è tenuto (Tab / BACK)
//   f.held.lookBack     → telecamera all'indietro finché è tenuto
//   f.ballCam           → stato della telecamera palla (si inverte da solo quando premi C / Y / il pulsante PALLA)
//   f.look              → sguardo libero −1…1 (levetta destra / trascinando a destra sul telefono)
//   f.device            → 'tastiera' | 'controller' | 'tocco' (l'ultimo usato: per mostrare o no i comandi touch)
//
//   // sul telefono (o se input.device === 'tocco'):
//   <TouchControls state={input.touch} prefs={prefs.phone} assist={assistState} ballCam={f.ballCam} boost={car.boost} airborne={!car.onGround} />
//
//   // menu aperto: input.paused = true  → controls a zero, ma pressed.menu continua ad arrivare (per chiudere con Esc)
//   // impostazioni cambiate: <SettingsPanel input={input} …/> chiama già input.setPrefs(); altrimenti chiamalo tu.
//   // input.subscribe(fn) avvisa quando cambiano dispositivo o telecamera palla (per ridisegnare l'interfaccia).
//
// Convenzioni (come Rocket League e come src/game/turbo/car.ts):
//   throttle +1 avanti · steer/yaw + destra · pitch + muso su (levetta/joystick in avanti = muso giù) · roll + rollio a destra
//   rollio libero (Ctrl / X / DRIFT in aria) tenuto: l'imbardata diventa rollio. Freno a mano e rollio libero sono azioni
//   separate (come nel gioco vero) ma di base sullo stesso tasto.
//   Sul telefono con "accelera da solo" la macchina va sempre avanti; RETRO frena e fa retromarcia.
import { noControls, type Car, type Controls } from '../../../game/turbo/car';
import { V3 } from '../../../game/turbo/math';
import { GamepadInput } from './gamepad';
import { KeyboardInput } from './keyboard';
import { isCoarsePointer, loadTurboPrefs, type TurboPrefs } from './prefs';
import { createTouchState, type TouchButtonId, type TouchState } from './touch';
import { TURBO_ACTIONS, clamp1, emptyRaw, noActions, type ActionFlags, type RawInput } from './types';

export type InputDevice = 'tastiera' | 'controller' | 'tocco';

export interface InputFrame {
  controls: Controls;
  held: ActionFlags; // tenute giù adesso
  pressed: ActionFlags; // appena premute (una volta sola per pressione)
  look: { x: number; y: number }; // sguardo libero −1…1
  ballCam: boolean; // telecamera palla accesa?
  airRoll: boolean; // rollio libero tenuto
  device: InputDevice; // ultimo dispositivo usato
}

const UP = new V3(0, 0, 1);
const tmpG = new V3();
const tmpW = new V3();

// tra più dispositivi vince il valore più deciso
const maxAbs = (...v: number[]) => v.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a), 0);

export class TurboInput {
  readonly keyboard: KeyboardInput;
  readonly gamepad: GamepadInput;
  readonly touch: TouchState;
  prefs: TurboPrefs;
  device: InputDevice;
  ballCam: boolean;
  paused = false; // menu aperto: niente comandi alla macchina
  private touchSeen: Record<TouchButtonId, number>;
  private listeners = new Set<() => void>();

  constructor(opts: { prefs?: TurboPrefs } = {}) {
    this.prefs = opts.prefs ?? loadTurboPrefs();
    this.keyboard = new KeyboardInput();
    this.gamepad = new GamepadInput();
    this.gamepad.deadzone = this.prefs.padDeadzone;
    this.touch = createTouchState();
    this.touchSeen = { ...this.touch.presses };
    this.device = isCoarsePointer() ? 'tocco' : 'tastiera';
    this.ballCam = this.prefs.cam.ballCam;
  }

  attach(mouseTarget: HTMLElement | Window = window) {
    this.keyboard.attach(mouseTarget);
  }

  detach() {
    this.keyboard.detach();
  }

  setPrefs(p: TurboPrefs) {
    const camChanged = p.cam.ballCam !== this.prefs.cam.ballCam;
    this.prefs = p;
    this.gamepad.deadzone = p.padDeadzone;
    if (camChanged) this.setBallCam(p.cam.ballCam);
  }

  setBallCam(on: boolean) {
    if (this.ballCam === on) return;
    this.ballCam = on;
    this.emit();
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    for (const fn of this.listeners) fn();
  }

  // ---------------------------------------------------------------- tocco → RawInput
  private readTouch(): RawInput {
    const t = this.touch;
    const r = emptyRaw();
    const tapped = (id: TouchButtonId) => t.presses[id] !== this.touchSeen[id];
    r.steer = t.joy.x;
    r.yaw = t.joy.x;
    r.pitch = t.joy.y; // joystick in su (y −) = muso giù, come la levetta in Rocket League
    const retro = t.down.retro || tapped('retro');
    if (retro) r.throttle = -1;
    else if (this.prefs.phone.autoThrottle) r.throttle = this.device === 'tocco' ? 1 : 0;
    else {
      const y = -t.joy.y;
      r.throttle = Math.abs(y) > 0.2 ? Math.sign(y) * Math.min(1, (Math.abs(y) - 0.2) / 0.6) : 0;
    }
    r.jump = t.down.jump || tapped('jump');
    r.boost = t.down.boost || tapped('boost');
    r.handbrake = r.airRoll = t.down.drift || tapped('drift');
    r.pressed.assist = tapped('assist');
    r.pressed.ballCam = tapped('ballCam');
    r.held.assist = t.down.assist;
    r.held.ballCam = t.down.ballCam;
    r.look = { x: t.look.x, y: t.look.y };
    r.used = t.used;
    t.used = false;
    this.touchSeen = { ...t.presses };
    return r;
  }

  // ---------------------------------------------------------------- un passo
  poll(car?: Car | null): InputFrame {
    const kb = this.keyboard.read();
    const gp = this.gamepad.read();
    const prevDevice = this.device;
    if (gp.used) this.device = 'controller';
    if (kb.used) this.device = 'tastiera';
    if (this.touch.used) this.device = 'tocco';
    const tc = this.readTouch();
    const all = [kb, gp, tc];

    const c: Controls = {
      throttle: clamp1(maxAbs(kb.throttle, gp.throttle, tc.throttle)),
      steer: clamp1(maxAbs(kb.steer, gp.steer, tc.steer)),
      pitch: clamp1(maxAbs(kb.pitch, gp.pitch, tc.pitch)),
      yaw: clamp1(maxAbs(kb.yaw, gp.yaw, tc.yaw)),
      roll: clamp1(maxAbs(kb.roll, gp.roll, tc.roll)),
      jump: all.some((r) => r.jump),
      boost: all.some((r) => r.boost),
      handbrake: all.some((r) => r.handbrake),
    };
    const airRoll = all.some((r) => r.airRoll);
    // rollio libero: l'imbardata diventa rollio (in aria; a terra yaw/roll non contano)
    if (airRoll) {
      c.roll = clamp1(c.roll + c.yaw);
      c.yaw = 0;
    }
    if (car && this.prefs.phone.autoAirOrient) autoOrient(c, car);

    const held = noActions();
    const pressed = noActions();
    for (const a of TURBO_ACTIONS) {
      held[a] = all.some((r) => r.held[a]);
      pressed[a] = all.some((r) => r.pressed[a]);
    }
    const look = { x: clamp1(maxAbs(kb.look.x, gp.look.x, tc.look.x)), y: clamp1(maxAbs(kb.look.y, gp.look.y, tc.look.y)) };

    let changed = prevDevice !== this.device;
    if (pressed.ballCam && !this.paused) {
      this.ballCam = !this.ballCam;
      changed = true;
    }
    if (changed) this.emit();

    return {
      controls: this.paused ? noControls() : c,
      held: this.paused ? { ...noActions(), menu: held.menu } : held,
      pressed: this.paused ? { ...noActions(), menu: pressed.menu } : pressed,
      look: this.paused ? { x: 0, y: 0 } : look,
      ballCam: this.ballCam,
      airRoll: !this.paused && airRoll,
      device: this.device,
    };
  }
}

// "orientamento automatico in aria" (telefono): senza comandi d'aria la macchina rolla con le ruote verso terra
// e, se non sta usando il boost, rimette il muso in piano. Mai mentre si salta (non deve trasformare un doppio salto in capriola).
export function autoOrient(c: Controls, car: Car) {
  if (car.onGround || car.demoed || car.isFlipping || car.isAutoFlipping || car.airTime < 0.15 || c.jump) return;
  if (Math.abs(c.pitch) > 0.05 || Math.abs(c.yaw) > 0.05 || Math.abs(c.roll) > 0.05) return;
  const g = car.rot.unrotate(UP, tmpG); // il "su" del mondo visto dalla macchina (x avanti, y sinistra, z su)
  const w = car.rot.unrotate(car.angVel, tmpW); // x rollio (+ a destra), y beccheggio (+ muso giù)
  const rollErr = Math.atan2(g.y, g.z); // + = inclinata a destra
  c.roll = clamp1(-1.0 * rollErr - 0.21 * w.x);
  if (Math.abs(rollErr) < Math.PI / 2 && !c.boost) {
    const pitchErr = Math.atan2(g.x, g.z); // + = muso in su
    c.pitch = clamp1(-1.3 * pitchErr + 0.43 * w.y);
  }
}
