import { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { FastForward, Minus, Plus } from 'lucide-react';
import { ROSE_WIN_POINTS, type Disc, type RoseLog, type RoseView as RoseData } from '../../data/flat/rose';
import { useCountdown } from '../../hooks/useCountdown';
import { haptic, soundManager } from '../../utils/audio';
import { GameChip, Podium, TimerRing } from '../fx';
import { Avatar, BottomBar, EndBar, Ranking, type ModeProps } from '../ui';

// animazioni di questo gioco (sottobicchieri che cadono sulla pila, che si girano, il turno che pulsa)
const CSS = `
@keyframes rzFlip { 0% { transform: perspective(500px) rotateY(180deg) scale(.6); filter: brightness(.35) } 55% { transform: perspective(500px) rotateY(-14deg) scale(1.2); filter: brightness(1.25) } 100% { transform: perspective(500px) rotateY(0) scale(1); filter: none } }
.rz-flip { animation: rzFlip .8s cubic-bezier(.2,1.2,.4,1) both }
@keyframes rzDrop { 0% { transform: translateY(-30px) scale(1.25); opacity: 0 } 70% { transform: translateY(2px) scale(.97); opacity: 1 } 100% { transform: none } }
.rz-drop { animation: rzDrop .45s cubic-bezier(.2,1.3,.4,1) both }
@keyframes rzTurn { 0%,100% { box-shadow: 0 0 0 3px #fbbf24, 0 0 12px 2px rgba(251,191,36,.55) } 50% { box-shadow: 0 0 0 5px #fde68a, 0 0 24px 8px rgba(251,191,36,.85) } }
.rz-turn { animation: rzTurn 1.1s ease-in-out infinite; border-radius: 9999px }
@keyframes rzBid { 0% { transform: scale(2.4); opacity: 0 } 60% { transform: scale(.9); opacity: 1 } 100% { transform: scale(1) } }
.rz-bid { animation: rzBid .5s cubic-bezier(.2,1.4,.4,1) both }
@keyframes rzShake { 0%,100% { transform: none } 20% { transform: translateX(-7px) rotate(-3deg) } 40% { transform: translateX(7px) rotate(3deg) } 60% { transform: translateX(-4px) } 80% { transform: translateX(4px) } }
.rz-shake { animation: rzShake .5s ease-in-out 2 }
@keyframes rzPick { 0%,100% { box-shadow: 0 0 0 3px rgba(251,191,36,.9), 0 0 0 0 rgba(251,191,36,.6) } 50% { box-shadow: 0 0 0 3px rgba(251,191,36,.9), 0 0 0 10px rgba(251,191,36,0) } }
.rz-pick { animation: rzPick 1s ease-out infinite }
`;

const FACE_NAME: Record<Disc, string> = { R: 'una rosa', S: 'il teschio' };

// Sottobicchiere visto dall'alto: dorso (nel colore del giocatore, uguale per rose e teschi), rosa o teschio
function Coaster({ face, color = '#8b5cf6', size = 64, flip = false, className = '' }: { face: Disc | null; color?: string; size?: number; flip?: boolean; className?: string }) {
  const ring = Math.max(3, Math.round(size * 0.1));
  const dash = Math.max(1, Math.round(size * 0.03));
  const shadow = size >= 40 ? '0 4px 0 rgba(22,6,72,.55), inset 0 -3px 0 rgba(0,0,0,.25)' : '0 2px 0 rgba(22,6,72,.5)';
  const outer = face === null ? color : face === 'R' ? '#be123c' : '#18181b';
  const inner =
    face === null
      ? 'radial-gradient(circle at 32% 28%, rgba(255,255,255,.35), transparent 45%), repeating-radial-gradient(circle at 50% 50%, #c99a5f 0 2px, #b7864b 2px 4px)'
      : face === 'R'
        ? 'radial-gradient(circle at 35% 30%, #ffffff, #fff1e0 55%, #fcd9b8)'
        : 'radial-gradient(circle at 40% 35%, #4c1018, #1a0508 70%)';
  return (
    <span
      className={`relative grid shrink-0 place-items-center rounded-full ${flip ? 'rz-flip' : ''} ${className}`}
      style={{ width: size, height: size, background: outer, boxShadow: face === 'S' && size >= 40 ? `${shadow}, 0 0 18px rgba(239,68,68,.55)` : shadow }}
      aria-label={face === null ? 'disco coperto' : face === 'R' ? 'rosa' : 'teschio'}
    >
      <span
        className="absolute grid place-items-center rounded-full"
        style={{ inset: ring, background: inner, border: `${dash}px dashed ${face === 'S' ? 'rgba(239,68,68,.8)' : 'rgba(255,255,255,.6)'}` }}
      >
        {face === null ? (
          <span className="font-display leading-none text-white/90" style={{ fontSize: size * 0.32, textShadow: '0 2px 0 rgba(0,0,0,.3)' }}>
            ✶
          </span>
        ) : (
          <span className="leading-none" style={{ fontSize: size * 0.48, filter: 'drop-shadow(0 2px 1px rgba(0,0,0,.3))' }}>
            {face === 'R' ? '🌹' : '💀'}
          </span>
        )}
      </span>
    </span>
  );
}

// Pila di sottobicchieri vista di lato (quelli ancora coperti); quello in cima "cade" quando si aggiunge
function Pile({ n, color, w = 46, anim = true }: { n: number; color: string; w?: number; anim?: boolean }) {
  const h = Math.round(w * 0.32);
  return (
    <span className="relative block shrink-0" style={{ width: w, height: h + 3 * 6 + 5 }}>
      {n === 0 && <span className="absolute inset-x-0 bottom-1 rounded-[50%] border-2 border-dashed border-white/25" style={{ height: h }} />}
      {Array.from({ length: n }, (_, i) => (
        <span
          key={i === n - 1 ? `top-${n}` : i}
          className={`absolute left-0 rounded-[50%] ${anim && i === n - 1 ? 'rz-drop' : ''}`}
          style={{
            bottom: 4 + i * 6,
            width: w,
            height: h,
            background: `radial-gradient(ellipse at 50% 42%, #d9ac70 0 36%, #b98249 37% 44%, ${color} 46% 100%)`,
            boxShadow: '0 3px 0 rgba(22,6,72,.8), 0 5px 4px rgba(0,0,0,.35)',
          }}
        />
      ))}
    </span>
  );
}

// posto al tavolo: io sempre in basso, gli altri in cerchio
function seatPos(i: number, n: number) {
  const a = Math.PI / 2 + (i * 2 * Math.PI) / n;
  return { x: 50 + 37 * Math.cos(a), y: 50 + 36 * Math.sin(a) };
}

// 🌹 Rose e teschi: bluff con i sottobicchieri
export default function RoseView({ state, clockOffset, canLead, onAction, onNewGame, onBackToLobby, onForce }: ModeProps) {
  const q = state.mg as RoseData;
  const me = state.myId;
  const P = (id: string | null | undefined) => state.players.find((p) => p.id === id);
  const name = (id: string | null | undefined) => P(id)?.name ?? '?';
  const color = (id: string) => P(id)?.color ?? '#8b5cf6';
  const left = useCountdown(q.stage === 'END' ? null : q.stageEndsAt, clockOffset);
  const mine = q.me;
  const mySeat = q.seats[me];
  const playing = !!mine && !!mySeat && !mySeat.out;
  const myTurn = playing && q.turn === me;
  const mustPlace = playing && q.stage === 'PLACE' && !mySeat.placed;
  const needAct = mustPlace || (myTurn && (q.stage === 'PLAY' || q.stage === 'BID' || (q.stage === 'FLIP' && q.choosing)));
  const handR = mine?.hand.filter((d) => d === 'R').length ?? 0;
  const handS = mine?.hand.includes('S') ?? false;
  const minN = q.stage === 'BID' && q.bid ? q.bid.n + 1 : 1;
  const maxN = q.total;
  const [n, setN] = useState(1);
  const nv = Math.max(minN, Math.min(maxN, n)); // sempre un numero valido

  // proposta di partenza per la sfida/rilancio: nella sfida quanti dischi ho io, nell'asta il minimo rilancio
  useEffect(() => {
    if (!myTurn) return;
    if (q.stage === 'PLAY') setN(Math.max(1, Math.min(maxN, mine?.stack.length || 1)));
    if (q.stage === 'BID') setN(Math.min(maxN, minN));
  }, [myTurn, q.stage, q.bid?.n, q.total]);

  // tocca a me: suono e vibrazione
  useEffect(() => {
    if (!needAct) return;
    soundManager.playPop();
    haptic(60);
  }, [needAct, q.stage, q.round]);

  // suoni uguali per tutti
  useEffect(() => {
    if (q.stage === 'PLACE') soundManager.playWhoosh();
    if (q.stage === 'FLIP') soundManager.playDrumroll(1.2);
    if (q.stage === 'RESULT') {
      if (q.result?.kind === 'WIN') {
        soundManager.playSuccess();
        confetti({ particleCount: 70, spread: 70, origin: { y: 0.45 }, colors: ['#e11d48', '#fda4af', '#fde68a'] });
      } else if (q.result?.kind === 'SKULL') soundManager.playBoom();
    }
    if (q.stage === 'END') {
      soundManager.playVictory();
      confetti({ particleCount: 160, spread: 95, origin: { y: 0.35 } });
    }
  }, [q.stage, q.round]);
  useEffect(() => {
    if (q.stage === 'PLAY' && q.total > 0) soundManager.playClick();
  }, [q.total]);
  useEffect(() => {
    if (q.stage === 'FLIP' && q.flippedTotal > 0) soundManager.playReveal();
  }, [q.flippedTotal]);
  useEffect(() => {
    if (q.stage === 'BID') soundManager.playPop();
  }, [q.bid?.n, q.bid?.by]);

  const act = (type: string, payload?: unknown) => {
    onAction(type, payload);
    haptic(25);
  };

  // ---------------------------------------------------------------- fine partita
  if (q.stage === 'END') {
    const ranking = q.ranking ?? q.order;
    const winner = P(q.winner);
    return (
      <div className="stagger flex flex-col gap-4">
        <style>{CSS}</style>
        <section className="pop flex flex-col items-center gap-2 rounded-3xl border-4 border-white/90 bg-linear-to-br from-rose-500 to-red-800 p-5 text-center shadow-[0_8px_0_rgba(22,6,72,0.5)]">
          <p className="text-xs font-black uppercase tracking-widest text-rose-100">Il re del bluff</p>
          <div className="flex items-center gap-2">
            <Coaster face="R" size={46} flip />
            {winner && <Avatar avatar={winner.avatar} color={winner.color} size={84} />}
            <Coaster face="S" size={46} flip />
          </div>
          <p className="font-display text-4xl text-white [text-shadow:0_4px_0_rgba(0,0,0,0.25)]">{winner ? `${winner.name} vince!` : 'Fine partita'}</p>
          {winner && (
            <p className="text-sm font-bold text-rose-100">
              {(q.seats[winner.id]?.points ?? 0) >= ROSE_WIN_POINTS ? `${ROSE_WIN_POINTS} sfide vinte 🌹🌹` : 'Ultimo rimasto con dei dischi 🥏'}
            </p>
          )}
        </section>
        <Podium
          state={state}
          entries={ranking.map((id) => {
            const st = q.seats[id];
            return { id, value: id === q.winner ? '🏆 Vince' : st?.out ? '☠️ Fuori' : `🌹 ${st?.points ?? 0} · 🥏 ${st?.discs ?? 0}` };
          })}
        />
        <section className="rounded-3xl border-2 border-white/10 bg-slate-900 p-4">
          <Ranking state={state} scores={q.scores} />
        </section>
        <EndBar canLead={canLead} hostName={P(state.hostId)?.name} onNewGame={onNewGame} onBackToLobby={onBackToLobby} />
      </div>
    );
  }

  // ---------------------------------------------------------------- tavolo
  const meIdx = q.order.indexOf(me);
  const seatsOrder = meIdx >= 0 ? [...q.order.slice(meIdx), ...q.order.slice(0, meIdx)] : q.order;
  const choosingMe = q.stage === 'FLIP' && q.choosing && q.flipper === me;
  const pickable = (id: string) => choosingMe && id !== me && q.seats[id].stack - q.seats[id].flipped.length > 0;
  const turnP = P(q.turn);
  const placedCount = q.order.filter((id) => q.seats[id].placed).length;
  const aliveCount = q.order.filter((id) => !q.seats[id].out).length;
  const r = q.result;

  // cosa dire in alto: tocca a te / tocca a lui
  const headline = (() => {
    if (q.stage === 'PLACE') return mustPlace ? 'Tocca a te! Metti un disco coperto' : 'Tutti mettono un disco coperto…';
    if (q.stage === 'PLAY') return myTurn ? (mine?.hand.length ? 'Tocca a te! Aggiungi o sfida' : 'Tocca a te! Mani vuote: devi sfidare') : `Tocca a ${name(q.turn)}: aggiunge o sfida?`;
    if (q.stage === 'BID') return myTurn ? 'Tocca a te! Rilanci o passi?' : `Tocca a ${name(q.turn)}: rilancia o passa?`;
    if (q.stage === 'FLIP') return choosingMe ? 'Tocca a te! Scegli una pila da girare' : q.flipper === me ? 'Giri prima i tuoi dischi…' : `${name(q.flipper)} gira i dischi…`;
    return 'Fine della sfida';
  })();

  const logLine = (e: RoseLog) => {
    switch (e.k) {
      case 'round':
        return `🔄 Round ${e.n}: comincia ${name(e.by)}`;
      case 'add':
        return `🥏 ${name(e.by)} aggiunge un disco`;
      case 'challenge':
        return `🔥 ${name(e.by)} sfida: «ne giro ${e.n}!»`;
      case 'raise':
        return `⬆️ ${name(e.by)} rilancia: ${e.n}`;
      case 'pass':
        return `🏳️ ${name(e.by)} passa`;
      case 'flip':
        return `${e.disc === 'R' ? '🌹' : '💀'} ${name(e.by)} gira ${e.of === e.by ? 'un suo disco' : `un disco di ${name(e.of)}`}`;
      case 'win':
        return `🏆 ${name(e.by)} vince la sfida (${e.points}/${ROSE_WIN_POINTS})`;
      case 'skull':
        return `💀 ${name(e.by)} trova ${e.of === e.by ? 'il suo teschio' : `il teschio di ${name(e.of)}`}!`;
      case 'lose':
        return `💔 ${name(e.by)} perde un disco a caso (ne ${e.left === 1 ? 'resta 1' : `restano ${e.left}`})`;
      case 'out':
        return `☠️ ${name(e.by)} è eliminato`;
      case 'left':
        return `🚪 ${name(e.by)} è uscito dalla partita`;
      case 'void':
        return `↩️ Round annullato: ${name(e.by)} è uscito`;
      case 'auto':
        return `💤 ${name(e.by)} non risponde: mossa automatica`;
    }
  };

  // centro del tavolo: offerta, dischi girati, esito
  const center = (() => {
    if (q.stage === 'PLACE')
      return (
        <>
          <p className="text-[11px] font-black uppercase tracking-widest text-emerald-100/80">Round {q.round}</p>
          <p className="font-display text-xl leading-tight text-white">Dischi coperti</p>
          <p className="font-display text-4xl text-amber-300">
            {placedCount}
            <span className="text-xl text-white/70">/{aliveCount}</span>
          </p>
        </>
      );
    if (q.stage === 'PLAY')
      return (
        <>
          <p className="text-[11px] font-black uppercase tracking-widest text-emerald-100/80">Sul tavolo</p>
          <p key={q.total} className="pop font-display text-5xl leading-none text-white [text-shadow:0_3px_0_rgba(0,0,0,0.3)]">
            {q.total}
          </p>
          <p className="text-xs font-bold text-emerald-50/90">dischi coperti</p>
        </>
      );
    if (q.stage === 'BID' && q.bid)
      return (
        <>
          <p className="text-[11px] font-black uppercase tracking-widest text-emerald-100/80">Offerta più alta</p>
          <p key={`${q.bid.by}-${q.bid.n}`} className="rz-bid font-display text-6xl leading-none text-amber-300 [text-shadow:0_4px_0_rgba(0,0,0,0.35)]">
            {q.bid.n}
          </p>
          <p className="max-w-full truncate text-xs font-black text-white">
            {name(q.bid.by)} · su {q.total}
          </p>
        </>
      );
    if (q.stage === 'FLIP' && q.bid)
      return (
        <>
          <p className="max-w-full truncate text-[11px] font-black uppercase tracking-widest text-emerald-100/80">{name(q.flipper)} deve girare</p>
          <p className="font-display text-5xl leading-none text-white [text-shadow:0_3px_0_rgba(0,0,0,0.3)]">
            <span key={q.flippedTotal} className="pop inline-block text-amber-300">
              {q.flippedTotal}
            </span>
            <span className="text-2xl text-white/70">/{q.bid.n}</span>
          </p>
          <div className="mt-1 flex flex-wrap justify-center gap-0.5">
            {Array.from({ length: q.bid.n }, (_, i) => (
              <span key={i} className={`h-2.5 w-2.5 rounded-full ${i < q.flippedTotal ? 'bg-rose-500 ring-1 ring-white' : 'bg-white/25'}`} />
            ))}
          </div>
        </>
      );
    if (q.stage === 'RESULT' && r)
      return r.kind === 'VOID' ? (
        <p className="font-display text-2xl text-white">↩️ Annullato</p>
      ) : (
        <>
          <Coaster face={r.kind === 'WIN' ? 'R' : 'S'} size={64} flip className={r.kind === 'SKULL' ? 'rz-shake' : ''} />
          <p className={`mt-1 font-display text-xl leading-none ${r.kind === 'WIN' ? 'text-amber-300' : 'text-red-300'}`}>{r.kind === 'WIN' ? 'SOLO ROSE!' : 'TESCHIO!'}</p>
        </>
      );
    return null;
  })();

  return (
    <div className="stagger flex flex-col gap-3 pb-56">
      <style>{CSS}</style>
      <div className="flex items-center justify-between gap-2">
        <GameChip>
          🌹 Round {q.round} · {ROSE_WIN_POINTS} sfide per vincere
        </GameChip>
        <TimerRing left={left} total={Math.round(q.stageMs / 1000)} />
      </div>

      {/* di chi è il turno */}
      <div
        key={`${q.stage}-${q.turn}-${needAct}`}
        className={`pop flex items-center justify-center gap-2 rounded-2xl px-3 py-2.5 text-center ${
          needAct ? 'bg-amber-400 text-slate-950 shadow-[0_5px_0_rgba(22,6,72,0.5)]' : 'bg-slate-900/80 text-white'
        }`}
      >
        {!needAct && turnP && q.stage !== 'PLACE' && q.stage !== 'RESULT' && <Avatar avatar={turnP.avatar} color={turnP.color} size={28} />}
        <p className={`font-display leading-tight ${needAct ? 'text-2xl' : 'text-lg'}`}>{headline}</p>
      </div>

      {/* esito della sfida */}
      {q.stage === 'RESULT' && r && (
        <section
          className={`reveal-pop rounded-3xl border-4 border-white/90 p-4 text-center shadow-[0_8px_0_rgba(22,6,72,0.5)] ${
            r.kind === 'WIN' ? 'bg-linear-to-br from-rose-400 to-rose-700' : r.kind === 'SKULL' ? 'bg-linear-to-br from-zinc-700 to-black' : 'bg-linear-to-br from-slate-500 to-slate-700'
          }`}
        >
          {r.kind === 'WIN' && (
            <>
              <p className="font-display text-3xl text-white">🌹 Sfida vinta!</p>
              <p className="mt-1 font-bold text-white">
                {name(r.flipper)} ha girato solo rose: {r.points}/{ROSE_WIN_POINTS}
                {q.winner === r.flipper ? ' e vince la partita! 🏆' : ''}
              </p>
            </>
          )}
          {r.kind === 'SKULL' && (
            <>
              <p className="font-display text-3xl text-red-400">💀 TESCHIO!</p>
              <p className="mt-1 font-bold text-white">
                {name(r.flipper)} ha girato {r.of === r.flipper ? 'il suo stesso teschio' : `il teschio di ${name(r.of)}`} e perde un disco a caso
              </p>
              {mine?.lost && (
                <p className="mt-2 rounded-2xl bg-white/10 p-2 text-sm font-black text-amber-200">
                  Hai perso {FACE_NAME[mine.lost]} {mine.lost === 'S' ? '💀: ora hai solo rose (ma gli altri non lo sanno 🤫)' : '🌹 (solo tu sai quale)'}
                </p>
              )}
              {r.out && <p className="mt-1 font-display text-xl text-red-300">☠️ {name(r.flipper)} è eliminato!</p>}
            </>
          )}
          {r.kind === 'VOID' && <p className="font-display text-2xl text-white">Round annullato: {name(r.flipper)} è uscito</p>}
          {!q.winner && <p className="mt-2 text-xs font-black uppercase tracking-wider text-white/80">Il prossimo round comincia {name(q.starter)}</p>}
        </section>
      )}

      {/* il tavolo del bar, con i giocatori in cerchio */}
      <section className="relative mx-auto h-[400px] w-full max-w-[400px]">
        <div
          className="absolute inset-x-[15%] inset-y-[22%] rounded-[50%] border-[10px] border-[#7c4a21] shadow-[inset_0_6px_18px_rgba(0,0,0,0.55),0_8px_0_rgba(22,6,72,0.5)]"
          style={{ background: 'radial-gradient(ellipse at 50% 38%, #2f8a55, #1b5234 72%)' }}
        />
        <div className="absolute left-1/2 top-1/2 flex w-[40%] -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center">{center}</div>
        {seatsOrder.map((id, i) => {
          const p = P(id);
          const st = q.seats[id];
          if (!st) return null;
          const { x, y } = seatPos(i, seatsOrder.length);
          const covered = st.stack - st.flipped.length;
          const isTurn = q.turn === id && q.stage !== 'RESULT';
          const canPick = pickable(id);
          return (
            <button
              key={id}
              type="button"
              disabled={!canPick}
              onClick={() => act('MG_FLIP', { of: id })}
              className={`absolute flex w-[90px] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 rounded-2xl p-1 disabled:cursor-default ${st.out ? 'opacity-40 grayscale' : ''} ${
                canPick ? 'rz-pick bg-amber-400/20' : ''
              } ${r?.kind === 'SKULL' && r.of === id ? 'bg-red-500/30' : ''}`}
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <span className="relative">
                <span className={`block ${isTurn ? 'rz-turn' : ''}`}>{p ? <Avatar avatar={p.avatar} color={p.color} size={38} /> : <span className="block h-[38px] w-[38px]" />}</span>
                {st.afk && <span className="absolute -left-2 -top-1 text-sm">💤</span>}
                {q.stage === 'PLACE' && st.placed && (
                  <span className="pop absolute -right-1.5 -top-1 grid h-5 w-5 place-items-center rounded-full bg-emerald-500 text-[11px] font-black text-white">✓</span>
                )}
                {q.stage === 'BID' && st.passed && (
                  <span className="absolute -right-4 -top-1 rounded-full bg-slate-700 px-1.5 text-[9px] font-black uppercase text-slate-200">passa</span>
                )}
                {st.out && <span className="absolute inset-0 grid place-items-center text-2xl">☠️</span>}
              </span>
              <span className="max-w-full truncate text-[11px] font-black leading-tight text-white">
                {id === me ? 'Tu' : (p?.name ?? '?')}
                {Array.from({ length: ROSE_WIN_POINTS }, (_, k) => (
                  <span key={k} className={k < st.points ? '' : 'opacity-25 grayscale'}>
                    🌹
                  </span>
                ))}
              </span>
              <span className="flex items-end justify-center gap-0.5">
                <Pile n={covered} color={color(id)} w={st.flipped.length ? 38 : 46} anim={q.stage === 'PLACE' || q.stage === 'PLAY'} />
                {st.flipped.length > 0 && (
                  <span className="flex flex-wrap justify-center gap-0.5" style={{ maxWidth: 46 }}>
                    {st.flipped.map((d, k) => (
                      <Coaster key={k} face={d} size={20} flip />
                    ))}
                  </span>
                )}
              </span>
              {/* dischi: pieni = in mano, vuoti = sul tavolo, x = persi */}
              <span className="flex items-center gap-[3px]">
                {Array.from({ length: 4 }, (_, k) => (
                  <span
                    key={k}
                    className={`grid h-2.5 w-2.5 place-items-center rounded-full text-[8px] font-black leading-none ${
                      k < st.hand ? '' : k < st.discs ? 'border-2' : 'text-red-400'
                    }`}
                    style={k < st.hand ? { background: color(id), boxShadow: '0 0 0 1px rgba(255,255,255,.7)' } : k < st.discs ? { borderColor: color(id) } : undefined}
                  >
                    {k >= st.discs ? '✕' : ''}
                  </span>
                ))}
              </span>
            </button>
          );
        })}
      </section>

      {/* i miei dischi: li vedo solo io */}
      {playing && mine && (
        <section className="rounded-3xl border-2 border-white/10 bg-slate-900 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-black text-slate-200">I tuoi dischi in mano</p>
            <p className="text-[11px] font-bold text-slate-400">solo tu li vedi 🤫</p>
          </div>
          <div className="mt-2 flex min-h-[64px] items-center justify-center gap-2">
            {mine.hand.length === 0 && <p className="text-sm font-bold text-slate-400">Nessun disco in mano: puoi solo sfidare</p>}
            {mine.hand.map((d, i) => {
              const canUse = mustPlace || (myTurn && q.stage === 'PLAY');
              return (
                <button
                  key={`${d}-${i}`}
                  type="button"
                  disabled={!canUse}
                  onClick={() => act(mustPlace ? 'MG_PLACE' : 'MG_ADD', { disc: d })}
                  className={`rounded-full transition-transform disabled:opacity-100 ${canUse ? 'active:scale-90' : ''}`}
                  aria-label={d === 'R' ? 'Metti una rosa' : 'Metti il teschio'}
                >
                  <Coaster face={d} size={58} className={canUse ? 'hover:-translate-y-1' : ''} />
                </button>
              );
            })}
          </div>
          {mine.stack.length > 0 && (
            <div className="mt-3 flex items-center justify-center gap-2 border-t border-white/10 pt-2">
              <p className="text-xs font-bold text-slate-400">La tua pila (dal basso):</p>
              {mine.stack.map((d, i) => (
                <span key={i} className="relative">
                  <Coaster face={d} size={28} />
                  {i < mine.stack.length - (mySeat?.flipped.length ?? 0) ? null : <span className="absolute -bottom-1 -right-1 text-[10px]">👁️</span>}
                </span>
              ))}
            </div>
          )}
        </section>
      )}
      {!playing && mine && mySeat?.out && <p className="text-center font-bold text-slate-300">☠️ Sei fuori: goditi lo spettacolo (e i bluff degli altri)</p>}

      {/* asta di questo round */}
      {(q.stage === 'BID' || q.stage === 'FLIP') && q.bids.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1.5">
          {q.bids.map((b, i) => (
            <span key={i} className="pop rounded-full bg-slate-900/80 px-2.5 py-0.5 text-xs font-bold text-slate-200">
              {name(b.by)}: <span className="font-display text-sm text-amber-300">{b.n}</span>
            </span>
          ))}
        </div>
      )}

      {/* cronaca */}
      {q.log.length > 0 && (
        <section className="rounded-3xl border-2 border-white/10 bg-slate-900/80 p-3">
          <p className="mb-1.5 text-xs font-black uppercase tracking-widest text-slate-400">Cronaca</p>
          <ul className="flex flex-col gap-1">
            {[...q.log]
              .reverse()
              .slice(0, 6)
              .map((e, i) => (
                <li key={q.logNo - i} className={`feed-in truncate text-sm font-bold ${i === 0 ? 'text-white' : 'text-slate-400'}`}>
                  {logLine(e)}
                </li>
              ))}
          </ul>
        </section>
      )}

      <BottomBar>
        {mustPlace && (
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={!handR} onClick={() => act('MG_PLACE', { disc: 'R' })} className="flex h-16 items-center justify-center gap-2 rounded-2xl bg-rose-600 px-2 text-base font-black leading-tight text-white disabled:opacity-40">
              <Coaster face="R" size={34} /> Metti una rosa
            </button>
            <button type="button" disabled={!handS} onClick={() => act('MG_PLACE', { disc: 'S' })} className="flex h-16 items-center justify-center gap-2 rounded-2xl bg-zinc-800 px-2 text-base font-black leading-tight text-white ring-2 ring-red-500/70 disabled:opacity-40">
              <Coaster face="S" size={34} /> Metti il teschio
            </button>
          </div>
        )}

        {myTurn && q.stage === 'PLAY' && (
          <>
            {mine && mine.hand.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                <button type="button" disabled={!handR} onClick={() => act('MG_ADD', { disc: 'R' })} className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-rose-600 text-sm font-black text-white disabled:opacity-40">
                  <Coaster face="R" size={30} /> Aggiungi rosa
                </button>
                <button type="button" disabled={!handS} onClick={() => act('MG_ADD', { disc: 'S' })} className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-zinc-800 text-sm font-black text-white ring-2 ring-red-500/70 disabled:opacity-40">
                  <Coaster face="S" size={30} /> Aggiungi teschio
                </button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Stepper value={nv} min={1} max={maxN} onChange={setN} />
              <button type="button" onClick={() => act('MG_CHALLENGE', { n: nv })} className="shine h-16 flex-1 rounded-2xl bg-amber-400 text-lg font-black leading-tight text-slate-950">
                🔥 SFIDA: ne giro {nv}!
              </button>
            </div>
          </>
        )}

        {myTurn && q.stage === 'BID' && (
          <div className="flex items-center gap-2">
            <Stepper value={nv} min={minN} max={maxN} onChange={setN} />
            <button type="button" onClick={() => act('MG_PASS')} className="h-16 rounded-2xl bg-slate-700 px-3 text-base font-black text-white">
              Passo 🏳️
            </button>
            <button type="button" disabled={minN > maxN} onClick={() => act('MG_RAISE', { n: nv })} className="h-16 flex-1 rounded-2xl bg-amber-400 text-lg font-black leading-tight text-slate-950 disabled:opacity-40">
              Rilancio {n}
            </button>
          </div>
        )}

        {choosingMe && (
          <div className="flex flex-col gap-2">
            <p className="text-center text-sm font-bold text-amber-200">Tocca una pila sul tavolo (o qui sotto): giri il disco in cima</p>
            <div className="grid grid-cols-3 gap-2">
              {q.order
                .filter((id) => pickable(id))
                .map((id) => {
                  const p = P(id);
                  return (
                    <button key={id} type="button" onClick={() => act('MG_FLIP', { of: id })} className="flex h-14 items-center gap-1.5 rounded-2xl bg-slate-800 px-2 text-left text-xs font-black text-white ring-2 ring-amber-400/70">
                      {p && <Avatar avatar={p.avatar} color={p.color} size={28} />}
                      <span className="min-w-0 flex-1 truncate">
                        {p?.name ?? '?'}
                        <span className="block text-[10px] text-amber-300">🥏 {q.seats[id].stack - q.seats[id].flipped.length}</span>
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
        )}

        {!needAct && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-slate-700 bg-slate-900/95 px-4 py-3 text-sm font-bold text-slate-200">
            <span className="min-w-0 truncate">
              {q.stage === 'PLACE'
                ? `Dischi messi: ${placedCount}/${aliveCount}`
                : q.stage === 'RESULT'
                  ? q.winner
                    ? 'Classifica tra poco…'
                    : 'Nuovo round tra poco…'
                  : q.stage === 'FLIP'
                    ? `${name(q.flipper)} deve girare ${q.bid?.n ?? '?'} dischi senza teschi`
                    : headline}
            </span>
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

// numero grande con − e + (sfida e rilanci)
function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (n: number) => void }) {
  const v = Math.max(min, Math.min(max, value));
  return (
    <div className="flex h-16 items-center gap-1 rounded-2xl bg-slate-900 px-1 ring-2 ring-slate-700">
      <button type="button" disabled={v <= min} onClick={() => onChange(v - 1)} aria-label="Meno" className="grid h-12 w-10 place-items-center rounded-xl bg-slate-700 text-white disabled:opacity-30">
        <Minus size={20} />
      </button>
      <span key={v} className="pop w-11 text-center font-display text-4xl leading-none text-amber-300">
        {v}
      </span>
      <button type="button" disabled={v >= max} onClick={() => onChange(v + 1)} aria-label="Più" className="grid h-12 w-10 place-items-center rounded-xl bg-slate-700 text-white disabled:opacity-30">
        <Plus size={20} />
      </button>
    </div>
  );
}
