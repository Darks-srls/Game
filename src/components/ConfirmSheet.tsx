export interface ConfirmRequest {
  title: string;
  text?: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
}

// Richiesta di conferma: evita che un tocco per sbaglio chiuda il round o faccia uscire
export default function ConfirmSheet({ request, onClose }: { request: ConfirmRequest; onClose: () => void }) {
  return (
    <div className="sheet-backdrop fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="sheet w-full max-w-sm rounded-3xl border-2 border-slate-700 bg-slate-900 p-5 text-center" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-2xl text-white">{request.title}</h3>
        {request.text && <p className="mt-2 font-semibold text-slate-300">{request.text}</p>}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button type="button" onClick={onClose} className="h-14 rounded-2xl bg-slate-800 text-lg font-black text-white">
            Annulla
          </button>
          <button
            type="button"
            onClick={() => {
              request.onConfirm();
              onClose();
            }}
            className={`h-14 rounded-2xl text-lg font-black ${request.danger ? 'bg-red-500 text-white' : 'bg-amber-400 text-slate-950'}`}
          >
            {request.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
