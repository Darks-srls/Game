import React from 'react';
import { X, Shield, Eye, HelpCircle, Trophy, Lightbulb, Users } from 'lucide-react';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-6 text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-lg">
              📜
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide">
                Regolamento: Il Gioco della Spia (Spyfall)
              </h2>
              <p className="text-xs text-slate-400">
                Regole semplici, bluff estremo e deduzione
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="mt-5 space-y-6 text-sm leading-relaxed text-slate-300">
          {/* Obiettivo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-cyan-400 font-semibold">
                <Shield className="w-4 h-4" />
                <span>Gli Agenti / Cittadini</span>
              </div>
              <p className="text-xs text-slate-300">
                Conoscono tutti lo stesso <strong>Luogo Segreto</strong> (es. <em>Sottomarino</em> o <em>Ristorante Stellato</em>) e il proprio ruolo.
              </p>
              <p className="text-xs text-emerald-400 font-medium">
                🎯 <strong>Scopo:</strong> Smascherare la Spia attraverso domande e risposte allusive senza farsi capire dalla Spia!
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-red-900/40 space-y-2">
              <div className="flex items-center gap-2 text-red-400 font-semibold">
                <Eye className="w-4 h-4" />
                <span>La Spia (Infiltrato)</span>
              </div>
              <p className="text-xs text-slate-300">
                <strong>NON CONOSCE</strong> il luogo! Deve ascoltare le risposte altrui, bluffare e fingere di essere un comune cittadino.
              </p>
              <p className="text-xs text-amber-400 font-medium">
                🎯 <strong>Scopo:</strong> Rimanere anonima fino alla fine oppure indovinare il luogo esatto!
              </p>
            </div>
          </div>

          {/* Come si svolge il round */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-base font-bold text-white">
              <HelpCircle className="w-4 h-4 text-amber-400" />
              <span>Come si svolge l&apos;Interrogatorio</span>
            </div>
            <ol className="list-decimal list-inside space-y-2 text-xs text-slate-300 pl-1">
              <li>
                <strong>Prima Domanda:</strong> Il sistema seleziona casualmente chi fa la prima domanda. Il Giocatore A pone una domanda a voce al Giocatore B (es. &quot;<em>Che tipo di vestiti si indossano qui?</em>&quot;).
              </li>
              <li>
                <strong>Risposta & Giro:</strong> Il Giocatore B risponde a parole sue. Poi il Giocatore B deve fare una nuova domanda a un altro giocatore a scelta (non può rifarla subito a chi l&apos;ha appena interrogato).
              </li>
              <li>
                <strong>Nessun Ordine Fisso:</strong> Le domande possono andare a chiunque, coinvolgendo tutti i partecipanti.
              </li>
            </ol>
          </div>

          {/* Esempi pratici */}
          <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-2.5">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
              <Lightbulb className="w-4 h-4" />
              <span>Consigli per domande e risposte</span>
            </div>
            <div className="space-y-1.5 text-xs text-slate-300">
              <p>
                ❌ <strong>Troppo scontata:</strong> &quot;C&apos;è l&apos;acqua e siamo sott&apos;acqua?&quot; (La Spia capisce subito che è un sottomarino!).
              </p>
              <p>
                ❌ <strong>Troppo vaga:</strong> &quot;Ti piace stare qui?&quot; (Non dà alcun indizio su chi sta bluffando).
              </p>
              <p>
                ✅ <strong>Perfetta:</strong> &quot;È un posto rumoroso o bisogna stare in silenzio?&quot; oppure &quot;Serve un biglietto o un permesso speciale per entrare?&quot;
              </p>
            </div>
          </div>

          {/* Accusa e Vittoria */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-base font-bold text-white">
              <Trophy className="w-4 h-4 text-emerald-400" />
              <span>Come si Vince</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="font-bold text-emerald-400 block mb-1">Vittoria dei Cittadini:</span>
                I giocatori votano a maggioranza la Spia e la accusano con successo, e la Spia non riesce a indovinare il luogo (+1 o +2 punti).
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="font-bold text-red-400 block mb-1">Vittoria della Spia:</span>
                La Spia indovina il luogo segreto, oppure i cittadini accusano ingiustamente un loro compagno innocente (+3 punti).
              </div>
            </div>
          </div>

          {/* Giocare online */}
          <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/60 flex items-start gap-2.5 text-xs text-slate-400">
            <Users className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-200">Come giocare con gli amici:</strong> Condividi il link o il codice stanza su WhatsApp/Discord o fai scannerizzare il QR Code. Ognuno gioca dal proprio smartphone o PC parlandosi a voce o in chat!
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-colors shadow-lg active:scale-95"
          >
            Ho capito, andiamo!
          </button>
        </div>
      </div>
    </div>
  );
};
