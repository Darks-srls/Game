// ⚽🚗 Axend Turbo — le impostazioni del giocatore (telecamera, grafica, telefono, controller), salvate nel browser.
// I tasti hanno le loro chiavi: 'axend_turbo_keys' (tastiera) e 'axend_turbo_pad' (controller).
import { DEFAULT_CAM, type CamSettings, type Quality } from '../contract';

export const PREFS_STORAGE = 'axend_turbo_prefs';

export interface PhonePrefs {
  autoThrottle: boolean; // la macchina va avanti da sola (RETRO per frenare e andare indietro)
  autoAirOrient: boolean; // in aria, senza toccare il joystick, la macchina si raddrizza da sola (ruote verso terra)
  joySize: number; // grandezza del joystick (0,8–1,4)
  joySens: number; // sensibilità del joystick (0,6–1,8: più alta = serve meno corsa per sterzare al massimo)
}

export interface TurboPrefs {
  cam: CamSettings;
  quality: Quality;
  phone: PhonePrefs;
  padDeadzone: number; // zona morta delle levette del controller (0,05–0,4)
}

export const isCoarsePointer = () => typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;

export const DEFAULT_PHONE: PhonePrefs = { autoThrottle: true, autoAirOrient: true, joySize: 1, joySens: 1.15 };

export function defaultPrefs(): TurboPrefs {
  const coarse = isCoarsePointer();
  return {
    cam: { ...DEFAULT_CAM },
    quality: coarse ? 'media' : 'alta',
    phone: { ...DEFAULT_PHONE, autoAirOrient: coarse },
    padDeadzone: 0.15,
  };
}

const num = (v: unknown, def: number, min: number, max: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def);
const bool = (v: unknown, def: boolean) => (typeof v === 'boolean' ? v : def);

export function loadTurboPrefs(): TurboPrefs {
  const d = defaultPrefs();
  try {
    const s = JSON.parse(localStorage.getItem(PREFS_STORAGE) || 'null') as Partial<TurboPrefs> | null;
    if (!s || typeof s !== 'object') return d;
    const c = (s.cam ?? {}) as Partial<CamSettings>;
    const ph = (s.phone ?? {}) as Partial<PhonePrefs>;
    return {
      cam: {
        fov: num(c.fov, d.cam.fov, 60, 110),
        distance: num(c.distance, d.cam.distance, 100, 400),
        height: num(c.height, d.cam.height, 40, 200),
        angle: num(c.angle, d.cam.angle, -15, 0),
        stiffness: num(c.stiffness, d.cam.stiffness, 0, 1),
        swivel: num(c.swivel, d.cam.swivel, 1, 10),
        ballCam: bool(c.ballCam, d.cam.ballCam),
      },
      quality: s.quality === 'alta' || s.quality === 'media' || s.quality === 'bassa' ? s.quality : d.quality,
      phone: {
        autoThrottle: bool(ph.autoThrottle, d.phone.autoThrottle),
        autoAirOrient: bool(ph.autoAirOrient, d.phone.autoAirOrient),
        joySize: num(ph.joySize, d.phone.joySize, 0.8, 1.4),
        joySens: num(ph.joySens, d.phone.joySens, 0.6, 1.8),
      },
      padDeadzone: num(s.padDeadzone, d.padDeadzone, 0.05, 0.4),
    };
  } catch {
    return d;
  }
}

export function saveTurboPrefs(p: TurboPrefs) {
  try {
    localStorage.setItem(PREFS_STORAGE, JSON.stringify(p));
  } catch {
    // memoria del browser non disponibile
  }
}
