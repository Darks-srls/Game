import { useEffect, useState, type ReactNode } from 'react';
import confetti from 'canvas-confetti';
import { Check, ChevronDown, FastForward } from 'lucide-react';
import { MI_ROLES, type MissioneProposal, type MissioneView as MiData } from '../../data/flat/missione';
import { useCountdown } from '../../hooks/useCountdown';
import { haptic, soundManager } from '../../utils/audio';
import { GameChip, Podium, TimerRing } from '../fx';
import { Avatar, BottomBar, EndBar, Ranking, type ModeProps } from '../ui';

const END_TEXT: Record<string, string> = {
  TRE_OK: 'Tre missioni riuscite: il piano è salvo!',
  TRE_KO: 'Tre missioni sabotate: l’agenzia è in rovina.',
  BOCCIATE: 'Cinque squadre bocciate di fila: l’agenzia è nel caos.',
  VEGGENTE_PRESO: 'Il Sicario ha scovato il Veggente: colpo di scena!',
  VEGGENTE_SALVO: 'Il Sicario ha mancato il Veggente: missione compiuta!',
};

// ordine dei due pulsanti della missione diverso per ognuno (dal dito non si capisce cosa hai toccato)
const swapped = (seed: string) => {
  let h = 7;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  return (h & 4) === 4;
};

// Carta del ruolo: stesso retro e stessi colori per agenti e spie
function RoleCard({ open, onToggle, compact, children }: { open: boolean; onToggle: () => void; compact?: boolean; children: ReactNode }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onToggle()}
      aria-label={open ? 'Nascondi il tuo ruolo' : 'Mostra il tuo ruolo'}
      className={`flip relative w-full cursor-pointer select-none ${compact ? 'h-44' : 'h-80'} ${open ? 'open' : ''}`}
    >
      <div className="flip-inner relative h-full w-full">
        <div className="flip-face overflow-hidden rounded-3xl border-4 border-white/80 bg-linear-to-br from-slate-700 via-slate-900 to-black shadow-[0_8px_0_rgba(22,6,72,0.5)]">
          <div className="shine absolute inset-0" />
          <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.04)_0_12px,transparent_12px_24px)]" />
          <span className={`absolute left-1/2 -translate-x-1/2 rounded-xl bg-red-600 px-3 py-1 font-display tracking-widest text-white shadow-lg ${compact ? 'top-5 -rotate-6 text-lg' : 'top-12 -rotate-6 text-3xl'}`}>
            TOP SECRET
          </span>
          <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent p-4 pt-10 text-center">
            {!compact && <span className="tap-hint mb-1 inline-block text-4xl">👆</span>}
            <p className={`font-black text-white ${compact ? 'text-xl' : 'text-3xl'}`}>Tocca per vedere</p>
            <p className="text-sm font-bold text-white/85">il tuo ruolo segreto (copri lo schermo!)</p>
          </div>
        </div>
        <div className="flip-face flip-back overflow-hidden rounded-3xl border-4 border-white/80 bg-linear-to-br from-slate-600 via-slate-800 to-slate-950 shadow-[0_8px_0_rgba(22,6,72,0.5)]">
          {children}
        </div>
      </div>
    </div>
  );
}

// 🕶️ Missione segreta
export default function MissioneView({ state, clockOffset, canLead, onAction, onNewGame, onBackToLobby, onForce }: ModeProps) {
  const q = state.mg as MiData;
  const me = state.myId;
  const left = useCountdown(q.stage === 'END' ? null : q.stageEndsAt, clockOffset);
  const [open, setOpen] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const inGame = q.order.includes(me);
  const role = q.myRole;
  const iLead = q.leader === me;
  const need = q.sizes[q.mission];

  const who = (id: string | null | undefined) => {
    const p = id ? state.players.find((x) => x.id === id) : undefined;
    return { name: p?.name ?? (id ? q.names[id] : undefined) ?? '?', avatar: p?.avatar ?? '👻', color: p?.color ?? '#475569', online: !!p?.isOnline };
  };
  const face = (id: string, size = 28) => {
    const p = who(id);
    return <Avatar avatar={p.avatar} color={p.color} size={size} />;
  };
  const online = q.order.filter((id) => who(id).online).length;

  useEffect(() => setOpen(false), [q.stage, q.mission]);
  // suoni uguali per tutti
  useEffect(() => {
    if (q.stage === 'ROLE') soundManager.playReveal();
    if (q.stage === 'TEAM' || q.stage === 'VOTE') soundManager.playPop();
    if (q.stage === 'MISSION') soundManager.playWhoosh();
    if (q.stage === 'VOTE_RESULT' || q.stage === 'MISSION_RESULT' || q.stage === 'ASSASSIN') soundManager.playDrumroll(1.3);
    if (q.stage === 'END') {
      soundManager.playVictory();
      confetti({ particleCount: 160, spread: 95, origin: { y: 0.35 } });
    }
  }, [q.stage, q.mission, q.history.length]);
  useEffect(() => {
    setRevealed(false);
    if (q.stage !== 'VOTE_RESULT' && q.stage !== 'MISSION_RESULT') return;
    const t = setTimeout(() => setRevealed(true), 1400);
    return () => clearTimeout(t);
  }, [q.stage, q.mission, q.history.length]);
  // l'esito della missione: suono dopo l'ultima carta (uguale per tutti)
  useEffect(() => {
    if (!revealed || q.stage !== 'MISSION_RESULT') return;
    const t = setTimeout(() => (q.results[q.mission]?.ok ? soundManager.playSuccess() : soundManager.playBoom()), 400 + (q.cards?.length ?? 0) * 450);
    return () => clearTimeout(t);
  }, [revealed]);

  // ---------------------------------------------------------------- pezzi comuni
  const board = (
    <section className="rounded-3xl border-2 border-white/10 bg-slate-900/90 p-3">
      <div className="flex items-start justify-between gap-1">
        {q.sizes.map((n, i) => {
          const r = q.results[i];
          const current = i === q.mission && q.stage !== 'END' && !r;
          return (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <span
                className={`grid h-14 w-14 place-items-center rounded-full border-4 font-display text-2xl ${
                  r ? (r.ok ? 'border-white bg-emerald-500 text-white' : 'border-white bg-rose-600 text-white') : current ? 'pulse-soft border-amber-300 bg-slate-800 text-amber-200' : 'border-slate-600 bg-slate-800 text-slate-300'
                }`}
              >
                {r ? (r.ok ? '✅' : '💣') : n}
              </span>
              <span className="text-[10px] font-black uppercase text-slate-400">{r ? (r.fails ? `${r.fails} 💣` : 'pulita') : q.needs[i] > 1 ? '2 💣 per fallire' : `${n} agenti`}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-center gap-1.5 text-xs font-bold text-slate-300">
        <span>Bocciate di fila:</span>
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className={`h-3.5 w-3.5 rounded-full ${i < q.rejects ? 'bg-rose-500' : 'bg-slate-700'} ${i === 4 ? 'ring-2 ring-rose-400/60' : ''}`} />
        ))}
        <span className="text-slate-400">(alla 5ª vincono le spie)</span>
      </div>
    </section>
  );

  const header = (chip: ReactNode) => (
    <div className="flex items-center justify-between gap-2">
      <GameChip>{chip}</GameChip>
      <span className="rounded-full bg-slate-900/90 px-3 py-1 text-xs font-black text-slate-100">🕶️ {q.spyCount} spie su {q.order.length}</span>
      <TimerRing left={left} total={Math.round(q.stageMs / 1000)} />
    </div>
  );

  const cardBack = (compact: boolean) => {
    if (!role) return null;
    const info = MI_ROLES[role];
    const others = q.spies.filter((id) => id !== me);
    return (
      <div className={`flex h-full flex-col items-center justify-center text-center ${compact ? 'gap-0.5 p-3' : 'gap-1 p-5'}`}>
        <p className="text-xs font-black uppercase tracking-widest text-amber-300">Sei</p>
        <p className={compact ? 'text-4xl' : 'text-7xl'}>{info.emoji}</p>
        <p className={`font-display leading-tight text-white ${compact ? 'text-2xl' : 'text-4xl'}`}>{info.name}</p>
        {!compact && <p className="text-sm font-bold text-slate-100">{info.goal}</p>}
        {role !== 'AGENTE' && (
          <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5 text-sm font-bold text-white">
            <span className="text-slate-200">{role === 'VEGGENTE' ? 'Le spie:' : 'Le altre spie:'}</span>
            {others.map((id) => (
              <span key={id} className="flex items-center gap-1 rounded-full bg-black/30 py-0.5 pl-0.5 pr-2">
                {face(id, 22)} {who(id).name}
                {role !== 'VEGGENTE' && id === q.sicario ? ' 🗡️' : ''}
              </span>
            ))}
          </div>
        )}
        {role === 'AGENTE' && compact && <p className="mt-1 text-sm font-bold text-slate-200">Non sai chi sono le spie: osserva i voti!</p>}
      </div>
    );
  };
  const card = (compact: boolean) =>
    role ? (
      <RoleCard open={open} onToggle={() => setOpen((o) => !o)} compact={compact}>
        {cardBack(compact)}
      </RoleCard>
    ) : (
      <div className="rounded-3xl border-2 border-slate-700 bg-slate-900/90 p-5 text-center">
        <p className="text-4xl">🍿</p>
        <p className="mt-1 text-lg font-black text-white">Guardi questa partita</p>
        <p className="text-sm font-semibold text-slate-400">Entri dalla prossima.</p>
      </div>
    );

  const proposalRow = (p: MissioneProposal, k: number) => {
    const lead = q.order[p.leader];
    return (
      <div key={k} className="rounded-2xl bg-slate-800 p-2 text-xs font-bold text-slate-200">
        <p className="mb-1 flex items-center gap-1.5">
          <span className="font-black text-amber-200">M{p.mission + 1}</span>
          👑 {who(lead).name}
          {p.auto ? ' (a caso)' : ''}
          <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-black ${p.approved ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>{p.approved ? 'APPROVATA' : 'BOCCIATA'}</span>
        </p>
        <p className="flex flex-wrap items-center gap-1">
          <span className="text-slate-400">Squadra:</span>
          {p.team.map((i) => (
            <span key={i}>{face(q.order[i], 20)}</span>
          ))}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-1">
          <span className="text-emerald-300">✅</span>
          {p.yes.map((i) => (
            <span key={i}>{face(q.order[i], 18)}</span>
          ))}
          <span className="ml-2 text-rose-300">❌</span>
          {p.no.map((i) => (
            <span key={i}>{face(q.order[i], 18)}</span>
          ))}
        </p>
      </div>
    );
  };
  const done = q.history.filter((p, i) => q.stage === 'END' || i < q.history.length - 1 || q.stage !== 'VOTE');
  const history = done.length > 0 && (
    <section className="rounded-3xl border-2 border-white/10 bg-slate-900/90">
      <button type="button" onClick={() => setShowHistory((v) => !v)} className="flex w-full items-center justify-between p-3 text-left text-sm font-black text-white">
        🗂️ Squadre proposte finora ({done.length})
        <ChevronDown size={18} className={`transition-transform ${showHistory ? 'rotate-180' : ''}`} />
      </button>
      {showHistory && <div className="flex flex-col gap-1.5 px-3 pb-3">{done.map((p, k) => proposalRow(p, k)).reverse()}</div>}
    </section>
  );

  const leadButton = canLead && (
    <button type="button" onClick={onForce} className="flex h-14 shrink-0 items-center gap-1 rounded-2xl bg-slate-800 px-3 text-sm font-black text-amber-200">
      <FastForward size={16} /> Avanti
    </button>
  );
  const status = (text: string) => <p className="min-w-0 flex-1 truncate rounded-2xl border-2 border-slate-700 bg-slate-900/95 px-4 py-3 text-sm font-bold text-slate-200">{text}</p>;

  // ---------------------------------------------------------------- fine partita
  if (q.stage === 'END') {
    const agentsWin = q.winner === 'AGENTI';
    const ranking = Object.entries(q.scores).sort((a, b) => b[1] - a[1]);
    return (
      <div className="stagger flex flex-col gap-4">
        <section
          className={`reveal-pop rounded-3xl border-4 border-white/90 p-5 text-center shadow-[0_8px_0_rgba(22,6,72,0.5)] ${
            agentsWin ? 'bg-linear-to-br from-sky-400 to-indigo-700' : 'bg-linear-to-br from-rose-600 to-slate-950'
          }`}
        >
          <p className="text-6xl">{agentsWin ? '🕵️' : '🕶️'}</p>
          <p className="font-display text-4xl text-white [text-shadow:0_4px_0_rgba(0,0,0,0.25)]">{agentsWin ? 'Vincono gli agenti!' : 'Vincono le spie!'}</p>
          <p className="mt-1 text-sm font-bold text-white/90">{q.endReason ? END_TEXT[q.endReason] : ''}</p>
          {q.assassinPick && (
            <p className="mt-2 rounded-2xl bg-black/25 p-2 text-sm font-bold text-white">
              🗡️ Il Sicario ha colpito {who(q.assassinPick).name}
              {q.seer ? ` · il Veggente era ${who(q.seer).name}` : ''}
            </p>
          )}
        </section>
        {board}
        <section className="rounded-3xl border-2 border-white/10 bg-slate-900/95 p-3">
          <p className="mb-2 px-1 text-xs font-black uppercase tracking-widest text-amber-300">Chi era chi</p>
          <div className="grid grid-cols-2 gap-1.5">
            {q.order.map((id) => {
              const spy = q.spies.includes(id);
              const r = id === q.seer ? MI_ROLES.VEGGENTE : id === q.sicario ? MI_ROLES.SICARIO : spy ? MI_ROLES.SPIA : MI_ROLES.AGENTE;
              return (
                <p key={id} className={`flex items-center gap-1.5 rounded-2xl p-1.5 text-sm font-bold ${spy ? 'bg-rose-500/20' : 'bg-sky-500/15'}`}>
                  {face(id, 28)}
                  <span className="min-w-0 flex-1 truncate text-white">{who(id).name}</span>
                  <span title={r.name}>{r.emoji}</span>
                </p>
              );
            })}
          </div>
        </section>
        {history}
        <Podium state={state} entries={ranking.map(([id, points]) => ({ id, value: `${points} ${points === 1 ? 'punto' : 'punti'}` }))} />
        <section className="rounded-3xl border-2 border-white/10 bg-slate-900/95 p-4">
          <p className="mb-2 text-center text-xs font-bold text-slate-400">Squadra vincente +3 · Veggente salvo o Sicario a segno +1</p>
          <Ranking state={state} scores={q.scores} />
        </section>
        <EndBar canLead={canLead} hostName={who(state.hostId).name} onNewGame={onNewGame} onBackToLobby={onBackToLobby} />
      </div>
    );
  }

  // ---------------------------------------------------------------- carta del ruolo
  if (q.stage === 'ROLE') {
    const iReady = q.ready.includes(me);
    return (
      <div className="stagger flex flex-col gap-4">
        {header('🕶️ Missione segreta')}
        <h2 className="text-center text-3xl text-white">Il tuo fascicolo</h2>
        {card(false)}
        <p className="rounded-2xl bg-slate-900/85 p-3 text-center text-sm font-bold text-slate-200">
          {q.spyCount} spie e {q.order.length - q.spyCount} agenti{q.withSeer ? ', tra cui un 🔮 Veggente e un 🗡️ Sicario' : ''}. Le spie si conoscono, gli agenti no. Servono 3 missioni.
        </p>
        {board}
        <BottomBar>
          <div className="flex items-center gap-2">
            {inGame ? (
              <button
                type="button"
                onClick={() => {
                  onAction('MG_READY');
                  haptic(15);
                }}
                className={`h-14 flex-1 rounded-2xl text-lg font-black ${iReady ? 'border-2 border-emerald-400 bg-slate-900 text-emerald-300' : 'bg-emerald-500 text-white'}`}
              >
                {iReady ? `Pronto ✓ (${q.ready.length}/${q.order.length})` : `Letto, sono pronto (${q.ready.length}/${q.order.length})`}
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

  // ---------------------------------------------------------------- scelta della squadra
  if (q.stage === 'TEAM') {
    return (
      <div className="stagger flex flex-col gap-4">
        {header(`🕶️ Missione ${q.mission + 1}/5`)}
        {board}
        <div className="flex items-center justify-center gap-2 text-center">
          {face(q.leader, 40)}
          <div className="text-left">
            <h2 className="text-2xl leading-tight text-white">{iLead ? 'Sei il capo! 👑' : `Capo: ${who(q.leader).name} 👑`}</h2>
            <p className="text-sm font-bold text-slate-200">
              {iLead ? `Tocca ${need} giocatori da mandare in missione (anche te)` : `Sta scegliendo ${need} agenti: ditegli la vostra!`}
              {q.needs[q.mission] > 1 ? ' · qui servono 2 sabotaggi' : ''}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {q.order.map((id, i) => {
            const sel = q.team.includes(id);
            const full = q.team.length >= need && !sel;
            return (
              <button
                key={id}
                type="button"
                disabled={!iLead || full}
                onClick={() => {
                  onAction('MG_TOGGLE', { id });
                  haptic(12);
                  soundManager.playClick();
                }}
                style={{ animationDelay: `${0.04 * i}s` }}
                className={`pop relative flex flex-col items-center gap-1 rounded-2xl border-4 p-2 disabled:opacity-100 ${sel ? 'border-amber-300 bg-amber-300/25' : 'border-white/10 bg-slate-900/85'} ${
                  full && iLead ? 'opacity-50' : ''
                }`}
              >
                {face(id, 44)}
                <span className="w-full truncate text-center text-xs font-black text-white">{id === me ? 'Tu' : who(id).name}</span>
                {id === q.leader && <span className="absolute right-1 top-0.5 text-base">👑</span>}
                {sel && <span className="absolute left-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-amber-300 text-slate-950"><Check size={13} strokeWidth={4} /></span>}
              </button>
            );
          })}
        </div>
        {history}
        {inGame && card(true)}
        <BottomBar>
          <div className="flex items-center gap-2">
            {iLead ? (
              <button
                type="button"
                disabled={q.team.length !== need}
                onClick={() => {
                  onAction('MG_PROPOSE');
                  haptic(25);
                }}
                className="shine h-14 flex-1 rounded-2xl bg-amber-400 text-lg font-black text-slate-950 disabled:opacity-50"
              >
                Proponi la squadra ({q.team.length}/{need})
              </button>
            ) : (
              status(`Squadra: ${q.team.length}/${need} scelti`)
            )}
            {leadButton}
          </div>
        </BottomBar>
      </div>
    );
  }

  // ---------------------------------------------------------------- voto sulla squadra
  if (q.stage === 'VOTE') {
    return (
      <div className="stagger flex flex-col gap-4">
        {header(`🗳️ Missione ${q.mission + 1}/5`)}
        <div className="text-center">
          <h2 className="text-3xl text-white">Approvate la squadra?</h2>
          <p className="text-sm font-bold text-slate-200">Proposta da {who(q.leader).name} 👑 · voto segreto, poi si svela tutto insieme</p>
        </div>
        <div className="flex flex-wrap justify-center gap-3 rounded-3xl border-2 border-amber-300/50 bg-slate-900/90 p-4">
          {q.team.map((id, i) => (
            <span key={id} className="pop flex w-16 flex-col items-center gap-1" style={{ animationDelay: `${0.06 * i}s` }}>
              {face(id, 52)}
              <span className="w-full truncate text-center text-xs font-black text-white">{id === me ? 'Tu' : who(id).name}</span>
            </span>
          ))}
        </div>
        {q.rejects >= 3 && (
          <p className="pop rounded-2xl bg-rose-500 p-2 text-center text-sm font-black text-white">
            ⚠️ {q.rejects} bocciate di fila: {q.rejects === 4 ? 'se bocciate anche questa vincono le spie!' : 'alla quinta vincono le spie!'}
          </p>
        )}
        {inGame && (
          <div className="grid grid-cols-2 gap-3">
            {[true, false].map((ok) => (
              <button
                key={String(ok)}
                type="button"
                onClick={() => {
                  onAction('MG_VOTE', { ok });
                  haptic(20);
                  soundManager.playClick();
                }}
                className={`flex h-32 flex-col items-center justify-center rounded-3xl border-4 text-white shadow-[0_6px_0_rgba(22,6,72,0.45)] ${
                  ok ? 'bg-linear-to-br from-emerald-400 to-teal-600' : 'bg-linear-to-br from-rose-500 to-red-700'
                } ${q.myVote === ok ? 'scale-105 border-white' : q.myVote === null ? 'border-white/30' : 'border-transparent opacity-50'} transition-transform`}
              >
                <span className="text-5xl">{ok ? '👍' : '👎'}</span>
                <span className="font-display text-2xl">{ok ? 'APPROVO' : 'BOCCIO'}</span>
              </button>
            ))}
          </div>
        )}
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
        {inGame && card(true)}
        <BottomBar>
          <div className="flex items-center gap-2">
            {status(`Voti: ${q.voted.length}/${online}${inGame ? (q.myVote === null ? ' · tocca a te!' : ' · puoi ancora cambiare') : ''}`)}
            {leadButton}
          </div>
        </BottomBar>
      </div>
    );
  }

  // ---------------------------------------------------------------- spoglio
  if (q.stage === 'VOTE_RESULT' && q.last) {
    const p = q.last;
    const voteOf = (id: string) => {
      const i = q.order.indexOf(id);
      return p.yes.includes(i) ? true : p.no.includes(i) ? false : null;
    };
    return (
      <div className="stagger flex flex-col gap-4">
        {header(`🗳️ Missione ${q.mission + 1}/5`)}
        <h2 className="text-center text-3xl text-white">Lo spoglio</h2>
        {!revealed ? (
          <div className="grid h-40 place-items-center rounded-3xl border-4 border-white/30 bg-slate-950/70">
            <span className="drum text-7xl">🥁</span>
          </div>
        ) : (
          <>
            <section
              className={`reveal-pop rounded-3xl border-4 border-white/90 p-4 text-center shadow-[0_8px_0_rgba(22,6,72,0.5)] ${
                p.approved ? 'bg-linear-to-br from-emerald-400 to-teal-600' : 'bg-linear-to-br from-rose-500 to-red-700'
              }`}
            >
              <p className="font-display text-3xl text-white">{p.approved ? 'Squadra approvata! 🚀' : 'Squadra bocciata!'}</p>
              <p className="text-sm font-bold text-white/90">
                {p.yes.length} sì · {p.no.length} no
                {p.approved ? ' · si parte per la missione' : q.rejects >= 5 ? ' · quinta bocciatura: vincono le spie!' : ` · bocciate di fila: ${q.rejects}/5, il comando passa`}
              </p>
            </section>
            <div className="grid grid-cols-4 gap-2">
              {q.order.map((id, i) => {
                const v = voteOf(id);
                return (
                  <div key={id} className="reveal-pop flex flex-col items-center gap-0.5 rounded-2xl bg-slate-900/85 p-1.5" style={{ animationDelay: `${0.05 * i}s` }}>
                    <span className="relative">
                      {face(id, 38)}
                      <span className="absolute -bottom-1 -right-2 text-xl">{v === true ? '✅' : v === false ? '❌' : '💤'}</span>
                    </span>
                    <span className="w-full truncate text-center text-[11px] font-black text-white">{id === me ? 'Tu' : who(id).name}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
        {board}
        <BottomBar>
          <div className="flex items-center gap-2">
            {status('Ricordatevi chi ha votato cosa… 🤔')}
            {leadButton}
          </div>
        </BottomBar>
      </div>
    );
  }

  // ---------------------------------------------------------------- missione
  if (q.stage === 'MISSION') {
    const onTeam = q.team.includes(me);
    const sides = swapped(`${me}-${q.mission}`) ? [true, false] : [false, true];
    return (
      <div className="stagger flex flex-col gap-4">
        {header(`🚀 Missione ${q.mission + 1}/5`)}
        <div className="flex flex-wrap justify-center gap-3 rounded-3xl border-2 border-white/10 bg-slate-900/90 p-3">
          {q.team.map((id) => (
            <span key={id} className="relative flex w-14 flex-col items-center gap-0.5">
              {face(id, 44)}
              {q.played.includes(id) && <span className="absolute -right-1 top-0 text-lg">🂠</span>}
              <span className="w-full truncate text-center text-[11px] font-black text-white">{id === me ? 'Tu' : who(id).name}</span>
            </span>
          ))}
        </div>
        {onTeam && !q.myPlayed ? (
          <>
            <div className="text-center">
              <h2 className="text-3xl text-white">Scegli la tua carta</h2>
              <p className="text-sm font-bold text-slate-200">
                In segreto! Gli agenti fanno sempre SUCCESSO, qualunque carta tocchino.{q.needs[q.mission] > 1 ? ' Qui servono 2 sabotaggi per fallire.' : ''}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {sides.map((fail) => (
                <button
                  key={String(fail)}
                  type="button"
                  onClick={() => {
                    onAction('MG_PLAY', { fail });
                    haptic(30);
                    soundManager.playClick();
                  }}
                  className="flex h-44 flex-col items-center justify-center gap-2 rounded-3xl border-4 border-white/80 bg-linear-to-br from-slate-600 to-slate-900 text-white shadow-[0_6px_0_rgba(22,6,72,0.45)] active:scale-95"
                >
                  <span className="text-5xl">{fail ? '💣' : '✅'}</span>
                  <span className="font-display text-xl">{fail ? 'SABOTAGGIO' : 'SUCCESSO'}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-3xl border-2 border-white/10 bg-slate-900/90 p-6 text-center">
            <p className="float text-6xl">{onTeam ? '🂠' : '🚀'}</p>
            <p className="mt-2 font-display text-2xl text-white">{onTeam ? 'Carta consegnata coperta' : 'La squadra è in missione…'}</p>
            <p className="text-sm font-bold text-slate-300">
              Carte consegnate: {q.played.length}/{q.team.length}
            </p>
          </div>
        )}
        {board}
        {inGame && card(true)}
        <BottomBar>
          <div className="flex items-center gap-2">
            {status(`Carte consegnate: ${q.played.length}/${q.team.length}`)}
            {leadButton}
          </div>
        </BottomBar>
      </div>
    );
  }

  // ---------------------------------------------------------------- esito della missione
  if (q.stage === 'MISSION_RESULT') {
    const r = q.results[q.mission];
    const cards = q.cards ?? [];
    return (
      <div className="stagger flex flex-col gap-4">
        {header(`🚀 Missione ${q.mission + 1}/5`)}
        <h2 className="text-center text-3xl text-white">Si girano le carte…</h2>
        {!revealed ? (
          <div className="grid h-40 place-items-center rounded-3xl border-4 border-white/30 bg-slate-950/70">
            <span className="drum text-7xl">🥁</span>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap justify-center gap-2">
              {cards.map((c, i) => (
                <span
                  key={i}
                  className={`reveal-pop grid h-24 w-16 place-items-center rounded-2xl border-4 border-white text-4xl shadow-[0_5px_0_rgba(22,6,72,0.45)] ${c === 'F' ? 'bg-rose-600' : 'bg-emerald-500'}`}
                  style={{ animationDelay: `${0.45 * i}s` }}
                >
                  {c === 'F' ? '💣' : '✅'}
                </span>
              ))}
            </div>
            {r && (
              <section
                className={`reveal-pop rounded-3xl border-4 border-white/90 p-4 text-center shadow-[0_8px_0_rgba(22,6,72,0.5)] ${r.ok ? 'bg-linear-to-br from-emerald-400 to-teal-600' : 'bg-linear-to-br from-rose-500 to-red-700'}`}
                style={{ animationDelay: `${0.45 * cards.length}s` }}
              >
                <p className="font-display text-3xl text-white">{r.ok ? 'Missione riuscita!' : 'Missione fallita!'}</p>
                <p className="text-sm font-bold text-white/90">
                  {r.fails === 0 ? 'Nessun sabotaggio: la squadra era pulita… o le spie si nascondono 😏' : `${r.fails} ${r.fails === 1 ? 'sabotaggio' : 'sabotaggi'}${r.ok ? ' (ne servivano 2)' : ''}: c’è una spia in squadra!`}
                </p>
              </section>
            )}
          </>
        )}
        {board}
        <BottomBar>
          <div className="flex items-center gap-2">
            {status('Chi c’era in squadra? Discutetene!')}
            {leadButton}
          </div>
        </BottomBar>
      </div>
    );
  }

  // ---------------------------------------------------------------- il Sicario cerca il Veggente
  const iShoot = role === 'SICARIO';
  const agents = q.order.filter((id) => !q.spies.includes(id));
  return (
    <div className="stagger flex flex-col gap-4">
      {header('🗡️ Ultima speranza')}
      <section className="reveal-pop rounded-3xl border-4 border-white/90 bg-linear-to-br from-rose-600 to-slate-950 p-4 text-center shadow-[0_8px_0_rgba(22,6,72,0.5)]">
        <p className="text-xs font-black uppercase tracking-widest text-white/80">Tre missioni riuscite… ma le spie si svelano!</p>
        <div className="my-2 flex flex-wrap justify-center gap-2">
          {q.spies.map((id) => (
            <span key={id} className="flex flex-col items-center gap-0.5">
              {face(id, 44)}
              <span className="text-xs font-black text-white">
                {who(id).name}
                {id === q.sicario ? ' 🗡️' : ''}
              </span>
            </span>
          ))}
        </div>
        <p className="text-sm font-bold text-white">
          {iShoot ? 'Tocca a te: chi è il Veggente? Un colpo solo!' : `Il Sicario ${who(q.sicario).name} cerca il Veggente: se lo trova, vincono le spie!`}
        </p>
      </section>
      <div className="grid grid-cols-3 gap-2">
        {agents.map((id, i) => {
          const aimed = q.assassinPick === id;
          return (
            <button
              key={id}
              type="button"
              disabled={!iShoot}
              onClick={() => {
                onAction('MG_AIM', { id });
                haptic(15);
                soundManager.playClick();
              }}
              style={{ animationDelay: `${0.04 * i}s` }}
              className={`pop relative flex flex-col items-center gap-1 rounded-2xl border-4 p-2 disabled:opacity-100 ${aimed ? 'border-rose-400 bg-rose-500/25' : 'border-white/10 bg-slate-900/85'}`}
            >
              {face(id, 44)}
              <span className="w-full truncate text-center text-xs font-black text-white">{id === me ? 'Tu' : who(id).name}</span>
              {aimed && <span className="absolute right-1 top-0.5 text-lg">🎯</span>}
            </button>
          );
        })}
      </div>
      {inGame && card(true)}
      <BottomBar>
        <div className="flex items-center gap-2">
          {iShoot ? (
            <button
              type="button"
              disabled={!q.assassinPick}
              onClick={() => {
                onAction('MG_SHOOT');
                haptic([30, 40, 30]);
              }}
              className="h-14 flex-1 rounded-2xl bg-rose-600 text-lg font-black text-white disabled:opacity-50"
            >
              {q.assassinPick ? `🗡️ Colpisci ${who(q.assassinPick).name}` : 'Tocca chi pensi sia il Veggente'}
            </button>
          ) : (
            status(q.assassinPick ? `Il Sicario punta ${who(q.assassinPick).name}… 😬` : 'Il Sicario sta pensando…')
          )}
          {leadButton}
        </div>
      </BottomBar>
    </div>
  );
}
