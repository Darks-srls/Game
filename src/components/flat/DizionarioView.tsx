import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { Check, FastForward, Send } from 'lucide-react';
import type { DizionarioView as DizData, DizOption } from '../../data/flat/dizionario';
import { useCountdown } from '../../hooks/useCountdown';
import { haptic, soundManager } from '../../utils/audio';
import { GameChip, Podium, PointsPop, TimerRing } from '../fx';
import { Avatar, BottomBar, EndBar, Ranking, type ModeProps } from '../ui';

const LETTERS = 'ABCDEFGHIJKL';
const STAGE_SECONDS: Record<DizData['stage'], number> = { WRITE: 90, VOTE: 45, REVEAL: 20, END: 0 };
// come sul server: le carte si girano una alla volta
const REVEAL_START_MS = 1_500;
const REVEAL_STEP_MS = 1_700;

// in che ordine si girano le carte: prima le bugie meno votate, la vera per ultima
function revealOrder(options: DizOption[]) {
  return options
    .map((o, i) => ({ i, votes: o.voters?.length ?? 0, real: !!o.real }))
    .sort((a, b) => Number(a.real) - Number(b.real) || a.votes - b.votes)
    .map((x) => x.i);
}

// quante carte sono già girate (calcolato sul telefono dall'ora del server)
function useRevealed(revealAt: number | null, offset: number, total: number) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!revealAt) {
      setN(0);
      return;
    }
    const calc = () => Math.max(0, Math.min(total, Math.floor((Date.now() + offset - revealAt - REVEAL_START_MS) / REVEAL_STEP_MS) + 1));
    setN(calc());
    const id = setInterval(() => setN(calc()), 150);
    return () => clearInterval(id);
  }, [revealAt, offset, total]);
  return n;
}

// secondi che mancano, senza tic-tac (durante la rivelazione)
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

// 📖 Il dizionario: inventa definizioni credibili e scova quella vera
export default function DizionarioView({ state, clockOffset, canLead, onAction, onNewGame, onBackToLobby, onForce }: ModeProps) {
  const q = state.mg as DizData;
  const me = state.myId;
  const P = (id: string) => state.players.find((p) => p.id === id);
  const tense = q.stage === 'WRITE' || q.stage === 'VOTE';
  const loud = useCountdown(tense ? q.stageEndsAt : null, clockOffset);
  const quiet = useQuietLeft(q.stage === 'REVEAL' ? q.stageEndsAt : null, clockOffset);
  const left = tense ? loud : quiet;
  const playing = q.order.includes(me) && me in q.scores;
  const players = Object.keys(q.scores);
  const online = players.filter((id) => P(id)?.isOnline).length;
  const [text, setText] = useState(q.myDef ?? '');
  const order = q.stage === 'REVEAL' || q.stage === 'END' ? revealOrder(q.options) : [];
  const revealed = useRevealed(q.stage === 'REVEAL' ? q.revealAt : null, clockOffset, order.length);
  const allRevealed = q.stage !== 'REVEAL' || revealed >= order.length;
  const shown = new Set(order.slice(0, revealed));
  const current = order[revealed - 1];
  const lastSound = useRef(0);

  useEffect(() => setText(q.myDef ?? ''), [q.round]);

  // suoni uguali per tutti
  useEffect(() => {
    if (q.stage === 'VOTE') soundManager.playReveal();
    if (q.stage === 'END') {
      soundManager.playVictory();
      confetti({ particleCount: 150, spread: 90, origin: { y: 0.35 } });
    }
  }, [q.stage, q.round]);
  useEffect(() => {
    if (q.stage !== 'REVEAL' || revealed === lastSound.current) return;
    lastSound.current = revealed;
    if (!revealed) return;
    const o = q.options[order[revealed - 1]];
    if (o?.real) {
      soundManager.playSuccess();
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.5 } });
    } else soundManager.playPop();
    // prima della vera, rullo di tamburi
    if (revealed === order.length - 1) soundManager.playDrumroll(1.4);
  }, [revealed, q.stage]);
  useEffect(() => {
    lastSound.current = 0;
  }, [q.round]);

  const leadButton = canLead && (
    <button type="button" onClick={onForce} className="flex h-14 shrink-0 items-center gap-1 rounded-2xl bg-slate-800 px-3 text-sm font-black text-amber-200">
      <FastForward size={16} /> Avanti
    </button>
  );

  if (q.stage === 'END') {
    const ranking = Object.entries(q.scores).sort((x, y) => y[1] - x[1]);
    return (
      <div className="stagger flex flex-col gap-4">
        <h2 className="text-center text-3xl text-white">Il più grande bugiardo erudito 🎓</h2>
        <Podium state={state} entries={ranking.map(([id, points]) => ({ id, value: `${points} punti` }))} />
        <section className="rounded-3xl border-2 border-white/10 bg-slate-900 p-4">
          <Ranking state={state} scores={q.scores} />
        </section>
        <EndBar canLead={canLead} hostName={P(state.hostId)?.name} onNewGame={onNewGame} onBackToLobby={onBackToLobby} />
      </div>
    );
  }

  const send = () => {
    const t = text.trim();
    if (!t) return;
    onAction('MG_DEF', { text: t });
    haptic(20);
  };

  const wordCard = (
    <section
      key={q.round}
      className="pop relative overflow-hidden rounded-3xl border-4 border-white/90 bg-linear-to-br from-amber-200 via-amber-300 to-orange-400 p-5 text-center shadow-[0_8px_0_rgba(22,6,72,0.5)]"
    >
      <span className="pointer-events-none absolute -right-3 -top-4 rotate-12 text-7xl opacity-25">📖</span>
      <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-950/60">Che cosa vuol dire…</p>
      <p className="mt-1 break-words font-display text-5xl leading-tight text-slate-950">{q.word}</p>
      <p className="mt-1 font-serif text-base italic text-slate-900/70">{q.cat}</p>
    </section>
  );

  const waiting = (who: string[], label: string) => (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      <span className="mr-1 text-sm font-bold text-slate-300">{label}</span>
      {players.map((id) => {
        const p = P(id);
        if (!p) return null;
        const done = who.includes(id);
        return (
          <span key={id} className={`relative ${done ? '' : 'opacity-40'}`}>
            <Avatar avatar={p.avatar} color={p.color} size={32} />
            {done && (
              <span className="absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full bg-emerald-500 text-white">
                <Check size={11} strokeWidth={4} />
              </span>
            )}
          </span>
        );
      })}
    </div>
  );

  const faces = (ids: string[], size = 26) => (
    <span className="flex flex-wrap gap-1">
      {ids.map((id, k) => {
        const p = P(id);
        return p ? (
          <span key={id} className="reveal-pop" style={{ animationDelay: `${0.15 + k * 0.08}s` }}>
            <Avatar avatar={p.avatar} color={p.color} size={size} />
          </span>
        ) : null;
      })}
    </span>
  );

  // una definizione (voto o rivelazione)
  const optionCard = (o: DizOption, i: number) => {
    const reveal = q.stage === 'REVEAL';
    const open = reveal && shown.has(i);
    const chosen = q.myVote === i;
    const canPick = q.stage === 'VOTE' && playing && !o.mine;
    const isNow = reveal && current === i && !allRevealed;
    const good = open && (o.real || o.marked);
    return (
      <button
        key={i}
        type="button"
        disabled={!canPick}
        onClick={() => {
          onAction('MG_VOTE', { i });
          haptic(20);
          soundManager.playClick();
        }}
        style={{ animationDelay: `${0.05 + i * 0.06}s` }}
        className={`pop relative flex w-full flex-col gap-2 rounded-2xl border-4 p-3 text-left transition-all disabled:opacity-100 ${
          open
            ? good
              ? 'border-emerald-300 bg-linear-to-br from-emerald-500 to-teal-700'
              : 'border-rose-300/70 bg-slate-800'
            : chosen
              ? 'border-amber-300 bg-amber-400/20'
              : o.mine
                ? 'border-slate-700 bg-slate-900/70'
                : 'border-white/15 bg-slate-900'
        } ${isNow ? 'scale-[1.02] shadow-[0_0_0_4px_rgba(255,208,46,0.6)]' : ''}`}
      >
        <span className="flex items-start gap-3">
          <span
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-full font-display text-lg ${chosen && !open ? 'bg-amber-400 text-slate-950' : 'bg-white/90 text-slate-950'}`}
          >
            {LETTERS[i]}
          </span>
          <span className={`font-serif text-lg leading-snug ${open && !good ? 'text-slate-300' : 'text-white'}`}>{o.text}</span>
        </span>
        {q.stage === 'VOTE' && o.mine && <span className="self-start rounded-full bg-slate-700 px-2 py-0.5 text-[11px] font-black text-slate-200">✍️ la tua (non puoi votarla)</span>}
        {q.stage === 'VOTE' && chosen && <span className="self-start rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-black text-slate-950">✓ Il tuo voto</span>}
        {open && (
          <span key="open" className="reveal-pop flex flex-col gap-1.5">
            {o.real ? (
              <span className="self-start rounded-full bg-white px-3 py-0.5 text-xs font-black uppercase text-emerald-700">📖 La definizione vera!</span>
            ) : (
              <span className="flex flex-wrap items-center gap-1.5 text-xs font-black text-white">
                <span className="rounded-full bg-rose-500 px-2 py-0.5 uppercase">{o.marked ? '✅ Giusta anche questa!' : '🤥 Bugia di'}</span>
                {(o.authors ?? []).map((id) => (
                  <span key={id} className="flex items-center gap-1">
                    {P(id) && <Avatar avatar={P(id)!.avatar} color={P(id)!.color} size={22} />}
                    {P(id)?.name ?? '?'}
                  </span>
                ))}
              </span>
            )}
            <span className="flex items-center gap-2 text-xs font-bold text-white/85">
              {(o.voters ?? []).length ? (
                <>
                  <span>🗳️ {(o.voters ?? []).length}</span>
                  {faces(o.voters ?? [])}
                </>
              ) : (
                <span>Nessuno ci è cascato</span>
              )}
            </span>
          </span>
        )}
        {reveal && !open && <span className="self-start rounded-full bg-slate-700 px-2 py-0.5 text-[11px] font-black text-slate-300">{isNow ? '…' : '❓'}</span>}
      </button>
    );
  };

  return (
    <div className="stagger flex flex-col gap-4 pb-36">
      <div className="flex items-center justify-between gap-2">
        <GameChip>
          📖 Parola {q.round}/{q.rounds}
        </GameChip>
        <TimerRing left={left} total={q.stage === 'REVEAL' ? Math.round((REVEAL_START_MS + q.options.length * REVEAL_STEP_MS) / 1000) + 9 : STAGE_SECONDS[q.stage]} />
      </div>

      {wordCard}

      {/* scrivere la definizione */}
      {q.stage === 'WRITE' &&
        (playing ? (
          <>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="flex flex-col gap-2"
            >
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value.replace(/\n/g, ' ').slice(0, 150))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={3}
                placeholder="Inventa una definizione credibile, in stile dizionario…"
                enterKeyHint="send"
                className="w-full resize-none rounded-2xl border-2 border-slate-700 bg-slate-950 p-3 font-serif text-lg text-white outline-none placeholder:text-slate-500 focus:border-amber-400"
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-500">{text.length}/150</span>
                <button type="submit" disabled={!text.trim()} className="flex h-12 items-center gap-2 rounded-2xl bg-emerald-500 px-5 font-black text-white disabled:opacity-40">
                  <Send size={18} /> {q.myDef ? 'Aggiorna' : 'Invia'}
                </button>
              </div>
            </form>
            {q.myDef && <p className="pop text-center text-sm font-bold text-emerald-300">✓ Inviata! Puoi ancora cambiarla finché tutti hanno scritto.</p>}
            <p className="text-center text-xs font-semibold text-slate-400">
              Breve e seria, come in un vero dizionario: più è credibile, più amici ci cascano (+1 a testa). La conosci davvero? Scrivila giusta: +3!
            </p>
          </>
        ) : (
          <p className="pop text-center font-bold text-slate-200">👀 Stai guardando: gli altri inventano definizioni…</p>
        ))}
      {q.stage === 'WRITE' && waiting(q.written, 'Hanno scritto:')}

      {/* votare */}
      {q.stage === 'VOTE' && (
        <>
          <p className="text-center text-lg font-black text-white">{playing ? 'Qual è la definizione VERA? 🤔' : 'Si vota la definizione vera…'}</p>
          <div className="flex flex-col gap-2">{q.options.map((o, i) => optionCard(o, i))}</div>
          {waiting(q.voted, 'Hanno votato:')}
        </>
      )}

      {/* rivelazione */}
      {q.stage === 'REVEAL' && (
        <>
          <div className="flex flex-col gap-2">{q.options.map((o, i) => optionCard(o, i))}</div>
          {allRevealed && (
            <>
              {q.exact.length > 0 && (
                <p className="reveal-pop text-center font-black text-emerald-300">
                  🎯 {q.exact.map((id) => P(id)?.name ?? '?').join(', ')} {q.exact.length > 1 ? 'conoscevano' : 'conosceva'} la parola: +3!
                </p>
              )}
              {canLead && q.options.some((o) => !o.real) && (
                <div className="pop rounded-2xl border-2 border-dashed border-amber-300/60 bg-slate-900 p-3">
                  <p className="mb-2 text-center text-xs font-black uppercase tracking-wider text-amber-200">Qualcuno ci ha preso? Segnala le definizioni giuste</p>
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {q.options.map((o, i) =>
                      o.real ? null : (
                        <button
                          key={i}
                          type="button"
                          onClick={() => onAction('MG_MARK', { i })}
                          className={`h-10 min-w-12 rounded-xl px-3 font-display text-lg ${o.marked ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-200'}`}
                        >
                          {LETTERS[i]} {o.marked ? '✓' : ''}
                        </button>
                      ),
                    )}
                  </div>
                </div>
              )}
              <section className="pop rounded-3xl border-2 border-white/10 bg-slate-900 p-3">
                <p className="mb-2 text-center text-xs font-black uppercase tracking-widest text-slate-400">Punti di questo round</p>
                <div className="flex flex-col gap-1.5">
                  {players
                    .map((id) => ({ id, g: q.gained[id] ?? 0 }))
                    .sort((a, b) => b.g - a.g)
                    .map(({ id, g }, k) => {
                      const p = P(id);
                      if (!p) return null;
                      return (
                        <p key={id} style={{ animationDelay: `${0.1 + k * 0.08}s` }} className="pop flex items-center gap-2 rounded-2xl bg-slate-800 p-2 font-bold text-white">
                          <Avatar avatar={p.avatar} color={p.color} size={28} />
                          <span className="flex-1 truncate">
                            {p.name}
                            {id === me ? ' (tu)' : ''}
                          </span>
                          <span className="relative font-display text-xl text-amber-300">
                            +{g}
                            <PointsPop points={g} className="absolute -top-5 right-0" />
                          </span>
                          <span className="w-12 text-right text-xs font-black text-slate-400">tot {(q.scores[id] ?? 0) + g}</span>
                        </p>
                      );
                    })}
                </div>
              </section>
            </>
          )}
        </>
      )}

      <BottomBar>
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate rounded-2xl border-2 border-slate-700 bg-slate-900/95 px-4 py-3 text-sm font-bold text-slate-200">
            {q.stage === 'WRITE'
              ? `Definizioni: ${q.written.length}/${online}`
              : q.stage === 'VOTE'
                ? q.myVote !== null
                  ? `Votato ${LETTERS[q.myVote]} ✓ · ${q.voted.length}/${online}`
                  : `Voti: ${q.voted.length}/${online}`
                : allRevealed
                  ? q.round >= q.rounds
                    ? 'Classifica finale tra poco… 🏆'
                    : 'Prossima parola tra poco…'
                  : 'Chi ci è cascato? 🥁'}
          </p>
          {leadButton}
        </div>
      </BottomBar>
    </div>
  );
}
