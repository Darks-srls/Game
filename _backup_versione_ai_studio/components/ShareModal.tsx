import React, { useState } from 'react';
import { X, Copy, Check, Share2, Smartphone } from 'lucide-react';
import { soundManager } from '../utils/audio';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomCode: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, roomCode }) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  if (!isOpen) return null;

  const shareUrl = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&color=f8fafc&bgcolor=090d16&margin=1&data=${encodeURIComponent(
    shareUrl
  )}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    soundManager.playClick();
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopiedCode(true);
    soundManager.playClick();
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleNativeShare = () => {
    if (navigator.share) {
      navigator
        .share({
          title: 'Unisciti alla partita a Il Gioco della Spia!',
          text: `Entra nella mia stanza di Spyfall con il codice ${roomCode}!`,
          url: shareUrl
        })
        .catch(() => {});
    } else {
      handleCopyLink();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-sm bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-6 text-slate-200 text-center">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="inline-flex p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mb-3">
          <Smartphone className="w-6 h-6" />
        </div>

        <h3 className="text-lg font-bold text-white tracking-wide">
          Invita i tuoi Amici
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          Scansiona il QR Code o invia il link per giocare tutti insieme
        </p>

        {/* QR Code */}
        <div className="my-5 p-3.5 bg-slate-950 border border-slate-800 rounded-xl inline-block shadow-inner">
          <img
            src={qrUrl}
            alt={`QR Code stanza ${roomCode}`}
            className="w-44 h-44 rounded-lg mx-auto"
            loading="lazy"
          />
          <div className="mt-2 text-xs font-mono text-slate-400">
            Inquadra con la fotocamera
          </div>
        </div>

        {/* Room Code highlight */}
        <div className="mb-4 p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center justify-between">
          <div className="text-left">
            <div className="text-[10px] uppercase font-mono text-slate-400 font-semibold">
              Codice Stanza
            </div>
            <div className="text-xl font-black tracking-widest text-amber-400 font-mono">
              {roomCode}
            </div>
          </div>
          <button
            onClick={handleCopyCode}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1.5 transition-all active:scale-95"
          >
            {copiedCode ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copiato!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Copia</span>
              </>
            )}
          </button>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <button
            onClick={handleCopyLink}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-100 flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            {copiedLink ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400">Link stanza copiato!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-slate-400" />
                <span>Copia Link Invito Diretto</span>
              </>
            )}
          </button>

          <button
            onClick={handleNativeShare}
            className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
          >
            <Share2 className="w-4 h-4" />
            <span>Condividi su WhatsApp / Telegram</span>
          </button>
        </div>
      </div>
    </div>
  );
};
