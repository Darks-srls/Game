import { useEffect, useState } from 'react';
import { Flag } from 'lucide-react';
import type { ArtistaView as ArtistaData } from '../types/game';
import { useCountdown } from '../hooks/useCountdown';
import { haptic, soundManager } from '../utils/audio';
import DrawBoard from './DrawBoard';
import { TimerRing } from './fx';
import { Avatar, BottomBar, EndBar, type ModeProps } from './ui';

// 🖌️ Artista impostore: tutti disegnano la parola segreta un tratto a testa; uno non la conosce
export default function ArtistaView({ state, board, boardVersion, clockOffset, canLead, onAction, onDraw, onNewGame, onBackToLobby, onForce }: ModeProps) {
  const a = state.mg as ArtistaData;
  const [show, setShow] = useState(false);
  const [doneTurn, setDoneTurn] = useState('');
  const P = (id: string | null) => state.players.find((p) => p.id === id);
  const turnKey = `${a.lap}-${a.drawer}`;
  const myTurn = a.stage === 'DRAW' && a.drawer === state.myId && doneTurn !== turnKey;
  const drawer = P(a.drawer);
  const impostor = P(a.impostor);
  const left = useCountdown(a.stage === 'DRAW' ? a.turnEndsAt : null, clockOffset);
  const meConfirmed = a.confirmations.includes(state.myId);
  const waiting = a.order.filter((id) => P(id)?.isOnline && !a.confirmations.includes(id)).map((id) => P(id)?.name);

  useEffect(() => {
    if (myTurn) {
      soundManager.playReveal();
      haptic(80);
    }
  }, [myTurn]);

  useEffect(() => {
    if (a.stage === 'END') soundManager.playVictory();
  }, [a.stage]);

  return (
    <div className="stagger flex flex-col gap-3">
      {a.stage === 'END' ? (
        <section className="pop flex flex-col items-center gap-2 rounded-3xl border-2 border-red-400/60 bg-red-500/20 p-4 text-center">
          <p className="text-xs font-black uppercase tracking-widest text-red-200">L'artista impostore era</p>
          {impostor && <Avatar avatar={impostor.avatar} color={impostor.color} size={64} />}
          <p className="text-3xl font-black text-white">{impostor?.name ?? '?'}</p>
          <p className="font-bold text-slate-100">
            La parola era <span className="text-amber-300">{a.word}</span> ({a.category})
          </p>
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="rounded-2xl border-2 border-slate-700 bg-slate-900 p-3 text-center font-bold text-slate-100"
        >
          {!show ? (
            '👁️ Tocca per vedere la tua parola segreta'
          ) : a.isImpostor ? (
            <>
              🎭 Sei l'artista impostore! Categoria: <b>{a.category}</b>. Non sai la parola: bluffa!
            </>
          ) : (
            <>
              La parola è <b className="text-amber-300">{a.word}</b> ({a.category})
            </>
          )}
        </button>
      )}

      {a.stage === 'DRAW' && (
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2 rounded-full bg-slate-900 py-1 pl-1 pr-3 text-sm font-black text-white">
            {drawer && <Avatar avatar={drawer.avatar} color={drawer.color} size={26} />}
            <span className="truncate">{myTurn ? 'Tocca a te: un solo tratto!' : `Disegna ${drawer?.name ?? '…'}`}</span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <span className="rounded-full bg-slate-900 px-3 py-1 text-sm font-black text-slate-200">
              Giro {a.lap + 1}/{a.laps}
            </span>
            {left !== null && <TimerRing left={left} total={30} size={46} />}
          </span>
        </div>
      )}
      {a.stage === 'VOTE' && <p className="text-center text-xl font-black text-white">Chi è l'impostore? Discutete a voce, poi premete Conferma.</p>}

      <DrawBoard
        ops={board}
        version={boardVersion}
        penOnly
        fixedColor={a.colors[state.myId]}
        fixedSize={10}
        onOp={myTurn ? onDraw : undefined}
        onStrokeEnd={
          myTurn
            ? () => {
                setDoneTurn(turnKey);
                onAction('MG_STROKE_END');
              }
            : undefined
        }
      />

      <section className="flex flex-wrap gap-2">
        {a.order.map((id) => {
          const p = P(id);
          if (!p) return null;
          const ok = a.confirmations.includes(id);
          return (
            <span key={id} className={`flex items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-sm font-bold ${ok ? 'bg-emerald-500/25 text-emerald-100' : 'bg-slate-800 text-slate-200'}`}>
              <span className="h-5 w-5 rounded-full border-2 border-white/70" style={{ background: a.colors[id] }} />
              {p.name}
              {ok ? ' ✓' : ''}
            </span>
          );
        })}
      </section>

      {a.stage === 'END' ? (
        <EndBar canLead={canLead} hostName={P(state.hostId)?.name} onNewGame={onNewGame} onBackToLobby={onBackToLobby} />
      ) : a.stage === 'VOTE' ? (
        <BottomBar>
          <button
            type="button"
            onClick={() => onAction('MG_CONFIRM')}
            className={`flex h-16 flex-col items-center justify-center rounded-2xl ${meConfirmed ? 'border-2 border-emerald-400 bg-slate-900 text-emerald-300' : 'bg-emerald-500 text-white'}`}
          >
            <span className="text-xl font-black">{meConfirmed ? 'Confermato ✓' : 'Conferma'}</span>
            <span className="text-xs font-bold opacity-90">
              {a.confirmations.length}/{a.order.length} pronti a svelare l'impostore
            </span>
          </button>
          <div className="flex items-center justify-between gap-3 px-1 text-xs font-bold text-slate-200">
            <span className="truncate">{waiting.length ? `Aspettiamo: ${waiting.join(', ')}` : 'Tutti pronti!'}</span>
            {canLead && (
              <button type="button" onClick={onForce} className="flex shrink-0 items-center gap-1 rounded-full bg-slate-900/95 px-3 py-1.5 text-red-300">
                <Flag size={14} /> Svela ora
              </button>
            )}
          </div>
        </BottomBar>
      ) : null}
    </div>
  );
}
