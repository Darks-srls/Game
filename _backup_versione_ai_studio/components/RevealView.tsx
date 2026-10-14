import React, { useState } from 'react';
import { ClientGameState } from '../types/game';
import { Eye, EyeOff, ShieldAlert, Sparkles, MapPin, Play, UserCheck, HelpCircle } from 'lucide-react';
import { soundManager } from '../utils/audio';

interface RevealViewProps {
  gameState: ClientGameState;
  onStartInterrogation: () => void;
}

export const RevealView: React.FC<RevealViewProps> = ({
  gameState,
  onStartInterrogation
}) => {
  const [isRevealed, setIsRevealed] = useState(false);
  const isHost = gameState.myId === gameState.hostId;
  const isSpy = gameState.isSpy;
  const location = gameState.location;
  const startingPlayer = gameState.players.find(p => p.id === gameState.startingPlayerId);

  const toggleReveal = () => {
    soundManager.playClick();
    setIsRevealed(!isRevealed);
  };

  return (
    <div className="w-full max-w-lg mx-auto px-4 py-6 space-y-6 animate-in fade-in">
      {/* Top Banner Notice */}
      <div className="text-center space-y-1">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-[11px] font-bold uppercase tracking-widest">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Fascicolo Top Secret · Round {gameState.currentRound}</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
          La Tua Identità Segreta
        </h2>
        <p className="text-xs text-slate-400 max-w-xs mx-auto">
          Attenzione a occhi indiscreti! Mostra la carta solo quando sei al sicuro.
        </p>
      </div>

      {/* Secret Identity Card */}
      <div
        className={`relative overflow-hidden rounded-3xl border transition-all duration-300 shadow-2xl ${
          isRevealed
            ? isSpy
              ? 'bg-gradient-to-b from-red-950/80 via-slate-900 to-slate-950 border-red-700/80 ring-2 ring-red-500/30 shadow-red-950/50'
              : 'bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-cyan-500/50 ring-2 ring-cyan-500/20 shadow-cyan-950/40'
            : 'bg-slate-900/90 border-slate-700/80 hover:border-slate-600'
        }`}
      >
        {/* Anti-shoulder-peek Cover (When NOT revealed) */}
        {!isRevealed ? (
          <div className="p-8 text-center space-y-6 flex flex-col items-center justify-center min-h-[340px]">
            <div className="w-20 h-20 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-4xl shadow-inner animate-bounce">
              🔒
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-black uppercase tracking-wider text-slate-100">
                Carta Segreta Coperta
              </h3>
              <p className="text-xs text-slate-400 max-w-xs">
                Nessuno può vedere il tuo schermo? Clicca o tieni premuto per scoprire chi sei in questa missione.
              </p>
            </div>

            <button
              type="button"
              onClick={toggleReveal}
              className="py-3 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg active:scale-95 transition-all cursor-pointer"
            >
              <Eye className="w-4 h-4" />
              <span>Svela la mia Identità</span>
            </button>
          </div>
        ) : (
          /* Card Revealed Content */
          <div className="p-6 sm:p-8 space-y-6">
            {/* Header of card */}
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono uppercase tracking-widest text-slate-400">
                  Documento di Riconoscimento
                </span>
              </div>
              <button
                type="button"
                onClick={toggleReveal}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-medium"
              >
                <EyeOff className="w-4 h-4" />
                <span>Copri</span>
              </button>
            </div>

            {/* If SPY */}
            {isSpy ? (
              <div className="space-y-5 text-center">
                <div className="inline-block p-4 rounded-3xl bg-red-600/20 border-2 border-red-500 text-5xl shadow-lg animate-pulse">
                  🕵️‍♂️
                </div>

                <div className="space-y-1">
                  <span className="text-xs font-mono font-bold tracking-widest uppercase text-red-400">
                    Missione di Infiltrazione
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-black text-red-500 tracking-tight uppercase">
                    SEI LA SPIA!
                  </h3>
                </div>

                <div className="p-4 rounded-2xl bg-red-950/40 border border-red-900/60 text-xs text-red-200 text-left space-y-2">
                  <div className="font-bold flex items-center gap-1.5 text-red-300">
                    <ShieldAlert className="w-4 h-4 text-red-400" />
                    <span>I Tuoi Obiettivi da Infiltrato:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1.5 text-[11px] text-red-200/90 pl-1">
                    <li>
                      <strong>Non conosci il luogo segreto!</strong> Gli altri giocatori si trovano tutti nello stesso posto.
                    </li>
                    <li>
                      Ascolta le loro risposte per capire dove si trovano senza farti scoprire.
                    </li>
                    <li>
                      Rispondi con diplomazia quando ti interrogano: mantieniti sul vago ma credibile!
                    </li>
                    <li>
                      Se capisci il posto, puoi cliccare &quot;Sono la Spia&quot; e indovinarlo per vincere!
                    </li>
                  </ul>
                </div>
              </div>
            ) : (
              /* If INNOCENT CITIZEN */
              <div className="space-y-5 text-center">
                <div className="inline-block p-4 rounded-3xl bg-cyan-500/10 border-2 border-cyan-500/40 text-5xl shadow-lg">
                  {location?.icon || '🏢'}
                </div>

                <div className="space-y-1">
                  <span className="text-xs font-mono font-semibold tracking-wider text-cyan-400 uppercase">
                    Luogo della Missione
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    {location?.name}
                  </h3>
                  <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{location?.category}</span>
                  </div>
                </div>

                {/* Role Briefing */}
                {gameState.settings.rolesEnabled && gameState.myRole && (
                  <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block mb-0.5">
                      Il Tuo Ruolo
                    </span>
                    <strong className="text-base text-amber-400 font-extrabold tracking-wide">
                      {gameState.myRole}
                    </strong>
                  </div>
                )}

                <div className="p-4 rounded-2xl bg-cyan-950/20 border border-cyan-900/40 text-xs text-slate-300 text-left space-y-1.5">
                  <div className="font-bold flex items-center gap-1.5 text-cyan-300">
                    <UserCheck className="w-4 h-4 text-cyan-400" />
                    <span>Consiglio per gli Agenti:</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Fai domande pertinenti ma allusive sul <strong>{location?.name}</strong>. Se le tue domande sono troppo esplicite, la spia capirà il luogo! Se sono troppo vaghe, non troverete la spia.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Starting Question Announce */}
      {startingPlayer && (
        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-xl shrink-0">
            {startingPlayer.avatar}
          </div>
          <div className="text-xs">
            <span className="text-slate-400 block">Prima domanda assegnata a:</span>
            <strong className="text-sm text-white font-bold">
              {startingPlayer.name} {startingPlayer.id === gameState.myId ? '(Tu!)' : ''}
            </strong>
          </div>
        </div>
      )}

      {/* Start interrogation action */}
      <div className="pt-2">
        {isHost ? (
          <button
            onClick={onStartInterrogation}
            className="w-full py-3.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-xl active:scale-95 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Tutti Pronti! Avvia Interrogatorio & Timer</span>
          </button>
        ) : (
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <HelpCircle className="w-4 h-4 text-amber-400" />
            <span>Memorizza il tuo ruolo! Il Capogruppo avvierà a breve il timer...</span>
          </div>
        )}
      </div>
    </div>
  );
};
