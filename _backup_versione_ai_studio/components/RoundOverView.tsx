import React, { useEffect } from 'react';
import { ClientGameState } from '../types/game';
import confetti from 'canvas-confetti';
import { Trophy, RotateCcw, MapPin, Crown, Award, Play } from 'lucide-react';
import { soundManager } from '../utils/audio';

interface RoundOverViewProps {
  gameState: ClientGameState;
  onNextRound: () => void;
  onResetScores: () => void;
}

export const RoundOverView: React.FC<RoundOverViewProps> = ({
  gameState,
  onNextRound,
  onResetScores
}) => {
  const result = gameState.roundResult;
  const isHost = gameState.myId === gameState.hostId;

  useEffect(() => {
    // Launch celebratory confetti
    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch {
      // ignore
    }
  }, []);

  if (!result) return null;

  const isSpyWin = result.winner === 'SPIES';
  const sortedLeaderboard = [...gameState.players].sort((a, b) => b.score - a.score);

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-8 space-y-6 animate-in fade-in">
      {/* Winner Banner */}
      <div
        className={`p-6 sm:p-8 rounded-3xl border text-center shadow-2xl space-y-3 ${
          isSpyWin
            ? 'bg-gradient-to-b from-red-950/80 via-slate-900 to-slate-950 border-red-600/70 shadow-red-950/50'
            : 'bg-gradient-to-b from-emerald-950/80 via-slate-900 to-slate-950 border-emerald-500/70 shadow-emerald-950/50'
        }`}
      >
        <div className="inline-flex p-4 rounded-3xl bg-slate-950/80 border border-slate-800 text-5xl shadow-lg mb-1">
          {isSpyWin ? '🕵️‍♂️' : '🛡️'}
        </div>

        <div>
          <span
            className={`text-xs font-mono font-bold tracking-widest uppercase block ${
              isSpyWin ? 'text-red-400' : 'text-emerald-400'
            }`}
          >
            Esito della Missione · Round {gameState.currentRound}
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-white uppercase tracking-tight mt-1">
            {isSpyWin ? 'Vittoria delle Spie!' : 'Vittoria degli Agenti!'}
          </h2>
        </div>

        <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
          {result.reason}
        </p>
      </div>

      {/* Secret Location Revealed */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-center sm:text-left">
          <div className="w-14 h-14 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-3xl shrink-0 shadow-inner">
            {result.location.icon}
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400 block">
              Il Luogo Segreto Era:
            </span>
            <h3 className="text-xl font-black text-white">
              {result.location.name}
            </h3>
            <span className="text-xs text-slate-400 flex items-center justify-center sm:justify-start gap-1 mt-0.5">
              <MapPin className="w-3.5 h-3.5 text-slate-500" />
              <span>{result.location.category}</span>
            </span>
          </div>
        </div>

        <div className="text-xs text-slate-400 max-w-xs text-center sm:text-right italic">
          &quot;{result.location.description}&quot;
        </div>
      </div>

      {/* Players Roles & Revelations */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center gap-2 text-white font-bold text-sm uppercase tracking-wide">
          <Award className="w-4 h-4 text-amber-400" />
          <span>Fascicoli Desecretati (Tutti i Ruoli)</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {result.playerRoles.map((pr) => {
            const player = gameState.players.find(p => p.id === pr.playerId);
            const points = result.pointsAwarded[pr.playerId] || 0;

            return (
              <div
                key={pr.playerId}
                className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                  pr.isSpy
                    ? 'bg-red-950/30 border-red-700/60'
                    : 'bg-slate-950 border-slate-800'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 border border-white/10"
                    style={{ backgroundColor: `${player?.color || '#3b82f6'}25` }}
                  >
                    {player?.avatar || '👤'}
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold text-xs text-white truncate block">
                      {pr.name}
                    </span>
                    <span
                      className={`text-[11px] font-medium block truncate ${
                        pr.isSpy ? 'text-red-400 font-bold' : 'text-slate-400'
                      }`}
                    >
                      {pr.isSpy ? '🕵️‍♂️ LA SPIA' : pr.role}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[10px] text-slate-500 block">Punti</span>
                  <span className="text-xs font-mono font-bold text-amber-400">
                    +{points}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* General Leaderboard */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white font-bold text-sm uppercase tracking-wide">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span>Classifica Generale Stanza</span>
          </div>
          {isHost && (
            <button
              onClick={() => {
                if (confirm('Vuoi davvero azzerare i punteggi di tutti i giocatori?')) {
                  soundManager.playClick();
                  onResetScores();
                }
              }}
              className="text-xs text-slate-500 hover:text-red-400 flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Azzera Punteggi</span>
            </button>
          )}
        </div>

        <div className="space-y-2">
          {sortedLeaderboard.map((player, idx) => (
            <div
              key={player.id}
              className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-3">
                <span className="w-5 text-center font-mono font-bold text-slate-500">
                  #{idx + 1}
                </span>
                <span className="text-lg">{player.avatar}</span>
                <span className="font-bold text-white">{player.name}</span>
                {idx === 0 && <Crown className="w-3.5 h-3.5 text-amber-400" />}
              </div>
              <div className="font-mono text-sm font-black text-amber-400">
                {player.score} pt
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Host Action: Next Round */}
      <div className="pt-2">
        {isHost ? (
          <button
            onClick={onNextRound}
            className="w-full py-4 px-6 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-2xl active:scale-95 transition-all cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Inizia Prossimo Round!</span>
          </button>
        ) : (
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center text-xs text-slate-400">
            In attesa che il Capogruppo (<strong className="text-white">{gameState.players.find(p => p.id === gameState.hostId)?.name}</strong>) avvii il prossimo round...
          </div>
        )}
      </div>
    </div>
  );
};
