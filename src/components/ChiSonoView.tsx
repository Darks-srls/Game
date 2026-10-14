import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { FastForward, Flag, PartyPopper } from 'lucide-react';
import type { ChiSonoView as ChiSonoData } from '../types/game';
import { useCountdown } from '../hooks/useCountdown';
import { soundManager } from '../utils/audio';
import { GameChip, Podium, TimerRing } from './fx';
import { Avatar, BottomBar, EndBar, type ModeProps } from './ui';

// 🎭 Chi sono? Tutti vedono il tuo personaggio tranne te: fai domande sì/no e scoprilo
export default function ChiSonoView({ state, clockOffset, canLead, onAction, onNewGame, onBackToLobby, onForce }: ModeProps) {
  const c = state.mg as ChiSonoData;
  const P = (id: string | null) => state.players.find((p) => p.id === id);
  const left = useCountdown(c.stage === 'PLAY' ? c.turnEndsAt : null, clockOffset);
  const asker = P(c.asker);
  const myTurn = c.asker === state.myId;
  const inGame = c.order.includes(state.myId);
  const solvedRank = c.solved.indexOf(state.myId);
  const gaveUp = c.gaveUp.includes(state.myId);
  const done = solvedRank >= 0 || gaveUp;
  const mine = c.characters[state.myId];
  // doppio tocco per "Ho indovinato" e "Mi arrendo": un tocco per sbaglio non rovina la partita
  const [arm, setArm] = useState<'SOLVED' | 'GIVEUP' | null>(null);
  const armTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const press = (what: 'SOLVED' | 'GIVEUP') => {
    if (arm === what) {
      onAction(what === 'SOLVED' ? 'MG_SOLVED' : 'MG_GIVEUP');
      setArm(null);
      return;
    }
    setArm(what);
    clearTimeout(armTimer.current);
    armTimer.current = setTimeout(() => setArm(null), 3000);
  };

  useEffect(() => {
    if (myTurn) soundManager.playPop();
  }, [myTurn, c.turnEndsAt]);

  const solvedCount = c.solved.length;
  useEffect(() => {
    if (solvedCount > 0) {
      soundManager.playSuccess();
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.3 } });
    }
  }, [solvedCount]);

  useEffect(() => {
    if (c.stage === 'END') {
      soundManager.playVictory();
      confetti({ particleCount: 160, spread: 90, origin: { y: 0.35 } });
    }
  }, [c.stage]);

  const others = c.order.filter((id) => id !== state.myId);

  if (c.stage === 'END') {
    const ranking = [...c.solved, ...c.order.filter((id) => !c.solved.includes(id))];
    return (
      <div className="stagger flex flex-col gap-4">
        <h2 className="text-center text-3xl text-white">Chi ha scoperto chi era? 🎭</h2>
        <Podium state={state} entries={c.solved.map((id, i) => ({ id, value: `${i + 1}° a scoprirlo` }))} />
        <section className="rounded-3xl border-2 border-white/10 bg-slate-900 p-3">
          <ul className="flex flex-col gap-1.5">
            {ranking.map((id) => {
              const p = P(id);
              const rank = c.solved.indexOf(id);
              return p ? (
                <li key={id} className="flex items-center gap-2 rounded-2xl bg-slate-800 p-2">
                  <span className="w-8 text-center text-lg">{rank >= 0 ? ['🥇', '🥈', '🥉'][rank] ?? `${rank + 1}°` : c.gaveUp.includes(id) ? '🏳️' : '❔'}</span>
                  <Avatar avatar={p.avatar} color={p.color} size={32} />
                  <span className="min-w-0 flex-1 truncate font-bold text-white">{p.name}</span>
                  <span className="max-w-[45%] truncate font-display text-amber-300">{c.characters[id]}</span>
                </li>
              ) : null;
            })}
          </ul>
        </section>
        <EndBar canLead={canLead} hostName={P(state.hostId)?.name} onNewGame={onNewGame} onBackToLobby={onBackToLobby} />
      </div>
    );
  }

  return (
    <div className="stagger flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <GameChip>
          🎭 {c.solved.length}/{c.order.length} hanno scoperto chi sono
        </GameChip>
        <TimerRing left={left} total={60} />
      </div>

      {/* La mia carta: coperta finché non la scopro */}
      {inGame && (
        <div className={`flip relative h-44 w-full ${done ? 'open' : ''}`}>
          <div className="flip-inner relative h-full w-full">
            <div className="flip-face grid place-items-center overflow-hidden rounded-3xl border-4 border-white/90 bg-linear-to-br from-slate-700 to-slate-950 p-4 text-center shadow-[0_8px_0_rgba(22,6,72,0.5)]">
              <div className="shine absolute inset-0" />
              <p className="float font-display text-7xl leading-none text-amber-300">?</p>
              <p className="relative font-display text-2xl text-white">Chi sei tu?</p>
              <p className="relative text-sm font-bold text-slate-300">Fai domande sì/no per scoprirlo</p>
            </div>
            <div className="flip-face flip-back grid place-items-center overflow-hidden rounded-3xl border-4 border-white/90 bg-linear-to-br from-amber-300 to-amber-500 p-4 text-center shadow-[0_8px_0_rgba(22,6,72,0.5)]">
              <p className="text-xs font-black uppercase tracking-widest text-slate-950/70">{gaveUp ? 'Eri…' : `Indovinato! ${solvedRank + 1}° posto`}</p>
              <p className="font-display text-4xl leading-tight text-slate-950 [overflow-wrap:anywhere]">{mine}</p>
            </div>
          </div>
        </div>
      )}

      {/* Turno */}
      <div className={`flex items-center gap-3 rounded-2xl p-3 ring-2 ${myTurn ? 'bg-amber-400/20 ring-amber-300' : 'bg-slate-900 ring-white/10'}`}>
        {asker && <Avatar avatar={asker.avatar} color={asker.color} size={44} />}
        <p className="min-w-0 flex-1 text-sm font-bold text-slate-300">
          {myTurn ? 'Tocca a te!' : 'Fa le domande'}
          <span className="block truncate font-display text-xl text-white">{myTurn ? 'Chiedi: «Sono una persona vera?»' : asker?.name}</span>
        </p>
      </div>

      {/* I personaggi degli altri */}
      <section className="grid grid-cols-2 gap-2">
        {others.map((id) => {
          const p = P(id);
          const rank = c.solved.indexOf(id);
          const out = c.gaveUp.includes(id);
          return p ? (
            <div
              key={id}
              className={`relative flex flex-col gap-1 rounded-2xl p-3 ring-2 ${
                c.asker === id ? 'bg-amber-400/15 ring-amber-300' : rank >= 0 ? 'bg-emerald-500/15 ring-emerald-400/60' : 'bg-slate-900 ring-white/10'
              }`}
            >
              <span className="flex items-center gap-1.5 text-sm font-bold text-slate-200">
                <Avatar avatar={p.avatar} color={p.color} size={26} />
                <span className="truncate">{p.name}</span>
              </span>
              <span className="font-display text-xl leading-tight text-white [overflow-wrap:anywhere]">{c.characters[id]}</span>
              {(rank >= 0 || out) && (
                <span className="absolute -right-1.5 -top-2 rounded-full bg-white px-2 py-0.5 text-xs font-black text-slate-950">
                  {rank >= 0 ? `✓ ${rank + 1}°` : '🏳️'}
                </span>
              )}
            </div>
          ) : null;
        })}
      </section>

      <BottomBar>
        {inGame && !done && (
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <button type="button" onClick={() => press('SOLVED')} className="flex h-16 items-center justify-center gap-2 rounded-2xl bg-emerald-500 text-xl font-black text-white">
              <PartyPopper size={22} /> {arm === 'SOLVED' ? 'Tocca ancora!' : 'Ho indovinato!'}
            </button>
            <button type="button" onClick={() => press('GIVEUP')} className="flex h-16 items-center gap-1 rounded-2xl bg-slate-700 px-4 text-sm font-black text-white">
              <Flag size={16} /> {arm === 'GIVEUP' ? 'Sicuro?' : 'Mi arrendo'}
            </button>
          </div>
        )}
        <div className="flex items-center justify-between gap-3 px-1 text-xs font-bold text-slate-200">
          <span className="truncate">{myTurn ? 'Quando ricevi un «no», passa il turno.' : `Rispondete a ${asker?.name ?? '…'}: sì o no?`}</span>
          {(myTurn || canLead) && (
            <span className="flex shrink-0 gap-2">
              {(myTurn || canLead) && (
                <button type="button" onClick={() => onAction('MG_PASS')} className="flex items-center gap-1 rounded-full bg-slate-900/95 px-3 py-1.5 text-amber-200">
                  <FastForward size={14} /> Passa turno
                </button>
              )}
              {canLead && !myTurn && (
                <button type="button" onClick={onForce} className="rounded-full bg-slate-900/95 px-3 py-1.5 text-red-300">
                  Fine
                </button>
              )}
            </span>
          )}
        </div>
      </BottomBar>
    </div>
  );
}
