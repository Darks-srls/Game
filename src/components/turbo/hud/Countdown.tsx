// ⚽🚗 Axend Turbo — conto alla rovescia del calcio d'inizio: 3, 2, 1, VIA!
import { useEffect, useRef, useState } from 'react';
import type { Phase } from '../../../game/turbo/world';

export interface CountdownProps {
  phase: Phase;
  secondsLeft: number; // secondi alla fine del conto (phaseSecondsLeft(world))
  overtime?: boolean; // scrive SUPPLEMENTARI sopra i numeri
}

export function Countdown({ phase, secondsLeft, overtime = false }: CountdownProps) {
  const prev = useRef<Phase>(phase);
  const [go, setGo] = useState(false);
  // "VIA!" per un attimo quando il conto finisce e si gioca
  useEffect(() => {
    if (prev.current === 'countdown' && phase === 'play') {
      setGo(true);
      const t = setTimeout(() => setGo(false), 900);
      prev.current = phase;
      return () => clearTimeout(t);
    }
    if (phase === 'countdown') setGo(false);
    prev.current = phase;
  }, [phase]);

  const n = Math.ceil(secondsLeft);
  if (phase !== 'countdown' && !go) return null;
  const label = phase === 'countdown' ? (n > 0 ? String(Math.min(n, 3)) : 'VIA!') : 'VIA!';
  const isGo = label === 'VIA!';
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center pb-[12vh]">
      {overtime && phase === 'countdown' && <p className="sc-chip pop mb-2 px-4 py-1 font-display text-xl tracking-wider text-amber-300">SUPPLEMENTARI · VINCE CHI SEGNA</p>}
      <span
        key={label}
        className={`count-pop sc-stroke font-display leading-none ${isGo ? 'text-lime-300' : 'text-yellow-300'}`}
        style={{ fontSize: isGo ? 'min(26vw, 150px)' : 'min(34vw, 190px)' }}
      >
        {label}
      </span>
    </div>
  );
}
