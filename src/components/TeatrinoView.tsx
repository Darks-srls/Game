import { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { FastForward } from 'lucide-react';
import type { TeatrinoView as TeatrinoData } from '../types/game';
import { useCountdown } from '../hooks/useCountdown';
import { soundManager } from '../utils/audio';
import { GameChip, Podium, PointsPop, TimerRing } from './fx';
import { Avatar, BottomBar, EndBar, Ranking, type ModeProps } from './ui';

// 🎭 Teatrino: una frase normalissima recitata in uno stile segreto; gli altri indovinano lo stile
export default function TeatrinoView({ state, clockOffset, canLead, onAction, onNewGame, onBackToLobby, onForce }: ModeProps) {
  const t = state.mg as TeatrinoData;
  const P = (id: string | null) => state.players.find((p) => p.id === id);
  const left = useCountdown(t.stage === 'END' ? null : t.stageEndsAt, clockOffset);
  const actor = P(t.actor);
  const iAct = t.actor === state.myId;
  const reveal = t.stage === 'REVEAL';
  const canGuess = t.stage === 'ACT' && !iAct && t.order.includes(state.myId) && t.myGuess === null;
  const guessers = t.order.filter((id) => id !== t.actor && P(id)?.isOnline).length;

  useEffect(() => {
    if (t.stage === 'ACT') soundManager.playReveal();
    if (t.stage === 'REVEAL') {
      if (t.myGuess !== null && t.myGuess === t.answer) soundManager.playSuccess();
      else soundManager.playPop();
    }
    if (t.stage === 'END') {
      soundManager.playVictory();
      confetti({ particleCount: 160, spread: 90, origin: { y: 0.35 } });
    }
  }, [t.stage, t.turnNo]);

  if (t.stage === 'END') {
    const ranking = Object.entries(t.scores).sort((x, y) => y[1] - x[1]);
    return (
      <div className="stagger flex flex-col gap-4">
        <h2 className="text-center text-3xl text-white">Premio Oscar 🏆</h2>
        <Podium state={state} entries={ranking.map(([id, points]) => ({ id, value: `${points} punti` }))} />
        <section className="rounded-3xl border-2 border-white/10 bg-slate-900 p-4">
          <Ranking state={state} scores={t.scores} />
        </section>
        <EndBar canLead={canLead} hostName={P(state.hostId)?.name} onNewGame={onNewGame} onBackToLobby={onBackToLobby} />
      </div>
    );
  }

  return (
    <div className="stagger flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <GameChip>
          🎭 Turno {t.turnNo}/{t.turnCount}
        </GameChip>
        <TimerRing left={left} total={reveal ? 7 : 45} />
      </div>

      <div className="flex items-center gap-3 rounded-2xl border-2 border-white/10 bg-slate-900 p-3">
        {actor && <Avatar avatar={actor.avatar} color={actor.color} size={46} />}
        <p className="min-w-0 flex-1 text-sm font-bold text-slate-300">
          {iAct ? 'Tocca a te: sul palco!' : 'Sul palco c’è'}
          <span className="block truncate font-display text-xl text-white">{iAct ? 'Recita la frase ad alta voce' : actor?.name}</span>
        </p>
        <span className="text-3xl">🎭</span>
      </div>

      {/* La frase: la vedono tutti */}
      <section key={t.turnNo} className="pop rounded-3xl border-4 border-white bg-white p-5 text-center shadow-[0_8px_0_rgba(22,6,72,0.5)]">
        <p className="text-xs font-black uppercase tracking-widest text-slate-500">La frase</p>
        <p className="font-display text-3xl leading-tight text-slate-950">«{t.phrase}»</p>
      </section>

      {/* Lo stile segreto: solo per chi recita */}
      {iAct && t.myStyle !== null && (
        <section className="pop rounded-3xl border-4 border-amber-300 bg-linear-to-br from-amber-300 to-amber-500 p-4 text-center shadow-[0_8px_0_rgba(22,6,72,0.5)]">
          <p className="text-xs font-black uppercase tracking-widest text-slate-950/70">Il tuo stile segreto</p>
          <p className="font-display text-3xl leading-tight text-slate-950">{t.options[t.myStyle]}</p>
          <p className="mt-1 text-sm font-bold text-slate-950/80">Recitala così, ad alta voce. Gli altri devono indovinare lo stile!</p>
        </section>
      )}

      {/* I sei stili possibili */}
      <section className="grid grid-cols-2 gap-2">
        {t.options.map((style, i) => {
          const picked = t.myGuess === i;
          const right = reveal && t.answer === i;
          const voters = reveal && t.guesses ? Object.keys(t.guesses).filter((id) => t.guesses![id] === i) : [];
          return (
            <button
              key={`${t.turnNo}-${i}`}
              type="button"
              disabled={!canGuess}
              onClick={() => onAction('MG_PICK', { choice: i })}
              className={`pop relative flex min-h-[64px] flex-col items-start justify-center gap-1 rounded-2xl border-2 p-3 text-left font-black leading-tight disabled:opacity-100 ${
                right
                  ? 'border-emerald-300 bg-emerald-500 text-white'
                  : picked
                    ? 'border-white bg-amber-400 text-slate-950'
                    : iAct && t.myStyle === i
                      ? 'border-amber-300 bg-slate-900 text-amber-200'
                      : reveal
                        ? 'border-transparent bg-slate-900/70 text-slate-400'
                        : 'border-white/10 bg-slate-900 text-white'
              }`}
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <span>
                {right && '✓ '}
                {style}
              </span>
              {voters.length > 0 && (
                <span className="flex -space-x-1.5">
                  {voters.map((id) => {
                    const p = P(id);
                    return p ? <Avatar key={id} avatar={p.avatar} color={p.color} size={20} /> : null;
                  })}
                </span>
              )}
            </button>
          );
        })}
      </section>

      {reveal && (
        <section className="flex flex-wrap justify-center gap-2">
          {Object.entries(t.gained).map(([id, points]) => {
            const p = P(id);
            return p ? (
              <span key={id} className="pop relative flex items-center gap-1.5 rounded-full bg-slate-900 py-1 pl-1 pr-3 font-bold text-white">
                <Avatar avatar={p.avatar} color={p.color} size={26} />
                {p.name} <span className="text-amber-300">+{points}</span>
                <PointsPop points={points} className="absolute -top-6 right-1" />
              </span>
            ) : null;
          })}
        </section>
      )}

      <BottomBar>
        <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-slate-700 bg-slate-900/95 px-4 py-3 text-sm font-bold text-slate-200">
          <span className="min-w-0 truncate">
            {reveal ? 'Prossimo attore tra poco…' : canGuess ? 'Ascolta e tocca lo stile giusto!' : `Hanno risposto: ${t.guessed.length}/${guessers}`}
          </span>
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
