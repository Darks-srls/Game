import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import confetti from 'canvas-confetti';
import type { BombaView as BombaData } from '../types/game';
import { haptic, soundManager } from '../utils/audio';
import { Art, Avatar, BottomBar, EndBar, type ModeProps } from './ui';

const LABEL = {
  SILLABA: "Di' una parola che contiene",
  CATEGORIA: "Di' qualcosa di questa categoria",
  LETTERA: "Di' una parola che inizia con",
};

// 💣 Passa la bomba: chi ce l'ha dice una parola ad alta voce e la passa, prima che scoppi
export default function BombaView({ state, clockOffset, canLead, onAction, onNewGame, onBackToLobby }: ModeProps) {
  const b = state.mg as BombaData;
  const P = (id: string | null) => state.players.find((p) => p.id === id);
  const holder = P(b.holder);
  const iHold = b.stage === 'LIVE' && b.holder === state.myId;
  const victim = P(b.boomVictim);
  const winner = P(b.winner);
  // chi riceverà la bomba (il prossimo ancora in gioco)
  const nextIndex = b.order.indexOf(b.holder);
  const next = P(b.order.map((_, k) => b.order[(nextIndex + k + 1) % b.order.length]).find((id) => id !== b.holder && b.lives[id] > 0) ?? null);
  const hearts = (id: string) => '❤️'.repeat(Math.max(0, b.lives[id])) + '🖤'.repeat(Math.max(0, b.maxLives - b.lives[id]));

  // Ticchettio sul telefono di chi ha la bomba, sempre più veloce
  useEffect(() => {
    if (!iHold) return;
    haptic(60);
    let timer: ReturnType<typeof setTimeout>;
    const loop = () => {
      soundManager.playTick();
      const elapsed = Date.now() + clockOffset - b.roundStart;
      timer = setTimeout(loop, Math.max(130, 850 - elapsed / 40));
    };
    loop();
    return () => clearTimeout(timer);
  }, [iHold, b.round, b.holder]);

  // BOOM: suono e vibrazione per tutti; alla fine coriandoli
  useEffect(() => {
    if (b.stage === 'BOOM' || b.stage === 'END') {
      soundManager.playBoom();
      haptic([250, 80, 250]);
    }
    if (b.stage === 'END') {
      setTimeout(() => soundManager.playVictory(), 900);
      confetti({ particleCount: 160, spread: 90, origin: { y: 0.55 } });
    }
  }, [b.stage, b.round]);

  return (
    <div className="stagger flex flex-col gap-4">
      {b.stage === 'END' ? (
        <section className="pop flex flex-col items-center gap-3 rounded-3xl border-2 border-amber-400 bg-slate-900 p-6 text-center">
          <p className="text-xs font-black uppercase tracking-widest text-amber-300">Ultimo sopravvissuto</p>
          {winner && <Avatar avatar={winner.avatar} color={winner.color} size={96} />}
          <p className="text-4xl font-black text-white">{winner ? `${winner.name} vince!` : 'Nessun vincitore'}</p>
        </section>
      ) : b.stage === 'BOOM' ? (
        <section className="boom flex flex-col items-center gap-2 rounded-3xl border-4 border-red-400 bg-red-500/25 p-6 text-center">
          {createPortal(<div className="flash pointer-events-none fixed inset-0 z-50 bg-white" />, document.body)}
          <p className="reveal-pop text-7xl">💥</p>
          <p className="text-5xl font-black text-white">BOOM!</p>
          {victim && (
            <>
              <Avatar avatar={victim.avatar} color={victim.color} size={72} />
              <p className="text-2xl font-black text-white">{victim.name} perde una vita</p>
              <p className="text-xl">{hearts(victim.id)}</p>
            </>
          )}
          <p className="text-sm font-semibold text-red-100">Si riparte tra pochi secondi…</p>
        </section>
      ) : (
        <>
          <section key={b.round} className="pop rounded-3xl border-2 border-slate-700 bg-slate-900 p-4 text-center">
            <p className="text-sm font-black text-slate-300">{LABEL[b.prompt.kind]}</p>
            <p className={`mt-1 font-black leading-tight text-amber-300 ${b.prompt.kind === 'CATEGORIA' ? 'text-4xl' : 'text-7xl tracking-wider'}`}>{b.prompt.text}</p>
          </section>
          <div className={`mx-auto grid h-44 w-44 place-items-center ${iHold ? 'bomb-shake' : 'bomb-idle'}`}>
            <Art src="/art/bomba.webp" fallback={<span className="text-[120px] leading-none">💣</span>} className="h-full w-full rounded-full object-cover" />
          </div>
          <p key={b.holder} className={`pop text-center text-2xl font-black ${iHold ? 'text-red-300' : 'text-white'}`}>
            {iHold ? "Ce l'hai tu! Parla e passala!" : `💣 Ce l'ha ${holder?.name ?? '…'}`}
          </p>
        </>
      )}

      <section className="rounded-3xl border-2 border-slate-700 bg-slate-900 p-3">
        <ul className="flex flex-col gap-1">
          {b.order.map((id) => {
            const p = P(id);
            if (!p) return null;
            const out = b.lives[id] <= 0;
            return (
              <li key={id} className={`flex items-center gap-2 rounded-2xl px-2 py-1.5 ${id === b.holder && b.stage === 'LIVE' ? 'bg-red-500/25' : ''} ${out ? 'opacity-40' : ''}`}>
                <Avatar avatar={p.avatar} color={p.color} size={32} />
                <span className="flex-1 truncate font-bold text-white">
                  {p.name}
                  {id === state.myId ? ' (tu)' : ''}
                </span>
                {id === b.holder && b.stage === 'LIVE' && <span className="text-xl">💣</span>}
                <span className="text-sm">{out ? '💀' : hearts(id)}</span>
              </li>
            );
          })}
        </ul>
      </section>

      {b.stage === 'END' ? (
        <EndBar canLead={canLead} hostName={P(state.hostId)?.name} onNewGame={onNewGame} onBackToLobby={onBackToLobby} />
      ) : (
        <BottomBar>
          {iHold ? (
            <button key={b.holder} type="button" onClick={() => onAction('MG_PASS')} className="pop shine h-20 rounded-2xl bg-red-500 text-2xl font-black text-white">
              Passa a {next?.name ?? '…'} ➜
            </button>
          ) : (
            <p className="rounded-2xl border-2 border-slate-700 bg-slate-900/95 py-4 text-center font-bold text-slate-200">
              {b.stage === 'LIVE' ? `Dopo tocca a ${next?.name ?? '…'}` : 'Preparatevi…'}
            </p>
          )}
        </BottomBar>
      )}
    </div>
  );
}
