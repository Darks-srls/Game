import React, { useState } from 'react';
import { Volume2, VolumeX, BookOpen, LogOut, Copy, Check, Users } from 'lucide-react';
import { soundManager } from '../utils/audio';

interface HeaderProps {
  roomCode?: string;
  connected: boolean;
  playerCount?: number;
  onOpenRules: () => void;
  onLeaveRoom?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  roomCode,
  connected,
  playerCount,
  onOpenRules,
  onLeaveRoom
}) => {
  const [soundOn, setSoundOn] = useState(soundManager.enabled);
  const [copied, setCopied] = useState(false);

  const handleToggleSound = () => {
    const newState = soundManager.toggle();
    setSoundOn(newState);
  };

  const handleCopyCode = () => {
    if (!roomCode) return;
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    soundManager.playClick();
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="w-full bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 sticky top-0 z-40 px-4 py-3">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
        {/* Logo and Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-lg shadow-inner">
            🕵️‍♂️
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold tracking-wider text-base text-slate-100 uppercase">
                Spyfall
              </span>
              <span className="text-[10px] tracking-widest uppercase font-mono px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/30 text-red-400 font-bold">
                Online
              </span>
            </div>
            <p className="text-[11px] text-slate-400 -mt-0.5 hidden sm:block">
              Il Gioco della Spia
            </p>
          </div>
        </div>

        {/* Room badge (if in room) */}
        {roomCode && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyCode}
              title="Clicca per copiare il codice stanza"
              className="group flex items-center gap-2 bg-slate-900 hover:bg-slate-800/90 border border-slate-700/80 px-3 py-1.5 rounded-lg text-xs font-mono transition-all text-slate-200 shadow-sm active:scale-95"
            >
              <span className="text-slate-400 group-hover:text-amber-400 transition-colors">
                Stanza:
              </span>
              <strong className="tracking-widest text-amber-400 font-bold text-sm">
                {roomCode}
              </strong>
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-200" />
              )}
            </button>

            {playerCount !== undefined && (
              <div className="hidden xs:flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-semibold">{playerCount}</span>
              </div>
            )}
          </div>
        )}

        {/* Utility Controls */}
        <div className="flex items-center gap-1.5">
          {/* Connection status dot */}
          <div
            title={connected ? 'Connesso al server' : 'Riconnessione...'}
            className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                connected ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-red-500 animate-pulse'
              }`}
            />
            <span className="hidden md:inline font-mono">{connected ? 'Live' : 'Sync'}</span>
          </div>

          {/* Sound Toggle */}
          <button
            onClick={handleToggleSound}
            title={soundOn ? 'Disattiva effetti audio' : 'Attiva effetti audio'}
            aria-label="Audio"
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors"
          >
            {soundOn ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>

          {/* Rules Modal Button */}
          <button
            onClick={onOpenRules}
            title="Come si gioca / Regolamento"
            className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 hover:text-white transition-colors"
          >
            <BookOpen className="w-4 h-4 text-slate-300" />
            <span className="hidden sm:inline font-medium">Regole</span>
          </button>

          {/* Leave room */}
          {roomCode && onLeaveRoom && (
            <button
              onClick={onLeaveRoom}
              title="Esci dalla stanza"
              className="p-2 rounded-lg bg-slate-900 hover:bg-red-950/40 border border-slate-800 hover:border-red-900/50 text-slate-400 hover:text-red-400 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
