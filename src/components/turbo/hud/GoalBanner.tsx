// ⚽🚗 Axend Turbo — la fascia del gol: "GOL! di Nome" col colore della squadra, l'assist e la velocità del tiro.
// Il coordinatore la mostra dall'evento 'goal' finché il mondo è in fase 'goal' (poi passa null).
import { TEAM_COLORS, type GoalEvent, type Team } from './format';

export interface GoalBannerProps {
  goal: GoalEvent | null;
  names: Record<string, string>;
  myTeam?: Team; // per scrivere "SEGNATO!" o "SUBITO…" sotto
}

const LIGHT = ['#7cc0ff', '#ffc27a'] as const;

export function GoalBanner({ goal, names, myTeam }: GoalBannerProps) {
  if (!goal) return null;
  const team = goal.team;
  const scorer = goal.by ? names[goal.by] || 'Qualcuno' : '';
  const assist = goal.assist ? names[goal.assist] || '' : '';
  const ours = myTeam === undefined ? null : myTeam === team;
  return (
    <div key={`${goal.team}-${goal.by}-${goal.speed}`} className="pointer-events-none absolute inset-x-0 top-[17%] z-30 flex flex-col items-center overflow-hidden pb-3 pt-1">
      <div
        className="swoosh relative w-[104%] border-y-[5px] border-[#1d0f3d] py-2 text-center shadow-[0_8px_0_#1d0f3d]"
        style={{ background: `linear-gradient(90deg, ${TEAM_COLORS[team]} 0%, ${LIGHT[team]} 50%, ${TEAM_COLORS[team]} 100%)` }}
      >
        <div className="swoosh-in flex flex-col items-center px-4">
          <span className="sc-stroke font-display leading-none text-white" style={{ fontSize: 'clamp(56px, 15vw, 112px)' }}>
            GOL!
          </span>
          <span className="sc-stroke-sm mt-1 max-w-[86vw] truncate font-display leading-tight text-white" style={{ fontSize: 'clamp(22px, 6vw, 38px)' }}>{scorer ? `di ${scorer}` : team === 0 ? 'dei BLU' : 'degli ARANCIONI'}</span>
        </div>
      </div>
      <div className="pop mt-4 flex flex-wrap items-center justify-center gap-2 px-4" style={{ animationDelay: '0.35s' }}>
        <span className="sc-chip px-4 py-1 font-display text-xl text-white tabular-nums">{goal.speed} km/h</span>
        {assist && <span className="sc-chip px-4 py-1 font-display text-lg text-white">assist di {assist}</span>}
        {ours !== null && <span className={`sc-btn ${ours ? 'sc-green' : 'sc-red'} px-4 py-1 font-display text-lg`}>{ours ? 'SEGNATO!' : 'SUBITO…'}</span>}
      </div>
    </div>
  );
}
