import { useState, type ReactNode } from 'react';
import { ChevronDown, Flag } from 'lucide-react';
import type { ClientGameState } from '../types/game';
import { useCountdown } from '../hooks/useCountdown';
import { TimerRing } from './fx';
import { Art, Avatar, BottomBar, LocationArt } from './ui';

interface GameViewProps {
  state: ClientGameState;
  clockOffset: number;
  onToggleConfirm: () => void;
  onForceEnd: () => void;
}

// Round della Spia e dell'Impostore: carta segreta, poi tutto a voce e conferma finale
export default function GameView({ state, clockOffset, onToggleConfirm, onForceEnd }: GameViewProps) {
  const [open, setOpen] = useState(false);
  const [showList, setShowList] = useState(false);
  const [crossed, setCrossed] = useState<string[]>([]);
  const left = useCountdown(state.timerEndsAt, clockOffset);

  const impostore = state.settings.game === 'IMPOSTORE';
  const me = state.players.find((p) => p.id === state.myId);
  const inRound = state.players.filter((p) => p.inRound);
  const confirmedCount = inRound.filter((p) => p.confirmed).length;
  const waiting = inRound.filter((p) => p.isOnline && !p.confirmed);
  const starter = state.players.find((p) => p.id === state.startingPlayerId);
  const host = state.players.find((p) => p.id === state.hostId);
  const canForce = state.myId === state.hostId || !host?.isOnline;
  const loc = state.location;
  const many = state.spiesInRound > 1;
  const clock = left === null ? '∞' : left === 0 ? 'Tempo!' : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  const toggleCard = () => setOpen((o) => !o);

  // Tutte le carte hanno lo stesso sfondo e gli stessi colori: dal vivo, da lontano, non si capisce chi è la spia
  let secret: ReactNode = null;
  if (state.isSpy) {
    secret = (
      <div className="relative h-full bg-linear-to-br from-cyan-500 via-slate-700 to-slate-950">
        <Art
          src={impostore ? '/art/carta-impostore.webp' : '/art/carta-spia.webp'}
          fallback={<span className="absolute inset-0 grid place-items-center pb-20 text-7xl">{impostore ? '🎭' : '🕵️‍♂️'}</span>}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-slate-950 via-slate-950/85 to-transparent p-4 pt-14 text-center">
          <p className="text-4xl font-black text-white">{impostore ? "Sei l'impostore!" : 'Sei la spia!'}</p>
          <p className="text-sm font-bold text-slate-100">
            {impostore ? 'Non conosci la parola: ascolta gli altri e mimetizzati.' : 'Non conosci il luogo: ascolta, bluffa e cerca di capirlo.'}
          </p>
          {many && <p className="mt-1 text-xs font-bold text-white/90">Siete in {state.spiesInRound}, ma non sapete chi sono gli altri</p>}
        </div>
      </div>
    );
  } else if (impostore) {
    secret = (
      <div className="flex h-full flex-col items-center justify-center gap-2 bg-linear-to-br from-cyan-500 via-slate-700 to-slate-950 p-6 text-center">
        <p className="text-xs font-black uppercase tracking-widest text-amber-300">La tua parola</p>
        <p className="text-5xl font-black leading-tight text-white [overflow-wrap:anywhere]">{state.myRole}</p>
        <p className="mt-2 text-sm font-bold text-slate-100">
          {state.settings.impostorWord ? 'Attenti: qualcuno ha una parola diversa… e magari non lo sa!' : "Attenti: l'impostore non conosce la parola!"}
        </p>
      </div>
    );
  } else if (loc) {
    secret = (
      <div className="relative h-full">
        <LocationArt id={loc.id} icon={loc.icon} className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-slate-950 via-slate-950/85 to-transparent p-4 pt-14">
          <p className="text-xs font-black uppercase tracking-widest text-amber-300">Il luogo è</p>
          <p className="text-3xl font-black leading-tight text-white">
            {loc.icon} {loc.name}
          </p>
          {state.settings.rolesEnabled && (
            <p className="mt-1 text-base font-bold text-slate-100">
              Il tuo ruolo: <span className="text-amber-300">{state.myRole}</span>
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="stagger flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-slate-900 px-3 py-1 text-sm font-black text-slate-100">
          {impostore ? '🎭' : '🕵️'} Round {state.currentRound}
          {many ? ` · ${state.spiesInRound} ${impostore ? 'impostori' : 'spie'}` : ''}
        </span>
        {left === 0 ? (
          <span className="animate-pulse rounded-2xl bg-red-500 px-4 py-1 text-2xl font-black text-white">{clock}</span>
        ) : (
          <TimerRing left={left} total={state.settings.roundTimeSeconds} size={60} />
        )}
      </div>

      {state.inRound ? (
        <div
          role="button"
          tabIndex={0}
          onClick={toggleCard}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleCard()}
          aria-label={open ? 'Nascondi la tua carta' : 'Mostra la tua carta'}
          className={`flip relative h-72 w-full cursor-pointer select-none ${open ? 'open' : ''}`}
        >
          <div className="flip-inner relative h-full w-full">
            <div className="flip-face overflow-hidden rounded-3xl border-4 border-white/80 bg-linear-to-br from-amber-400 to-red-500 shadow-[0_8px_0_rgba(22,6,72,0.5)]">
              <Art
                src="/art/carta-coperta.webp"
                fallback={<span className="absolute inset-0 grid place-items-center pb-16 text-7xl drop-shadow-lg">{impostore ? '🎭' : '🕵️‍♂️'}</span>}
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="shine absolute inset-0" />
              <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/60 to-transparent p-5 pt-12 text-center">
                <span className="tap-hint mb-1 inline-block text-4xl">👆</span>
                <p className="text-3xl font-black text-white [text-shadow:0_3px_0_rgba(0,0,0,0.25)]">Tocca per vedere</p>
                <p className="text-sm font-bold text-white/90">{impostore ? 'la tua parola segreta' : 'il tuo ruolo segreto'}</p>
              </div>
            </div>
            <div className="flip-face flip-back overflow-hidden rounded-3xl border-4 border-white/80 shadow-[0_8px_0_rgba(22,6,72,0.5)]">{secret}</div>
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border-2 border-slate-700 bg-slate-900 p-6 text-center">
          <p className="text-4xl">🍿</p>
          <p className="mt-2 text-xl font-black text-white">Round già iniziato</p>
          <p className="text-sm font-semibold text-slate-400">Guardi questo round ed entri dal prossimo.</p>
        </div>
      )}

      {starter && (
        <div className="flex items-center gap-3 rounded-2xl border-2 border-slate-700 bg-slate-900 p-3">
          <Avatar avatar={starter.avatar} color={starter.color} size={40} />
          <p className="text-sm font-bold text-slate-300">
            {impostore ? 'Inizia a dire una parola' : 'Inizia a fare domande'}
            <br />
            <span className="text-lg font-black text-white">
              {starter.name}
              {starter.id === state.myId ? ' (tu)' : ''}
            </span>
          </p>
        </div>
      )}

      <section className="rounded-3xl border-2 border-slate-700 bg-slate-900 p-4">
        <p className="mb-3 text-sm font-bold text-slate-300">
          {impostore
            ? 'A turno dite una parola che ricordi la vostra (senza dirla!). Poi votate a voce chi è l’impostore e premete tutti '
            : 'Domande e voti a voce. Quando avete deciso chi è la spia, premete tutti '}
          <span className="text-emerald-300">Conferma</span> per svelare.
        </p>
        <div className="flex flex-wrap gap-2">
          {inRound.map((p) => (
            <span
              key={p.id}
              className={`flex items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-sm font-bold ${p.confirmed ? 'bg-emerald-500/25 text-emerald-100' : 'bg-slate-800 text-slate-300'} ${p.isOnline ? '' : 'opacity-50'}`}
            >
              <Avatar avatar={p.avatar} color={p.color} size={26} />
              {p.name}
              {p.confirmed ? ' ✓' : ''}
            </span>
          ))}
        </div>
      </section>

      {!impostore && (
        <section className="rounded-3xl border-2 border-slate-700 bg-slate-900">
          <button type="button" onClick={() => setShowList((v) => !v)} className="flex w-full items-center justify-between p-4 text-left font-black text-white">
            Luoghi possibili ({state.availableLocations.length})
            <ChevronDown className={`transition-transform ${showList ? 'rotate-180' : ''}`} />
          </button>
          {showList && (
            <div className="grid grid-cols-2 gap-1.5 px-3 pb-4">
              {state.availableLocations.map((l) => {
                const off = crossed.includes(l.id);
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setCrossed((c) => (off ? c.filter((x) => x !== l.id) : [...c, l.id]))}
                    className={`truncate rounded-xl px-2 py-1.5 text-left text-sm font-semibold ${off ? 'bg-slate-950/60 text-slate-500 line-through' : 'bg-slate-800 text-slate-100'}`}
                  >
                    {l.icon} {l.name}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      <BottomBar>
        {state.inRound && (
          <button
            type="button"
            onClick={onToggleConfirm}
            className={`flex h-16 flex-col items-center justify-center rounded-2xl ${me?.confirmed ? 'border-2 border-emerald-400 bg-slate-900 text-emerald-300' : 'bg-emerald-500 text-white'}`}
          >
            <span className="text-xl font-black">{me?.confirmed ? 'Confermato ✓' : 'Conferma'}</span>
            <span className="text-xs font-bold opacity-90">
              {confirmedCount}/{inRound.length} pronti{me?.confirmed ? ' · tocca per annullare' : impostore ? " a svelare l'impostore" : ' a svelare la spia'}
            </span>
          </button>
        )}
        <div className="flex items-center justify-between gap-3 px-1 text-xs font-bold text-slate-200">
          <span className="truncate">{waiting.length ? `Aspettiamo: ${waiting.map((p) => p.name).join(', ')}` : 'Tutti pronti!'}</span>
          {canForce && (
            <button type="button" onClick={onForceEnd} className="flex shrink-0 items-center gap-1 rounded-full bg-slate-900/95 px-3 py-1.5 text-red-300">
              <Flag size={14} /> Fine forzata
            </button>
          )}
        </div>
      </BottomBar>
    </div>
  );
}
