import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { Check, FastForward } from 'lucide-react';
import type { MenteView as MenteData } from '../../data/flat/mente';
import { useCountdown } from '../../hooks/useCountdown';
import { haptic, soundManager } from '../../utils/audio';
import { GameChip, TimerRing } from '../fx';
import { Avatar, BottomBar, EndBar, type ModeProps } from '../ui';

// una carta coi numeri (bianca e grande sulla pila, piccola in mano)
function Card({ n, size = 'sm', dim = false, hot = false, bad = false }: { n: number; size?: 'sm' | 'md' | 'xl'; dim?: boolean; hot?: boolean; bad?: boolean }) {
  const dims = size === 'xl' ? 'h-56 w-40 rounded-[1.6rem] text-[6.5rem]' : size === 'md' ? 'h-20 w-14 rounded-xl text-3xl' : 'h-9 w-7 rounded-md text-sm';
  return (
    <span
      className={`relative grid shrink-0 place-items-center border-4 font-display leading-none shadow-[0_5px_0_rgba(22,6,72,0.5)] transition-transform ${dims} ${
        bad ? 'border-rose-400 bg-rose-100 text-rose-600' : hot ? 'border-amber-300 bg-white text-slate-950' : 'border-white/90 bg-white text-slate-950'
      } ${dim ? 'opacity-40' : ''}`}
    >
      {size === 'xl' && <span className="absolute left-3 top-2 text-lg text-slate-400">{n}</span>}
      {n}
      {size === 'xl' && <span className="absolute bottom-2 right-3 rotate-180 text-lg text-slate-400">{n}</span>}
    </span>
  );
}

// secondi che mancano, senza tic-tac (per la proposta di stellina)
function useQuietLeft(endsAt: number | null, offset: number) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!endsAt) {
      setLeft(null);
      return;
    }
    const tick = () => setLeft(Math.max(0, Math.ceil((endsAt - (Date.now() + offset)) / 1000)));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [endsAt, offset]);
  return left;
}

// 🧠 Mente unica: tutti insieme, in silenzio, le carte in ordine crescente
export default function MenteView({ state, clockOffset, canLead, onAction, onNewGame, onBackToLobby, onForce }: ModeProps) {
  const q = state.mg as MenteData;
  const me = state.myId;
  const P = (id: string) => state.players.find((p) => p.id === id);
  const timed = q.stage === 'READY' || q.stage === 'PLAY';
  const left = useCountdown(timed ? q.stageEndsAt : null, clockOffset);
  const starLeft = useQuietLeft(q.starVote ? q.starVote.endsAt : null, clockOffset);
  const mine = q.myCards ?? [];
  const lowest = mine[0];
  const players = q.order.filter((id) => !q.gone.includes(id));
  // la mia giocata è partita: il pulsante si blocca finché il server non risponde (niente doppie giocate)
  const [pending, setPending] = useState<number | null>(null);
  const lastTop = useRef<number | null>(q.top);

  useEffect(() => setPending(null), [lowest, q.stage, q.eventNo]);
  useEffect(() => {
    if (pending === null) return;
    const t = setTimeout(() => setPending(null), 1500);
    return () => clearTimeout(t);
  }, [pending]);

  // suoni uguali per tutti
  useEffect(() => {
    if (q.top !== null && q.top !== lastTop.current) soundManager.playPop();
    lastTop.current = q.top;
  }, [q.top]);
  useEffect(() => {
    if (!q.event || q.stage === 'READY') return;
    if (q.event.kind === 'oops' || q.event.kind === 'idle') soundManager.playError();
    else if (q.event.kind === 'star') soundManager.playReveal();
  }, [q.eventNo]);
  useEffect(() => {
    if (q.stage === 'PLAY' && !q.event) soundManager.playStart();
    if (q.stage === 'CLEAR') {
      soundManager.playSuccess();
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.4 } });
    }
    if (q.stage === 'END') {
      if (q.result === 'WIN') {
        soundManager.playVictory();
        confetti({ particleCount: 180, spread: 100, origin: { y: 0.35 } });
      } else soundManager.playBoom();
    }
  }, [q.stage, q.level]);
  useEffect(() => {
    if (q.starVote) soundManager.playClick();
  }, [!!q.starVote]);

  const hearts = (
    <span key={q.lives} className="pop flex items-center gap-0.5 text-lg" aria-label={`${q.lives} vite`}>
      {q.lives > 0 ? Array.from({ length: q.lives }, (_, i) => <span key={i}>❤️</span>) : <span>🖤</span>}
    </span>
  );
  const starsChip = (
    <span className="rounded-full bg-slate-900 px-2.5 py-1 text-sm font-black text-amber-300 shadow-[0_4px_0_rgba(22,6,72,0.4)]" aria-label={`${q.stars} stelline`}>
      ⭐ {q.stars}
    </span>
  );

  const leadButton = (label: string) =>
    canLead && (
      <button type="button" onClick={onForce} className="flex h-14 shrink-0 items-center gap-1 rounded-2xl bg-slate-800 px-3 text-xs font-black leading-tight text-amber-200">
        <FastForward size={16} /> {label}
      </button>
    );

  // ---------------------------------------------------------------- fine partita
  if (q.stage === 'END') {
    const win = q.result === 'WIN';
    return (
      <div className="stagger flex flex-col gap-4">
        <section
          className={`pop rounded-3xl border-4 border-white/90 p-6 text-center shadow-[0_8px_0_rgba(22,6,72,0.5)] ${
            win ? 'bg-linear-to-br from-amber-300 via-orange-400 to-pink-500' : 'bg-linear-to-br from-slate-600 to-slate-900'
          }`}
        >
          <p className="text-6xl">{win ? '🧠✨' : '💀'}</p>
          <p className="mt-2 font-display text-4xl leading-tight text-white [text-shadow:0_3px_0_rgba(0,0,0,0.25)]">{win ? 'Una mente sola!' : 'Vite finite'}</p>
          <p className="mt-1 text-lg font-black text-white/90">
            {win ? `Avete superato tutti i ${q.maxLevel} livelli` : `Siete arrivati al livello ${q.level} di ${q.maxLevel}`}
          </p>
          <p className="mt-2 text-sm font-bold text-white/75">
            Errori: {q.mistakes} · Stelline rimaste: {q.stars}
          </p>
        </section>
        {q.event && !win && (
          <p className="pop text-center text-sm font-bold text-rose-300">
            L’ultimo errore: {P(q.event.by ?? '')?.name ?? '?'} ha giocato il {q.event.card}
          </p>
        )}
        {q.reveal && Object.values(q.reveal).some((h) => h.length) && (
          <section className="flex flex-col gap-1.5 rounded-3xl border-2 border-white/10 bg-slate-900 p-3">
            <p className="text-center text-xs font-black uppercase tracking-widest text-slate-400">Le carte rimaste in mano</p>
            {Object.entries(q.reveal).map(([id, cards]) => {
              const p = P(id);
              if (!p || !cards.length) return null;
              return (
                <p key={id} className="flex items-center gap-2 rounded-2xl bg-slate-800 p-2">
                  <Avatar avatar={p.avatar} color={p.color} size={28} />
                  <span className="w-20 truncate text-sm font-bold text-white">{p.name}</span>
                  <span className="flex flex-wrap gap-1">
                    {cards.map((c) => (
                      <Card key={c} n={c} />
                    ))}
                  </span>
                </p>
              );
            })}
          </section>
        )}
        <EndBar canLead={canLead} hostName={P(state.hostId)?.name} onNewGame={onNewGame} onBackToLobby={onBackToLobby} />
      </div>
    );
  }

  const ev = q.event;
  const evBy = ev?.by ? P(ev.by) : null;
  const iPlay = !!q.myCards;
  const iReady = q.ready.includes(me);
  const iVoted = !!q.starVote?.yes.includes(me);
  const canPlay = q.stage === 'PLAY' && lowest !== undefined && pending === null;
  const idleWarning = q.stage === 'PLAY' && left !== null && left <= 20;

  // chi ha ancora carte (e quante)
  const table = (
    <div className="flex flex-wrap items-start justify-center gap-x-3 gap-y-2">
      {players.map((id) => {
        const p = P(id);
        if (!p) return null;
        const n = q.counts[id] ?? 0;
        const justPlayed = q.topBy === id && q.stage === 'PLAY';
        return (
          <div key={id} className={`flex w-14 flex-col items-center gap-1 ${n === 0 && q.stage !== 'READY' ? 'opacity-45' : ''}`}>
            <span className={`relative rounded-full ${justPlayed ? 'ring-4 ring-amber-300' : ''}`}>
              <Avatar avatar={p.avatar} color={p.color} size={40} />
              {q.stage === 'READY' && q.ready.includes(id) && (
                <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-emerald-500 text-white">
                  <Check size={13} strokeWidth={4} />
                </span>
              )}
              {q.starVote?.yes.includes(id) && <span className="absolute -right-1 -top-1 text-base">⭐</span>}
            </span>
            <span className="max-w-full truncate text-[11px] font-bold text-slate-300">{id === me ? 'Tu' : p.name}</span>
            {/* il dorso delle carte in mano */}
            <span className="flex h-5 items-center">
              {n === 0 ? (
                <span className="text-[11px] font-black text-emerald-300">finite ✓</span>
              ) : (
                Array.from({ length: Math.min(n, 6) }, (_, k) => (
                  <span key={k} className="-ml-1.5 h-5 w-3.5 rounded-[3px] border border-white/70 bg-linear-to-br from-violet-500 to-indigo-700 first:ml-0" />
                ))
              )}
              {n > 6 && <span className="ml-0.5 text-[10px] font-black text-slate-300">+{n - 6}</span>}
            </span>
          </div>
        );
      })}
    </div>
  );

  // la pila: l'ultima carta giocata, grande
  const pile = (
    <div className="flex flex-col items-center gap-2">
      <div className="relative grid h-60 place-items-center">
        {q.top === null ? (
          <span className="grid h-56 w-40 place-items-center rounded-[1.6rem] border-4 border-dashed border-white/25 p-3 text-center text-sm font-bold text-slate-400">
            {q.stage === 'READY' ? 'Concentratevi…' : 'Chi ha la carta più bassa?'}
          </span>
        ) : (
          <span key={q.top} className="reveal-pop">
            <Card n={q.top} size="xl" bad={q.trail[q.trail.length - 1]?.bad} />
          </span>
        )}
      </div>
      {q.topBy && q.top !== null && (
        <p className="text-sm font-bold text-slate-300">
          giocata da {q.topBy === me ? 'te' : P(q.topBy)?.name ?? '?'}
        </p>
      )}
      {q.trail.length > 1 && (
        <p className="flex flex-wrap items-center justify-center gap-1 text-sm font-black">
          {q.trail.slice(0, -1).map((t, k) => (
            <span key={`${t.card}-${k}`} className={t.bad ? 'text-rose-400 line-through' : 'text-slate-500'}>
              {t.card}
              {k < q.trail.length - 2 ? ' ›' : ''}
            </span>
          ))}
        </p>
      )}
      <div className="h-2 w-48 overflow-hidden rounded-full bg-slate-800">
        <div className="h-full rounded-full bg-amber-400 transition-all duration-500" style={{ width: `${q.total ? (q.played / q.total) * 100 : 0}%` }} />
      </div>
      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
        {q.played}/{q.total} carte
      </p>
    </div>
  );

  // cosa è appena successo (errore, stellina, silenzio, uscita)
  const eventBox =
    ev && q.stage === 'PAUSE' ? (
      <section
        key={q.eventNo}
        className={`pop rounded-3xl border-4 border-white/90 p-3 text-center shadow-[0_6px_0_rgba(22,6,72,0.5)] ${
          ev.kind === 'star' ? 'bg-linear-to-br from-amber-300 to-orange-500' : ev.kind === 'leave' ? 'bg-linear-to-br from-slate-500 to-slate-700' : 'bg-linear-to-br from-rose-500 to-red-700'
        }`}
      >
        <p className="font-display text-2xl leading-tight text-white">
          {ev.kind === 'oops'
            ? `💥 ${ev.by === me ? 'Hai' : `${evBy?.name ?? '?'} ha`} giocato il ${ev.card}…`
            : ev.kind === 'idle'
              ? `⏰ Troppo silenzio! Il ${ev.card} è andato in tavola da solo`
              : ev.kind === 'star'
                ? '⭐ Stellina! Tutti scartano la più bassa'
                : `🚪 ${evBy?.name ?? 'Qualcuno'} è uscito`}
        </p>
        <div className="mt-2 flex flex-col gap-1">
          {ev.lost.map((l) => {
            const p = P(l.id);
            return (
              <p key={l.id} className="flex items-center justify-center gap-2 text-sm font-black text-white">
                {p && <Avatar avatar={p.avatar} color={p.color} size={24} />}
                <span>{l.id === me ? 'Tu avevi' : `${p?.name ?? '?'} aveva`}</span>
                <span className="flex gap-1">
                  {l.cards.map((c) => (
                    <Card key={c} n={c} bad={ev.kind !== 'star' && ev.kind !== 'leave'} />
                  ))}
                </span>
              </p>
            );
          })}
        </div>
        {(ev.kind === 'oops' || ev.kind === 'idle') && <p className="mt-2 text-sm font-black text-white/90">−1 ❤️ · si riparte tra un attimo</p>}
      </section>
    ) : null;

  // ---------------------------------------------------------------- livello superato
  if (q.stage === 'CLEAR') {
    return (
      <div className="stagger flex flex-col items-center gap-5 pb-32 pt-4">
        <div className="flex w-full items-center justify-between gap-2">
          <GameChip>🧠 Livello {q.level}/{q.maxLevel}</GameChip>
          {hearts}
          {starsChip}
        </div>
        <p className="reveal-pop text-7xl">🎉</p>
        <h2 className="pop text-center font-display text-4xl leading-tight text-white">Livello {q.level} superato!</h2>
        {q.reward && (
          <p className="reveal-pop rounded-2xl bg-slate-900 px-5 py-3 text-center text-xl font-black text-amber-300">
            🎁 Premio: {q.reward === 'life' ? '+1 ❤️' : '+1 ⭐'}
            {q.rewardWasted && <span className="block text-xs font-bold text-slate-400">(eravate già al massimo)</span>}
          </p>
        )}
        <p className="text-center font-bold text-slate-300">
          Prossimo: livello {q.level + 1}, {q.level + 1} carte a testa 🃏
        </p>
        <BottomBar>
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate rounded-2xl border-2 border-slate-700 bg-slate-900/95 px-4 py-3 text-sm font-bold text-slate-200">Si distribuiscono le carte…</p>
            {leadButton('Avanti')}
          </div>
        </BottomBar>
      </div>
    );
  }

  return (
    <div className="stagger flex flex-col gap-4 pb-44">
      <div className="flex items-center justify-between gap-2">
        <GameChip>🧠 Livello {q.level}/{q.maxLevel}</GameChip>
        {hearts}
        {starsChip}
        {(q.stage === 'READY' || idleWarning) && <TimerRing left={left} total={q.stage === 'READY' ? 30 : 20} size={48} />}
      </div>

      <p className="text-center text-sm font-bold text-slate-300">
        {q.stage === 'READY'
          ? 'Guardate le vostre carte, respirate… e toccate PRONTO.'
          : q.stage === 'PAUSE'
            ? 'Fermi tutti! Guardate cosa è successo…'
            : idleWarning
              ? `⏳ Troppo silenzio: tra ${left} s la carta più bassa va in tavola da sola (−1 ❤️)`
              : 'Niente turni, niente parole: gioca quando senti che è il momento.'}
      </p>

      {table}
      {eventBox}
      {!eventBox && pile}

      {/* proposta di stellina */}
      {q.starVote && q.stage === 'PLAY' && (
        <section className="pop rounded-3xl border-4 border-amber-300 bg-slate-900 p-3 text-center">
          <p className="font-black text-amber-200">
            ⭐ {q.starVote.by === me ? 'Hai proposto' : `${P(q.starVote.by)?.name ?? '?'} propone`} una stellina
          </p>
          <p className="text-xs font-bold text-slate-300">
            Se accettano tutti, ognuno scarta la sua carta più bassa · {q.starVote.yes.length}/{players.length} sì · {starLeft ?? 0} s
          </p>
          {iPlay && !iVoted && (
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  onAction('MG_STAR_YES');
                  haptic(20);
                }}
                className="h-12 flex-1 rounded-2xl bg-amber-400 font-black text-slate-950"
              >
                Sì, usiamola ⭐
              </button>
              <button type="button" onClick={() => onAction('MG_STAR_NO')} className="h-12 flex-1 rounded-2xl bg-slate-700 font-black text-white">
                No
              </button>
            </div>
          )}
        </section>
      )}

      {/* le mie carte */}
      {iPlay ? (
        <section className="rounded-3xl border-2 border-white/10 bg-slate-900/80 p-3">
          <p className="mb-2 text-center text-[11px] font-black uppercase tracking-widest text-slate-400">Le tue carte</p>
          {mine.length ? (
            <div className="flex flex-wrap items-end justify-center gap-1.5">
              {mine.map((c, k) => (
                <span key={c} className={k === 0 ? 'pop' : ''}>
                  <Card n={c} size={k === 0 ? 'md' : 'sm'} hot={k === 0} dim={pending === c} />
                </span>
              ))}
            </div>
          ) : (
            <p className="text-center font-bold text-emerald-300">Hai giocato tutte le tue carte: ora tifate in silenzio 🤫</p>
          )}
        </section>
      ) : (
        <p className="text-center font-bold text-slate-400">👀 Stai guardando la partita</p>
      )}

      <BottomBar>
        <div className="flex items-center gap-2">
          {q.stage === 'READY' && iPlay && (
            <button
              type="button"
              disabled={iReady}
              onClick={() => {
                onAction('MG_READY');
                haptic(25);
              }}
              className={`h-16 flex-1 rounded-2xl text-xl font-black ${iReady ? 'bg-slate-800 text-slate-300' : 'shine bg-emerald-500 text-white'}`}
            >
              {iReady ? `Pronto ✓ (${q.ready.length}/${players.length})` : '✋ PRONTO'}
            </button>
          )}
          {q.stage !== 'READY' && iPlay && lowest !== undefined && (
            <>
              <button
                type="button"
                disabled={!canPlay}
                onClick={() => {
                  if (lowest === undefined) return;
                  setPending(lowest);
                  onAction('MG_PLAY', { card: lowest });
                  haptic(35);
                }}
                className="h-20 flex-1 rounded-2xl bg-linear-to-br from-orange-400 to-rose-600 font-display text-3xl text-white shadow-[0_6px_0_rgba(22,6,72,0.5)] transition-transform active:scale-95 disabled:from-slate-600 disabled:to-slate-700 disabled:text-slate-300"
              >
                {q.stage === 'PAUSE' ? 'Aspetta…' : `GIOCA ${lowest}`}
              </button>
              {q.stars > 0 && (
                <button
                  type="button"
                  disabled={q.stage !== 'PLAY' || !!q.starVote}
                  onClick={() => onAction('MG_STAR')}
                  aria-label="Proponi una stellina"
                  className="flex h-20 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-slate-800 text-amber-300 disabled:opacity-40"
                >
                  <span className="text-2xl">⭐</span>
                  <span className="text-[10px] font-black leading-tight">Proponi</span>
                </button>
              )}
            </>
          )}
          {(!iPlay || (q.stage !== 'READY' && lowest === undefined)) && (
            <p className="min-w-0 flex-1 truncate rounded-2xl border-2 border-slate-700 bg-slate-900/95 px-4 py-3 text-sm font-bold text-slate-200">
              {q.stage === 'READY' ? `Pronti: ${q.ready.length}/${players.length}` : 'Silenzio in sala… 🤫'}
            </p>
          )}
          {/* in gioco lo sblocco costa una vita: si vede solo se qualcuno è sparito o c'è troppo silenzio */}
          {q.stage !== 'PLAY'
            ? leadButton(q.stage === 'READY' ? 'Via!' : 'Avanti')
            : (idleWarning || players.some((id) => (q.counts[id] ?? 0) > 0 && !P(id)?.isOnline)) && leadButton('Sblocca −1❤️')}
        </div>
      </BottomBar>
    </div>
  );
}
