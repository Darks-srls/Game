import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { motion } from 'motion/react';
import { FastForward, ThumbsDown, ThumbsUp } from 'lucide-react';
import type { OcaEvent, OcaView as OcaData } from '../types/game';
import { OCA_BOARD, OCA_END, OCA_INFO } from '../data/oca';
import { useCountdown } from '../hooks/useCountdown';
import { haptic, soundManager } from '../utils/audio';
import { Die, GameChip, Podium, TimerRing } from './fx';
import { Avatar, BottomBar, EndBar, type ModeProps } from './ui';

const COLS = 8;
const STEP_MS = 300;

// Caselle a serpentina: riga 1 da sinistra a destra, riga 2 da destra a sinistra, e così via
const cell = (n: number) => {
  const r = Math.floor((n - 1) / COLS);
  const i = (n - 1) % COLS;
  return { row: r + 1, col: r % 2 === 0 ? i + 1 : COLS - i };
};

// 🦢 Gioco dell'Oca pazza: dado, caselle speciali e sfide votate dal gruppo
export default function OcaView({ state, clockOffset, canLead, onAction, onNewGame, onBackToLobby, onForce }: ModeProps) {
  const o = state.mg as OcaData;
  const P = (id: string | null) => state.players.find((p) => p.id === id);
  const left = useCountdown(o.stage === 'ROLL' || o.stage === 'DARE' ? o.stageEndsAt : null, clockOffset);
  const current = P(o.current);
  const myTurn = o.stage === 'ROLL' && o.current === state.myId;
  const dare = o.dare;
  const iPerform = dare?.by === state.myId;
  const canVote = o.stage === 'DARE' && !!dare && !iPerform && o.order.includes(state.myId) && o.myVote === null;

  // Pedine: quella che si muove avanza casella per casella, le altre stanno dove dice il server
  const [shown, setShown] = useState<Record<string, number>>(o.pos);
  const [moving, setMoving] = useState(false);
  const latest = useRef(o);
  latest.current = o;
  const lastMove = useRef(o.moveNo);
  const posKey = JSON.stringify(o.pos);
  useEffect(() => {
    if (!moving && o.moveNo === lastMove.current) setShown(o.pos);
  }, [posKey, moving]);
  useEffect(() => {
    if (o.moveNo === lastMove.current) return;
    lastMove.current = o.moveNo;
    const { mover, path } = o;
    if (!mover || !path.length) return setShown(o.pos);
    setMoving(true);
    let i = 0;
    const timer = setInterval(() => {
      if (i < path.length) {
        const square = path[i++];
        setShown((prev) => ({ ...prev, [mover]: square }));
        soundManager.playTick();
      } else {
        clearInterval(timer);
        setMoving(false);
        setShown(latest.current.pos);
        const events = latest.current.events;
        if (events.some((e) => e.t === 'SCHELETRO' || e.t === 'BUCCIA' || e.t === 'LABIRINTO')) soundManager.playError();
        else if (events.some((e) => e.t === 'OCA' || e.t === 'RAZZO' || e.t === 'PONTE' || e.t === 'SCAMBIO')) soundManager.playSuccess();
      }
    }, STEP_MS);
    return () => {
      clearInterval(timer);
      setMoving(false);
    };
  }, [o.moveNo]);

  useEffect(() => {
    if (myTurn) {
      soundManager.playPop();
      haptic(60);
    }
  }, [myTurn]);
  useEffect(() => {
    if (o.stage === 'DARE') soundManager.playReveal();
    if (o.stage === 'END') {
      soundManager.playVictory();
      confetti({ particleCount: 170, spread: 95, origin: { y: 0.35 } });
    }
  }, [o.stage, o.moveNo]);

  const eventText = (e: OcaEvent) => {
    if (e.t === 'WIN') return '🏁 Arrivato al traguardo!';
    if (e.t === 'DARE_OK') return '👏 Sfida superata: avanti di 3';
    if (e.t === 'DARE_KO') return '🍅 Sfida bocciata: indietro di 3';
    if (e.t === 'SCAMBIO') return `🔄 Scambio di posto con ${P(e.with ?? null)?.name ?? 'qualcuno'}`;
    return `${OCA_INFO[e.t].icon} ${OCA_INFO[e.t].label}`;
  };

  const board = (
    <section className="rounded-3xl border-4 border-white/90 bg-linear-to-br from-emerald-300 to-emerald-600 p-2 shadow-[0_8px_0_rgba(22,6,72,0.5)]">
      {/* Partenza */}
      <div className="mb-1.5 flex min-h-[34px] items-center gap-1.5 rounded-xl bg-white/85 px-2 py-1">
        <span className="font-display text-sm text-emerald-800">VIA</span>
        {o.order
          .filter((id) => shown[id] === 0)
          .map((id) => {
            const p = P(id);
            return p ? (
              <motion.span key={id} layoutId={`pawn-${id}`} transition={{ type: 'spring', stiffness: 500, damping: 30 }}>
                <Avatar avatar={p.avatar} color={p.color} size={24} />
              </motion.span>
            ) : null;
          })}
      </div>
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}>
        {Array.from({ length: OCA_END }, (_, k) => {
          const n = k + 1;
          const special = OCA_BOARD[n];
          const { row, col } = cell(n);
          const here = o.order.filter((id) => shown[id] === n);
          const end = n === OCA_END;
          return (
            <div
              key={n}
              className={`relative flex aspect-square flex-col items-center justify-center rounded-lg text-center shadow-[inset_0_-3px_0_rgba(0,0,0,0.12)] ${end ? 'ring-2 ring-amber-300' : ''}`}
              style={{ gridRow: row, gridColumn: col, background: end ? '#ffd02e' : special ? OCA_INFO[special].color : n % 2 ? '#f1ebff' : '#e3d9ff' }}
            >
              <span className="absolute left-0.5 top-0 text-[9px] font-black text-slate-700/70">{n}</span>
              <span className="text-base leading-none">{end ? '🏁' : special ? OCA_INFO[special].icon : ''}</span>
              {here.length > 0 && (
                <span className="absolute inset-0 flex flex-wrap content-center items-center justify-center">
                  {here.map((id) => {
                    const p = P(id);
                    return p ? (
                      <motion.span key={id} layoutId={`pawn-${id}`} transition={{ type: 'spring', stiffness: 500, damping: 30 }} className="relative z-10">
                        <Avatar avatar={p.avatar} color={p.color} size={here.length > 2 ? 16 : 22} />
                      </motion.span>
                    ) : null;
                  })}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );

  if (o.stage === 'END') {
    const ranking = [...o.order].sort((a, b) => (o.pos[b] ?? 0) - (o.pos[a] ?? 0));
    return (
      <div className="stagger flex flex-col gap-4">
        <h2 className="text-center text-3xl text-white">{P(o.winner)?.name ?? 'Qualcuno'} vince l'Oca! 🦢</h2>
        <Podium state={state} entries={ranking.map((id) => ({ id, value: `casella ${o.pos[id]}` }))} />
        {board}
        <EndBar canLead={canLead} hostName={P(state.hostId)?.name} onNewGame={onNewGame} onBackToLobby={onBackToLobby} />
      </div>
    );
  }

  return (
    <div className="stagger flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <GameChip>🦢 Oca pazza</GameChip>
        {(o.stage === 'ROLL' || o.stage === 'DARE') && <TimerRing left={left} total={o.stage === 'ROLL' ? 20 : 45} />}
      </div>

      {board}

      {/* Dado e cosa è successo */}
      <section className="flex items-center gap-3 rounded-2xl border-2 border-white/10 bg-slate-900 p-3">
        {o.roll ? (
          <span key={o.rollNo} className="dice-spin">
            <Die value={o.roll} size={54} />
          </span>
        ) : (
          <span className="text-5xl">🎲</span>
        )}
        <div className="min-w-0 flex-1">
          {o.stage === 'ROLL' ? (
            <p className="text-sm font-bold text-slate-300">
              {myTurn ? 'Tocca a te!' : 'Tocca a'}
              <span className="block truncate font-display text-xl text-white">{myTurn ? 'Tira il dado 🎲' : current?.name}</span>
            </p>
          ) : (
            <>
              <p className="truncate text-sm font-bold text-slate-300">
                {P(o.mover)?.name} {moving ? 'si muove…' : `è sulla casella ${o.pos[o.mover ?? ''] ?? 0}`}
              </p>
              {!moving &&
                o.events.map((e, i) => (
                  <p key={`${o.moveNo}-${i}`} className="pop font-display text-lg leading-tight text-amber-300" style={{ animationDelay: `${i * 0.15}s` }}>
                    {eventText(e)}
                  </p>
                ))}
            </>
          )}
        </div>
      </section>

      {/* Sfida: chi c'è finito la fa, gli altri votano */}
      {o.stage === 'DARE' && dare && (
        <section className="reveal-pop rounded-3xl border-4 border-white bg-linear-to-br from-red-400 to-red-600 p-4 text-center shadow-[0_8px_0_rgba(22,6,72,0.5)]">
          <p className="text-xs font-black uppercase tracking-widest text-white/85">🎭 Sfida per {iPerform ? 'te' : P(dare.by)?.name}</p>
          <p className="mt-1 font-display text-2xl leading-tight text-white">{dare.text}</p>
          <p className="mt-2 text-sm font-bold text-white/90">
            {iPerform ? 'Falla adesso! Se il gruppo approva vai avanti di 3, se no indietro di 3.' : 'Guarda la sfida e vota: avanti o indietro di 3?'}
          </p>
          <p className="mt-2 font-black text-white">
            👍 {dare.yes} · 👎 {dare.no} <span className="text-white/70">/ {dare.voters}</span>
          </p>
        </section>
      )}

      {/* Le pedine in gara */}
      <section className="flex flex-wrap gap-1.5">
        {o.order.map((id) => {
          const p = P(id);
          return p ? (
            <span
              key={id}
              className={`flex items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-xs font-bold ${o.current === id ? 'bg-amber-400 text-slate-950' : 'bg-slate-900 text-slate-200'}`}
            >
              <Avatar avatar={p.avatar} color={p.color} size={22} />
              {p.name} · {o.pos[id]}
              {o.skip[id] > 0 ? ` · fermo ${o.skip[id]}` : ''}
            </span>
          ) : null;
        })}
      </section>

      <details className="rounded-2xl bg-slate-900/80 px-3 py-2 text-sm font-semibold text-slate-200">
        <summary className="cursor-pointer font-black text-white">Caselle speciali</summary>
        <ul className="mt-2 grid grid-cols-2 gap-1">
          {Object.entries(OCA_INFO).map(([key, info]) => (
            <li key={key}>
              {info.icon} {info.label}
            </li>
          ))}
        </ul>
      </details>

      <BottomBar>
        {myTurn ? (
          <button type="button" onClick={() => onAction('MG_ROLL')} className="shine h-16 rounded-2xl bg-amber-400 text-2xl font-black text-slate-950">
            🎲 Tira il dado!
          </button>
        ) : canVote ? (
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => onAction('MG_VOTE', { choice: 1 })} className="flex h-16 items-center justify-center gap-2 rounded-2xl bg-emerald-500 text-xl font-black text-white">
              <ThumbsUp size={22} /> Bravo!
            </button>
            <button type="button" onClick={() => onAction('MG_VOTE', { choice: 0 })} className="flex h-16 items-center justify-center gap-2 rounded-2xl bg-red-500 text-xl font-black text-white">
              <ThumbsDown size={22} /> Che pena
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-slate-700 bg-slate-900/95 px-4 py-3 text-sm font-bold text-slate-200">
            <span className="min-w-0 truncate">
              {o.stage === 'DARE' ? (iPerform ? 'Il gruppo sta votando la tua sfida…' : 'Voto inviato!') : o.stage === 'MOVE' ? 'Pedina in movimento…' : `Aspettiamo che ${current?.name ?? '…'} tiri`}
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
