// 📱 Axend Turbo — comandi sul telefono (verticale e orizzontale).
// Joystick a sinistra che compare dove appoggi il pollice (sterzo; in aria muso su/giù e imbardata),
// a destra i pulsanti grandi: SALTA, BOOST (tieni premuto), DRIFT (freno a mano / rollio libero in aria), RETRO,
// ASSISTITO (cerchio che si svuota mentre aiuta e si riempie in ricarica) e il piccolo pulsante della telecamera palla.
// Multitouch vero: ogni dito è seguito per conto suo, si può scivolare da un pulsante all'altro senza alzare il pollice;
// trascinando nello spazio vuoto a destra si guarda intorno (sguardo libero).
// Il componente scrive solo dentro `state` (un oggetto condiviso con TurboInput): niente rete, niente fisica.
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { ASSIST, type AssistState } from '../contract';
import { UiIcon } from '../../party3d/icons';
import { haptic } from '../../../utils/audio';
import { DEFAULT_PHONE, type PhonePrefs } from './prefs';

export type TouchButtonId = 'jump' | 'boost' | 'drift' | 'retro' | 'assist' | 'ballCam';
const HOLD_BUTTONS: TouchButtonId[] = ['jump', 'boost', 'drift', 'retro']; // si tengono premuti (e ci si scivola sopra)

export interface TouchState {
  joy: { x: number; y: number }; // −1…1, y + = verso il basso dello schermo
  joyActive: boolean;
  look: { x: number; y: number }; // sguardo libero −1…1
  down: Record<TouchButtonId, boolean>;
  presses: Record<TouchButtonId, number>; // aumenta a ogni pressione (così anche un colpetto velocissimo arriva)
  used: boolean; // toccato dall'ultima lettura
}

export function createTouchState(): TouchState {
  return {
    joy: { x: 0, y: 0 },
    joyActive: false,
    look: { x: 0, y: 0 },
    down: { jump: false, boost: false, drift: false, retro: false, assist: false, ballCam: false },
    presses: { jump: 0, boost: 0, drift: 0, retro: 0, assist: 0, ballCam: 0 },
    used: false,
  };
}

export function resetTouchState(s: TouchState) {
  s.joy.x = s.joy.y = 0;
  s.joyActive = false;
  s.look.x = s.look.y = 0;
  for (const k of Object.keys(s.down) as TouchButtonId[]) s.down[k] = false;
}

// ---------------------------------------------------------------- disposizione (px a scala 1, centro del pulsante misurato dall'angolo in basso a destra)
export const TOUCH_BUTTONS: Record<TouchButtonId, { r: number; b: number; size: number }> = {
  jump: { r: 64, b: 64, size: 96 },
  boost: { r: 172, b: 50, size: 84 },
  drift: { r: 52, b: 176, size: 70 },
  retro: { r: 150, b: 150, size: 62 },
  assist: { r: 128, b: 246, size: 72 },
  ballCam: { r: 40, b: 270, size: 50 },
};
export const TOUCH_CLUSTER = { w: 216, h: 296, margin: 12 };
export const JOY_BASE = 140;

// in orizzontale?
export function useLandscape(): boolean {
  const q = () => typeof window !== 'undefined' && window.innerWidth > window.innerHeight;
  const [land, setLand] = useState(q);
  useEffect(() => {
    const on = () => setLand(q());
    window.addEventListener('resize', on);
    window.addEventListener('orientationchange', on);
    return () => {
      window.removeEventListener('resize', on);
      window.removeEventListener('orientationchange', on);
    };
  }, []);
  return land;
}

// scala dei comandi: telefoni piccoli un po' più piccoli, tablet un po' più grandi
export function touchScale(w: number, h: number) {
  const s = w > h ? h / 400 : w / 400;
  return Math.min(1.15, Math.max(w > h ? 0.72 : 0.8, s));
}
export function useTouchScale(): number {
  const q = () => (typeof window === 'undefined' ? 1 : touchScale(window.innerWidth, window.innerHeight));
  const [s, setS] = useState(q);
  useEffect(() => {
    const on = () => setS(q());
    window.addEventListener('resize', on);
    window.addEventListener('orientationchange', on);
    return () => {
      window.removeEventListener('resize', on);
      window.removeEventListener('orientationchange', on);
    };
  }, []);
  return s;
}

// dove mettere il contatore del boost sul telefono perché non finisca sotto il pollice:
// in verticale sopra i pulsanti, in orizzontale alla loro sinistra
export function touchBoostAnchor(landscape: boolean, scale: number): { right: string; bottom: string } {
  const m = TOUCH_CLUSTER.margin;
  if (landscape) return { right: `calc(max(${m}px, env(safe-area-inset-right)) + ${Math.round(TOUCH_CLUSTER.w * scale + 14)}px)`, bottom: `max(${m}px, env(safe-area-inset-bottom))` };
  return { right: `max(${m}px, env(safe-area-inset-right))`, bottom: `calc(max(${m}px, env(safe-area-inset-bottom)) + ${Math.round(TOUCH_CLUSTER.h * scale + 14)}px)` };
}

// l'ora per il cerchio dell'assistito: si ridisegna di continuo solo mentre aiuta o si ricarica
export function useAssistNow(a: AssistState | null | undefined) {
  const [now, setNow] = useState(() => Date.now());
  const endsAt = a?.endsAt ?? 0;
  const readyAt = a?.readyAt ?? 0;
  const active = !!a?.active;
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const t = Date.now();
      setNow(t);
      if (t < Math.max(endsAt, readyAt) + 100) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active, endsAt, readyAt]);
  return now;
}

export type AssistPhase = 'ready' | 'active' | 'cooldown';
// stato del pulsante ASSISTITO: fase, quanto è pieno il cerchio (0…1) e secondi da scrivere
export function assistView(a: AssistState | null | undefined, now: number): { phase: AssistPhase; fill: number; secs: number } {
  if (!a) return { phase: 'ready', fill: 1, secs: 0 };
  if (a.active && now < a.endsAt) {
    const left = a.endsAt - now;
    return { phase: 'active', fill: Math.max(0, Math.min(1, left / (ASSIST.duration * 1000))), secs: Math.ceil(left / 1000) };
  }
  if (now < a.readyAt) {
    const left = a.readyAt - now;
    return { phase: 'cooldown', fill: Math.max(0, Math.min(1, 1 - left / (ASSIST.cooldown * 1000))), secs: Math.ceil(left / 1000) };
  }
  return { phase: 'ready', fill: 1, secs: 0 };
}

// ---------------------------------------------------------------- icone in più (boost e retro)
function FlameIcon({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 2c1 5 7 8 7 15a7 7 0 0 1-14 0c0-4 2-6 3-8 1 3 2 4 3 4-1-4 0-8 1-11z" fill="#ff7b1f" stroke="#1d0f3d" strokeWidth="3" strokeLinejoin="round" />
      <path d="M16 15c1 2 3 3 3 6a3 3 0 0 1-6 0c0-2 2-3 3-6z" fill="#ffe259" />
    </svg>
  );
}
function BackIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 29L5 17h6V4h10v13h6z" fill="#ffffff" stroke="#1d0f3d" strokeWidth="3" strokeLinejoin="round" />
    </svg>
  );
}
function DriftIcon({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M6 22c4-10 14-14 22-12" fill="none" stroke="#1d0f3d" strokeWidth="7" strokeLinecap="round" />
      <path d="M6 22c4-10 14-14 22-12" fill="none" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M22 5l7 5-7 5" fill="#ffffff" stroke="#1d0f3d" strokeWidth="3" strokeLinejoin="round" />
    </svg>
  );
}
function RollIcon({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M26 16a10 10 0 1 1-4-8" fill="none" stroke="#1d0f3d" strokeWidth="7" strokeLinecap="round" />
      <path d="M26 16a10 10 0 1 1-4-8" fill="none" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M18 3l7 4-6 5" fill="#ffffff" stroke="#1d0f3d" strokeWidth="3" strokeLinejoin="round" />
    </svg>
  );
}
export function AssistIcon({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="7" y="9" width="18" height="15" rx="5" fill="#ffffff" stroke="#1d0f3d" strokeWidth="3" />
      <circle cx="12.5" cy="16" r="2.3" fill="#12b76a" />
      <circle cx="19.5" cy="16" r="2.3" fill="#12b76a" />
      <path d="M16 9V4M13 4h6M4 15v5M28 15v5" stroke="#1d0f3d" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// ---------------------------------------------------------------- il componente
export interface TouchControlsProps {
  state: TouchState; // lo stesso oggetto di TurboInput.touch
  prefs?: Partial<PhonePrefs>; // grandezza e sensibilità del joystick, accelera da solo
  assist?: AssistState | null; // null/undefined = pulsante ASSISTITO nascosto
  ballCam?: boolean; // per illuminare il pulsante della telecamera palla
  boost?: number; // 0–100: a zero il pulsante BOOST si spegne
  airborne?: boolean; // in aria: DRIFT diventa ROLLIO
  disabled?: boolean; // durante menu/fine partita: si vedono ma non comandano
  hideAssist?: boolean;
}

type Track = { kind: 'btn'; id: TouchButtonId | null } | { kind: 'look'; x0: number; y0: number };

export function TouchControls({ state, prefs, assist, ballCam = false, boost = 100, airborne = false, disabled = false, hideAssist = false }: TouchControlsProps) {
  const p = { ...DEFAULT_PHONE, ...prefs };
  const landscape = useLandscape();
  const scale = useTouchScale();
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Partial<Record<TouchButtonId, HTMLDivElement | null>>>({});
  const joyPointer = useRef<number | null>(null);
  const joyCenter = useRef({ x: 0, y: 0 });
  const tracks = useRef(new Map<number, Track>());
  const [down, setDown] = useState<Record<TouchButtonId, boolean>>(() => ({ ...state.down }));
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const showAssist = !hideAssist && !!assist;

  const R = (JOY_BASE * p.joySize * scale) / 2;
  const sens = p.joySens;
  const m = TOUCH_CLUSTER.margin;
  const idleLeft = `max(${m + 6}px, env(safe-area-inset-left))`;
  const idleBottom = `max(${m + 6}px, env(safe-area-inset-bottom))`;

  // niente zoom, niente scorrimento, niente menu del tasto lungo (anche su iPhone)
  useEffect(() => {
    const els = [leftRef.current, rightRef.current].filter(Boolean) as HTMLElement[];
    const stop = (e: Event) => e.cancelable && e.preventDefault();
    for (const el of els) {
      el.addEventListener('touchstart', stop, { passive: false });
      el.addEventListener('touchmove', stop, { passive: false });
    }
    document.addEventListener('gesturestart', stop);
    return () => {
      for (const el of els) {
        el.removeEventListener('touchstart', stop);
        el.removeEventListener('touchmove', stop);
      }
      document.removeEventListener('gesturestart', stop);
    };
  }, []);

  // smontato o disattivato: si lascia tutto
  useEffect(() => {
    if (disabled) releaseAll();
  }, [disabled]);
  useEffect(
    () => () => {
      resetTouchState(state);
    },
    [state],
  );

  const syncDown = () => {
    setDown((prev) => {
      const keys = Object.keys(prev) as TouchButtonId[];
      return keys.some((k) => prev[k] !== state.down[k]) ? { ...state.down } : prev;
    });
  };

  function releaseAll() {
    tracks.current.clear();
    joyPointer.current = null;
    resetTouchState(state);
    resetKnob();
    syncDown();
  }

  // ---------------------------------------------------------------- joystick
  function resetKnob() {
    const base = baseRef.current;
    const knob = knobRef.current;
    if (base) {
      base.style.left = idleLeft;
      base.style.top = 'auto';
      base.style.bottom = idleBottom;
      base.style.opacity = '';
    }
    if (knob) knob.style.transform = 'translate(-50%, -50%)';
  }

  function placeBase(cx: number, cy: number) {
    const zone = leftRef.current!.getBoundingClientRect();
    const m = 8;
    cx = Math.min(zone.right - R - m, Math.max(zone.left + R + m, cx));
    cy = Math.min(zone.bottom - R - m, Math.max(zone.top + R + m, cy));
    joyCenter.current = { x: cx, y: cy };
    const base = baseRef.current!;
    base.style.left = `${cx - zone.left - R}px`;
    base.style.top = `${cy - zone.top - R}px`;
    base.style.bottom = 'auto';
    base.style.opacity = '1';
  }

  function moveJoy(x: number, y: number) {
    let dx = x - joyCenter.current.x;
    let dy = y - joyCenter.current.y;
    let len = Math.hypot(dx, dy);
    // il joystick segue il pollice se va troppo oltre (così per invertire lo sterzo basta poco)
    if (len > R * 1.35) {
      const k = (len - R * 1.35) / len;
      placeBase(joyCenter.current.x + dx * k, joyCenter.current.y + dy * k);
      dx = x - joyCenter.current.x;
      dy = y - joyCenter.current.y;
      len = Math.hypot(dx, dy);
    }
    const kx = len > R ? (dx / len) * R : dx;
    const ky = len > R ? (dy / len) * R : dy;
    if (knobRef.current) knobRef.current.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;
    const mag = len / R;
    const dz = 0.1;
    if (mag <= dz || len === 0) {
      state.joy.x = state.joy.y = 0;
    } else {
      const m = Math.min(1, ((Math.min(mag, 1) - dz) / (1 - dz)) * sens);
      state.joy.x = (dx / len) * m;
      state.joy.y = (dy / len) * m;
    }
    state.used = true;
  }

  const onJoyDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabledRef.current || joyPointer.current !== null) return;
    e.preventDefault();
    joyPointer.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    placeBase(e.clientX, e.clientY);
    state.joyActive = true;
    moveJoy(e.clientX, e.clientY);
  };
  const onJoyMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (joyPointer.current !== e.pointerId) return;
    moveJoy(e.clientX, e.clientY);
  };
  const onJoyUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (joyPointer.current !== e.pointerId) return;
    joyPointer.current = null;
    state.joy.x = state.joy.y = 0;
    state.joyActive = false;
    resetKnob();
  };

  // ---------------------------------------------------------------- pulsanti (e sguardo libero nello spazio vuoto)
  function hit(x: number, y: number, onlyHold: boolean): TouchButtonId | null {
    let best: TouchButtonId | null = null;
    let bestD = Infinity;
    for (const id of Object.keys(TOUCH_BUTTONS) as TouchButtonId[]) {
      if (onlyHold && !HOLD_BUTTONS.includes(id)) continue;
      if (id === 'assist' && !showAssist) continue;
      const el = btnRefs.current[id];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const d = Math.hypot(x - cx, y - cy);
      if (d <= (r.width / 2) * 1.15 && d < bestD) {
        best = id;
        bestD = d;
      }
    }
    return best;
  }

  // un pulsante è giù se almeno un dito ci sta sopra
  function recompute() {
    const held = new Set<TouchButtonId>();
    for (const t of tracks.current.values()) if (t.kind === 'btn' && t.id) held.add(t.id);
    for (const id of Object.keys(state.down) as TouchButtonId[]) {
      const on = held.has(id);
      if (on && !state.down[id]) {
        state.presses[id]++;
        if (id === 'jump' || id === 'assist' || id === 'ballCam') haptic(10);
      }
      state.down[id] = on;
    }
    state.used = true;
    syncDown();
  }

  const onBtnDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabledRef.current) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const id = hit(e.clientX, e.clientY, false);
    if (id) tracks.current.set(e.pointerId, { kind: 'btn', id });
    else tracks.current.set(e.pointerId, { kind: 'look', x0: e.clientX, y0: e.clientY });
    recompute();
  };
  const onBtnMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const t = tracks.current.get(e.pointerId);
    if (!t) return;
    if (t.kind === 'look') {
      const k = 130 * scale;
      state.look.x = Math.max(-1, Math.min(1, (e.clientX - t.x0) / k));
      state.look.y = Math.max(-1, Math.min(1, (e.clientY - t.y0) / k));
      state.used = true;
      return;
    }
    // scivolare: si entra solo nei pulsanti da tenere (salta, boost, drift, retro), mai per sbaglio in ASSISTITO
    const id = t.id && !HOLD_BUTTONS.includes(t.id) ? (hit(e.clientX, e.clientY, false) === t.id ? t.id : null) : hit(e.clientX, e.clientY, true);
    if (id !== t.id) {
      t.id = id;
      recompute();
    }
  };
  const onBtnUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const t = tracks.current.get(e.pointerId);
    if (!t) return;
    tracks.current.delete(e.pointerId);
    if (t.kind === 'look') {
      if (![...tracks.current.values()].some((o) => o.kind === 'look')) state.look.x = state.look.y = 0;
      return;
    }
    recompute();
  };

  // misure: a scala in base allo schermo
  useLayoutEffect(() => {
    resetKnob();
  }, [R]);

  const zoneH = landscape ? '80%' : '52%';

  return (
    <div data-turbo-ui className="pointer-events-none absolute inset-0 z-20 select-none [-webkit-touch-callout:none]" onContextMenu={(e) => e.preventDefault()}>
      {/* sinistra: zona del joystick */}
      <div
        ref={leftRef}
        className="pointer-events-auto absolute bottom-0 left-0 touch-none"
        style={{ width: landscape ? '42%' : '48%', height: zoneH }}
        onPointerDown={onJoyDown}
        onPointerMove={onJoyMove}
        onPointerUp={onJoyUp}
        onPointerCancel={onJoyUp}
        onLostPointerCapture={onJoyUp}
      >
        <div
          ref={baseRef}
          className="absolute rounded-full border-4 border-[#1d0f3d]/70 bg-[#1d0f3d]/35 opacity-70 backdrop-blur-sm transition-opacity"
          style={{ width: R * 2, height: R * 2, left: idleLeft, bottom: idleBottom }}
        >
          {/* tacche: avanti/indietro e lati */}
          <span className="absolute left-1/2 top-1.5 h-2 w-1 -translate-x-1/2 rounded bg-white/50" />
          <span className="absolute bottom-1.5 left-1/2 h-2 w-1 -translate-x-1/2 rounded bg-white/50" />
          <span className="absolute left-1.5 top-1/2 h-1 w-2 -translate-y-1/2 rounded bg-white/50" />
          <span className="absolute right-1.5 top-1/2 h-1 w-2 -translate-y-1/2 rounded bg-white/50" />
          <div ref={knobRef} className="sc-btn sc-yellow absolute left-1/2 top-1/2 !rounded-full" style={{ width: R * 0.85, height: R * 0.85, transform: 'translate(-50%, -50%)', transition: 'none' }} />
        </div>
      </div>

      {/* destra: pulsanti e sguardo libero */}
      <div
        ref={rightRef}
        className="pointer-events-auto absolute bottom-0 right-0 touch-none"
        style={{ width: landscape ? '58%' : '52%', height: zoneH }}
        onPointerDown={onBtnDown}
        onPointerMove={onBtnMove}
        onPointerUp={onBtnUp}
        onPointerCancel={onBtnUp}
        onLostPointerCapture={onBtnUp}
      >
        <div
          className="absolute"
          style={{
            width: TOUCH_CLUSTER.w,
            height: TOUCH_CLUSTER.h,
            right: `max(${m}px, env(safe-area-inset-right))`,
            bottom: `max(${m}px, env(safe-area-inset-bottom))`,
            transform: `scale(${scale})`,
            transformOrigin: '100% 100%',
          }}
        >
          <Btn id="jump" refs={btnRefs} down={down.jump} cls="sc-blue" label="SALTA" icon={<UiIcon name="jump" size={34} />} disabled={disabled} />
          <Btn id="boost" refs={btnRefs} down={down.boost} cls={boost > 0 ? 'sc-yellow' : 'sc-dark'} label="BOOST" icon={<FlameIcon size={32} />} disabled={disabled} dim={boost <= 0} />
          <Btn id="drift" refs={btnRefs} down={down.drift} cls="sc-purple" label={airborne ? 'ROLLIO' : 'DRIFT'} icon={airborne ? <RollIcon size={26} /> : <DriftIcon size={26} />} disabled={disabled} />
          <Btn id="retro" refs={btnRefs} down={down.retro} cls="sc-dark" label="RETRO" icon={<BackIcon size={22} />} disabled={disabled} small />
          {showAssist && <AssistBtn refs={btnRefs} down={down.assist} assist={assist!} disabled={disabled} />}
          <Btn id="ballCam" refs={btnRefs} down={down.ballCam} cls={ballCam ? 'sc-yellow' : 'sc-dark'} label="PALLA" icon={<UiIcon name="ball" size={20} />} disabled={disabled} small />
        </div>
      </div>
    </div>
  );
}

function Btn({
  id,
  refs,
  down,
  cls,
  label,
  icon,
  disabled,
  dim,
  small,
  children,
}: {
  id: TouchButtonId;
  refs: { current: Partial<Record<TouchButtonId, HTMLDivElement | null>> };
  down: boolean;
  cls: string;
  label: string;
  icon: ReactNode;
  disabled?: boolean;
  dim?: boolean;
  small?: boolean;
  children?: ReactNode;
}) {
  const pos = TOUCH_BUTTONS[id];
  return (
    <div
      ref={(el) => {
        refs.current[id] = el;
      }}
      aria-label={label}
      role="button"
      className={`sc-btn ${cls} absolute flex flex-col items-center justify-center !rounded-full ${disabled || dim ? 'opacity-50' : ''}`}
      style={{
        width: pos.size,
        height: pos.size,
        right: pos.r - pos.size / 2,
        bottom: pos.b - pos.size / 2,
        transform: down ? 'translateY(4px) scale(0.96)' : undefined,
        boxShadow: down ? 'inset 0 -3px 0 rgba(0,0,0,0.22), inset 0 3px 0 rgba(255,255,255,0.45), 0 1px 0 #1d0f3d' : undefined,
        filter: down ? 'brightness(1.12)' : undefined,
      }}
    >
      {icon}
      <span className={`sc-stroke-sm font-display leading-none text-white ${small ? 'mt-0 text-[11px]' : 'mt-0.5 text-[14px]'}`}>{label}</span>
      {children}
    </div>
  );
}

function AssistBtn({ refs, down, assist, disabled }: { refs: { current: Partial<Record<TouchButtonId, HTMLDivElement | null>> }; down: boolean; assist: AssistState; disabled?: boolean }) {
  const now = useAssistNow(assist);
  const v = assistView(assist, now);
  const C = 289;
  const ringColor = v.phase === 'active' ? '#ffe259' : v.phase === 'cooldown' ? '#7cf29a' : '#ffffff';
  return (
    <Btn
      id="assist"
      refs={refs}
      down={down}
      cls={v.phase === 'ready' ? 'sc-green' : v.phase === 'active' ? 'sc-yellow' : 'sc-dark'}
      label={v.phase === 'ready' ? 'ASSISTITO' : v.phase === 'active' ? `AIUTO ${v.secs}` : `${v.secs}…`}
      icon={<AssistIcon size={26} />}
      disabled={disabled}
      small
    >
      <svg className={`pointer-events-none absolute inset-[-9px] ${v.phase === 'ready' ? 'pulse-soft' : ''}`} viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="46" fill="none" stroke="#1d0f3d" strokeWidth="10" opacity={0.55} />
        <circle cx="50" cy="50" r="46" fill="none" stroke={ringColor} strokeWidth="6" strokeDasharray={`${v.fill * C} ${C}`} transform="rotate(-90 50 50)" strokeLinecap="round" />
      </svg>
    </Btn>
  );
}
