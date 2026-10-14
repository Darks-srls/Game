import { useEffect, useState, type FormEvent } from 'react';
import confetti from 'canvas-confetti';
import { Check, FastForward, Pencil, Send } from 'lucide-react';
import type { BattuteView as BattuteData } from '../types/game';
import { useCountdown } from '../hooks/useCountdown';
import { soundManager } from '../utils/audio';
import { GameChip, Podium, PointsPop, TimerRing } from './fx';
import { Avatar, BottomBar, EndBar, Ranking, type ModeProps } from './ui';

// Una frase da completare: si scrive, si invia, si può correggere finché c'è tempo
function PromptCard({ prompt, answer, onSend }: { prompt: string; answer: string | null; onSend: (text: string) => void }) {
  const [text, setText] = useState(answer ?? '');
  const [editing, setEditing] = useState(answer === null);
  useEffect(() => {
    if (answer !== null) setEditing(false);
  }, [answer]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (text.trim()) onSend(text.trim());
  };
  return (
    <section className="pop flex flex-col gap-3 rounded-3xl border-2 border-white/10 bg-slate-900 p-4">
      <p className="font-display text-2xl leading-tight text-white">
        <span className="text-amber-300">“</span>
        {prompt}
        <span className="text-amber-300">”</span>
      </p>
      {editing ? (
        <form onSubmit={submit} className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 90))}
            placeholder="La tua battuta…"
            autoComplete="off"
            className="h-14 min-w-0 flex-1 rounded-2xl border-2 border-slate-700 bg-slate-950 px-4 text-lg text-white outline-none placeholder:text-slate-500 focus:border-amber-400"
          />
          <button type="submit" disabled={!text.trim()} aria-label="Invia" className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-amber-400 text-slate-950 disabled:opacity-50">
            <Send size={22} />
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex items-center gap-2 rounded-2xl bg-emerald-500/20 px-4 py-3 text-left font-bold text-emerald-50 ring-2 ring-emerald-400/60"
        >
          <Check size={20} className="shrink-0 text-emerald-300" />
          <span className="min-w-0 flex-1 break-words">{answer}</span>
          <Pencil size={16} className="shrink-0 opacity-70" />
        </button>
      )}
    </section>
  );
}

// 😂 Battute al volo: si completano frasi assurde, poi sfide a due e il gruppo vota la più divertente
export default function BattuteView({ state, clockOffset, canLead, onAction, onNewGame, onBackToLobby, onForce }: ModeProps) {
  const b = state.mg as BattuteData;
  const P = (id: string | null | undefined) => state.players.find((p) => p.id === id);
  const left = useCountdown(b.stage === 'END' ? null : b.stageEndsAt, clockOffset);
  const total = b.stage === 'WRITE' ? state.settings.writeSeconds : b.stage === 'VOTE' ? 25 : 7;
  const m = b.match;
  const result = b.stage === 'RESULT';
  const iWrite = b.writers.includes(state.myId);
  const iAuthor = !!m && b.stage === 'VOTE' && !b.canVote && b.order.includes(state.myId);
  // chi scrive ancora (si può dire); per i voti solo il numero, altrimenti si capirebbe chi sono gli autori
  const stillWriting = b.writers.filter((id) => P(id)?.isOnline && !b.done.includes(id)).map((id) => P(id)?.name);
  const voters = Math.max(0, b.order.filter((id) => P(id)?.isOnline).length - 2);

  // Suoni e coriandoli uguali per tutti
  useEffect(() => {
    if (b.stage === 'VOTE') soundManager.playReveal();
    if (b.stage === 'RESULT') {
      soundManager.playPop();
      if (b.battutona) {
        soundManager.playVictory();
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.4 } });
      }
    }
    if (b.stage === 'END') {
      soundManager.playVictory();
      confetti({ particleCount: 160, spread: 90, origin: { y: 0.35 } });
    }
  }, [b.stage, b.matchNo, b.round]);

  if (b.stage === 'END') {
    const ranking = Object.entries(b.scores).sort((x, y) => y[1] - x[1]);
    return (
      <div className="stagger flex flex-col gap-4">
        <h2 className="text-center text-3xl text-white">Re delle battute! 🎤</h2>
        <Podium state={state} entries={ranking.map(([id, points]) => ({ id, value: `${points} punti` }))} />
        <section className="rounded-3xl border-2 border-white/10 bg-slate-900 p-4">
          <Ranking state={state} scores={b.scores} />
        </section>
        <EndBar canLead={canLead} hostName={P(state.hostId)?.name} onNewGame={onNewGame} onBackToLobby={onBackToLobby} />
      </div>
    );
  }

  return (
    <div className="stagger flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <GameChip>
          😂 Round {b.round}/{b.totalRounds}
          {b.stage !== 'WRITE' && ` · Sfida ${b.matchNo}/${b.matchCount}`}
        </GameChip>
        <TimerRing left={left} total={total} />
      </div>

      {b.stage === 'WRITE' &&
        (iWrite ? (
          <>
            <p className="px-1 text-center font-bold text-slate-200">Completa le frasi nel modo più divertente: le battute sono anonime! 🤫</p>
            {b.myPrompts.map((p) => (
              <PromptCard key={p.index} prompt={p.prompt} answer={p.answer} onSend={(text) => onAction('MG_ANSWER', { index: p.index, text })} />
            ))}
          </>
        ) : (
          <section className="rounded-3xl border-2 border-white/10 bg-slate-900 p-6 text-center">
            <p className="float text-5xl">✍️</p>
            <p className="mt-2 text-xl font-black text-white">Gli altri stanno scrivendo…</p>
            <p className="text-sm font-semibold text-slate-400">Entri dal prossimo round: intanto potrai votare.</p>
          </section>
        ))}

      {m && (
        <>
          <section className="pop rounded-3xl border-4 border-white/90 bg-linear-to-br from-amber-300 to-amber-500 p-4 text-center shadow-[0_8px_0_rgba(22,6,72,0.5)]">
            <p className="font-display text-2xl leading-tight text-slate-950">{m.prompt}</p>
          </section>
          <div className="relative flex flex-col gap-3">
            {[0, 1].map((i) => {
              const answer = m.answers[i];
              const author = P(m.authors?.[i]);
              const voters = m.votes?.[i] ?? [];
              const other = m.votes?.[1 - i] ?? [];
              const won = result && voters.length > other.length;
              const mine = b.myVote === i;
              const points = result && m.authors ? b.gained[m.authors[i]] ?? 0 : 0;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={!b.canVote || result}
                  onClick={() => onAction('MG_VOTE', { choice: i })}
                  className={`relative flex min-h-[96px] flex-col items-start justify-center gap-2 rounded-3xl border-4 p-4 text-left transition-transform disabled:opacity-100 ${
                    i === 0 ? 'bg-linear-to-br from-red-400 to-red-600' : 'bg-linear-to-br from-cyan-400 to-cyan-600'
                  } ${mine ? 'border-white' : 'border-white/30'} ${won ? 'scale-[1.03]' : ''} ${result && !won && voters.length < other.length ? 'opacity-70' : ''}`}
                >
                  {won && <span className="reveal-pop absolute -right-2 -top-4 text-4xl">👑</span>}
                  <span className="text-2xl font-black leading-tight text-white [overflow-wrap:anywhere] [text-shadow:0_2px_0_rgba(0,0,0,0.2)]">
                    {answer ?? <span className="opacity-70">😴 nessuna risposta</span>}
                  </span>
                  {mine && !result && <span className="rounded-full bg-white px-3 py-0.5 text-xs font-black text-slate-950">✓ Il tuo voto</span>}
                  {result && author && (
                    <span className="reveal-pop flex flex-wrap items-center gap-2" style={{ animationDelay: '0.15s' }}>
                      <Avatar avatar={author.avatar} color={author.color} size={30} />
                      <span className="font-black text-white">{author.name}</span>
                      <span className="rounded-full bg-black/25 px-2.5 py-0.5 text-sm font-black text-white">
                        {voters.length} {voters.length === 1 ? 'voto' : 'voti'}
                      </span>
                      <span className="flex -space-x-2">
                        {voters.map((id) => {
                          const v = P(id);
                          return v ? <Avatar key={id} avatar={v.avatar} color={v.color} size={22} /> : null;
                        })}
                      </span>
                    </span>
                  )}
                  <PointsPop points={points} className="absolute bottom-3 right-4" />
                </button>
              );
            })}
            <span className="vs-badge pointer-events-none absolute left-1/2 top-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 border-white bg-slate-950 font-display text-lg text-amber-300">
              VS
            </span>
          </div>
          {result && b.battutona && (
            <p className="reveal-pop text-center font-display text-4xl text-amber-300 [text-shadow:0_4px_0_#d97a00]">🔥 BATTUTONA! 🔥</p>
          )}
          {result && b.forfeit && <p className="text-center font-bold text-slate-200">Vince a tavolino: l'altra battuta non è arrivata 😴</p>}
          {iAuthor && <p className="text-center font-bold text-amber-200">🤞 Una di queste è tua: aspetta il verdetto!</p>}
        </>
      )}

      <BottomBar>
        <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-slate-700 bg-slate-900/95 px-4 py-3 text-sm font-bold text-slate-200">
          <span className="min-w-0 truncate">
            {result
              ? 'Prossima sfida tra pochi secondi…'
              : b.stage === 'VOTE'
                ? `Voti arrivati: ${b.done.length}/${voters}`
                : stillWriting.length
                  ? `Scrivono ancora: ${stillWriting.join(', ')}`
                  : 'Tutti pronti!'}
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
