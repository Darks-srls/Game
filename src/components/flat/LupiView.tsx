import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import confetti from 'canvas-confetti';
import { Check, FastForward } from 'lucide-react';
import { LUPI_ROLES, type LupiRole, type LupiView as LupiData } from '../../data/flat/lupi';
import { useCountdown } from '../../hooks/useCountdown';
import { haptic, soundManager } from '../../utils/audio';
import { GameChip, Podium, TimerRing } from '../fx';
import { Avatar, BottomBar, EndBar, Ranking, type ModeProps } from '../ui';

// stelle del cielo notturno (posizioni fisse: uguali per tutti)
const STARS = Array.from({ length: 42 }, (_, i) => ({ left: (i * 53 + 7) % 100, top: (i * 37 + 3) % 70, size: 1 + (i % 3), delay: (i % 9) * 0.45 }));
type Mood = 'night' | 'day' | 'wolves' | 'village';

// Cielo dietro la schermata: notte con la luna, giorno col sole (uguale per tutti i ruoli)
function Sky({ mood }: { mood: Mood }) {
  const layer = 'absolute inset-0 transition-opacity duration-[1500ms]';
  return createPortal(
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className={`${layer} bg-linear-to-b from-[#030716] via-[#0b1442] to-[#1c0f45] ${mood === 'night' ? 'opacity-95' : 'opacity-0'}`}>
        {STARS.map((s, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-white"
            style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, opacity: 0.8, animation: `twinkle 2.8s ease-in-out ${s.delay}s infinite` }}
          />
        ))}
        <div className="float absolute right-[7%] top-[8%] h-24 w-24 rounded-full bg-[radial-gradient(circle_at_38%_35%,#fffdf0,#f3e3a2_58%,#cdb46a)] shadow-[0_0_70px_24px_rgba(255,240,190,0.28)]">
          <span className="absolute left-[22%] top-[52%] h-4 w-4 rounded-full bg-black/10" />
          <span className="absolute left-[55%] top-[25%] h-3 w-3 rounded-full bg-black/10" />
          <span className="absolute left-[60%] top-[62%] h-2 w-2 rounded-full bg-black/10" />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-40 bg-linear-to-t from-[#05030f] to-transparent" />
      </div>
      <div className={`${layer} bg-linear-to-b from-[#ff9f5a] via-[#c2577f] to-[#4a2bb8] ${mood === 'day' ? 'opacity-80' : 'opacity-0'}`}>
        <div className="float absolute left-[8%] top-[7%] h-24 w-24 rounded-full bg-[radial-gradient(circle,#fff7c2,#ffd02e_60%,#ff9f1a)] shadow-[0_0_90px_34px_rgba(255,214,90,0.5)]" />
      </div>
      <div className={`${layer} bg-linear-to-b from-[#3a0410] via-[#1a0720] to-[#05030f] ${mood === 'wolves' ? 'opacity-95' : 'opacity-0'}`} />
      <div className={`${layer} bg-linear-to-b from-[#1f9d6b] via-[#2a7bc8] to-[#3a1c9a] ${mood === 'village' ? 'opacity-85' : 'opacity-0'}`} />
    </div>,
    document.body,
  );
}

// Carta del ruolo: stesso retro e stessi colori per tutti, cambia solo il testo
function RoleCard({ open, onToggle, compact, children }: { open: boolean; onToggle: () => void; compact?: boolean; children: ReactNode }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onToggle()}
      aria-label={open ? 'Nascondi il tuo ruolo' : 'Mostra il tuo ruolo'}
      className={`flip relative w-full cursor-pointer select-none ${compact ? 'h-48' : 'h-80'} ${open ? 'open' : ''}`}
    >
      <div className="flip-inner relative h-full w-full">
        <div className="flip-face overflow-hidden rounded-3xl border-4 border-white/80 bg-linear-to-br from-indigo-800 via-slate-900 to-black shadow-[0_8px_0_rgba(22,6,72,0.5)]">
          <div className="shine absolute inset-0" />
          <span className={`absolute left-1/2 -translate-x-1/2 drop-shadow-[0_0_25px_rgba(255,240,190,0.6)] ${compact ? 'top-4 text-5xl' : 'top-10 text-8xl'}`}>🌕</span>
          <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent p-4 pt-10 text-center">
            {!compact && <span className="tap-hint mb-1 inline-block text-4xl">👆</span>}
            <p className={`font-black text-white [text-shadow:0_3px_0_rgba(0,0,0,0.25)] ${compact ? 'text-xl' : 'text-3xl'}`}>Tocca per vedere</p>
            <p className="text-sm font-bold text-white/85">il tuo ruolo segreto (copri lo schermo!)</p>
          </div>
        </div>
        <div className="flip-face flip-back overflow-hidden rounded-3xl border-4 border-white/80 bg-linear-to-br from-indigo-700 via-violet-900 to-slate-950 shadow-[0_8px_0_rgba(22,6,72,0.5)]">
          {children}
        </div>
      </div>
    </div>
  );
}

const nameOf = (role: LupiRole) => `${LUPI_ROLES[role].emoji} ${LUPI_ROLES[role].name}`;
const withArticle = (role: LupiRole) => `${LUPI_ROLES[role].article} ${LUPI_ROLES[role].name}`;

// il cielo resta montato tra una fase e l'altra: notte e giorno sfumano uno nell'altro
const moodOf = (q: LupiData): Mood =>
  q.stage === 'END' ? (q.winner === 'LUPI' ? 'wolves' : 'village') : q.stage === 'NIGHT' || q.stage === 'ROLE' || q.stage === 'DAWN' ? 'night' : 'day';

// 🐺 Lupi mannari
export default function LupiView(props: ModeProps) {
  return (
    <>
      <Sky mood={moodOf(props.state.mg as LupiData)} />
      <LupiStage {...props} />
    </>
  );
}

function LupiStage({ state, clockOffset, canLead, onAction, onNewGame, onBackToLobby, onForce }: ModeProps) {
  const q = state.mg as LupiData;
  const me = state.myId;
  const left = useCountdown(q.stage === 'END' ? null : q.stageEndsAt, clockOffset);
  const [open, setOpen] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [nope, setNope] = useState<string | null>(null);
  const inGame = q.order.includes(me);
  const alive = q.alive.includes(me);
  const dead = inGame && !alive;
  const role = q.myRole;

  const who = (id: string | null | undefined) => {
    const p = id ? state.players.find((x) => x.id === id) : undefined;
    return { name: p?.name ?? (id ? q.names[id] : undefined) ?? '?', avatar: p?.avatar ?? '👻', color: p?.color ?? '#475569', online: !!p?.isOnline };
  };
  const face = (id: string, size = 28) => {
    const p = who(id);
    return <Avatar avatar={p.avatar} color={p.color} size={size} />;
  };
  const tag = (id: string) => `${who(id).name}${id === me ? ' (tu)' : ''}`;

  // la carta si richiude a ogni fase (dal vivo non resta aperta sul tavolo)
  useEffect(() => {
    setOpen(false);
    setNope(null);
  }, [q.stage, q.n]);
  // suoni uguali per tutti i ruoli
  useEffect(() => {
    if (q.stage === 'ROLE') soundManager.playReveal();
    if (q.stage === 'NIGHT') soundManager.playWhoosh();
    if (q.stage === 'DAY' || q.stage === 'VOTE') soundManager.playPop();
    if (q.stage === 'DAWN' || q.stage === 'VERDICT') soundManager.playDrumroll(1.3);
    if (q.stage === 'END') {
      soundManager.playVictory();
      confetti({ particleCount: 160, spread: 95, origin: { y: 0.35 } });
    }
  }, [q.stage, q.n]);
  // rivelazione dopo il rullo di tamburi (stesso ritardo per tutti)
  useEffect(() => {
    setRevealed(false);
    if (q.stage !== 'DAWN' && q.stage !== 'VERDICT') return;
    const t = setTimeout(() => {
      setRevealed(true);
      soundManager.playReveal();
    }, 1400);
    return () => clearTimeout(t);
  }, [q.stage, q.n]);

  const deadWolves = q.order.filter((id) => !q.alive.includes(id) && q.roles[id] === 'LUPO').length;
  const wolvesLeft = (q.counts.LUPO ?? 0) - deadWolves;
  const mates = q.order.filter((id) => id !== me && q.roles[id] === 'LUPO');

  // il resoconto della mia notte: solo dentro la carta (dal vivo non si legge da lontano)
  const mine = q.myNight;
  let report: string | null = null;
  if (mine && q.victim === me) report = 'i lupi ti hanno sbranato.';
  else if (mine?.role === 'LUPO') report = mine.killed ? `il branco ha sbranato ${who(mine.killed).name}.` : `il branco ha attaccato ${mine.target ? who(mine.target).name : 'qualcuno'}, ma è sopravvissuto!`;
  else if (mine?.role === 'VEGGENTE') report = mine.target && mine.found ? `${who(mine.target).name} è ${withArticle(mine.found)} ${LUPI_ROLES[mine.found].emoji}` : 'niente visione.';
  else if (mine?.role === 'MEDICO') report = mine.target ? (mine.saved ? `hai salvato ${who(mine.target).name} dai lupi!` : `hai protetto ${who(mine.target).name}.`) : 'non hai protetto nessuno.';
  else if (mine?.role === 'CONTADINO') report = mine.target ? `sospettavi di ${who(mine.target).name}.` : 'nessun sospettato.';

  // cosa fa la mia scelta di notte: anche questo solo nella carta, in piccolo
  const nightHelp: Record<LupiRole, string> = {
    LUPO: mates.length ? 'Di notte scegliete la vittima: vince la più votata dal branco (pari = a sorte). Non potete sceglervi tra voi.' : 'Di notte scegli tu la vittima.',
    VEGGENTE: 'Di notte scegli di chi scoprire il ruolo: lo saprai all’alba, solo tu.',
    MEDICO: `Di notte scegli chi proteggere: non te stesso, né la stessa persona due notti di fila${q.blocked ? ` (stanotte non ${who(q.blocked).name})` : ''}.`,
    CONTADINO: 'Di notte scegli il tuo sospettato: non conta, ma a fine partita si vede chi aveva fiuto.',
  };
  const small = 'text-[11px] font-bold leading-snug text-slate-200';

  // retro della carta: ruolo, obiettivo e tutto quello che solo io so
  const cardBack = (compact: boolean) => {
    if (!role) return null;
    const info = LUPI_ROLES[role];
    const pack = q.stage === 'NIGHT' && alive && role === 'LUPO' && q.pack ? Object.entries(q.pack) : [];
    const lines = (
      <>
        {role === 'LUPO' && (
          <p className={small}>
            {mates.length ? `Il branco: ${mates.map((id) => who(id).name + (q.alive.includes(id) ? '' : ' 💀')).join(', ')}` : 'Sei l’unico lupo: caccia da solo.'}
          </p>
        )}
        {role === 'VEGGENTE' && q.visions.length > 0 && (
          <p className={small}>Visioni: {q.visions.slice(-5).map((v) => `${who(v.id).name} ${LUPI_ROLES[v.role].emoji}`).join(' · ')}</p>
        )}
        {alive && (!compact || q.stage === 'NIGHT') && <p className={small}>{nightHelp[role]}</p>}
        {pack.length > 0 && (
          <p className={small}>
            Scelte del branco: {pack.map(([w, t]) => `${w === me ? 'tu' : who(w).name} → ${t ? who(t).name : '…'}${q.done.includes(w) ? ' ✓' : ''}`).join(' · ')}
          </p>
        )}
        {report && (q.stage === 'DAWN' || q.stage === 'DAY') && <p className={`${small} text-amber-200`}>Stanotte: {report}</p>}
      </>
    );
    if (compact)
      return (
        <div className="flex h-full flex-col items-center justify-center gap-1 px-3 py-2 text-center">
          <p className="flex items-center gap-2 font-display text-2xl leading-tight text-white">
            <span className="text-3xl">{info.emoji}</span>
            {dead ? 'Eri' : 'Sei'} {info.name}
          </p>
          {lines}
        </div>
      );
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 p-5 text-center">
        <p className="text-xs font-black uppercase tracking-widest text-amber-300">Sei</p>
        <p className="text-7xl">{info.emoji}</p>
        <p className="font-display text-4xl leading-tight text-white">{info.name}</p>
        <p className="text-sm font-bold text-slate-100">{info.goal}</p>
        {lines}
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

  const counts = (
    <div className="flex flex-wrap justify-center gap-1.5">
      {(Object.keys(LUPI_ROLES) as LupiRole[])
        .filter((r) => q.counts[r])
        .map((r) => (
          <span key={r} className="rounded-full bg-slate-900/85 px-3 py-1 text-sm font-black text-white">
            {LUPI_ROLES[r].emoji} {q.counts[r]} {q.counts[r] === 1 ? LUPI_ROLES[r].name.toLowerCase() : r === 'LUPO' ? 'lupi' : r === 'CONTADINO' ? 'contadini' : LUPI_ROLES[r].name.toLowerCase()}
          </span>
        ))}
    </div>
  );

  // villaggio: vivi e morti (con il ruolo svelato), più i ruoli che conosco io
  const village = (
    <div className="grid grid-cols-4 gap-2">
      {q.order.map((id) => {
        const p = who(id);
        const isDead = !q.alive.includes(id);
        const known = isDead || dead ? q.roles[id] : undefined; // di giorno solo i ruoli pubblici (i segreti restano nella carta)
        return (
          <div key={id} className={`relative flex flex-col items-center gap-0.5 rounded-2xl p-1.5 ${isDead ? 'bg-black/40' : 'bg-slate-900/80'} ${id === me ? 'ring-2 ring-amber-300/70' : ''}`}>
            <span className={isDead ? 'opacity-40 grayscale' : ''}>
              <Avatar avatar={p.avatar} color={p.color} size={38} />
            </span>
            {isDead && <span className="absolute left-1 top-1 text-base">💀</span>}
            {known && id !== me && <span className="absolute right-1 top-1 text-base">{LUPI_ROLES[known].emoji}</span>}
            <span className={`w-full truncate text-center text-[11px] font-black ${isDead ? 'text-slate-500 line-through' : 'text-white'}`}>{id === me ? 'Tu' : p.name}</span>
          </div>
        );
      })}
    </div>
  );

  const header = (chip: ReactNode) => (
    <div className="flex items-center justify-between gap-2">
      <GameChip>{chip}</GameChip>
      <span className="rounded-full bg-slate-900/90 px-3 py-1 text-xs font-black text-slate-100">
        🐺 {wolvesLeft} · 🏡 {q.alive.length - wolvesLeft}
      </span>
      <TimerRing left={left} total={Math.round(q.stageMs / 1000)} />
    </div>
  );

  const leadButton = canLead && (
    <button type="button" onClick={onForce} className="flex h-14 shrink-0 items-center gap-1 rounded-2xl bg-slate-800 px-3 text-sm font-black text-amber-200">
      <FastForward size={16} /> Avanti
    </button>
  );
  const status = (text: string) => <p className="min-w-0 flex-1 truncate rounded-2xl border-2 border-slate-700 bg-slate-900/95 px-4 py-3 text-sm font-bold text-slate-200">{text}</p>;
  const ghost = dead && (
    <p className="rounded-2xl border-2 border-slate-600 bg-black/50 p-3 text-center text-sm font-bold text-slate-200">
      👻 Sei morto: ora vedi tutti i ruoli e le scelte della notte. Muto come una tomba!
    </p>
  );

  // ---------------------------------------------------------------- fine partita
  if (q.stage === 'END') {
    const wolvesWin = q.winner === 'LUPI';
    const ranking = Object.entries(q.scores).sort((a, b) => b[1] - a[1]);
    // chi ha avuto più fiuto: i sospetti dei contadini caduti su un lupo
    const nose: Record<string, number> = {};
    for (const night of q.secrets ?? []) for (const [by, t] of Object.entries(night.suspects)) if (q.roles[t] === 'LUPO') nose[by] = (nose[by] ?? 0) + 1;
    const best = Object.entries(nose).sort((a, b) => b[1] - a[1])[0];
    return (
      <div className="stagger flex flex-col gap-4">
        <section
          className={`reveal-pop rounded-3xl border-4 border-white/90 p-5 text-center shadow-[0_8px_0_rgba(22,6,72,0.5)] ${
            wolvesWin ? 'bg-linear-to-br from-rose-600 to-red-950' : 'bg-linear-to-br from-emerald-400 to-teal-700'
          }`}
        >
          <p className="text-6xl">{wolvesWin ? '🐺' : '🏡'}</p>
          <p className="font-display text-4xl text-white [text-shadow:0_4px_0_rgba(0,0,0,0.25)]">{wolvesWin ? 'Vincono i lupi!' : 'Vince il villaggio!'}</p>
          <p className="mt-1 text-sm font-bold text-white/90">
            {wolvesWin ? 'Il branco ha divorato il villaggio. Buonanotte a tutti 🌙' : 'Tutti i lupi sono stati scovati. Si dorme tranquilli ☀️'}
          </p>
        </section>

        <section className="rounded-3xl border-2 border-white/10 bg-slate-900/95 p-3">
          <p className="mb-2 px-1 text-xs font-black uppercase tracking-widest text-amber-300">Tutti i ruoli</p>
          <div className="flex flex-col gap-1.5">
            {q.order.map((id) => {
              const r = q.roles[id];
              const won = r && LUPI_ROLES[r].team === q.winner;
              return (
                <p key={id} className={`flex items-center gap-2 rounded-2xl p-1.5 text-sm font-bold ${won ? 'bg-amber-400/15' : 'bg-slate-800'}`}>
                  <span className={q.alive.includes(id) ? '' : 'opacity-50 grayscale'}>{face(id, 30)}</span>
                  <span className="min-w-0 flex-1 truncate text-white">
                    {tag(id)} {q.alive.includes(id) ? '' : '💀'}
                  </span>
                  {r && <span className="shrink-0 text-slate-200">{nameOf(r)}</span>}
                </p>
              );
            })}
          </div>
        </section>

        <section className="rounded-3xl border-2 border-white/10 bg-slate-900/95 p-3">
          <p className="mb-2 px-1 text-xs font-black uppercase tracking-widest text-amber-300">Cronaca della partita</p>
          <div className="flex flex-col gap-2">
            {Array.from({ length: q.n }, (_, k) => k + 1).map((n) => {
              const secret = q.secrets?.find((x) => x.n === n);
              const day = q.log.find((e) => e.kind === 'DAY' && e.n === n);
              const gone = q.log.filter((e) => e.kind === 'LEFT' && e.n === n);
              return (
                <div key={n} className="rounded-2xl bg-slate-800 p-2.5 text-sm font-semibold text-slate-200">
                  {secret && (
                    <>
                      <p className="font-black text-indigo-200">🌙 Notte {n}</p>
                      <p>
                        🐺 Attaccato: <b className="text-white">{secret.wolves ? who(secret.wolves).name : 'nessuno'}</b>
                        {secret.random ? ' (a caso: il branco non ha scelto)' : ''}
                        {secret.saved ? ' … ma il medico l’ha salvato! 💉' : secret.wolves ? ' 💀' : ''}
                      </p>
                      {(q.counts.VEGGENTE ?? 0) > 0 && <p>🔮 Visione: {secret.seer ? `${who(secret.seer).name} (${LUPI_ROLES[q.roles[secret.seer]].emoji})` : '—'}</p>}
                      {(q.counts.MEDICO ?? 0) > 0 && <p>💉 Protetto: {secret.medic ? who(secret.medic).name : '—'}</p>}
                    </>
                  )}
                  {day && (
                    <p className="mt-1">
                      <b className="text-amber-200">☀️ Giorno {n}:</b>{' '}
                      {day.id ? `eliminato ${who(day.id).name} con ${day.votes} voti (${day.role ? nameOf(day.role) : ''})` : day.tie ? 'pareggio, nessuno eliminato' : 'nessun voto, nessuno eliminato'}
                    </p>
                  )}
                  {gone.map((e) => (
                    <p key={e.id} className="mt-1">
                      🚪 {who(e.id).name} se n’è andato ({e.role ? nameOf(e.role) : ''})
                    </p>
                  ))}
                </div>
              );
            })}
          </div>
        </section>

        {!!q.secrets?.some((x) => Object.keys(x.suspects).length) && (
          <section className="rounded-3xl border-2 border-white/10 bg-slate-900/95 p-3">
            <p className="mb-1 px-1 text-xs font-black uppercase tracking-widest text-amber-300">I sospetti della notte</p>
            {best && (
              <p className="mb-2 px-1 text-sm font-bold text-emerald-300">
                🕵️ Miglior fiuto: {who(best[0]).name} ({best[1]} {best[1] === 1 ? 'sospetto' : 'sospetti'} su un lupo)
              </p>
            )}
            <div className="flex flex-col gap-1.5">
              {(q.secrets ?? []).map((night) =>
                Object.keys(night.suspects).length ? (
                  <div key={night.n} className="rounded-2xl bg-slate-800 p-2 text-sm font-semibold text-slate-200">
                    <p className="mb-1 font-black text-indigo-200">Notte {night.n}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(night.suspects).map(([by, t]) => (
                        <span key={by} className={`rounded-full px-2 py-0.5 text-xs font-bold ${q.roles[t] === 'LUPO' ? 'bg-emerald-500/25 text-emerald-100' : 'bg-slate-700 text-slate-200'}`}>
                          {who(by).name} → {who(t).name} {q.roles[t] === 'LUPO' ? '🎯' : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null,
              )}
            </div>
          </section>
        )}

        <Podium state={state} entries={ranking.map(([id, points]) => ({ id, value: `${points} ${points === 1 ? 'punto' : 'punti'}` }))} />
        <section className="rounded-3xl border-2 border-white/10 bg-slate-900/95 p-4">
          <p className="mb-2 text-center text-xs font-bold text-slate-400">Vincitori +3 · chi è sopravvissuto +1</p>
          <Ranking state={state} scores={q.scores} />
        </section>
        <EndBar canLead={canLead} hostName={who(state.hostId).name} onNewGame={onNewGame} onBackToLobby={onBackToLobby} />
      </div>
    );
  }

  // ---------------------------------------------------------------- carta del ruolo
  if (q.stage === 'ROLE') {
    const readyCount = q.ready.length;
    const iReady = q.ready.includes(me);
    return (
      <div className="stagger flex flex-col gap-4">
        {header('🐺 Lupi mannari')}
        <h2 className="text-center text-3xl text-white">Il villaggio va a dormire…</h2>
        {card(false)}
        {counts}
        <p className="rounded-2xl bg-slate-900/85 p-3 text-center text-sm font-bold text-slate-200">
          Di notte <b className="text-white">tutti</b> toccano il telefono: così nessuno capisce chi è chi. Guarda la carta senza farti vedere!
        </p>
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
                {iReady ? `Pronto ✓ (${readyCount}/${q.order.length})` : `Ho visto, sono pronto (${readyCount}/${q.order.length})`}
              </button>
            ) : (
              status(`Pronti: ${readyCount}/${q.order.length}`)
            )}
            {leadButton}
          </div>
        </BottomBar>
      </div>
    );
  }

  // ---------------------------------------------------------------- notte
  if (q.stage === 'NIGHT') {
    const iDone = q.done.includes(me);
    const aliveOnline = q.alive.filter((id) => who(id).online).length;
    return (
      <div className="stagger flex flex-col gap-4">
        {header(`🌙 Notte ${q.n}`)}
        {alive && role ? (
          <>
            <div className="text-center">
              <h2 className="text-3xl text-white">Notte {q.n} · scegli un giocatore</h2>
              <p className="mt-1 text-sm font-bold text-indigo-200">Scelgono tutti, così nessuno si tradisce. Cosa fa la tua scelta lo dice la tua carta.</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {q.alive.map((id, i) => {
                const sel = q.myPick === id;
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={id === me}
                    onClick={() => {
                      haptic(15);
                      soundManager.playClick();
                      // chi non si può scegliere (compagno di branco, protetto ieri) ha lo stesso aspetto: lo spiega la carta
                      if (!q.targets.includes(id)) return setNope(id);
                      setNope(null);
                      onAction('MG_PICK', { id });
                    }}
                    style={{ animationDelay: `${0.04 * i}s` }}
                    className={`pop relative flex flex-col items-center gap-1 rounded-2xl border-4 p-2 transition-colors disabled:opacity-35 ${
                      sel ? 'border-amber-300 bg-amber-300/25' : 'border-white/15 bg-slate-900/85'
                    }`}
                  >
                    {face(id, 44)}
                    <span className="w-full truncate text-center text-xs font-black text-white">{id === me ? 'Tu' : who(id).name}</span>
                    {sel && <span className="absolute left-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-amber-300 text-slate-950"><Check size={13} strokeWidth={4} /></span>}
                  </button>
                );
              })}
            </div>
            {card(true)}
          </>
        ) : (
          <>
            <div className="rounded-3xl border-2 border-indigo-300/30 bg-slate-950/80 p-5 text-center">
              <p className="float text-6xl">🌙</p>
              <p className="mt-2 font-display text-2xl text-white">Il villaggio dorme…</p>
              <p className="text-sm font-bold text-slate-300">Hanno scelto {q.done.length}/{aliveOnline}</p>
            </div>
            {ghost}
            {dead && q.pack && (
              <section className="flex flex-col gap-1.5 rounded-3xl border-2 border-white/10 bg-slate-900/90 p-3">
                <p className="px-1 text-xs font-black uppercase tracking-widest text-amber-300">Le scelte della notte</p>
                {Object.entries(q.pack).map(([id, t]) => (
                  <p key={id} className="flex items-center gap-2 rounded-2xl bg-slate-800 p-1.5 text-sm font-bold text-white">
                    {face(id, 26)}
                    <span className="min-w-0 flex-1 truncate">
                      {who(id).name} {q.roles[id] ? LUPI_ROLES[q.roles[id]].emoji : ''}
                    </span>
                    <span className="shrink-0 text-slate-300">→ {t ? who(t).name : '…'}</span>
                    {q.done.includes(id) && <Check size={16} className="shrink-0 text-emerald-400" />}
                  </p>
                ))}
              </section>
            )}
            {dead && card(true)}
          </>
        )}
        <BottomBar>
          <div className="flex items-center gap-2">
            {alive ? (
              <button
                type="button"
                disabled={!q.myPick || iDone}
                onClick={() => {
                  onAction('MG_LOCK');
                  haptic(25);
                }}
                className={`flex h-14 flex-1 flex-col items-center justify-center rounded-2xl ${iDone ? 'border-2 border-emerald-400 bg-slate-900 text-emerald-300' : 'bg-emerald-500 text-white disabled:opacity-50'}`}
              >
                <span className="text-lg font-black leading-tight">{iDone ? 'Confermato ✓' : q.myPick ? `Conferma: ${who(q.myPick).name}` : 'Tocca un giocatore'}</span>
                <span className="text-xs font-bold opacity-90">
                  {nope ? `Non puoi scegliere ${who(nope).name}: guarda la carta` : `Hanno scelto ${q.done.length}/${aliveOnline}${iDone ? ' · tocca un altro per cambiare' : ''}`}
                </span>
              </button>
            ) : (
              status(`Hanno scelto ${q.done.length}/${aliveOnline}`)
            )}
            {leadButton}
          </div>
        </BottomBar>
      </div>
    );
  }

  // ---------------------------------------------------------------- alba
  if (q.stage === 'DAWN') {
    const v = q.victim;
    return (
      <div className="stagger flex flex-col gap-4">
        {header(`🌅 Alba ${q.n}`)}
        <h2 className="text-center text-3xl text-white">Il sole sorge sul villaggio…</h2>
        {!revealed ? (
          <div className="grid h-56 place-items-center rounded-3xl border-4 border-white/30 bg-slate-950/70">
            <span className="drum text-7xl">🥁</span>
          </div>
        ) : (
          <section
            className={`reveal-pop rounded-3xl border-4 border-white/90 p-5 text-center shadow-[0_8px_0_rgba(22,6,72,0.5)] ${
              v ? 'bg-linear-to-br from-rose-600 to-slate-950' : 'bg-linear-to-br from-emerald-400 to-teal-700'
            }`}
          >
            {v ? (
              <>
                <p className="text-xs font-black uppercase tracking-widest text-white/80">Stanotte è morto</p>
                <div className="my-2 flex justify-center grayscale">{face(v, 72)}</div>
                <p className="font-display text-4xl text-white">{tag(v)}</p>
                {q.roles[v] && (
                  <p className="mt-1 text-lg font-black text-white">
                    Era {withArticle(q.roles[v])} {LUPI_ROLES[q.roles[v]].emoji}
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-6xl">🎉</p>
                <p className="font-display text-3xl text-white">Stanotte nessuno è morto!</p>
                <p className="mt-1 text-sm font-bold text-white/90">Qualcuno ha avuto una gran fortuna…</p>
              </>
            )}
          </section>
        )}
        {alive && (
          <>
            <p className="text-center text-sm font-bold text-indigo-200">🃏 Com’è andata la tua notte? Guardalo nella tua carta, di nascosto!</p>
            {card(true)}
          </>
        )}
        {ghost}
        <BottomBar>
          <div className="flex items-center gap-2">
            {status('Tra poco si discute…')}
            {leadButton}
          </div>
        </BottomBar>
      </div>
    );
  }

  // ---------------------------------------------------------------- giorno: discussione
  if (q.stage === 'DAY') {
    const iReady = q.ready.includes(me);
    const aliveOnline = q.alive.filter((id) => who(id).online).length;
    return (
      <div className="stagger flex flex-col gap-4">
        {header(`☀️ Giorno ${q.n}`)}
        <div className="rounded-3xl border-2 border-white/20 bg-slate-950/75 p-4 text-center">
          <p className="text-sm font-bold text-amber-200">
            {q.victim ? `Stanotte: 💀 ${who(q.victim).name} (${q.roles[q.victim] ? nameOf(q.roles[q.victim]) : '?'})` : 'Stanotte nessuno è morto'}
          </p>
          <h2 className="mt-1 text-3xl text-white">Discutete a voce!</h2>
          <p className="text-sm font-bold text-slate-200">Chi sono i lupi? Accusate, difendetevi, mentite. Poi si vota.</p>
        </div>
        {village}
        {ghost}
        {inGame && card(true)}
        <BottomBar>
          <div className="flex items-center gap-2">
            {alive ? (
              <button
                type="button"
                onClick={() => {
                  onAction('MG_READY');
                  haptic(15);
                }}
                className={`flex h-14 flex-1 flex-col items-center justify-center rounded-2xl ${iReady ? 'border-2 border-emerald-400 bg-slate-900 text-emerald-300' : 'bg-amber-400 text-slate-950'}`}
              >
                <span className="text-lg font-black leading-tight">{iReady ? 'Pronto ✓' : 'Pronti a votare!'}</span>
                <span className="text-xs font-bold opacity-90">
                  {q.ready.length}/{aliveOnline} pronti{iReady ? ' · tocca per annullare' : ''}
                </span>
              </button>
            ) : (
              status(`Pronti a votare: ${q.ready.length}/${aliveOnline}`)
            )}
            {leadButton}
          </div>
        </BottomBar>
      </div>
    );
  }

  // ---------------------------------------------------------------- voto
  if (q.stage === 'VOTE') {
    const voters = Object.keys(q.votes).filter((id) => q.alive.includes(id));
    const aliveOnline = q.alive.filter((id) => who(id).online).length;
    return (
      <div className="stagger flex flex-col gap-4">
        {header(`🗳️ Voto ${q.n}`)}
        <div className="text-center">
          <h2 className="text-3xl text-white">Chi eliminiamo?</h2>
          <p className="text-sm font-bold text-slate-100">Voto palese: puoi cambiarlo finché non scade. Pareggio = nessuno.</p>
        </div>
        {q.closing && <p className="pop rounded-2xl bg-amber-400 p-2 text-center text-sm font-black text-slate-950">Hanno votato tutti: si chiude tra pochi secondi!</p>}
        <div className="grid grid-cols-3 gap-2">
          {q.alive.map((id, i) => {
            const by = voters.filter((v) => q.votes[v] === id);
            const mine = q.votes[me] === id;
            const can = alive && id !== me;
            const known = dead ? q.roles[id] : undefined;
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
                className={`pop relative flex min-h-[112px] flex-col items-center gap-1 rounded-2xl border-4 p-2 disabled:opacity-100 ${
                  mine ? 'border-rose-400 bg-rose-500/25' : 'border-white/15 bg-slate-900/85'
                }`}
              >
                {face(id, 42)}
                <span className="w-full truncate text-center text-xs font-black text-white">{id === me ? 'Tu' : who(id).name}</span>
                {known && id !== me && <span className="absolute right-1 top-1 text-sm">{LUPI_ROLES[known].emoji}</span>}
                {by.length > 0 && (
                  <>
                    <span className="absolute left-1 top-1 grid h-6 min-w-6 place-items-center rounded-full bg-rose-500 px-1 text-xs font-black text-white">{by.length}</span>
                    <span className="flex flex-wrap justify-center -space-x-1">
                      {by.map((v) => (
                        <span key={v}>{face(v, 18)}</span>
                      ))}
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>
        {ghost}
        {alive && card(true)}
        <BottomBar>
          <div className="flex items-center gap-2">
            {status(`Hanno votato ${voters.length}/${aliveOnline}${alive ? (q.votes[me] ? ` · tu: ${who(q.votes[me]).name}` : ' · tocca a te!') : ''}`)}
            {leadButton}
          </div>
        </BottomBar>
      </div>
    );
  }

  // ---------------------------------------------------------------- verdetto
  const out = q.out;
  const outVotes = out ? Object.values(q.votes).filter((t) => t === out).length : 0;
  return (
    <div className="stagger flex flex-col gap-4">
      {header(`⚖️ Verdetto ${q.n}`)}
      <h2 className="text-center text-3xl text-white">Il villaggio ha deciso…</h2>
      {!revealed ? (
        <div className="grid h-56 place-items-center rounded-3xl border-4 border-white/30 bg-slate-950/70">
          <span className="drum text-7xl">🥁</span>
        </div>
      ) : out ? (
        <section className="reveal-pop rounded-3xl border-4 border-white/90 bg-linear-to-br from-amber-400 to-rose-600 p-5 text-center shadow-[0_8px_0_rgba(22,6,72,0.5)]">
          <p className="text-xs font-black uppercase tracking-widest text-slate-950/70">Eliminato con {outVotes} voti</p>
          <div className="my-2 flex justify-center grayscale">{face(out, 72)}</div>
          <p className="font-display text-4xl text-white [text-shadow:0_3px_0_rgba(0,0,0,0.2)]">{tag(out)}</p>
          {q.roles[out] && (
            <p className="mt-1 text-xl font-black text-white">
              Era {withArticle(q.roles[out])} {LUPI_ROLES[q.roles[out]].emoji}
            </p>
          )}
        </section>
      ) : (
        <section className="reveal-pop rounded-3xl border-4 border-white/90 bg-linear-to-br from-slate-500 to-slate-800 p-5 text-center shadow-[0_8px_0_rgba(22,6,72,0.5)]">
          <p className="text-6xl">{q.tie ? '🤝' : '🤷'}</p>
          <p className="font-display text-3xl text-white">{q.tie ? 'Pareggio!' : 'Nessuno ha votato!'}</p>
          <p className="mt-1 text-sm font-bold text-white/90">Oggi nessuno viene eliminato. I lupi ringraziano 🐺</p>
        </section>
      )}
      {revealed && Object.keys(q.votes).length > 0 && (
        <section className="flex flex-wrap justify-center gap-1.5 rounded-3xl bg-slate-950/70 p-3">
          {Object.entries(q.votes).map(([v, t]) => (
            <span key={v} className="flex items-center gap-1 rounded-full bg-slate-800 py-0.5 pl-0.5 pr-2 text-xs font-bold text-slate-200">
              {face(v, 20)} → {who(t).name}
            </span>
          ))}
        </section>
      )}
      {ghost}
      <BottomBar>
        <div className="flex items-center gap-2">
          {status('Tra poco cala la notte… 🌙')}
          {leadButton}
        </div>
      </BottomBar>
    </div>
  );
}
