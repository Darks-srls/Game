// ⚽🚗 Axend Turbo — il contatore del boost come in Rocket League: cerchio che si riempie e numero 0–100, in basso a destra.
// Sul telefono si sposta sopra (in verticale) o a sinistra (in orizzontale) dei pulsanti, così non finisce mai sotto il pollice.
import { useId } from 'react';
import { touchBoostAnchor, useLandscape, useTouchScale } from '../input/touch';

export interface BoostMeterProps {
  boost: number; // 0–100
  touch?: boolean; // ci sono i comandi del telefono a destra
  supersonic?: boolean; // scia supersonica: il cerchio brilla
}

export function BoostMeter({ boost, touch = false, supersonic = false }: BoostMeterProps) {
  const landscape = useLandscape();
  const scale = useTouchScale();
  const gid = useId().replace(/:/g, '');
  const v = Math.max(0, Math.min(100, Math.round(boost)));
  const size = touch ? Math.round(100 * scale) : 136;
  const pos = touch ? touchBoostAnchor(landscape, scale) : { right: 'max(28px, env(safe-area-inset-right))', bottom: 'max(28px, env(safe-area-inset-bottom))' };
  const r = 41;
  const C = 2 * Math.PI * r;
  const arc = C * 0.75; // tre quarti di cerchio, aperto in basso
  const full = v >= 100;
  return (
    <div className="pointer-events-none absolute z-20 select-none" style={{ ...pos, width: size, height: size }} aria-label={`Boost ${v}`}>
      <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" className={full || supersonic ? 'drop-shadow-[0_0_10px_rgba(255,200,40,0.85)]' : ''}>
        <defs>
          <linearGradient id={`b${gid}`} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#ff5a1f" />
            <stop offset="60%" stopColor="#ff9f1c" />
            <stop offset="100%" stopColor="#ffe259" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill="#1d0f3d" opacity="0.72" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="#3b2d72" strokeWidth="11" strokeDasharray={`${arc} ${C}`} strokeLinecap="round" transform="rotate(135 50 50)" />
        {v > 0 && (
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke={`url(#b${gid})`}
            strokeWidth="11"
            strokeDasharray={`${(arc * v) / 100} ${C}`}
            strokeLinecap="round"
            transform="rotate(135 50 50)"
            style={{ transition: 'stroke-dasharray 0.12s linear' }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`sc-stroke font-display leading-none tabular-nums ${v === 0 ? 'text-red-300' : full ? 'text-amber-200' : 'text-white'}`} style={{ fontSize: size * 0.34 }}>
          {v}
        </span>
      </div>
      <span className="sc-stroke-sm absolute inset-x-0 text-center font-display leading-none text-amber-300" style={{ bottom: size * 0.04, fontSize: Math.max(12, size * 0.13) }}>
        BOOST
      </span>
    </div>
  );
}
