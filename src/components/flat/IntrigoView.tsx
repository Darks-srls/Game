import { useEffect, useRef, useState, type ReactNode } from 'react';
import confetti from 'canvas-confetti';
import { FastForward } from 'lucide-react';
import { I_ACT_LIST, I_ACTS, I_CHAR_LIST, I_CHARS, type IAct, type IChar, type ILoseWhy, type IntrigoView as IData, type ITone } from '../../data/flat/intrigo';
import { useCountdown } from '../../hooks/useCountdown';
import { haptic, soundManager } from '../../utils/audio';
import { GameChip, Podium, TimerRing } from '../fx';
import { Avatar, BottomBar, EndBar, Ranking, type ModeProps } from '../ui';

// colori delle carte (stessa forma per tutte: cambia solo il disegno)
const CHAR_BG: Record<IChar, string> = {
  DUCA: 'from-violet-500 to-purple-800',
  ASSASSINO: 'from-slate-600 to-slate-950',
  CAPITANO: 'from-sky-500 to-blue-800',
  AMBASCIATORE: 'from-emerald-400 to-teal-700',
  CONTESSA: 'from-rose-400 to-red-700',
};
const TONE: Record<ITone, string> = {
  info: 'text-slate-300',
  coin: 'text-amber-200',
  claim: 'text-white',
  block: 'text-sky-300',
  doubt: 'text-orange-300',
  truth: 'text-emerald-300',
  bluff: 'text-rose-300',
  dead: 'text-rose-200',
  out: 'text-slate-400',
  win: 'text-amber-300',
};
const WHY_ME: Record<ILoseWhy, string> = {
  DOUBT: 'Hai dubitato a torto 😬',
  BLUFF: 'Ti hanno beccato a bluffare 🤥',
  KILL: 'Ti hanno assassinato 🗡️',
  COUP: 'Colpo di stato contro di te 💥',
};
const WHY: Record<ILoseWhy, string> = {
  DOUBT: 'ha dubitato a torto',
  BLUFF: 'è stato beccato a bluffare',
  KILL: 'è stato assassinato',
  COUP: 'ha subito un colpo di stato',
};

// cosa vuole fare chi agisce, detto a parole
function phrase(act: IAct, target: string, toMe: boolean): string {
  if (act === 'TASSE') return 'riscuotere le tasse (+3 🪙)';
  if (act === 'AIUTI') return 'prendere gli aiuti esteri (+2 🪙)';
  if (act === 'SCAMBIO') return 'scambiare le carte con il mazzo';
  if (act === 'FURTO') return toMe ? 'rubarti 2 🪙' : `rubare 2 🪙 a ${target}`;
  if (act === 'ASSASSINIO') return toMe ? 'assassinarti' : `assassinare ${target}`;
  if (act === 'COLPO') return toMe ? 'farti un colpo di stato' : `fare un colpo di stato a ${target}`;
  return 'prendere 1 🪙';
}

// Carta personaggio: emoji grande, nome, potere e blocco scritti chiari
function CharCard({ c, dead, size = 'lg', selected, onClick, tag }: { c: IChar; dead?: boolean; size?: 'lg' | 'md'; selected?: boolean; onClick?: () => void; tag?: ReactNode }) {
  const C = I_CHARS[c];
  const body = (
    <>
      <span className="text-[10px] font-black uppercase tracking-widest text-white/70">Personaggio</span>
      <span className={`${size === 'lg' ? 'text-6xl' : 'text-5xl'} leading-tight drop-shadow-[0_4px_0_rgba(0,0,0,0.25)]`}>{C.emoji}</span>
      <span className={`font-display ${size === 'lg' ? 'text-2xl' : 'text-xl'} leading-tight text-white [text-shadow:0_3px_0_rgba(0,0,0,0.25)]`}>{C.name}</span>
      <span className="mt-1 w-full rounded-xl bg-black/25 px-1.5 py-1 text-[11px] font-bold leading-tight text-white">{C.power}</span>
      {C.block && <span className="mt-1 text-[11px] font-black leading-tight text-white/90">🛡️ {C.block}</span>}
      {dead && (
        <span className="absolute inset-0 grid place-items-center bg-slate-950/50">
          <span className="rotate-[-14deg] rounded-xl border-4 border-rose-400 px-2 font-display text-xl text-rose-300">PERSO</span>
        </span>
      )}
      {tag}
    </>
  );
  const cls = `relative flex min-h-[190px] flex-col items-center overflow-hidden rounded-2xl border-4 bg-linear-to-b p-2 text-center shadow-[0_6px_0_rgba(22,6,72,0.5)] transition-transform ${CHAR_BG[c]} ${
    selected ? '-translate-y-1.5 border-amber-300 ring-4 ring-amber-300/50' : 'border-white/90'
  } ${dead ? 'grayscale' : ''}`;
  return onClick ? (
    <button type="button" onClick={onClick} className={`${cls} active:scale-95`}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

// dorso della carta (uguale per tutti)
function CardBack({ w = 22 }: { w?: number }) {
  return (
    <span
      className="grid place-items-center rounded-md border-2 border-amber-200/80 bg-linear-to-br from-indigo-500 to-violet-800 text-[10px] shadow-[0_2px_0_rgba(0,0,0,0.35)]"
      style={{ width: w, height: w * 1.4 }}
    >
      👑
    </span>
  );
}

// 👑 Intrigo di corte: bluff alla Coup
export default function IntrigoView({ state, clockOffset, canLead, onAction, onNewGame, onBackToLobby, onForce }: ModeProps) {
  const q = state.mg as IData;
  const me = state.myId;
  const P = (id: string | null) => state.players.find((p) => p.id === id);
  const name = (id: string | null) => P(id)?.name ?? '?';
  const end = q.stage === 'END';
  const left = useCountdown(end ? null : q.stageEndsAt, clockOffset);
  const myLive = (q.hand ?? []).filter((c) => !c.dead).map((c) => c.c);
  const playing = myLive.length > 0;
  const myTurn = q.stage === 'TURN' && q.turn === me && playing;
  const pd = q.pending;
  const canReact = q.eligible.includes(me) && !q.passed.includes(me) && playing;

  const [sel, setSel] = useState<IAct | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [keepSel, setKeepSel] = useState<number[]>([]);
  const [toast, setToast] = useState<IData['log'][number] | null>(null);
  const lastLog = useRef<number | null>(null);

  // scelte locali azzerate a ogni fase nuova
  useEffect(() => {
    setSel(null);
    setTarget(null);
    setKeepSel([]);
  }, [q.turnNo, q.stage]);

  // tocca a me: suono e vibrazione (non dipendono dalle carte)
  useEffect(() => {
    if (myTurn) {
      soundManager.playStart();
      haptic([40, 60, 40]);
    }
  }, [myTurn, q.turnNo]);

  // suoni della cronaca (uguali per tutti) e cartello grande per i colpi di scena
  useEffect(() => {
    const last = q.log[q.log.length - 1];
    if (!last) return;
    const prev = lastLog.current;
    lastLog.current = last.n;
    if (prev === null || last.n <= prev) return;
    const fresh = q.log.filter((l) => l.n > prev);
    const tones = fresh.map((l) => l.tone);
    if (tones.includes('win')) {
      soundManager.playVictory();
      confetti({ particleCount: 160, spread: 95, origin: { y: 0.35 } });
    } else if (tones.includes('out')) soundManager.playBoom();
    else if (tones.includes('bluff')) soundManager.playError();
    else if (tones.includes('truth')) soundManager.playSuccess();
    else if (tones.includes('doubt')) soundManager.playDrumroll(0.8);
    else if (tones.includes('dead')) soundManager.playError();
    else if (tones.includes('block')) soundManager.playWhoosh();
    else if (tones.includes('coin')) soundManager.playPop();
    else soundManager.playClick();
    const big = [...fresh].reverse().find((l) => l.tone === 'truth' || l.tone === 'bluff' || l.tone === 'out');
    if (big) setToast(big);
  }, [q.log]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const send = (type: string, payload?: unknown) => {
    onAction(type, payload);
    haptic(20);
  };

  const cronaca = (
    <section className="rounded-3xl border-2 border-white/10 bg-slate-900 p-3">
      <p className="mb-1.5 text-xs font-black uppercase tracking-widest text-slate-400">📜 Cronaca di corte</p>
      <ul className="flex flex-col gap-1">
        {[...q.log]
          .reverse()
          .slice(0, 8)
          .map((l, i) => {
            const p = P(l.by);
            return (
              <li key={l.n} className={`flex items-start gap-2 rounded-xl px-1.5 py-1 text-sm font-bold leading-snug ${i === 0 ? 'feed-in bg-white/5' : 'opacity-80'} ${TONE[l.tone]}`}>
                {p ? <Avatar avatar={p.avatar} color={p.color} size={22} /> : <span className="w-[22px] text-center">📯</span>}
                <span className="min-w-0 flex-1">{l.text}</span>
              </li>
            );
          })}
      </ul>
    </section>
  );

  // ---------------------------------------------------------------- fine partita
  if (end) {
    const ranking = Object.entries(q.scores).sort((a, b) => b[1] - a[1]);
    return (
      <div className="stagger flex flex-col gap-4">
        <h2 className="text-center text-3xl text-white">{q.winner ? `👑 ${name(q.winner)} domina la corte!` : 'Fine dell’intrigo'}</h2>
        <Podium state={state} entries={ranking.map(([id, pts]) => ({ id, value: id === q.winner ? 'vincitore' : `${pts} ${pts === 1 ? 'punto' : 'punti'}` }))} />
        <section className="rounded-3xl border-2 border-white/10 bg-slate-900 p-4">
          <Ranking state={state} scores={q.scores} />
          <p className="mt-2 text-center text-xs font-bold text-slate-400">Punti per ordine di eliminazione: chi resiste di più ne prende di più.</p>
        </section>
        {q.reveal && q.winner && (q.reveal[q.winner]?.length ?? 0) > 0 && (
          <section className="rounded-3xl border-2 border-amber-300/40 bg-slate-900 p-3 text-center">
            <p className="text-sm font-black text-amber-200">Le carte segrete di {name(q.winner)}</p>
            <div className="mx-auto mt-2 grid max-w-[260px] grid-cols-2 gap-2">
              {q.reveal[q.winner].map((c, i) => (
                <CharCard key={i} c={c} size="md" />
              ))}
            </div>
          </section>
        )}
        {cronaca}
        <EndBar canLead={canLead} hostName={P(state.hostId)?.name} onNewGame={onNewGame} onBackToLobby={onBackToLobby} />
      </div>
    );
  }

  const actor = pd?.actor ?? q.turn;
  const targetName = name(pd?.target ?? null);
  const toMe = pd?.target === me;
  const choosingTarget = myTurn && sel && I_ACTS[sel].target;
  const mustCoup = (q.coins[me] ?? 0) >= 10;

  // ---------------------------------------------------------------- tavolo
  const seat = (id: string) => {
    const p = P(id);
    const st = q.seats[id];
    if (!p || !st) return null;
    const out = st.alive === 0;
    const isTurn = q.turn === id && !out;
    const pickable = !!choosingTarget && id !== me && !out;
    const waiting = q.eligible.includes(id) && !q.passed.includes(id);
    const badge =
      pd?.target === id ? '🎯' : pd?.blocker === id && q.stage === 'BLOCK_CHALLENGE' ? '🛡️' : q.lose?.who === id ? '💔' : q.away.includes(id) ? '💤' : null;
    return (
      <button
        key={id}
        type="button"
        disabled={!pickable}
        onClick={() => setTarget(id)}
        className={`relative flex min-w-0 flex-col items-center gap-1 rounded-2xl border-2 px-1 pb-1.5 pt-2.5 transition ${
          target === id && pickable
            ? 'border-rose-400 bg-rose-500/25 ring-4 ring-rose-400/40'
            : isTurn
              ? 'border-amber-300 bg-amber-400/15 shadow-[0_0_0_3px_rgba(252,211,77,0.3)]'
              : pickable
                ? 'border-rose-300/60 bg-slate-800'
                : 'border-white/10 bg-slate-900'
        } ${out ? 'opacity-45 grayscale' : ''}`}
      >
        {isTurn && <span className="absolute -top-2.5 rounded-full bg-amber-400 px-2 text-[10px] font-black text-slate-950">DI TURNO</span>}
        {badge && <span className="absolute -right-1 -top-2 text-lg drop-shadow">{badge}</span>}
        <span className={isTurn ? 'pulse-soft' : ''}>
          <Avatar avatar={p.avatar} color={p.color} size={38} />
        </span>
        <span className="w-full truncate text-center text-xs font-black text-white">
          {p.name}
          {id === me ? ' (tu)' : ''}
        </span>
        <span className="rounded-full bg-amber-400/20 px-2 text-xs font-black text-amber-200">🪙 {q.coins[id] ?? 0}</span>
        <span className="flex h-[32px] items-end gap-1">
          {Array.from({ length: st.alive }, (_, i) => (
            <CardBack key={`a${i}`} />
          ))}
          {st.dead.map((c, i) => (
            <span key={`d${i}`} title={I_CHARS[c].name} className="grid h-[31px] w-[22px] place-items-center rounded-md border-2 border-rose-300/60 bg-slate-700 text-xs grayscale">
              {I_CHARS[c].emoji}
            </span>
          ))}
        </span>
        {isWindowStage(q.stage) && q.eligible.includes(id) && (
          <span className={`text-[10px] font-black ${waiting ? 'text-amber-300' : 'text-emerald-300'}`}>{waiting ? '⏳ decide…' : '✓ passa'}</span>
        )}
        {out && <span className="text-[10px] font-black text-slate-400">💀 fuori</span>}
      </button>
    );
  };

  // ---------------------------------------------------------------- cosa succede adesso
  let stagePanel: ReactNode = null;
  if (q.stage === 'TURN') {
    if (myTurn) {
      stagePanel = (
        <section className="pop flex flex-col gap-2 rounded-3xl border-4 border-amber-300 bg-slate-900 p-3">
          <p className="text-center font-display text-2xl text-amber-300">Tocca a te! 👑</p>
          <p className="text-center text-sm font-bold text-slate-300">
            {mustCoup ? 'Hai 10 monete: il colpo di stato è obbligatorio!' : 'Scegli una mossa. Puoi dichiarare un personaggio anche se non ce l’hai…'}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {I_ACT_LIST.map((a) => {
              const A = I_ACTS[a];
              const poor = (q.coins[me] ?? 0) < A.cost;
              const off = poor || (mustCoup && a !== 'COLPO');
              const bluff = A.claim && !myLive.includes(A.claim);
              return (
                <button
                  key={a}
                  type="button"
                  disabled={off}
                  onClick={() => {
                    setSel(a);
                    setTarget(null);
                    soundManager.playClick();
                  }}
                  className={`relative flex flex-col items-start rounded-2xl border-2 p-2 text-left transition active:scale-95 disabled:opacity-35 ${
                    sel === a ? 'border-amber-300 bg-amber-400/20' : 'border-white/10 bg-slate-800'
                  } ${a === 'COLPO' ? 'col-span-2' : ''}`}
                >
                  <span className="flex w-full items-center gap-1.5">
                    <span className="text-2xl">{A.emoji}</span>
                    <span className="flex-1 text-sm font-black leading-tight text-white">{A.name}</span>
                    {A.cost > 0 && <span className="rounded-full bg-amber-400 px-1.5 text-[11px] font-black text-slate-950">-{A.cost}🪙</span>}
                  </span>
                  <span className="text-[11px] font-bold leading-tight text-slate-300">{A.desc}</span>
                  {A.claim && (
                    <span className={`mt-1 rounded-full px-2 py-0.5 text-[10px] font-black ${bluff ? 'bg-orange-500/80 text-white' : 'bg-emerald-500/80 text-white'}`}>
                      {bluff ? `🤥 bluff: non hai ${I_CHARS[A.claim].the}` : `✓ hai ${I_CHARS[A.claim].the}`}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {choosingTarget && (
            <div className="pop flex flex-col gap-1.5">
              <p className="text-center font-black text-rose-300">🎯 Contro chi?</p>
              <div className="flex flex-wrap justify-center gap-2">
                {q.order
                  .filter((id) => id !== me && (q.seats[id]?.alive ?? 0) > 0)
                  .map((id) => {
                    const p = P(id);
                    if (!p) return null;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setTarget(id)}
                        className={`flex items-center gap-1.5 rounded-full border-2 py-1 pl-1 pr-3 text-sm font-black text-white ${target === id ? 'border-rose-400 bg-rose-500/30' : 'border-white/15 bg-slate-800'}`}
                      >
                        <Avatar avatar={p.avatar} color={p.color} size={28} />
                        {p.name}
                        <span className="text-xs text-amber-200">🪙{q.coins[id] ?? 0}</span>
                        <span className="text-xs text-slate-300">🂠{q.seats[id].alive}</span>
                      </button>
                    );
                  })}
              </div>
            </div>
          )}
        </section>
      );
    } else {
      stagePanel = (
        <section className="flex items-center justify-center gap-3 rounded-3xl border-2 border-white/10 bg-slate-900 p-4">
          {P(q.turn) && <Avatar avatar={P(q.turn)!.avatar} color={P(q.turn)!.color} size={44} />}
          <p className="text-lg font-black text-white">Tocca a {name(q.turn)}: sta tramando… 🤔</p>
        </section>
      );
    }
  } else if (q.stage === 'CHALLENGE' && pd?.claim) {
    stagePanel = (
      <section key={`c${q.turnNo}`} className="pop flex items-center gap-3 rounded-3xl border-4 border-orange-300 bg-slate-900 p-3">
        <div className="w-[118px] shrink-0">
          <CharCard c={pd.claim} size="md" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-widest text-orange-300">Dichiarazione</p>
          <p className="text-lg font-black leading-tight text-white">
            {actor === me ? 'Hai' : `${name(actor)} dice di avere`} {I_CHARS[pd.claim].the}
          </p>
          <p className="mt-1 text-sm font-bold text-slate-300">per {phrase(pd.act, targetName, toMe)}</p>
          <p className="mt-2 font-black text-orange-200">
            {actor === me ? 'Incrocia le dita: qualcuno dubiterà? 😇' : canReact ? 'Ci credi? 🤨' : q.passed.includes(me) ? 'Hai lasciato passare. Aspettiamo gli altri…' : 'Qualcuno dubiterà? 👀'}
          </p>
        </div>
      </section>
    );
  } else if (q.stage === 'BLOCK' && pd) {
    const blockers = I_ACTS[pd.act].blockers;
    stagePanel = (
      <section key={`b${q.turnNo}`} className="pop flex flex-col gap-2 rounded-3xl border-4 border-sky-300 bg-slate-900 p-3 text-center">
        <p className="text-xs font-black uppercase tracking-widest text-sky-300">Si può bloccare</p>
        <p className="text-lg font-black leading-tight text-white">
          {actor === me ? 'Vuoi' : `${name(actor)} vuole`} {phrase(pd.act, targetName, toMe)}
        </p>
        <p className="text-sm font-bold text-slate-300">
          {pd.act === 'AIUTI' ? 'Chiunque può bloccarlo dichiarando il Duca 🤴' : `Lo blocca ${blockers.map((c) => `${I_CHARS[c].the} ${I_CHARS[c].emoji}`).join(' o ')}`}
        </p>
        <p className="font-black text-sky-200">
          {canReact ? 'Vuoi bloccare? (puoi anche bluffare) 🛡️' : actor === me ? 'Speriamo che nessuno blocchi…' : q.eligible.includes(me) ? 'Hai lasciato passare.' : `Aspettiamo ${q.eligible.length === 1 ? name(q.eligible[0]) : 'gli altri'}…`}
        </p>
      </section>
    );
  } else if (q.stage === 'BLOCK_CHALLENGE' && pd?.blockAs) {
    stagePanel = (
      <section key={`bc${q.turnNo}`} className="pop flex items-center gap-3 rounded-3xl border-4 border-sky-300 bg-slate-900 p-3">
        <div className="w-[118px] shrink-0">
          <CharCard c={pd.blockAs} size="md" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-widest text-sky-300">Blocco!</p>
          <p className="text-lg font-black leading-tight text-white">
            {pd.blocker === me ? 'Blocchi' : `${name(pd.blocker)} blocca`} con {I_CHARS[pd.blockAs].the}
          </p>
          <p className="mt-1 text-sm font-bold text-slate-300">{pd.actor === me ? 'La tua mossa' : `La mossa di ${name(pd.actor)}`}: {phrase(pd.act, targetName, toMe)}</p>
          <p className="mt-2 font-black text-sky-200">{pd.blocker === me ? 'Qualcuno dubiterà? 😇' : canReact ? 'Ci credi? 🤨' : q.passed.includes(me) ? 'Hai lasciato passare. Aspettiamo gli altri…' : 'Qualcuno dubiterà? 👀'}</p>
        </div>
      </section>
    );
  } else if (q.stage === 'LOSE' && q.lose) {
    stagePanel =
      q.lose.who === me ? (
        <section className="pop rounded-3xl border-4 border-rose-400 bg-rose-950/60 p-3 text-center">
          <p className="font-display text-2xl text-rose-300">{WHY_ME[q.lose.why]}</p>
          <p className="font-black text-white">Perdi un personaggio: tocca qui sotto quale scoprire 👇</p>
        </section>
      ) : (
        <section className="rounded-3xl border-2 border-rose-400/50 bg-slate-900 p-4 text-center">
          <p className="text-lg font-black text-white">
            💔 {name(q.lose.who)} {WHY[q.lose.why]}
          </p>
          <p className="text-sm font-bold text-slate-300">Sta scegliendo quale personaggio scoprire…</p>
        </section>
      );
  } else if (q.stage === 'EXCHANGE') {
    stagePanel = q.exchange ? (
      <section className="pop flex flex-col gap-2 rounded-3xl border-4 border-emerald-300 bg-slate-900 p-3">
        <p className="text-center font-display text-xl text-emerald-300">🔄 Scegli {q.keep === 1 ? 'la carta' : `le ${q.keep} carte`} da tenere</p>
        <p className="text-center text-xs font-bold text-slate-300">Le altre tornano mescolate nel mazzo. Nessuno vede cosa scegli.</p>
        <div className="grid grid-cols-2 gap-2">
          {q.exchange.map((c, i) => (
            <CharCard
              key={i}
              c={c}
              size="md"
              selected={keepSel.includes(i)}
              onClick={() => {
                soundManager.playClick();
                setKeepSel((k) => (k.includes(i) ? k.filter((x) => x !== i) : k.length >= q.keep ? [...k.slice(1), i] : [...k, i]));
              }}
              tag={i >= q.keep && <span className="absolute left-1 top-1 rounded-full bg-amber-400 px-1.5 text-[10px] font-black text-slate-950">NUOVA</span>}
            />
          ))}
        </div>
      </section>
    ) : (
      <section className="rounded-3xl border-2 border-emerald-300/50 bg-slate-900 p-4 text-center">
        <p className="text-lg font-black text-white">🔄 {name(actor)} sta scambiando le carte con il mazzo…</p>
      </section>
    );
  }

  // ---------------------------------------------------------------- le mie carte
  const losing = q.stage === 'LOSE' && q.lose?.who === me;
  const hand = q.hand ? (
    <section className="flex flex-col gap-2">
      <p className="text-center text-xs font-black uppercase tracking-widest text-slate-400">
        {playing ? 'Le tue carte segrete (non farle vedere!)' : 'Sei fuori 💀: goditi gli intrighi degli altri'}
      </p>
      <div className="grid grid-cols-2 gap-3">
        {q.hand.map((c, i) => (
          <CharCard
            key={`${i}-${c.c}`}
            c={c.c}
            dead={c.dead}
            onClick={losing && !c.dead ? () => send('MG_LOSE', { i }) : undefined}
            tag={losing && !c.dead && <span className="absolute bottom-1 rounded-full bg-rose-500 px-2 text-[11px] font-black text-white">Scopri questa</span>}
          />
        ))}
      </div>
    </section>
  ) : (
    <p className="text-center font-bold text-slate-400">Stai guardando la partita 👀</p>
  );

  // ---------------------------------------------------------------- pulsanti in basso
  let bar: ReactNode = null;
  if (myTurn) {
    const ready = sel && (!I_ACTS[sel].target || target);
    bar = (
      <button
        type="button"
        disabled={!ready}
        onClick={() => sel && send('MG_ACT', { act: sel, target })}
        className="h-16 min-w-0 flex-1 truncate rounded-2xl bg-amber-400 px-3 text-lg font-black text-slate-950 shadow-[0_5px_0_#b45309] disabled:bg-slate-700 disabled:text-slate-400 disabled:shadow-none"
      >
        {!sel ? 'Scegli una mossa' : !ready ? '🎯 Scegli il bersaglio' : `${I_ACTS[sel].emoji} ${I_ACTS[sel].name}${target ? ` → ${name(target)}` : ''}`}
      </button>
    );
  } else if (canReact && (q.stage === 'CHALLENGE' || q.stage === 'BLOCK_CHALLENGE')) {
    bar = (
      <>
        <button type="button" onClick={() => send('MG_CHALLENGE')} className="h-16 flex-1 rounded-2xl bg-rose-500 text-xl font-black text-white shadow-[0_5px_0_#9f1239] active:translate-y-1">
          DUBITO! 🤨
        </button>
        <button type="button" onClick={() => send('MG_PASS')} className="h-16 flex-1 rounded-2xl bg-slate-700 text-base font-black text-white shadow-[0_5px_0_#1e293b] active:translate-y-1">
          LASCIA PASSARE
        </button>
      </>
    );
  } else if (canReact && q.stage === 'BLOCK' && pd) {
    bar = (
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex gap-2">
          {I_ACTS[pd.act].blockers.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => send('MG_BLOCK', { as: c })}
              className="h-14 min-w-0 flex-1 truncate rounded-2xl bg-sky-500 px-2 text-base font-black text-white shadow-[0_5px_0_#075985] active:translate-y-1"
            >
              BLOCCO {I_CHARS[c].emoji} {I_CHARS[c].name}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => send('MG_PASS')} className="h-12 rounded-2xl bg-slate-700 text-base font-black text-white">
          LASCIA PASSARE
        </button>
      </div>
    );
  } else if (q.stage === 'EXCHANGE' && q.exchange) {
    bar = (
      <button
        type="button"
        disabled={keepSel.length !== q.keep}
        onClick={() => send('MG_KEEP', { keep: keepSel })}
        className="h-16 flex-1 rounded-2xl bg-emerald-500 text-lg font-black text-white disabled:bg-slate-700 disabled:text-slate-400"
      >
        {keepSel.length === q.keep ? 'Tengo queste ✓' : `Scegline ${q.keep - keepSel.length}`}
      </button>
    );
  } else {
    bar = (
      <p className="min-w-0 flex-1 truncate rounded-2xl border-2 border-slate-700 bg-slate-900/95 px-4 py-3 text-sm font-bold text-slate-200">
        {losing ? '👆 Scegli quale carta perdere' : !playing ? '🍿 Guardi la corte' : q.stage === 'TURN' ? `Tocca a ${name(q.turn)}` : 'Aspetta…'}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3 pb-40">
      <div className="flex items-center justify-between gap-2">
        <GameChip>👑 Turno {q.turnNo}</GameChip>
        <span className="flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1 text-sm font-black text-slate-200 shadow-[0_4px_0_rgba(22,6,72,0.4)]">
          <CardBack w={12} /> Mazzo {q.deck}
        </span>
        <TimerRing left={left} total={Math.round(q.stageMs / 1000)} />
      </div>

      <div className={`grid gap-2 ${q.order.length <= 4 ? 'grid-cols-2' : 'grid-cols-3'}`}>{q.order.map(seat)}</div>

      {stagePanel}
      {hand}

      <details className="rounded-2xl border-2 border-white/10 bg-slate-900 p-3">
        <summary className="cursor-pointer text-sm font-black text-slate-200">📖 I personaggi (3 copie ciascuno) e quanti ne restano nascosti</summary>
        <ul className="mt-2 flex flex-col gap-1.5">
          {I_CHAR_LIST.map((c) => {
            // copie che potrebbero avere gli altri: 3 meno quelle scoperte e meno le mie
            const shown = q.order.reduce((n, id) => n + (q.seats[id]?.dead.filter((x) => x === c).length ?? 0), 0);
            const hiddenN = Math.max(0, 3 - shown - myLive.filter((x) => x === c).length);
            return (
              <li key={c} className="flex items-center gap-2 text-xs font-bold text-slate-200">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-linear-to-b text-xl ${CHAR_BG[c]}`}>{I_CHARS[c].emoji}</span>
                <span className="min-w-0 flex-1">
                  <b className="text-white">{I_CHARS[c].name}</b> — {I_CHARS[c].power}
                  {I_CHARS[c].block && <span className="text-sky-300"> · 🛡️ {I_CHARS[c].block}</span>}
                </span>
                <span className="shrink-0 rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-black text-amber-200">{hiddenN}/3</span>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-[11px] font-bold text-slate-400">Con 10 monete il colpo di stato è obbligatorio. Chi dubita a torto perde un personaggio; chi viene beccato a bluffare pure.</p>
      </details>

      {cronaca}

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 top-1/3 z-40 flex justify-center px-6">
          <p
            key={toast.n}
            className={`reveal-pop max-w-sm rounded-3xl border-4 border-white px-5 py-4 text-center font-display text-2xl leading-tight text-white shadow-[0_10px_0_rgba(0,0,0,0.35)] ${
              toast.tone === 'truth' ? 'bg-emerald-500' : toast.tone === 'bluff' ? 'bg-rose-500' : 'bg-slate-700'
            }`}
          >
            {toast.tone === 'truth' ? 'DICEVA IL VERO! ✅' : toast.tone === 'bluff' ? 'BLUFF SCOPERTO! 🤥' : 'FUORI DALLA CORTE! 💀'}
            <span className="mt-1 block font-sans text-sm font-bold">{toast.text}</span>
          </p>
        </div>
      )}

      <BottomBar>
        <div className="flex items-stretch gap-2">
          {bar}
          {canLead && (
            <button type="button" onClick={onForce} className="flex shrink-0 items-center gap-1 rounded-2xl bg-slate-800 px-3 text-sm font-black text-amber-200">
              <FastForward size={16} /> Avanti
            </button>
          )}
        </div>
      </BottomBar>
    </div>
  );
}

function isWindowStage(st: IData['stage']) {
  return st === 'CHALLENGE' || st === 'BLOCK' || st === 'BLOCK_CHALLENGE';
}
