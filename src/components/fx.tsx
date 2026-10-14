import type { ReactNode } from 'react';
import type { ClientGameState } from '../types/game';
import { Avatar } from './ui';

// Conto alla rovescia circolare: verde, poi giallo, poi rosso che pulsa negli ultimi 10 secondi
export function TimerRing({ left, total, size = 56 }: { left: number | null; total: number; size?: number }) {
  const r = size / 2 - 5;
  const c = 2 * Math.PI * r;
  const frac = left === null ? 1 : Math.max(0, Math.min(1, left / Math.max(1, total)));
  const color = left === null || frac > 0.5 ? '#7ddc45' : frac > 0.25 ? '#ffd02e' : '#ff3b6e';
  const long = left !== null && left >= 100;
  const label = left === null ? '∞' : long ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : String(left);
  return (
    <span
      className={`relative grid shrink-0 place-items-center ${left !== null && left > 0 && left <= 10 ? 'urgent' : ''}`}
      style={{ width: size, height: size }}
      aria-label={left === null ? 'Senza limite di tempo' : `${left} secondi`}
    >
      <svg width={size} height={size} className="absolute inset-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="rgba(28,10,80,0.8)" stroke="rgba(255,255,255,0.12)" strokeWidth={5} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.4s ease' }}
        />
      </svg>
      <span className={`relative font-display leading-none text-white ${long ? 'text-sm' : 'text-lg'}`}>{label}</span>
    </span>
  );
}

// Pastiglia in alto a sinistra nelle schermate di gioco (es. "😂 Round 1/2")
export function GameChip({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-slate-900 px-3 py-1 text-sm font-black text-slate-100 shadow-[0_4px_0_rgba(22,6,72,0.4)]">{children}</span>;
}

// Punti guadagnati che volano verso l'alto
export function PointsPop({ points, className = '' }: { points: number; className?: string }) {
  if (!points) return null;
  return <span className={`points-pop pointer-events-none font-display text-2xl text-amber-300 ${className}`}>+{points}</span>;
}

// Podio animato: i gradini salgono, i giocatori ci cadono sopra, il primo ha la corona
export function Podium({ state, entries }: { state: ClientGameState; entries: { id: string; value: string }[] }) {
  const top = entries.slice(0, 3);
  const slots = [
    { e: top[1], h: 70, size: 58, medal: '🥈', step: 'from-slate-200 to-slate-400', delay: 0.15 },
    { e: top[0], h: 100, size: 76, medal: '🥇', step: 'from-amber-300 to-amber-600', delay: 0.3 },
    { e: top[2], h: 50, size: 52, medal: '🥉', step: 'from-orange-300 to-orange-600', delay: 0 },
  ];
  return (
    <div className="flex items-end justify-center gap-2 px-2 pt-10">
      {slots.map(({ e, h, size, medal, step, delay }, i) => {
        const p = e && state.players.find((x) => x.id === e.id);
        if (!e || !p) return <div key={i} className="w-[30%]" />;
        return (
          <div key={e.id} className="flex w-[30%] flex-col items-center">
            <div className="podium-avatar relative" style={{ animationDelay: `${delay + 0.45}s` }}>
              {i === 1 && <span className="float absolute -top-8 left-1/2 -ml-[15px] text-[30px] leading-none">👑</span>}
              <span className="block rounded-full p-1 shadow-[0_0_0_3px_#fff]" style={{ background: p.color }}>
                <Avatar avatar={p.avatar} color={p.color} size={size} />
              </span>
            </div>
            <p className="mt-1.5 max-w-full truncate font-display text-base leading-tight text-white">
              {p.name}
              {p.id === state.myId ? ' (tu)' : ''}
            </p>
            <p className="text-xs font-black text-amber-200">{e.value}</p>
            <div
              className={`podium-step mt-1 grid w-full place-items-start justify-center rounded-t-2xl bg-linear-to-b pt-2 shadow-[inset_0_3px_0_rgba(255,255,255,0.45)] ${step}`}
              style={{ height: h, animationDelay: `${delay}s` }}
            >
              <span className="text-3xl drop-shadow">{medal}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Dado disegnato: i puntini su una griglia 3×3 (l'1 è rosso: nei Dadi bugiardi è il jolly)
const PIPS: Record<number, number[]> = { 1: [4], 2: [2, 6], 3: [2, 4, 6], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
export function Die({ value, size = 44, highlight = false, dim = false, className = '' }: { value: number; size?: number; highlight?: boolean; dim?: boolean; className?: string }) {
  return (
    <span
      className={`grid shrink-0 grid-cols-3 grid-rows-3 rounded-[24%] bg-white shadow-[inset_0_-4px_0_rgba(0,0,0,0.14),0_3px_0_rgba(22,6,72,0.45)] transition-opacity ${
        highlight ? 'ring-4 ring-amber-300' : ''
      } ${dim ? 'opacity-35' : ''} ${className}`}
      style={{ width: size, height: size, padding: size * 0.13 }}
      aria-label={`dado ${value}`}
    >
      {Array.from({ length: 9 }, (_, i) => (
        <span
          key={i}
          className={`m-auto rounded-full ${PIPS[value]?.includes(i) ? (value === 1 ? 'bg-red-500' : 'bg-slate-950') : ''}`}
          style={{ width: size * 0.18, height: size * 0.18 }}
        />
      ))}
    </span>
  );
}
