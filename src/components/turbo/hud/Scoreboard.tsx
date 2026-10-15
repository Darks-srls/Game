// ⚽🚗 Axend Turbo — il tabellone (tenendo Tab / BACK, o toccando la coppa sul telefono):
// le due squadre con nomi, punti, gol, assist, parate, tiri e demolizioni; i bot hanno il bollino BOT.
import { TEAM_COLORS, TEAM_NAMES, formatClock, type PlayerLine, type Team } from './format';

export interface ScoreboardProps {
  players: PlayerLine[]; // playerLines(world, names)
  score: readonly [number, number];
  myId?: string;
  clock?: number;
  overtime?: boolean;
}

export function Scoreboard({ players, score, myId, clock, overtime = false }: ScoreboardProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-[#0b0623]/45 p-3 pt-[max(70px,env(safe-area-inset-top))]">
      <div className="sc-panel pop flex max-h-full w-full max-w-2xl flex-col gap-3 overflow-hidden p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2 px-1">
          <h3 className="sc-stroke font-display text-[26px] leading-none text-white">Tabellone</h3>
          {clock !== undefined && <span className={`sc-chip px-3 py-1 font-display text-lg tabular-nums ${overtime ? 'text-amber-300' : 'text-white'}`}>{overtime ? `SUPPLEMENTARI ${formatClock(clock, true)}` : formatClock(clock)}</span>}
        </div>
        <ScoreTable players={players} score={score} myId={myId} />
      </div>
    </div>
  );
}

const COLS: { key: keyof PlayerLine; label: string; short: string; wide?: boolean }[] = [
  { key: 'points', label: 'PUNTI', short: 'PUNTI' },
  { key: 'goals', label: 'GOL', short: 'GOL' },
  { key: 'assists', label: 'ASSIST', short: 'ASS.' },
  { key: 'saves', label: 'PARATE', short: 'PAR.' },
  { key: 'shots', label: 'TIRI', short: 'TIRI' },
  { key: 'demos', label: 'DEMO', short: 'DEM.', wide: true },
];

// le due squadre una sopra l'altra (usata anche dalla schermata di fine partita)
export function ScoreTable({ players, score, myId, mvpId }: { players: PlayerLine[]; score: readonly [number, number]; myId?: string; mvpId?: string }) {
  return (
    <div className="flex min-h-0 flex-col gap-2.5 overflow-y-auto">
      {([0, 1] as Team[]).map((team) => (
        <TeamBlock key={team} team={team} goals={score[team]} rows={players.filter((p) => p.team === team).sort((a, b) => b.points - a.points)} myId={myId} mvpId={mvpId} />
      ))}
    </div>
  );
}

const grid = 'grid grid-cols-[minmax(0,1fr)_repeat(5,40px)] items-center gap-x-1 sm:grid-cols-[minmax(0,1fr)_repeat(6,58px)]';

function TeamBlock({ team, goals, rows, myId, mvpId }: { team: Team; goals: number; rows: PlayerLine[]; myId?: string; mvpId?: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border-[3px] border-[#1d0f3d] bg-[#1d0f3d]/55">
      <div className={`${grid} px-2.5 py-1.5`} style={{ background: `linear-gradient(90deg, ${TEAM_COLORS[team]}, ${TEAM_COLORS[team]}aa)` }}>
        <span className="sc-stroke-sm flex items-center gap-2 font-display text-xl leading-none text-white">
          {TEAM_NAMES[team]}
          <span className="rounded-lg border-2 border-[#1d0f3d] bg-white px-2 text-[#1d0f3d] [-webkit-text-stroke:0] [text-shadow:none] tabular-nums">{goals}</span>
        </span>
        {COLS.map((c) => (
          <span key={c.key} className={`text-center font-display text-[11px] leading-none text-white/90 sm:text-[13px] ${c.wide ? 'hidden sm:block' : ''}`}>
            <span className="sm:hidden">{c.short}</span>
            <span className="hidden sm:inline">{c.label}</span>
          </span>
        ))}
      </div>
      {rows.length === 0 && <p className="px-3 py-2 text-sm font-bold text-white/60">Nessuno in squadra</p>}
      {rows.map((p) => (
        <div key={p.id} className={`${grid} border-t-2 border-[#1d0f3d]/60 px-2.5 py-1.5 ${p.id === myId ? 'bg-amber-400/20' : ''}`}>
          <span className="flex min-w-0 items-center gap-1.5">
            {p.id === mvpId && <span className="shrink-0 rounded-md border-2 border-[#1d0f3d] bg-[#ffd60a] px-1 font-display text-[11px] leading-[16px] text-[#1d0f3d]">MVP</span>}
            <span className="truncate text-[17px] font-black leading-tight text-white">{p.name}</span>
            {p.id === myId && <span className="shrink-0 text-xs font-black text-amber-300">(tu)</span>}
            {p.bot && <span className="shrink-0 rounded-md border-2 border-[#1d0f3d] bg-white/85 px-1 font-display text-[11px] leading-[16px] text-[#1d0f3d]">BOT</span>}
          </span>
          {COLS.map((c) => (
            <span key={c.key} className={`text-center font-display tabular-nums leading-none ${c.key === 'points' ? 'text-[19px] text-amber-300' : 'text-[17px] text-white'} ${c.wide ? 'hidden sm:block' : ''}`}>
              {p[c.key] as number}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
