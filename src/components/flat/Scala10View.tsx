import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { motion, Reorder, useDragControls } from 'motion/react';
import { Check, FastForward, GripVertical, Plus, Send, X } from 'lucide-react';
import type { Scala10View as S10Data } from '../../data/flat/scala10';
import { useCountdown } from '../../hooks/useCountdown';
import { haptic, soundManager } from '../../utils/audio';
import { GameChip, TimerRing } from '../fx';
import { Avatar, BottomBar, EndBar, type ModeProps } from '../ui';

const STAGE_SECONDS: Record<S10Data['stage'], number> = { WRITE: 60, ORDER: 120, REVEAL: 0, END: 0 };
// tempi della rivelazione: uguali al server (una carta ogni 1,2 s dopo una pausa)
const REVEAL_FIRST = 1_800;
const REVEAL_STEP = 1_200;
const revealMs = (n: number) => 4_000 + REVEAL_STEP * n + 5_000;

// colore del numero: verde (1) → giallo → rosso (10)
const numColor = (n: number) => `hsl(${Math.round(130 - ((Math.min(10, Math.max(1, n)) - 1) * 130) / 9)} 80% 45%)`;

function judgement(score: number, max: number, lives: number) {
  if (lives <= 0) return { emoji: '💀', text: 'Vite finite! Ma vi conoscete davvero?' };
  const k = max ? score / max : 0;
  if (k >= 0.95) return { emoji: '🔮', text: 'Telepatia pura: leggete nel pensiero!' };
  if (k >= 0.8) return { emoji: '🤝', text: 'Affiatatissimi: una mente sola' };
  if (k >= 0.65) return { emoji: '🙂', text: 'Buona intesa, niente male!' };
  if (k >= 0.45) return { emoji: '😅', text: 'Si può fare di meglio…' };
  return { emoji: '🙈', text: 'Parlate lingue diverse' };
}

// orologio del telefono allineato al server (per animare la rivelazione uguale per tutti)
function useServerNow(offset: number, active: boolean) {
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now() + offset), 150);
    return () => clearInterval(t);
  }, [offset, active]);
  return now;
}

// una risposta nella fila del capitano: si trascina dalla maniglia, la ✕ la rimette tra quelle da sistemare
function LineItem({ id, pos, text, onRemove, onDrop }: { id: number; pos: number; text: string; onRemove: () => void; onDrop: () => void }) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={id}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDrop}
      className="flex items-center gap-2 rounded-2xl border-2 border-white/80 bg-white p-1.5 pl-2 text-slate-950 shadow-[0_3px_0_rgba(22,6,72,0.45)]"
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-900 font-display text-base text-white">{pos}</span>
      <span className="min-w-0 flex-1 text-[15px] font-bold leading-snug [overflow-wrap:anywhere]">{text}</span>
      <button type="button" onClick={onRemove} aria-label="Togli dalla fila" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-200 text-slate-600">
        <X size={18} />
      </button>
      <span
        onPointerDown={(e) => controls.start(e)}
        style={{ touchAction: 'none' }}
        aria-label="Trascina"
        className="grid h-11 w-9 shrink-0 cursor-grab place-items-center rounded-xl bg-amber-300 text-slate-900 active:cursor-grabbing"
      >
        <GripVertical size={20} />
      </span>
    </Reorder.Item>
  );
}

// 🔟 Da 1 a 10: rispondi col tuo numero segreto, il capitano mette le risposte in fila
export default function Scala10View({ state, clockOffset, canLead, onAction, onNewGame, onBackToLobby, onForce }: ModeProps) {
  const q = state.mg as S10Data;
  const me = state.myId;
  const P = (id: string) => state.players.find((p) => p.id === id);
  const left = useCountdown(q.stage === 'END' || q.stage === 'REVEAL' ? null : q.stageEndsAt, clockOffset);
  const iCaptain = q.captain === me;
  const captain = P(q.captain);
  const [text, setText] = useState('');
  const [line, setLine] = useState<number[]>(q.arrange);
  const lineRef = useRef(line);
  lineRef.current = line;
  const dragging = useRef(false);
  const answerOf = (id: number) => q.answers.find((a) => a.id === id);

  // la fila arriva dal server (anche per il capitano, se non sta trascinando)
  useEffect(() => {
    if (!dragging.current) setLine(q.arrange);
  }, [q.arrange.join(','), q.round]);
  useEffect(() => setText(''), [q.round]);

  // rivelazione: quante carte sono già girate (calcolato dall'ora del server: tutti insieme)
  const now = useServerNow(clockOffset, q.stage === 'REVEAL');
  const nResult = q.result?.length ?? 0;
  const revealStart = (q.stageEndsAt ?? 0) - revealMs(nResult);
  const shown = q.stage === 'REVEAL' ? Math.max(0, Math.min(nResult, Math.floor((now - revealStart - REVEAL_FIRST) / REVEAL_STEP) + 1)) : nResult;
  const allShown = shown >= nResult;
  // vite e punti scendono/salgono carta dopo carta (il server li ha già contati: niente spoiler)
  const seen = q.stage === 'REVEAL' ? (q.result ?? []).slice(0, shown) : [];
  const lives = q.stage === 'REVEAL' ? q.lives + q.lost - seen.filter((r) => !r.ok).length : q.lives;
  const score = q.stage === 'REVEAL' ? q.score - q.gained + seen.filter((r) => r.ok).length : q.score;

  // suoni uguali per tutti
  useEffect(() => {
    if (q.stage === 'WRITE') soundManager.playWhoosh();
    if (q.stage === 'ORDER') soundManager.playReveal();
    if (q.stage === 'REVEAL' && nResult) soundManager.playDrumroll(1.6);
    if (q.stage === 'END') {
      soundManager.playVictory();
      if (q.lives > 0) confetti({ particleCount: 150, spread: 90, origin: { y: 0.35 } });
    }
  }, [q.stage, q.round]);
  const lastShown = useRef(0);
  useEffect(() => {
    if (q.stage !== 'REVEAL') {
      lastShown.current = 0;
      return;
    }
    if (shown > lastShown.current && shown > 0) {
      const r = q.result?.[shown - 1];
      if (r?.ok) soundManager.playPop();
      else if (r) soundManager.playError();
      if (shown === nResult && q.lost === 0) setTimeout(() => soundManager.playSuccess(), 700);
    }
    lastShown.current = shown;
  }, [shown, q.stage]);

  const hearts = (
    <div className="flex items-center justify-center gap-0.5">
      {Array.from({ length: q.maxLives }, (_, i) => (
        <span key={`${i}-${i < lives}`} className={`text-lg leading-none ${i < lives ? '' : 'pop opacity-60 grayscale'}`}>
          {i < lives ? '❤️' : '🖤'}
        </span>
      ))}
    </div>
  );

  // ---------------------------------------------------------------- fine partita
  if (q.stage === 'END') {
    const j = judgement(q.score, q.maxScore, q.lives);
    return (
      <div className="stagger flex flex-col gap-4 pb-28">
        <h2 className="text-center text-3xl text-white">Com’è andata?</h2>
        <section className="pop rounded-3xl border-4 border-white/90 bg-linear-to-br from-fuchsia-500 to-indigo-700 p-5 text-center shadow-[0_8px_0_rgba(22,6,72,0.5)]">
          <p className="text-6xl">{j.emoji}</p>
          <p className="font-display text-7xl leading-none text-white [text-shadow:0_4px_0_rgba(0,0,0,0.25)]">
            {q.score}
            <span className="text-3xl text-white/80">/{q.maxScore}</span>
          </p>
          <p className="mt-1 text-xs font-black uppercase tracking-widest text-white/80">risposte al posto giusto</p>
          <div className="mt-2">{hearts}</div>
          <p className="mt-2 text-xl font-black text-white">{j.text}</p>
        </section>
        <section className="flex flex-col gap-1.5 rounded-3xl border-2 border-white/10 bg-slate-900 p-3">
          {q.history.map((h, i) => {
            const p = P(h.captain);
            const perfect = h.ok === h.total;
            return (
              <p key={i} className="flex items-center gap-2 rounded-2xl bg-slate-800 p-2 text-sm font-bold text-white">
                {p && <Avatar avatar={p.avatar} color={p.color} size={28} />}
                <span className="min-w-0 flex-1 truncate">{h.theme}</span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-black ${perfect ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                  {perfect ? '🌟 ' : ''}
                  {h.ok}/{h.total}
                </span>
              </p>
            );
          })}
        </section>
        <EndBar canLead={canLead} hostName={P(state.hostId)?.name} onNewGame={onNewGame} onBackToLobby={onBackToLobby} />
      </div>
    );
  }

  // ---------------------------------------------------------------- pezzi comuni
  const themeCard = (
    <section key={q.round} className="pop rounded-3xl border-4 border-white/90 bg-linear-to-br from-fuchsia-500 to-indigo-700 p-4 text-center shadow-[0_8px_0_rgba(22,6,72,0.5)]">
      <p className="text-xs font-black uppercase tracking-widest text-white/75">Il tema</p>
      <p className={`font-display leading-tight text-white [text-shadow:0_3px_0_rgba(0,0,0,0.25)] ${q.stage === 'ORDER' ? 'text-xl' : 'text-[28px]'}`}>{q.theme.t}</p>
      <div className="mt-3 h-3 rounded-full bg-linear-to-r from-emerald-400 via-amber-300 to-rose-500 shadow-inner" />
      <div className="mt-1 flex justify-between gap-3 text-left text-xs font-black text-white">
        <span>
          <b className="font-display text-base">1</b> = {q.theme.lo}
        </span>
        <span className="text-right">
          <b className="font-display text-base">10</b> = {q.theme.hi}
        </span>
      </div>
    </section>
  );

  const waiting = (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      <span className="mr-1 text-sm font-bold text-slate-300">Hanno scritto:</span>
      {q.writers.map((id) => {
        const p = P(id);
        if (!p) return null;
        const done = q.written.includes(id);
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

  const send = () => {
    const t = text.trim();
    if (!t) return;
    onAction('MG_ANSWER', { text: t });
    haptic(20);
  };

  const pushLine = (ids: number[]) => {
    setLine(ids);
    onAction('MG_ARRANGE', { ids });
  };
  const pool = q.answers.filter((a) => !line.includes(a.id));
  const myCardTag = <span className="shrink-0 rounded-full bg-fuchsia-500 px-2 py-0.5 text-[10px] font-black uppercase text-white">la tua · {q.myNumber}</span>;

  return (
    <div className="stagger flex flex-col gap-4 pb-36">
      <div className="flex items-center justify-between gap-2">
        <GameChip>
          🔟 Round {q.round}/{q.rounds}
        </GameChip>
        <span key={score} className="pop rounded-full bg-amber-400 px-3 py-1 text-sm font-black text-slate-950 shadow-[0_4px_0_rgba(22,6,72,0.4)]">
          ⭐ {score}
        </span>
        {q.stage !== 'REVEAL' ? <TimerRing left={left} total={STAGE_SECONDS[q.stage]} /> : <span className="h-14 w-14" />}
      </div>
      {hearts}

      {captain && (
        <p className="flex items-center justify-center gap-2 text-center font-black text-white">
          <Avatar avatar={captain.avatar} color={captain.color} size={30} />
          {iCaptain ? 'Sei tu il capitano 👑' : `Capitano: ${captain.name} 👑`}
        </p>
      )}

      {q.stage !== 'REVEAL' && themeCard}

      {/* ------------------------------------------------ scrittura */}
      {q.stage === 'WRITE' && q.myNumber !== null && (
        <>
          <section className="pop flex items-center gap-4 rounded-3xl border-2 border-white/10 bg-slate-900 p-4">
            <span
              className="grid h-20 w-20 shrink-0 place-items-center rounded-full border-4 border-white font-display text-5xl text-white shadow-[0_5px_0_rgba(22,6,72,0.5)]"
              style={{ background: numColor(q.myNumber) }}
            >
              {q.myNumber}
            </span>
            <p className="text-sm font-bold text-slate-200">
              <span className="block text-xs font-black uppercase tracking-widest text-slate-400">Il tuo numero segreto 🤫</span>
              Scrivi una risposta che valga <b className="text-white">{q.myNumber}</b> su 10.
              <span className="block text-xs text-slate-400">Non dire il numero ad alta voce!</span>
            </p>
          </section>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex gap-2"
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 80))}
              placeholder={q.myAnswer ? `Inviata: ${q.myAnswer}` : 'La tua risposta…'}
              autoComplete="off"
              enterKeyHint="send"
              className="h-14 min-w-0 flex-1 rounded-2xl border-2 border-slate-700 bg-slate-950 px-4 text-lg font-bold text-white outline-none placeholder:text-slate-500 focus:border-amber-400"
            />
            <button type="submit" aria-label="Invia" className="grid h-14 w-16 place-items-center rounded-2xl bg-emerald-500 text-white">
              <Send size={22} />
            </button>
          </form>
          {q.myAnswer && <p className="pop text-center text-sm font-bold text-emerald-300">✓ Inviata: “{q.myAnswer}” (puoi ancora cambiarla)</p>}
        </>
      )}
      {q.stage === 'WRITE' && q.myNumber === null && (
        <p className="pop text-center text-lg font-bold text-slate-200">
          {iCaptain ? 'Gli altri stanno scrivendo… poi toccherà a te metterle in fila 🧐' : 'Gli altri stanno scrivendo le risposte… ✍️'}
        </p>
      )}
      {q.stage === 'WRITE' && waiting}

      {/* ------------------------------------------------ la fila del capitano */}
      {q.stage === 'ORDER' && (
        <>
          <p className="text-center font-bold text-slate-200">
            {iCaptain ? (
              <>
                Tocca le risposte dalla più <b className="text-emerald-300">BASSA</b> alla più <b className="text-rose-300">ALTA</b>. Trascina la maniglia gialla per spostarle.
              </>
            ) : (
              `${captain?.name ?? 'Il capitano'} le sta mettendo in fila… niente numeri ad alta voce! 🤐`
            )}
          </p>
          <section className="flex flex-col gap-2 rounded-3xl border-2 border-white/10 bg-slate-900 p-3">
            <p className="rounded-xl bg-emerald-500/20 px-3 py-1.5 text-xs font-black text-emerald-200">⬆️ 1 = {q.theme.lo}</p>
            {line.length === 0 && (
              <p className="py-3 text-center text-sm font-bold text-slate-500">{iCaptain ? 'Tocca le risposte qui sotto per metterle in fila 👇' : 'La fila è ancora vuota'}</p>
            )}
            {iCaptain ? (
              <Reorder.Group
                axis="y"
                values={line}
                onReorder={(ids: number[]) => {
                  dragging.current = true;
                  setLine(ids);
                }}
                className="flex flex-col gap-2"
              >
                {line.map((id, k) => (
                  <LineItem
                    key={id}
                    id={id}
                    pos={k + 1}
                    text={answerOf(id)?.text ?? ''}
                    onRemove={() => pushLine(line.filter((x) => x !== id))}
                    onDrop={() => {
                      dragging.current = false;
                      onAction('MG_ARRANGE', { ids: lineRef.current });
                      haptic(15);
                    }}
                  />
                ))}
              </Reorder.Group>
            ) : (
              <ol className="flex flex-col gap-2">
                {line.map((id, k) => {
                  const a = answerOf(id);
                  return (
                    <motion.li
                      layout
                      key={id}
                      className={`flex items-center gap-2 rounded-2xl border-2 p-2 ${a?.mine ? 'border-fuchsia-400 bg-fuchsia-50' : 'border-white/80 bg-white'} text-slate-950`}
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-900 font-display text-base text-white">{k + 1}</span>
                      <span className="min-w-0 flex-1 text-[15px] font-bold leading-snug [overflow-wrap:anywhere]">{a?.text}</span>
                      {a?.mine && myCardTag}
                    </motion.li>
                  );
                })}
              </ol>
            )}
            <p className="rounded-xl bg-rose-500/20 px-3 py-1.5 text-xs font-black text-rose-200">⬇️ 10 = {q.theme.hi}</p>
          </section>
          {pool.length > 0 && (
            <section className="flex flex-col gap-2">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Da mettere in fila ({pool.length})</p>
              {pool.map((a, k) => (
                <button
                  key={a.id}
                  type="button"
                  disabled={!iCaptain}
                  onClick={() => {
                    pushLine([...line, a.id]);
                    haptic(15);
                  }}
                  style={{ animationDelay: `${k * 0.05}s` }}
                  className={`pop flex items-center gap-2 rounded-2xl border-2 border-dashed p-3 text-left disabled:opacity-100 ${
                    a.mine ? 'border-fuchsia-400 bg-fuchsia-500/15' : 'border-white/40 bg-slate-800'
                  }`}
                >
                  <span className="min-w-0 flex-1 text-[15px] font-bold leading-snug text-white [overflow-wrap:anywhere]">{a.text}</span>
                  {a.mine && myCardTag}
                  {iCaptain && (
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-400 text-slate-950">
                      <Plus size={20} strokeWidth={3} />
                    </span>
                  )}
                </button>
              ))}
            </section>
          )}
        </>
      )}

      {/* ------------------------------------------------ rivelazione */}
      {q.stage === 'REVEAL' && (
        <>
          <section className="rounded-3xl border-2 border-white/10 bg-slate-900 p-3 text-center">
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">{q.theme.t}</p>
            <p className="font-display text-2xl text-white">{q.skipped ? 'Round saltato' : 'Ecco i numeri veri!'}</p>
          </section>
          {q.skipped ? (
            <p className="pop text-center text-lg font-bold text-slate-200">Troppo poche risposte da mettere in fila: nessuna vita persa. ⏭️</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {q.result?.map((r, k) => {
                const open = k < shown;
                const p = P(r.by);
                return (
                  <li
                    key={r.id}
                    className={`flex items-center gap-2 rounded-2xl border-2 p-2 transition-colors duration-300 ${
                      !open ? 'border-white/20 bg-slate-800' : r.ok ? 'border-emerald-400 bg-emerald-500/20' : 'border-rose-400 bg-rose-500/20'
                    }`}
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-950 font-display text-base text-white">{k + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-bold leading-snug text-white [overflow-wrap:anywhere]">{r.text}</span>
                      {open && p && (
                        <span className="pop mt-0.5 flex items-center gap-1 text-xs font-bold text-slate-300">
                          <Avatar avatar={p.avatar} color={p.color} size={18} /> {p.name}
                        </span>
                      )}
                    </span>
                    {open ? (
                      <span className="reveal-pop flex shrink-0 items-center gap-1">
                        <span className="text-xl">{r.ok ? '✅' : '❌'}</span>
                        <span
                          className="grid h-12 w-12 place-items-center rounded-full border-[3px] border-white font-display text-2xl text-white shadow-[0_3px_0_rgba(22,6,72,0.5)]"
                          style={{ background: numColor(r.n) }}
                        >
                          {r.n}
                        </span>
                      </span>
                    ) : (
                      <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full bg-slate-700 font-display text-2xl text-slate-400 ${k === shown ? 'drum' : ''}`}>?</span>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
          {allShown && !q.skipped && (
            <section
              className={`reveal-pop rounded-3xl border-4 border-white/90 p-4 text-center shadow-[0_8px_0_rgba(22,6,72,0.5)] ${
                q.lost === 0 ? 'bg-linear-to-br from-emerald-400 to-teal-600' : 'bg-linear-to-br from-rose-500 to-red-700'
              }`}
            >
              <p className="font-display text-3xl text-white">{q.lost === 0 ? 'Fila perfetta! 🌟' : q.lost === 1 ? 'Quasi! Una fuori posto' : `${q.lost} fuori posto`}</p>
              <p className="font-black text-white/90">
                +{q.gained} {q.gained === 1 ? 'punto' : 'punti'}
                {q.lost > 0 ? ` · −${q.lost} ${q.lost === 1 ? 'vita' : 'vite'}` : ''}
              </p>
            </section>
          )}
        </>
      )}

      <BottomBar>
        <div className="flex items-center gap-2">
          {q.stage === 'ORDER' && iCaptain ? (
            <button
              type="button"
              disabled={line.length < q.answers.length}
              onClick={() => {
                onAction('MG_CONFIRM');
                haptic(40);
              }}
              className="shine h-16 flex-1 rounded-2xl bg-amber-400 text-xl font-black text-slate-950 disabled:bg-slate-700 disabled:text-slate-300"
            >
              {line.length < q.answers.length ? `Mancano ${q.answers.length - line.length} da mettere in fila` : 'Conferma la fila ✓'}
            </button>
          ) : (
            <p className="min-w-0 flex-1 truncate rounded-2xl border-2 border-slate-700 bg-slate-900/95 px-4 py-3 text-sm font-bold text-slate-200">
              {q.stage === 'WRITE'
                ? `Risposte: ${q.written.length}/${q.writers.length}`
                : q.stage === 'ORDER'
                  ? `Fila: ${line.length}/${q.answers.length}`
                  : q.round >= q.rounds || q.lives <= 0
                    ? 'Ultimo round: arriva il giudizio finale…'
                    : 'Prossimo round tra poco…'}
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
