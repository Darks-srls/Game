import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { Check, FastForward, Scissors, Send } from 'lucide-react';
import type { GreggeView as GreggeData } from '../../data/flat/gregge';
import { useCountdown } from '../../hooks/useCountdown';
import { haptic, soundManager } from '../../utils/audio';
import { GameChip, Podium, PointsPop, TimerRing } from '../fx';
import { Avatar, BottomBar, EndBar, Ranking, type ModeProps } from '../ui';

const STAGE_SECONDS: Record<GreggeData['stage'], number> = { WRITE: 40, MERGE: 15, REVEAL: 0, END: 0 };

// 🐑 Il gregge: pensa come la maggioranza e non restare la pecora nera
export default function GreggeView({ state, clockOffset, canLead, onAction, onNewGame, onBackToLobby, onForce }: ModeProps) {
  const q = state.mg as GreggeData;
  const me = state.myId;
  const P = (id: string | null) => state.players.find((p) => p.id === id);
  const left = useCountdown(q.stage === 'WRITE' || q.stage === 'MERGE' ? q.stageEndsAt : null, clockOffset);
  const playing = q.order.includes(me);
  const [text, setText] = useState('');
  const [sel, setSel] = useState<string | null>(null);

  useEffect(() => setText(''), [q.round]);
  // durante la rivelazione la classifica resta com'era finché i gruppi non sono comparsi (niente spoiler)
  const sheepBefore = useRef(q.sheep);
  useEffect(() => {
    if (q.stage === 'WRITE' || q.stage === 'MERGE') sheepBefore.current = q.sheep;
  }, [q.stage, q.sheep]);
  const [settledRound, setSettledRound] = useState(-1);
  const settled = q.stage !== 'REVEAL' || settledRound === q.round;
  const revealDelay = 1 + q.groups.length * 0.45; // secondi: quando compare la pecora nera
  useEffect(() => {
    if (q.stage !== 'REVEAL') return;
    const t = setTimeout(() => {
      setSettledRound(q.round);
      if (q.sheepTo) soundManager.playError();
      else if (q.herd) soundManager.playSuccess();
    }, revealDelay * 1000 + 400);
    return () => clearTimeout(t);
  }, [q.stage, q.round]);
  const shownSheep = settled ? q.sheep : sheepBefore.current;
  // il gruppo scelto potrebbe essere stato unito da un altro
  useEffect(() => {
    if (sel && !q.groups.some((g) => g.id === sel)) setSel(null);
  }, [q.groups.map((g) => g.id).join(','), sel]);
  // suoni uguali per tutti
  useEffect(() => {
    if (q.stage === 'WRITE') soundManager.playWhoosh();
    if (q.stage === 'MERGE') soundManager.playPop();
    if (q.stage === 'REVEAL') {
      soundManager.playDrumroll(1.2);
      const t = setTimeout(() => soundManager.playReveal(), 1300);
      return () => clearTimeout(t);
    }
    if (q.stage === 'END') {
      soundManager.playVictory();
      if (q.winners.length) confetti({ particleCount: 150, spread: 90, origin: { y: 0.35 } });
    }
  }, [q.stage, q.round]);

  // classifica sempre in vista: punti e pecora nera
  const scoreboard = (
    <div className="flex flex-wrap justify-center gap-x-2 gap-y-3 rounded-3xl border-2 border-white/10 bg-slate-900 px-2 pb-2 pt-3">
      {q.order.map((id) => {
        const p = P(id);
        if (!p) return null;
        const pts = (q.scores[id] ?? 0) - (settled ? 0 : (q.gained[id] ?? 0));
        return (
          <div key={id} className={`relative flex w-14 flex-col items-center ${p.isOnline ? '' : 'opacity-40'}`}>
            <span className={`rounded-full ${id === me ? 'ring-2 ring-amber-300 ring-offset-2 ring-offset-slate-900' : ''}`}>
              <Avatar avatar={p.avatar} color={p.color} size={36} />
            </span>
            {shownSheep === id && (
              <span className="reveal-pop absolute -right-1 -top-2 grid h-6 w-6 place-items-center rounded-full bg-slate-950 text-sm ring-2 ring-white">
                🐑
              </span>
            )}
            <span className="mt-0.5 max-w-full truncate text-[10px] font-bold text-slate-300">{p.name}</span>
            <span key={pts} className="pop font-display text-lg leading-none text-amber-300">
              {pts}
            </span>
            <span className="mt-0.5 h-1 w-10 overflow-hidden rounded-full bg-slate-700">
              <span className="block h-full rounded-full bg-amber-400 transition-[width] duration-700" style={{ width: `${Math.min(100, (pts / q.meta) * 100)}%` }} />
            </span>
            {settled && (q.gained[id] ?? 0) > 0 && <PointsPop points={q.gained[id]} className="absolute -top-4" />}
          </div>
        );
      })}
    </div>
  );

  // ---------------------------------------------------------------- fine partita
  if (q.stage === 'END') {
    const ranking = Object.entries(q.scores).sort((a, b) => Number(q.winners.includes(b[0])) - Number(q.winners.includes(a[0])) || b[1] - a[1]);
    const names = q.winners.map((id) => P(id)?.name ?? '?');
    const sheep = P(q.sheep);
    return (
      <div className="stagger flex flex-col gap-4 pb-28">
        <h2 className="text-center text-3xl text-white">
          {names.length === 0 ? 'Nessun vincitore 🤷' : names.length === 1 ? `Vince ${names[0]}! 🏆` : `Vincono ${names.join(' e ')}! 🏆`}
        </h2>
        <p className="-mt-2 text-center text-sm font-bold text-slate-300">
          {q.endReason === 'meta' ? `Arrivato a ${q.meta} punti senza la pecora nera` : q.endReason === 'limite' ? 'Troppe domande: vince chi era davanti' : 'Partita ferma: nessuno rispondeva più'}
        </p>
        <Podium
          state={state}
          entries={ranking.map(([id, pts]) => ({ id, value: `${pts} ${pts === 1 ? 'punto' : 'punti'}${q.sheep === id ? ' 🐑' : ''}` }))}
        />
        {sheep && (
          <section className="pop flex items-center gap-3 rounded-3xl border-2 border-white/10 bg-slate-950 p-3">
            <span className="text-4xl">🐑</span>
            <Avatar avatar={sheep.avatar} color={sheep.color} size={40} />
            <p className="min-w-0 flex-1 font-bold text-slate-200">
              La pecora nera è rimasta a <b className="text-white">{sheep.name}</b>
            </p>
          </section>
        )}
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
    onAction('MG_ANSWER', { text: t });
    haptic(20);
  };
  const tapGroup = (id: string) => {
    if (!playing || q.done.includes(me)) return;
    if (!sel) setSel(id);
    else if (sel === id) setSel(null);
    else {
      onAction('MG_MERGE', { a: sel, b: id });
      setSel(null);
      haptic(30);
    }
  };
  const selLabel = q.groups.find((g) => g.id === sel)?.label;
  const iDone = q.done.includes(me);
  const sheepTo = P(q.sheepTo);
  const sheepFrom = P(q.sheepFrom);
  const players = q.players.filter((id) => q.order.includes(id));

  return (
    <div className="stagger flex flex-col gap-4 pb-32">
      <div className="flex items-center justify-between gap-2">
        <GameChip>🐑 Domanda {q.round}</GameChip>
        <span className="rounded-full bg-emerald-500 px-3 py-1 text-sm font-black text-white shadow-[0_4px_0_rgba(22,6,72,0.4)]">🏁 {q.meta} punti</span>
        {q.stage === 'WRITE' || q.stage === 'MERGE' ? <TimerRing left={left} total={STAGE_SECONDS[q.stage]} /> : <span className="h-14 w-14" />}
      </div>

      {scoreboard}

      <section key={q.round} className="pop rounded-3xl border-4 border-white/90 bg-linear-to-br from-lime-300 to-emerald-600 p-5 text-center shadow-[0_8px_0_rgba(22,6,72,0.5)]">
        <p className="text-xs font-black uppercase tracking-widest text-slate-950/70">Scrivi quello che scriverebbero tutti</p>
        <p className="font-display text-[34px] leading-tight text-white [text-shadow:0_4px_0_rgba(0,0,0,0.25)]">{q.question}</p>
      </section>

      {/* ------------------------------------------------ scrittura */}
      {q.stage === 'WRITE' && playing && (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex gap-2"
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 40))}
              placeholder={q.myAnswer ? `Inviata: ${q.myAnswer}` : 'La tua risposta…'}
              autoComplete="off"
              enterKeyHint="send"
              className="h-14 min-w-0 flex-1 rounded-2xl border-2 border-slate-700 bg-slate-950 px-4 text-xl font-bold text-white outline-none placeholder:text-slate-500 focus:border-amber-400"
            />
            <button type="submit" aria-label="Invia" className="grid h-14 w-16 place-items-center rounded-2xl bg-emerald-500 text-white">
              <Send size={22} />
            </button>
          </form>
          {q.myAnswer ? (
            <p className="pop text-center text-sm font-bold text-emerald-300">✓ Inviata: “{q.myAnswer}” (puoi ancora cambiarla)</p>
          ) : (
            <p className="text-center text-xs font-semibold text-slate-400">Il gruppo più numeroso prende un punto. Chi resta da solo… prende la pecora nera 🐑</p>
          )}
        </>
      )}
      {q.stage === 'WRITE' && (
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <span className="mr-1 text-sm font-bold text-slate-300">Hanno scritto:</span>
          {players.map((id) => {
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
      )}

      {/* ------------------------------------------------ unire i gruppi uguali */}
      {q.stage === 'MERGE' && (
        <>
          <p className="text-center font-bold text-slate-200">
            {!playing
              ? 'Stanno unendo le risposte uguali…'
              : iDone
                ? 'Fatto! Aspettiamo gli altri…'
                : sel
                  ? `Ora tocca il gruppo da unire a «${selLabel?.toUpperCase()}»`
                  : 'Sono la stessa cosa? Tocca DUE gruppi per unirli 🤝'}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {q.groups.map((g, k) => (
              <div
                key={g.id}
                role="button"
                onClick={() => tapGroup(g.id)}
                style={{ animationDelay: `${k * 0.04}s` }}
                className={`pop relative flex min-h-[84px] cursor-pointer flex-col items-center justify-center gap-0.5 rounded-2xl border-4 p-2 text-center transition-transform active:scale-95 ${
                  sel === g.id ? 'scale-105 border-amber-300 bg-amber-100' : g.mine ? 'border-emerald-400 bg-white' : 'border-white/80 bg-white'
                }`}
              >
                {g.mine && <span className="absolute left-1.5 top-1 text-[10px] font-black uppercase text-emerald-600">la tua</span>}
                <span className="font-display text-xl uppercase leading-tight text-slate-950 [overflow-wrap:anywhere]">{g.label}</span>
                {g.variants.length > 1 && <span className="text-[11px] font-bold leading-tight text-slate-500">{g.variants.slice(1).join(' · ')}</span>}
                {g.atoms > 1 && playing && !iDone && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAction('MG_SPLIT', { g: g.id });
                    }}
                    className="mt-1 flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-black text-slate-700"
                  >
                    <Scissors size={11} /> separa
                  </button>
                )}
              </div>
            ))}
          </div>
          {q.feed.length > 0 && (
            <div className="flex flex-col gap-1">
              {q.feed.slice(-3).map((f, i) => {
                const p = P(f.by);
                return (
                  <p key={`${q.feed.length}-${i}`} className="feed-in flex items-center gap-2 text-xs font-bold text-slate-300">
                    {p && <Avatar avatar={p.avatar} color={p.color} size={20} />}
                    <span className="min-w-0 flex-1 truncate">
                      {p?.name} {f.text}
                    </span>
                  </p>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ------------------------------------------------ rivelazione */}
      {q.stage === 'REVEAL' && (
        <>
          <div className="flex flex-col gap-2">
            {q.groups.map((g, k) => {
              const herd = q.herd === g.id;
              const n = g.members?.length ?? 0;
              const delay = 0.6 + k * 0.45;
              return (
                <section
                  key={g.id}
                  style={{ animationDelay: `${delay}s` }}
                  className={`pop rounded-3xl border-4 p-3 ${
                    herd ? 'border-amber-300 bg-linear-to-br from-amber-300/30 to-orange-500/30 shadow-[0_0_24px_rgba(252,211,77,0.35)]' : n === 1 ? 'border-slate-700 bg-slate-900' : 'border-white/20 bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-2xl uppercase leading-tight text-white [overflow-wrap:anywhere]">{g.label}</span>
                      {g.variants.length > 1 && <span className="block text-[11px] font-bold text-slate-400">{g.variants.slice(1).join(' · ')}</span>}
                    </span>
                    {herd && <span className="shrink-0 rounded-full bg-amber-400 px-2 py-0.5 text-xs font-black text-slate-950">👑 GREGGE +1</span>}
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white font-display text-2xl text-slate-950">{n}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {g.members?.map((id, j) => {
                      const p = P(id);
                      return p ? (
                        <span key={id} className="podium-avatar flex items-center gap-1 rounded-full bg-slate-950/60 py-0.5 pl-0.5 pr-2" style={{ animationDelay: `${delay + 0.2 + j * 0.12}s` }}>
                          <Avatar avatar={p.avatar} color={p.color} size={24} />
                          <span className="text-xs font-bold text-white">{p.name}</span>
                        </span>
                      ) : null;
                    })}
                  </div>
                </section>
              );
            })}
            {q.blank.length > 0 && (
              <section className="pop rounded-3xl border-2 border-dashed border-slate-600 p-3" style={{ animationDelay: `${0.6 + q.groups.length * 0.45}s` }}>
                <p className="text-sm font-black text-slate-300">🙊 Non hanno risposto (conta come risposta unica)</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {q.blank.map((id) => {
                    const p = P(id);
                    return p ? <Avatar key={id} avatar={p.avatar} color={p.color} size={24} /> : null;
                  })}
                </div>
              </section>
            )}
          </div>
          {sheepTo ? (
            <section
              className="reveal-pop flex items-center gap-3 rounded-3xl border-4 border-white/90 bg-linear-to-br from-slate-700 to-slate-950 p-4 shadow-[0_8px_0_rgba(22,6,72,0.5)]"
              style={{ animationDelay: `${revealDelay}s` }}
            >
              <span className="wiggle text-5xl">🐑</span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-2xl leading-tight text-white">La pecora nera va a {sheepTo.id === me ? 'TE' : sheepTo.name}!</p>
                <p className="text-sm font-bold text-slate-300">
                  {sheepFrom ? `L’ha tolta a ${sheepFrom.name}. ` : ''}
                  {sheepTo.id === me ? 'Finché ce l’hai non puoi vincere!' : 'Finché ce l’ha non può vincere.'}
                </p>
              </div>
            </section>
          ) : (
            !q.herd && (
              <p className="pop text-center font-bold text-slate-300" style={{ animationDelay: `${revealDelay}s` }}>
                {q.groups.length ? 'Nessun gregge: i gruppi più grandi sono pari, niente punti 🤷' : 'Nessuno ha risposto 🦗'}
              </p>
            )
          )}
        </>
      )}

      <BottomBar>
        <div className="flex items-center gap-2">
          {q.stage === 'MERGE' && playing ? (
            <button
              type="button"
              disabled={iDone}
              onClick={() => {
                onAction('MG_DONE');
                setSel(null);
              }}
              className="h-14 flex-1 rounded-2xl bg-emerald-500 text-lg font-black text-white disabled:opacity-50"
            >
              {iDone ? `Fatto ✓ (${q.done.length}/${players.length})` : 'Va bene così ✓'}
            </button>
          ) : (
            <p className="min-w-0 flex-1 truncate rounded-2xl border-2 border-slate-700 bg-slate-900/95 px-4 py-3 text-sm font-bold text-slate-200">
              {q.stage === 'WRITE' ? `Risposte: ${q.written.length}/${players.length}` : q.stage === 'REVEAL' ? 'Prossima domanda tra poco…' : 'Stanno unendo i gruppi…'}
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
