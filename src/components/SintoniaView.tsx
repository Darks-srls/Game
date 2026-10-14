import { useEffect, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react';
import confetti from 'canvas-confetti';
import { FastForward, Send } from 'lucide-react';
import type { SintoniaView as SintoniaData } from '../types/game';
import { useCountdown } from '../hooks/useCountdown';
import { soundManager } from '../utils/audio';
import { GameChip, Podium, PointsPop, TimerRing } from './fx';
import { Avatar, BottomBar, EndBar, Ranking, type ModeProps } from './ui';

// Quadrante a mezzaluna: 0 = tutto a sinistra, 100 = tutto a destra
const W = 320;
const H = 178;
const CX = 160;
const CY = 165;
const R = 148;

const point = (v: number, r: number): [number, number] => {
  const a = Math.PI * (1 - v / 100);
  return [CX + r * Math.cos(a), CY - r * Math.sin(a)];
};

// Spicchio del quadrante tra due valori
function slice(v1: number, v2: number, r: number) {
  const a = Math.max(0, Math.min(100, v1));
  const b = Math.max(0, Math.min(100, v2));
  const [x1, y1] = point(a, r);
  const [x2, y2] = point(b, r);
  return `M ${CX} ${CY} L ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z`;
}

interface Needle {
  id: string;
  value: number;
  color: string;
  avatar?: string;
}

function Dial({ value, onChange, target, needles, revealKey }: { value: number | null; onChange?: (v: number) => void; target: number | null; needles: Needle[]; revealKey?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  const toValue = (e: ReactPointerEvent) => {
    const rect = ref.current!.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const y = ((e.clientY - rect.top) / rect.height) * H;
    let a = Math.atan2(CY - y, x - CX);
    if (a < 0) a = x < CX ? Math.PI : 0;
    return Math.round((1 - a / Math.PI) * 100);
  };

  const handlers = onChange
    ? {
        onPointerDown: (e: ReactPointerEvent<SVGSVGElement>) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          onChange(toValue(e));
        },
        onPointerMove: (e: ReactPointerEvent<SVGSVGElement>) => {
          if (dragging.current) onChange(toValue(e));
        },
        onPointerUp: () => {
          dragging.current = false;
        },
        onPointerCancel: () => {
          dragging.current = false;
        },
      }
    : {};

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${W} ${H}`}
      className={`w-full select-none ${onChange ? 'cursor-pointer touch-none' : ''}`}
      {...handlers}
      role={onChange ? 'slider' : 'img'}
      aria-valuenow={value ?? undefined}
      aria-label="Quadrante"
    >
      <defs>
        <linearGradient id="dialBg" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#ff5f88" />
          <stop offset="50%" stopColor="#9f6bff" />
          <stop offset="100%" stopColor="#38cbff" />
        </linearGradient>
      </defs>
      <path d={slice(0, 100, R + 8)} fill="#fff" opacity={0.9} />
      <path d={slice(0, 100, R)} fill="url(#dialBg)" />
      <path d={slice(0, 100, R - 26)} fill="#2c1577" opacity={0.9} />
      {/* tacche */}
      {Array.from({ length: 11 }, (_, i) => {
        const [x1, y1] = point(i * 10, R - 2);
        const [x2, y2] = point(i * 10, R - 14);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.55)" strokeWidth={2} />;
      })}
      {/* bersaglio: 2, 3 e 4 punti */}
      {target !== null && (
        <g key={revealKey} className="dial-target">
          <path d={slice(target - 15, target + 15, R - 1)} fill="#ffd02e" />
          <path d={slice(target - 9, target + 9, R - 1)} fill="#ff8a1f" />
          <path d={slice(target - 4, target + 4, R - 1)} fill="#12b5f5" />
          {[
            [target - 12, '2'],
            [target - 6.5, '3'],
            [target, '4'],
            [target + 6.5, '3'],
            [target + 12, '2'],
          ].map(([v, label], i) =>
            Number(v) >= 0 && Number(v) <= 100 ? (
              <text
                key={i}
                x={point(Number(v), R - 22)[0]}
                y={point(Number(v), R - 22)[1]}
                fill="#1b0b4d"
                fontSize={13}
                fontFamily="Lilita One, sans-serif"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {label}
              </text>
            ) : null,
          )}
        </g>
      )}
      {/* lancette */}
      {needles.map((n) => {
        const [x, y] = point(n.value, R - 30);
        return (
          <g key={n.id} className="dial-needle">
            <line x1={CX} y1={CY} x2={x} y2={y} stroke={n.color} strokeWidth={5} strokeLinecap="round" />
            <circle cx={x} cy={y} r={12} fill={n.color} stroke="#fff" strokeWidth={3} />
            {n.avatar && (
              <>
                <clipPath id={`clip-${n.id}`}>
                  <circle cx={x} cy={y} r={9} />
                </clipPath>
                <image href={`/art/avatars/${n.avatar}.webp`} x={x - 9} y={y - 9} width={18} height={18} clipPath={`url(#clip-${n.id})`} />
              </>
            )}
          </g>
        );
      })}
      {value !== null && (
        <g>
          <line x1={CX} y1={CY} x2={point(value, R - 18)[0]} y2={point(value, R - 18)[1]} stroke="#fff" strokeWidth={7} strokeLinecap="round" />
          <circle cx={point(value, R - 18)[0]} cy={point(value, R - 18)[1]} r={9} fill="#ff3b6e" stroke="#fff" strokeWidth={3} />
        </g>
      )}
      <circle cx={CX} cy={CY} r={14} fill="#fff" />
      <circle cx={CX} cy={CY} r={7} fill="#ff3b6e" />
    </svg>
  );
}

// 📡 Sintonia: il sensitivo vede dove sta il bersaglio e dà un indizio; gli altri girano la lancetta
export default function SintoniaView({ state, clockOffset, canLead, onAction, onNewGame, onBackToLobby, onForce }: ModeProps) {
  const t = state.mg as SintoniaData;
  const P = (id: string | null) => state.players.find((p) => p.id === id);
  const left = useCountdown(t.stage === 'END' ? null : t.stageEndsAt, clockOffset);
  const total = t.stage === 'CLUE' ? 75 : t.stage === 'GUESS' ? 45 : 9;
  const psychic = P(t.psychic);
  const iPsychic = t.psychic === state.myId;
  const canGuess = t.stage === 'GUESS' && !iPsychic && t.order.includes(state.myId) && t.myGuess === null;
  const [dial, setDial] = useState(50);
  const [clue, setClue] = useState('');
  const waiting = t.order.filter((id) => id !== t.psychic && P(id)?.isOnline && !t.locked.includes(id)).map((id) => P(id)?.name);

  useEffect(() => {
    setDial(50);
    setClue('');
  }, [t.turnNo]);

  useEffect(() => {
    if (t.stage === 'GUESS') soundManager.playReveal();
    if (t.stage === 'REVEAL') {
      soundManager.playDrumroll(0.6);
      if (Object.values(t.gained).some((p) => p === 4)) setTimeout(() => confetti({ particleCount: 90, spread: 70, origin: { y: 0.35 } }), 650);
    }
    if (t.stage === 'END') {
      soundManager.playVictory();
      confetti({ particleCount: 160, spread: 90, origin: { y: 0.35 } });
    }
  }, [t.stage, t.turnNo]);

  if (t.stage === 'END') {
    const ranking = Object.entries(t.scores).sort((x, y) => y[1] - x[1]);
    return (
      <div className="stagger flex flex-col gap-4">
        <h2 className="text-center text-3xl text-white">Le menti più in sintonia 📡</h2>
        <Podium state={state} entries={ranking.map(([id, points]) => ({ id, value: `${points} punti` }))} />
        <section className="rounded-3xl border-2 border-white/10 bg-slate-900 p-4">
          <Ranking state={state} scores={t.scores} />
        </section>
        <EndBar canLead={canLead} hostName={P(state.hostId)?.name} onNewGame={onNewGame} onBackToLobby={onBackToLobby} />
      </div>
    );
  }

  const sendClue = (e: FormEvent) => {
    e.preventDefault();
    if (clue.trim()) onAction('MG_CLUE', { text: clue.trim() });
  };

  const needles: Needle[] =
    t.stage === 'REVEAL' && t.guesses
      ? Object.entries(t.guesses).map(([id, value]) => ({ id, value, color: P(id)?.color ?? '#fff', avatar: P(id)?.avatar }))
      : t.myGuess !== null
        ? [{ id: state.myId, value: t.myGuess, color: P(state.myId)?.color ?? '#fff', avatar: P(state.myId)?.avatar }]
        : [];

  return (
    <div className="stagger flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <GameChip>
          📡 Turno {t.turnNo}/{t.turnCount}
        </GameChip>
        <TimerRing left={left} total={total} />
      </div>

      <div className="flex items-center gap-3 rounded-2xl border-2 border-white/10 bg-slate-900 p-3">
        {psychic && <Avatar avatar={psychic.avatar} color={psychic.color} size={44} />}
        <p className="min-w-0 flex-1 text-sm font-bold text-slate-300">
          {iPsychic ? (t.stage === 'REVEAL' ? 'Eri tu il sensitivo 🔮' : 'Sei tu il sensitivo 🔮') : 'Il sensitivo è'}
          <span className="block truncate font-display text-xl text-white">
            {iPsychic ? (t.stage === 'REVEAL' ? 'Ecco com’è andata!' : 'Solo tu vedi il bersaglio!') : psychic?.name}
          </span>
        </p>
      </div>

      <section className="rounded-3xl border-2 border-white/10 bg-slate-900 p-3 pb-4">
        {t.clue && (
          <p key={t.clue} className="pop mb-2 text-center font-display text-3xl leading-tight text-amber-300">
            «{t.clue}»
          </p>
        )}
        <Dial
          value={canGuess ? dial : null}
          onChange={canGuess ? setDial : undefined}
          target={t.target}
          needles={needles}
          revealKey={`${t.turnNo}-${t.stage}`}
        />
        <div className="mt-1 flex justify-between gap-2">
          <span className="max-w-[48%] rounded-2xl bg-red-400 px-3 py-1.5 text-sm font-black leading-tight text-white shadow-[0_4px_0_rgba(22,6,72,0.4)]">← {t.left}</span>
          <span className="max-w-[48%] rounded-2xl bg-cyan-500 px-3 py-1.5 text-right text-sm font-black leading-tight text-white shadow-[0_4px_0_rgba(22,6,72,0.4)]">{t.right} →</span>
        </div>
        {canGuess && (
          <input
            type="range"
            min={0}
            max={100}
            value={dial}
            onChange={(e) => setDial(Number(e.target.value))}
            aria-label="Sposta la lancetta"
            className="mt-4 w-full accent-amber-400"
          />
        )}
      </section>

      {t.stage === 'CLUE' && iPsychic && (
        <form onSubmit={sendClue} className="pop flex flex-col gap-2 rounded-3xl border-2 border-amber-400/60 bg-slate-900 p-4">
          <p className="text-sm font-bold text-slate-200">
            Scrivi un indizio che stia lì sul quadrante, tra «{t.left}» e «{t.right}». Più è assurdo, più si ride!
          </p>
          <div className="flex gap-2">
            <input
              value={clue}
              onChange={(e) => setClue(e.target.value.slice(0, 60))}
              placeholder="Il tuo indizio…"
              autoComplete="off"
              className="h-14 min-w-0 flex-1 rounded-2xl border-2 border-slate-700 bg-slate-950 px-4 text-lg text-white outline-none placeholder:text-slate-500 focus:border-amber-400"
            />
            <button type="submit" disabled={!clue.trim()} aria-label="Invia indizio" className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-amber-400 text-slate-950 disabled:opacity-50">
              <Send size={22} />
            </button>
          </div>
        </form>
      )}
      {t.stage === 'CLUE' && !iPsychic && (
        <p className="text-center text-lg font-black text-slate-200">
          <span className="float inline-block">🔮</span> {psychic?.name} sta pensando a un indizio…
        </p>
      )}

      {t.stage === 'REVEAL' && (
        <section className="rounded-3xl border-2 border-white/10 bg-slate-900 p-3">
          <ul className="grid grid-cols-2 gap-2">
            {Object.entries(t.gained)
              .sort((a, b) => b[1] - a[1])
              .map(([id, points], i) => {
                const p = P(id);
                return p ? (
                  <li key={id} className="pop relative flex items-center gap-2 rounded-2xl bg-slate-800 p-2" style={{ animationDelay: `${0.5 + i * 0.1}s` }}>
                    <Avatar avatar={p.avatar} color={p.color} size={30} />
                    <span className="min-w-0 flex-1 truncate font-bold text-white">
                      {p.name}
                      {id === t.psychic ? ' 🔮' : ''}
                    </span>
                    <span className={`font-display text-xl ${points ? 'text-amber-300' : 'text-slate-500'}`}>+{points}</span>
                    <PointsPop points={points} className="absolute -top-2 right-2" />
                  </li>
                ) : null;
              })}
          </ul>
        </section>
      )}

      <BottomBar>
        {canGuess ? (
          <button type="button" onClick={() => onAction('MG_DIAL', { value: dial })} className="shine h-16 rounded-2xl bg-amber-400 text-xl font-black text-slate-950">
            Conferma la lancetta
          </button>
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-slate-700 bg-slate-900/95 px-4 py-3 text-sm font-bold text-slate-200">
            <span className="min-w-0 truncate">
              {t.stage === 'REVEAL'
                ? 'Prossimo turno tra poco…'
                : t.stage === 'CLUE'
                  ? 'Aspettiamo l’indizio…'
                  : waiting.length
                    ? `Devono ancora girare: ${waiting.join(', ')}`
                    : 'Tutti pronti!'}
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
