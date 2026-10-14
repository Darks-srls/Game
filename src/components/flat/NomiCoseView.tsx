import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { Check, ChevronLeft, ChevronRight, FastForward, ThumbsDown } from 'lucide-react';
import { flatOpt } from '../../data/flatGames';
import { NC_POINTS, type NCRow, type NCStatus, type NomiCoseView as NCData } from '../../data/flat/nomicose';
import { useCountdown } from '../../hooks/useCountdown';
import { haptic, soundManager } from '../../utils/audio';
import { GameChip, Podium, PointsPop, TimerRing } from '../fx';
import { Avatar, BottomBar, EndBar, Ranking, type ModeProps } from '../ui';

const N_CATS = 6;
const ROLL = 'ABCDEFGILMNOPRSTUVZ';

// come sul server: minuscole, senza accenti né articolo davanti
const base = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const stripArticle = (t: string) => t.replace(/^(il|lo|la|i|gli|le|l|un|uno|una)\s+/, '');
const hasText = (s: string) => !!base(s);
const startsOk = (s: string, letter: string) => {
  const t = base(s);
  const l = letter.toLowerCase();
  return t.startsWith(l) || stripArticle(t).startsWith(l);
};

const LOOK: Record<NCStatus, { box: string; chip: string; label: (letter: string) => string }> = {
  unica: { box: 'border-emerald-400/80 bg-emerald-500/15', chip: 'bg-emerald-500 text-white', label: () => '+10' },
  uguale: { box: 'border-sky-400/80 bg-sky-500/15', chip: 'bg-sky-500 text-white', label: () => '= +5' },
  bocciata: { box: 'border-rose-400/70 bg-rose-500/10', chip: 'bg-rose-500 text-white', label: () => '👎 bocciata' },
  lettera: { box: 'border-slate-700 bg-slate-800/60', chip: 'bg-slate-600 text-slate-100', label: (l) => `non inizia con ${l}` },
  vuota: { box: 'border-slate-800 bg-slate-900/70', chip: 'bg-slate-700 text-slate-300', label: () => 'vuota' },
};

function LetterBadge({ letter, size = 'md' }: { letter: string; size?: 'md' | 'xl' }) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-2xl border-4 border-white/90 bg-linear-to-br from-amber-300 to-orange-500 font-display text-white shadow-[0_5px_0_rgba(22,6,72,0.5)] [text-shadow:0_3px_0_rgba(0,0,0,0.25)] ${
        size === 'xl' ? 'h-44 w-44 rounded-[2.2rem] text-[7.5rem]' : 'h-12 w-12 text-3xl'
      }`}
    >
      {letter}
    </span>
  );
}

// estrazione della lettera: girano a caso, poi si ferma su quella vera
function LetterRoll({ letter, endsAt, offset }: { letter: string; endsAt: number | null; offset: number }) {
  const [shown, setShown] = useState('?');
  const [stopped, setStopped] = useState(false);
  const off = useRef(offset);
  off.current = offset;
  useEffect(() => {
    const leftMs = () => (endsAt ?? 0) - (Date.now() + off.current);
    if (leftMs() < 1300) {
      setShown(letter);
      setStopped(true);
      return;
    }
    setStopped(false);
    soundManager.playDrumroll(Math.max(0.5, (leftMs() - 1300) / 1000));
    const id = setInterval(() => {
      if (leftMs() < 1300) {
        clearInterval(id);
        setShown(letter);
        setStopped(true);
        soundManager.playReveal();
        return;
      }
      setShown(ROLL[Math.floor(Math.random() * ROLL.length)]);
    }, 85);
    return () => clearInterval(id);
  }, [letter, endsAt]);
  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-300">{stopped ? 'La lettera è' : 'Estrazione…'}</p>
      <span key={stopped ? 'stop' : 'roll'} className={stopped ? 'reveal-pop' : 'drum'}>
        <LetterBadge letter={shown} size="xl" />
      </span>
      {stopped && <p className="pop text-center text-lg font-bold text-white">Preparatevi a scrivere! ✍️</p>}
    </div>
  );
}

// secondi che mancano, senza tic-tac (per i risultati)
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

// 📝 Nomi, cose, città: una lettera, sei categorie, STOP!
export default function NomiCoseView({ state, clockOffset, canLead, onAction, onNewGame, onBackToLobby, onForce }: ModeProps) {
  const q = state.mg as NCData;
  const me = state.myId;
  const P = (id: string) => state.players.find((p) => p.id === id);
  const tense = q.stage === 'WRITE' || q.stage === 'REVIEW';
  const loud = useCountdown(tense ? q.stageEndsAt : null, clockOffset);
  const quiet = useQuietLeft(q.stage === 'RESULT' ? q.stageEndsAt : null, clockOffset);
  const left = tense ? loud : quiet;
  const playing = !!q.myAnswers;
  const players = Object.keys(q.progress);

  // le mie risposte restano sul telefono e si mandano al server mentre scrivo
  const [answers, setAnswers] = useState<string[]>(() => q.myAnswers ?? Array(N_CATS).fill(''));
  const lastSent = useRef(JSON.stringify(q.myAnswers ?? []));
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const [cat, setCat] = useState(0);
  useEffect(() => {
    setAnswers(q.myAnswers ?? Array(N_CATS).fill(''));
    lastSent.current = JSON.stringify(q.myAnswers ?? []);
    setCat(0);
  }, [q.round]);

  const hurry = !!q.stoppedBy || (left !== null && left <= 6);
  useEffect(() => {
    if (q.stage !== 'WRITE' || !playing) return;
    const payload = JSON.stringify(answers);
    if (payload === lastSent.current) return;
    const t = setTimeout(
      () => {
        lastSent.current = payload;
        onAction('MG_ANSWERS', { answers });
      },
      hurry ? 80 : 450,
    );
    return () => clearTimeout(t);
  }, [answers, q.stage, hurry]);

  // suoni (uguali per tutti)
  useEffect(() => {
    if (q.stage === 'WRITE') soundManager.playStart();
    if (q.stage === 'REVIEW') soundManager.playReveal();
    if (q.stage === 'RESULT') soundManager.playSuccess();
    if (q.stage === 'END') {
      soundManager.playVictory();
      confetti({ particleCount: 150, spread: 90, origin: { y: 0.35 } });
    }
  }, [q.stage, q.round]);
  useEffect(() => {
    if (q.stoppedBy) soundManager.playAlarm();
  }, [q.stoppedBy]);

  const leadButton = canLead && (
    <button type="button" onClick={onForce} className="flex h-14 shrink-0 items-center gap-1 rounded-2xl bg-slate-800 px-3 text-sm font-black text-amber-200">
      <FastForward size={16} /> Avanti
    </button>
  );

  // ---------------------------------------------------------------- fine partita
  if (q.stage === 'END') {
    const ranking = Object.entries(q.scores).sort((x, y) => y[1] - x[1]);
    return (
      <div className="stagger flex flex-col gap-4">
        <h2 className="text-center text-3xl text-white">Il re del vocabolario 👑</h2>
        <Podium state={state} entries={ranking.map(([id, points]) => ({ id, value: `${points} punti` }))} />
        <section className="rounded-3xl border-2 border-white/10 bg-slate-900 p-4">
          <Ranking state={state} scores={q.scores} />
        </section>
        <EndBar canLead={canLead} hostName={P(state.hostId)?.name} onNewGame={onNewGame} onBackToLobby={onBackToLobby} />
      </div>
    );
  }

  const header = (total: number, label: string) => (
    <div className="flex items-center justify-between gap-2">
      <GameChip>{label}</GameChip>
      {q.stage !== 'DRAW' && <LetterBadge letter={q.letter} />}
      {q.stage === 'DRAW' ? <span className="w-14" /> : <TimerRing left={left} total={total} />}
    </div>
  );

  // ---------------------------------------------------------------- estrazione
  if (q.stage === 'DRAW') {
    return (
      <div className="stagger flex flex-col gap-4 pb-32">
        {header(4, `📝 Round ${q.round}/${q.rounds}`)}
        <LetterRoll letter={q.letter} endsAt={q.stageEndsAt} offset={clockOffset} />
        <BottomBar>
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate rounded-2xl border-2 border-slate-700 bg-slate-900/95 px-4 py-3 text-sm font-bold text-slate-200">
              Sei categorie, una lettera: chi finisce può dare lo STOP!
            </p>
            {leadButton}
          </div>
        </BottomBar>
      </div>
    );
  }

  // ---------------------------------------------------------------- scrittura
  if (q.stage === 'WRITE') {
    const done = answers.filter(hasText).length;
    const stopper = q.stoppedBy ? P(q.stoppedBy) : null;
    const writeTotal = q.stoppedBy ? 5 : flatOpt(state.settings, 'NOMICOSE', 'secondi');
    return (
      <div className="stagger flex flex-col gap-3 pb-36">
        {header(writeTotal, `📝 Round ${q.round}/${q.rounds}`)}

        {q.stoppedBy && (
          <div key={q.stoppedBy} className="pop urgent rounded-2xl border-4 border-white bg-linear-to-br from-rose-500 to-red-700 p-3 text-center shadow-[0_6px_0_rgba(22,6,72,0.5)]">
            <p className="font-display text-3xl text-white">✋ STOP!</p>
            <p className="text-sm font-black text-white/90">
              {q.stoppedBy === me ? 'Hai fermato tutti: gli altri hanno 5 secondi!' : `${stopper?.name ?? 'Qualcuno'} ha finito: ultimi secondi, scrivi!`}
            </p>
          </div>
        )}

        {playing ? (
          <div className="flex flex-col gap-2">
            {q.cats.map((c, i) => {
              const v = answers[i] ?? '';
              const ok = hasText(v) && startsOk(v, q.letter);
              const wrong = hasText(v) && !ok;
              return (
                <label
                  key={`${q.round}-${i}`}
                  style={{ animationDelay: `${0.05 + i * 0.05}s` }}
                  className={`pop flex items-center gap-2 rounded-2xl border-2 bg-slate-900 px-3 py-2 transition-colors focus-within:border-amber-400 ${
                    ok ? 'border-emerald-500/70' : wrong ? 'border-rose-500/70' : 'border-slate-700'
                  }`}
                >
                  <span className="w-8 shrink-0 text-center text-2xl">{c.e}</span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[11px] font-black uppercase tracking-wider text-slate-400">{c.n}</span>
                    <input
                      ref={(el) => {
                        inputs.current[i] = el;
                      }}
                      value={v}
                      onChange={(e) => {
                        const list = [...answers];
                        list[i] = e.target.value.slice(0, 32);
                        setAnswers(list);
                      }}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter') return;
                        e.preventDefault();
                        const nextEmpty = answers.findIndex((a, k) => k > i && !hasText(a));
                        const target = inputs.current[nextEmpty >= 0 ? nextEmpty : i + 1];
                        if (target) target.focus();
                        else (e.target as HTMLInputElement).blur();
                      }}
                      placeholder={`${q.letter}…`}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="words"
                      spellCheck={false}
                      enterKeyHint={i < N_CATS - 1 ? 'next' : 'done'}
                      className="h-9 min-w-0 bg-transparent text-xl font-bold text-white outline-none placeholder:text-slate-600"
                    />
                    {wrong && <span className="text-[11px] font-bold text-rose-300">Deve iniziare con la {q.letter}!</span>}
                  </span>
                  {ok && (
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-500 text-white">
                      <Check size={15} strokeWidth={4} />
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        ) : (
          <p className="pop rounded-2xl bg-slate-900 p-4 text-center font-bold text-slate-200">👀 Stai guardando: i giocatori stanno scrivendo con la {q.letter}…</p>
        )}

        {/* a che punto sono gli altri */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {players
            .filter((id) => id !== me)
            .map((id) => {
              const p = P(id);
              if (!p) return null;
              const n = q.progress[id] ?? 0;
              return (
                <span key={id} className="relative">
                  <Avatar avatar={p.avatar} color={p.color} size={34} />
                  <span
                    className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full px-1.5 text-[10px] font-black ${
                      n >= N_CATS ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-200'
                    }`}
                  >
                    {n}/{N_CATS}
                  </span>
                </span>
              );
            })}
        </div>

        <BottomBar>
          <div className="flex items-center gap-2">
            {playing && !q.stoppedBy ? (
              <button
                type="button"
                disabled={done < N_CATS}
                onClick={() => {
                  lastSent.current = JSON.stringify(answers);
                  onAction('MG_STOP', { answers });
                  haptic(40);
                }}
                className={`h-14 flex-1 rounded-2xl text-xl font-black text-white transition-colors disabled:bg-slate-700 disabled:text-slate-300 ${done >= N_CATS ? 'shine bg-rose-500' : ''}`}
              >
                {done >= N_CATS ? '✋ STOP!' : `Compila tutto per dare lo STOP (${done}/${N_CATS})`}
              </button>
            ) : (
              <p className="min-w-0 flex-1 truncate rounded-2xl border-2 border-slate-700 bg-slate-900/95 px-4 py-3 text-sm font-bold text-slate-200">
                {q.stoppedBy ? 'Ultimi secondi… ⏳' : 'In attesa dello STOP…'}
              </p>
            )}
            {leadButton}
          </div>
        </BottomBar>
      </div>
    );
  }

  const need = Math.max(1, Math.ceil(q.judges / 2));

  // una risposta nella revisione o nei risultati
  const rowCard = (r: NCRow, i: number, catNo: number, review: boolean) => {
    const p = P(r.by);
    const mine = r.by === me;
    const look = LOOK[r.status];
    const reviewable = r.status !== 'vuota' && r.status !== 'lettera';
    const canFlag = review && playing && !mine && reviewable;
    return (
      <div
        key={r.by}
        style={{ animationDelay: `${0.04 + i * 0.05}s` }}
        className={`pop flex items-center gap-2 rounded-2xl border-2 p-2 ${look.box} ${mine ? 'ring-2 ring-amber-300/60' : ''}`}
      >
        {p && <Avatar avatar={p.avatar} color={p.color} size={34} />}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[11px] font-black uppercase tracking-wide text-slate-400">
            {p?.name ?? '?'}
            {mine ? ' (tu)' : ''}
          </span>
          <span
            className={`break-words text-xl font-black leading-tight ${
              r.status === 'vuota' ? 'italic text-slate-500' : r.status === 'bocciata' ? 'text-slate-300 line-through decoration-rose-400 decoration-4' : r.status === 'lettera' ? 'text-slate-400' : 'text-white'
            }`}
          >
            {r.status === 'vuota' ? '— niente —' : r.text}
          </span>
        </span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-black ${look.chip}`}>{look.label(q.letter)}</span>
        {reviewable && (canFlag || r.flags > 0) && (
          <button
            type="button"
            disabled={!canFlag}
            onClick={() => {
              onAction('MG_FLAG', { id: r.by, cat: catNo });
              haptic(15);
            }}
            aria-label="Boccia"
            className={`flex h-11 shrink-0 items-center gap-1 rounded-xl px-2.5 text-sm font-black disabled:opacity-80 ${
              r.flagged ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-200'
            }`}
          >
            <ThumbsDown size={16} />
            {r.flags}/{need}
          </button>
        )}
      </div>
    );
  };

  // ---------------------------------------------------------------- revisione
  if (q.stage === 'REVIEW') {
    const c = q.cats[cat] ?? q.cats[0];
    const rows = q.rows[cat] ?? [];
    const iDone = q.done.includes(me);
    const last = cat >= q.cats.length - 1;
    return (
      <div className="stagger flex flex-col gap-3 pb-40">
        {header(Math.min(120, 45 + players.length * 8), `🔍 Controllo · Round ${q.round}`)}

        {/* le categorie: si salta dove si vuole */}
        <div className="grid grid-cols-6 gap-1.5">
          {q.cats.map((k, i) => {
            const flaggedHere = (q.rows[i] ?? []).some((r) => r.status === 'bocciata');
            return (
              <button
                key={k.n}
                type="button"
                onClick={() => setCat(i)}
                className={`relative grid h-12 place-items-center rounded-xl text-2xl transition-transform ${i === cat ? 'scale-105 bg-amber-400 shadow-[0_4px_0_rgba(22,6,72,0.45)]' : 'bg-slate-800'}`}
                aria-label={k.n}
              >
                {k.e}
                {flaggedHere && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-slate-950 bg-rose-500" />}
              </button>
            );
          })}
        </div>

        <section key={cat} className="pop rounded-3xl border-4 border-white/90 bg-linear-to-br from-violet-500 to-indigo-700 p-3 text-center shadow-[0_6px_0_rgba(22,6,72,0.5)]">
          <p className="text-[11px] font-black uppercase tracking-widest text-white/70">
            Categoria {cat + 1} di {q.cats.length}
          </p>
          <p className="font-display text-2xl leading-tight text-white">
            {c.e} {c.n}
          </p>
          <p className="text-sm font-bold text-white/80">con la {q.letter}</p>
        </section>

        <div key={`rows-${cat}`} className="flex flex-col gap-2">
          {rows.map((r, i) => rowCard(r, i, cat, true))}
        </div>
        <p className="text-center text-xs font-semibold text-slate-400">
          {playing ? `Tocca 👎 sulle risposte che non valgono: ne bastano ${need} per bocciarla.` : 'Stai guardando la revisione 👀'}
        </p>

        <BottomBar>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={cat === 0}
              onClick={() => setCat(cat - 1)}
              aria-label="Categoria precedente"
              className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-slate-800 text-white disabled:opacity-40"
            >
              <ChevronLeft size={26} />
            </button>
            {!last ? (
              <button type="button" onClick={() => setCat(cat + 1)} className="flex h-14 flex-1 items-center justify-center gap-1 rounded-2xl bg-amber-400 text-lg font-black text-slate-950">
                {q.cats[cat + 1]?.e} Prossima <ChevronRight size={22} />
              </button>
            ) : playing ? (
              <button
                type="button"
                disabled={iDone}
                onClick={() => {
                  onAction('MG_DONE');
                  haptic(20);
                }}
                className="h-14 flex-1 rounded-2xl bg-emerald-500 text-lg font-black text-white disabled:opacity-60"
              >
                {iDone ? `Fatto ✓ (${q.done.length}/${players.length})` : '✅ Ho controllato tutto'}
              </button>
            ) : (
              <p className="min-w-0 flex-1 truncate rounded-2xl border-2 border-slate-700 bg-slate-900/95 px-4 py-3 text-sm font-bold text-slate-200">
                Hanno finito: {q.done.length}/{players.length}
              </p>
            )}
            {leadButton}
          </div>
        </BottomBar>
      </div>
    );
  }

  // ---------------------------------------------------------------- risultati del round
  const byPlayer = players
    .map((id) => ({ id, gained: q.gained[id] ?? 0, total: q.scores[id] ?? 0, rows: q.cats.map((_, c) => q.rows[c]?.find((r) => r.by === id) ?? null) }))
    .sort((a, b) => b.gained - a.gained || b.total - a.total);
  return (
    <div className="stagger flex flex-col gap-3 pb-32">
      {header(14, `🏁 Round ${q.round}/${q.rounds}`)}
      <h2 className="text-center text-3xl text-white">Com’è andata con la {q.letter}</h2>
      <div className="flex flex-col gap-2">
        {byPlayer.map((x, i) => {
          const p = P(x.id);
          if (!p) return null;
          return (
            <section
              key={x.id}
              style={{ animationDelay: `${0.1 + i * 0.1}s` }}
              className={`pop relative rounded-2xl border-2 p-2.5 ${x.id === me ? 'border-amber-300/70 bg-amber-400/10' : 'border-white/10 bg-slate-900'}`}
            >
              <div className="flex items-center gap-2">
                <Avatar avatar={p.avatar} color={p.color} size={36} />
                <span className="min-w-0 flex-1 truncate font-black text-white">
                  {p.name}
                  {x.id === me ? ' (tu)' : ''}
                </span>
                <span className="relative font-display text-2xl text-amber-300">
                  +{x.gained}
                  <PointsPop points={x.gained} className="absolute -top-5 right-0" />
                </span>
                <span className="w-14 text-right text-xs font-black text-slate-400">tot {x.total}</span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1">
                {x.rows.map((r, c) => (
                  <span
                    key={c}
                    className={`truncate rounded-lg px-1.5 py-1 text-[11px] font-bold ${
                      !r || r.status === 'vuota'
                        ? 'bg-slate-800 text-slate-500'
                        : r.status === 'unica'
                          ? 'bg-emerald-500/25 text-emerald-100'
                          : r.status === 'uguale'
                            ? 'bg-sky-500/25 text-sky-100'
                            : 'bg-rose-500/20 text-rose-200 line-through'
                    }`}
                  >
                    {q.cats[c]?.e} {r && r.status !== 'vuota' ? r.text : '—'}
                    {r && NC_POINTS[r.status] ? ` · ${NC_POINTS[r.status]}` : ''}
                  </span>
                ))}
              </div>
            </section>
          );
        })}
      </div>
      <BottomBar>
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate rounded-2xl border-2 border-slate-700 bg-slate-900/95 px-4 py-3 text-sm font-bold text-slate-200">
            {q.round >= q.rounds ? 'Classifica finale tra poco… 🏆' : 'Prossima lettera tra poco… 🎲'}
          </p>
          {leadButton}
        </div>
      </BottomBar>
    </div>
  );
}
