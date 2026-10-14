import { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { FastForward, Minus, Plus } from 'lucide-react';
import type { DadiView as DadiData } from '../types/game';
import { useCountdown } from '../hooks/useCountdown';
import { haptic, soundManager } from '../utils/audio';
import { Die, GameChip, TimerRing } from './fx';
import { Avatar, BottomBar, EndBar, type ModeProps } from './ui';

const NUMBERS = ['zero', 'uno', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove', 'dieci'];
const say = (q: number) => NUMBERS[q] ?? String(q);

// Rilancio valido: più dadi, oppure stessi dadi con una faccia più alta
const beats = (q: number, f: number, bid: { q: number; f: number } | null) => !bid || q > bid.q || (q === bid.q && f > bid.f);

// 🎲 Dadi bugiardi: ognuno vede solo i suoi dadi; si scommette su quanti ce ne sono in tutto, oppure si dubita
export default function DadiView({ state, clockOffset, canLead, onAction, onNewGame, onBackToLobby, onForce }: ModeProps) {
  const d = state.mg as DadiData;
  const P = (id: string | null) => state.players.find((p) => p.id === id);
  const left = useCountdown(d.stage === 'END' ? null : d.stageEndsAt, clockOffset);
  const myTurn = d.stage === 'BID' && d.current === state.myId;
  const current = P(d.current);
  const r = d.reveal;
  const [q, setQ] = useState(1);
  const [f, setF] = useState(2);

  // a ogni turno, proposta di partenza: il rilancio più piccolo possibile
  useEffect(() => {
    if (!myTurn) return;
    if (!d.bid) {
      setQ(1);
      setF(2);
    } else if (d.bid.f < 6) {
      setQ(d.bid.q);
      setF(d.bid.f + 1);
    } else {
      setQ(d.bid.q + 1);
      setF(2);
    }
    soundManager.playPop();
    haptic(60);
  }, [myTurn, d.bid?.q, d.bid?.f]);

  useEffect(() => {
    if (d.stage === 'REVEAL') soundManager.playDrumroll(0.7);
    if (d.stage === 'BID' && d.history.length === 0) soundManager.playWhoosh(); // dadi nuovi
    if (d.stage === 'END') {
      soundManager.playVictory();
      confetti({ particleCount: 160, spread: 90, origin: { y: 0.35 } });
    }
  }, [d.stage, d.round]);

  const winner = P(d.winner);
  if (d.stage === 'END') {
    return (
      <div className="stagger flex flex-col gap-4">
        <section className="pop flex flex-col items-center gap-2 rounded-3xl border-4 border-white/90 bg-slate-900 p-6 text-center shadow-[0_8px_0_rgba(22,6,72,0.5)]">
          <p className="text-xs font-black uppercase tracking-widest text-amber-300">Il bugiardo più bravo</p>
          {winner && <Avatar avatar={winner.avatar} color={winner.color} size={96} />}
          <p className="font-display text-4xl text-white">{winner ? `${winner.name} vince!` : 'Fine partita'}</p>
          <div className="flex gap-1.5">
            {[6, 5, 4].map((v, i) => (
              <Die key={i} value={v} size={34} className="wiggle" />
            ))}
          </div>
        </section>
        <EndBar canLead={canLead} hostName={P(state.hostId)?.name} onNewGame={onNewGame} onBackToLobby={onBackToLobby} />
      </div>
    );
  }

  const valid = q >= 1 && q <= d.totalDice && beats(q, f, d.bid);

  return (
    <div className="stagger flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <GameChip>
          🎲 Mano {d.round} · {d.totalDice} dadi in gioco
        </GameChip>
        <TimerRing left={left} total={d.stage === 'BID' ? 35 : 9} />
      </div>

      {/* Scommessa in corso */}
      <section className="rounded-3xl border-4 border-white/90 bg-linear-to-br from-slate-700 to-slate-950 p-4 text-center shadow-[0_8px_0_rgba(22,6,72,0.5)]">
        {d.bid ? (
          <div key={`${d.bid.q}-${d.bid.f}`} className="pop">
            <p className="text-sm font-bold text-slate-300">{P(d.bid.by)?.name} dice che ci sono almeno</p>
            <div className="mt-1 flex items-center justify-center gap-3">
              <span className="font-display text-6xl leading-none text-amber-300">{d.bid.q}</span>
              <span className="font-display text-4xl text-white">×</span>
              <Die value={d.bid.f} size={58} />
            </div>
          </div>
        ) : (
          <p className="py-3 font-display text-2xl text-white">{myTurn ? 'Apri tu la prima scommessa!' : `${current?.name ?? '…'} apre la scommessa`}</p>
        )}
        <p className="mt-2 text-xs font-bold text-slate-300">Gli 1 (pallino rosso) sono jolly: valgono come qualsiasi faccia</p>
      </section>

      {/* Rivelazione */}
      {d.stage === 'REVEAL' && r && (
        <section className="reveal-pop rounded-3xl border-4 border-amber-300 bg-slate-900 p-4 text-center">
          <p className="font-display text-2xl text-white">
            {P(r.caller)?.name}: «DUBITO!» 🤨
          </p>
          <p className="mt-1 font-bold text-slate-200">
            C’erano <span className="font-display text-2xl text-amber-300">{r.total}</span> dadi da {r.f} (jolly compresi): servivano {r.q}
          </p>
          <p className="mt-1 font-display text-xl text-red-300">
            {r.total >= r.q ? 'La scommessa era vera!' : 'Era una bugia!'} {P(r.loser)?.name} perde un dado 🎲
          </p>
        </section>
      )}

      {/* I miei dadi */}
      {d.myDice.length > 0 && d.stage === 'BID' && (
        <section className="rounded-3xl border-2 border-white/10 bg-slate-900 p-4">
          <p className="mb-2 text-center text-sm font-black text-slate-300">I tuoi dadi (solo tu li vedi)</p>
          <div key={d.round} className="flex flex-wrap justify-center gap-2">
            {d.myDice.map((v, i) => (
              <span key={i} className="dice-roll" style={{ animationDelay: `${i * 0.08}s` }}>
                <Die value={v} size={52} />
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Giocatori: dadi rimasti (e alla rivelazione tutti i dadi scoperti) */}
      <section className="flex flex-col gap-1.5 rounded-3xl border-2 border-white/10 bg-slate-900 p-3">
        {d.order.map((id) => {
          const p = P(id);
          if (!p) return null;
          const out = d.counts[id] <= 0 && !(d.allDice?.[id]?.length);
          const dice = d.allDice?.[id];
          return (
            <div
              key={id}
              className={`flex items-center gap-2 rounded-2xl px-2 py-1.5 ${d.current === id ? 'bg-amber-400/20 ring-2 ring-amber-300' : ''} ${r?.loser === id ? 'bg-red-500/20' : ''} ${out ? 'opacity-40' : ''}`}
            >
              <Avatar avatar={p.avatar} color={p.color} size={32} />
              <span className="min-w-0 flex-1 truncate font-bold text-white">
                {p.name}
                {id === state.myId ? ' (tu)' : ''}
              </span>
              {dice ? (
                <span className="flex flex-wrap justify-end gap-1">
                  {dice.map((v, i) => (
                    <span key={i} className="reveal-pop" style={{ animationDelay: `${0.3 + i * 0.07}s` }}>
                      <Die value={v} size={26} highlight={!!r && (v === r.f || v === 1)} dim={!!r && v !== r.f && v !== 1} />
                    </span>
                  ))}
                </span>
              ) : (
                <span className="text-sm font-black text-slate-300">{out ? '💀' : `🎲 × ${d.counts[id]}`}</span>
              )}
            </div>
          );
        })}
      </section>

      {d.history.length > 0 && d.stage === 'BID' && (
        <div className="flex flex-wrap justify-center gap-1.5">
          {d.history.map((b, i) => (
            <span key={i} className="flex items-center gap-1 rounded-full bg-slate-900/80 py-0.5 pl-2 pr-1 text-xs font-bold text-slate-300">
              {P(b.by)?.name}: {b.q} ×<Die value={b.f} size={18} />
            </span>
          ))}
        </div>
      )}

      {/* Il mio turno: rilancia o dubita */}
      {myTurn && (
        <section className="pop flex flex-col gap-3 rounded-3xl border-2 border-amber-400/70 bg-slate-900 p-4">
          <p className="text-center font-display text-xl text-white">Rilancia: quanti dadi e di che faccia?</p>
          <div className="flex items-center justify-center gap-3">
            <button type="button" onClick={() => setQ((x) => Math.max(1, x - 1))} aria-label="Meno" className="grid h-12 w-12 place-items-center rounded-full bg-slate-700 text-white">
              <Minus size={22} />
            </button>
            <span className="w-16 text-center font-display text-5xl text-amber-300">{q}</span>
            <button type="button" onClick={() => setQ((x) => Math.min(d.totalDice, x + 1))} aria-label="Più" className="grid h-12 w-12 place-items-center rounded-full bg-slate-700 text-white">
              <Plus size={22} />
            </button>
          </div>
          <div className="flex justify-center gap-2">
            {[2, 3, 4, 5, 6].map((v) => (
              <button key={v} type="button" onClick={() => setF(v)} aria-label={`Faccia ${v}`} className={`rounded-[26%] p-0.5 ${f === v ? 'bg-amber-400' : ''}`}>
                <Die value={v} size={46} />
              </button>
            ))}
          </div>
          {!valid && <p className="text-center text-xs font-bold text-red-300">Devi dire più dadi, oppure gli stessi con una faccia più alta.</p>}
        </section>
      )}

      <BottomBar>
        {myTurn ? (
          <div className={`grid gap-2 ${d.bid ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <button
              type="button"
              disabled={!valid}
              onClick={() => onAction('MG_BID', { q, f })}
              className="h-16 rounded-2xl bg-amber-400 text-lg font-black leading-tight text-slate-950 disabled:opacity-50"
            >
              Dico {say(q)} da {f}
            </button>
            {d.bid && (
              <button type="button" onClick={() => onAction('MG_DOUBT')} className="h-16 rounded-2xl bg-red-500 text-2xl font-black text-white">
                DUBITO! 🤨
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-slate-700 bg-slate-900/95 px-4 py-3 text-sm font-bold text-slate-200">
            <span className="min-w-0 truncate">
              {d.stage === 'REVEAL' ? 'Nuova mano tra poco…' : `Tocca a ${current?.name ?? '…'}: rilancia o dubita?`}
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
