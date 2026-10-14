import React from 'react';
import { ClientGameState } from '../types/game';
import { AlertTriangle, ShieldCheck, ShieldAlert, CheckCircle2, XCircle } from 'lucide-react';
import { soundManager } from '../utils/audio';

interface AccusationViewProps {
  gameState: ClientGameState;
  onCastVote: (isGuilty: boolean) => void;
  onCancelAccusation: () => void;
}

export const AccusationView: React.FC<AccusationViewProps> = ({
  gameState,
  onCastVote,
  onCancelAccusation
}) => {
  const accusation = gameState.accusation;
  if (!accusation) return null;

  const accuser = gameState.players.find(p => p.id === accusation.accuserId);
  const accused = gameState.players.find(p => p.id === accusation.accusedId);
  const isMeAccused = gameState.myId === accusation.accusedId;
  const isMeAccuser = gameState.myId === accusation.accuserId;
  const isHost = gameState.myId === gameState.hostId;

  // Eligible voters (everyone online except the accused)
  const eligibleVoters = gameState.players.filter(p => p.isOnline && p.id !== accusation.accusedId);
  const myVote = accusation.votes[gameState.myId];
  const hasVoted = myVote !== undefined;

  const votesCount = Object.keys(accusation.votes).length;
  const progressPercent = Math.round((votesCount / Math.max(1, eligibleVoters.length)) * 100);

  const handleVote = (isGuilty: boolean) => {
    soundManager.playClick();
    onCastVote(isGuilty);
  };

  return (
    <div className="w-full max-w-lg mx-auto px-4 py-8 space-y-6 animate-in fade-in">
      {/* Red Alert Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex p-3 rounded-2xl bg-red-600/20 border-2 border-red-500/60 text-red-500 text-3xl shadow-inner animate-pulse">
          🚨
        </div>
        <div className="inline-block px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 font-mono text-[11px] font-bold uppercase tracking-widest block">
          Tribunale di Guerra · Processo Sommari
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
          Accusa di Spionaggio!
        </h2>
      </div>

      {/* Main Accusation Box */}
      <div className="bg-slate-900 border-2 border-red-800/80 rounded-3xl p-6 shadow-2xl space-y-6">
        {/* Accused Showcase */}
        <div className="text-center space-y-3 p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
          <span className="text-[11px] uppercase font-mono tracking-widest text-slate-400">
            L&apos;Accusatore <strong className="text-amber-400">{accuser?.name}</strong> punta il dito contro:
          </span>

          <div className="flex items-center justify-center gap-3 py-2">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl border-2 border-red-500/50 shadow-lg"
              style={{ backgroundColor: `${accused?.color}30` }}
            >
              {accused?.avatar}
            </div>
            <div className="text-left">
              <h3 className="text-2xl font-black text-white tracking-wide">
                {accused?.name}
              </h3>
              <span className="text-xs font-mono font-bold text-red-400 uppercase tracking-widest">
                Sospettato Numero Uno
              </span>
            </div>
          </div>

          {isMeAccused ? (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-900/60 text-xs text-red-300">
              ⚠️ <strong>Sei tu il sospettato!</strong> Difenditi a voce! Non puoi votare nel tuo processo.
            </div>
          ) : (
            <p className="text-xs text-slate-300">
              Credi che <strong className="text-white">{accused?.name}</strong> sia la Spia?
            </p>
          )}
        </div>

        {/* Voting options for eligible players */}
        {!isMeAccused && (
          <div className="space-y-3">
            <div className="text-center text-xs font-bold uppercase tracking-wider text-slate-400">
              {hasVoted ? 'Hai espresso il tuo verdetto:' : 'Seleziona il tuo Voto:'}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleVote(true)}
                className={`py-4 px-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  myVote === true
                    ? 'bg-red-600 border-red-400 text-white font-black shadow-lg shadow-red-900/40 ring-2 ring-red-400'
                    : 'bg-slate-950 hover:bg-slate-800/90 border-slate-800 text-slate-300'
                }`}
              >
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <span className="text-xs font-black uppercase tracking-wider">È LA SPIA!</span>
                <span className="text-[10px] text-slate-400">(Colpevole)</span>
              </button>

              <button
                type="button"
                onClick={() => handleVote(false)}
                className={`py-4 px-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  myVote === false
                    ? 'bg-emerald-600 border-emerald-400 text-white font-black shadow-lg shadow-emerald-900/40 ring-2 ring-emerald-400'
                    : 'bg-slate-950 hover:bg-slate-800/90 border-slate-800 text-slate-300'
                }`}
              >
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <span className="text-xs font-black uppercase tracking-wider">È INNOCENTE</span>
                <span className="text-[10px] text-slate-400">(Agente leale)</span>
              </button>
            </div>
          </div>
        )}

        {/* Live Voting Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-400">Verdetto della Giuria:</span>
            <span className="font-mono text-amber-400">
              {votesCount} / {eligibleVoters.length} Voti registrati
            </span>
          </div>

          <div className="w-full h-2.5 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* List of who voted */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {eligibleVoters.map((p) => {
              const voted = accusation.votes[p.id] !== undefined;
              return (
                <span
                  key={p.id}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono ${
                    voted
                      ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                      : 'bg-slate-950 border border-slate-800 text-slate-500'
                  }`}
                >
                  {voted ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                  <span>{p.name}</span>
                </span>
              );
            })}
          </div>
        </div>

        {/* Option to cancel accusation (only for accuser or host) */}
        {(isMeAccuser || isHost) && (
          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={onCancelAccusation}
              className="text-xs text-slate-400 hover:text-white underline transition-colors cursor-pointer"
            >
              Ritira accusa e riprendi l&apos;interrogatorio
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
