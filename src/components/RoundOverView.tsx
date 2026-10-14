import { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { Settings } from 'lucide-react';
import type { ClientGameState } from '../types/game';
import { soundManager } from '../utils/audio';
import { Art, Avatar, BottomBar, LocationArt } from './ui';

interface RoundOverViewProps {
  state: ClientGameState;
  onNextRound: () => void;
  onBackToLobby: () => void;
}

// Fine round della Spia e dell'Impostore: si svela tutto
export default function RoundOverView({ state, onNextRound, onBackToLobby }: RoundOverViewProps) {
  const impostore = state.settings.game === 'IMPOSTORE';
  const loc = state.location;
  const words = state.words;
  const reveal = state.reveal ?? [];
  const bad = reveal.filter((r) => r.isSpy);
  const host = state.players.find((p) => p.id === state.hostId);
  const canLead = state.myId === state.hostId || !host?.isOnline;
  const badLabel = impostore ? (bad.length > 1 ? 'Gli impostori erano' : "L'impostore era") : bad.length > 1 ? 'Le spie erano' : 'La spia era';
  const [revealed, setRevealed] = useState(false);

  // Rullo di tamburi, poi si scopre chi era: stesso momento e stessi suoni per tutti
  useEffect(() => {
    soundManager.playDrumroll(1.3);
    const timer = setTimeout(() => {
      setRevealed(true);
      soundManager.playVictory();
      confetti({ particleCount: 140, spread: 85, origin: { y: 0.45 } });
    }, 1350);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="stagger flex flex-col gap-4">
      {impostore && words ? (
        <section className="overflow-hidden rounded-3xl border-4 border-white/80 bg-slate-900 shadow-[0_8px_0_rgba(22,6,72,0.5)]">
          <Art src="/art/gioco-impostore.webp" fallback={null} className="aspect-video w-full object-cover" />
          <div className="p-4 text-center">
            <p className="text-xs font-black uppercase tracking-widest text-amber-300">La parola era</p>
            <p className="text-4xl font-black text-white">{words.civil}</p>
            {words.impostor && <p className="mt-1 font-bold text-red-200">L'impostore aveva: «{words.impostor}»</p>}
          </div>
        </section>
      ) : (
        loc && (
          <section className="overflow-hidden rounded-3xl border-4 border-white/80 bg-slate-900 shadow-[0_8px_0_rgba(22,6,72,0.5)]">
            <LocationArt id={loc.id} icon={loc.icon} className="h-44 w-full" />
            <div className="p-4 text-center">
              <p className="text-xs font-black uppercase tracking-widest text-amber-300">Il luogo era</p>
              <p className="text-3xl font-black text-white">
                {loc.icon} {loc.name}
              </p>
            </div>
          </section>
        )
      )}

      <section className="rounded-3xl border-2 border-red-400/60 bg-red-500/20 p-4 text-center">
        <p className="text-xs font-black uppercase tracking-widest text-red-200">{badLabel}</p>
        {revealed ? (
          <div className="mt-2 flex flex-wrap justify-center gap-5">
            {bad.map((s, i) => (
              <div key={s.id} className="reveal-pop flex flex-col items-center gap-1" style={{ animationDelay: `${i * 0.15}s` }}>
                <Avatar avatar={s.avatar} color={s.color} size={72} />
                <span className="text-2xl font-black text-white">{s.name}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid h-[104px] place-items-center">
            <span className="drum text-6xl">🥁</span>
          </div>
        )}
        {state.forcedEnd && <p className="mt-2 text-xs font-bold text-red-200">Round chiuso con fine forzata</p>}
      </section>

      <section className={`rounded-3xl border-2 border-slate-700 bg-slate-900 p-4 transition-opacity duration-500 ${revealed ? '' : 'opacity-0'}`}>
        <h2 className="mb-2 text-lg text-white">{impostore ? 'Chi aveva cosa' : 'Chi era chi'}</h2>
        <ul className="flex flex-col gap-1.5">
          {reveal.map((r) => (
            <li key={r.id} className="flex items-center gap-2">
              <Avatar avatar={r.avatar} color={r.color} size={30} />
              <span className="flex-1 truncate font-bold text-white">
                {r.name}
                {r.id === state.myId ? ' (tu)' : ''}
              </span>
              <span className={`text-sm font-bold ${r.isSpy ? 'text-red-300' : 'text-slate-300'}`}>{r.role || '(nessuna parola)'}</span>
            </li>
          ))}
        </ul>
      </section>

      <BottomBar>
        {canLead ? (
          <div className="flex gap-2">
            <button type="button" onClick={onNextRound} className="shine h-16 flex-1 rounded-2xl bg-amber-400 text-xl font-black text-slate-950">
              Nuovo round
            </button>
            <button
              type="button"
              onClick={onBackToLobby}
              className="flex h-16 flex-col items-center justify-center rounded-2xl bg-slate-800 px-3 text-xs font-black leading-tight text-white"
            >
              <Settings size={20} />
              Cambia gioco
            </button>
          </div>
        ) : (
          <p className="rounded-2xl border-2 border-slate-700 bg-slate-900/95 py-4 text-center font-bold text-slate-200">
            In attesa che {host?.name} avvii il prossimo round…
          </p>
        )}
      </BottomBar>
    </div>
  );
}
