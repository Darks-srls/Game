import { useState } from 'react';
import { BookOpen, House, LogOut, Volume2, VolumeX } from 'lucide-react';
import type { GameId } from '../types/game';
import { soundManager } from '../utils/audio';
import { Art, GAMES } from './ui';

interface HeaderProps {
  roomCode?: string;
  game?: GameId;
  connected: boolean;
  onRules: () => void;
  onLeave?: () => void;
  onHome?: () => void; // a partita in corso: riporta tutti alla stanza
}

const iconButton = 'grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/10 text-slate-100 backdrop-blur';

export default function Header({ roomCode, game, connected, onRules, onLeave, onHome }: HeaderProps) {
  const [soundOn, setSoundOn] = useState(soundManager.enabled);
  const current = GAMES.find((g) => g.id === game);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/70 shadow-[0_8px_30px_rgba(20,6,70,0.35)] backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-md items-center gap-2 px-3">
        <div className="mr-auto flex min-w-0 items-center gap-2">
          <span className="relative shrink-0">
            <Art src="/art/logo.webp" fallback={<span className="text-2xl">🎮</span>} className="h-9 w-9 rounded-xl object-cover shadow-[0_3px_0_rgba(0,0,0,0.25)]" />
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slate-950 ${connected ? 'bg-emerald-400' : 'animate-pulse bg-red-500'}`}
              title={connected ? 'Connesso' : 'Connessione in corso…'}
            />
          </span>
          {roomCode ? (
            <span className="flex min-w-0 flex-col leading-none">
              <span className="truncate font-display text-lg text-amber-300">
                {current?.emoji} {current?.name ?? 'Stanza'}
              </span>
              <span className="text-[11px] font-bold tracking-widest text-slate-300">STANZA {roomCode}</span>
            </span>
          ) : (
            <span className="truncate font-display text-xl tracking-wide text-white">
              AXEND <span className="text-amber-300">GAMES</span>
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setSoundOn(soundManager.toggle())}
          aria-label={soundOn ? 'Disattiva suoni e vibrazione' : 'Attiva suoni e vibrazione'}
          title={soundOn ? 'Suoni accesi' : 'Silenzioso (per giocare dal vivo)'}
          className={iconButton}
        >
          {soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>
        {onHome ? (
          <button type="button" onClick={onHome} aria-label="Torna alla stanza" className={iconButton}>
            <House size={18} />
          </button>
        ) : (
          <button type="button" onClick={onRules} aria-label="Come si gioca" className={iconButton}>
            <BookOpen size={18} />
          </button>
        )}
        {onLeave && (
          <button type="button" onClick={onLeave} className="flex h-10 items-center gap-1.5 rounded-full bg-red-500 px-3.5 font-black text-white">
            <LogOut size={16} /> Esci
          </button>
        )}
      </div>
    </header>
  );
}
