import React, { useState } from 'react';
import { ClientGameState, GameSettings } from '../types/game';
import { Share2, Crown, CheckCircle2, Clock, Play, Users, Settings2, ShieldCheck, Flame } from 'lucide-react';
import { ShareModal } from './ShareModal';
import { soundManager } from '../utils/audio';

interface LobbyViewProps {
  gameState: ClientGameState;
  onToggleReady: () => void;
  onUpdateSettings: (settings: Partial<GameSettings>) => void;
  onStartGame: () => void;
}

const TIMER_PRESETS = [
  { label: '3 min', seconds: 180 },
  { label: '5 min', seconds: 300 },
  { label: '7 min (Consigliato)', seconds: 420 },
  { label: '8 min', seconds: 480 },
  { label: '10 min', seconds: 600 }
];

export const LobbyView: React.FC<LobbyViewProps> = ({
  gameState,
  onToggleReady,
  onUpdateSettings,
  onStartGame
}) => {
  const [showShareModal, setShowShareModal] = useState(false);
  const [showHostSettings, setShowHostSettings] = useState(false);

  const isHost = gameState.myId === gameState.hostId;
  const me = gameState.players.find((p) => p.id === gameState.myId);
  const onlinePlayers = gameState.players.filter((p) => p.isOnline);
  const canStart = onlinePlayers.length >= 3;

  const handleCategoryToggle = (category: string) => {
    soundManager.playClick();
    const current = gameState.settings.selectedCategories;
    let next: string[];
    if (current.includes(category)) {
      if (current.length === 1) return; // Keep at least one
      next = current.filter((c) => c !== category);
    } else {
      next = [...current, category];
    }
    onUpdateSettings({ selectedCategories: next });
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6 space-y-6 animate-in fade-in">
      {/* Room Announcement Card */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-center sm:text-left">
          <div className="text-[11px] uppercase tracking-widest text-amber-400 font-mono font-semibold flex items-center justify-center sm:justify-start gap-1.5">
            <span>Quartier Generale Missione</span>
            <span className="text-slate-600">·</span>
            <span>Round {gameState.currentRound}</span>
          </div>
          <div className="flex items-center justify-center sm:justify-start gap-3 mt-1">
            <span className="text-xs text-slate-400">Codice Stanza:</span>
            <span className="text-2xl font-black font-mono tracking-widest text-white">
              {gameState.roomCode}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Condividi questo codice o il link per far entrare i tuoi amici da smartphone o PC.
          </p>
        </div>

        <button
          onClick={() => {
            soundManager.playClick();
            setShowShareModal(true);
          }}
          className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700/90 border border-slate-700 text-slate-200 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm"
        >
          <Share2 className="w-4 h-4 text-amber-400" />
          <span>Invita Amici / QR Code</span>
        </button>
      </div>

      {/* Main Grid: Players List (Left) + Mission Panel (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Players List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                Agenti Connessi ({onlinePlayers.length})
              </h2>
            </div>
            {!canStart && (
              <span className="text-[11px] text-amber-400/90 font-medium">
                (Almeno 3 giocatori per avviare)
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {gameState.players.map((player) => {
              const isCurrent = player.id === gameState.myId;
              const isPlayerHost = player.id === gameState.hostId;

              return (
                <div
                  key={player.id}
                  className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                    isCurrent
                      ? 'bg-slate-900 border-amber-500/50 shadow-md'
                      : 'bg-slate-900/60 border-slate-800'
                  } ${!player.isOnline ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 border border-white/10 shadow-inner"
                      style={{ backgroundColor: `${player.color}25` }}
                    >
                      {player.avatar}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-slate-100 truncate">
                          {player.name}
                        </span>
                        {isPlayerHost && (
                          <span title="Capogruppo (Host)">
                            <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          </span>
                        )}
                        {isCurrent && (
                          <span className="text-[10px] uppercase font-mono px-1 rounded bg-slate-800 text-amber-400 border border-slate-700">
                            Tu
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2">
                        <span>Punti: {player.score}</span>
                        {!player.isOnline && (
                          <span className="text-red-400 font-mono">(Offline)</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    {player.isReady ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 rounded-lg">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Pronto</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-700/60">
                        In attesa
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Toggle Ready Button for current player */}
          <div className="pt-2">
            <button
              onClick={onToggleReady}
              className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 ${
                me?.isReady
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{me?.isReady ? 'Sei Pronto! (Clicca per annullare)' : 'Segna come Pronto'}</span>
            </button>
          </div>
        </div>

        {/* Host Controls & Game Settings */}
        <div className="space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-white font-bold text-sm uppercase tracking-wide">
                <Settings2 className="w-4 h-4 text-amber-400" />
                <span>Parametri Missione</span>
              </div>
              {isHost && (
                <span className="text-[10px] font-mono text-amber-400 font-semibold px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30">
                  Host
                </span>
              )}
            </div>

            {/* Quick Summary / Host Controls */}
            <div className="space-y-4 text-xs">
              {/* Timer Setting */}
              <div>
                <div className="flex items-center justify-between text-slate-300 font-semibold mb-2">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Tempo di Gioco:</span>
                  </span>
                  <span className="font-mono text-amber-400 font-bold">
                    {Math.floor(gameState.settings.roundTimeSeconds / 60)} minuti
                  </span>
                </div>
                {isHost && (
                  <div className="grid grid-cols-2 gap-1.5">
                    {TIMER_PRESETS.map((preset) => (
                      <button
                        key={preset.seconds}
                        onClick={() => {
                          soundManager.playClick();
                          onUpdateSettings({ roundTimeSeconds: preset.seconds });
                        }}
                        className={`py-1.5 px-2 rounded-lg text-[11px] font-medium transition-all ${
                          gameState.settings.roundTimeSeconds === preset.seconds
                            ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                            : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Number of Spies */}
              <div>
                <div className="flex items-center justify-between text-slate-300 font-semibold mb-2">
                  <span className="flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-red-400" />
                    <span>Numero di Spie:</span>
                  </span>
                  <span className="font-mono text-amber-400 font-bold">
                    {gameState.settings.spiesCount} {gameState.settings.spiesCount === 1 ? 'Spia' : 'Spie'}
                  </span>
                </div>
                {isHost && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        soundManager.playClick();
                        onUpdateSettings({ spiesCount: 1 });
                      }}
                      className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                        gameState.settings.spiesCount === 1
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800'
                      }`}
                    >
                      1 Spia (Standard)
                    </button>
                    <button
                      onClick={() => {
                        soundManager.playClick();
                        onUpdateSettings({ spiesCount: 2 });
                      }}
                      className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                        gameState.settings.spiesCount === 2
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800'
                      }`}
                    >
                      2 Spie (6+ Giocatori)
                    </button>
                  </div>
                )}
              </div>

              {/* Roles Enabled */}
              <div>
                <div className="flex items-center justify-between text-slate-300 font-semibold mb-2">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Ruoli Specifici:</span>
                  </span>
                  <span className="font-mono text-slate-200">
                    {gameState.settings.rolesEnabled ? 'Abilitati' : 'Solo Luogo'}
                  </span>
                </div>
                {isHost && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        soundManager.playClick();
                        onUpdateSettings({ rolesEnabled: true });
                      }}
                      className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                        gameState.settings.rolesEnabled
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800'
                      }`}
                    >
                      Con Ruoli
                    </button>
                    <button
                      onClick={() => {
                        soundManager.playClick();
                        onUpdateSettings({ rolesEnabled: false });
                      }}
                      className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                        !gameState.settings.rolesEnabled
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800'
                      }`}
                    >
                      Senza Ruoli
                    </button>
                  </div>
                )}
              </div>

              {/* Category Filters toggle */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowHostSettings(!showHostSettings)}
                  className="w-full flex items-center justify-between py-2 text-slate-400 hover:text-slate-200 font-medium"
                >
                  <span>Pacchetti Luoghi ({gameState.availableLocations.length} attivi)</span>
                  <span className="text-[11px] text-amber-400">
                    {showHostSettings ? 'Chiudi' : 'Mostra'}
                  </span>
                </button>

                {showHostSettings && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-800">
                    {[
                      'Viaggi & Mezzi',
                      'Città & Servizi',
                      'Svago & Locali',
                      'Lavoro & Studio',
                      'Mistero & Avventura'
                    ].map((cat) => {
                      const isSelected = gameState.settings.selectedCategories.includes(cat);
                      return (
                        <button
                          key={cat}
                          disabled={!isHost}
                          onClick={() => handleCategoryToggle(cat)}
                          className={`w-full py-1.5 px-2.5 rounded-lg text-left text-xs flex items-center justify-between transition-colors ${
                            isSelected
                              ? 'bg-slate-800 text-slate-200 font-medium'
                              : 'bg-slate-950/60 text-slate-500 hover:text-slate-400'
                          } ${!isHost ? 'cursor-default' : 'cursor-pointer'}`}
                        >
                          <span>{cat}</span>
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isSelected ? 'bg-amber-400' : 'bg-slate-700'
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Start Game Action */}
            <div className="pt-2">
              {isHost ? (
                <button
                  onClick={onStartGame}
                  disabled={!canStart}
                  className={`w-full py-3.5 px-4 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 ${
                    canStart
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer animate-pulse'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>{canStart ? 'Avvia la Missione' : 'In attesa di 3 giocatori...'}</span>
                </button>
              ) : (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center text-xs text-slate-400">
                  In attesa che il Capogruppo (<strong className="text-slate-200">{gameState.players.find(p => p.id === gameState.hostId)?.name}</strong>) dia il via...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Share Modal Dialog */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        roomCode={gameState.roomCode}
      />
    </div>
  );
};
