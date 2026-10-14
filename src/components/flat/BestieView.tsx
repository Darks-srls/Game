import { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { motion } from 'motion/react';
import { FastForward } from 'lucide-react';
import { BEASTS, BESTIE_LOSE_AT, beastInfo, type Beast, type BestieLog, type BestieView as BestieData } from '../../data/flat/bestie';
import { useCountdown } from '../../hooks/useCountdown';
import { haptic, soundManager } from '../../utils/audio';
import { GameChip, Podium, TimerRing } from '../fx';
import { Avatar, BottomBar, EndBar, Ranking, type ModeProps } from '../ui';

// animazioni di questo gioco (carta che si gira, turno che pulsa, pericolo "3 uguali")
const CSS = `
@keyframes bzTurn { 0% { transform: rotateY(180deg) scale(.85) } 60% { transform: rotateY(-12deg) scale(1.08) } 100% { transform: rotateY(0) scale(1) } }
.bz-turn { animation: bzTurn .9s cubic-bezier(.2,1.1,.4,1) .25s both; transform-style: preserve-3d }
@keyframes bzRing { 0%,100% { box-shadow: 0 0 0 3px #fbbf24, 0 0 12px 2px rgba(251,191,36,.55) } 50% { box-shadow: 0 0 0 5px #fde68a, 0 0 24px 8px rgba(251,191,36,.85) } }
.bz-ring { animation: bzRing 1.1s ease-in-out infinite; border-radius: 9999px }
@keyframes bzDanger { 0%,100% { box-shadow: 0 0 0 2px #ef4444; transform: scale(1) } 50% { box-shadow: 0 0 0 4px #fca5a5, 0 0 14px rgba(239,68,68,.8); transform: scale(1.06) } }
.bz-danger { animation: bzDanger .9s ease-in-out infinite }
@keyframes bzWobble { 0%,100% { transform: rotate(-3deg) } 50% { transform: rotate(3deg) } }
.bz-wobble { animation: bzWobble 1.4s ease-in-out infinite }
@keyframes bzGain { 0% { transform: translateY(8px) scale(.5); opacity: 0 } 30% { transform: translateY(-6px) scale(1.25); opacity: 1 } 100% { transform: translateY(-22px) scale(1); opacity: 0 } }
.bz-gain { animation: bzGain 1.8s ease-out .9s both }
`;

// Carta disegnata: fronte con la bestia (o dorso uguale per tutte)
function BeastCard({ beast, w = 80, className = '' }: { beast: Beast | null; w?: number; className?: string }) {
  const h = Math.round(w * 1.4);
  const radius = Math.round(w * 0.12);
  const border = Math.max(2, Math.round(w * 0.045));
  if (!beast) {
    return (
      <span
        className={`relative block shrink-0 overflow-hidden ${className}`}
        style={{
          width: w,
          height: h,
          borderRadius: radius,
          border: `${border}px solid #fff`,
          background: 'repeating-linear-gradient(45deg, rgba(255,255,255,.07) 0 5px, transparent 5px 11px), radial-gradient(circle at 50% 40%, #5b21b6, #1e0b4b 75%)',
          boxShadow: '0 4px 0 rgba(22,6,72,.55)',
        }}
        aria-label="carta coperta"
      >
        <span className="absolute rounded-[10%] border border-dashed border-amber-300/60" style={{ inset: w * 0.07 }} />
        <span
          className="absolute left-1/2 top-1/2 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full font-display text-violet-950"
          style={{ width: w * 0.46, height: w * 0.46, fontSize: w * 0.3, background: 'radial-gradient(circle at 35% 30%, #fde68a, #f59e0b)', boxShadow: '0 3px 0 rgba(0,0,0,.3)' }}
        >
          ?
        </span>
        {w >= 60 && (
          <span className="absolute inset-x-0 text-center font-display tracking-widest text-amber-200/80" style={{ bottom: w * 0.1, fontSize: Math.max(8, w * 0.1) }}>
            BESTIE
          </span>
        )}
      </span>
    );
  }
  const b = beastInfo(beast);
  return (
    <span
      className={`relative block shrink-0 overflow-hidden ${className}`}
      style={{ width: w, height: h, borderRadius: radius, border: `${border}px solid #fff`, background: `linear-gradient(160deg, ${b.c1}, ${b.c2})`, boxShadow: '0 4px 0 rgba(22,6,72,.55)' }}
      aria-label={b.name}
    >
      <span className="absolute inset-0" style={{ background: 'radial-gradient(rgba(255,255,255,.16) 1.4px, transparent 1.6px) 0 0 / 9px 9px' }} />
      <span className="absolute leading-none" style={{ left: w * 0.06, top: w * 0.05, fontSize: w * 0.17 }}>
        {b.emoji}
      </span>
      <span className="absolute rotate-180 leading-none" style={{ right: w * 0.06, bottom: w * 0.27, fontSize: w * 0.13 }}>
        {b.emoji}
      </span>
      <span
        className="absolute left-1/2 grid -translate-x-1/2 place-items-center rounded-full"
        style={{ top: h * 0.17, width: w * 0.74, height: w * 0.74, background: 'radial-gradient(circle, rgba(255,255,255,.55), rgba(255,255,255,0) 70%)' }}
      >
        <span className="leading-none" style={{ fontSize: w * 0.48, filter: 'drop-shadow(0 3px 2px rgba(0,0,0,.35))' }}>
          {b.emoji}
        </span>
      </span>
      {w >= 44 && (
        <span
          className="absolute inset-x-0 truncate bg-white/90 text-center font-display uppercase leading-tight"
          style={{ bottom: w * 0.08, fontSize: Math.max(7, w * 0.125), color: b.ink, paddingBlock: w * 0.02 }}
        >
          {b.name}
        </span>
      )}
    </span>
  );
}

// carta che si gira (dorso → bestia)
function FlipCard({ beast, w }: { beast: Beast; w: number }) {
  return (
    <span className="relative block" style={{ width: w, height: Math.round(w * 1.4), perspective: 900 }}>
      <span className="bz-turn absolute inset-0 block">
        <span className="absolute inset-0 block" style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
          <BeastCard beast={beast} w={w} />
        </span>
        <span className="absolute inset-0 block" style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
          <BeastCard beast={null} w={w} />
        </span>
      </span>
    </span>
  );
}

function seatPos(i: number, n: number) {
  const a = Math.PI / 2 + (i * 2 * Math.PI) / n;
  return { x: 50 + 37 * Math.cos(a), y: 50 + 36 * Math.sin(a) };
}

const groups = (f: Partial<Record<Beast, number>> | undefined) => BEASTS.filter((b) => (f?.[b.id] ?? 0) > 0).map((b) => ({ b, n: f![b.id]! }));
const frontTotal = (f: Partial<Record<Beast, number>> | undefined) => Object.values(f ?? {}).reduce((a, x) => a + (x ?? 0), 0);

// 🪳 Bestie bugiarde
export default function BestieView({ state, clockOffset, canLead, onAction, onNewGame, onBackToLobby, onForce }: ModeProps) {
  const q = state.mg as BestieData;
  const me = state.myId;
  const P = (id: string | null | undefined) => state.players.find((p) => p.id === id);
  const name = (id: string | null | undefined) => P(id)?.name ?? '?';
  const left = useCountdown(q.stage === 'END' ? null : q.stageEndsAt, clockOffset);
  const playing = q.order.includes(me) && !q.gone.includes(me);
  const myTurn = playing && q.active === me;
  const needAct = myTurn && (q.stage === 'GIVE' || q.stage === 'RECEIVE' || q.stage === 'PEEK');
  const [selCard, setSelCard] = useState<Beast | null>(null);
  const [selTo, setSelTo] = useState<string | null>(null);
  const [selClaim, setSelClaim] = useState<Beast | null>(null);

  // scelte azzerate a ogni nuova mossa
  useEffect(() => {
    setSelCard(null);
    setSelTo(null);
    setSelClaim(null);
  }, [q.stage, q.turnNo, q.chain.length]);
  useEffect(() => {
    if (!needAct) return;
    soundManager.playPop();
    haptic(60);
  }, [needAct, q.stage, q.turnNo]);
  // suoni uguali per tutti
  useEffect(() => {
    if (q.stage === 'RECEIVE') soundManager.playWhoosh();
  }, [q.chain.length, q.turnNo]);
  useEffect(() => {
    if (q.stage === 'REVEAL') {
      soundManager.playDrumroll(0.8);
      setTimeout(() => (q.reveal?.lost ? soundManager.playBoom() : soundManager.playReveal()), 900);
    }
    if (q.stage === 'END') {
      soundManager.playVictory();
      confetti({ particleCount: 150, spread: 90, origin: { y: 0.35 } });
    }
  }, [q.stage, q.turnNo]);

  const act = (type: string, payload?: unknown) => {
    onAction(type, payload);
    haptic(25);
  };

  // ---------------------------------------------------------------- fine partita
  if (q.stage === 'END') {
    const ranking = q.ranking ?? q.order;
    const loser = P(q.loser);
    const winners = ranking.filter((id) => id !== q.loser && !q.gone.includes(id));
    const fatal = q.reveal?.lost ? q.reveal.card : null;
    return (
      <div className="stagger flex flex-col gap-4">
        <style>{CSS}</style>
        <section className="pop flex flex-col items-center gap-2 rounded-3xl border-4 border-white/90 bg-linear-to-br from-lime-500 to-green-800 p-5 text-center shadow-[0_8px_0_rgba(22,6,72,0.5)]">
          <p className="text-xs font-black uppercase tracking-widest text-lime-100">Chi si è riempito di bestie</p>
          {loser && (
            <div className="flex items-center gap-2">
              {fatal && <BeastCard beast={fatal} w={44} className="bz-wobble" />}
              <Avatar avatar={loser.avatar} color={loser.color} size={80} />
              {fatal && <BeastCard beast={fatal} w={44} className="bz-wobble" />}
            </div>
          )}
          <p className="font-display text-4xl text-white [text-shadow:0_4px_0_rgba(0,0,0,0.25)]">{loser ? `${loser.name} ha perso! 🤢` : 'Fine partita'}</p>
          {loser && (
            <p className="text-sm font-bold text-lime-50">
              {q.lostBy === 'MANO' ? 'Doveva giocare ma non aveva più carte in mano 🫳' : fatal ? `${BESTIE_LOSE_AT} ${beastInfo(fatal).plural} davanti a sé ${beastInfo(fatal).emoji}` : ''}
            </p>
          )}
        </section>
        <Podium state={state} entries={winners.map((id) => ({ id, value: `${frontTotal(q.front[id])} ${frontTotal(q.front[id]) === 1 ? 'carta' : 'carte'}` }))} />
        <section className="rounded-3xl border-2 border-white/10 bg-slate-900 p-4">
          <Ranking state={state} scores={q.scores} />
        </section>
        <EndBar canLead={canLead} hostName={P(state.hostId)?.name} onNewGame={onNewGame} onBackToLobby={onBackToLobby} />
      </div>
    );
  }

  // ---------------------------------------------------------------- tavolo
  const meIdx = q.order.indexOf(me);
  const seats = meIdx >= 0 ? [...q.order.slice(meIdx), ...q.order.slice(0, meIdx)] : q.order;
  const posOf = (id: string | null) => {
    const i = id ? seats.indexOf(id) : -1;
    return i >= 0 ? seatPos(i, seats.length) : { x: 50, y: 50 };
  };
  const claim = q.claim ? beastInfo(q.claim) : null;
  const travelling = (q.stage === 'RECEIVE' || q.stage === 'PEEK') && q.active;
  const rv = q.reveal;
  const activeP = P(q.active);
  const others = q.order.filter((id) => id !== me && !q.gone.includes(id));

  const headline = (() => {
    if (q.stage === 'GIVE') return myTurn ? 'Tocca a te! Passa una carta' : `Tocca a ${name(q.active)}: sceglie una carta…`;
    if (q.stage === 'RECEIVE') return myTurn ? 'Tocca a te! Vero, falso… o ripassi?' : `${name(q.active)} deve decidere…`;
    if (q.stage === 'PEEK') return myTurn ? 'Tocca a te! Ripassala con una nuova bugia' : `${name(q.active)} ha sbirciato e la ripassa…`;
    return 'Si scopre la carta!';
  })();

  const logLine = (e: BestieLog) => {
    switch (e.k) {
      case 'give':
        return `🃏 ${name(e.by)} passa una carta a ${name(e.to)}: «È ${beastInfo(e.claim).art}»`;
      case 'pass':
        return `👀 ${name(e.by)} sbircia e la ripassa a ${name(e.to)}: «È ${beastInfo(e.claim).art}»`;
      case 'answer':
        return `${e.right ? '✅' : '❌'} ${name(e.by)}: «${e.said}!» Era ${beastInfo(e.card).art} ${beastInfo(e.card).emoji} → davanti a ${name(e.taker)}`;
      case 'four':
        return `🤢 ${name(e.by)} ha ${BESTIE_LOSE_AT} ${beastInfo(e.beast).plural}: ha perso!`;
      case 'empty':
        return `🫳 ${name(e.by)} non ha più carte: ha perso!`;
      case 'left':
        return `🚪 ${name(e.by)} è uscito dalla partita`;
      case 'discard':
        return '🗑️ La carta in viaggio è stata scartata';
      case 'auto':
        return `💤 ${name(e.by)} non risponde: mossa automatica`;
    }
  };

  // centro del tavolo: la dichiarazione o la carta scoperta
  const center = (() => {
    if (q.stage === 'GIVE')
      return (
        <>
          <BeastCard beast={null} w={46} className="bz-wobble" />
          <p className="mt-1 text-xs font-black text-white">{myTurn ? 'Scegli carta, vittima e bugia' : `${name(q.active)} sceglie…`}</p>
        </>
      );
    if (travelling && claim)
      return (
        <div key={`${q.turnNo}-${q.chain.length}`} className="pop flex flex-col items-center">
          <p className="max-w-full truncate text-[11px] font-black uppercase tracking-wider text-emerald-100/90">{name(q.from)} dice:</p>
          <span className="relative mt-0.5 rounded-2xl bg-white px-3 py-1.5 text-center shadow-[0_4px_0_rgba(22,6,72,0.45)]">
            <span className="block text-4xl leading-none">{claim.emoji}</span>
            <span className="block font-display text-sm uppercase leading-tight text-slate-950">È {claim.art}</span>
            <span className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 bg-white" />
          </span>
        </div>
      );
    if (q.stage === 'REVEAL' && rv)
      return (
        <div className="flex flex-col items-center">
          <FlipCard key={q.turnNo} beast={rv.card} w={64} />
          <p className={`reveal-pop mt-1 font-display text-lg leading-none ${rv.right ? 'text-emerald-300' : 'text-red-300'}`} style={{ animationDelay: '1s' }}>
            {rv.card === rv.claim ? 'ERA VERO!' : 'ERA FALSO!'}
          </p>
        </div>
      );
    return null;
  })();

  // pannello scelta: carta (solo nel passaggio), destinatario e dichiarazione
  const choosePanel = (mode: 'give' | 'pass') => {
    const targets = mode === 'give' ? others : q.candidates;
    const card = mode === 'give' ? selCard : q.card;
    return (
      <section className="pop flex flex-col gap-3 rounded-3xl border-2 border-amber-400/70 bg-slate-900 p-3">
        {mode === 'give' ? (
          <>
            <p className="text-sm font-black text-amber-200">1 · Scegli la carta da passare</p>
            <div className="flex flex-wrap justify-center gap-2">
              {groups(countHand(q.myHand)).map(({ b, n }) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setSelCard(b.id)}
                  className={`relative rounded-xl transition-transform ${selCard === b.id ? '-translate-y-2 ring-4 ring-amber-400' : 'active:scale-95'}`}
                  aria-label={b.name}
                >
                  <BeastCard beast={b.id} w={58} />
                  {n > 1 && <span className="absolute -right-1.5 -top-1.5 grid h-6 min-w-6 place-items-center rounded-full bg-amber-400 px-1 text-xs font-black text-slate-950">×{n}</span>}
                </button>
              ))}
            </div>
          </>
        ) : (
          q.card && (
            <div className="flex items-center gap-3">
              <FlipCard beast={q.card} w={84} />
              <div className="min-w-0 flex-1">
                <p className="font-display text-2xl leading-tight text-white">
                  È {beastInfo(q.card).art} {beastInfo(q.card).emoji}
                </p>
                <p className="text-sm font-bold text-slate-300">Solo tu (e chi l'ha già vista) lo sai 🤫</p>
                <p className="mt-1 text-xs font-bold text-amber-200">Ora passala a chi non l'ha ancora vista, con una nuova dichiarazione.</p>
              </div>
            </div>
          )
        )}

        <p className="text-sm font-black text-amber-200">{mode === 'give' ? '2' : '1'} · A chi la passi?</p>
        <div className="grid grid-cols-3 gap-2">
          {targets.map((id) => {
            const p = P(id);
            const danger = groups(q.front[id]).filter((g) => g.n >= BESTIE_LOSE_AT - 1);
            return (
              <button
                key={id}
                type="button"
                onClick={() => setSelTo(id)}
                className={`flex flex-col items-center gap-0.5 rounded-2xl p-1.5 ${selTo === id ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-white'}`}
              >
                {p && <Avatar avatar={p.avatar} color={p.color} size={36} />}
                <span className="max-w-full truncate text-xs font-black">{p?.name ?? '?'}</span>
                {danger.length > 0 && (
                  <span className="rounded-full bg-red-500 px-1.5 text-[10px] font-black text-white">
                    {danger.map((g) => `${g.n}${g.b.emoji}`).join(' ')}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <p className="text-sm font-black text-amber-200">{mode === 'give' ? '3' : '2'} · Cosa dichiari?</p>
        <div className="grid grid-cols-4 gap-1.5">
          {BEASTS.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setSelClaim(b.id)}
              className={`flex flex-col items-center rounded-2xl py-1.5 ${selClaim === b.id ? 'ring-4 ring-amber-400' : ''}`}
              style={{ background: `linear-gradient(160deg, ${b.c1}, ${b.c2})` }}
            >
              <span className="text-2xl leading-none">{b.emoji}</span>
              <span className="mt-0.5 max-w-full truncate px-0.5 text-[10px] font-black uppercase text-white [text-shadow:0_1px_0_rgba(0,0,0,0.5)]">{b.name}</span>
            </button>
          ))}
        </div>
        {card && selClaim && (
          <p className={`pop text-center font-display text-lg ${card === selClaim ? 'text-emerald-300' : 'text-fuchsia-300'}`}>
            {card === selClaim ? '😇 Dici la verità' : '😈 Stai bluffando!'}
          </p>
        )}
      </section>
    );
  };

  const ready = !!selTo && !!selClaim && (q.stage === 'PEEK' || !!selCard);

  return (
    <div className="stagger flex flex-col gap-3 pb-40">
      <style>{CSS}</style>
      <div className="flex items-center justify-between gap-2">
        <GameChip>
          🪳 Carta {Math.max(1, q.turnNo)} · {BESTIE_LOSE_AT} uguali e perdi
        </GameChip>
        <TimerRing left={left} total={Math.round(q.stageMs / 1000)} />
      </div>

      <div
        key={`${q.stage}-${q.active}-${q.turnNo}`}
        className={`pop flex items-center justify-center gap-2 rounded-2xl px-3 py-2.5 text-center ${
          needAct ? 'bg-amber-400 text-slate-950 shadow-[0_5px_0_rgba(22,6,72,0.5)]' : 'bg-slate-900/80 text-white'
        }`}
      >
        {!needAct && activeP && q.stage !== 'REVEAL' && <Avatar avatar={activeP.avatar} color={activeP.color} size={28} />}
        <p className={`font-display leading-tight ${needAct ? 'text-2xl' : 'text-lg'}`}>{headline}</p>
      </div>

      {/* esito */}
      {q.stage === 'REVEAL' && rv && (
        <section
          className={`reveal-pop rounded-3xl border-4 border-white/90 p-3 text-center shadow-[0_8px_0_rgba(22,6,72,0.5)] ${
            rv.lost ? 'bg-linear-to-br from-red-500 to-red-800' : rv.right ? 'bg-linear-to-br from-emerald-400 to-teal-700' : 'bg-linear-to-br from-fuchsia-500 to-purple-800'
          }`}
          style={{ animationDelay: '0.9s' }}
        >
          <p className="font-display text-2xl leading-tight text-white">
            {name(rv.by)}: «{rv.said}!» {rv.right ? 'Ha ragione ✅' : 'Sbagliato ❌'}
          </p>
          <p className="mt-0.5 font-bold text-white/90">
            Era {beastInfo(rv.card).art} {beastInfo(rv.card).emoji} (dichiarato: {beastInfo(rv.claim).name}) → va davanti a {rv.taker === me ? 'te' : name(rv.taker)}
          </p>
          {rv.lost && (
            <p className="mt-1 font-display text-2xl text-amber-200">
              🤢 {BESTIE_LOSE_AT} {beastInfo(rv.card).plural.toUpperCase()}! {name(rv.taker)} ha perso!
            </p>
          )}
        </section>
      )}

      {/* il tavolo con i giocatori in cerchio */}
      <section className="relative mx-auto h-[360px] w-full max-w-[400px]">
        <div
          className="absolute inset-x-[15%] inset-y-[21%] rounded-[50%] border-[10px] border-[#5b3a1e] shadow-[inset_0_6px_18px_rgba(0,0,0,0.55),0_8px_0_rgba(22,6,72,0.5)]"
          style={{ background: 'radial-gradient(ellipse at 50% 38%, #3f6f3a, #22401f 72%)' }}
        />
        <div className="absolute left-1/2 top-1/2 flex w-[40%] -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center">{center}</div>
        {seats.map((id, i) => {
          const p = P(id);
          const { x, y } = seatPos(i, seats.length);
          const gs = groups(q.front[id]);
          const isActive = q.active === id && q.stage !== 'REVEAL';
          const gone = q.gone.includes(id);
          return (
            <div
              key={id}
              className={`absolute flex w-[88px] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 ${gone ? 'opacity-35 grayscale' : ''}`}
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <span className="relative">
                <span className={`block ${isActive ? 'bz-ring' : ''}`}>{p ? <Avatar avatar={p.avatar} color={p.color} size={38} /> : <span className="block h-[38px] w-[38px]" />}</span>
                {q.afk.includes(id) && <span className="absolute -left-2 -top-1 text-sm">💤</span>}
                {travelling && q.seen.includes(id) && <span className="absolute -right-2 -top-1 text-sm" title="ha visto la carta">👁️</span>}
                {rv && q.stage === 'REVEAL' && rv.taker === id && (
                  <span className="bz-gain absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap text-lg font-black">+1{beastInfo(rv.card).emoji}</span>
                )}
                {/* carte in mano */}
                <span className="absolute -bottom-1 -right-4 flex items-center gap-0.5 rounded-full bg-slate-950/90 py-0.5 pl-0.5 pr-1.5 text-[10px] font-black text-white">
                  <BeastCard beast={null} w={11} /> {q.hands[id] ?? 0}
                </span>
              </span>
              <span className="max-w-full truncate text-[11px] font-black leading-tight text-white">{id === me ? 'Tu' : (p?.name ?? '?')}</span>
              <span className="flex max-w-[92px] flex-wrap justify-center gap-0.5">
                {gs.map(({ b, n }) => (
                  <span
                    key={b.id}
                    className={`flex items-center rounded-full px-1 text-[10px] font-black leading-4 ${n >= BESTIE_LOSE_AT - 1 ? 'bz-danger bg-red-600 text-white' : 'bg-slate-950/80 text-slate-100'}`}
                  >
                    {b.emoji}
                    {n}
                  </span>
                ))}
              </span>
            </div>
          );
        })}
        {/* la carta coperta che viaggia verso chi la riceve */}
        {travelling && (
          <motion.div
            key={`${q.turnNo}-${q.chain.length}`}
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2"
            initial={{ left: `${towards(posOf(q.from)).x}%`, top: `${towards(posOf(q.from)).y}%`, rotate: -30, scale: 0.5 }}
            animate={{ left: `${towards(posOf(q.active)).x}%`, top: `${towards(posOf(q.active)).y}%`, rotate: 8, scale: 1 }}
            transition={{ type: 'spring', stiffness: 140, damping: 16 }}
          >
            <BeastCard beast={null} w={34} />
          </motion.div>
        )}
      </section>

      {/* chi riceve: vero, falso o ripassa */}
      {myTurn && q.stage === 'RECEIVE' && claim && (
        <section className="pop flex items-center gap-3 rounded-3xl border-2 border-amber-400/70 bg-slate-900 p-3">
          <BeastCard beast={null} w={78} className="bz-wobble" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-300">{name(q.from)} ti passa una carta e giura:</p>
            <p className="font-display text-3xl leading-tight text-white">
              «È {claim.art}!» {claim.emoji}
            </p>
            <p className="mt-1 text-xs font-bold text-slate-400">
              Se indovini va davanti a {name(q.from)}, se sbagli davanti a te.
              {q.candidates.length > 0 ? ' Oppure sbirciala e passala a un altro.' : ' Tutti gli altri l’hanno già vista: devi rispondere!'}
            </p>
          </div>
        </section>
      )}

      {myTurn && q.stage === 'GIVE' && choosePanel('give')}
      {myTurn && q.stage === 'PEEK' && choosePanel('pass')}

      {/* chi conosce la carta in viaggio (ma non deve agire) la vede in piccolo */}
      {!myTurn && travelling && q.card && (
        <section className="flex items-center gap-3 rounded-3xl border-2 border-white/10 bg-slate-900 p-3">
          <BeastCard beast={q.card} w={44} />
          <p className="text-sm font-bold text-slate-200">
            Tu sai che è {beastInfo(q.card).art} {beastInfo(q.card).emoji}… acqua in bocca 🤫
          </p>
        </section>
      )}

      {/* carte scoperte davanti a ognuno */}
      <section className="rounded-3xl border-2 border-white/10 bg-slate-900 p-3">
        <p className="mb-2 text-xs font-black uppercase tracking-widest text-slate-400">Carte scoperte (con {BESTIE_LOSE_AT} uguali si perde)</p>
        <div className="flex flex-col gap-2">
          {seats.map((id) => {
            const p = P(id);
            const gs = groups(q.front[id]);
            const danger = gs.filter((g) => g.n >= BESTIE_LOSE_AT - 1);
            return (
              <div key={id} className={`flex items-start gap-2 ${q.gone.includes(id) ? 'opacity-40' : ''}`}>
                {p && <Avatar avatar={p.avatar} color={p.color} size={30} />}
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 text-sm font-black text-white">
                    <span className="truncate">{id === me ? 'Tu' : (p?.name ?? '?')}</span>
                    <span className="text-[11px] font-bold text-slate-400">🂠 {q.hands[id] ?? 0} in mano</span>
                    {danger.map((g) => (
                      <span key={g.b.id} className="bz-danger rounded-full bg-red-600 px-2 text-[11px] font-black uppercase text-white">
                        {g.n} {g.b.plural}!
                      </span>
                    ))}
                  </p>
                  {gs.length === 0 ? (
                    <p className="text-xs font-bold text-slate-500">Ancora pulito ✨</p>
                  ) : (
                    <div className="mt-1 flex flex-wrap gap-2.5">
                      {gs.map(({ b, n }) => (
                        <span key={b.id} className="relative" style={{ width: 30 + (n - 1) * 6, height: 42 }}>
                          {Array.from({ length: n }, (_, k) => (
                            <span key={k} className="absolute top-0" style={{ left: k * 6 }}>
                              <BeastCard beast={b.id} w={30} />
                            </span>
                          ))}
                          <span className={`absolute -bottom-1 -right-2 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-black ${n >= BESTIE_LOSE_AT - 1 ? 'bg-red-600 text-white' : 'bg-white text-slate-950'}`}>
                            {n}
                          </span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* le mie carte in mano (solo io le vedo) */}
      {playing && !(myTurn && q.stage === 'GIVE') && q.myHand.length > 0 && (
        <section className="rounded-3xl border-2 border-white/10 bg-slate-900/80 p-3">
          <p className="mb-2 text-xs font-black uppercase tracking-widest text-slate-400">Le tue carte (solo tu le vedi) · {q.myHand.length}</p>
          <div className="flex flex-wrap justify-center gap-2">
            {groups(countHand(q.myHand)).map(({ b, n }) => (
              <span key={b.id} className="relative">
                <BeastCard beast={b.id} w={40} />
                {n > 1 && <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-amber-400 px-1 text-[11px] font-black text-slate-950">×{n}</span>}
              </span>
            ))}
          </div>
        </section>
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
                <li key={q.logNo - i} className={`feed-in text-sm font-bold leading-snug ${i === 0 ? 'text-white' : 'text-slate-400'}`}>
                  {logLine(e)}
                </li>
              ))}
          </ul>
        </section>
      )}

      <BottomBar>
        {myTurn && q.stage === 'RECEIVE' && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => act('MG_ANSWER', { said: 'VERO' })} className="h-16 rounded-2xl bg-emerald-500 text-xl font-black text-white">
                È VERO ✅
              </button>
              <button type="button" onClick={() => act('MG_ANSWER', { said: 'FALSO' })} className="h-16 rounded-2xl bg-red-500 text-xl font-black text-white">
                È FALSO ❌
              </button>
            </div>
            {q.candidates.length > 0 && (
              <button type="button" onClick={() => act('MG_PEEK')} className="h-12 rounded-2xl bg-violet-600 text-base font-black text-white">
                👀 La guardo e la ripasso
              </button>
            )}
          </>
        )}

        {myTurn && (q.stage === 'GIVE' || q.stage === 'PEEK') && (
          <button
            type="button"
            disabled={!ready}
            onClick={() =>
              q.stage === 'GIVE' ? act('MG_GIVE', { card: selCard, to: selTo, claim: selClaim }) : act('MG_PASS', { to: selTo, claim: selClaim })
            }
            className="shine h-16 rounded-2xl bg-amber-400 px-3 text-lg font-black leading-tight text-slate-950 disabled:opacity-40"
          >
            {ready ? `Passa a ${name(selTo)}: «È ${beastInfo(selClaim).art}»` : q.stage === 'GIVE' ? 'Scegli carta, giocatore e bestia' : 'Scegli giocatore e bestia'}
          </button>
        )}

        {!needAct && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-slate-700 bg-slate-900/95 px-4 py-3 text-sm font-bold text-slate-200">
            <span className="min-w-0 truncate">{q.stage === 'REVEAL' ? (rv?.lost ? 'Classifica tra poco…' : `Ora tocca a ${name(rv?.taker)}`) : headline}</span>
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

// la carta si ferma un po' verso il centro del tavolo, davanti al giocatore
const towards = (p: { x: number; y: number }) => ({ x: p.x + (50 - p.x) * 0.42, y: p.y + (50 - p.y) * 0.42 });

const countHand = (hand: Beast[]) => {
  const f: Partial<Record<Beast, number>> = {};
  for (const b of hand) f[b] = (f[b] ?? 0) + 1;
  return f;
};
