import { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { Delete, FastForward } from 'lucide-react';
import type { CinqueView as CqData } from '../../data/flat/cinque';
import { useCountdown } from '../../hooks/useCountdown';
import { haptic, soundManager } from '../../utils/audio';
import { GameChip, Podium, TimerRing } from '../fx';
import { Avatar, BottomBar, EndBar, Ranking, type ModeProps } from '../ui';

const COLOR: Record<string, string> = { G: '#22c55e', Y: '#eab308', X: '#475569' };
const RANK: Record<string, number> = { X: 1, Y: 2, G: 3 };
const KEYS = ['qwertyuiop', 'asdfghjkl', '+zxcvbnm-']; // + = invio, - = cancella

// animazioni delle caselle (giro, battitura, vittoria)
const CSS = `
@keyframes cqFlip {
  0% { transform: rotateX(0); background: #0f172a; border-color: #64748b; }
  49% { background: #0f172a; border-color: #64748b; }
  50% { transform: rotateX(90deg); background: var(--cq); border-color: var(--cq); }
  100% { transform: rotateX(0); background: var(--cq); border-color: var(--cq); }
}
.cq-flip { animation: cqFlip 0.55s ease-in-out both; }
@keyframes cqType { 50% { transform: scale(1.12); } }
.cq-type { animation: cqType 0.12s ease-out; }
@keyframes cqWin { 0%, 100% { transform: translateY(0); } 40% { transform: translateY(-16px); } }
`;

// 🟩 Cinque lettere: la parola segreta di 5 lettere, a gara
export default function CinqueView({ state, clockOffset, canLead, onAction, onNewGame, onBackToLobby, onForce }: ModeProps) {
  const q = state.mg as CqData;
  const me = state.myId;
  const P = (id: string) => state.players.find((p) => p.id === id);
  const live = q.stage === 'READY' || q.stage === 'PLAY';
  const left = useCountdown(live ? q.stageEndsAt : null, clockOffset);
  const [typed, setTyped] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; n: number } | null>(null);
  const iPlay = q.order.includes(me);
  const rows = q.myRows;
  const solved = rows.some((r) => r.c === 'GGGGG');
  const done = solved || rows.length >= q.maxTries;
  const canType = q.stage === 'PLAY' && iPlay && !done;

  // stato dei tasti: il colore migliore visto per ogni lettera
  const keyState: Record<string, string> = {};
  for (const r of rows)
    [...r.w].forEach((ch, i) => {
      if (RANK[r.c[i]] > (RANK[keyState[ch]] ?? 0)) keyState[ch] = r.c[i];
    });

  // round nuovo: si riparte da zero; riga accettata dal server: si svuota quella in scrittura
  useEffect(() => {
    setTyped('');
    setPending(null);
    setMsg(null);
  }, [q.round]);
  useEffect(() => {
    setPending(null);
    if (!rows.length) return;
    const last = rows[rows.length - 1];
    if (last.c === 'GGGGG') {
      soundManager.playSuccess();
      haptic([30, 40, 30]);
      setTimeout(() => confetti({ particleCount: 90, spread: 70, origin: { y: 0.35 } }), 700);
    } else if (rows.length >= q.maxTries) setTimeout(() => soundManager.playError(), 600);
    else setTimeout(() => soundManager.playPop(), 600);
  }, [rows.length]);
  useEffect(() => {
    if (q.stage === 'PLAY') soundManager.playReveal();
    if (q.stage === 'REVEAL') soundManager.playDrumroll(0.6);
    if (q.stage === 'END') {
      soundManager.playVictory();
      confetti({ particleCount: 150, spread: 90, origin: { y: 0.35 } });
    }
  }, [q.stage, q.round]);
  // se il server non accetta la riga (tempo scaduto…), dopo un attimo si può riscrivere
  useEffect(() => {
    if (!pending) return;
    const t = setTimeout(() => setPending(null), 2500);
    return () => clearTimeout(t);
  }, [pending]);
  // qualcun altro l'ha trovata: un "pop" per tutti
  const solvers = q.solvedOrder.length;
  useEffect(() => {
    if (solvers > 0 && !q.solvedOrder.includes(me)) soundManager.playPop();
  }, [solvers]);

  const say = (text: string) => {
    setMsg((m) => ({ text, n: (m?.n ?? 0) + 1 }));
    haptic([20, 30, 20]);
  };
  const press = (k: string) => {
    if (!canType || pending) return;
    if (k === '-') return setTyped((t) => t.slice(0, -1));
    if (k === '+') {
      if (typed.length < 5) return say('Servono 5 lettere ✋');
      if (!/[aeiou]/.test(typed)) return say('Serve almeno una vocale 🤔');
      if (rows.some((r) => r.w === typed)) return say('L’hai già provata! 🙃');
      onAction('MG_GUESS', { word: typed });
      haptic(15);
      setPending(typed);
      setTyped('');
      setMsg(null);
      return;
    }
    if (typed.length < 5) {
      haptic(6);
      setTyped((t) => t + k);
    }
  };
  // tastiera vera (computer)
  useEffect(() => {
    if (!canType) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Enter') press('+');
      else if (e.key === 'Backspace') press('-');
      else if (/^[a-zA-Z]$/.test(e.key)) press(e.key.toLowerCase());
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const style = <style>{CSS}</style>;

  if (q.stage === 'END') {
    const ranking = Object.entries(q.scores).sort((x, y) => y[1] - x[1]);
    return (
      <div className="stagger flex flex-col gap-4">
        {style}
        <h2 className="text-center text-3xl text-white">Maestri delle parole 🟩</h2>
        <Podium state={state} entries={ranking.map(([id, points]) => ({ id, value: `${points} ${points === 1 ? 'punto' : 'punti'}` }))} />
        <section className="rounded-3xl border-2 border-white/10 bg-slate-900 p-4">
          <Ranking state={state} scores={q.scores} />
        </section>
        <section className="flex flex-col gap-1.5 rounded-3xl border-2 border-white/10 bg-slate-900 p-3">
          {q.history.map((h, i) => (
            <p key={i} className="flex items-center gap-2 rounded-2xl bg-slate-800 p-2 text-sm font-bold text-white">
              <span className="flex gap-0.5">
                {[...h.word].map((ch, j) => (
                  <span key={j} className="grid h-7 w-7 place-items-center rounded-md bg-emerald-500 font-display uppercase text-white">
                    {ch}
                  </span>
                ))}
              </span>
              <span className="flex-1 text-right text-xs text-slate-300">{h.solvers.length ? `trovata da ${h.solvers.length}` : 'nessuno 😅'}</span>
              {h.solvers[0] && P(h.solvers[0]) && <Avatar avatar={P(h.solvers[0])!.avatar} color={P(h.solvers[0])!.color} size={24} />}
            </p>
          ))}
        </section>
        <EndBar canLead={canLead} hostName={P(state.hostId)?.name} onNewGame={onNewGame} onBackToLobby={onBackToLobby} />
      </div>
    );
  }

  // la mia griglia: righe giocate, riga in scrittura, righe vuote
  const tile = 'grid aspect-square w-[min(15vw,3.6rem)] place-items-center rounded-xl border-[3px] font-display text-[min(8vw,2rem)] uppercase leading-none text-white';
  const grid = (
    <section className="flex flex-col items-center gap-1.5">
      {Array.from({ length: q.maxTries }, (_, r) => {
        const row = rows[r];
        if (row) {
          const win = row.c === 'GGGGG';
          return (
            <div key={`${q.round}-${r}`} className="flex gap-1.5 [perspective:600px]">
              {[...row.w].map((ch, i) => (
                <span
                  key={i}
                  className={`${tile} cq-flip`}
                  style={{
                    ['--cq' as string]: COLOR[row.c[i]],
                    animation: win ? `cqFlip 0.55s ease-in-out ${i * 0.18}s both, cqWin 0.5s ease ${1.5 + i * 0.08}s` : undefined,
                    animationDelay: win ? undefined : `${i * 0.18}s`,
                  }}
                >
                  {ch}
                </span>
              ))}
            </div>
          );
        }
        const current = r === rows.length && canType;
        const letters = current ? (pending ?? typed) : '';
        return (
          <div key={`${q.round}-${r}-${current && msg ? msg.n : ''}`} className={`flex gap-1.5 ${current && msg ? 'animate-shake' : ''}`}>
            {Array.from({ length: 5 }, (_, i) => (
              <span
                key={`${i}-${letters[i] ?? ''}`}
                className={`${tile} ${letters[i] ? 'cq-type border-slate-300 bg-slate-900' : current ? 'border-slate-600 bg-slate-950' : 'border-slate-800 bg-slate-950/60'}`}
              >
                {letters[i] ?? ''}
              </span>
            ))}
          </div>
        );
      })}
    </section>
  );

  // le griglie degli altri: colori sì, lettere no (fino alla rivelazione)
  const open = q.stage === 'REVEAL';
  // durante il round solo gli altri; alla rivelazione tutti, in ordine di arrivo
  const others = open ? q.boards : q.boards.filter((b) => b.id !== me);
  const boards = others.length > 0 && (
    <section className={`grid gap-2 ${open ? 'grid-cols-2' : 'grid-cols-3'}`}>
      {(open ? [...others].sort((a, b) => (a.ms ?? 1e12) - (b.ms ?? 1e12)) : others).map((b) => {
        const p = P(b.id);
        const failed = !b.solved && b.rows.length >= q.maxTries;
        return (
          <div key={b.id} className={`flex flex-col items-center gap-1 rounded-2xl p-2 ${b.solved ? 'bg-emerald-500/20 ring-2 ring-emerald-400/50' : 'bg-slate-900'}`}>
            <span className="flex max-w-full items-center gap-1">
              {p && <Avatar avatar={p.avatar} color={p.color} size={20} />}
              <span className="truncate text-xs font-black text-white">{p?.name ?? '?'}</span>
              <span className="text-xs">{b.solved ? '✅' : failed ? '❌' : ''}</span>
            </span>
            <span className="flex flex-col gap-0.5">
              {Array.from({ length: q.maxTries }, (_, r) => (
                <span key={r} className="flex gap-0.5">
                  {Array.from({ length: 5 }, (_, i) => {
                    const row = b.rows[r];
                    return (
                      <span
                        key={i}
                        className={`grid place-items-center rounded-[3px] font-black uppercase leading-none text-white ${open ? 'h-5 w-5 text-[11px]' : 'h-3 w-3'}`}
                        style={{ background: row ? COLOR[row.c[i]] : '#1e293b' }}
                      >
                        {open ? (row?.w?.[i] ?? '') : ''}
                      </span>
                    );
                  })}
                </span>
              ))}
            </span>
            {open && b.solved && <span className="text-[11px] font-black text-amber-300">+{q.gained[b.id] ?? 0}</span>}
          </div>
        );
      })}
    </section>
  );

  const keyboard = (
    <div className="flex flex-col gap-1.5">
      {KEYS.map((line, li) => (
        <div key={li} className="flex justify-center gap-1">
          {[...line].map((k) => {
            const st = keyState[k];
            const wide = k === '+' || k === '-';
            return (
              <button
                key={k}
                type="button"
                onClick={() => press(k)}
                aria-label={k === '+' ? 'Invio' : k === '-' ? 'Cancella' : k}
                className={`grid h-14 select-none place-items-center rounded-xl font-black uppercase shadow-[inset_0_-3px_0_rgba(0,0,0,0.25)] active:scale-95 ${
                  wide ? 'flex-[1.6] text-xs' : 'max-w-11 flex-1 text-xl'
                } ${k === '+' ? 'bg-amber-400 text-slate-950' : 'text-white'}`}
                style={{ background: k === '+' ? undefined : st ? COLOR[st] : '#334155', opacity: st === 'X' ? 0.55 : 1 }}
              >
                {k === '+' ? 'INVIO' : k === '-' ? <Delete size={22} /> : k}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );

  return (
    <div className={`stagger flex flex-col gap-3 ${canType ? 'pb-64' : 'pb-32'}`}>
      {style}
      <div className="flex items-center justify-between gap-2">
        <GameChip>
          🟩 Parola {q.round}/{q.rounds}
        </GameChip>
        <span className="rounded-full bg-amber-400 px-3 py-1 text-sm font-black text-slate-950 shadow-[0_4px_0_rgba(22,6,72,0.4)]">⭐ {q.scores[me] ?? 0}</span>
        {canLead && (
          <button type="button" onClick={onForce} aria-label="Avanti" className="grid h-10 w-10 place-items-center rounded-full bg-slate-800 text-amber-200">
            <FastForward size={18} />
          </button>
        )}
        {live ? <TimerRing left={left} total={q.stage === 'READY' ? 3 : 180} /> : <span className="w-14" />}
      </div>

      {q.stage === 'READY' && (
        <section key={`r${q.round}`} className="pop flex flex-col items-center gap-2 rounded-3xl border-4 border-white/90 bg-linear-to-br from-emerald-400 to-teal-700 p-8 text-center shadow-[0_8px_0_rgba(22,6,72,0.5)]">
          <p className="text-sm font-black uppercase tracking-widest text-white/80">
            Parola {q.round} di {q.rounds}
          </p>
          <p key={left ?? 0} className="count-pop font-display text-8xl text-white [text-shadow:0_4px_0_rgba(0,0,0,0.25)]">
            {left || '🟩'}
          </p>
          <p className="text-lg font-black text-white">5 lettere, 6 tentativi, 3 minuti</p>
        </section>
      )}

      {q.stage === 'REVEAL' && q.secret && (
        <section className="reveal-pop flex flex-col items-center gap-2 rounded-3xl border-4 border-white/90 bg-linear-to-br from-slate-700 to-slate-900 p-4 text-center shadow-[0_8px_0_rgba(22,6,72,0.5)]">
          <p className="text-xs font-black uppercase tracking-widest text-white/80">La parola era</p>
          <span className="flex gap-1.5">
            {[...q.secret].map((ch, i) => (
              <span key={i} className={`${tile} cq-flip`} style={{ ['--cq' as string]: COLOR.G, animationDelay: `${i * 0.15}s` }}>
                {ch}
              </span>
            ))}
          </span>
          {iPlay && (
            <p className="font-black text-white">
              {solved ? `Trovata in ${rows.length} ${rows.length === 1 ? 'tentativo' : 'tentativi'}! +${q.gained[me] ?? 0} ⭐` : 'Stavolta ti è sfuggita 😬'}
            </p>
          )}
        </section>
      )}

      {q.stage === 'PLAY' && msg && (
        <p key={msg.n} className="pop text-center font-black text-amber-300">
          {msg.text}
        </p>
      )}
      {q.stage === 'PLAY' && iPlay && grid}
      {q.stage === 'PLAY' && done && iPlay && (
        <p className="pop text-center font-black text-white">
          {solved
            ? `✅ Trovata! +${q.gained[me] ?? 0} ${q.solvedOrder[0] === me ? '(sei il primo! 🏆)' : ''}`
            : '😵 Tentativi finiti: la parola si scopre alla fine del round'}
        </p>
      )}
      {q.stage === 'PLAY' && !iPlay && <p className="text-center font-bold text-slate-300">Stai guardando: vedi i colori di tutti, ma non le lettere 👀</p>}
      {q.stage !== 'READY' && boards}

      <BottomBar>
        {canType ? (
          keyboard
        ) : (
          <p className="truncate rounded-2xl border-2 border-slate-700 bg-slate-900/95 px-4 py-3 text-center text-sm font-bold text-slate-200">
            {q.stage === 'READY'
              ? 'Pronti… si parte!'
              : q.stage === 'PLAY'
                ? `Trovata da ${q.solvedOrder.length}/${q.order.length} · aspetta gli altri…`
                : q.round < q.rounds
                  ? 'Prossima parola in arrivo…'
                  : 'Ultima parola: classifica in arrivo! 🏆'}
          </p>
        )}
      </BottomBar>
    </div>
  );
}
