import { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { FastForward } from 'lucide-react';
import type { PreferirestiView as PrefData } from '../types/game';
import { useCountdown } from '../hooks/useCountdown';
import { soundManager } from '../utils/audio';
import { GameChip, Podium, TimerRing } from './fx';
import { Avatar, BottomBar, EndBar, Ranking, type ModeProps } from './ui';

const SIDES = [
  { label: 'A', bg: 'from-red-400 to-orange-500', bar: 'bg-red-300/50' },
  { label: 'B', bg: 'from-cyan-400 to-slate-700', bar: 'bg-cyan-200/40' },
];

// 🤔 Preferiresti? Tutti scelgono in segreto, poi si vede come si è diviso il gruppo
export default function PreferirestiView({ state, clockOffset, canLead, onAction, onNewGame, onBackToLobby, onForce }: ModeProps) {
  const q = state.mg as PrefData;
  const P = (id: string) => state.players.find((p) => p.id === id);
  const left = useCountdown(q.stage === 'END' ? null : q.stageEndsAt, clockOffset);
  const reveal = q.stage === 'REVEAL';
  const votes = q.votes ?? {};
  const count = [0, 1].map((side) => Object.values(votes).filter((v) => v === side).length);
  const totalVotes = count[0] + count[1];
  const majority = count[0] === count[1] ? null : count[0] > count[1] ? 0 : 1;
  const online = q.order.filter((id) => P(id)?.isOnline).length;

  useEffect(() => {
    if (q.stage === 'REVEAL') soundManager.playReveal();
    if (q.stage === 'END') {
      soundManager.playVictory();
      confetti({ particleCount: 150, spread: 90, origin: { y: 0.35 } });
    }
  }, [q.stage, q.qNo]);

  if (q.stage === 'END') {
    const ranking = Object.entries(q.scores).sort((x, y) => y[1] - x[1]);
    return (
      <div className="stagger flex flex-col gap-4">
        <h2 className="text-center text-3xl text-white">Chi pensa come il gruppo? 🧠</h2>
        <Podium state={state} entries={ranking.map(([id, points]) => ({ id, value: `${points} ${points === 1 ? 'punto' : 'punti'}` }))} />
        <section className="rounded-3xl border-2 border-white/10 bg-slate-900 p-4">
          <Ranking state={state} scores={q.scores} />
        </section>
        <EndBar canLead={canLead} hostName={P(state.hostId)?.name} onNewGame={onNewGame} onBackToLobby={onBackToLobby} />
      </div>
    );
  }

  return (
    <div className="stagger flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <GameChip>
          🤔 Domanda {q.qNo}/{q.qCount}
        </GameChip>
        <TimerRing left={left} total={reveal ? 8 : 20} />
      </div>

      <h2 key={q.qNo} className="pop text-center text-4xl text-white">Preferiresti…</h2>

      <div className="relative flex flex-col gap-3">
        {[0, 1].map((side) => {
          const pct = totalVotes ? Math.round((count[side] / totalVotes) * 100) : 0;
          const mine = q.myVote === side;
          const text = side === 0 ? q.a : q.b;
          return (
            <button
              key={`${q.qNo}-${side}`}
              type="button"
              disabled={reveal || !q.order.includes(state.myId)}
              onClick={() => onAction('MG_PICK', { choice: side })}
              className={`pop relative min-h-[120px] overflow-hidden rounded-3xl border-4 bg-linear-to-br p-4 text-left disabled:opacity-100 ${SIDES[side].bg} ${
                mine ? 'border-white' : 'border-white/25'
              } ${reveal && majority !== null && majority !== side ? 'opacity-75' : ''}`}
              style={{ animationDelay: `${0.1 + side * 0.12}s` }}
            >
              {reveal && <span className={`fill-bar absolute inset-y-0 left-0 ${SIDES[side].bar}`} style={{ width: `${pct}%` }} />}
              <span className="relative flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/90 font-display text-xl text-slate-950">{SIDES[side].label}</span>
                <span className="text-2xl font-black leading-tight text-white [text-shadow:0_2px_0_rgba(0,0,0,0.2)]">{text}</span>
              </span>
              {mine && !reveal && <span className="relative mt-2 inline-block rounded-full bg-white px-3 py-0.5 text-xs font-black text-slate-950">✓ La tua scelta</span>}
              {reveal && (
                <span className="relative mt-3 flex items-center gap-3">
                  <span className="reveal-pop font-display text-4xl text-white">{pct}%</span>
                  <span className="flex flex-wrap gap-1">
                    {Object.entries(votes)
                      .filter(([, v]) => v === side)
                      .map(([id], i) => {
                        const p = P(id);
                        return p ? (
                          <span key={id} className="reveal-pop" style={{ animationDelay: `${0.2 + i * 0.08}s` }}>
                            <Avatar avatar={p.avatar} color={p.color} size={30} />
                          </span>
                        ) : null;
                      })}
                  </span>
                </span>
              )}
            </button>
          );
        })}
        <span className="vs-badge pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white bg-slate-950 px-3 py-1.5 font-display text-sm text-amber-300">
          OPPURE
        </span>
      </div>

      {reveal && (
        <p className="reveal-pop text-center font-display text-2xl text-amber-300">
          {majority === null ? 'Gruppo spaccato a metà! 🤝' : `Vince la ${SIDES[majority].label}! +1 a chi l'ha scelta`}
        </p>
      )}

      <BottomBar>
        <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-slate-700 bg-slate-900/95 px-4 py-3 text-sm font-bold text-slate-200">
          <span className="min-w-0 truncate">{reveal ? 'Discutetene! Prossima domanda tra poco…' : `Hanno scelto: ${q.voted.length}/${online}`}</span>
          {canLead && (
            <button type="button" onClick={onForce} className="flex shrink-0 items-center gap-1 rounded-full bg-slate-800 px-3 py-1.5 text-amber-200">
              <FastForward size={14} /> Avanti
            </button>
          )}
        </div>
      </BottomBar>
    </div>
  );
}
