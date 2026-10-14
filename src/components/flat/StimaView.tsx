import { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { Delete, FastForward, Send, Undo2 } from 'lucide-react';
import type { StimaSlot, StimaView as StimaData } from '../../data/flat/stima';
import { useCountdown } from '../../hooks/useCountdown';
import { haptic, soundManager } from '../../utils/audio';
import { GameChip, PointsPop, Podium, TimerRing } from '../fx';
import { Avatar, BottomBar, EndBar, Ranking, type ModeProps } from '../ui';

const STAGE_SECONDS: Record<StimaData['stage'], number> = { GUESS: 40, BET: 30, REVEAL: 10, END: 0 };
const ROLL_MS = 2600; // quanto "scorre" il numero vero
const ODDS_BG: Record<number, string> = { 2: 'bg-sky-500', 3: 'bg-violet-500', 4: 'bg-fuchsia-500', 5: 'bg-orange-500', 6: 'bg-rose-600' };

// numeri all'italiana (1.234), ma gli anni senza puntino (1492)
const fmt = (n: number, u: string) => (u.startsWith('anno') ? String(n) : n.toLocaleString('it-IT'));
function withUnit(n: number, u: string) {
  const s = fmt(n, u);
  if (!u || u === 'anno') return s;
  if (u.startsWith('anno ')) return `${s} ${u.slice(5)}`;
  if (u.startsWith('°') || u.startsWith('%')) return `${s}${u}`;
  return `${s} ${u}`;
}
const unitHint = (u: string) =>
  !u ? 'Scrivi un numero' : u === 'anno' ? 'Scrivi un anno' : u.startsWith('anno ') ? `Scrivi un anno (${u.slice(5)})` : `Rispondi in: ${u}`;

// il numero vero che sale fino alla risposta (si rallenta alla fine per la suspense)
function useRolling(active: boolean, from: number, to: number) {
  const [shown, setShown] = useState(from);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!active) return;
    setDone(false);
    setShown(from);
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ROLL_MS);
      const e = 1 - Math.pow(1 - k, 3);
      setShown(Math.round(from + (to - from) * e));
      if (k < 1) raf = requestAnimationFrame(step);
      else setDone(true);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [active, from, to]);
  return { shown, done };
}

// 🎯 Più o meno: scrivi una stima, poi scommetti sulla più vicina senza sforare
export default function StimaView({ state, clockOffset, canLead, onAction, onNewGame, onBackToLobby, onForce }: ModeProps) {
  const q = state.mg as StimaData;
  const me = state.myId;
  const P = (id: string) => state.players.find((p) => p.id === id);
  const left = useCountdown(q.stage === 'END' ? null : q.stageEndsAt, clockOffset);
  const playing = q.order.includes(me);
  const online = q.order.filter((id) => P(id)?.isOnline).length;
  const [text, setText] = useState('');
  const reveal = q.stage === 'REVEAL';
  const lowestGuess = q.slots.find((s) => s.value !== null)?.value ?? 0;
  const answer = q.answer ?? 0;
  // si parte poco sotto la stima più bassa (così il numero "passa" sulle caselle), o da zero se sono tutte troppo alte
  const { shown, done } = useRolling(reveal, lowestGuess < answer ? Math.floor(lowestGuess * 0.9) : 0, answer);
  const myGain = q.gained[me] ?? 0;

  useEffect(() => setText(''), [q.round]);
  useEffect(() => {
    if (q.stage === 'GUESS') soundManager.playStart();
    if (q.stage === 'BET') soundManager.playWhoosh();
    if (q.stage === 'REVEAL') soundManager.playDrumroll(ROLL_MS / 1000);
    if (q.stage === 'END') {
      soundManager.playVictory();
      confetti({ particleCount: 160, spread: 100, origin: { y: 0.35 } });
    }
  }, [q.stage, q.round]);
  // finito di scorrere: si accende la casella vincente
  useEffect(() => {
    if (!reveal || !done) return;
    soundManager.playReveal();
    if (myGain > 0) {
      soundManager.playSuccess();
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.5 }, scalar: 0.8 });
    }
  }, [done, reveal]);

  // ---------------------------------------------------------------- fine partita
  if (q.stage === 'END') {
    const ranking = Object.entries(q.scores).sort((a, b) => b[1] - a[1]);
    return (
      <div className="stagger flex flex-col gap-4 pb-28">
        <h2 className="text-center text-3xl text-white">Re delle stime 🎯</h2>
        <Podium state={state} entries={ranking.map(([id, pts]) => ({ id, value: `${pts} fiches` }))} />
        <section className="rounded-3xl border-2 border-white/10 bg-slate-900 p-4">
          <Ranking state={state} scores={q.scores} />
        </section>
        <section className="flex flex-col gap-1.5 rounded-3xl border-2 border-white/10 bg-slate-900 p-3">
          <p className="px-1 text-xs font-black uppercase tracking-widest text-slate-400">Le risposte giuste</p>
          {q.history.map((h, i) => (
            <p key={i} className="flex items-center gap-2 rounded-2xl bg-slate-800 p-2 text-sm text-white">
              <span className="min-w-0 flex-1 font-semibold leading-tight text-slate-200">{h.q}</span>
              <span className="shrink-0 font-display text-base text-amber-300">{withUnit(h.a, h.u)}</span>
            </p>
          ))}
        </section>
        <EndBar canLead={canLead} hostName={P(state.hostId)?.name} onNewGame={onNewGame} onBackToLobby={onBackToLobby} />
      </div>
    );
  }

  const send = () => {
    if (!text) return;
    onAction('MG_GUESS', { value: text });
    haptic(25);
    soundManager.playPop();
  };
  const press = (k: string) => {
    haptic(8);
    if (k === '⌫') setText((t) => t.slice(0, -1));
    else setText((t) => (t === '0' ? k : (t + k).slice(0, 9)));
  };
  const bet = (i: number) => {
    if (q.stage !== 'BET' || !playing) return;
    onAction('MG_BET', { slot: i });
    haptic(20);
    soundManager.playPop();
  };

  const avatars = (ids: string[], size = 22) => (
    <span className="flex -space-x-1.5">
      {ids.slice(0, 6).map((id) => {
        const p = P(id);
        return p ? <Avatar key={id} avatar={p.avatar} color={p.color} size={size} /> : null;
      })}
    </span>
  );

  const waiting = (who: string[], label: string) => (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      <span className="mr-1 text-sm font-bold text-slate-300">{label}</span>
      {q.order.map((id) => {
        const p = P(id);
        if (!p) return null;
        return (
          <span key={id} className={who.includes(id) ? 'pop' : 'opacity-35'}>
            <Avatar avatar={p.avatar} color={p.color} size={30} />
          </span>
        );
      })}
    </div>
  );

  // ---------------------------------------------------------------- tabellone delle stime (dalla più alta in cima)
  const board = () => {
    const rows = q.slots.map((s, i) => ({ s, i })).reverse();
    return (
      <div className="flex flex-col gap-2">
        {rows.map(({ s, i }, k) => {
          const isWin = reveal && done && q.win === i;
          const tooHigh = reveal && done && s.value !== null && s.value > answer;
          const passed = reveal && !done && s.value !== null && s.value <= shown;
          const mine = q.myBets.filter((x) => x === i).length;
          const all = q.bets ? Object.entries(q.bets).map(([id, b]) => ({ id, n: b.filter((x) => x === i).length })).filter((x) => x.n > 0) : [];
          return (
            <button
              key={`${q.round}-${i}`}
              type="button"
              disabled={q.stage !== 'BET' || !playing}
              onClick={() => bet(i)}
              style={{ animationDelay: `${0.04 * k}s` }}
              className={`pop relative flex min-h-[60px] w-full items-center gap-2 rounded-2xl border-4 px-2 py-1.5 text-left transition-all duration-300 disabled:opacity-100 ${
                isWin
                  ? 'scale-[1.03] border-white bg-linear-to-r from-emerald-400 to-teal-600 shadow-[0_0_24px_rgba(52,211,153,0.7)]'
                  : passed
                    ? 'border-amber-300 bg-slate-700'
                    : mine
                      ? 'border-amber-300 bg-slate-800'
                      : 'border-white/10 bg-slate-800'
              } ${tooHigh ? 'opacity-40' : ''}`}
            >
              <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl font-display text-base text-white shadow-[inset_0_-3px_0_rgba(0,0,0,0.25)] ${ODDS_BG[s.odds] ?? 'bg-slate-600'}`}>
                {s.odds}:1
              </span>
              <span className="min-w-0 flex-1">
                {s.value === null ? (
                  <span className="block text-base font-black leading-tight text-white">⬇️ Più basso di tutte</span>
                ) : (
                  <span className="block truncate font-display text-2xl leading-tight text-white">{fmt(s.value, q.unit)}</span>
                )}
                <span className="mt-0.5 flex items-center gap-1">
                  {s.by.length > 0 && avatars(s.by, 18)}
                  {tooHigh && <span className="text-[10px] font-black uppercase text-rose-300">troppo alto</span>}
                  {isWin && <span className="reveal-pop rounded-full bg-white px-2 text-[10px] font-black uppercase text-emerald-700">vince!</span>}
                </span>
              </span>
              {/* fiches: le mie mentre si scommette, quelle di tutti alla rivelazione */}
              {q.stage === 'BET' && mine > 0 && <span className="pop shrink-0 text-2xl tracking-tighter">{'🪙'.repeat(mine)}</span>}
              {reveal && all.length > 0 && (
                <span className="flex max-w-[45%] shrink-0 flex-wrap justify-end gap-1">
                  {all.map(({ id, n }) => {
                    const p = P(id);
                    return p ? (
                      <span key={id} className="flex items-center rounded-full bg-black/25 pr-1.5">
                        <Avatar avatar={p.avatar} color={p.color} size={20} />
                        <span className="ml-0.5 text-[11px] font-black text-amber-200">×{n}</span>
                      </span>
                    ) : null;
                  })}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  const winSlot: StimaSlot | null = q.win !== null ? q.slots[q.win] ?? null : null;
  const winners = Object.entries(q.gained).sort((a, b) => b[1] - a[1]);

  return (
    <div className="stagger flex flex-col gap-3 pb-32">
      <div className="flex items-center justify-between gap-2">
        <GameChip>
          🎯 Round {q.round}/{q.rounds}
        </GameChip>
        <span className="rounded-full bg-amber-400 px-3 py-1 text-sm font-black text-slate-950 shadow-[0_4px_0_rgba(22,6,72,0.4)]">
          {playing ? `🪙 ${q.scores[me] ?? 0}` : '👀 Spettatore'}
        </span>
        <TimerRing left={left} total={STAGE_SECONDS[q.stage]} />
      </div>

      <section
        key={`q-${q.round}`}
        className={`pop relative rounded-3xl border-4 border-white/90 p-4 text-center shadow-[0_8px_0_rgba(22,6,72,0.5)] ${
          q.spicy ? 'bg-linear-to-br from-rose-500 to-red-700' : 'bg-linear-to-br from-violet-500 to-indigo-700'
        }`}
      >
        {q.spicy && <span className="absolute -top-3 right-3 rounded-full bg-white px-2 py-0.5 text-xs font-black text-rose-600">🌶️ piccante</span>}
        <p className={`font-black leading-tight text-white [text-shadow:0_2px_0_rgba(0,0,0,0.2)] ${q.stage === 'GUESS' ? 'text-2xl' : 'text-lg'}`}>{q.question}</p>
        <p className="mt-1.5 text-xs font-black uppercase tracking-widest text-white/80">{unitHint(q.unit)}</p>
      </section>

      {/* ---- fase 1: la stima */}
      {q.stage === 'GUESS' && playing && (
        <>
          <div className="flex items-center gap-2">
            <div className="flex h-16 min-w-0 flex-1 items-center justify-center rounded-2xl border-4 border-amber-300 bg-slate-950 px-3">
              <span className={`truncate font-display text-4xl ${text ? 'text-white' : 'text-slate-600'}`}>{text ? fmt(Number(text), q.unit) : '???'}</span>
            </div>
            <button
              type="button"
              disabled={!text}
              onClick={send}
              aria-label="Invia la stima"
              className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-emerald-500 text-white shadow-[0_5px_0_#065f46] disabled:opacity-40"
            >
              <Send size={26} />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'OK'].map((k) =>
              k === 'OK' ? (
                <button key={k} type="button" disabled={!text} onClick={send} className="h-14 rounded-2xl bg-emerald-500 font-display text-xl text-white shadow-[0_4px_0_#065f46] active:translate-y-1 disabled:opacity-40">
                  Invia
                </button>
              ) : (
                <button
                  key={k}
                  type="button"
                  onClick={() => press(k)}
                  className="grid h-14 place-items-center rounded-2xl bg-slate-800 font-display text-2xl text-white shadow-[0_4px_0_rgba(0,0,0,0.4)] active:translate-y-1"
                >
                  {k === '⌫' ? <Delete size={24} /> : k}
                </button>
              ),
            )}
          </div>
          {q.myGuess !== null ? (
            <p key={q.myGuess} className="pop text-center text-sm font-bold text-emerald-300">
              ✓ La tua stima: {withUnit(q.myGuess, q.unit)} (puoi ancora cambiarla)
            </p>
          ) : (
            <p className="text-center text-xs font-semibold text-slate-400">Non serve indovinare: poi si scommette anche sulle stime degli altri 😉</p>
          )}
        </>
      )}
      {q.stage === 'GUESS' && waiting(q.guessed, 'Hanno scritto:')}

      {/* ---- fase 2: le scommesse */}
      {q.stage === 'BET' && (
        <>
          {playing && (
            <div className="flex items-center justify-between gap-2 rounded-2xl bg-slate-900/90 px-3 py-2">
              <span className="text-sm font-bold leading-tight text-slate-200">Punta sulla stima più vicina che NON supera la risposta vera</span>
              <span className="flex shrink-0 gap-1 text-2xl">
                {Array.from({ length: q.chips }, (_, i) => (
                  <span key={i} className={i < q.chips - q.myBets.length ? '' : 'opacity-25 grayscale'}>
                    🪙
                  </span>
                ))}
              </span>
            </div>
          )}
          {board()}
          {waiting(q.betDone, 'Hanno puntato:')}
        </>
      )}

      {/* ---- rivelazione */}
      {reveal && (
        <>
          <section className="relative rounded-3xl border-4 border-amber-300 bg-slate-950 p-3 text-center shadow-[0_8px_0_rgba(22,6,72,0.5)]">
            <p className="text-xs font-black uppercase tracking-widest text-amber-200">La risposta è…</p>
            <p className={`font-display text-5xl tabular-nums text-white ${done ? 'reveal-pop text-amber-300' : ''}`}>{withUnit(done ? answer : shown, q.unit)}</p>
            {done && winSlot && winSlot.value === answer && <p className="reveal-pop font-display text-xl text-emerald-300">🎯 Centro perfetto!</p>}
            {myGain > 0 && done && <PointsPop points={myGain} className="absolute -top-2 right-4" />}
          </section>
          {q.slots.length > 0 ? board() : <p className="text-center font-bold text-slate-300">Nessuno ha scritto una stima… 😴</p>}
          {done && q.slots.length > 0 && (
            <section className="reveal-pop flex flex-wrap items-center justify-center gap-2 rounded-2xl bg-slate-900/90 p-2">
              {winners.length ? (
                winners.map(([id, pts]) => {
                  const p = P(id);
                  return p ? (
                    <span key={id} className="flex items-center gap-1 rounded-full bg-emerald-500/20 py-0.5 pl-0.5 pr-2 ring-2 ring-emerald-400/60">
                      <Avatar avatar={p.avatar} color={p.color} size={24} />
                      <span className="text-sm font-black text-white">{id === me ? 'Tu' : p.name}</span>
                      <span className="text-sm font-black text-emerald-300">+{pts}</span>
                    </span>
                  ) : null;
                })
              ) : (
                <span className="text-sm font-bold text-slate-300">Nessuno ha puntato sulla casella giusta 😅</span>
              )}
            </section>
          )}
        </>
      )}

      {!playing && q.stage !== 'REVEAL' && <p className="text-center text-sm font-bold text-slate-300">Stai guardando: giocherai dalla prossima partita 👀</p>}

      <BottomBar>
        <div className="flex items-center gap-2">
          {q.stage === 'BET' && playing && q.myBets.length > 0 && (
            <button type="button" onClick={() => onAction('MG_CLEAR')} className="flex h-12 shrink-0 items-center gap-1 rounded-2xl bg-slate-700 px-3 text-sm font-black text-white">
              <Undo2 size={16} /> Riprendi
            </button>
          )}
          <p className="min-w-0 flex-1 truncate rounded-2xl border-2 border-slate-700 bg-slate-900/95 px-4 py-3 text-sm font-bold text-slate-200">
            {q.stage === 'GUESS'
              ? `Stime: ${q.guessed.length}/${online}`
              : q.stage === 'BET'
                ? q.myBets.length >= q.chips
                  ? `Fiches piazzate ✓ · ${q.betDone.length}/${online}`
                  : `Tocca una casella · ${q.betDone.length}/${online} pronti`
                : q.round >= q.rounds
                  ? 'Ultima domanda! Ecco il podio…'
                  : 'Prossima domanda tra poco…'}
          </p>
          {canLead && (
            <button type="button" onClick={onForce} className="flex h-12 shrink-0 items-center gap-1 rounded-2xl bg-slate-800 px-3 text-sm font-black text-amber-200">
              <FastForward size={16} /> Avanti
            </button>
          )}
        </div>
      </BottomBar>
    </div>
  );
}
