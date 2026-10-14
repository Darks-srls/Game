import { useEffect, useRef, type Ref } from 'react';
import { Settings } from 'lucide-react';
import type { ClientGameState, TelChain, TelEntry, TelPerson } from '../types/game';
import { soundManager } from '../utils/audio';
import { Avatar, BottomBar } from './ui';

interface AlbumViewProps {
  state: ClientGameState;
  onNext: () => void;
  onNewGame: () => void;
  onBackToLobby: () => void;
}

function Chain({ chain, people, lastRef }: { chain: TelChain; people: Map<string, TelPerson>; lastRef?: Ref<HTMLDivElement> }) {
  const owner = people.get(chain.ownerId);
  const entries = chain.entries.filter((e): e is TelEntry => e !== null);
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-center text-2xl text-white">📖 L'album di {owner?.name ?? '?'}</h2>
      {entries.map((e, i) => {
        const by = people.get(e.by);
        const last = i === entries.length - 1;
        const verb = e.type === 'drawing' ? 'ha disegnato' : i === 0 ? 'ha scritto' : 'ha indovinato';
        return (
          <div key={i} ref={last ? lastRef : undefined} className={`flex flex-col gap-1.5 ${last ? 'pop' : ''}`}>
            <div className="flex items-center gap-2 text-sm font-bold text-slate-300">
              {by && <Avatar avatar={by.avatar} color={by.color} size={26} />}
              {by?.name ?? '?'} {verb}
            </div>
            {e.content === null ? (
              <p className="rounded-2xl bg-slate-900/80 p-4 text-center font-bold text-slate-400">🙈 Turno saltato</p>
            ) : e.type === 'drawing' ? (
              <img src={e.content} alt="Disegno" className="aspect-square w-full rounded-2xl border-4 border-white/80 bg-white object-contain" />
            ) : (
              <p className="rounded-2xl rounded-tl-sm bg-white px-4 py-3 text-xl font-bold text-slate-950">{e.content}</p>
            )}
          </div>
        );
      })}
    </section>
  );
}

// Fine partita: gli album si svelano una pagina alla volta, uguali per tutti
export default function AlbumView({ state, onNext, onNewGame, onBackToLobby }: AlbumViewProps) {
  const tel = state.tel!;
  const album = tel.album ?? [];
  const people = new Map(tel.roster.map((p) => [p.id, p]));
  const host = state.players.find((p) => p.id === state.hostId);
  const canLead = state.myId === state.hostId || !host?.isOnline;
  const lastRef = useRef<HTMLDivElement>(null);
  const current = album[tel.revealChain];
  const moreChains = tel.revealChain < tel.roster.length - 1;
  const nextLabel = tel.revealStep < tel.totalSteps ? 'Avanti ▶' : moreChains ? 'Prossimo album ▶' : 'Fine! 🎉';

  useEffect(() => {
    soundManager.playClick();
    lastRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [tel.revealChain, tel.revealStep]);

  return (
    <div className="flex flex-col gap-6">
      {tel.revealDone ? (
        <>
          <p className="text-center text-3xl font-black text-amber-300">Tutti gli album! 🎉</p>
          {album.map((c) => (
            <Chain key={c.ownerId} chain={c} people={people} />
          ))}
        </>
      ) : (
        current && (
          <>
            <p className="text-center text-sm font-black text-slate-300">
              Album {tel.revealChain + 1} di {tel.roster.length}
            </p>
            <Chain chain={current} people={people} lastRef={lastRef} />
          </>
        )
      )}

      <BottomBar>
        {canLead ? (
          tel.revealDone ? (
            <div className="flex gap-2">
              <button type="button" onClick={onNewGame} className="h-16 flex-1 rounded-2xl bg-amber-400 text-xl font-black text-slate-950">
                Nuova partita
              </button>
              <button
                type="button"
                onClick={onBackToLobby}
                className="flex h-16 flex-col items-center justify-center rounded-2xl bg-slate-800 px-3 text-xs font-black leading-tight text-white"
              >
                <Settings size={20} />
                Cambia gioco
              </button>
            </div>
          ) : (
            <button type="button" onClick={onNext} className="h-16 rounded-2xl bg-cyan-500 text-xl font-black text-white">
              {nextLabel}
            </button>
          )
        ) : (
          <p className="rounded-2xl border-2 border-slate-700 bg-slate-900/95 py-4 text-center font-bold text-slate-200">
            {tel.revealDone ? `In attesa che ${host?.name} avvii una nuova partita…` : `Guardate insieme: ${host?.name} manda avanti`}
          </p>
        )}
      </BottomBar>
    </div>
  );
}
