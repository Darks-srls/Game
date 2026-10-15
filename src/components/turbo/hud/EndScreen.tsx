// ⚽🚗 Axend Turbo — fine partita: chi ha vinto, l'MVP (più punti della squadra vincente), il tabellone e i pulsanti.
import { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { UiIcon } from '../../party3d/icons';
import { ScoreTable } from './Scoreboard';
import { TEAM_COLORS, mvpOf, winnerOf, type PlayerLine, type Team } from './format';

export interface EndScreenProps {
  score: readonly [number, number];
  players: PlayerLine[]; // playerLines(world, names)
  myId?: string;
  myTeam?: Team;
  winner?: Team | -1; // se non c'è si calcola dal punteggio
  canLead?: boolean; // può far ripartire (di base: sì se c'è onNewGame)
  hostName?: string; // chi può far ripartire, per il messaggio d'attesa
  onNewGame?: () => void;
  onChangeGame?: () => void;
}

export function EndScreen({ score, players, myId, myTeam, winner, canLead, hostName, onNewGame, onChangeGame }: EndScreenProps) {
  const w = winner ?? winnerOf(score);
  const mvp = mvpOf(players, w);
  const iWon = myTeam !== undefined && w === myTeam;
  const lead = canLead ?? !!onNewGame;

  useEffect(() => {
    if (!iWon) return;
    const colors = [TEAM_COLORS[myTeam!], '#ffe259', '#ffffff'];
    void confetti({ particleCount: 120, spread: 80, origin: { y: 0.35 }, colors, disableForReducedMotion: true });
  }, [iWon, myTeam]);

  const title = w === -1 ? 'PAREGGIO' : w === 0 ? 'VINCONO I BLU!' : 'VINCONO GLI ARANCIONI!';
  const sub = myTeam === undefined || w === -1 ? null : iWon ? 'HAI VINTO!' : 'HAI PERSO…';

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#0b0623]/70 p-3 backdrop-blur-sm pt-[max(12px,env(safe-area-inset-top))] pb-[max(12px,env(safe-area-inset-bottom))]">
      <div className="sc-panel pop flex max-h-full w-full max-w-2xl flex-col gap-3 overflow-hidden p-4">
        <div className="flex flex-col items-center gap-1 text-center">
          {sub && <p className={`sc-btn ${iWon ? 'sc-green' : 'sc-red'} px-4 py-1 font-display text-lg`}>{sub}</p>}
          <h2 className="sc-stroke font-display leading-none" style={{ fontSize: 'clamp(34px, 9vw, 56px)', color: w === -1 ? '#ffffff' : w === 0 ? '#8cc4ff' : '#ffb366' }}>
            {title}
          </h2>
          <div className="mt-1 flex items-center gap-3 font-display text-[44px] leading-none tabular-nums">
            <span className="sc-stroke" style={{ color: '#8cc4ff' }}>
              {score[0]}
            </span>
            <span className="sc-stroke-sm text-2xl text-white/80">–</span>
            <span className="sc-stroke" style={{ color: '#ffb366' }}>
              {score[1]}
            </span>
          </div>
        </div>

        {mvp && (
          <div className="pop flex items-center gap-3 self-center rounded-2xl border-[3px] border-[#1d0f3d] bg-gradient-to-b from-[#ffe259] to-[#ffb703] px-4 py-2 shadow-[0_5px_0_#1d0f3d]" style={{ animationDelay: '0.25s' }}>
            <UiIcon name="trophy" size={36} />
            <div className="flex min-w-0 flex-col">
              <span className="font-display text-sm leading-none text-[#1d0f3d]/80">MVP</span>
              <span className="truncate font-display text-2xl leading-tight text-[#1d0f3d]">
                {mvp.name}
                {mvp.id === myId ? ' (tu)' : ''}
              </span>
            </div>
            <span className="ml-1 shrink-0 rounded-xl border-[3px] border-[#1d0f3d] bg-white px-2 py-0.5 font-display text-xl text-[#1d0f3d] tabular-nums">{mvp.points} pt</span>
          </div>
        )}

        <ScoreTable players={players} score={score} myId={myId} mvpId={mvp?.id} />

        {lead ? (
          <div className="grid grid-cols-[1fr_auto] gap-2.5">
            <button type="button" onClick={onNewGame} disabled={!onNewGame} className="sc-btn sc-green py-3 font-display text-xl disabled:opacity-50">
              Nuova partita
            </button>
            <button type="button" onClick={onChangeGame} disabled={!onChangeGame} className="sc-btn sc-dark flex items-center justify-center gap-1.5 px-4 py-3 font-display text-lg disabled:opacity-50">
              <UiIcon name="exit" size={22} /> Cambia gioco
            </button>
          </div>
        ) : (
          <p className="sc-chip px-4 py-3 text-center font-black text-white/90">In attesa che {hostName ?? 'il capo'} faccia ripartire…</p>
        )}
      </div>
    </div>
  );
}
