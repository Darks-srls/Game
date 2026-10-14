import { useEffect } from 'react';
import type { GameId } from '../types/game';
import { Art, GAMES } from './ui';

// Schermata lampo all'inizio di ogni partita: uguale per tutti, poi sparisce da sola.
// Non blocca i tocchi: sotto la partita è già partita.
export default function StartSplash({ game, round, onDone }: { game: GameId; round: number; onDone: () => void }) {
  const g = GAMES.find((x) => x.id === game) ?? GAMES[0];

  useEffect(() => {
    const timer = setTimeout(onDone, 1750);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="splash pointer-events-none fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 overflow-hidden px-6" aria-hidden="true">
      <div className="splash-rays" />
      <div className="splash-card relative w-full max-w-[300px] overflow-hidden rounded-3xl border-4 border-white shadow-[0_10px_0_rgba(22,6,72,0.55),0_30px_60px_rgba(0,0,0,0.45)]">
        <Art
          src={g.banner}
          fallback={<span className="grid aspect-[16/10] w-full place-items-center bg-linear-to-br from-cyan-400 to-slate-700 text-7xl">{g.emoji}</span>}
          className="aspect-[16/10] w-full object-cover"
        />
      </div>
      <p className="splash-title relative text-center font-display text-5xl leading-none text-amber-300 [text-shadow:0_5px_0_#d97a00,0_11px_0_rgba(22,6,72,0.5)]">
        {g.name}
      </p>
      <p className="splash-sub relative rounded-full bg-white px-5 py-1.5 font-display text-xl text-slate-950 shadow-[0_5px_0_rgba(22,6,72,0.45)]">
        Round {round} · Si gioca!
      </p>
    </div>
  );
}
