// ⚡ Microsfide: attrezzi comuni alle sfide (tempo, misure dell'arena, effetti, stili)
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { haptic, soundManager } from '../../../utils/audio';

// cosa riceve ogni sfida
export interface GameProps {
  seed: number;
  diff: number; // 0 … 4
  dur: number; // ms di gioco
  clock: () => number; // ms dall'inizio della sfida (ora del server, uguale per tutti)
  over: boolean; // sfida finita per me: niente più tocchi, animazioni ferme
  win: () => void;
  lose: (why: string) => void;
  me: { avatar: string; color: string } | null;
}

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

// ridisegna a ogni fotogramma finché la sfida è in corso e dà il tempo trascorso (fermo quando finisce);
// onFrame gira prima del disegno, fuori dal render (collisioni, fisica)
export function useFrame(clock: () => number, on: boolean, onFrame?: (t: number) => void): number {
  const [, force] = useState(0);
  const last = useRef(clock());
  const cb = useRef(onFrame);
  cb.current = onFrame;
  useEffect(() => {
    if (!on) return;
    let raf = 0;
    const loop = () => {
      cb.current?.(clock());
      force((x) => (x + 1) & 0xffff);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [on, clock]);
  if (on) last.current = clock();
  return last.current;
}

// misure dell'arena (in pixel), aggiornate se lo schermo cambia
export function useBox<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const upd = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    upd();
    const ro = new ResizeObserver(upd);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, box] as const;
}

// punto del tocco dentro un elemento (pixel)
export function rel(e: { clientX: number; clientY: number }, el: HTMLElement | null) {
  const r = el?.getBoundingClientRect();
  return r ? { x: e.clientX - r.left, y: e.clientY - r.top } : { x: 0, y: 0 };
}

// distanza di un punto da un segmento (per gli swipe che tagliano)
export function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  const k = len ? clamp(((px - ax) * dx + (py - ay) * dy) / len, 0, 1) : 0;
  return Math.hypot(px - (ax + k * dx), py - (ay + k * dy));
}

// effetti che compaiono e spariscono (schizzi, sbuffi, +1)
export interface Fx {
  id: number;
  x: number;
  y: number;
  node: ReactNode;
  cls?: string;
}
export function useFx(life = 650) {
  const [list, setList] = useState<Fx[]>([]);
  const seq = useRef(0);
  const add = useCallback(
    (x: number, y: number, node: ReactNode, cls = 'ms-burst') => {
      const id = ++seq.current;
      setList((l) => [...l.slice(-14), { id, x, y, node, cls }]);
      setTimeout(() => setList((l) => l.filter((f) => f.id !== id)), life);
    },
    [life],
  );
  return [list, add] as const;
}
export function FxLayer({ list }: { list: Fx[] }) {
  return (
    <>
      {list.map((f) => (
        // le animazioni (ms-burst, ms-rise, ms-smoke, ms-popin) centrano da sole con translate(-50%,-50%)
        <span key={f.id} className={`pointer-events-none absolute z-20 whitespace-nowrap ${f.cls ?? ''}`} style={{ left: f.x, top: f.y }}>
          {f.node}
        </span>
      ))}
    </>
  );
}

// suoni e vibrazioni dei tocchi (uguali per tutti)
export const sfx = {
  tap: () => {
    soundManager.playClick();
    haptic(10);
  },
  hit: () => {
    soundManager.playPop();
    haptic(18);
  },
  bonk: () => {
    soundManager.playBonk();
    haptic([60, 30, 60]);
  },
  boom: () => {
    soundManager.playBoom();
    haptic([120, 40, 120]);
  },
  swoosh: () => {
    soundManager.playWhoosh();
    haptic(12);
  },
  jump: () => {
    soundManager.playJump();
    haptic(12);
  },
};

// pallini di avanzamento (es. 2 su 3)
export function Dots({ done, total, className = '' }: { done: number; total: number; className?: string }) {
  return (
    <div className={`pointer-events-none flex items-center justify-center gap-1.5 ${className}`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-3.5 w-3.5 rounded-full border-2 border-white/90 transition-all duration-150 ${i < done ? 'scale-110 bg-white shadow-[0_0_10px_#fff]' : 'bg-black/25'}`}
        />
      ))}
    </div>
  );
}

// etichetta in alto nell'arena (es. "Trova: PIZZA")
export function Banner({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-x-0 top-2 z-10 flex justify-center px-3 ${className}`}>
      <span className="rounded-full bg-black/45 px-4 py-1.5 text-center font-display text-lg leading-tight text-white shadow-[0_3px_0_rgba(0,0,0,0.3)] backdrop-blur-sm">
        {children}
      </span>
    </div>
  );
}

// tutte le animazioni delle Microsfide (prefisso ms- per non pestare i piedi a nessuno)
export const MS_CSS = `
.ms-root { touch-action: none; overscroll-behavior: none; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
.ms-root * { -webkit-tap-highlight-color: transparent; }
.ms-emoji { font-family: "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif; line-height: 1; }
.ms-stroke { -webkit-text-stroke: 2px rgba(20,6,60,0.85); paint-order: stroke fill; text-shadow: 0 5px 0 rgba(20,6,60,0.55); }
@keyframes ms-slam { 0% { opacity: 0; transform: scale(3) rotate(-10deg); } 55% { opacity: 1; transform: scale(0.9) rotate(3deg); } 75% { transform: scale(1.06) rotate(-1deg); } 100% { transform: scale(1) rotate(0); } }
.ms-slam { animation: ms-slam 0.5s cubic-bezier(0.2, 1.2, 0.4, 1) both; }
@keyframes ms-rays { to { transform: rotate(360deg); } }
.ms-rays { animation: ms-rays 9s linear infinite; }
@keyframes ms-shrink { 0% { width: 100%; background: #ffffff; } 70% { background: #ffd02e; } 100% { width: 0%; background: #ff3b6e; } }
@keyframes ms-burst { 0% { opacity: 0; transform: translate(-50%,-50%) scale(0.4); } 20% { opacity: 1; transform: translate(-50%,-50%) scale(1.25); } 100% { opacity: 0; transform: translate(-50%,-50%) scale(1.6); } }
.ms-burst { animation: ms-burst 0.6s ease-out both; }
@keyframes ms-rise { 0% { opacity: 0; transform: translate(-50%,-30%) scale(0.6); } 25% { opacity: 1; transform: translate(-50%,-80%) scale(1.2); } 100% { opacity: 0; transform: translate(-50%,-220%) scale(1); } }
.ms-rise { animation: ms-rise 0.7s ease-out both; }
@keyframes ms-buzz { 0%,100% { transform: rotate(-8deg) translateY(0); } 25% { transform: rotate(6deg) translateY(-2px); } 50% { transform: rotate(-4deg) translateY(1px); } 75% { transform: rotate(9deg) translateY(-1px); } }
.ms-buzz { animation: ms-buzz 0.12s linear infinite; }
@keyframes ms-bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
.ms-bob { animation: ms-bob 1.4s ease-in-out infinite; }
@keyframes ms-wiggle { 0%,100% { transform: rotate(-4deg); } 50% { transform: rotate(4deg); } }
.ms-wiggle { animation: ms-wiggle 0.5s ease-in-out infinite; }
@keyframes ms-shake { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-10px); } 40% { transform: translateX(9px); } 60% { transform: translateX(-6px); } 80% { transform: translateX(4px); } }
.ms-shake { animation: ms-shake 0.4s ease-in-out both; }
@keyframes ms-pop { 0% { opacity: 0; transform: scale(0.3); } 60% { opacity: 1; transform: scale(1.12); } 100% { transform: scale(1); } }
.ms-pop { animation: ms-pop 0.32s cubic-bezier(0.2, 1.4, 0.4, 1) both; }
@keyframes ms-out { to { opacity: 0; transform: scale(1.8) rotate(25deg); } }
.ms-out { animation: ms-out 0.25s ease-in both; pointer-events: none; }
@keyframes ms-flicker { 0%,100% { transform: scaleY(1) scaleX(1) rotate(-2deg); } 33% { transform: scaleY(1.12) scaleX(0.92) rotate(3deg); } 66% { transform: scaleY(0.94) scaleX(1.05) rotate(-3deg); } }
.ms-flicker { animation: ms-flicker 0.28s ease-in-out infinite; transform-origin: 50% 100%; }
@keyframes ms-smoke { 0% { opacity: 0.9; transform: translate(-50%,-50%) scale(0.5); } 100% { opacity: 0; transform: translate(-50%,-160%) scale(1.6); } }
.ms-smoke { animation: ms-smoke 0.8s ease-out both; }
@keyframes ms-stamp { 0% { opacity: 0; transform: scale(2.4) rotate(-14deg); } 60% { opacity: 1; transform: scale(0.92) rotate(-6deg); } 100% { transform: scale(1) rotate(-6deg); } }
.ms-stamp { animation: ms-stamp 0.38s cubic-bezier(0.2, 1.3, 0.4, 1) both; }
@keyframes ms-flash { from { opacity: 0.8; } to { opacity: 0; } }
.ms-flash { animation: ms-flash 0.5s ease-out both; pointer-events: none; }
@keyframes ms-jiggle { 0%,100% { transform: translate(-50%,-50%) rotate(-3deg) scale(1); } 50% { transform: translate(-50%,-50%) rotate(3deg) scale(1.05); } }
.ms-jiggle { animation: ms-jiggle 0.35s ease-in-out infinite; }
@keyframes ms-popin { 0% { opacity: 0; transform: translate(-50%,-50%) scale(0.2) rotate(-12deg); } 70% { opacity: 1; transform: translate(-50%,-50%) scale(1.1) rotate(2deg); } 100% { transform: translate(-50%,-50%) scale(1) rotate(0); } }
.ms-popin { animation: ms-popin 0.3s cubic-bezier(0.2, 1.4, 0.4, 1) both; }
@keyframes ms-fly { 0% { opacity: 1; transform: translate(-50%,-50%) rotate(0); } 100% { opacity: 0; transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) rotate(540deg); } }
.ms-fly { animation: ms-fly 0.8s cubic-bezier(0.1, 0.7, 0.3, 1) both; }
@keyframes ms-away { from { opacity: 1; transform: none; } to { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(0.6); } }
.ms-away { animation: ms-away 0.28s ease-in both; pointer-events: none; }
@keyframes ms-zoom { to { transform: translateY(-140vh) scale(0.6); } }
.ms-zoom { animation: ms-zoom 0.6s cubic-bezier(0.5, 0, 0.9, 0.4) both; }
@keyframes ms-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.08); } }
.ms-pulse { animation: ms-pulse 0.6s ease-in-out infinite; }
@keyframes ms-blink { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
.ms-blink { animation: ms-blink 0.5s steps(2) infinite; }
`;
