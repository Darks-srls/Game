import { useEffect, useState, type FormEvent } from 'react';
import confetti from 'canvas-confetti';
import { Send, SkipForward } from 'lucide-react';
import type { DisegnaView as DisegnaData } from '../types/game';
import { useCountdown } from '../hooks/useCountdown';
import { soundManager } from '../utils/audio';
import DrawBoard from './DrawBoard';
import { Podium, TimerRing } from './fx';
import { Avatar, EndBar, Ranking, type ModeProps } from './ui';

// ✏️ Disegna e indovina: uno disegna in diretta, gli altri scrivono cosa è
export default function DisegnaView({ state, board, boardVersion, clockOffset, canLead, onAction, onDraw, onNewGame, onBackToLobby }: ModeProps) {
  const d = state.mg as DisegnaData;
  const [guess, setGuess] = useState('');
  const P = (id: string) => state.players.find((p) => p.id === id);
  const drawer = P(d.drawer);
  const iDraw = d.drawer === state.myId;
  const iGuessed = d.guessed.includes(state.myId);
  const left = useCountdown(d.stage === 'END' ? null : d.stageEndsAt, clockOffset);

  useEffect(() => {
    if (d.stage === 'DRAW') soundManager.playReveal();
    if (d.stage === 'END') {
      soundManager.playVictory();
      confetti({ particleCount: 160, spread: 90, origin: { y: 0.5 } });
    }
  }, [d.stage, d.round, d.drawer]);

  useEffect(() => {
    if (iGuessed) soundManager.playSuccess();
  }, [iGuessed]);

  // qualcun altro ha indovinato: un "pop" per tutti
  const guessedCount = d.guessed.length;
  useEffect(() => {
    if (guessedCount > 0 && !iGuessed) soundManager.playPop();
  }, [guessedCount]);

  const send = (e: FormEvent) => {
    e.preventDefault();
    const text = guess.trim();
    if (!text) return;
    onAction('MG_GUESS', { text });
    setGuess('');
  };

  if (d.stage === 'END') {
    return (
      <div className="stagger flex flex-col gap-4">
        <h2 className="text-center text-4xl text-amber-300">Classifica finale</h2>
        <Podium
          state={state}
          entries={Object.entries(d.scores)
            .sort((x, y) => y[1] - x[1])
            .map(([id, points]) => ({ id, value: `${points} punti` }))}
        />
        <section className="rounded-3xl border-2 border-white/10 bg-slate-900 p-4">
          <Ranking state={state} scores={d.scores} />
        </section>
        <EndBar canLead={canLead} hostName={P(state.hostId)?.name} onNewGame={onNewGame} onBackToLobby={onBackToLobby} />
      </div>
    );
  }

  const feed = [...d.feed].reverse().slice(0, 8);

  return (
    <div className="stagger flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-slate-900 px-3 py-1 text-sm font-black text-slate-100">
          ✏️ Giro {d.round}/{d.totalRounds}
        </span>
        {left !== null && <TimerRing left={left} total={d.stage === 'CHOOSE' ? 15 : d.stage === 'REVEAL' ? 5 : state.settings.guessSeconds} />}
      </div>

      {d.stage === 'CHOOSE' ? (
        iDraw && d.choices ? (
          <section className="flex flex-col gap-3 rounded-3xl border-2 border-amber-400 bg-slate-900 p-4 text-center">
            <p className="text-2xl font-black text-white">Tocca a te! Cosa disegni?</p>
            {d.choices.map((w) => (
              <button key={w} type="button" onClick={() => onAction('MG_CHOOSE', { word: w })} className="h-14 rounded-2xl bg-amber-400 text-xl font-black text-slate-950">
                {w}
              </button>
            ))}
          </section>
        ) : (
          <section className="flex flex-col items-center gap-3 rounded-3xl border-2 border-slate-700 bg-slate-900 p-6 text-center">
            {drawer && <Avatar avatar={drawer.avatar} color={drawer.color} size={72} />}
            <p className="text-xl font-black text-white">{drawer?.name} sta scegliendo cosa disegnare…</p>
          </section>
        )
      ) : (
        <>
          <div className="text-center">
            {d.stage === 'REVEAL' ? (
              <p className="text-2xl font-black text-white">
                La parola era: <span className="text-amber-300">{d.word}</span>
              </p>
            ) : d.word ? (
              <p className="text-2xl font-black text-white">
                {iDraw ? 'Disegna: ' : 'Indovinato: '}
                <span className="text-amber-300">{d.word}</span>
                {iGuessed ? ' ✅' : ''}
              </p>
            ) : (
              <div className="flex flex-wrap justify-center gap-1">
                {d.mask.map((ch, i) =>
                  ch === ' ' ? (
                    <span key={i} className="w-3" />
                  ) : (
                    <span key={i} className="grid h-9 w-7 place-items-center rounded-lg border-b-4 border-slate-500 bg-slate-950 text-xl font-black text-white">
                      {ch ?? ''}
                    </span>
                  ),
                )}
              </div>
            )}
          </div>

          <DrawBoard ops={board} version={boardVersion} onOp={iDraw && d.stage === 'DRAW' ? onDraw : undefined} />

          {iDraw && d.stage === 'DRAW' && (
            <button type="button" onClick={() => onAction('MG_SKIP')} className="flex items-center justify-center gap-1.5 self-center text-sm font-bold text-slate-300 underline">
              <SkipForward size={14} /> Salta questa parola
            </button>
          )}
          {!iDraw && !iGuessed && d.stage === 'DRAW' && (
            <form onSubmit={send} className="flex gap-2">
              <input
                value={guess}
                onChange={(e) => setGuess(e.target.value.slice(0, 40))}
                placeholder="Scrivi cosa è…"
                autoComplete="off"
                autoCapitalize="none"
                enterKeyHint="send"
                className="h-12 min-w-0 flex-1 rounded-2xl border-2 border-slate-700 bg-slate-950 px-4 text-lg text-white outline-none placeholder:text-slate-500 focus:border-amber-400"
              />
              <button type="submit" aria-label="Invia" className="grid h-12 w-14 place-items-center rounded-2xl bg-emerald-500 text-white">
                <Send size={20} />
              </button>
            </form>
          )}
        </>
      )}

      <section className="rounded-3xl border-2 border-slate-700 bg-slate-900 p-3">
        <ul className="flex flex-col gap-1 text-sm">
          {feed.length === 0 && <li className="text-slate-400">Le risposte compariranno qui…</li>}
          {feed.map((f, i) => {
            const name = P(f.by)?.name ?? '?';
            if (f.kind === 'ok') return <li key={i} className="font-black text-emerald-300">✅ {name} ha indovinato!</li>;
            if (f.kind === 'info') return <li key={i} className="font-bold text-slate-400">✏️ Ora disegna {name}</li>;
            if (f.kind === 'close')
              return (
                <li key={i} className="font-bold text-amber-300">
                  {f.text ? `«${f.text}»: ci sei quasi!` : `🔥 ${name} è a un passo!`}
                </li>
              );
            return (
              <li key={i} className="text-slate-200">
                <b>{name}:</b> {f.text}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex flex-wrap gap-2">
        {d.order.map((id) => {
          const p = P(id);
          if (!p) return null;
          return (
            <span
              key={id}
              className={`flex items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-sm font-bold ${d.guessed.includes(id) ? 'bg-emerald-500/25 text-emerald-100' : 'bg-slate-800 text-slate-200'}`}
            >
              <Avatar avatar={p.avatar} color={p.color} size={24} />
              {id === d.drawer ? '✏️ ' : ''}
              {p.name} · {d.scores[id] ?? 0}
              {d.gained[id] ? <b className="text-amber-300"> +{d.gained[id]}</b> : null}
            </span>
          );
        })}
      </section>
    </div>
  );
}
