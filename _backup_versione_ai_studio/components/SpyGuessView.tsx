import React, { useState } from 'react';
import { ClientGameState, LocationItem } from '../types/game';
import { Target, Search, Check, AlertCircle } from 'lucide-react';
import { soundManager } from '../utils/audio';

interface SpyGuessViewProps {
  gameState: ClientGameState;
  onSubmitSpyGuess: (locationId: string) => void;
}

export const SpyGuessView: React.FC<SpyGuessViewProps> = ({
  gameState,
  onSubmitSpyGuess
}) => {
  const [selectedLocation, setSelectedLocation] = useState<LocationItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const spyGuess = gameState.spyGuess;
  const isMeTheSpy = spyGuess ? gameState.myId === spyGuess.spyId : false;
  const spyPlayer = gameState.players.find(p => p.id === spyGuess?.spyId);

  const filteredLocations = gameState.availableLocations.filter(loc =>
    loc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    loc.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleConfirmGuess = () => {
    if (!selectedLocation) return;
    soundManager.playClick();
    onSubmitSpyGuess(selectedLocation.id);
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8 space-y-6 animate-in fade-in">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-3xl text-amber-400">
          <Target className="w-8 h-8" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
          {isMeTheSpy ? 'Ultima Chance: Indovina il Luogo!' : 'Momento della Verità!'}
        </h2>
        <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
          {isMeTheSpy
            ? 'Sei la Spia! Seleziona il luogo segreto esatto: se indovini, rubi la vittoria agli agenti!'
            : `La Spia (${spyPlayer?.name}) sta tentando la fuga cercando di indovinare dove vi trovate...`}
        </p>
      </div>

      {isMeTheSpy ? (
        /* The Spy's Guessing Grid */
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5">
          {/* Search bar & Selection status */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtra i luoghi possibili..."
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            {selectedLocation && (
              <div className="flex items-center gap-2 p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300">
                <span>Scelto:</span>
                <strong className="text-white font-bold">{selectedLocation.name}</strong>
              </div>
            )}
          </div>

          {/* Location choices */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[50vh] overflow-y-auto pr-1">
            {filteredLocations.map((loc) => {
              const isSelected = selectedLocation?.id === loc.id;
              return (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => {
                    soundManager.playClick();
                    setSelectedLocation(loc);
                  }}
                  className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500/20 border-amber-400 ring-2 ring-amber-400/50 shadow-lg scale-102'
                      : 'bg-slate-950 hover:bg-slate-800 border-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <span className="text-3xl">{loc.icon}</span>
                    {isSelected && (
                      <span className="p-1 rounded-full bg-amber-400 text-slate-950">
                        <Check className="w-3.5 h-3.5 font-bold" />
                      </span>
                    )}
                  </div>
                  <div className="mt-3">
                    <span className="text-xs font-bold text-white block leading-tight">
                      {loc.name}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      {loc.category}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Confirmation button */}
          <div className="pt-3 border-t border-slate-800 flex justify-end">
            <button
              type="button"
              disabled={!selectedLocation}
              onClick={handleConfirmGuess}
              className={`w-full sm:w-auto px-8 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-xl ${
                selectedLocation
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer active:scale-95'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              {selectedLocation
                ? `Punta Tutto su: ${selectedLocation.name}!`
                : 'Seleziona un luogo per confermare'}
            </button>
          </div>
        </div>
      ) : (
        /* Non-spies waiting state */
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 text-center shadow-2xl space-y-6">
          <div className="w-20 h-20 rounded-2xl bg-slate-950 border border-slate-800 mx-auto flex items-center justify-center text-4xl shadow-inner animate-pulse">
            ⏳
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-black uppercase tracking-wider text-slate-100">
              La Spia sta consultando la mappa...
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Se <strong className="text-amber-400">{spyPlayer?.name}</strong> individua il luogo, vince la partita. Altrimenti la vittoria andrà agli agenti leali!
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 inline-flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            <span>In attesa del verdetto finale...</span>
          </div>
        </div>
      )}
    </div>
  );
};
