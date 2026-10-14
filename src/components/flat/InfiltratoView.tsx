import { useEffect, useState, type ReactNode } from 'react';
import confetti from 'canvas-confetti';
import { Check, FastForward } from 'lucide-react';
import { INF_ANSWERS, type InfAnswer, type InfiltratoView as InfData } from '../../data/flat/infiltrato';
import { useCountdown } from '../../hooks/useCountdown';
import { haptic, soundManager } from '../../utils/audio';
import { GameChip, PointsPop, Podium, TimerRing } from '../fx';
import { Avatar, BottomBar, EndBar, Ranking, type ModeProps } from '../ui';

const ANSWER_KEYS: InfAnswer[] = ['SI', 'NO', 'FORSE', 'QUASI'];

// Carta del ruolo: stesso retro e stessi colori per Infiltrato e cittadini, cambia solo il testo
function RoleCard({ open, onToggle, compact, children }: { open: boolean; onToggle: () => void; compact?: boolean; children: ReactNode }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onToggle()}
      aria-label={open ? 'Nascondi la tua carta' : 'Mostra la tua carta'}
      className={`flip relative w-full cursor-pointer select-none ${compact ? 'h-40' : 'h-72'} ${open ? 'open' : ''}`}
    >
      <div className="flip-inner relative h-full w-full">
        <div className="flip-face overflow-hidden rounded-3xl border-4 border-white/80 bg-linear-to-br from-fuchsia-600 via-violet-800 to-slate-950 shadow-[0_8px_0_rgba(22,6,72,0.5)]">
          <div className="shine absolute inset-0" />
          <span className={`absolute left-1/2 -translate-x-1/2 drop-shadow-lg ${compact ? 'top-3 text-5xl' : 'top-8 text-8xl'}`}>🎩</span>
          <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent p-4 pt-10 text-center">
            {!compact && <span className="tap-hint mb-1 inline-block text-4xl">👆</span>}
            <p className={`font-black text-white ${compact ? 'text-xl' : 'text-3xl'}`}>Tocca per vedere</p>
            <p className="text-sm font-bold text-white/85">la tua carta segreta (copri lo schermo!)</p>
          </div>
        </div>
        <div className="flip-face flip-back overflow-hidden rounded-3xl border-4 border-white/80 bg-linear-to-br from-fuchsia-500 via-violet-700 to-slate-950 shadow-[0_8px_0_rgba(22,6,72,0.5)]">
          {children}
        </div>
      </div>
    </div>
  );
}

// 🎩 L'infiltrato
export default function InfiltratoView({ state, clockOffset, canLead, onAction, onNewGame, onBackToLobby, onForce }: ModeProps) {
  const q = state.mg as InfData;
  const me = state.myId;
  const left = useCountdown(q.stage === 'END' ? null : q.stageEndsAt, clockOffset);
  const [open, setOpen] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [picking, setPicking] = useState(false);
  const inGame = q.order.includes(me);
  const iMaestro = q.myRole === 'MAESTRO';

  const who = (id: string | null | undefined) => {
    const p = id ? state.players.find((x) => x.id === id) : undefined;
    return { name: p?.name ?? (id ? q.names[id] : undefined) ?? '?', avatar: p?.avatar ?? '👻', color: p?.color ?? '#475569', online: !!p?.isOnline };
  };
  const face = (id: string, size = 28) => {
    const p = who(id);
    return <Avatar avatar={p.avatar} color={p.color} size={size} />;
  };
  const online = q.order.filter((id) => who(id).online).length;
  const maestro = who(q.maestro);

  useEffect(() => {
    setOpen(false);
    setPicking(false);
  }, [q.stage, q.round]);
  // suoni uguali per tutti i ruoli
  useEffect(() => {
    if (q.stage === 'ROLE') soundManager.playReveal();
    if (q.stage === 'ASK') soundManager.playWhoosh();
    if (q.stage === 'VOTE') {
      soundManager.playSuccess();
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.4 } });
    }
    if (q.stage === 'REVEAL') soundManager.playDrumroll(1.3);
    if (q.stage === 'END') {
      soundManager.playVictory();
      confetti({ particleCount: 160, spread: 95, origin: { y: 0.35 } });
    }
  }, [q.stage, q.round]);
  // ogni risposta del Maestro fa lo stesso suono su tutti i telefoni
  useEffect(() => {
    if (q.stage === 'ASK' && q.answerNo > 0) soundManager.playPop();
  }, [q.answerNo]);
  useEffect(() => {
    setRevealed(false);
    if (q.stage !== 'REVEAL') return;
    const t = setTimeout(() => {
      setRevealed(true);
      soundManager.playReveal();
    }, 1400);
    return () => clearTimeout(t);
  }, [q.stage, q.round]);

  const leadButton = canLead && (
    <button type="button" onClick={onForce} className="flex h-14 shrink-0 items-center gap-1 rounded-2xl bg-slate-800 px-3 text-sm font-black text-amber-200">
      <FastForward size={16} /> Avanti
    </button>
  );
  const status = (text: string) => <p className="min-w-0 flex-1 truncate rounded-2xl border-2 border-slate-700 bg-slate-900/95 px-4 py-3 text-sm font-bold text-slate-200">{text}</p>;

  const header = (
    <div className="flex items-center justify-between gap-2">
      <GameChip>
        🎩 Round {q.round}/{q.rounds}
      </GameChip>
      <span className="flex min-w-0 items-center gap-1.5 rounded-full bg-slate-900/90 py-0.5 pl-0.5 pr-3 text-xs font-black text-amber-200">
        {face(q.maestro, 24)}
        <span className="truncate">👑 {q.maestro === me ? 'Tu' : maestro.name}</span>
      </span>
      <TimerRing left={left} total={Math.round(q.stageMs / 1000)} />
    </div>
  );

  // retro della carta: Infiltrato e cittadini hanno la stessa carta, cambia solo il testo
  const cardBack = (compact: boolean) => {
    if (q.myRole === 'INFILTRATO')
      return (
        <div className={`flex h-full flex-col items-center justify-center text-center ${compact ? 'gap-0.5 p-3' : 'gap-1 p-5'}`}>
          <p className="text-xs font-black uppercase tracking-widest text-amber-300">Sei l’infiltrato</p>
          <p className={`font-display uppercase leading-tight text-white [overflow-wrap:anywhere] ${compact ? 'text-3xl' : 'text-5xl'}`}>{q.word ?? '…'}</p>
          <p className="text-sm font-bold text-slate-100">
            {q.word ? (compact ? 'Guida il gruppo, senza farti beccare.' : 'Questa è la parola! Guida il gruppo a indovinarla con domande furbe… senza farti scoprire.') : 'Il Maestro sta scegliendo la parola: arriva tra un attimo.'}
          </p>
        </div>
      );
    return (
      <div className={`flex h-full flex-col items-center justify-center text-center ${compact ? 'gap-0.5 p-3' : 'gap-1 p-5'}`}>
        <p className="text-xs font-black uppercase tracking-widest text-amber-300">Sei un cittadino</p>
        <p className={`font-display uppercase leading-tight text-white ${compact ? 'text-3xl' : 'text-5xl'}`}>???</p>
        <p className="text-sm font-bold text-slate-100">
          {compact ? 'Indovina la parola e smaschera l’infiltrato.' : 'Non conosci la parola: scoprila con domande sì/no. Occhio: uno di voi la sa già!'}
        </p>
      </div>
    );
  };
  const card = (compact: boolean) =>
    inGame && !iMaestro ? (
      <RoleCard open={open} onToggle={() => setOpen((o) => !o)} compact={compact}>
        {cardBack(compact)}
      </RoleCard>
    ) : null;

  // ---------------------------------------------------------------- fine partita
  if (q.stage === 'END') {
    const ranking = Object.entries(q.scores).sort((a, b) => b[1] - a[1]);
    return (
      <div className="stagger flex flex-col gap-4">
        <h2 className="text-center text-3xl text-white">Chi ha fiutato meglio? 🎩</h2>
        <Podium state={state} entries={ranking.map(([id, points]) => ({ id, value: `${points} ${points === 1 ? 'punto' : 'punti'}` }))} />
        <section className="rounded-3xl border-2 border-white/10 bg-slate-900 p-4">
          <Ranking state={state} scores={q.scores} />
        </section>
        <section className="flex flex-col gap-1.5 rounded-3xl border-2 border-white/10 bg-slate-900 p-3">
          <p className="px-1 text-xs font-black uppercase tracking-widest text-amber-300">I round</p>
          {q.history.map((h, i) => (
            <div key={i} className="flex items-center gap-2 rounded-2xl bg-slate-800 p-2 text-sm font-bold text-white">
              <span className="text-xl">{h.outcome === 'FOUND' ? '🎯' : h.outcome === 'ESCAPED' ? '🎩' : '⏰'}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate uppercase">{h.word}</p>
                <p className="truncate text-xs text-slate-400">
                  👑 {who(h.maestro).name} · 🎩 {who(h.infiltrato).name}
                  {h.outcome === 'FOUND' ? ' (preso!)' : h.outcome === 'ESCAPED' ? ' (l’ha fatta franca)' : ' (tempo scaduto)'}
                </p>
              </div>
            </div>
          ))}
        </section>
        <p className="text-center text-xs font-bold text-slate-400">Infiltrato preso: +1 a Maestro e cittadini (+1 a chi ha detto la parola) · Infiltrato salvo: +3 a lui</p>
        <EndBar canLead={canLead} hostName={who(state.hostId).name} onNewGame={onNewGame} onBackToLobby={onBackToLobby} />
      </div>
    );
  }

  // ---------------------------------------------------------------- carte e scelta della parola
  if (q.stage === 'ROLE') {
    const iReady = q.ready.includes(me);
    return (
      <div className="stagger flex flex-col gap-4">
        {header}
        {iMaestro ? (
          <>
            <div className="text-center">
              <h2 className="text-3xl text-white">Sei il Maestro! 👑</h2>
              <p className="text-sm font-bold text-slate-200">Scegli la parola segreta. Gli altri ti faranno domande: rispondi solo sì, no o non so. L’Infiltrato la vedrà con te!</p>
            </div>
            <div className="flex flex-col gap-2">
              {(q.choices ?? []).map((w, i) => {
                const sel = q.word === w;
                return (
                  <button
                    key={w}
                    type="button"
                    onClick={() => {
                      onAction('MG_WORD', { word: w });
                      haptic(15);
                      soundManager.playClick();
                    }}
                    style={{ animationDelay: `${0.08 * i}s` }}
                    className={`pop flex h-20 items-center justify-center rounded-3xl border-4 px-4 font-display text-3xl uppercase text-white shadow-[0_6px_0_rgba(22,6,72,0.45)] ${
                      sel ? 'border-white bg-linear-to-br from-amber-300 to-orange-500' : 'border-white/20 bg-slate-900/90'
                    }`}
                  >
                    {w} {sel ? '✓' : ''}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <h2 className="text-center text-3xl text-white">La tua carta</h2>
            {card(false)}
            <p className="rounded-2xl bg-slate-900/85 p-3 text-center text-sm font-bold text-slate-200">
              {q.wordChosen ? `${maestro.name} ha scelto la parola ✓` : `${maestro.name} 👑 sta scegliendo la parola…`}
            </p>
          </>
        )}
        <section className="rounded-2xl bg-slate-900/85 p-3 text-sm font-semibold text-slate-200">
          🗣️ Tutti fanno domande a voce, il Maestro risponde. Indovinate entro il tempo… poi scovate chi la sapeva già!
        </section>
        <BottomBar>
          <div className="flex items-center gap-2">
            {inGame ? (
              <button
                type="button"
                disabled={iMaestro && !q.wordChosen}
                onClick={() => {
                  onAction('MG_READY');
                  haptic(15);
                }}
                className={`h-14 flex-1 rounded-2xl text-lg font-black disabled:opacity-50 ${iReady ? 'border-2 border-emerald-400 bg-slate-900 text-emerald-300' : 'bg-emerald-500 text-white'}`}
              >
                {iReady ? `Pronto ✓ (${q.ready.length}/${q.order.length})` : iMaestro && !q.wordChosen ? 'Prima scegli la parola' : `Pronto! (${q.ready.length}/${q.order.length})`}
              </button>
            ) : (
              status(`Pronti: ${q.ready.length}/${q.order.length}`)
            )}
            {leadButton}
          </div>
        </BottomBar>
      </div>
    );
  }

  // ultima risposta del Maestro, grande per tutti
  const last = q.answers[q.answers.length - 1];
  const answerPanel = (
    <section className="flex flex-col gap-2">
      {last ? (
        <div
          key={q.answerNo}
          className={`reveal-pop flex h-28 items-center justify-center gap-3 rounded-3xl border-4 border-white/90 bg-linear-to-br shadow-[0_8px_0_rgba(22,6,72,0.5)] ${INF_ANSWERS[last].bg}`}
        >
          <span className="text-5xl">{INF_ANSWERS[last].emoji}</span>
          <span className="font-display text-4xl text-white [text-shadow:0_3px_0_rgba(0,0,0,0.2)]">{INF_ANSWERS[last].label}</span>
        </div>
      ) : (
        <div className="grid h-28 place-items-center rounded-3xl border-4 border-dashed border-white/25 bg-slate-900/70 text-center text-lg font-black text-slate-300">
          Fate la prima domanda! 🙋
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 gap-1 overflow-hidden">
          {q.answers
            .slice(0, -1)
            .slice(-8)
            .map((a, i) => (
              <span key={`${q.answerNo}-${i}`} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-800 text-base">
                {INF_ANSWERS[a].emoji}
              </span>
            ))}
        </div>
        <span className="shrink-0 text-xs font-black text-slate-300">
          👍 {q.counts.SI} · 👎 {q.counts.NO} · 🤷 {q.counts.FORSE} · 🔥 {q.counts.QUASI}
        </span>
      </div>
    </section>
  );

  // ---------------------------------------------------------------- domande
  if (q.stage === 'ASK') {
    return (
      <div className="stagger flex flex-col gap-4">
        {header}
        {iMaestro ? (
          <>
            <section className="pop rounded-3xl border-4 border-white/90 bg-linear-to-br from-amber-300 to-orange-500 p-4 text-center shadow-[0_8px_0_rgba(22,6,72,0.5)]">
              <p className="text-xs font-black uppercase tracking-widest text-slate-950/70">La parola segreta · 🤫 tieni il telefono coperto</p>
              <p className="mt-1 font-display text-5xl uppercase leading-tight text-white [overflow-wrap:anywhere] [text-shadow:0_4px_0_rgba(0,0,0,0.25)]">{q.word}</p>
            </section>
            {picking ? (
              <section className="pop flex flex-col gap-2 rounded-3xl border-2 border-amber-300/60 bg-slate-900/95 p-3">
                <p className="text-center text-lg font-black text-white">Chi ha detto la parola giusta?</p>
                <div className="grid grid-cols-3 gap-2">
                  {q.order
                    .filter((id) => id !== me)
                    .map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          onAction('MG_GUESSED', { by: id });
                          haptic(30);
                        }}
                        className="flex flex-col items-center gap-1 rounded-2xl border-2 border-white/15 bg-slate-800 p-2"
                      >
                        {face(id, 40)}
                        <span className="w-full truncate text-center text-xs font-black text-white">{who(id).name}</span>
                      </button>
                    ))}
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => onAction('MG_GUESSED', { by: null })} className="h-12 flex-1 rounded-2xl bg-slate-700 font-black text-white">
                    Non ricordo
                  </button>
                  <button type="button" onClick={() => setPicking(false)} className="h-12 flex-1 rounded-2xl bg-slate-800 font-black text-slate-300">
                    Annulla
                  </button>
                </div>
              </section>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {ANSWER_KEYS.map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => {
                        onAction('MG_ANSWER', { a });
                        haptic(15);
                      }}
                      className={`flex h-20 items-center justify-center gap-2 rounded-3xl border-4 border-white/80 bg-linear-to-br text-white shadow-[0_6px_0_rgba(22,6,72,0.45)] active:scale-95 ${INF_ANSWERS[a].bg}`}
                    >
                      <span className="text-3xl">{INF_ANSWERS[a].emoji}</span>
                      <span className={`font-display ${a === 'QUASI' ? 'text-lg' : 'text-2xl'}`}>{INF_ANSWERS[a].label}</span>
                    </button>
                  ))}
                </div>
                <p className="text-center text-xs font-bold text-slate-300">Rispondi a voce o coi pulsanti: la risposta appare sui telefoni di tutti.</p>
                {answerPanel}
              </>
            )}
          </>
        ) : (
          <>
            <div className="text-center">
              <h2 className="text-3xl text-white">Fate domande a {maestro.name}!</h2>
              <p className="text-sm font-bold text-slate-200">Solo domande da sì o no: “È un animale?”, “Sta in casa?”, “È più grande di un frigo?”</p>
            </div>
            {answerPanel}
            {card(true)}
          </>
        )}
        <BottomBar>
          <div className="flex items-center gap-2">
            {iMaestro && !picking ? (
              <button
                type="button"
                onClick={() => {
                  setPicking(true);
                  haptic(20);
                }}
                className="shine h-14 flex-1 rounded-2xl bg-amber-400 text-lg font-black text-slate-950"
              >
                🎉 HANNO INDOVINATO!
              </button>
            ) : (
              status(iMaestro ? 'Tocca chi l’ha detta…' : 'Se scade il tempo, perdete tutti! ⏰')
            )}
            {leadButton}
          </div>
        </BottomBar>
      </div>
    );
  }

  // ---------------------------------------------------------------- voto: chi è l'infiltrato?
  if (q.stage === 'VOTE') {
    const options = q.order.filter((id) => id !== q.maestro);
    return (
      <div className="stagger flex flex-col gap-4">
        {header}
        <section className="reveal-pop rounded-3xl border-4 border-white/90 bg-linear-to-br from-emerald-400 to-teal-600 p-4 text-center shadow-[0_8px_0_rgba(22,6,72,0.5)]">
          <p className="text-xs font-black uppercase tracking-widest text-white/80">Parola indovinata! 🎉</p>
          <p className="font-display text-4xl uppercase leading-tight text-white [overflow-wrap:anywhere]">{q.word}</p>
          {q.guessedBy && <p className="text-sm font-bold text-white/90">L’ha detta {q.guessedBy === me ? 'tu' : who(q.guessedBy).name}</p>}
        </section>
        <div className="text-center">
          <h2 className="text-3xl text-white">Chi è l’infiltrato?</h2>
          <p className="text-sm font-bold text-slate-200">Chi vi ha guidato un po’ troppo bene? Discutete e votate in segreto. Pareggio: decide il voto del Maestro.</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {options.map((id, i) => {
            const mine = q.myVote === id;
            const can = inGame && id !== me;
            return (
              <button
                key={id}
                type="button"
                disabled={!can}
                onClick={() => {
                  onAction('MG_VOTE', { id });
                  haptic(15);
                  soundManager.playClick();
                }}
                style={{ animationDelay: `${0.04 * i}s` }}
                className={`pop relative flex flex-col items-center gap-1 rounded-2xl border-4 p-2 ${mine ? 'border-rose-400 bg-rose-500/25' : 'border-white/10 bg-slate-900/85'} ${can ? '' : 'opacity-40'}`}
              >
                {face(id, 44)}
                <span className="w-full truncate text-center text-xs font-black text-white">{id === me ? 'Tu' : who(id).name}</span>
                {mine && <span className="absolute right-1 top-0.5 text-lg">🎯</span>}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <span className="mr-1 text-sm font-bold text-slate-300">Hanno votato:</span>
          {q.order.map((id) => (
            <span key={id} className={`relative ${q.voted.includes(id) ? '' : 'opacity-35'}`}>
              {face(id, 30)}
              {q.voted.includes(id) && (
                <span className="absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full bg-emerald-500 text-white">
                  <Check size={11} strokeWidth={4} />
                </span>
              )}
            </span>
          ))}
        </div>
        {card(true)}
        <BottomBar>
          <div className="flex items-center gap-2">
            {status(`Voti: ${q.voted.length}/${online}${inGame ? (q.myVote ? ` · tu: ${who(q.myVote).name}` : ' · tocca a te!') : ''}`)}
            {leadButton}
          </div>
        </BottomBar>
      </div>
    );
  }

  // ---------------------------------------------------------------- rivelazione
  const inf = q.infiltrato;
  const votes = q.votes ?? {};
  const outcomeText =
    q.outcome === 'TIMEOUT'
      ? { title: 'Tempo scaduto! ⏰', sub: 'Nessuno ha indovinato: perdete tutti, infiltrato compreso.', bg: 'from-slate-500 to-slate-800' }
      : q.outcome === 'FOUND'
        ? { title: 'Preso! 🎯', sub: 'Vincono il Maestro e i cittadini: +1 a testa.', bg: 'from-emerald-400 to-teal-600' }
        : {
            title: 'L’ha fatta franca! 🎩',
            sub: q.accused ? `Avete accusato ${who(q.accused).name}… sbagliato! +3 all’infiltrato.` : 'Pareggio senza colpevole: +3 all’infiltrato.',
            bg: 'from-fuchsia-500 to-violet-800',
          };
  return (
    <div className="stagger flex flex-col gap-4">
      {header}
      <h2 className="text-center text-3xl text-white">L’infiltrato era…</h2>
      {!revealed ? (
        <div className="grid h-56 place-items-center rounded-3xl border-4 border-white/30 bg-slate-950/70">
          <span className="drum text-7xl">🥁</span>
        </div>
      ) : (
        <section className={`reveal-pop rounded-3xl border-4 border-white/90 bg-linear-to-br p-5 text-center shadow-[0_8px_0_rgba(22,6,72,0.5)] ${outcomeText.bg}`}>
          {inf && <div className="mb-1 flex justify-center">{face(inf, 72)}</div>}
          <p className="font-display text-4xl text-white [text-shadow:0_3px_0_rgba(0,0,0,0.2)]">{inf ? (inf === me ? 'Tu!' : who(inf).name) : '?'}</p>
          <p className="mt-2 font-display text-2xl text-white">{outcomeText.title}</p>
          <p className="text-sm font-bold text-white/90">{outcomeText.sub}</p>
          <p className="mt-2 text-xs font-black uppercase tracking-widest text-white/80">La parola era</p>
          <p className="font-display text-3xl uppercase text-white">{q.word}</p>
        </section>
      )}
      {revealed && Object.keys(votes).length > 0 && (
        <section className="flex flex-wrap justify-center gap-1.5 rounded-3xl bg-slate-900/85 p-3">
          {Object.entries(votes).map(([v, t]) => (
            <span key={v} className={`flex items-center gap-1 rounded-full py-0.5 pl-0.5 pr-2 text-xs font-bold ${t === inf ? 'bg-emerald-500/25 text-emerald-100' : 'bg-slate-800 text-slate-200'}`}>
              {face(v, 20)} → {who(t).name}
            </span>
          ))}
        </section>
      )}
      {revealed && Object.keys(q.gained).length > 0 && (
        <section className="flex flex-wrap justify-center gap-3">
          {Object.entries(q.gained).map(([id, p]) => (
            <span key={id} className="relative flex flex-col items-center">
              {face(id, 40)}
              <PointsPop points={p} className="absolute -top-6" />
              <span className="text-xs font-black text-amber-300">+{p}</span>
            </span>
          ))}
        </section>
      )}
      <BottomBar>
        <div className="flex items-center gap-2">
          {status(q.round >= q.rounds ? 'Ultimo round: arriva la classifica!' : `Prossimo round tra poco (${q.round + 1}/${q.rounds})`)}
          {leadButton}
        </div>
      </BottomBar>
    </div>
  );
}
