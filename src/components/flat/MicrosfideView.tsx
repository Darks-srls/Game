import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import confetti from 'canvas-confetti';
import { FastForward } from 'lucide-react';
import { INTRO_MS, MAX_DIFF, RANK_MS, SFIDA, sfidaDiff, verbOf, type MicrosfideView as MsData, type MsResult } from '../../data/flat/microsfide';
import { haptic, soundManager } from '../../utils/audio';
import { GameChip, Podium, TimerRing } from '../fx';
import { Avatar, BottomBar, EndBar, Ranking, type ModeProps } from '../ui';
import { GIOCHI } from './microsfide';
import { MS_CSS, clamp } from './microsfide/kit';

type Props = ModeProps & { q: MsData };
type Outcome = { ok: boolean; ms: number; why?: string };

const secs = (ms: number) => `${(ms / 1000).toFixed(2).replace('.', ',')} s`;

// secondi che mancano (senza ticchettii: le microsfide hanno già i loro suoni)
function useLeft(endsAt: number | null, offset: number) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!endsAt) return setLeft(null);
    const tick = () => setLeft(Math.max(0, Math.ceil((endsAt - (Date.now() + offset)) / 1000)));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [endsAt, offset]);
  return left;
}

// ⚡ Microsfide (stile WarioWare): una raffica di sfide lampo, tutti insieme
export default function MicrosfideView(props: ModeProps) {
  const q = props.state.mg as MsData;
  if (q.stage === 'END') return <Fine {...props} q={q} />;
  if (q.stage === 'RANK') return <Classifica {...props} q={q} />;
  return <Palco {...props} q={q} />;
}

// ---------------------------------------------------------------- il palco a tutto schermo (intro, gioco, risultato)

function Palco({ q, state, clockOffset, onAction }: Props) {
  const info = SFIDA[q.game];
  // mentre si gioca la pagina non deve scorrere né rimbalzare
  useEffect(() => {
    const b = document.body.style;
    const h = document.documentElement.style;
    const old = [b.overflow, h.overscrollBehavior];
    b.overflow = 'hidden';
    h.overscrollBehavior = 'none';
    return () => {
      b.overflow = old[0];
      h.overscrollBehavior = old[1];
    };
  }, []);
  return createPortal(
    <div
      className="ms-root fixed inset-0 z-[45] flex flex-col overflow-hidden text-white transition-[background] duration-300"
      style={{ background: info.bg }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <style>{MS_CSS}</style>
      {q.stage === 'RESULT' ? <Risultato q={q} state={state} /> : <Round key={q.n} q={q} state={state} clockOffset={clockOffset} onAction={onAction} />}
    </div>,
    document.body,
  );
}

// una sfida: introduzione col verbo gigante, poi il gioco; alla fine il risultato parte da solo
function Round({ q, state, clockOffset, onAction }: Pick<Props, 'q' | 'state' | 'clockOffset' | 'onAction'>) {
  const info = SFIDA[q.game];
  const Game = GIOCHI[q.game];
  const dur = q.endAt - q.playAt;
  const me = state.players.find((p) => p.id === state.myId);
  const isPlayer = q.order.includes(state.myId);
  const offset = useRef(clockOffset);
  offset.current = clockOffset;
  // tempo della sfida in ms: negativo durante l'introduzione (ora del server, uguale per tutti)
  const clock = useCallback(() => Date.now() + offset.current - q.playAt, [q.playAt]);
  const phaseAt = (t: number) => (t < 0 ? 'intro' : t < dur ? 'play' : 'over');
  const [phase, setPhase] = useState<'intro' | 'play' | 'over'>(() => phaseAt(clock()));
  const outRef = useRef<Outcome | null>(q.mine);
  const [out, setOut] = useState<Outcome | null>(q.mine);

  const finish = (ok: boolean, why?: string) => {
    if (outRef.current) return;
    const ms = Math.round(clamp(clock(), 0, dur));
    const o = { ok, ms, why };
    outRef.current = o;
    setOut(o);
    if (isPlayer) onAction('MG_DONE', { n: q.n, ok, ms });
    if (ok) {
      soundManager.playSuccess();
      haptic(35);
    } else {
      soundManager.playError();
      haptic([90, 50, 90]);
    }
  };
  const finishRef = useRef(finish);
  finishRef.current = finish;
  const win = useCallback(() => finishRef.current(true), []);
  const lose = useCallback((why: string) => finishRef.current(false, why), []);

  // fasi a tempo, con i "tic" del via (uguali per tutti)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const beats = [-3000, -2000, -1000, -500, 0].filter((b) => b > clock());
    const step = () => {
      const t = clock();
      while (beats.length && beats[0] <= t) {
        const b = beats.shift()!;
        if (b === 0) {
          soundManager.playPop();
          haptic(20);
        } else soundManager.playTick();
      }
      const p = phaseAt(t);
      setPhase(p);
      if (p === 'over') {
        // tempo scaduto: nelle sfide "resisti" vuol dire che ce l'hai fatta
        if (!outRef.current) finishRef.current(!!info.survive, info.survive ? undefined : 'Tempo scaduto! ⏱️');
        return;
      }
      const next = Math.min(beats[0] ?? Infinity, p === 'intro' ? 0 : dur);
      timer = setTimeout(step, clamp(next - t, 5, 1000));
    };
    step();
    return () => clearTimeout(timer);
  }, []);

  if (phase === 'intro') return <Intro q={q} clock={clock} />;

  const online = q.order.filter((id) => state.players.find((p) => p.id === id)?.isOnline).length;
  return (
    <>
      <div className="relative z-10 mx-auto flex w-full max-w-[480px] items-center gap-2 px-3 pt-[max(10px,env(safe-area-inset-top))]">
        <span className="shrink-0 rounded-full bg-black/40 px-3 py-1 font-display text-base">
          ⚡ {q.n}/{q.total}
        </span>
        <span className="min-w-0 flex-1 truncate text-center font-display text-xl ms-stroke">{verbOf(q.game, q.seed, q.diff)}</span>
        <span className="shrink-0 rounded-full bg-black/40 px-3 py-1 text-sm font-black">
          ✅ {q.done.length}/{Math.max(online, q.done.length)}
        </span>
      </div>
      <TimeBar dur={dur} clock={clock} paused={!!out} />
      <div className="relative mx-auto w-full max-w-[480px] flex-1 overflow-hidden">
        <Game seed={q.seed} diff={q.diff} dur={dur} clock={clock} over={!!out || phase === 'over'} win={win} lose={lose} me={me ? { avatar: me.avatar, color: me.color } : null} />
        {out && <Stamp out={out} survive={!!info.survive} waiting={`${q.done.length}/${Math.max(online, q.done.length)}`} />}
        {!isPlayer && (
          <p className="pointer-events-none absolute inset-x-3 bottom-3 z-30 rounded-2xl bg-black/60 px-3 py-2 text-center text-sm font-bold">
            👀 Stai guardando: giocherai dalla prossima partita
          </p>
        )}
      </div>
    </>
  );
}

// barra del tempo che si consuma (CSS: fluida anche sui telefoni lenti)
function TimeBar({ dur, clock, paused }: { dur: number; clock: () => number; paused: boolean }) {
  const [delay] = useState(() => -Math.max(0, clock()));
  return (
    <div className="mx-auto mt-2 h-3.5 w-[calc(100%-24px)] max-w-[456px] overflow-hidden rounded-full border-2 border-black/30 bg-black/35">
      <div className="h-full rounded-full" style={{ animation: `ms-shrink ${dur}ms linear ${delay}ms both`, animationPlayState: paused ? 'paused' : 'running' }} />
    </div>
  );
}

// l'introduzione: il verbo gigante che sbatte sullo schermo
function Intro({ q, clock }: { q: MsData; clock: () => number }) {
  const info = SFIDA[q.game];
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((x) => x + 1), 100);
    return () => clearInterval(id);
  }, []);
  const t = clock();
  const ready = t < -INTRO_MS; // la prima sfida ha prima il "Pronti?"
  const prevDiff = q.n > 1 ? sfidaDiff(q.n - 1, q.total) : q.diff;
  const faster = q.diff > prevDiff;
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center gap-3 overflow-hidden px-4 text-center">
      <div
        className="ms-rays pointer-events-none absolute left-1/2 top-1/2 -ml-[110vmax] -mt-[110vmax] h-[220vmax] w-[220vmax] opacity-25"
        style={{ background: 'repeating-conic-gradient(rgba(255,255,255,0.45) 0 9deg, transparent 9deg 18deg)' }}
      />
      <p className="relative font-display text-xl tracking-wide text-white/90">
        SFIDA {q.n} DI {q.total}
      </p>
      <p className="relative flex gap-1 text-lg" aria-label={`Livello ${q.diff + 1}`}>
        {Array.from({ length: MAX_DIFF + 1 }, (_, i) => (
          <span key={i} className={i <= q.diff ? '' : 'opacity-25 grayscale'}>
            ⚡
          </span>
        ))}
      </p>
      {ready ? (
        <>
          <p key="ready" className="ms-slam relative font-display text-7xl ms-stroke">
            PRONTI?
          </p>
          <p key={Math.ceil((-t - INTRO_MS) / 1000)} className="ms-pop relative font-display text-8xl text-amber-300 ms-stroke">
            {Math.max(1, Math.ceil((-t - INTRO_MS) / 1000))}
          </p>
        </>
      ) : (
        <>
          {faster && <p className="ms-pop relative rounded-full bg-red-500 px-5 py-1 font-display text-2xl shadow-[0_4px_0_#9c0d3a]">🔥 PIÙ VELOCE!</p>}
          {q.n === q.total && <p className="ms-pop relative rounded-full bg-amber-400 px-5 py-1 font-display text-2xl text-slate-950">🏁 ULTIMA SFIDA!</p>}
          <span className="ms-emoji ms-slam relative text-[112px] drop-shadow-[0_10px_0_rgba(0,0,0,0.25)]">{info.icon}</span>
          <h2 className="ms-slam relative max-w-full break-words font-display text-[clamp(40px,13vw,64px)] leading-[0.95] ms-stroke" style={{ animationDelay: '0.08s' }}>
            {verbOf(q.game, q.seed, q.diff)}
          </h2>
          <p className="ms-pop relative max-w-sm rounded-2xl bg-black/40 px-4 py-2 text-lg font-bold leading-snug" style={{ animationDelay: '0.2s' }}>
            {info.hint(q.diff)}
          </p>
        </>
      )}
    </div>
  );
}

// il timbro sopra la sfida: fatto o fallito
function Stamp({ out, survive, waiting }: { out: Outcome; survive: boolean; waiting: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-black/25 px-6">
      <div
        className={`ms-stamp rounded-3xl border-[6px] border-white px-6 py-3 text-center shadow-[0_10px_0_rgba(0,0,0,0.35)] ${
          out.ok ? 'bg-linear-to-br from-emerald-400 to-emerald-600' : 'bg-linear-to-br from-red-500 to-red-700'
        }`}
      >
        <p className="font-display text-5xl leading-none ms-stroke">{out.ok ? (survive ? 'SALVO! 💪' : 'FATTO! ✅') : 'FALLITO 💥'}</p>
        {out.ok && !survive && <p className="mt-1 font-display text-2xl">{secs(out.ms)}</p>}
        {!out.ok && out.why && <p className="mt-1 text-base font-black leading-tight">{out.why}</p>}
      </div>
      <p className="rounded-full bg-black/50 px-4 py-1.5 text-sm font-bold">Aspetta gli altri… {waiting}</p>
    </div>
  );
}

// risultato della sfida: chi ce l'ha fatta, i più veloci, i punti
function Risultato({ q, state }: Pick<Props, 'q' | 'state'>) {
  const info = SFIDA[q.game];
  const P = (id: string) => state.players.find((p) => p.id === id);
  const mine = q.results.find((r) => r.id === state.myId);
  const okN = q.results.filter((r) => r.ok).length;
  useEffect(() => {
    soundManager.playWhoosh();
    if (mine?.place === 1) setTimeout(() => soundManager.playSuccess(), 200);
  }, []);
  const sorted = [...q.results].sort((a, b) => Number(b.ok) - Number(a.ok) || (a.place || 9) - (b.place || 9) || (a.ms ?? 0) - (b.ms ?? 0));
  const medal = ['', '🥇', '🥈', '🥉'];
  const cols = sorted.length <= 4 ? 'grid-cols-2' : sorted.length <= 9 ? 'grid-cols-3' : 'grid-cols-4';
  return (
    <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col gap-3 overflow-hidden px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-[max(14px,env(safe-area-inset-top))]">
      <p className="text-center font-display text-lg text-white/90">
        {info.icon} Sfida {q.n}/{q.total}
      </p>
      {mine ? (
        <div
          className={`reveal-pop mx-auto rounded-3xl border-[6px] border-white px-6 py-3 text-center shadow-[0_8px_0_rgba(0,0,0,0.35)] ${
            mine.ok ? 'bg-linear-to-br from-emerald-400 to-emerald-600' : 'bg-linear-to-br from-slate-500 to-slate-700'
          }`}
        >
          <p className="font-display text-6xl leading-none ms-stroke">{mine.ok ? `+${mine.pts}` : '0'}</p>
          <p className="mt-1 font-display text-lg">{mine.ok ? (mine.place ? `${medal[mine.place]} ${mine.place}° più veloce!` : 'Ce l’hai fatta!') : 'Niente punti 💀'}</p>
        </div>
      ) : null}
      <p className="text-center font-display text-2xl ms-stroke">
        {okN === 0 ? 'Nessuno ce l’ha fatta! 💀' : okN === q.results.length ? 'TUTTI BRAVI! 🎉' : `${okN} su ${q.results.length} ce l’hanno fatta`}
      </p>
      <div className={`grid gap-2 ${cols}`}>
        {sorted.map((r: MsResult, i) => {
          const p = P(r.id);
          return (
            <div
              key={r.id}
              style={{ animationDelay: `${0.1 + i * 0.05}s` }}
              className={`pop relative flex flex-col items-center gap-0.5 rounded-2xl p-2 ${r.ok ? 'bg-emerald-500/85' : 'bg-red-500/70'} ${r.id === state.myId ? 'ring-4 ring-white' : ''}`}
            >
              <span className={`rounded-full p-0.5 ${r.ok ? 'bg-emerald-200' : 'bg-red-200 grayscale'}`}>{p && <Avatar avatar={p.avatar} color={p.color} size={40} />}</span>
              {r.place > 0 && <span className="absolute right-1 top-1 text-xl leading-none">{medal[r.place]}</span>}
              <span className="max-w-full truncate text-sm font-black">{p?.name ?? '?'}</span>
              <span className="text-xs font-bold text-white/90">{r.ok ? (info.survive ? 'salvo' : r.ms !== null ? secs(r.ms) : '') : 'fallito'}</span>
              {r.pts > 0 && <span className="font-display text-lg leading-none text-amber-200">+{r.pts}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- classifica ogni 5 sfide

function Classifica({ q, state, clockOffset, canLead, onForce }: Props) {
  const left = useLeft(q.stageEndsAt, clockOffset);
  useEffect(() => soundManager.playDrumroll(0.8), []);
  const rank = (scores: Record<string, number>) =>
    Object.entries(scores)
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id);
  const now = rank(q.scores);
  const before = rank(q.before);
  const medals = ['🥇', '🥈', '🥉'];
  return (
    <div className="stagger flex flex-col gap-4 pb-32">
      <div className="flex items-center justify-between gap-2">
        <GameChip>
          ⚡ Sfide {q.n}/{q.total}
        </GameChip>
        <TimerRing left={left} total={RANK_MS / 1000} />
      </div>
      <h2 className="text-center text-4xl text-white">Classifica</h2>
      <section className="flex flex-col gap-1.5 rounded-3xl border-2 border-white/10 bg-slate-900 p-3">
        {now.map((id, i) => {
          const p = state.players.find((x) => x.id === id);
          const delta = (q.scores[id] ?? 0) - (q.before[id] ?? 0);
          const moved = before.indexOf(id) - i;
          return (
            <div
              key={id}
              style={{ animationDelay: `${0.15 + i * 0.08}s` }}
              className={`pop flex items-center gap-2 rounded-2xl p-2 ${i === 0 ? 'bg-amber-400/25 ring-2 ring-amber-300/60' : 'bg-slate-800'} ${id === state.myId ? 'outline-2 outline-white/70' : ''}`}
            >
              <span className="w-8 text-center text-xl">{medals[i] ?? i + 1}</span>
              {p && <Avatar avatar={p.avatar} color={p.color} size={34} />}
              <span className="min-w-0 flex-1 truncate font-bold text-white">
                {p?.name ?? '?'}
                {id === state.myId ? ' (tu)' : ''}
              </span>
              {moved > 0 && <span className="text-sm font-black text-emerald-300">▲{moved}</span>}
              {moved < 0 && <span className="text-sm font-black text-red-300">▼{-moved}</span>}
              {delta > 0 && <span className="rounded-full bg-emerald-500 px-2 text-sm font-black text-white">+{delta}</span>}
              <span className="w-10 text-right font-black text-amber-300">{q.scores[id] ?? 0}</span>
            </div>
          );
        })}
      </section>
      <BottomBar>
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate rounded-2xl border-2 border-slate-700 bg-slate-900/95 px-4 py-3 text-sm font-bold text-slate-200">
            Prossima: sfida {q.n + 1} · si accelera! 🔥
          </p>
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

// ---------------------------------------------------------------- fine partita

function Fine({ q, state, canLead, onNewGame, onBackToLobby }: Props) {
  useEffect(() => {
    soundManager.playVictory();
    confetti({ particleCount: 160, spread: 90, origin: { y: 0.35 } });
  }, []);
  const P = (id: string) => state.players.find((p) => p.id === id);
  const ranking = Object.entries(q.scores).sort((a, b) => b[1] - a[1]);
  const top = (rec: Record<string, number>) => Object.entries(rec).sort((a, b) => b[1] - a[1])[0];
  const fulmine = top(q.firsts);
  const preciso = top(q.wins);
  const awards = [
    fulmine && fulmine[1] > 0 ? { icon: '⚡', title: 'Il fulmine', id: fulmine[0], text: `${fulmine[1]} ${fulmine[1] === 1 ? 'volta' : 'volte'} il più veloce` } : null,
    preciso && preciso[1] > 0 ? { icon: '🎯', title: 'Mai una sbavatura', id: preciso[0], text: `${preciso[1]} sfide su ${q.total} riuscite` } : null,
  ].filter((a): a is { icon: string; title: string; id: string; text: string } => !!a);
  return (
    <div className="stagger flex flex-col gap-4 pb-32">
      <h2 className="text-center text-3xl text-white">⚡ Microsfide finite!</h2>
      <Podium state={state} entries={ranking.map(([id, points]) => ({ id, value: `${points} ${points === 1 ? 'punto' : 'punti'}` }))} />
      {awards.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {awards.map((a) => {
            const p = P(a.id);
            return (
              <div key={a.title} className="pop flex flex-col items-center gap-1 rounded-3xl border-2 border-white/10 bg-slate-900 p-3 text-center">
                <span className="text-3xl">{a.icon}</span>
                <span className="text-xs font-black uppercase tracking-widest text-amber-300">{a.title}</span>
                {p && <Avatar avatar={p.avatar} color={p.color} size={36} />}
                <span className="max-w-full truncate font-black text-white">{p?.name ?? '?'}</span>
                <span className="text-xs font-bold text-slate-300">{a.text}</span>
              </div>
            );
          })}
        </div>
      )}
      <section className="rounded-3xl border-2 border-white/10 bg-slate-900 p-4">
        <Ranking state={state} scores={q.scores} />
      </section>
      <EndBar canLead={canLead} hostName={P(state.hostId)?.name} onNewGame={onNewGame} onBackToLobby={onBackToLobby} />
    </div>
  );
}
