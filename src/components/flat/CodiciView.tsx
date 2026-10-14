import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { Eye, FastForward, Send } from 'lucide-react';
import { codiciClash, type CodiciCard, type CodiciColor, type CodiciView as CodiciData } from '../../data/flat/codici';
import { useCountdown } from '../../hooks/useCountdown';
import { haptic, soundManager } from '../../utils/audio';
import { GameChip, TimerRing } from '../fx';
import { Avatar, BottomBar, EndBar, Ranking, type ModeProps } from '../ui';

const TEAM = [
  { name: 'Rossi', emoji: '🔴', color: 'R' as CodiciColor, text: 'text-red-300', ring: 'ring-red-400', soft: 'bg-red-500/20', grad: 'from-red-500 to-rose-700' },
  { name: 'Blu', emoji: '🔵', color: 'B' as CodiciColor, text: 'text-sky-300', ring: 'ring-sky-400', soft: 'bg-sky-500/20', grad: 'from-sky-500 to-blue-700' },
];
const STAGE_SECONDS: Record<CodiciData['stage'], number> = { INTRO: 25, CLUE: 120, GUESS: 180, END: 0 };
const NUMBERS: [number, string][] = [[0, '0'], [1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5'], [6, '6'], [7, '7'], [8, '8'], [9, '9'], [-1, '∞']];

// carta scoperta: colore pieno e il disegno di chi c'era sotto
const OPEN_STYLE: Record<CodiciColor, string> = {
  R: 'border-red-200 bg-linear-to-br from-red-500 to-red-700 text-white',
  B: 'border-sky-200 bg-linear-to-br from-sky-500 to-blue-700 text-white',
  N: 'border-stone-100 bg-linear-to-br from-amber-100 to-stone-300 text-stone-600',
  X: 'border-slate-500 bg-linear-to-br from-slate-700 to-black text-white',
};
// carta coperta vista dal capitano: tinta leggera col colore della chiave
const KEY_STYLE: Record<CodiciColor, string> = {
  R: 'border-red-500 bg-red-200 text-red-950',
  B: 'border-sky-500 bg-sky-200 text-sky-950',
  N: 'border-stone-300 bg-amber-50 text-stone-600',
  X: 'border-black bg-slate-700 text-white',
};
const ICON: Record<CodiciColor, string> = { R: '🕵️', B: '🕵️', N: '🚶', X: '💀' };
const nLabel = (n: number) => (n < 0 ? '∞' : String(n));
// parole lunghe con caratteri più piccoli, così stanno nella carta
const fit = (w: string) => (w.length <= 5 ? 'text-[15px]' : w.length <= 7 ? 'text-[13px]' : w.length <= 9 ? 'text-[11px]' : 'text-[9.5px]');

// 🗝️ Nomi in codice: rossi contro blu, il capitano dà una parola e un numero
export default function CodiciView({ state, clockOffset, canLead, onAction, onNewGame, onBackToLobby, onForce }: ModeProps) {
  const q = state.mg as CodiciData;
  const me = state.myId;
  const P = (id: string) => state.players.find((p) => p.id === id);
  const left = useCountdown(q.stage === 'END' ? null : q.stageEndsAt, clockOffset);
  const team = TEAM[q.turn];
  const myTurn = q.myTeam === q.turn && q.stage !== 'END';
  const iGiveClue = myTurn && q.captains[q.turn] === me && q.stage === 'CLUE';
  // chi indovina: i compagni del capitano (se è rimasto da solo, gioca lui)
  const teamIds = (t: 0 | 1) => q.order.filter((id) => q.teams[id] === t);
  const guessers = teamIds(q.turn).filter((id) => id !== q.captains[q.turn]);
  const iGuess = q.stage === 'GUESS' && myTurn && (guessers.length ? guessers.includes(me) : true);
  const myPick = q.cards.findIndex((c) => c.picks.includes(me));
  const [word, setWord] = useState('');
  const [n, setN] = useState<number | null>(null);

  // suoni uguali per tutti: le carte scoperte sono pubbliche
  const lastNo = useRef(q.last?.no ?? 0);
  useEffect(() => {
    if (!q.last || q.last.no === lastNo.current) return;
    lastNo.current = q.last.no;
    const color = q.cards[q.last.i]?.color;
    const by = q.teams[q.last.by];
    if (color === 'X') soundManager.playBoom();
    else if (by !== undefined && color === TEAM[by].color) soundManager.playSuccess();
    else if (color === 'N') soundManager.playPop();
    else soundManager.playError();
  }, [q.last?.no]);
  useEffect(() => {
    if (q.stage === 'CLUE') soundManager.playWhoosh();
    if (q.stage === 'GUESS') soundManager.playReveal();
    if (q.stage === 'END') {
      soundManager.playVictory();
      if (q.winner !== null) confetti({ particleCount: 160, spread: 95, origin: { y: 0.35 }, colors: q.winner === 0 ? ['#ef4444', '#fecaca', '#ffffff'] : ['#0ea5e9', '#bae6fd', '#ffffff'] });
    }
  }, [q.stage, q.turnNo]);
  // indizio nuovo a ogni turno
  useEffect(() => {
    setWord('');
    setN(null);
  }, [q.turnNo]);

  // l'indizio non può essere (o somigliare troppo a) una parola ancora coperta
  const clash = word ? q.cards.find((c) => !c.open && codiciClash(c.word, word)) : undefined;
  const canSend = word.trim().length >= 2 && n !== null && !clash;
  const sendClue = () => {
    if (!canSend) return;
    onAction('MG_CLUE', { word: word.trim(), n });
    haptic(30);
  };

  const teamBox = (t: 0 | 1) => {
    const T = TEAM[t];
    const active = q.stage !== 'END' && q.stage !== 'INTRO' && q.turn === t;
    return (
      <div key={t} className={`flex min-w-0 flex-1 flex-col gap-1.5 rounded-2xl p-2 ring-2 transition-transform ${T.soft} ${active ? `${T.ring} scale-[1.03]` : 'opacity-75 ring-white/10'}`}>
        <div className="flex items-center justify-between">
          <span className={`text-xs font-black uppercase ${T.text}`}>
            {T.emoji} {T.name}
            {q.myTeam === t && <span className="ml-1 rounded-full bg-white/90 px-1.5 text-[9px] text-slate-950">TU</span>}
          </span>
          <span className="flex items-center gap-1">
            <span key={q.left[t]} className="pop font-display text-2xl leading-none text-white">
              {q.left[t]}
            </span>
            <span className="text-[8px] font-black uppercase leading-[1.05] text-white/60">
              da
              <br />
              trovare
            </span>
          </span>
        </div>
        <div className="flex flex-wrap gap-1">
          {teamIds(t).map((id) => {
            const p = P(id);
            if (!p) return null;
            return (
              <span key={id} className={`relative ${p.isOnline ? '' : 'opacity-40'}`} title={p.name}>
                <Avatar avatar={p.avatar} color={p.color} size={24} />
                {q.captains[t] === id && <span className="absolute -right-1 -top-2 text-[13px]">👑</span>}
              </span>
            );
          })}
        </div>
      </div>
    );
  };

  const card = (c: CodiciCard, i: number, mode: 'play' | 'end') => {
    const mine = myPick === i;
    const canPick = mode === 'play' && iGuess && !c.open;
    const justOpened = c.open && q.last?.i === i && mode === 'play';
    const style = c.open ? OPEN_STYLE[c.color ?? 'N'] : c.color ? KEY_STYLE[c.color] : 'border-white bg-amber-50 text-slate-900';
    return (
      <div
        key={`${i}-${c.open}`}
        role={canPick ? 'button' : undefined}
        onClick={
          canPick
            ? () => {
                onAction('MG_PICK', { i });
                haptic(10);
              }
            : undefined
        }
        className={`relative flex h-[62px] min-w-0 flex-col items-center justify-center rounded-xl border-2 px-0.5 text-center shadow-[0_3px_0_rgba(22,6,72,0.45)] transition-transform ${style} ${
          justOpened ? 'reveal-pop' : ''
        } ${mine ? 'z-10 scale-[1.06] ring-4 ring-amber-300' : ''} ${canPick ? 'cursor-pointer active:scale-95' : ''} ${mode === 'end' && !c.open ? 'opacity-60' : ''}`}
      >
        {c.open && <span className="text-xl leading-none">{ICON[c.color ?? 'N']}</span>}
        <span
          className={`w-full font-black uppercase leading-tight [overflow-wrap:anywhere] ${c.open ? 'text-[9px] opacity-80' : fit(c.word)} ${
            !c.open && c.color === 'X' ? 'text-white' : ''
          }`}
        >
          {c.word}
        </span>
        {!c.open && c.color === 'X' && <span className="absolute right-0.5 top-0 text-[11px]">💀</span>}
        {c.picks.length > 0 && !c.open && (
          <span className="absolute -bottom-2 left-0.5 flex -space-x-1.5">
            {c.picks.slice(0, 4).map((id) => {
              const p = P(id);
              return p ? <Avatar key={id} avatar={p.avatar} color={p.color} size={18} /> : null;
            })}
            {c.picks.length > 4 && <span className="grid h-[18px] place-items-center rounded-full bg-slate-900 px-1 text-[9px] font-black text-white">+{c.picks.length - 4}</span>}
          </span>
        )}
        {mine && iGuess && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAction('MG_REVEAL', { i });
              haptic(40);
            }}
            className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-black text-slate-950 shadow-[0_2px_0_rgba(0,0,0,0.35)]"
          >
            RIVELA
          </button>
        )}
      </div>
    );
  };

  const board = (mode: 'play' | 'end') => <div className="grid grid-cols-5 gap-x-1.5 gap-y-2.5 pt-1">{q.cards.map((c, i) => card(c, i, mode))}</div>;

  const clueLog = q.log.length > 0 && (
    <section className="rounded-3xl border-2 border-white/10 bg-slate-900 p-3">
      <p className="mb-2 text-xs font-black uppercase tracking-widest text-slate-400">Indizi dati</p>
      <ol className="flex flex-col gap-1.5">
        {[...q.log].reverse().map((l, k) => (
          <li key={q.log.length - k} className={`flex items-center gap-2 rounded-xl px-2 py-1.5 ${TEAM[l.team].soft}`}>
            <span className="text-sm">{TEAM[l.team].emoji}</span>
            <span className="min-w-0 flex-1 truncate font-black uppercase text-white">
              {l.word} <span className="text-amber-300">{nLabel(l.n)}</span>
            </span>
            <span className="flex gap-0.5">
              {l.hits.map((h, j) => (
                <span key={j} className={`grid h-5 w-5 place-items-center rounded-md text-[11px] ${OPEN_STYLE[h]}`}>
                  {h === 'X' ? '💀' : h === 'N' ? '·' : ''}
                </span>
              ))}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );

  // ---------------------------------------------------------------- fine partita
  if (q.stage === 'END') {
    const W = q.winner === null ? null : TEAM[q.winner];
    const loser = q.winner === null ? null : TEAM[q.winner === 0 ? 1 : 0];
    const why =
      q.endReason === 'assassino'
        ? `I ${loser?.name} hanno toccato l’assassino 💀`
        : q.endReason === 'tutte'
          ? 'Tutti i loro agenti sono stati trovati!'
          : q.endReason === 'ritiro'
            ? 'L’altra squadra è rimasta senza giocatori'
            : 'Partita ferma: nessuno scopriva carte da troppi turni';
    return (
      <div className="stagger flex flex-col gap-4 pb-28">
        <section
          className={`pop rounded-3xl border-4 border-white/90 p-5 text-center shadow-[0_8px_0_rgba(22,6,72,0.5)] ${W ? `bg-linear-to-br ${W.grad}` : 'bg-linear-to-br from-slate-600 to-slate-800'}`}
        >
          <p className="text-6xl">{W ? '🏆' : '🤷'}</p>
          <p className="font-display text-4xl leading-tight text-white">{W ? `Vincono i ${W.name}!` : 'Nessun vincitore'}</p>
          <p className="mt-1 font-bold text-white/90">{why}</p>
          {q.myTeam !== null && W && <p className="mt-2 text-lg font-black text-white">{q.myTeam === q.winner ? 'La tua squadra ha vinto! 🎉' : 'Sarà per la prossima… 😤'}</p>}
        </section>
        <section className="rounded-3xl border-2 border-white/10 bg-slate-900 p-3">
          <p className="mb-2 text-center text-xs font-black uppercase tracking-widest text-slate-400">La chiave completa</p>
          {board('end')}
        </section>
        <section className="rounded-3xl border-2 border-white/10 bg-slate-900 p-3">
          <p className="mb-2 text-center text-xs font-black uppercase tracking-widest text-slate-400">Punti: vincenti 3, capitano vincente 4</p>
          <Ranking state={state} scores={q.scores} />
        </section>
        {clueLog}
        <EndBar canLead={canLead} hostName={P(state.hostId)?.name} onNewGame={onNewGame} onBackToLobby={onBackToLobby} />
      </div>
    );
  }

  // ---------------------------------------------------------------- presentazione delle squadre
  if (q.stage === 'INTRO') {
    const T = q.myTeam === null ? null : TEAM[q.myTeam];
    const ready = q.ready.includes(me);
    return (
      <div className="stagger flex flex-col gap-4 pb-32">
        <div className="flex items-center justify-between gap-2">
          <GameChip>🗝️ Nomi in codice</GameChip>
          <TimerRing left={left} total={STAGE_SECONDS.INTRO} />
        </div>
        <section className={`pop rounded-3xl border-4 border-white/90 p-5 text-center shadow-[0_8px_0_rgba(22,6,72,0.5)] bg-linear-to-br ${T ? T.grad : 'from-slate-600 to-slate-800'}`}>
          <p className="text-xs font-black uppercase tracking-widest text-white/80">{T ? 'La tua squadra' : 'Stai guardando'}</p>
          <p className="font-display text-5xl leading-tight text-white">{T ? `${T.emoji} ${T.name}` : '👀'}</p>
          {q.amCaptain ? (
            <p className="mt-2 text-lg font-black text-white">👑 Sei il CAPITANO: vedrai di chi sono tutte le parole. Non far vedere il telefono!</p>
          ) : T ? (
            <p className="mt-2 text-lg font-bold text-white">Il tuo capitano è {P(q.captains[q.myTeam!])?.name}: ascolta i suoi indizi e trova le parole giuste.</p>
          ) : null}
        </section>
        <div className="flex gap-2">
          {teamBox(0)}
          {teamBox(1)}
        </div>
        <section className="rounded-3xl border-2 border-white/10 bg-slate-900 p-4 text-sm font-bold text-slate-200">
          <p>
            🎯 Iniziano i {TEAM[q.starter].emoji} {TEAM[q.starter].name}: hanno <b className="text-white">9 parole</b> da trovare, gli altri 8.
          </p>
          <p className="mt-1">💡 Il capitano scrive UNA parola e un numero (es. “MARE 2”). Si scopre al massimo il numero + 1.</p>
          <p className="mt-1">🚶 Passante o parola avversaria: turno finito. 💀 L’assassino: avete perso!</p>
        </section>
        <BottomBar>
          <div className="flex items-center gap-2">
            {q.myTeam !== null && (
              <button type="button" disabled={ready} onClick={() => onAction('MG_READY')} className="shine h-16 flex-1 rounded-2xl bg-amber-400 text-xl font-black text-slate-950 disabled:opacity-60">
                {ready ? `Pronti: ${q.ready.length}/${q.order.length}` : 'Pronto! 👍'}
              </button>
            )}
            {canLead && (
              <button type="button" onClick={onForce} className="flex h-16 shrink-0 items-center gap-1 rounded-2xl bg-slate-800 px-3 text-sm font-black text-amber-200">
                <FastForward size={16} /> Via
              </button>
            )}
          </div>
        </BottomBar>
      </div>
    );
  }

  // ---------------------------------------------------------------- partita
  const captain = P(q.captains[q.turn]);
  const status =
    q.stage === 'CLUE'
      ? iGiveClue
        ? 'Tocca a te: scrivi l’indizio qui sotto 👇'
        : `${captain?.name ?? 'Il capitano'} sta pensando all’indizio… 🤔`
      : iGuess
        ? myPick >= 0
          ? `Premi RIVELA per scoprire «${q.cards[myPick].word.toUpperCase()}»`
          : 'Tocca la carta che vuoi proporre'
        : myTurn
          ? 'I tuoi compagni stanno cercando… zitto! 🤐'
          : `I ${team.name} stanno cercando… 👀`;

  return (
    <div className="flex flex-col gap-3 pb-56">
      <div className="flex items-center justify-between gap-2">
        <GameChip>🗝️ Turno {q.turnNo}</GameChip>
        {q.myTeam === null && <span className="truncate text-xs font-black text-slate-300">👀 Stai guardando</span>}
        <div className="flex items-center gap-1.5">
          {canLead && (
            <button type="button" onClick={onForce} aria-label="Avanti" className="grid h-9 w-9 place-items-center rounded-full bg-slate-800 text-amber-200">
              <FastForward size={16} />
            </button>
          )}
          <TimerRing left={left} total={STAGE_SECONDS[q.stage]} />
        </div>
      </div>

      <div className="flex gap-2">
        {teamBox(0)}
        {teamBox(1)}
      </div>

      {/* di chi è il turno e l'indizio */}
      <section key={`${q.turnNo}-${q.stage}`} className={`pop rounded-3xl border-4 border-white/90 bg-linear-to-br px-4 py-3 text-center shadow-[0_6px_0_rgba(22,6,72,0.5)] ${team.grad}`}>
        {q.stage === 'CLUE' ? (
          <>
            <p className="text-xs font-black uppercase tracking-widest text-white/80">Tocca ai {team.name}</p>
            <p className="flex items-center justify-center gap-2 font-display text-2xl text-white">
              {captain && <Avatar avatar={captain.avatar} color={captain.color} size={30} />}
              {iGiveClue ? 'Il tuo indizio!' : `${captain?.name ?? '?'} pensa…`}
            </p>
          </>
        ) : (
          q.clue && (
            <>
              <p className="text-xs font-black uppercase tracking-widest text-white/80">
                Indizio di {captain?.name ?? 'capitano'} {team.emoji}
              </p>
              <p className="flex items-center justify-center gap-3 font-display text-4xl uppercase leading-tight text-white [overflow-wrap:anywhere]">
                {q.clue.word}
                <span className="grid h-12 min-w-12 place-items-center rounded-2xl bg-white px-2 text-3xl text-slate-950">{nLabel(q.clue.n)}</span>
              </p>
              <p className="mt-1 text-sm font-black text-white/90">
                Scoperte {q.guesses}
                {q.maxGuesses !== null ? ` · massimo ${q.maxGuesses}` : ' · senza limite'}
              </p>
            </>
          )
        )}
      </section>

      <p className="text-center text-sm font-bold text-slate-200">{status}</p>

      {q.amCaptain && (
        <p className="text-center text-[11px] font-bold text-slate-400">
          👑 Sei il capitano, vedi la chiave: <span className="text-red-300">rosse</span> · <span className="text-sky-300">blu</span> · 🚶 passanti · 💀 assassino
        </p>
      )}

      {board('play')}

      {clueLog}

      <BottomBar>
        {iGiveClue ? (
          <div className="flex flex-col gap-2 rounded-3xl border-2 border-white/10 bg-slate-900/95 p-2.5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendClue();
              }}
              className="flex gap-2"
            >
              <input
                value={word}
                onChange={(e) => setWord(e.target.value.replace(/\s/g, '').slice(0, 24))}
                placeholder="UNA parola…"
                autoComplete="off"
                autoCapitalize="none"
                enterKeyHint="send"
                className="h-12 min-w-0 flex-1 rounded-2xl border-2 border-slate-700 bg-slate-950 px-4 text-lg font-bold uppercase text-white outline-none placeholder:normal-case placeholder:text-slate-500 focus:border-amber-400"
              />
              <button type="submit" disabled={!canSend} aria-label="Invia indizio" className="grid h-12 w-14 place-items-center rounded-2xl bg-emerald-500 text-white disabled:opacity-40">
                <Send size={20} />
              </button>
            </form>
            <div className="grid grid-cols-11 gap-1">
              {NUMBERS.map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setN(v)}
                  className={`h-10 rounded-lg text-base font-black ${n === v ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-200'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className={`text-center text-xs font-bold ${clash ? 'text-rose-300' : 'text-slate-400'}`}>
              {clash
                ? `Non vale: troppo simile a «${clash.word.toUpperCase()}» sul tabellone`
                : n === null
                  ? 'Scegli anche quante parole collega (0 o ∞ = senza limite)'
                  : `Indizio: ${word ? word.toUpperCase() : '…'} ${nLabel(n)}`}
            </p>
          </div>
        ) : iGuess ? (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={myPick < 0}
              onClick={() => {
                onAction('MG_REVEAL', { i: myPick });
                haptic(40);
              }}
              className="flex h-16 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl bg-amber-400 px-3 text-lg font-black text-slate-950 disabled:bg-slate-700 disabled:text-slate-300"
            >
              <Eye size={22} className="shrink-0" />
              <span className="truncate">{myPick >= 0 ? `RIVELA ${q.cards[myPick].word.toUpperCase()}` : 'Tocca una carta'}</span>
            </button>
            <button
              type="button"
              disabled={q.guesses < 1}
              onClick={() => onAction('MG_PASS')}
              className="flex h-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-slate-700 px-4 text-lg font-black leading-none text-white disabled:opacity-50"
            >
              PASSA
              <span className="mt-1 text-[10px] font-bold text-slate-300">{q.guesses < 1 ? 'dopo 1 carta' : 'fine turno'}</span>
            </button>
          </div>
        ) : (
          <p className="rounded-2xl border-2 border-slate-700 bg-slate-900/95 px-4 py-3 text-center text-sm font-bold text-slate-200">{status}</p>
        )}
      </BottomBar>
    </div>
  );
}
