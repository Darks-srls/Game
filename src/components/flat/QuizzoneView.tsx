import { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { FastForward } from 'lucide-react';
import type { QuizzoneView as QZData } from '../../data/flat/quizzone';
import { useCountdown } from '../../hooks/useCountdown';
import { haptic, soundManager } from '../../utils/audio';
import { GameChip, PointsPop, Podium, TimerRing } from '../fx';
import { Avatar, BottomBar, EndBar, Ranking, type ModeProps } from '../ui';

// i quattro pulsanti da quiz televisivo: colore + forma (si distinguono anche senza leggere)
const ANS = [
  { shape: '▲', bg: 'bg-rose-500', shadow: 'shadow-[0_6px_0_#9f1239]' },
  { shape: '◆', bg: 'bg-sky-500', shadow: 'shadow-[0_6px_0_#075985]' },
  { shape: '●', bg: 'bg-amber-400', shadow: 'shadow-[0_6px_0_#a16207]' },
  { shape: '■', bg: 'bg-emerald-500', shadow: 'shadow-[0_6px_0_#065f46]' },
];

// colore della categoria (cartellone e pastiglia)
const CAT_BG: Record<string, string> = {
  cultura: 'from-violet-500 to-fuchsia-600',
  geografia: 'from-emerald-400 to-teal-600',
  storia: 'from-amber-400 to-orange-600',
  cinema: 'from-rose-500 to-red-700',
  musica: 'from-pink-400 to-fuchsia-600',
  sport: 'from-lime-400 to-green-600',
  scienza: 'from-cyan-400 to-blue-600',
  cibo: 'from-orange-400 to-red-500',
  italia: 'from-green-500 via-slate-100 to-red-500',
  tech: 'from-sky-400 to-indigo-600',
  curiosita: 'from-yellow-300 to-amber-500',
  piccante: 'from-red-600 to-rose-800',
};
const DIFF = ['', 'Facile', 'Media', 'Difficile'];
const STAGE_SECONDS: Record<QZData['stage'], number> = { READY: 3, QUESTION: 15, REVEAL: 4, RANKING: 6, END: 0 };
const secs = (ms: number) => `${(ms / 1000).toFixed(1).replace('.', ',')} s`;

// barra del tempo che si svuota in modo fluido (il TimerRing segna i secondi, questa dà l'ansia)
function TimeBar({ endsAt, total, clockOffset, color }: { endsAt: number | null; total: number; clockOffset: number; color: string }) {
  const [anim, setAnim] = useState<{ from: number; ms: number; go: boolean }>({ from: 1, ms: 0, go: false });
  useEffect(() => {
    if (!endsAt) return;
    const ms = Math.max(0, endsAt - (Date.now() + clockOffset));
    setAnim({ from: Math.min(1, ms / total), ms, go: false });
    let r2 = 0;
    const r1 = requestAnimationFrame(() => (r2 = requestAnimationFrame(() => setAnim((a) => ({ ...a, go: true })))));
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
    };
  }, [endsAt, total, clockOffset]);
  return (
    <div className="h-3 overflow-hidden rounded-full bg-slate-900/80 ring-2 ring-white/10">
      <div
        className={`h-full rounded-full ${color}`}
        style={{ width: anim.go ? '0%' : `${anim.from * 100}%`, transition: anim.go ? `width ${anim.ms}ms linear` : 'none' }}
      />
    </div>
  );
}

// ❓ Quizzone: quattro risposte, una giusta, vince chi è giusto e veloce
export default function QuizzoneView({ state, clockOffset, canLead, onAction, onNewGame, onBackToLobby, onForce }: ModeProps) {
  const q = state.mg as QZData;
  const me = state.myId;
  const P = (id: string) => state.players.find((p) => p.id === id);
  const left = useCountdown(q.stage === 'END' ? null : q.stageEndsAt, clockOffset);
  const playing = q.order.includes(me);
  const online = q.order.filter((id) => P(id)?.isOnline).length;
  const reveal = q.stage === 'REVEAL';
  const right = reveal && q.myPick !== null && q.myPick === q.correct;
  const myGain = q.gained[me] ?? 0;
  const myStreak = q.streaks[me] ?? 0;
  const catBg = CAT_BG[q.cat] ?? CAT_BG.cultura;

  // suoni (uguali per tutti tranne il giusto/sbagliato, che tanto è pubblico)
  useEffect(() => {
    if (q.stage === 'READY') soundManager.playWhoosh();
    if (q.stage === 'QUESTION') soundManager.playStart();
    if (q.stage === 'REVEAL') {
      soundManager.playReveal();
      if (right) {
        soundManager.playSuccess();
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.55 }, scalar: 0.8 });
      } else if (q.myPick !== null) soundManager.playError();
    }
    if (q.stage === 'RANKING') soundManager.playDrumroll(1.2);
    if (q.stage === 'END') {
      soundManager.playVictory();
      confetti({ particleCount: 160, spread: 100, origin: { y: 0.35 } });
    }
  }, [q.stage, q.qNo]);

  const answer = (i: number) => {
    if (q.stage !== 'QUESTION' || q.myPick !== null || !playing) return;
    onAction('MG_ANSWER', { i });
    haptic(25);
    soundManager.playClick();
  };

  // ---------------------------------------------------------------- fine partita
  if (q.stage === 'END') {
    const ranking = Object.entries(q.scores).sort((a, b) => b[1] - a[1]);
    const best = (key: 'ok' | 'fast' | 'best') => {
      const top = Object.entries(q.stats).sort((a, b) => b[1][key] - a[1][key])[0];
      return top && top[1][key] > 0 ? { id: top[0], n: top[1][key] } : null;
    };
    const awards = [
      { icon: '🎯', label: 'Più risposte giuste', w: best('ok'), unit: (n: number) => `${n}/${q.qCount}` },
      { icon: '⚡', label: 'Il più fulmineo', w: best('fast'), unit: (n: number) => `${n} ${n === 1 ? 'volta' : 'volte'} primo` },
      { icon: '🔥', label: 'Serie più lunga', w: best('best'), unit: (n: number) => `${n} di fila` },
    ];
    return (
      <div className="stagger flex flex-col gap-4 pb-28">
        <h2 className="text-center text-3xl text-white">Campioni del Quizzone 🏆</h2>
        <Podium state={state} entries={ranking.map(([id, pts]) => ({ id, value: `${pts} punti` }))} />
        <section className="grid grid-cols-3 gap-2">
          {awards.map((a, i) => {
            const p = a.w && P(a.w.id);
            return (
              <div key={a.label} style={{ animationDelay: `${0.6 + i * 0.12}s` }} className="pop flex flex-col items-center gap-1 rounded-2xl bg-slate-900 p-2 text-center ring-2 ring-white/10">
                <span className="text-2xl">{a.icon}</span>
                <span className="text-[10px] font-black uppercase leading-tight text-slate-300">{a.label}</span>
                {p && a.w ? (
                  <>
                    <Avatar avatar={p.avatar} color={p.color} size={30} />
                    <span className="max-w-full truncate text-xs font-black text-white">{p.name}</span>
                    <span className="text-[11px] font-bold text-amber-300">{a.unit(a.w.n)}</span>
                  </>
                ) : (
                  <span className="text-xs font-bold text-slate-500">nessuno</span>
                )}
              </div>
            );
          })}
        </section>
        <section className="rounded-3xl border-2 border-white/10 bg-slate-900 p-4">
          <Ranking state={state} scores={q.scores} />
        </section>
        <EndBar canLead={canLead} hostName={P(state.hostId)?.name} onNewGame={onNewGame} onBackToLobby={onBackToLobby} />
      </div>
    );
  }

  const header = (
    <div className="flex items-center justify-between gap-2">
      <GameChip>
        ❓ {q.qNo}/{q.qCount}
      </GameChip>
      {playing && myStreak >= 2 && (
        <span key={myStreak} className="pop rounded-full bg-orange-500 px-3 py-1 text-sm font-black text-white shadow-[0_4px_0_rgba(22,6,72,0.4)]">
          🔥 ×{myStreak}
        </span>
      )}
      <span className="rounded-full bg-amber-400 px-3 py-1 text-sm font-black text-slate-950 shadow-[0_4px_0_rgba(22,6,72,0.4)]">{playing ? `${q.scores[me] ?? 0} pt` : '👀 Spettatore'}</span>
      <TimerRing left={left} total={STAGE_SECONDS[q.stage]} />
    </div>
  );

  const catPill = (
    <div className="flex items-center justify-center gap-2">
      <span className={`flex items-center gap-1.5 rounded-full bg-linear-to-r px-3 py-1 text-sm font-black text-white shadow-[0_3px_0_rgba(0,0,0,0.25)] ${catBg}`}>
        <span className="text-base">{q.catIcon}</span>
        <span className="[text-shadow:0_1px_2px_rgba(0,0,0,0.45)]">{q.catName}</span>
      </span>
      <span className="text-xs font-black uppercase tracking-wider text-amber-200">
        {'★'.repeat(q.diff)}
        <span className="text-white/25">{'★'.repeat(3 - q.diff)}</span> {DIFF[q.diff]}
      </span>
    </div>
  );

  const questionCard = (big: boolean) => (
    <section key={`q-${q.qNo}`} className="pop relative rounded-3xl border-4 border-white/90 bg-white p-5 text-center shadow-[0_8px_0_rgba(22,6,72,0.5)]">
      <p className={`font-black leading-tight text-slate-950 ${big ? 'text-[26px]' : 'text-xl'}`}>{q.question}</p>
    </section>
  );

  // ---------------------------------------------------------------- classifica a metà
  if (q.stage === 'RANKING') {
    const rank = [...q.order].sort((a, b) => (q.scores[b] ?? 0) - (q.scores[a] ?? 0));
    return (
      <div className="stagger flex flex-col gap-4 pb-28">
        {header}
        <h2 className="reveal-pop text-center font-display text-3xl text-amber-300">🏆 Classifica dopo {q.qNo} domande</h2>
        <ol className="flex flex-col gap-2">
          {rank.map((id, i) => {
            const p = P(id);
            const before = q.prevRank.indexOf(id);
            const move = before < 0 ? 0 : before - i;
            return (
              <li
                key={id}
                style={{ animationDelay: `${0.15 + i * 0.1}s` }}
                className={`feed-in flex items-center gap-2 rounded-2xl p-2 ${i === 0 ? 'bg-amber-400/25 ring-2 ring-amber-300/70' : 'bg-slate-800'} ${id === me ? 'outline-2 outline-white/60' : ''}`}
              >
                <span className="w-8 text-center font-display text-xl text-white">{['🥇', '🥈', '🥉'][i] ?? i + 1}</span>
                {p && <Avatar avatar={p.avatar} color={p.color} size={36} />}
                <span className="min-w-0 flex-1 truncate font-bold text-white">
                  {p?.name ?? '?'}
                  {id === me ? ' (tu)' : ''}
                </span>
                {(q.streaks[id] ?? 0) >= 2 && <span className="text-xs font-black text-orange-300">🔥{q.streaks[id]}</span>}
                <span className={`w-7 text-center text-sm font-black ${move > 0 ? 'text-emerald-400' : move < 0 ? 'text-rose-400' : 'text-slate-500'}`}>
                  {move > 0 ? `▲${move}` : move < 0 ? `▼${-move}` : '•'}
                </span>
                <span className="w-16 text-right font-display text-lg text-amber-300">{q.scores[id] ?? 0}</span>
              </li>
            );
          })}
        </ol>
        <p className="text-center text-sm font-bold text-slate-300">Ancora {q.qCount - q.qNo} domande… si può ribaltare tutto! 💪</p>
        <BottomBar>
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate rounded-2xl border-2 border-slate-700 bg-slate-900/95 px-4 py-3 text-sm font-bold text-slate-200">Prossima domanda in arrivo…</p>
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

  // ---------------------------------------------------------------- si legge la domanda
  if (q.stage === 'READY') {
    return (
      <div className="stagger flex flex-col gap-4 pb-28">
        {header}
        <section key={`cat-${q.qNo}`} className={`reveal-pop rounded-3xl border-4 border-white/90 bg-linear-to-br p-4 text-center shadow-[0_8px_0_rgba(22,6,72,0.5)] ${catBg}`}>
          <p className="text-6xl drop-shadow-lg">{q.catIcon}</p>
          <p className="mt-1 font-display text-2xl text-white [text-shadow:0_3px_0_rgba(0,0,0,0.3)]">{q.catName}</p>
          <p className="text-xs font-black uppercase tracking-widest text-white/90 [text-shadow:0_1px_2px_rgba(0,0,0,0.4)]">
            Domanda {q.qNo} di {q.qCount} · {DIFF[q.diff]}
          </p>
        </section>
        {questionCard(true)}
        <p className="pulse-soft text-center font-display text-xl text-amber-300">Preparati… 👀</p>
        <TimeBar endsAt={q.stageEndsAt} total={STAGE_SECONDS.READY * 1000} clockOffset={clockOffset} color="bg-amber-300" />
      </div>
    );
  }

  // ---------------------------------------------------------------- domanda e rivelazione
  const answers = q.answers ?? [];
  const pickers = (i: number) => Object.entries(q.picks ?? {}).filter(([, v]) => v === i).map(([id]) => id);
  const fastest = q.fastest && P(q.fastest.id);

  return (
    <div className="stagger flex flex-col gap-3 pb-32">
      {header}
      {catPill}
      {questionCard(false)}
      {q.stage === 'QUESTION' && <TimeBar endsAt={q.stageEndsAt} total={q.answerMs} clockOffset={clockOffset} color="bg-linear-to-r from-emerald-400 via-amber-300 to-rose-500" />}

      {/* esito personale */}
      {reveal && playing && (
        <section
          key={`res-${q.qNo}`}
          className={`reveal-pop relative flex items-center justify-between gap-2 rounded-2xl border-4 border-white/90 px-4 py-2 shadow-[0_6px_0_rgba(22,6,72,0.5)] ${
            right ? 'bg-linear-to-r from-emerald-400 to-teal-600' : q.myPick !== null ? 'bg-linear-to-r from-rose-500 to-red-700' : 'bg-linear-to-r from-slate-500 to-slate-700'
          }`}
        >
          <span className="font-display text-2xl text-white">{right ? 'GIUSTO! ✅' : q.myPick !== null ? 'SBAGLIATO 😬' : 'Tempo scaduto ⏰'}</span>
          {right && (
            <span className="text-right">
              <span className="block font-display text-2xl text-white">+{myGain}</span>
              {q.streakBonus[me] ? <span className="block text-[11px] font-black text-white/90">🔥 serie +{q.streakBonus[me]}</span> : null}
            </span>
          )}
          {right && <PointsPop points={myGain} className="absolute -top-3 right-6" />}
        </section>
      )}

      {/* le risposte */}
      <div className="flex flex-col gap-2.5">
        {answers.map((text, i) => {
          const isRight = reveal && q.correct === i;
          const mine = q.myPick === i;
          const dim = (reveal && !isRight) || (q.stage === 'QUESTION' && q.myPick !== null && !mine);
          const who = reveal ? pickers(i) : [];
          return (
            <button
              key={`${q.qNo}-${i}`}
              type="button"
              disabled={q.stage !== 'QUESTION' || q.myPick !== null || !playing}
              onClick={() => answer(i)}
              style={{ animationDelay: `${0.05 + i * 0.07}s` }}
              className={`pop relative flex min-h-[64px] w-full items-center gap-3 rounded-2xl border-4 px-3 py-2 text-left transition-[opacity,transform] duration-300 active:translate-y-1 disabled:active:translate-y-0 ${
                ANS[i].bg
              } ${ANS[i].shadow} ${isRight ? 'scale-[1.03] border-white ring-4 ring-emerald-300' : mine ? 'border-white' : 'border-white/20'} ${dim ? 'opacity-40' : ''}`}
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-black/20 text-xl text-white">{ANS[i].shape}</span>
              <span className="min-w-0 flex-1 text-lg font-black leading-tight text-white [text-shadow:0_2px_0_rgba(0,0,0,0.2)]">{text}</span>
              {q.stage === 'QUESTION' && mine && <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-black text-slate-950">BLOCCATA 🔒</span>}
              {reveal && (
                <span className="flex shrink-0 items-center gap-1">
                  <span className="flex -space-x-2">
                    {who.slice(0, 5).map((id, k) => {
                      const p = P(id);
                      return p ? (
                        <span key={id} className="reveal-pop" style={{ animationDelay: `${0.25 + k * 0.08}s` }}>
                          <Avatar avatar={p.avatar} color={p.color} size={26} />
                        </span>
                      ) : null;
                    })}
                  </span>
                  {who.length > 0 && <span className="rounded-full bg-black/25 px-1.5 text-xs font-black text-white">{who.length}</span>}
                  {isRight && <span className="reveal-pop text-2xl">✅</span>}
                  {!isRight && mine && <span className="text-2xl">❌</span>}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* il più veloce */}
      {reveal && (
        <p className="reveal-pop flex items-center justify-center gap-2 rounded-2xl bg-slate-900/90 px-3 py-2 text-center text-sm font-bold text-slate-200" style={{ animationDelay: '0.5s' }}>
          {fastest && q.fastest ? (
            <>
              ⚡ Il più veloce:
              <Avatar avatar={fastest.avatar} color={fastest.color} size={24} />
              <span className="font-black text-white">{fastest.id === me ? 'TU!' : fastest.name}</span>
              <span className="text-amber-300">{secs(q.fastest.ms)}</span>
            </>
          ) : (
            'Nessuno ha indovinato… 🙈'
          )}
        </p>
      )}

      {q.stage === 'QUESTION' && !playing && <p className="text-center text-sm font-bold text-slate-300">Stai guardando: giocherai dalla prossima partita 👀</p>}

      <BottomBar>
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border-2 border-slate-700 bg-slate-900/95 px-3 py-2">
            {q.stage === 'QUESTION' ? (
              <>
                <span className="shrink-0 text-sm font-bold text-slate-200">
                  {q.myPick !== null && q.myMs !== null ? `Risposto in ${secs(q.myMs)}` : 'Risposte'} · {q.answered.length}/{online}
                </span>
                <span className="flex min-w-0 -space-x-1.5 overflow-hidden">
                  {q.answered.map((id) => {
                    const p = P(id);
                    return p ? (
                      <span key={id} className="pop">
                        <Avatar avatar={p.avatar} color={p.color} size={24} />
                      </span>
                    ) : null;
                  })}
                </span>
              </>
            ) : (
              <span className="truncate text-sm font-bold text-slate-200">{q.qNo >= q.qCount ? 'Ultima domanda! Ecco il podio…' : 'Prossima domanda tra poco…'}</span>
            )}
          </div>
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
