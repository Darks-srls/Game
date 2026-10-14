import { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { Check, FastForward, Flag, Send } from 'lucide-react';
import type { ParolaUnicaView as PUData } from '../../data/flat/parolaunica';
import { useCountdown } from '../../hooks/useCountdown';
import { haptic, soundManager } from '../../utils/audio';
import { GameChip, TimerRing } from '../fx';
import { Avatar, BottomBar, EndBar, type ModeProps } from '../ui';

const STAGE_SECONDS: Record<PUData['stage'], number> = { CLUE: 70, CHECK: 25, GUESS: 50, RESULT: 7, END: 0 };
const WHY: Record<string, string> = { uguale: 'uguale a un altro', vietato: 'troppo simile alla parola', bocciato: 'bocciato' };

// voto finale (13 carte come nel gioco da tavolo; con meno carte si fa la proporzione)
function rating(score: number, cards: number) {
  const k = score / Math.max(1, cards);
  if (k >= 1) return 'Perfetto! Siete una mente sola 🤯';
  if (k >= 0.9) return 'Incredibile! 🏆';
  if (k >= 0.8) return 'Fantastico! 🎉';
  if (k >= 0.65) return 'Ottimo lavoro! 👏';
  if (k >= 0.5) return 'Niente male 🙂';
  if (k >= 0.3) return 'Nella media… 😅';
  return 'Riprovate (e parlatevi di più) 🙈';
}

// ☝️ Una parola sola: indizi di una parola, quelli uguali si annullano
export default function ParolaUnicaView({ state, clockOffset, canLead, onAction, onNewGame, onBackToLobby, onForce }: ModeProps) {
  const q = state.mg as PUData;
  const me = state.myId;
  const P = (id: string) => state.players.find((p) => p.id === id);
  const left = useCountdown(q.stage === 'END' ? null : q.stageEndsAt, clockOffset);
  const iGuess = me === q.guesser;
  const guesser = P(q.guesser);
  const [text, setText] = useState('');
  const writersOnline = q.order.filter((id) => id !== q.guesser && P(id)?.isOnline).length;

  // testo vuoto a ogni carta nuova
  useEffect(() => setText(''), [q.cardNo, q.stage === 'CLUE', q.stage === 'GUESS']);
  // suoni uguali per tutti
  useEffect(() => {
    if (q.stage === 'GUESS') soundManager.playReveal();
    if (q.stage === 'RESULT') {
      if (q.result === 'OK') {
        soundManager.playSuccess();
        confetti({ particleCount: 90, spread: 70, origin: { y: 0.4 } });
      } else if (q.result === 'KO') soundManager.playError();
      else soundManager.playPop();
    }
    if (q.stage === 'END') soundManager.playVictory();
  }, [q.stage, q.cardNo]);

  const send = (type: string) => {
    const t = text.trim();
    if (!t) return;
    onAction(type, { text: t });
    haptic(20);
    if (type === 'MG_GUESS') setText('');
  };

  if (q.stage === 'END') {
    return (
      <div className="stagger flex flex-col gap-4">
        <h2 className="text-center text-3xl text-white">Parole indovinate</h2>
        <section className="pop rounded-3xl border-4 border-white/90 bg-linear-to-br from-amber-300 to-orange-500 p-5 text-center shadow-[0_8px_0_rgba(22,6,72,0.5)]">
          <p className="font-display text-7xl text-white [text-shadow:0_4px_0_rgba(0,0,0,0.25)]">
            {q.score}
            <span className="text-3xl text-white/80">/{q.cards}</span>
          </p>
          <p className="mt-1 text-xl font-black text-slate-950">{rating(q.score, q.cards)}</p>
        </section>
        <section className="flex flex-col gap-1.5 rounded-3xl border-2 border-white/10 bg-slate-900 p-3">
          {q.history.map((h, i) => {
            const p = P(h.guesser);
            return (
              <p key={i} className="flex items-center gap-2 rounded-2xl bg-slate-800 p-2 text-sm font-bold text-white">
                <span className="text-lg">{h.result === 'OK' ? '✅' : h.result === 'KO' ? '❌' : '⏭️'}</span>
                {p && <Avatar avatar={p.avatar} color={p.color} size={26} />}
                <span className="flex-1 truncate uppercase">{h.word}</span>
                {h.result === 'KO' && <span className="truncate text-xs text-rose-300">“{h.guess}”</span>}
              </p>
            );
          })}
        </section>
        <EndBar canLead={canLead} hostName={P(state.hostId)?.name} onNewGame={onNewGame} onBackToLobby={onBackToLobby} />
      </div>
    );
  }

  // la carta con la parola (o il punto di domanda per chi indovina)
  const wordCard = (
    <section
      key={`${q.cardNo}-${q.stage === 'RESULT'}`}
      className={`pop relative overflow-hidden rounded-3xl border-4 border-white/90 p-5 text-center shadow-[0_8px_0_rgba(22,6,72,0.5)] ${
        q.word ? 'bg-linear-to-br from-amber-300 to-orange-500' : 'bg-linear-to-br from-violet-500 to-indigo-700'
      }`}
    >
      <p className="text-xs font-black uppercase tracking-widest text-slate-950/70">{q.word ? (iGuess ? 'La parola era' : `Fai indovinare a ${guesser?.name ?? '?'}`) : 'La tua parola misteriosa'}</p>
      <p className="mt-1 break-words font-display text-5xl uppercase leading-tight text-white [text-shadow:0_4px_0_rgba(0,0,0,0.25)]">{q.word ?? '???'}</p>
    </section>
  );

  const clueList = (mode: 'check' | 'show') => (
    <div className="grid grid-cols-2 gap-2">
      {q.clues.map((c, i) => {
        const p = P(c.by);
        const mine = c.by === me;
        const flagged = q.myFlags.includes(c.by);
        const canFlag = mode === 'check' && !mine && !iGuess && !c.cancelled;
        return (
          <button
            key={c.by}
            type="button"
            disabled={!canFlag && !(mode === 'check' && flagged)}
            onClick={() => onAction('MG_FLAG', { id: c.by })}
            style={{ animationDelay: `${0.05 + i * 0.06}s` }}
            className={`pop relative flex min-h-[86px] flex-col items-center justify-center gap-1 rounded-2xl border-4 p-2 text-center disabled:opacity-100 ${
              c.cancelled ? 'border-rose-400/60 bg-slate-800' : flagged ? 'border-rose-400 bg-rose-500/20' : 'border-white/80 bg-white'
            }`}
          >
            {p && (
              <span className="absolute left-1.5 top-1.5">
                <Avatar avatar={p.avatar} color={p.color} size={22} />
              </span>
            )}
            {c.cancelled && c.text === null ? (
              <span className="text-3xl">❌</span>
            ) : (
              <span className={`break-all font-display text-2xl uppercase leading-tight ${c.cancelled ? 'text-slate-400 line-through decoration-rose-400 decoration-4' : 'text-slate-950'}`}>{c.text}</span>
            )}
            {c.cancelled && <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-black uppercase text-white">{WHY[c.why ?? ''] ?? 'cancellato'}</span>}
            {mode === 'check' && !c.cancelled && c.flags > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-black text-white">
                <Flag size={10} /> {c.flags}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  const waiting = (who: string[], label: string) => (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      <span className="mr-1 text-sm font-bold text-slate-300">{label}</span>
      {q.order
        .filter((id) => id !== q.guesser)
        .map((id) => {
          const p = P(id);
          if (!p) return null;
          const done = who.includes(id);
          return (
            <span key={id} className={`relative ${done ? '' : 'opacity-40'}`}>
              <Avatar avatar={p.avatar} color={p.color} size={32} />
              {done && <span className="absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full bg-emerald-500 text-white"><Check size={11} strokeWidth={4} /></span>}
            </span>
          );
        })}
    </div>
  );

  return (
    <div className="stagger flex flex-col gap-4 pb-32">
      <div className="flex items-center justify-between gap-2">
        <GameChip>
          ☝️ Parola {q.cardNo}/{q.cards}
        </GameChip>
        <span className="rounded-full bg-emerald-500 px-3 py-1 text-sm font-black text-white shadow-[0_4px_0_rgba(22,6,72,0.4)]">✅ {q.score}</span>
        <TimerRing left={left} total={STAGE_SECONDS[q.stage]} />
      </div>

      {guesser && (
        <p className="flex items-center justify-center gap-2 text-center font-black text-white">
          <Avatar avatar={guesser.avatar} color={guesser.color} size={30} />
          {iGuess ? 'Tocca a te indovinare!' : `Indovina: ${guesser.name}`}
        </p>
      )}

      {q.stage !== 'RESULT' && wordCard}

      {/* scrivere l'indizio */}
      {q.stage === 'CLUE' && !iGuess && (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send('MG_CLUE');
            }}
            className="flex gap-2"
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value.replace(/\s/g, '').slice(0, 24))}
              placeholder={q.myClue ? `Il tuo indizio: ${q.myClue}` : 'Un indizio di UNA parola'}
              autoComplete="off"
              autoCapitalize="none"
              enterKeyHint="send"
              className="h-14 min-w-0 flex-1 rounded-2xl border-2 border-slate-700 bg-slate-950 px-4 text-xl font-bold text-white outline-none placeholder:text-slate-500 focus:border-amber-400"
            />
            <button type="submit" aria-label="Invia" className="grid h-14 w-16 place-items-center rounded-2xl bg-emerald-500 text-white">
              <Send size={22} />
            </button>
          </form>
          {q.myClue && <p className="pop text-center text-sm font-bold text-emerald-300">✓ Inviato: “{q.myClue}” (puoi ancora cambiarlo)</p>}
          <p className="text-center text-xs font-semibold text-slate-400">Occhio: se un altro scrive lo stesso indizio, si cancellano tutti e due!</p>
        </>
      )}
      {q.stage === 'CLUE' && iGuess && <p className="pop text-center text-lg font-bold text-slate-200">Gli altri stanno scrivendo gli indizi per te… niente sbirciate! 🙈</p>}
      {q.stage === 'CLUE' && waiting(q.written, 'Hanno scritto:')}

      {/* controllo degli indizi */}
      {q.stage === 'CHECK' && !iGuess && (
        <>
          <p className="text-center font-bold text-slate-200">Tocca gli indizi da bocciare (stessa famiglia di parole, plurali, traduzioni…)</p>
          {clueList('check')}
          {waiting(q.okBy, 'Hanno controllato:')}
        </>
      )}
      {q.stage === 'CHECK' && iGuess && <p className="pop text-center text-lg font-bold text-slate-200">Gli altri stanno controllando gli indizi… 🔍</p>}

      {/* indovinare */}
      {q.stage === 'GUESS' && (
        <>
          {clueList('show')}
          {iGuess ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send('MG_GUESS');
              }}
              className="flex gap-2"
            >
              <input
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 30))}
                placeholder="La parola è…"
                autoComplete="off"
                autoCapitalize="none"
                enterKeyHint="send"
                autoFocus
                className="h-14 min-w-0 flex-1 rounded-2xl border-2 border-slate-700 bg-slate-950 px-4 text-xl font-bold text-white outline-none placeholder:text-slate-500 focus:border-amber-400"
              />
              <button type="submit" aria-label="Rispondi" className="grid h-14 w-16 place-items-center rounded-2xl bg-emerald-500 text-white">
                <Send size={22} />
              </button>
            </form>
          ) : (
            <p className="text-center font-bold text-slate-200">{guesser?.name} sta pensando… 🤔</p>
          )}
        </>
      )}

      {/* risultato */}
      {q.stage === 'RESULT' && (
        <>
          <section
            className={`reveal-pop rounded-3xl border-4 border-white/90 p-5 text-center shadow-[0_8px_0_rgba(22,6,72,0.5)] ${
              q.result === 'OK' ? 'bg-linear-to-br from-emerald-400 to-teal-600' : q.result === 'KO' ? 'bg-linear-to-br from-rose-500 to-red-700' : 'bg-linear-to-br from-slate-500 to-slate-700'
            }`}
          >
            <p className="font-display text-3xl text-white">{q.result === 'OK' ? 'INDOVINATA! ✅' : q.result === 'KO' ? `SBAGLIATO: “${q.guess}”` : 'PASSATA ⏭️'}</p>
            <p className="mt-1 text-xs font-black uppercase tracking-widest text-white/80">La parola era</p>
            <p className="break-words font-display text-5xl uppercase text-white">{q.word}</p>
            {q.result === 'KO' && <p className="mt-1 text-sm font-bold text-white/90">Si brucia anche la prossima carta 🔥</p>}
          </section>
          {clueList('show')}
        </>
      )}

      <BottomBar>
        <div className="flex items-center gap-2">
          {q.stage === 'CHECK' && !iGuess && (
            <button
              type="button"
              disabled={q.okBy.includes(me)}
              onClick={() => onAction('MG_OK')}
              className="h-14 flex-1 rounded-2xl bg-emerald-500 text-lg font-black text-white disabled:opacity-50"
            >
              {q.okBy.includes(me) ? 'Fatto ✓' : 'Controllati, avanti!'}
            </button>
          )}
          {q.stage === 'GUESS' && iGuess && (
            <button type="button" onClick={() => onAction('MG_PASS')} className="h-14 flex-1 rounded-2xl bg-slate-700 text-lg font-black text-white">
              Passo ⏭️
            </button>
          )}
          {!(q.stage === 'CHECK' && !iGuess) && !(q.stage === 'GUESS' && iGuess) && (
            <p className="min-w-0 flex-1 truncate rounded-2xl border-2 border-slate-700 bg-slate-900/95 px-4 py-3 text-sm font-bold text-slate-200">
              {q.stage === 'CLUE' ? `Indizi: ${q.written.length}/${writersOnline}` : q.stage === 'RESULT' ? `Carte rimaste: ${q.left}` : 'Pensateci bene!'}
            </p>
          )}
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
