import { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { FastForward, Megaphone } from 'lucide-react';
import type { TabuCard, TabuView as TabuData } from '../types/game';
import { useCountdown } from '../hooks/useCountdown';
import { haptic, soundManager } from '../utils/audio';
import { GameChip, TimerRing } from './fx';
import { Avatar, BottomBar, EndBar, type ModeProps } from './ui';

const TEAMS = [
  { name: 'Rossi', emoji: '🔴', chip: 'bg-red-500', soft: 'bg-red-500/20 ring-red-400/60' },
  { name: 'Blu', emoji: '🔵', chip: 'bg-cyan-500', soft: 'bg-cyan-500/20 ring-cyan-400/60' },
];
const RESULT_ICON = { ok: '✅', skip: '⏭️', buzz: '📢' };

// La carta: parola da far indovinare e cinque parole vietate
function Card({ card, cardNo }: { card: TabuCard; cardNo: number }) {
  return (
    <section key={cardNo} className="tabu-card overflow-hidden rounded-3xl border-4 border-white bg-white shadow-[0_10px_0_rgba(22,6,72,0.5)]">
      <div className="bg-linear-to-br from-amber-300 to-amber-500 px-4 py-4 text-center">
        <p className="text-xs font-black uppercase tracking-widest text-slate-950/70">Fai indovinare</p>
        <p className="font-display text-4xl leading-tight text-slate-950 [overflow-wrap:anywhere]">{card.word}</p>
      </div>
      <div className="px-4 py-3">
        <p className="mb-1.5 text-center text-xs font-black uppercase tracking-widest text-red-600">🚫 Non dire</p>
        <ul className="flex flex-col gap-1">
          {card.banned.map((w) => (
            <li key={w} className="rounded-xl bg-red-50 py-1.5 text-center text-lg font-black text-red-700">
              {w}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// 🤐 Parola proibita: a squadre, fai indovinare la parola senza dire quelle vietate
export default function TabuView({ state, clockOffset, canLead, onAction, onNewGame, onBackToLobby, onForce }: ModeProps) {
  const z = state.mg as TabuData;
  const P = (id: string | null) => state.players.find((p) => p.id === id);
  const left = useCountdown(z.stage === 'PLAY' || z.stage === 'READY' ? z.stageEndsAt : null, clockOffset);
  const speaker = P(z.speaker);
  const team = TEAMS[z.speakerTeam];
  const members = (t: 0 | 1) => Object.keys(z.teams).filter((id) => z.teams[id] === t);
  const lastLog = useRef(z.log.length);

  // Ogni carta chiusa ha il suo suono, uguale per tutti (le squadre sono pubbliche)
  useEffect(() => {
    if (z.log.length > lastLog.current) {
      const r = z.log[z.log.length - 1].result;
      if (r === 'ok') soundManager.playSuccess();
      else if (r === 'skip') soundManager.playWhoosh();
      else {
        soundManager.playError();
        haptic([90, 40, 90]);
      }
    }
    lastLog.current = z.log.length;
  }, [z.log.length]);

  useEffect(() => {
    if (z.stage === 'READY' && z.role === 'SPEAKER') {
      soundManager.playPop();
      haptic(80);
    }
    if (z.stage === 'PLAY') soundManager.playStart();
    if (z.stage === 'END') {
      soundManager.playVictory();
      confetti({ particleCount: 170, spread: 95, origin: { y: 0.35 } });
    }
  }, [z.stage, z.turnNo]);

  const Scoreboard = (
    <div className="grid grid-cols-2 gap-2">
      {([0, 1] as const).map((t) => (
        <div
          key={t}
          className={`flex items-center justify-between rounded-2xl px-3 py-2 ring-2 ${TEAMS[t].soft} ${z.stage !== 'END' && z.speakerTeam === t ? 'scale-[1.03]' : 'opacity-80'} transition-transform`}
        >
          <span className="font-black text-white">
            {TEAMS[t].emoji} {TEAMS[t].name}
          </span>
          <span key={z.scores[t]} className="pop font-display text-3xl text-white">
            {z.scores[t]}
          </span>
        </div>
      ))}
    </div>
  );

  const Log = z.log.length > 0 && (
    <div className="flex flex-wrap justify-center gap-1.5">
      {z.log.map((l, i) => (
        <span
          key={i}
          className={`pop rounded-full px-3 py-1 text-sm font-black ${l.result === 'ok' ? 'bg-emerald-500 text-white' : l.result === 'buzz' ? 'bg-red-500 text-white' : 'bg-slate-700 text-slate-200'}`}
        >
          {RESULT_ICON[l.result]} {l.word}
        </span>
      ))}
    </div>
  );

  if (z.stage === 'END') {
    const winner = z.winner;
    return (
      <div className="stagger flex flex-col gap-4">
        <section className="pop flex flex-col items-center gap-2 rounded-3xl border-4 border-white/90 bg-slate-900 p-5 text-center shadow-[0_8px_0_rgba(22,6,72,0.5)]">
          <p className="text-6xl">{winner === -1 ? '🤝' : '🏆'}</p>
          <p className="font-display text-4xl leading-tight text-white">
            {winner === -1 || winner === null ? 'Pareggio!' : `Vincono i ${TEAMS[winner].name}!`}
          </p>
          <p className="font-display text-2xl text-amber-300">
            {z.scores[0]} – {z.scores[1]}
          </p>
        </section>
        {([0, 1] as const).map((t) => (
          <section key={t} className={`rounded-3xl p-3 ring-2 ${TEAMS[t].soft}`}>
            <p className="mb-2 font-display text-xl text-white">
              {TEAMS[t].emoji} {TEAMS[t].name} · {z.scores[t]} punti {winner === t ? '👑' : ''}
            </p>
            <div className="flex flex-wrap gap-2">
              {members(t).map((id) => {
                const p = P(id);
                return p ? (
                  <span key={id} className="flex items-center gap-1.5 rounded-full bg-slate-900/70 py-1 pl-1 pr-3 text-sm font-bold text-white">
                    <Avatar avatar={p.avatar} color={p.color} size={26} />
                    {p.name}
                  </span>
                ) : null;
              })}
            </div>
          </section>
        ))}
        <EndBar canLead={canLead} hostName={P(state.hostId)?.name} onNewGame={onNewGame} onBackToLobby={onBackToLobby} />
      </div>
    );
  }

  return (
    <div className="stagger flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <GameChip>
          🤐 Turno {z.turnNo}/{z.turnCount}
        </GameChip>
        {(z.stage === 'PLAY' || z.stage === 'READY') && <TimerRing left={left} total={z.stage === 'PLAY' ? state.settings.tabuSeconds : 20} />}
      </div>
      {Scoreboard}

      {/* Chi parla */}
      <div className={`flex items-center gap-3 rounded-2xl p-3 ring-2 ${team.soft}`}>
        {speaker && <Avatar avatar={speaker.avatar} color={speaker.color} size={48} />}
        <p className="min-w-0 flex-1 text-sm font-bold text-slate-200">
          {z.role === 'SPEAKER' ? 'Tocca a te!' : `Parla ${team.emoji} ${team.name}`}
          <span className="block truncate font-display text-2xl leading-tight text-white">
            {z.role === 'SPEAKER' ? 'Fai indovinare alla tua squadra' : speaker?.name}
          </span>
        </p>
      </div>

      {z.stage === 'READY' && (
        <section className="pop rounded-3xl border-2 border-white/10 bg-slate-900 p-5 text-center">
          <p className="text-5xl">{z.role === 'SPEAKER' ? '🎤' : z.role === 'GUESSER' ? '🧠' : '👀'}</p>
          <p className="mt-2 text-xl font-black text-white">
            {z.role === 'SPEAKER'
              ? 'Premi «Via!» quando sei pronto'
              : z.role === 'GUESSER'
                ? 'Preparati a indovinare!'
                : z.role === 'GUARD'
                  ? 'Tu controlli: se dice una parola vietata, premi BUZZ!'
                  : 'Si sta per partire…'}
          </p>
        </section>
      )}

      {z.stage === 'PLAY' && z.card && <Card card={z.card} cardNo={z.cardNo} />}
      {z.stage === 'PLAY' && z.role === 'GUESSER' && (
        <section className="pop flex flex-col items-center gap-2 rounded-3xl border-4 border-white/80 bg-linear-to-br from-emerald-400 to-emerald-600 p-6 text-center shadow-[0_8px_0_rgba(22,6,72,0.5)]">
          <p className="wiggle text-6xl">🗣️</p>
          <p className="font-display text-4xl text-white">Indovina!</p>
          <p className="font-bold text-emerald-50">Ascolta {speaker?.name} e urla la risposta</p>
        </section>
      )}

      {z.stage === 'TURN_END' && (
        <section className="pop rounded-3xl border-2 border-white/10 bg-slate-900 p-5 text-center">
          <p className="text-5xl">⏰</p>
          <p className="font-display text-3xl text-white">Tempo!</p>
          <p className="font-bold text-slate-300">
            {z.log.filter((l) => l.result === 'ok').length - z.log.filter((l) => l.result === 'buzz').length} punti per i {team.name} in questo turno
          </p>
        </section>
      )}

      {Log}

      <BottomBar>
        {z.stage === 'READY' && z.role === 'SPEAKER' ? (
          <button type="button" onClick={() => onAction('MG_GO')} className="shine h-16 rounded-2xl bg-amber-400 text-2xl font-black text-slate-950">
            Via! ▶
          </button>
        ) : z.stage === 'PLAY' && z.role === 'SPEAKER' ? (
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <button type="button" onClick={() => onAction('MG_OK', { card: z.cardNo })} className="h-16 rounded-2xl bg-emerald-500 text-2xl font-black text-white">
              ✓ Indovinata!
            </button>
            <button type="button" onClick={() => onAction('MG_SKIP', { card: z.cardNo })} className="h-16 rounded-2xl bg-slate-700 px-5 text-lg font-black text-white">
              Salta
            </button>
          </div>
        ) : z.stage === 'PLAY' && z.role === 'GUARD' ? (
          <button
            type="button"
            onClick={() => onAction('MG_BUZZ', { card: z.cardNo })}
            className="flex h-16 items-center justify-center gap-2 rounded-2xl bg-red-500 text-2xl font-black text-white"
          >
            <Megaphone size={26} /> BUZZ! Parola vietata
          </button>
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-slate-700 bg-slate-900/95 px-4 py-3 text-sm font-bold text-slate-200">
            <span className="min-w-0 truncate">
              {z.stage === 'TURN_END' ? 'Prossimo turno tra poco…' : z.stage === 'READY' ? `Aspettiamo che ${speaker?.name ?? '…'} parta` : 'Forza!'}
            </span>
            {canLead && (
              <button type="button" onClick={onForce} className="flex shrink-0 items-center gap-1 rounded-full bg-slate-800 px-3 py-1.5 text-amber-200">
                <FastForward size={14} /> Avanti
              </button>
            )}
          </div>
        )}
      </BottomBar>
    </div>
  );
}
