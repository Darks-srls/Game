// ⚽🚗 Axend Turbo — barra in alto: punteggio blu–arancio, orologio (o SUPPLEMENTARI +0:42), menu e tabellone.
import { UiIcon } from '../../party3d/icons';
import { TEAM_COLORS, formatClock, type Team } from './format';

export interface TopBarProps {
  score: readonly [number, number];
  clock: number; // secondi rimasti (supplementari: secondi passati)
  overtime: boolean;
  myTeam?: Team; // la mia squadra ha il bordo che brilla
  onMenu?: () => void; // ingranaggio in alto a sinistra (sul telefono è l'unico modo per aprire il menu)
  onScoreboard?: () => void; // pulsante tabellone in alto a destra (sul telefono: tocca per aprire/chiudere)
  scoreboardOpen?: boolean;
}

export function TopBar({ score, clock, overtime, myTeam, onMenu, onScoreboard, scoreboardOpen }: TopBarProps) {
  const urgent = !overtime && clock <= 10 && clock > 0;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2 px-[max(12px,env(safe-area-inset-left))] pt-[max(10px,env(safe-area-inset-top))]">
      <div className="w-12 shrink-0">
        {onMenu && (
          <button type="button" aria-label="Menu" onClick={onMenu} className="sc-btn sc-dark pointer-events-auto grid h-12 w-12 place-items-center">
            <UiIcon name="gear" size={28} />
          </button>
        )}
      </div>

      <div className="flex flex-col items-center">
        <div className="flex items-stretch">
          <ScoreBox value={score[0]} team={0} mine={myTeam === 0} />
          <div className="sc-btn sc-dark z-10 -mx-1 flex min-w-[96px] flex-col items-center justify-center !rounded-xl px-3 py-1">
            <span className={`sc-stroke-sm font-display text-[28px] leading-none tabular-nums ${overtime ? 'text-amber-300' : urgent ? 'text-red-300' : 'text-white'}`}>{formatClock(clock, overtime)}</span>
          </div>
          <ScoreBox value={score[1]} team={1} mine={myTeam === 1} />
        </div>
        {overtime && <p className="sc-chip pop mt-1.5 px-3 py-0.5 font-display text-sm tracking-wider text-amber-300">SUPPLEMENTARI</p>}
      </div>

      <div className="flex w-12 shrink-0 justify-end">
        {onScoreboard && (
          <button
            type="button"
            aria-label="Tabellone"
            onClick={onScoreboard}
            className={`sc-btn ${scoreboardOpen ? 'sc-yellow' : 'sc-dark'} pointer-events-auto grid h-12 w-12 place-items-center`}
          >
            <UiIcon name="trophy" size={26} />
          </button>
        )}
      </div>
    </div>
  );
}

function ScoreBox({ value, team, mine }: { value: number; team: Team; mine: boolean }) {
  return (
    <div
      className={`sc-btn grid min-w-[64px] place-items-center px-3 ${team === 0 ? '!rounded-r-none' : '!rounded-l-none'}`}
      style={{
        background: `linear-gradient(${team === 0 ? '#6fb0ff, ' : '#ffb35c, '}${TEAM_COLORS[team]})`,
        outline: mine ? '3px solid #ffe259' : undefined,
        outlineOffset: mine ? 2 : undefined,
      }}
    >
      {/* key: il numero "salta" quando cambia */}
      <span key={value} className="sc-stroke pop font-display text-[38px] leading-none text-white tabular-nums">
        {value}
      </span>
    </div>
  );
}
