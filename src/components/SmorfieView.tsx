import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import confetti from 'canvas-confetti';
import { Camera, Check, FastForward, ImageUp, RotateCcw } from 'lucide-react';
import type { SmorfieView as SmorfieData } from '../types/game';
import { useCountdown } from '../hooks/useCountdown';
import { soundManager } from '../utils/audio';
import { GameChip, Podium, PointsPop, TimerRing } from './fx';
import { Avatar, BottomBar, EndBar, Ranking, type ModeProps } from './ui';

const SIZE = 480; // lato della foto inviata (quadrata, JPEG)

// Ritaglia al centro e rimpicciolisce: la foto pesa poche decine di KB
function squareJpeg(source: CanvasImageSource, width: number, height: number, mirror: boolean) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const g = canvas.getContext('2d')!;
  const side = Math.min(width, height);
  if (mirror) {
    g.translate(SIZE, 0);
    g.scale(-1, 1); // come nello specchio dell'anteprima
  }
  g.drawImage(source, (width - side) / 2, (height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  return canvas.toDataURL('image/jpeg', 0.75);
}

// Fotocamera frontale con conto alla rovescia; se non si apre, si sceglie o si scatta una foto dal telefono
function SelfieCam({ onSend }: { onSend: (image: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [failed, setFailed] = useState(false);
  const [shot, setShot] = useState<string | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [flash, setFlash] = useState(0);

  useEffect(() => {
    let current: MediaStream | null = null;
    let cancelled = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      setFailed(true);
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } }, audio: false })
      .then((m) => {
        if (cancelled) return m.getTracks().forEach((t) => t.stop());
        current = m;
        setStream(m);
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    const v = video.current;
    if (v && stream && !shot) {
      v.srcObject = stream;
      v.play().catch(() => {});
    }
  }, [stream, shot]);

  const capture = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    setShot(squareJpeg(v, v.videoWidth, v.videoHeight, true));
    setFlash((f) => f + 1);
    soundManager.playPop();
  };

  const snap = () => {
    if (count !== null) return;
    let n = 3;
    setCount(n);
    soundManager.playTick();
    const timer = setInterval(() => {
      n -= 1;
      if (n > 0) {
        setCount(n);
        soundManager.playTick();
      } else {
        clearInterval(timer);
        setCount(null);
        capture();
      }
    }, 700);
  };

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      setShot(squareJpeg(img, img.naturalWidth, img.naturalHeight, false));
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
    e.target.value = '';
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="relative mx-auto aspect-square w-full max-w-[340px] overflow-hidden rounded-3xl border-4 border-white bg-slate-950 shadow-[0_8px_0_rgba(22,6,72,0.5)]">
        {shot ? (
          <img src={shot} alt="Il tuo selfie" className="h-full w-full object-cover" />
        ) : stream ? (
          <video ref={video} playsInline muted autoPlay className="h-full w-full -scale-x-100 object-cover" />
        ) : (
          <div className="grid h-full place-items-center p-6 text-center">
            <div>
              <p className="text-5xl">📷</p>
              <p className="mt-2 font-bold text-slate-300">{failed ? 'Fotocamera non disponibile: scegli o scatta una foto qui sotto.' : 'Apro la fotocamera… (consenti l’accesso)'}</p>
            </div>
          </div>
        )}
        {count !== null && (
          <span key={count} className="reveal-pop absolute inset-0 grid place-items-center font-display text-9xl text-white [text-shadow:0_6px_0_rgba(0,0,0,0.35)]">
            {count}
          </span>
        )}
        {flash > 0 && <span key={flash} className="flash pointer-events-none absolute inset-0 bg-white" />}
      </div>
      <input ref={fileRef} type="file" accept="image/*" capture="user" hidden onChange={onFile} />
      {shot ? (
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <button type="button" onClick={() => setShot(null)} className="flex h-14 items-center gap-1.5 rounded-2xl bg-slate-700 px-4 font-black text-white">
            <RotateCcw size={18} /> Rifai
          </button>
          <button type="button" onClick={() => onSend(shot)} className="shine flex h-14 items-center justify-center gap-2 rounded-2xl bg-emerald-500 text-xl font-black text-white">
            <Check size={22} /> Invia la smorfia
          </button>
        </div>
      ) : stream ? (
        <button type="button" onClick={snap} className="shine flex h-14 items-center justify-center gap-2 rounded-2xl bg-amber-400 text-xl font-black text-slate-950">
          <Camera size={22} /> {count !== null ? 'Sorridi… o no!' : 'Scatta (3, 2, 1…)'}
        </button>
      ) : (
        <button type="button" onClick={() => fileRef.current?.click()} className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-amber-400 text-xl font-black text-slate-950">
          <ImageUp size={22} /> Scatta o scegli una foto
        </button>
      )}
    </div>
  );
}

// Foto stile polaroid
function Polaroid({ url, caption, tilt = 0, big = false }: { url: string; caption?: string; tilt?: number; big?: boolean }) {
  return (
    <figure className="rounded-xl bg-white p-2 pb-3 shadow-[0_8px_0_rgba(22,6,72,0.45)]" style={{ rotate: `${tilt}deg` }}>
      <img src={url} alt={caption ?? 'Selfie'} className={`aspect-square w-full rounded-md bg-slate-200 object-cover ${big ? '' : ''}`} />
      {caption && <figcaption className="mt-1.5 text-center text-xs font-black leading-tight text-slate-800">{caption}</figcaption>}
    </figure>
  );
}

// 🤳 Smorfie: selfie su una situazione segreta, poi tutti indovinano la situazione di ogni faccia
export default function SmorfieView({ state, clockOffset, canLead, onAction, onNewGame, onBackToLobby, onForce }: ModeProps) {
  const s = state.mg as SmorfieData;
  const P = (id: string | null) => state.players.find((p) => p.id === id);
  const left = useCountdown(s.stage === 'END' ? null : s.stageEndsAt, clockOffset);
  const total = s.stage === 'SHOOT' ? 75 : s.stage === 'GUESS' ? 25 : 6;
  const owner = P(s.owner);
  const mine = s.owner === state.myId;
  const reveal = s.stage === 'REVEAL';
  const iShoot = s.shooters.includes(state.myId);
  const iSent = s.sent.includes(state.myId);
  const canGuess = s.stage === 'GUESS' && !mine && s.order.includes(state.myId) && s.myGuess === null;
  const missing = s.shooters.filter((id) => P(id)?.isOnline && !s.sent.includes(id)).map((id) => P(id)?.name);
  const guessers = s.order.filter((id) => id !== s.owner && P(id)?.isOnline).length;

  useEffect(() => {
    if (s.stage === 'GUESS') soundManager.playReveal();
    if (s.stage === 'REVEAL') {
      if (s.myGuess !== null && s.myGuess === s.answer) soundManager.playSuccess();
      else soundManager.playPop();
    }
    if (s.stage === 'END') {
      soundManager.playVictory();
      confetti({ particleCount: 160, spread: 90, origin: { y: 0.35 } });
    }
  }, [s.stage, s.photoNo, s.round]);

  if (s.stage === 'END') {
    const ranking = Object.entries(s.scores).sort((x, y) => y[1] - x[1]);
    return (
      <div className="stagger flex flex-col gap-4">
        <h2 className="text-center text-3xl text-white">Le facce più espressive 🤳</h2>
        <Podium state={state} entries={ranking.map(([id, points]) => ({ id, value: `${points} punti` }))} />
        {s.album && s.album.length > 0 && (
          <section className="rounded-3xl border-2 border-white/10 bg-slate-900 p-4">
            <h3 className="mb-3 text-xl text-white">📸 L'album della serata</h3>
            <div className="grid grid-cols-2 gap-3">
              {s.album.map((a, i) => (
                <Polaroid key={a.url} url={a.url} caption={`${P(a.by)?.name ?? '?'}: ${a.prompt}`} tilt={i % 2 ? 2 : -2} />
              ))}
            </div>
            <p className="mt-3 text-center text-xs font-semibold text-slate-400">Le foto si cancellano quando inizia un’altra partita.</p>
          </section>
        )}
        <section className="rounded-3xl border-2 border-white/10 bg-slate-900 p-4">
          <Ranking state={state} scores={s.scores} />
        </section>
        <EndBar canLead={canLead} hostName={P(state.hostId)?.name} onNewGame={onNewGame} onBackToLobby={onBackToLobby} />
      </div>
    );
  }

  return (
    <div className="stagger flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <GameChip>
          🤳 Round {s.round}/{s.totalRounds}
          {s.stage !== 'SHOOT' && ` · Foto ${s.photoNo}/${s.photoCount}`}
        </GameChip>
        <TimerRing left={left} total={total} />
      </div>

      {s.stage === 'SHOOT' &&
        (iShoot && !iSent && s.myPrompt ? (
          <>
            <section className="pop rounded-3xl border-4 border-amber-300 bg-linear-to-br from-amber-300 to-amber-500 p-4 text-center shadow-[0_8px_0_rgba(22,6,72,0.5)]">
              <p className="text-xs font-black uppercase tracking-widest text-slate-950/70">Fai la faccia di… (è segreto!)</p>
              <p className="font-display text-2xl leading-tight text-slate-950">{s.myPrompt}</p>
            </section>
            <SelfieCam onSend={(image) => onAction('MG_PHOTO', { image })} />
          </>
        ) : (
          <section className="pop rounded-3xl border-2 border-white/10 bg-slate-900 p-6 text-center">
            <p className="float text-5xl">{iSent ? '✅' : '📸'}</p>
            <p className="mt-2 text-xl font-black text-white">{iSent ? 'Smorfia inviata!' : 'Gli altri si stanno facendo un selfie…'}</p>
            <p className="text-sm font-semibold text-slate-400">Tra poco si indovina chi stava pensando a cosa.</p>
          </section>
        ))}

      {(s.stage === 'GUESS' || reveal) && s.photo && (
        <>
          <div key={s.photoNo} className="reveal-pop mx-auto w-[78%] max-w-[300px]">
            <Polaroid url={s.photo} caption={mine ? 'È la tua faccia! 😂' : `La faccia di ${owner?.name ?? '?'}`} tilt={s.photoNo % 2 ? -2.5 : 2.5} big />
          </div>
          <p className="text-center font-display text-2xl text-white">{mine ? 'Vediamo se ti capiscono…' : 'Che situazione è?'}</p>
          <section className="flex flex-col gap-2">
            {s.options.map((option, i) => {
              const picked = s.myGuess === i;
              const right = reveal && s.answer === i;
              const voters = reveal && s.guesses ? Object.keys(s.guesses).filter((id) => s.guesses![id] === i) : [];
              return (
                <button
                  key={`${s.photoNo}-${i}`}
                  type="button"
                  disabled={!canGuess}
                  onClick={() => onAction('MG_PICK', { choice: i })}
                  className={`pop flex min-h-[56px] items-center gap-2 rounded-2xl border-2 px-4 py-2 text-left font-black leading-tight disabled:opacity-100 ${
                    right
                      ? 'border-emerald-300 bg-emerald-500 text-white'
                      : picked
                        ? 'border-white bg-amber-400 text-slate-950'
                        : reveal
                          ? 'border-transparent bg-slate-900/70 text-slate-400'
                          : 'border-white/10 bg-slate-900 text-white'
                  }`}
                  style={{ animationDelay: `${0.2 + i * 0.06}s` }}
                >
                  <span className="min-w-0 flex-1">
                    {right && '✓ '}
                    {option}
                  </span>
                  {voters.length > 0 && (
                    <span className="flex shrink-0 -space-x-1.5">
                      {voters.map((id) => {
                        const p = P(id);
                        return p ? <Avatar key={id} avatar={p.avatar} color={p.color} size={22} /> : null;
                      })}
                    </span>
                  )}
                </button>
              );
            })}
          </section>
          {reveal && (
            <section className="flex flex-wrap justify-center gap-2">
              {Object.entries(s.gained).map(([id, points]) => {
                const p = P(id);
                return p ? (
                  <span key={id} className="pop relative flex items-center gap-1.5 rounded-full bg-slate-900 py-1 pl-1 pr-3 font-bold text-white">
                    <Avatar avatar={p.avatar} color={p.color} size={26} />
                    {p.name} <span className="text-amber-300">+{points}</span>
                    <PointsPop points={points} className="absolute -top-6 right-1" />
                  </span>
                ) : null;
              })}
            </section>
          )}
        </>
      )}

      <BottomBar>
        <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-slate-700 bg-slate-900/95 px-4 py-3 text-sm font-bold text-slate-200">
          <span className="min-w-0 truncate">
            {s.stage === 'SHOOT'
              ? missing.length
                ? `Mancano: ${missing.join(', ')}`
                : 'Tutti pronti!'
              : reveal
                ? 'Prossima faccia tra poco…'
                : `Hanno risposto: ${s.guessed.length}/${guessers}`}
          </span>
          {canLead && (
            <button type="button" onClick={onForce} className="flex shrink-0 items-center gap-1 rounded-full bg-slate-800 px-3 py-1.5 text-amber-200">
              <FastForward size={14} /> Avanti
            </button>
          )}
        </div>
      </BottomBar>
    </div>
  );
}
