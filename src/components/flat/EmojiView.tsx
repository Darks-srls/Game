import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { FastForward, Send } from 'lucide-react';
import { EMOJI_CATS, type EmojiView as EmojiData } from '../../data/flat/emoji';
import { useCountdown } from '../../hooks/useCountdown';
import { haptic, soundManager } from '../../utils/audio';
import { GameChip, Podium, TimerRing } from '../fx';
import { Avatar, BottomBar, EndBar, Ranking, type ModeProps } from '../ui';

const secs = (ms: number) => `${(ms / 1000).toFixed(1).replace('.', ',')} s`;

// ora del server, aggiornata 4 volte al secondo (per gli aiutini e la pausa dopo un errore)
function useServerNow(offset: number) {
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() + offset), 250);
    return () => clearInterval(t);
  }, [offset]);
  return now;
}

// la risposta a caselle: le lettere scoperte dagli aiutini, le altre vuote
function MaskTiles({ mask }: { mask: (string | null)[] }) {
  const words: (string | null)[][] = [[]];
  for (const ch of mask) {
    if (ch === ' ') words.push([]);
    else words[words.length - 1].push(ch);
  }
  return (
    <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5">
      {words.map((w, i) => (
        <span key={i} className="flex gap-0.5">
          {w.map((ch, j) =>
            ch !== null && !/[\p{L}\p{N}]/u.test(ch) ? (
              <span key={j} className="grid w-3 place-items-end pb-1 text-lg font-black text-white/80">
                {ch}
              </span>
            ) : (
              <span
                key={j}
                className={`grid h-9 w-7 place-items-center rounded-lg border-b-4 font-display text-lg ${ch ? 'border-amber-500 bg-amber-300 text-slate-950' : 'border-slate-600 bg-slate-950 text-white'}`}
              >
                {ch ?? ''}
              </span>
            ),
          )}
        </span>
      ))}
    </div>
  );
}

// 🎬 Emoji quiz: indovina film, canzoni e proverbi scritti in emoji
export default function EmojiView({ state, clockOffset, canLead, onAction, onNewGame, onBackToLobby, onForce }: ModeProps) {
  const q = state.mg as EmojiData;
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
  const online = q.order.filter((id) => P(id)?.isOnline).length;

  // suoni e coriandoli (uguali per tutti, tranne la propria risposta)
  useEffect(() => {
    if (q.stage === 'PLAY') {
      soundManager.playReveal();
      setText('');
      input.current?.focus();
    }
    if (q.stage === 'REVEAL') soundManager.playDrumroll(0.6);
    if (q.stage === 'END') {
      soundManager.playVictory();
      confetti({ particleCount: 150, spread: 90, origin: { y: 0.35 } });
    }
  }, [q.stage, q.round]);
  useEffect(() => {
    if (q.stage === 'PLAY' && q.hint > 0) soundManager.playWhoosh();
  }, [q.hint]);
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
        <h2 className="text-center text-3xl text-white">Re delle emoji 👑</h2>
        <Podium state={state} entries={ranking.map(([id, points]) => ({ id, value: `${points} ${points === 1 ? 'punto' : 'punti'}` }))} />
        <section className="rounded-3xl border-2 border-white/10 bg-slate-900 p-4">
          <Ranking state={state} scores={q.scores} />
        </section>
        <section className="flex flex-col gap-1.5 rounded-3xl border-2 border-white/10 bg-slate-900 p-3">
          {q.history.map((h, i) => {
            const p = h.first ? P(h.first) : null;
            return (
              <p key={i} className="flex items-center gap-2 rounded-2xl bg-slate-800 p-2 text-sm font-bold text-white">
                <span className="shrink-0 text-lg">{h.e}</span>
                <span className="min-w-0 flex-1 truncate">{h.a}</span>
                {p ? <Avatar avatar={p.avatar} color={p.color} size={24} /> : <span className="text-xs text-slate-400">nessuno</span>}
              </p>
            );
          })}
        </section>
        <EndBar canLead={canLead} hostName={P(state.hostId)?.name} onNewGame={onNewGame} onBackToLobby={onBackToLobby} />
      </div>
    );
  }

  const solvedList = (
    <section className="flex flex-col gap-1.5">
      {q.solved.length === 0 ? (
        <p className="text-center text-sm font-bold text-slate-400">{q.stage === 'REVEAL' ? 'Nessuno l’ha presa 😅' : 'Ancora nessuno… chi sarà il primo? 🤔'}</p>
      ) : (
        q.solved.map((x, i) => {
          const p = P(x.id);
          return (
            <p
              key={x.id}
              style={{ animationDelay: `${i * 0.05}s` }}
              className={`pop flex items-center gap-2 rounded-2xl px-2 py-1.5 font-bold text-white ${x.id === me ? 'bg-emerald-500/30 ring-2 ring-emerald-300/60' : 'bg-slate-800'}`}
            >
              <span className="w-6 text-center text-lg">{['🥇', '🥈', '🥉'][i] ?? `${i + 1}°`}</span>
              {p && <Avatar avatar={p.avatar} color={p.color} size={28} />}
              <span className="min-w-0 flex-1 truncate">{p?.name ?? '?'}</span>
              <span className="text-sm text-slate-300">{secs(x.ms)}</span>
              <span className="w-10 text-right font-display text-amber-300">+{x.points}</span>
            </p>
          );
        })
      )}
    </section>
  );

  const hintLeft = q.nextHintAt ? Math.max(0, Math.ceil((q.nextHintAt - now) / 1000)) : null;
  // lettere di ogni parola della risposta (dal primo aiutino)
  const letterCount = q.mask
    ? q.mask
        .map((ch) => (ch === null ? '_' : ch))
        .join('')
        .split(' ')
        .map((w) => [...w].filter((ch) => ch === '_' || /[\p{L}\p{N}]/u.test(ch)).length)
        .filter((n) => n > 0)
    : [];

  return (
    <div className="stagger flex flex-col gap-4 pb-32">
      <div className="flex items-center justify-between gap-2">
        <GameChip>
          🎬 Round {q.round}/{q.rounds}
        </GameChip>
        <span className="rounded-full bg-amber-400 px-3 py-1 text-sm font-black text-slate-950 shadow-[0_4px_0_rgba(22,6,72,0.4)]">⭐ {q.scores[me] ?? 0}</span>
        {live ? <TimerRing left={left} total={q.stage === 'READY' ? 3 : 45} /> : <span className="w-14" />}
      </div>

      {/* pronti… */}
      {q.stage === 'READY' && (
        <section key={`r${q.round}`} className="pop flex flex-col items-center gap-2 rounded-3xl border-4 border-white/90 bg-linear-to-br from-fuchsia-500 to-indigo-700 p-8 text-center shadow-[0_8px_0_rgba(22,6,72,0.5)]">
          <p className="text-sm font-black uppercase tracking-widest text-white/80">
            Round {q.round} di {q.rounds}
          </p>
          <p key={left ?? 0} className="count-pop font-display text-8xl text-white [text-shadow:0_4px_0_rgba(0,0,0,0.25)]">
            {left || '🎬'}
          </p>
          <p className="text-lg font-black text-white">{iPlay ? 'Dita sulla tastiera!' : 'Guarda e divertiti 👀'}</p>
        </section>
      )}

      {/* le emoji */}
      {q.stage !== 'READY' && q.emoji && (
        <section
          key={`e${q.round}`}
          className="reveal-pop rounded-3xl border-4 border-white/90 bg-linear-to-br from-amber-300 to-orange-500 px-3 py-6 text-center shadow-[0_8px_0_rgba(22,6,72,0.5)]"
        >
          <p className="break-words text-6xl leading-tight tracking-wide drop-shadow-[0_3px_0_rgba(0,0,0,0.15)]">{q.emoji}</p>
          {q.cat && (
            <p className="pop mt-3 inline-block rounded-full bg-slate-950/85 px-3 py-1 text-sm font-black text-amber-200">{EMOJI_CATS[q.cat]}</p>
          )}
        </section>
      )}

      {/* aiutini */}
      {q.stage === 'PLAY' && !q.me.solved && (
        <section className="flex flex-col items-center gap-2">
          {q.mask && (
            <div key={`m${q.hint}`} className="pop flex flex-col items-center gap-1.5">
              <MaskTiles mask={q.mask} />
              <p className="text-xs font-bold text-slate-400">
                {letterCount.join(' + ')} {letterCount.reduce((a, b) => a + b, 0) === 1 ? 'lettera' : 'lettere'}
              </p>
            </div>
          )}
          {hintLeft !== null && (
            <p className="text-sm font-bold text-slate-300">
              💡 {q.hint === 0 ? 'Aiutino' : 'Secondo aiutino'} tra {hintLeft} s
            </p>
          )}
        </section>
      )}

      {/* scrivere la risposta */}
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
              onChange={(e) => setText(e.target.value.slice(0, 60))}
              placeholder="Scrivi la risposta…"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="send"
              className="h-14 min-w-0 flex-1 rounded-2xl border-2 border-slate-700 bg-slate-950 px-4 text-xl font-bold text-white outline-none placeholder:text-slate-500 focus:border-amber-400"
            />
            <button type="submit" disabled={waiting} aria-label="Invia" className="grid h-14 w-16 place-items-center rounded-2xl bg-emerald-500 text-white disabled:opacity-40">
              <Send size={22} />
            </button>
          </form>
          {q.me.verdict && q.me.last && (
            <p
              key={q.me.tries}
              className={`animate-shake text-center text-lg font-black ${q.me.verdict === 'CLOSE' ? 'text-amber-300' : 'text-rose-300'}`}
            >
              {q.me.verdict === 'CLOSE' ? `🔥 «${q.me.last}»: ci sei quasi!` : `❌ «${q.me.last}» non è giusto${waiting ? '… respira' : ', riprova!'}`}
            </p>
          )}
        </>
      )}
      {q.stage === 'PLAY' && q.me.solved && (
        <section className="pop rounded-3xl border-2 border-emerald-300 bg-emerald-500/20 p-3 text-center">
          <p className="font-display text-2xl text-emerald-200">✅ Presa! +{q.gained[me] ?? 0}</p>
          <p className="text-lg font-black text-white">{q.answer}</p>
          <p className="text-sm font-bold text-slate-300">Ssst, non dirla agli altri 🤫</p>
        </section>
      )}
      {q.stage === 'PLAY' && !iPlay && <p className="text-center font-bold text-slate-300">Stai guardando: la prossima partita giochi anche tu! 👀</p>}

      {/* soluzione */}
      {q.stage === 'REVEAL' && (
        <section className="reveal-pop rounded-3xl border-4 border-white/90 bg-linear-to-br from-emerald-400 to-teal-600 p-4 text-center shadow-[0_8px_0_rgba(22,6,72,0.5)]">
          <p className="text-xs font-black uppercase tracking-widest text-white/80">La risposta era</p>
          <p className="break-words font-display text-4xl leading-tight text-white [text-shadow:0_3px_0_rgba(0,0,0,0.2)]">{q.answer}</p>
          {q.gained[me] ? (
            <p className="mt-1 font-black text-amber-200">Tu +{q.gained[me]} ⭐</p>
          ) : iPlay ? (
            <p className="mt-1 font-bold text-white/90">Stavolta niente… alla prossima! 💪</p>
          ) : null}
        </section>
      )}

      {q.stage !== 'READY' && solvedList}

      <BottomBar>
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate rounded-2xl border-2 border-slate-700 bg-slate-900/95 px-4 py-3 text-sm font-bold text-slate-200">
            {q.stage === 'READY'
              ? 'Pronti… partenza…'
              : q.stage === 'PLAY'
                ? `Indovinata da ${q.solved.length}/${online}`
                : q.round < q.rounds
                  ? 'Prossimo rebus in arrivo…'
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
