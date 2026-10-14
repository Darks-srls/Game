import { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { Check, FastForward } from 'lucide-react';
import type { NonRidereView as NonRidereData } from '../types/game';
import { useCountdown } from '../hooks/useCountdown';
import { soundManager } from '../utils/audio';
import { GameChip, Podium, PointsPop, TimerRing } from './fx';
import { Avatar, BottomBar, EndBar, Ranking, type ModeProps } from './ui';

// 🙊 Non ridere! Il comico fa una missione assurda, gli altri devono restare seri
export default function NonRidereView({ state, clockOffset, canLead, onAction, onNewGame, onBackToLobby, onForce }: ModeProps) {
  const n = state.mg as NonRidereData;
  const P = (id: string | null) => state.players.find((p) => p.id === id);
  const left = useCountdown(n.stage === 'END' ? null : n.stageEndsAt, clockOffset);
  const total = n.stage === 'ACT' ? 40 : n.stage === 'MARK' ? 20 : 6;
  const comico = P(n.comico);
  const iComic = n.comico === state.myId;
  const audience = n.order.filter((id) => id !== n.comico && P(id)?.isOnline);
  const [marked, setMarked] = useState<string[]>([]);

  useEffect(() => setMarked([]), [n.turnNo]);
  useEffect(() => {
    if (n.stage === 'ACT') soundManager.playReveal();
    if (n.stage === 'REVEAL') {
      if (n.laughed.length) soundManager.playVictory();
      else soundManager.playPop();
    }
    if (n.stage === 'END') {
      soundManager.playVictory();
      confetti({ particleCount: 160, spread: 90, origin: { y: 0.35 } });
    }
  }, [n.stage, n.turnNo]);

  if (n.stage === 'END') {
    const ranking = Object.entries(n.scores).sort((x, y) => y[1] - x[1]);
    return (
      <div className="stagger flex flex-col gap-4">
        <h2 className="text-center text-3xl text-white">Comici e facce di pietra 🙊</h2>
        <Podium state={state} entries={ranking.map(([id, points]) => ({ id, value: `${points} punti` }))} />
        <section className="rounded-3xl border-2 border-white/10 bg-slate-900 p-4">
          <Ranking state={state} scores={n.scores} />
        </section>
        <EndBar canLead={canLead} hostName={P(state.hostId)?.name} onNewGame={onNewGame} onBackToLobby={onBackToLobby} />
      </div>
    );
  }

  const toggle = (id: string) => setMarked((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));

  return (
    <div className="stagger flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <GameChip>
          🙊 Turno {n.turnNo}/{n.turnCount}
        </GameChip>
        <TimerRing left={left} total={total} />
      </div>

      <div className="flex items-center gap-3 rounded-2xl border-2 border-white/10 bg-slate-900 p-3">
        {comico && <Avatar avatar={comico.avatar} color={comico.color} size={46} />}
        <p className="min-w-0 flex-1 text-sm font-bold text-slate-300">
          {iComic ? 'Sei tu il comico 🤡' : 'Il comico è'}
          <span className="block truncate font-display text-xl text-white">{iComic ? 'Falli ridere!' : comico?.name}</span>
        </p>
      </div>

      {n.stage === 'ACT' &&
        (iComic && n.mission ? (
          <section key={n.turnNo} className="reveal-pop rounded-3xl border-4 border-white bg-linear-to-br from-amber-300 to-amber-500 p-5 text-center shadow-[0_8px_0_rgba(22,6,72,0.5)]">
            <p className="text-xs font-black uppercase tracking-widest text-slate-950/70">La tua missione</p>
            <p className="font-display text-3xl leading-tight text-slate-950">{n.mission}</p>
            <p className="mt-2 text-sm font-bold text-slate-950/80">Fallo adesso! Ogni risata che strappi vale 100 punti.</p>
          </section>
        ) : (
          <section className="pop flex flex-col items-center gap-1 rounded-3xl border-4 border-white/80 bg-linear-to-br from-cyan-400 to-slate-700 p-6 text-center shadow-[0_8px_0_rgba(22,6,72,0.5)]">
            <p className="wiggle text-7xl">😐</p>
            <p className="font-display text-4xl text-white">STAI SERIO!</p>
            <p className="font-bold text-white/90">Guarda {comico?.name} e non ridere: chi resta serio prende 50 punti.</p>
          </section>
        ))}

      {n.stage !== 'ACT' && n.mission && (
        <section className="rounded-3xl border-2 border-white/10 bg-slate-900 p-4 text-center">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">La missione era</p>
          <p className="font-display text-xl leading-tight text-white">{n.mission}</p>
        </section>
      )}

      {n.stage === 'MARK' &&
        (iComic ? (
          <section className="pop rounded-3xl border-2 border-amber-400/70 bg-slate-900 p-4">
            <p className="mb-3 text-center font-display text-2xl text-white">Chi ha riso? 😂</p>
            <div className="grid grid-cols-2 gap-2">
              {audience.map((id) => {
                const p = P(id);
                const on = marked.includes(id);
                return p ? (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggle(id)}
                    className={`flex items-center gap-2 rounded-2xl border-2 p-2 text-left font-bold ${on ? 'border-white bg-amber-400 text-slate-950' : 'border-white/10 bg-slate-800 text-white'}`}
                  >
                    <Avatar avatar={p.avatar} color={p.color} size={32} />
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    <span className="text-xl">{on ? '😂' : '😐'}</span>
                  </button>
                ) : null;
              })}
            </div>
          </section>
        ) : (
          <p className="text-center text-lg font-black text-slate-200">
            <span className="float inline-block">👀</span> {comico?.name} sta segnando chi ha riso…
          </p>
        ))}

      {n.stage === 'REVEAL' && (
        <section className="grid grid-cols-2 gap-2">
          {audience.map((id, i) => {
            const p = P(id);
            const laughed = n.laughed.includes(id);
            return p ? (
              <div
                key={id}
                className={`reveal-pop relative flex items-center gap-2 rounded-2xl p-2 ${laughed ? 'bg-red-500/25 ring-2 ring-red-400/60' : 'bg-emerald-500/20 ring-2 ring-emerald-400/60'}`}
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <Avatar avatar={p.avatar} color={p.color} size={32} />
                <span className="min-w-0 flex-1 truncate font-bold text-white">{p.name}</span>
                <span className="text-2xl">{laughed ? '😂' : '😐'}</span>
                <PointsPop points={n.gained[id] ?? 0} className="absolute -top-5 right-2" />
              </div>
            ) : null;
          })}
          {comico && (
            <div className="reveal-pop relative col-span-2 flex items-center justify-center gap-2 rounded-2xl bg-amber-400/20 p-2 font-black text-white ring-2 ring-amber-300">
              🤡 {comico.name} prende {n.gained[comico.id] ?? 0} punti
              <PointsPop points={n.gained[comico.id] ?? 0} className="absolute -top-5 right-4" />
            </div>
          )}
        </section>
      )}

      <BottomBar>
        {iComic && n.stage === 'ACT' ? (
          <button type="button" onClick={() => onAction('MG_DONE')} className="flex h-16 items-center justify-center gap-2 rounded-2xl bg-emerald-500 text-xl font-black text-white">
            <Check size={22} /> Fatto!
          </button>
        ) : iComic && n.stage === 'MARK' ? (
          <button type="button" onClick={() => onAction('MG_MARK', { ids: marked })} className="shine h-16 rounded-2xl bg-amber-400 text-xl font-black text-slate-950">
            {marked.length ? `Hanno riso in ${marked.length}!` : 'Nessuno ha riso 😤'}
          </button>
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-slate-700 bg-slate-900/95 px-4 py-3 text-sm font-bold text-slate-200">
            <span className="min-w-0 truncate">{n.stage === 'REVEAL' ? 'Prossimo comico tra poco…' : n.stage === 'ACT' ? 'Resisti… 😐' : 'Verdetto in arrivo…'}</span>
            {canLead && (
              <button type="button" onClick={onForce} className="flex shrink-0 items-center gap-1 rounded-full bg-slate-800 px-3 py-1.5 text-amber-200">
                <FastForward size={14} /> Avanti
              </button>
            )}
          </div>
        )}
      </BottomBar>
    </div>
  );
}
