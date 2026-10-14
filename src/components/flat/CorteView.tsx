import { useEffect, useRef, useState, type ReactNode } from 'react';
import confetti from 'canvas-confetti';
import { FastForward } from 'lucide-react';
import { C_CARDS, C_VALUES, type CHow, type CorteView as CData, type CTone } from '../../data/flat/corte';
import { useCountdown } from '../../hooks/useCountdown';
import { haptic, soundManager } from '../../utils/audio';
import { GameChip, Podium, TimerRing } from '../fx';
import { Avatar, BottomBar, EndBar, Ranking, type ModeProps } from '../ui';

// colori delle carte per valore (stessa forma per tutte)
const CARD_BG: Record<number, string> = {
  1: 'from-slate-400 to-slate-700',
  2: 'from-indigo-400 to-indigo-700',
  3: 'from-orange-400 to-orange-700',
  4: 'from-teal-300 to-emerald-600',
  5: 'from-sky-400 to-blue-700',
  6: 'from-amber-300 to-yellow-600',
  7: 'from-fuchsia-400 to-purple-700',
  8: 'from-rose-300 to-pink-600',
};
const TONE: Record<CTone, string> = {
  info: 'text-slate-300',
  play: 'text-white',
  hit: 'text-rose-300',
  miss: 'text-slate-300',
  out: 'text-rose-300',
  safe: 'text-teal-300',
  win: 'text-amber-300',
};
const HOW: Record<CHow, string> = { PRETE: '⛪ col Prete', BARONE: '🧐 col Barone', RE: '👑 scambio col Re' };

// Carta grande: valore nell'angolo, emoji, nome e potere scritto chiaro
function BigCard({ v, selected, disabled, onClick, tag, compact }: { v: number; selected?: boolean; disabled?: boolean; onClick?: () => void; tag?: ReactNode; compact?: boolean }) {
  const C = C_CARDS[v];
  const body = (
    <>
      <span className="absolute left-2 top-1 font-display text-3xl leading-none text-white [text-shadow:0_3px_0_rgba(0,0,0,0.3)]">{v}</span>
      <span className="absolute right-2 top-1.5 text-[10px] font-black text-white/80">×{C.count}</span>
      <span className={`${compact ? 'mt-3 text-5xl' : 'mt-4 text-6xl'} leading-tight drop-shadow-[0_4px_0_rgba(0,0,0,0.25)]`}>{C.emoji}</span>
      <span className={`font-display ${compact ? 'text-xl' : 'text-2xl'} leading-tight text-white [text-shadow:0_3px_0_rgba(0,0,0,0.25)]`}>{C.name}</span>
      <span className="mt-1 w-full rounded-xl bg-black/25 px-1.5 py-1 text-[11px] font-bold leading-tight text-white">{C.power}</span>
      {tag}
    </>
  );
  const cls = `relative flex ${compact ? 'min-h-[170px]' : 'min-h-[200px]'} w-full flex-col items-center overflow-hidden rounded-2xl border-4 bg-linear-to-b p-2 text-center shadow-[0_6px_0_rgba(22,6,72,0.5)] transition-transform ${CARD_BG[v]} ${
    selected ? '-translate-y-2 border-amber-300 ring-4 ring-amber-300/50' : 'border-white/90'
  } ${disabled ? 'opacity-40 grayscale' : ''}`;
  return onClick ? (
    <button type="button" disabled={disabled} onClick={onClick} className={cls}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

// Carta piccola degli scarti (tratteggiata se scartata per forza: Principe o eliminazione)
function MiniCard({ v, forced, size = 30 }: { v: number; forced?: boolean; size?: number }) {
  return (
    <span
      title={C_CARDS[v].name}
      className={`relative grid shrink-0 place-items-center rounded-md bg-linear-to-b ${CARD_BG[v]} ${forced ? 'border-2 border-dashed border-white/80' : 'border-2 border-white/90'} shadow-[0_2px_0_rgba(0,0,0,0.35)]`}
      style={{ width: size, height: size * 1.35 }}
    >
      <span className="absolute left-0.5 top-0 text-[9px] font-black leading-none text-white">{v}</span>
      <span style={{ fontSize: size * 0.5 }}>{C_CARDS[v].emoji}</span>
    </span>
  );
}

function CardBack({ w = 18 }: { w?: number }) {
  return (
    <span className="grid place-items-center rounded-md border-2 border-rose-200/80 bg-linear-to-br from-rose-500 to-red-800 text-[9px] shadow-[0_2px_0_rgba(0,0,0,0.35)]" style={{ width: w, height: w * 1.35 }}>
      💌
    </span>
  );
}

// 💌 Lettere a corte
export default function CorteView({ state, clockOffset, canLead, onAction, onNewGame, onBackToLobby, onForce }: ModeProps) {
  const q = state.mg as CData;
  const me = state.myId;
  const P = (id: string | null) => state.players.find((p) => p.id === id);
  const name = (id: string | null) => P(id)?.name ?? '?';
  const end = q.stage === 'END';
  const left = useCountdown(end ? null : q.stageEndsAt, clockOffset);
  const mySeat = q.seats[me];
  const myTurn = q.stage === 'TURN' && q.turn === me && !!q.hand && q.hand.length === 2;

  const [sel, setSel] = useState<number | null>(null); // indice della carta scelta
  const [target, setTarget] = useState<string | null>(null);
  const [guess, setGuess] = useState<number | null>(null);
  const lastLog = useRef<number | null>(null);

  useEffect(() => {
    setSel(null);
    setTarget(null);
    setGuess(null);
  }, [q.turnNo, q.stage]);

  useEffect(() => {
    if (myTurn) {
      soundManager.playStart();
      haptic([40, 60, 40]);
    }
  }, [myTurn, q.turnNo]);

  // suoni della cronaca: uguali per tutti (niente che tradisca le carte in mano)
  useEffect(() => {
    const last = q.log[q.log.length - 1];
    if (!last) return;
    const prev = lastLog.current;
    lastLog.current = last.n;
    if (prev === null || last.n <= prev) return;
    const tones = q.log.filter((l) => l.n > prev).map((l) => l.tone);
    if (end) {
      soundManager.playVictory();
      confetti({ particleCount: 160, spread: 95, origin: { y: 0.35 } });
    } else if (tones.includes('win')) {
      soundManager.playSuccess();
      confetti({ particleCount: 70, spread: 70, origin: { y: 0.4 } });
    } else if (tones.includes('hit') || tones.includes('out')) soundManager.playBoom();
    else if (tones.includes('miss')) soundManager.playPop();
    else if (tones.includes('safe')) soundManager.playWhoosh();
    else soundManager.playClick();
  }, [q.log, end]);

  const send = (type: string, payload?: unknown) => {
    onAction(type, payload);
    haptic(20);
  };

  // carte ancora "nascoste" per valore: totali meno quelle scoperte e meno le mie (aiuta a dedurre)
  const hidden = (v: number) => {
    let n = C_CARDS[v].count;
    for (const id of q.order) for (const d of q.seats[id]?.discards ?? []) if (d.v === v) n--;
    for (const x of q.faceUp) if (x === v) n--;
    for (const x of q.hand ?? []) if (x === v) n--;
    return Math.max(0, n);
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

  const hearts = (id: string, size = 'text-sm') => (
    <span className={`whitespace-nowrap ${size} leading-none`}>
      {Array.from({ length: q.goal }, (_, i) => (
        <span key={i} className={i < (q.letters[id] ?? 0) ? '' : 'opacity-20 grayscale'}>
          💌
        </span>
      ))}
    </span>
  );

  // ---------------------------------------------------------------- fine partita
  if (end) {
    const ranking = Object.entries(q.scores).sort((a, b) => b[1] - a[1]);
    return (
      <div className="stagger flex flex-col gap-4">
        <h2 className="text-center text-3xl text-white">{q.winners.length ? `💌 ${q.winners.map(name).join(' e ')} conquista la Principessa!` : 'Fine della partita'}</h2>
        <Podium state={state} entries={ranking.map(([id, n]) => ({ id, value: `${n} 💌` }))} />
        <section className="rounded-3xl border-2 border-white/10 bg-slate-900 p-4">
          <Ranking state={state} scores={q.scores} />
        </section>
        {cronaca}
        <EndBar canLead={canLead} hostName={P(state.hostId)?.name} onNewGame={onNewGame} onBackToLobby={onBackToLobby} />
      </div>
    );
  }

  const selV = sel !== null && q.hand ? q.hand[sel] : null;
  const needTarget = selV !== null && C_CARDS[selV].target;
  const validTargets = q.order.filter((id) => {
    const st = q.seats[id];
    if (!st?.inRound || st.out) return false;
    if (id === me) return selV === 5;
    return !st.safe;
  });
  const noTarget = needTarget && !validTargets.length;
  const ready = myTurn && selV !== null && (!needTarget || noTarget || (target && (selV !== 1 || guess !== null)));

  // ---------------------------------------------------------------- tavolo (con gli scarti di tutti: servono per dedurre)
  const table = (
    <section className="flex flex-col gap-1.5">
      {q.order.map((id) => {
        const p = P(id);
        const st = q.seats[id];
        if (!p || !st) return null;
        const isTurn = q.stage === 'TURN' && q.turn === id;
        const dim = !st.inRound || st.out || st.gone;
        const won = q.stage === 'ROUND' && q.roundEnd?.winners.includes(id);
        const shown = q.stage === 'ROUND' ? q.roundEnd?.hands[id] : undefined;
        return (
          <div
            key={id}
            className={`relative flex items-center gap-2 rounded-2xl border-2 px-2 py-1.5 transition ${
              won ? 'border-amber-300 bg-amber-400/20' : isTurn ? 'border-amber-300 bg-amber-400/15 shadow-[0_0_0_3px_rgba(252,211,77,0.3)]' : 'border-white/10 bg-slate-900'
            }`}
          >
            <span className={`relative ${dim ? 'opacity-40 grayscale' : ''} ${isTurn ? 'pulse-soft' : ''}`}>
              <Avatar avatar={p.avatar} color={p.color} size={36} />
              {st.safe && <span className="absolute -bottom-1 -right-1 text-base">🛡️</span>}
            </span>
            <div className="flex w-[84px] shrink-0 flex-col">
              <span className="truncate text-sm font-black text-white">
                {p.name}
                {id === me ? ' (tu)' : ''}
              </span>
              {hearts(id, 'text-[11px]')}
              <span className={`text-[10px] font-black ${isTurn ? 'text-amber-300' : st.out ? 'text-rose-300' : st.safe ? 'text-teal-300' : 'text-slate-400'}`}>
                {st.gone ? '🚪 uscito' : !st.inRound ? 'guarda' : st.out ? '💀 fuori dal giro' : isTurn ? '▶ di turno' : st.safe ? '🛡️ protetto' : 'in gioco'}
              </span>
            </div>
            <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-0.5">
              {st.discards.length ? (
                st.discards.map((d, i) => <MiniCard key={i} v={d.v} forced={d.forced} size={26} />)
              ) : (
                <span className="text-[11px] font-bold text-slate-500">nessuno scarto</span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              {shown ? (
                <MiniCard v={shown} size={34} />
              ) : (
                Array.from({ length: st.out ? 0 : st.cards }, (_, i) => <CardBack key={i} />)
              )}
            </div>
            {won && <span className="absolute -right-1 -top-2 text-xl">💌</span>}
          </div>
        );
      })}
      {q.faceUp.length > 0 && (
        <p className="flex items-center justify-center gap-1.5 text-xs font-bold text-slate-400">
          Tolte scoperte: {q.faceUp.map((v, i) => <MiniCard key={i} v={v} size={22} />)}
        </p>
      )}
    </section>
  );

  // ---------------------------------------------------------------- ultima giocata
  const lp = q.lastPlay;
  const lastPanel = lp && q.stage === 'TURN' && (
    <section key={lp.n} className="pop flex items-center gap-3 rounded-3xl border-2 border-white/10 bg-slate-900 p-2.5">
      <div className="w-[84px] shrink-0">
        <MiniCard v={lp.v} size={64} />
      </div>
      <p className="min-w-0 flex-1 text-sm font-bold leading-snug text-white">{lp.text}</p>
    </section>
  );

  // ---------------------------------------------------------------- informazioni segrete (solo mie)
  const notes = q.notes.length > 0 && (
    <section className="rounded-3xl border-2 border-indigo-300/40 bg-indigo-950/60 p-3">
      <p className="mb-1 text-xs font-black uppercase tracking-widest text-indigo-200">🤫 Solo tu sai che…</p>
      <ul className="flex flex-col gap-1">
        {[...q.notes].reverse().map((n, i) => (
          <li key={i} className={`flex items-center gap-2 text-sm font-bold ${n.stale ? 'text-slate-500 line-through' : 'text-white'} ${i === 0 && !n.stale ? 'pop' : ''}`}>
            <MiniCard v={n.card} size={22} />
            <span className="min-w-0 flex-1">
              {name(n.about)} {n.stale ? 'aveva' : 'ha'} {C_CARDS[n.card].the} ({n.card}) <span className="text-xs text-indigo-200">{HOW[n.how]}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );

  // ---------------------------------------------------------------- la mia mano
  let handPanel: ReactNode = null;
  if (q.hand === null) handPanel = <p className="text-center font-bold text-slate-400">Stai guardando la partita 👀</p>;
  else if (mySeat?.out || q.hand.length === 0) {
    handPanel = q.stage === 'TURN' && <p className="rounded-2xl bg-slate-900 p-3 text-center font-black text-rose-300">💀 Sei fuori da questo giro: aspetta il prossimo!</p>;
  } else {
    handPanel = (
      <section className="flex flex-col gap-2">
        <p className="text-center text-xs font-black uppercase tracking-widest text-slate-400">
          {myTurn ? 'Tocca a te! Scegli la carta da giocare 👇' : q.hand.length > 1 ? 'Le tue carte' : 'La tua carta segreta'}
        </p>
        <div className={`mx-auto grid w-full gap-3 ${q.hand.length > 1 ? 'grid-cols-2' : 'max-w-[190px] grid-cols-1'}`}>
          {q.hand.map((v, i) => {
            const blocked = myTurn && q.mustContessa && v !== 7;
            return (
              <BigCard
                key={`${i}-${v}`}
                v={v}
                selected={myTurn && sel === i}
                disabled={blocked}
                onClick={
                  myTurn
                    ? () => {
                        setSel(i);
                        setTarget(null);
                        setGuess(null);
                        soundManager.playClick();
                      }
                    : undefined
                }
                tag={
                  blocked ? (
                    <span className="absolute bottom-1 rounded-full bg-rose-500 px-2 text-[10px] font-black text-white">devi giocare la Contessa</span>
                  ) : myTurn && v === 8 ? (
                    <span className="absolute bottom-1 rounded-full bg-rose-500 px-2 text-[10px] font-black text-white">se la giochi sei fuori!</span>
                  ) : null
                }
              />
            );
          })}
        </div>
      </section>
    );
  }

  // ---------------------------------------------------------------- bersaglio e ipotesi della Guardia
  const chooser = myTurn && selV !== null && needTarget && (
    <section className="pop flex flex-col gap-2 rounded-3xl border-4 border-amber-300 bg-slate-900 p-3">
      {noTarget ? (
        <p className="text-center font-black text-teal-300">Sono tutti protetti 🛡️: la carta si gioca senza effetto</p>
      ) : (
        <>
          <p className="text-center font-black text-amber-300">{selV === 5 ? '🎯 Chi scarta e ripesca? (anche tu)' : '🎯 Su chi la giochi?'}</p>
          <div className="flex flex-wrap justify-center gap-2">
            {validTargets.map((id) => {
              const p = P(id);
              if (!p) return null;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTarget(id)}
                  className={`flex items-center gap-1.5 rounded-full border-2 py-1 pl-1 pr-3 text-sm font-black text-white ${target === id ? 'border-amber-300 bg-amber-400/30' : 'border-white/15 bg-slate-800'}`}
                >
                  <Avatar avatar={p.avatar} color={p.color} size={28} />
                  {id === me ? 'Me stesso' : p.name}
                </button>
              );
            })}
          </div>
          {selV === 1 && target && (
            <>
              <p className="text-center text-sm font-black text-white">Che carta ha {name(target)}? (non puoi dire Guardia)</p>
              <div className="grid grid-cols-4 gap-1.5">
                {C_VALUES.filter((v) => v > 1).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setGuess(v)}
                    className={`flex flex-col items-center rounded-xl border-2 p-1 ${guess === v ? 'border-amber-300 bg-amber-400/30' : 'border-white/10 bg-slate-800'} ${hidden(v) ? '' : 'opacity-40'}`}
                  >
                    <span className="text-2xl leading-tight">{C_CARDS[v].emoji}</span>
                    <span className="text-[11px] font-black leading-tight text-white">
                      {v} {C_CARDS[v].name}
                    </span>
                    <span className="text-[9px] font-bold text-slate-400">ancora {hidden(v)}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );

  // ---------------------------------------------------------------- fine del giro
  const re = q.roundEnd;
  const iReady = q.ready.includes(me);
  const roundPanel = q.stage === 'ROUND' && re && (
    <section className="reveal-pop flex flex-col items-center gap-2 rounded-3xl border-4 border-white/90 bg-linear-to-br from-rose-400 to-pink-700 p-4 text-center shadow-[0_8px_0_rgba(22,6,72,0.5)]">
      <p className="text-xs font-black uppercase tracking-widest text-white/80">Fine del giro {q.round}</p>
      <p className="font-display text-3xl leading-tight text-white [text-shadow:0_3px_0_rgba(0,0,0,0.25)]">
        {re.winners.length ? `${re.winners.map(name).join(' e ')} ${re.winners.length > 1 ? 'prendono' : 'prende'} una lettera 💌` : 'Nessun vincitore'}
      </p>
      <p className="text-sm font-bold text-white/90">{re.how === 'LAST' ? 'Tutti gli altri sono fuori!' : 'Mazzo finito: vince la carta più alta'}</p>
      {re.burned !== null && (
        <p className="flex items-center gap-1.5 text-xs font-bold text-white/90">
          La carta tolta all’inizio era <MiniCard v={re.burned} size={22} /> {C_CARDS[re.burned].name}
        </p>
      )}
    </section>
  );

  // ---------------------------------------------------------------- pulsanti in basso
  let bar: ReactNode;
  if (myTurn) {
    const label =
      selV === null
        ? 'Scegli una carta'
        : !ready
          ? needTarget && !target
            ? '🎯 Scegli il bersaglio'
            : '🤔 Che carta ha?'
          : `Gioca ${C_CARDS[selV].emoji} ${C_CARDS[selV].name}${target && !noTarget ? ` → ${target === me ? 'me' : name(target)}` : ''}${selV === 1 && guess && !noTarget ? `: ${C_CARDS[guess].name}?` : ''}`;
    bar = (
      <button
        type="button"
        disabled={!ready}
        onClick={() => sel !== null && send('MG_PLAY', { i: sel, target: noTarget ? null : target, guess })}
        className="h-16 min-w-0 flex-1 truncate rounded-2xl bg-amber-400 px-3 text-lg font-black text-slate-950 shadow-[0_5px_0_#b45309] disabled:bg-slate-700 disabled:text-slate-400 disabled:shadow-none"
      >
        {label}
      </button>
    );
  } else if (q.stage === 'ROUND' && q.order.includes(me)) {
    bar = (
      <button
        type="button"
        disabled={iReady}
        onClick={() => send('MG_READY')}
        className="h-16 min-w-0 flex-1 rounded-2xl bg-emerald-500 text-lg font-black text-white disabled:bg-slate-700 disabled:text-slate-300"
      >
        {iReady ? `Pronto ✓ (${q.ready.length}/${q.order.filter((id) => !q.seats[id]?.gone).length})` : 'Prossimo giro ▶'}
      </button>
    );
  } else {
    bar = (
      <p className="min-w-0 flex-1 truncate rounded-2xl border-2 border-slate-700 bg-slate-900/95 px-4 py-3 text-sm font-bold text-slate-200">
        {q.stage === 'TURN' ? `Tocca a ${name(q.turn)}… 🤔` : 'Aspetta…'}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3 pb-40">
      <div className="flex items-center justify-between gap-2">
        <GameChip>💌 Giro {q.round}</GameChip>
        <span className="flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1 text-xs font-black text-slate-200 shadow-[0_4px_0_rgba(22,6,72,0.4)]">
          <CardBack w={12} /> {q.deck} · vince chi fa {q.goal} 💌
        </span>
        <TimerRing left={left} total={Math.round(q.stageMs / 1000)} />
      </div>

      {q.stage === 'TURN' && q.turn !== me && (
        <p key={q.turnNo} className="pop flex items-center justify-center gap-2 text-center text-lg font-black text-white">
          {P(q.turn) && <Avatar avatar={P(q.turn)!.avatar} color={P(q.turn)!.color} size={30} />}
          Tocca a {name(q.turn)}
        </p>
      )}

      {roundPanel}
      {table}
      {lastPanel}
      {chooser}
      {handPanel}
      {notes}

      <details className="rounded-2xl border-2 border-white/10 bg-slate-900 p-3">
        <summary className="cursor-pointer text-sm font-black text-slate-200">📖 Le carte (e quante ne restano nascoste)</summary>
        <ul className="mt-2 flex flex-col gap-1.5">
          {C_VALUES.map((v) => (
            <li key={v} className="flex items-center gap-2 text-xs font-bold text-slate-200">
              <MiniCard v={v} size={24} />
              <span className="min-w-0 flex-1">
                <b className="text-white">{C_CARDS[v].name}</b> — {C_CARDS[v].power}
              </span>
              <span className="shrink-0 rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-black text-amber-200">
                {hidden(v)}/{C_CARDS[v].count}
              </span>
            </li>
          ))}
        </ul>
      </details>

      {cronaca}

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
