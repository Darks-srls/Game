import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { FastForward, Send } from 'lucide-react';
import type { GhigliottinaView as GhData } from '../../data/flat/ghigliottina';
import { useCountdown } from '../../hooks/useCountdown';
import { haptic, soundManager } from '../../utils/audio';
import { GameChip, Podium, TimerRing } from '../fx';
import { Avatar, BottomBar, EndBar, Ranking, type ModeProps } from '../ui';

const POINTS = [10, 8, 6, 4, 2];

// ora del server, aggiornata 4 volte al secondo (indizio in arrivo, pausa dopo un errore)
function useServerNow(offset: number) {
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() + offset), 250);
    return () => clearInterval(t);
  }, [offset]);
  return now;
}

// 🪓 La ghigliottina: cinque parole, una sola soluzione
export default function GhigliottinaView({ state, clockOffset, canLead, onAction, onNewGame, onBackToLobby, onForce }: ModeProps) {
  const q = state.mg as GhData;
  const me = state.myId;
  const P = (id: string) => state.players.find((p) => p.id === id);
  const live = q.stage === 'READY' || q.stage === 'PLAY';
  const left = useCountdown(live ? q.stageEndsAt : null, clockOffset);
  const now = useServerNow(clockOffset);
  const [text, setText] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const iPlay = q.order.includes(me);
  const canGuess = q.stage === 'PLAY' && iPlay && !q.me.solved;
  const waiting = now < q.me.waitUntil;
  const shown = q.clues.length;
  const online = q.order.filter((id) => P(id)?.isOnline).length;

  useEffect(() => {
    if (q.stage === 'PLAY') {
      setText('');
      input.current?.focus();
    }
    if (q.stage === 'REVEAL') soundManager.playDrumroll(0.6);
    if (q.stage === 'END') {
      soundManager.playVictory();
      confetti({ particleCount: 150, spread: 90, origin: { y: 0.35 } });
    }
  }, [q.stage, q.round]);
  // ogni indizio nuovo: la lama scende un po'
  useEffect(() => {
    if (q.stage === 'PLAY' && shown > 0) soundManager.playReveal();
  }, [shown, q.round]);
  useEffect(() => {
    if (q.me.solved && q.stage === 'PLAY') {
      soundManager.playSuccess();
      haptic([30, 40, 30]);
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.3 } });
    }
  }, [q.me.solved]);
  const solvedCount = q.solved.length;
  useEffect(() => {
    if (solvedCount > 0 && !q.me.solved) soundManager.playPop();
  }, [solvedCount]);
  useEffect(() => {
    if (q.me.tries > 0 && q.me.verdict) {
      if (q.me.verdict === 'CLOSE') soundManager.playPop();
      else soundManager.playError();
      haptic(q.me.verdict === 'CLOSE' ? 20 : [20, 30, 20]);
    }
  }, [q.me.tries]);

  const send = () => {
    const t = text.trim();
    if (!t || !canGuess || waiting) return;
    onAction('MG_GUESS', { text: t });
    haptic(15);
    setText('');
  };

  if (q.stage === 'END') {
    const ranking = Object.entries(q.scores).sort((x, y) => y[1] - x[1]);
    return (
      <div className="stagger flex flex-col gap-4">
        <h2 className="text-center text-3xl text-white">Chi ha battuto la ghigliottina? 🪓</h2>
        <Podium state={state} entries={ranking.map(([id, points]) => ({ id, value: `${points} ${points === 1 ? 'punto' : 'punti'}` }))} />
        <section className="rounded-3xl border-2 border-white/10 bg-slate-900 p-4">
          <Ranking state={state} scores={q.scores} />
        </section>
        <section className="flex flex-wrap justify-center gap-1.5 rounded-3xl border-2 border-white/10 bg-slate-900 p-3">
          {q.history.map((h, i) => {
            const p = h.first ? P(h.first) : null;
            return (
              <span key={i} className="flex items-center gap-1.5 rounded-full bg-slate-800 py-1 pl-3 pr-1 font-display text-sm text-white">
                {h.a}
                {p ? <Avatar avatar={p.avatar} color={p.color} size={22} /> : <span className="px-1 text-xs">🪓</span>}
              </span>
            );
          })}
        </section>
        <EndBar canLead={canLead} hostName={P(state.hostId)?.name} onNewGame={onNewGame} onBackToLobby={onBackToLobby} />
      </div>
    );
  }

  const nextIn = q.nextClueAt ? Math.max(0, Math.ceil((q.nextClueAt - now) / 1000)) : null;
  const worth = POINTS[Math.max(0, shown - 1)] + (q.solved.length === 0 ? 2 : 0);

  return (
    <div className="stagger flex flex-col gap-3 pb-32">
      <div className="flex items-center justify-between gap-2">
        <GameChip>
          🪓 Round {q.round}/{q.rounds}
        </GameChip>
        <span className="rounded-full bg-amber-400 px-3 py-1 text-sm font-black text-slate-950 shadow-[0_4px_0_rgba(22,6,72,0.4)]">⭐ {q.scores[me] ?? 0}</span>
        {live ? <TimerRing left={left} total={q.stage === 'READY' ? 3 : 43} /> : <span className="w-14" />}
      </div>

      {q.stage === 'READY' && (
        <section key={`r${q.round}`} className="pop flex flex-col items-center gap-2 rounded-3xl border-4 border-white/90 bg-linear-to-br from-rose-500 to-red-800 p-8 text-center shadow-[0_8px_0_rgba(22,6,72,0.5)]">
          <p className="text-sm font-black uppercase tracking-widest text-white/80">
            Ghigliottina {q.round} di {q.rounds}
          </p>
          <p key={left ?? 0} className="count-pop font-display text-8xl text-white [text-shadow:0_4px_0_rgba(0,0,0,0.25)]">
            {left || '🪓'}
          </p>
          <p className="text-lg font-black text-white">Cinque parole, un solo collegamento</p>
        </section>
      )}

      {/* quanto vale rispondere adesso */}
      {q.stage === 'PLAY' && canGuess && (
        <p key={`w${shown}`} className="pop text-center font-black text-amber-200">
          Se la indovini ora: <span className="font-display text-2xl text-amber-300">+{worth}</span>
          {q.solved.length === 0 && <span className="text-xs text-amber-100/80"> (bonus primo!)</span>}
        </p>
      )}

      {/* i cinque indizi */}
      {q.stage !== 'READY' && (
        <section className="flex flex-col gap-1.5">
          {[0, 1, 2, 3, 4].map((i) => {
            const word = q.clues[i];
            const link = q.links?.[i];
            return word ? (
              <div
                key={`${q.round}-${i}`}
                className="reveal-pop flex items-center gap-2 rounded-2xl border-2 border-white/80 bg-white px-3 py-2 shadow-[0_4px_0_rgba(22,6,72,0.45)]"
                style={{ animationDelay: q.links ? `${i * 0.08}s` : '0s' }}
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-900 font-display text-sm text-amber-300">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-2xl uppercase leading-tight text-slate-950">{word}</span>
                  {link && <span className="block text-sm font-bold leading-tight text-slate-600">{link}</span>}
                </span>
                {!q.links && <span className="shrink-0 text-xs font-black text-slate-400">{POINTS[i]} pt</span>}
              </div>
            ) : (
              <div key={`${q.round}-${i}`} className="flex items-center gap-2 rounded-2xl border-2 border-dashed border-slate-600 bg-slate-900/70 px-3 py-2">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-800 font-display text-sm text-slate-400">{i + 1}</span>
                <span className="flex-1 font-display text-2xl text-slate-600">???</span>
                {i === shown && nextIn !== null && <span className="text-sm font-black text-slate-300">tra {nextIn} s</span>}
              </div>
            );
          })}
        </section>
      )}

      {/* rispondere */}
      {canGuess && (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex gap-2"
          >
            <input
              ref={input}
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 30))}
              placeholder="La parola che le collega…"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="send"
              className="h-14 min-w-0 flex-1 rounded-2xl border-2 border-slate-700 bg-slate-950 px-4 text-xl font-bold uppercase text-white outline-none placeholder:normal-case placeholder:text-slate-500 focus:border-amber-400"
            />
            <button type="submit" disabled={waiting} aria-label="Rispondi" className="grid h-14 w-16 place-items-center rounded-2xl bg-emerald-500 text-white disabled:opacity-40">
              <Send size={22} />
            </button>
          </form>
          {q.me.verdict && q.me.last && (
            <p key={q.me.tries} className={`animate-shake text-center text-lg font-black ${q.me.verdict === 'CLOSE' ? 'text-amber-300' : 'text-rose-300'}`}>
              {q.me.verdict === 'CLOSE' ? `🔥 «${q.me.last}»: ci sei quasi!` : `❌ «${q.me.last}» non è giusta${waiting ? '… respira' : ', riprova!'}`}
            </p>
          )}
        </>
      )}
      {q.stage === 'PLAY' && q.me.solved && (
        <section className="pop rounded-3xl border-2 border-emerald-300 bg-emerald-500/20 p-3 text-center">
          <p className="font-display text-2xl text-emerald-200">✅ Esatto! +{q.gained[me] ?? 0}</p>
          <p className="font-display text-3xl uppercase text-white">{q.answer}</p>
          <p className="text-sm font-bold text-slate-300">Ssst, gli altri ci stanno ancora pensando 🤫</p>
        </section>
      )}
      {q.stage === 'PLAY' && !iPlay && <p className="text-center font-bold text-slate-300">Stai guardando: la prossima partita giochi anche tu! 👀</p>}

      {q.stage === 'REVEAL' && (
        <section className="reveal-pop rounded-3xl border-4 border-white/90 bg-linear-to-br from-rose-500 to-red-800 p-4 text-center shadow-[0_8px_0_rgba(22,6,72,0.5)]">
          <p className="text-xs font-black uppercase tracking-widest text-white/80">La parola era</p>
          <p className="break-words font-display text-5xl uppercase leading-tight text-white [text-shadow:0_3px_0_rgba(0,0,0,0.25)]">{q.answer}</p>
          {q.gained[me] ? <p className="mt-1 font-black text-amber-200">Tu +{q.gained[me]} ⭐</p> : iPlay ? <p className="mt-1 font-bold text-white/90">La ghigliottina ti ha preso 🪓</p> : null}
        </section>
      )}

      {/* chi l'ha presa */}
      {q.stage !== 'READY' && (
        <section className="flex flex-col gap-1.5">
          {q.solved.length === 0 ? (
            <p className="text-center text-sm font-bold text-slate-400">{q.stage === 'REVEAL' ? 'Nessuno l’ha presa 😅' : 'Ancora nessuno ha risposto giusto…'}</p>
          ) : (
            q.solved.map((x, i) => {
              const p = P(x.id);
              return (
                <p key={x.id} className={`pop flex items-center gap-2 rounded-2xl px-2 py-1.5 font-bold text-white ${x.id === me ? 'bg-emerald-500/30 ring-2 ring-emerald-300/60' : 'bg-slate-800'}`}>
                  <span className="w-6 text-center text-lg">{['🥇', '🥈', '🥉'][i] ?? `${i + 1}°`}</span>
                  {p && <Avatar avatar={p.avatar} color={p.color} size={28} />}
                  <span className="min-w-0 flex-1 truncate">{p?.name ?? '?'}</span>
                  <span className="text-sm text-slate-300">
                    con {x.clues} {x.clues === 1 ? 'indizio' : 'indizi'}
                  </span>
                  <span className="w-10 text-right font-display text-amber-300">+{x.points}</span>
                </p>
              );
            })
          )}
        </section>
      )}

      <BottomBar>
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate rounded-2xl border-2 border-slate-700 bg-slate-900/95 px-4 py-3 text-sm font-bold text-slate-200">
            {q.stage === 'READY'
              ? 'Arrivano le parole…'
              : q.stage === 'PLAY'
                ? shown < 5
                  ? `Indovinata da ${q.solved.length}/${online} · indizio ${shown}/5`
                  : `Ultimi secondi! Indovinata da ${q.solved.length}/${online}`
                : q.round < q.rounds
                  ? 'Prossima ghigliottina in arrivo…'
                  : 'Ultimo round: classifica in arrivo! 🏆'}
          </p>
          {canLead && (
            <button type="button" onClick={onForce} className="flex h-14 shrink-0 items-center gap-1 rounded-2xl bg-slate-800 px-3 text-sm font-black text-amber-200">
              <FastForward size={16} /> Avanti
            </button>
          )}
        </div>
      </BottomBar>
    </div>
  );
}
