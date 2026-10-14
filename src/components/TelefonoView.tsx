import { useEffect, useRef, useState } from 'react';
import { Dices, FastForward } from 'lucide-react';
import type { ClientGameState, DrawOp } from '../types/game';
import { PROMPTS, PROMPTS_SPICY } from '../data/prompts';
import { useCountdown } from '../hooks/useCountdown';
import { soundManager } from '../utils/audio';
import DrawBoard, { type DrawBoardHandle } from './DrawBoard';
import { TimerRing } from './fx';
import { Avatar, BottomBar } from './ui';

interface TelefonoViewProps {
  state: ClientGameState;
  clockOffset: number;
  onSubmit: (content: { text?: string; drawing?: string | null }) => void;
  onForceNext: () => void;
}

// Un turno del Telefono senza fili: scrivi la frase, disegna, oppure descrivi il disegno
export default function TelefonoView({ state, clockOffset, onSubmit, onForceNext }: TelefonoViewProps) {
  const tel = state.tel!;
  const [text, setText] = useState('');
  const canvas = useRef<DrawBoardHandle>(null);
  const [ops, setOps] = useState<DrawOp[]>([]);
  const sent = useRef(false);
  const left = useCountdown(tel.stepEndsAt, clockOffset);
  const drawing = tel.stepType === 'drawing';
  const first = tel.step === 0;
  const input = tel.myInput;
  const waiting = state.players.filter((p) => p.inRound && p.isOnline && !p.confirmed);
  const host = state.players.find((p) => p.id === state.hostId);
  const canLead = state.myId === state.hostId || !host?.isOnline;
  const clock = left === null ? null : left === 0 ? 'Tempo!' : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;

  const submit = () => {
    if (!tel.inGame || tel.mySubmitted || sent.current) return;
    sent.current = true;
    setTimeout(() => (sent.current = false), 3000);
    if (drawing) onSubmit({ drawing: canvas.current?.toDataURL() ?? null });
    else onSubmit({ text: text.trim() });
  };

  // Nuovo turno: stesso suono per tutti
  useEffect(() => {
    if (tel.inGame && !tel.mySubmitted) soundManager.playReveal();
  }, []);

  // Tempo scaduto: si consegna quello che c'è
  useEffect(() => {
    if (left === 0) submit();
  }, [left]);

  let body;
  if (!tel.inGame) {
    body = (
      <div className="rounded-3xl border-2 border-slate-700 bg-slate-900 p-6 text-center">
        <p className="text-4xl">🍿</p>
        <p className="mt-2 text-xl font-black text-white">Partita in corso</p>
        <p className="text-sm font-semibold text-slate-400">Vedrai gli album con tutti gli altri alla fine.</p>
      </div>
    );
  } else if (tel.mySubmitted) {
    body = (
      <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-slate-700 bg-slate-900 p-6 text-center">
        <span className="text-6xl">✅</span>
        <p className="text-2xl font-black text-white">Fatto!</p>
        <p className="text-sm font-semibold text-slate-300">Aspettiamo gli altri…</p>
        <div className="flex flex-wrap justify-center gap-2">
          {waiting.map((p) => (
            <span key={p.id} className="flex items-center gap-1.5 rounded-full bg-slate-800 py-1 pl-1 pr-3 text-sm font-bold text-slate-200">
              <Avatar avatar={p.avatar} color={p.color} size={24} />
              {p.name}
            </span>
          ))}
        </div>
      </div>
    );
  } else if (drawing) {
    body = (
      <>
        <div className="rounded-2xl border-2 border-slate-700 bg-slate-900 px-4 py-2 text-center">
          <p className="text-xs font-black uppercase tracking-widest text-amber-300">Disegna</p>
          <p className="text-lg font-bold leading-snug text-white">{input?.content ? `«${input.content}»` : 'La frase si è persa: disegna quello che vuoi!'}</p>
        </div>
        <div className="mx-auto w-full min-w-[240px] max-w-[calc(100dvh-360px)]">
          <DrawBoard ref={canvas} ops={ops} onOp={(op) => setOps((list) => [...list, op])} />
        </div>
      </>
    );
  } else {
    body = (
      <>
        {first ? (
          <div className="text-center">
            <p className="text-3xl font-black text-white">Scrivi una frase</p>
            <p className="text-sm font-semibold text-slate-300">Qualcosa di assurdo da far disegnare al prossimo</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-center text-2xl font-black text-white">Cosa rappresenta?</p>
            {input?.content ? (
              <img
                src={input.content}
                alt="Disegno da descrivere"
                className="mx-auto aspect-square w-full max-w-[calc(100dvh-380px)] rounded-2xl border-4 border-white/80 bg-white object-contain"
              />
            ) : (
              <p className="rounded-2xl bg-slate-900 p-6 text-center font-bold text-slate-300">Il disegno si è perso: inventa tu una frase!</p>
            )}
          </div>
        )}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 120))}
          rows={2}
          placeholder={first ? 'es. Un piccione che fa la dichiarazione dei redditi' : 'Scrivi cosa vedi…'}
          className="w-full resize-none rounded-2xl border-2 border-slate-700 bg-slate-950 px-4 py-3 text-lg text-white outline-none placeholder:text-slate-500 focus:border-amber-400"
        />
        {first && (
          <button
            type="button"
            onClick={() => {
              // 🌶️ con i contenuti piccanti le idee sgravate escono più spesso
              const pool = state.settings.spicy ? [...PROMPTS, ...PROMPTS_SPICY, ...PROMPTS_SPICY] : PROMPTS;
              setText(pool[Math.floor(Math.random() * pool.length)]);
            }}
            className="flex items-center justify-center gap-2 self-center rounded-full bg-slate-800 px-4 py-2 font-bold text-white"
          >
            <Dices size={18} /> Dammi un'idea
          </button>
        )}
      </>
    );
  }

  return (
    <div className="stagger flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-slate-900 px-3 py-1 text-sm font-black text-slate-100">
          🎨 Turno {tel.step + 1}/{tel.totalSteps}
        </span>
        {clock &&
          (left === 0 ? (
            <span className="animate-pulse rounded-2xl bg-red-500 px-4 py-1 text-2xl font-black text-white">{clock}</span>
          ) : (
            <TimerRing left={left} total={tel.stepType === 'drawing' ? state.settings.drawSeconds : Math.min(45, state.settings.drawSeconds)} />
          ))}
      </div>
      {body}
      <BottomBar>
        {tel.inGame && !tel.mySubmitted && (
          <button type="button" onClick={submit} className="h-16 rounded-2xl bg-emerald-500 text-xl font-black text-white">
            Fatto!
          </button>
        )}
        <div className="flex items-center justify-between gap-3 px-1 text-xs font-bold text-slate-200">
          <span className="truncate">{waiting.length ? `Aspettiamo: ${waiting.map((p) => p.name).join(', ')}` : 'Tutti pronti!'}</span>
          {canLead && (
            <button type="button" onClick={onForceNext} className="flex shrink-0 items-center gap-1 rounded-full bg-slate-900/95 px-3 py-1.5 text-amber-300">
              <FastForward size={14} /> Continua forzato
            </button>
          )}
        </div>
      </BottomBar>
    </div>
  );
}
