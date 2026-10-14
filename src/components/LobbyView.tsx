import { useEffect, useState, type ReactNode } from 'react';
import { Crown, Share2, UserPlus, X } from 'lucide-react';
import type { BombaMode, ClientGameState, GameSettings } from '../types/game';
import { CATEGORY_ICONS, DEFAULT_LOCATIONS, LOCATION_CATEGORIES } from '../data/locations';
import { Art, Avatar, BottomBar, GAMES, NewBadge, Segmented, shareRoom } from './ui';
import { flatInfo, flatOpt, type FlatId } from '../data/flatGames';

const TIMES: [number, string][] = [[180, '3'], [300, '5'], [480, '8'], [600, '10'], [0, '∞']];
const DRAW_TIMES: [number, string][] = [[60, '60s'], [90, '90s'], [120, '2 min'], [0, '∞']];
const COUNTS: [number, string][] = [[1, '1'], [2, '2'], [3, '3']];
const YES_NO: [number, string][] = [[1, 'Sì'], [0, 'No']];
const IMPOSTOR_WORD: [number, string][] = [[1, 'Parola simile'], [0, 'Niente']];
const ROUNDS: [number, string][] = [[1, '1'], [2, '2'], [3, '3']];
const GUESS_TIMES: [number, string][] = [[60, '60s'], [80, '80s'], [100, '100s']];
const LIVES: [number, string][] = [[1, '1'], [2, '2'], [3, '3'], [5, '5']];
const BOMBA_MODE_IDS: BombaMode[] = ['MISTO', 'SILLABE', 'CATEGORIE', 'LETTERE'];
const BOMBA_MODES: [number, string][] = [[0, 'Misto'], [1, 'Sillabe'], [2, 'Cose'], [3, 'Lettere']];
const WRITE_TIMES: [number, string][] = [[60, '60s'], [90, '90s'], [120, '2 min']];
const QUESTIONS: [number, string][] = [[8, '8'], [12, '12'], [20, '20']];
const LAPS: [number, string][] = [[1, '1'], [2, '2'], [3, '3']];
const TABU_TIMES: [number, string][] = [[45, '45s'], [60, '60s'], [90, '90s']];
const DICE: [number, string][] = [[3, '3'], [4, '4'], [5, '5']];
const PARTY_BOTS: [number, string][] = [[0, 'Nessuno'], [3, '3'], [5, '5'], [7, '7'], [9, '9']];
const PARTY_ROUNDS: [number, string][] = [[3, '3'], [5, '5'], [8, '8'], [10, '10'], [15, '15']];
const HORROR_PRESSURE: [number, string][] = [[0, 'Tranquilla'], [1, 'Normale'], [2, 'Alta']];
const ASTRO_TASKS: [number, string][] = [[3, '3'], [5, '5'], [7, '7'], [10, '10']];
const ASTRO_KILL: [number, string][] = [[20, '20s'], [30, '30s'], [45, '45s']];
const ASTRO_MEETING: [number, string][] = [[60, '60s'], [90, '90s'], [120, '2 min']];

// Parole del gruppo per Disegna e indovina: si salvano quando si esce dal campo
function CustomWords({ value, disabled, onSave }: { value: string; disabled: boolean; onSave: (text: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <textarea
      value={text}
      disabled={disabled}
      rows={3}
      onChange={(e) => setText(e.target.value.slice(0, 1500))}
      onBlur={() => text !== value && onSave(text)}
      placeholder="es. pizza all'ananas, il nostro gatto, la canzone dell'estate"
      className="w-full resize-none rounded-2xl border-2 border-slate-700 bg-slate-950 px-3 py-2 text-base text-white outline-none placeholder:text-slate-500 focus:border-amber-400 disabled:opacity-70"
    />
  );
}

interface LobbyViewProps {
  state: ClientGameState;
  onUpdateSettings: (settings: Partial<GameSettings>) => void;
  onStart: () => void;
  onKick: (playerId: string, name: string) => void;
}

function Setting({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-black text-slate-200">{label}</p>
      {children}
    </div>
  );
}

// Interruttore con titolo e spiegazione
function Switch({ icon, label, hint, on, green, disabled, onChange }: { icon: string; label: string; hint: string; on: boolean; green?: boolean; disabled: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!on)}
      aria-pressed={on}
      className="flex w-full items-center gap-3 rounded-2xl bg-slate-950/60 p-3 text-left disabled:opacity-80"
    >
      <span className={`text-3xl ${on ? 'wiggle' : 'grayscale-[0.6]'}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-black leading-tight text-white">{label}</span>
        <span className="block text-xs font-semibold leading-snug text-slate-400">{hint}</span>
      </span>
      <span className={`switch ${on ? 'on' : ''} ${green ? 'green' : ''}`}>
        <span />
      </span>
    </button>
  );
}

function Chip({ children, tone = 'dark' }: { children: ReactNode; tone?: 'dark' | 'red' }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-black backdrop-blur ${tone === 'red' ? 'bg-red-500 text-white' : 'bg-black/45 text-white'}`}>{children}</span>
  );
}

export default function LobbyView({ state, onUpdateSettings, onStart, onKick }: LobbyViewProps) {
  const [shareLabel, setShareLabel] = useState('Invita');
  const s = state.settings;
  const isHost = state.myId === state.hostId;
  const host = state.players.find((p) => p.id === state.hostId);
  const canStart = isHost || !host?.isOnline;
  const online = state.players.filter((p) => p.isOnline).length;
  // Axend Party: i bot contano come giocatori
  const horror = state.settings.game === 'HORROR1';
  const flat = flatInfo(state.settings.game); // giochi flat a moduli: minimo e massimo di giocatori loro
  const minPlayers = flat?.min ?? 3;
  const ready = horror
    ? online >= 1 && online <= 8
    : state.settings.game === 'PARTY3D'
      ? online >= 1 && online + state.settings.partyBots >= 3
      : online >= minPlayers && (!flat?.max || online <= flat.max);
  const needed = horror ? 0 : state.settings.game === 'PARTY3D' ? Math.max(0, 3 - online - state.settings.partyBots) : minPlayers - online;
  const selectedCount = DEFAULT_LOCATIONS.filter((l) => s.selectedCategories.includes(l.category)).length;
  const locked = !isHost;
  const current = GAMES.find((g) => g.id === s.game) ?? GAMES[0];

  const share = async () => {
    const result = await shareRoom(state.roomCode);
    if (result === 'copied') {
      setShareLabel('Copiato!');
      setTimeout(() => setShareLabel('Invita'), 2000);
    }
    if (result === 'failed') window.prompt('Copia il link della stanza:', `${window.location.origin}/?room=${state.roomCode}`);
  };

  const toggleCategory = (cat: string) => {
    const next = s.selectedCategories.includes(cat) ? s.selectedCategories.filter((c) => c !== cat) : [...s.selectedCategories, cat];
    if (next.length) onUpdateSettings({ selectedCategories: next });
  };

  return (
    <div className="stagger flex flex-col gap-4">
      {/* Copertina del gioco scelto */}
      <section className="relative overflow-hidden rounded-3xl border-4 border-white/90 bg-slate-900 shadow-[0_8px_0_rgba(22,6,72,0.5)]">
        <span key={current.id} className="sheet-backdrop block">
          <Art
            src={current.banner}
            fallback={<span className="grid aspect-[16/8] w-full place-items-center bg-linear-to-br from-cyan-400 to-slate-700 text-7xl">{current.emoji}</span>}
            className="kenburns aspect-[16/8] w-full object-cover"
          />
        </span>
        <div className="absolute inset-0 bg-linear-to-t from-slate-950/95 via-slate-950/25 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 flex items-end gap-2 p-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap gap-1.5">
              <Chip>Stanza {state.roomCode}</Chip>
              <Chip>{s.privateRoom ? '🔒 Privata' : '🌍 Aperta a tutti'}</Chip>
              {s.spicy && <Chip tone="red">🌶️ Piccante</Chip>}
            </div>
            <p key={current.id} className="pop font-display text-[32px] leading-none text-white [text-shadow:0_3px_0_rgba(0,0,0,0.35)]">
              {current.name}
            </p>
          </div>
          <button type="button" onClick={share} className="shine flex h-12 shrink-0 items-center gap-2 rounded-2xl bg-cyan-500 px-4 font-black text-white">
            <Share2 size={18} /> {shareLabel}
          </button>
        </div>
      </section>

      {/* Scelta del gioco */}
      <section className="rounded-3xl border-2 border-white/10 bg-slate-900 p-3">
        <p className="mb-2 px-1 text-sm font-black text-slate-200">
          🎮 Gioco{locked && <span className="font-sans font-semibold text-slate-400"> · lo sceglie {host?.name}</span>}
        </p>
        <div className="grid grid-cols-3 gap-2">
          {GAMES.map((g) => {
            const on = s.game === g.id;
            return (
              <button
                key={g.id}
                type="button"
                disabled={locked}
                onClick={() => onUpdateSettings({ game: g.id })}
                className={`relative rounded-2xl p-[3px] ${on ? 'rainbow scale-[1.03]' : 'opacity-60'}`}
              >
                {g.isNew && <NewBadge className="absolute -right-1 -top-2 z-10" />}
                <span className="flex h-full flex-col items-center gap-1 rounded-[14px] bg-slate-900 p-1.5 text-center">
                  <Art
                    src={g.banner}
                    fallback={<span className="grid aspect-video w-full place-items-center rounded-xl bg-slate-800 text-3xl">{g.emoji}</span>}
                    className="aspect-video w-full rounded-xl object-cover"
                  />
                  <span className="text-xs font-black leading-tight text-white">{g.name}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Giocatori */}
      <section className="rounded-3xl border-2 border-white/10 bg-slate-900 p-4">
        <h2 className="mb-3 flex items-center justify-between text-xl text-white">
          Giocatori
          <span className="flex items-center gap-2 rounded-full bg-slate-950/70 px-3 py-0.5 font-sans text-sm font-bold text-slate-200">
            <span className="live-dot" /> {online} online
          </span>
        </h2>
        <ul className="grid grid-cols-2 gap-2">
          {state.players.map((p) => (
            <li key={p.id} className={`pop flex items-center gap-2 rounded-2xl bg-slate-800 p-2 transition-opacity ${p.isOnline ? '' : 'opacity-45'}`}>
              <span className="relative shrink-0">
                <Avatar avatar={p.avatar} color={p.color} size={38} />
                {p.isHost && (
                  <span className="float absolute -left-1.5 -top-2.5 text-amber-300 drop-shadow">
                    <Crown size={18} fill="currentColor" />
                  </span>
                )}
                <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slate-800 ${p.isOnline ? 'bg-emerald-400' : 'bg-slate-500'}`} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold leading-tight text-white">{p.name}</p>
                <p className="truncate text-[11px] font-bold leading-tight text-slate-400">
                  {[p.isHost && 'capo', p.id === state.myId && 'tu', !p.isOnline && 'offline'].filter(Boolean).join(' · ') || 'pronto'}
                </p>
              </div>
              {isHost && p.id !== state.myId && (
                <button
                  type="button"
                  onClick={() => onKick(p.id, p.name)}
                  aria-label={`Rimuovi ${p.name}`}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-700 text-slate-300"
                >
                  <X size={16} />
                </button>
              )}
            </li>
          ))}
          {state.players.length < 3 && (
            <li>
              <button
                type="button"
                onClick={share}
                className="flex h-full min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/25 text-sm font-black text-slate-200"
              >
                <UserPlus size={18} /> Invita amici
              </button>
            </li>
          )}
        </ul>
      </section>

      {/* Impostazioni */}
      <section className="flex flex-col gap-4 rounded-3xl border-2 border-white/10 bg-slate-900 p-4">
        <div>
          <h2 className="text-xl text-white">Impostazioni</h2>
          {locked && <p className="text-sm font-semibold text-slate-400">Le decide {host?.name ?? 'chi ha creato la stanza'}.</p>}
        </div>
        <div className="flex flex-col gap-2">
          <Switch
            icon="🔒"
            label="Stanza privata"
            hint={s.privateRoom ? 'Nascosta dalla lista: si entra solo con il link o il codice.' : 'Ora è nella lista delle stanze aperte: tutti possono entrare.'}
            on={s.privateRoom}
            green
            disabled={locked}
            onChange={(privateRoom) => onUpdateSettings({ privateRoom })}
          />
          <Switch
            icon="🌶️"
            label="Contenuti piccanti"
            hint="Parole, idee e luoghi più sgravati. Solo tra adulti!"
            on={s.spicy}
            disabled={locked}
            onChange={(spicy) => onUpdateSettings({ spicy })}
          />
        </div>
        {s.game === 'TELEFONO' && (
          <Setting label="⏱️ Tempo per disegnare">
            <Segmented options={DRAW_TIMES} value={s.drawSeconds} disabled={locked} onChange={(v) => onUpdateSettings({ drawSeconds: v })} />
            <p className="mt-1.5 text-xs font-semibold text-slate-400">Per scrivere al massimo 45 secondi. Con ∞ si va avanti quando tutti hanno finito.</p>
          </Setting>
        )}
        {s.game === 'DISEGNA' && (
          <>
            <Setting label="🔁 Quante volte disegna ognuno">
              <Segmented options={ROUNDS} value={s.drawRounds} disabled={locked} onChange={(v) => onUpdateSettings({ drawRounds: v })} />
            </Setting>
            <Setting label="⏱️ Secondi per disegnare">
              <Segmented options={GUESS_TIMES} value={s.guessSeconds} disabled={locked} onChange={(v) => onUpdateSettings({ guessSeconds: v })} />
            </Setting>
            <Setting label="✍️ Parole vostre (separate da virgola)">
              <CustomWords value={s.customWords} disabled={locked} onSave={(customWords) => onUpdateSettings({ customWords })} />
              <button
                type="button"
                disabled={locked}
                onClick={() => onUpdateSettings({ onlyCustom: !s.onlyCustom })}
                className="mt-2 flex items-center gap-2 text-sm font-bold text-slate-200"
              >
                <span className={`grid h-6 w-6 place-items-center rounded-md border-2 ${s.onlyCustom ? 'border-amber-400 bg-amber-400 text-slate-950' : 'border-slate-600'}`}>
                  {s.onlyCustom ? '✓' : ''}
                </span>
                Usa solo le parole vostre
              </button>
            </Setting>
          </>
        )}
        {s.game === 'BOMBA' && (
          <>
            <Setting label="💣 Tipo di sfida">
              <Segmented
                options={BOMBA_MODES}
                value={BOMBA_MODE_IDS.indexOf(s.bombaMode)}
                disabled={locked}
                onChange={(v) => onUpdateSettings({ bombaMode: BOMBA_MODE_IDS[v] })}
              />
              <p className="mt-1.5 text-xs font-semibold text-slate-400">
                Sillabe: una parola che contiene «CA». Cose: qualcosa di una categoria. Lettere: una parola che inizia con «M».
              </p>
            </Setting>
            <Setting label="❤️ Vite per giocatore">
              <Segmented options={LIVES} value={s.bombaLives} disabled={locked} onChange={(v) => onUpdateSettings({ bombaLives: v })} />
            </Setting>
          </>
        )}
        {s.game === 'ARTISTA' && (
          <p className="text-sm font-semibold text-slate-300">
            Ognuno fa un solo tratto per turno, due giri, ognuno col suo colore. L'impostore conosce solo la categoria. Niente da impostare: avviate!
          </p>
        )}
        {s.game === 'BATTUTE' && (
          <>
            <Setting label="🔁 Round">
              <Segmented options={ROUNDS} value={s.battuteRounds} disabled={locked} onChange={(v) => onUpdateSettings({ battuteRounds: v })} />
            </Setting>
            <Setting label="⏱️ Tempo per scrivere">
              <Segmented options={WRITE_TIMES} value={s.writeSeconds} disabled={locked} onChange={(v) => onUpdateSettings({ writeSeconds: v })} />
            </Setting>
            <p className="text-xs font-semibold text-slate-400">Ognuno completa due frasi; poi sfide a due e il gruppo vota la battuta più divertente.</p>
          </>
        )}
        {s.game === 'PREFERIRESTI' && (
          <Setting label="❓ Quante domande">
            <Segmented options={QUESTIONS} value={s.prefQuestions} disabled={locked} onChange={(v) => onUpdateSettings({ prefQuestions: v })} />
          </Setting>
        )}
        {s.game === 'SINTONIA' && (
          <Setting label="🔮 Quante volte fa il sensitivo ognuno">
            <Segmented options={LAPS} value={s.sintoniaLaps} disabled={locked} onChange={(v) => onUpdateSettings({ sintoniaLaps: v })} />
          </Setting>
        )}
        {s.game === 'TABU' && (
          <>
            <Setting label="⏱️ Secondi per turno">
              <Segmented options={TABU_TIMES} value={s.tabuSeconds} disabled={locked} onChange={(v) => onUpdateSettings({ tabuSeconds: v })} />
            </Setting>
            <Setting label="🔁 Quante volte parla ognuno">
              <Segmented options={LAPS} value={s.tabuLaps} disabled={locked} onChange={(v) => onUpdateSettings({ tabuLaps: v })} />
            </Setting>
            <p className="text-xs font-semibold text-slate-400">Le squadre 🔴 Rossi e 🔵 Blu si formano a caso quando parte la partita.</p>
          </>
        )}
        {s.game === 'HORROR1' && (
          <>
            <Setting label="🔦 Pressione">
              <Segmented options={HORROR_PRESSURE} value={s.horrorPressure ?? 1} disabled={locked} onChange={(v) => onUpdateSettings({ horrorPressure: v })} />
            </Setting>
            <p className="text-xs font-semibold text-slate-400">
              Da 1 a 8 persone (meglio 3-7), con cuffie e microfono. La pressione cambia segnali, tempi e pause del Custode, non le sue regole.
            </p>
          </>
        )}
        {s.game === 'PARTY3D' && (
          <>
            <Setting label="🤖 Bot che giocano con voi">
              <Segmented options={PARTY_BOTS} value={s.partyBots} disabled={locked} onChange={(v) => onUpdateSettings({ partyBots: v })} />
            </Setting>
            <Setting label="🎮 Quanti minigiochi">
              <Segmented options={PARTY_ROUNDS} value={s.partyRounds} disabled={locked} onChange={(v) => onUpdateSettings({ partyRounds: v })} />
            </Setting>
            <p className="text-xs font-semibold text-slate-400">
              Videogioco 3D: joystick e SALTA/SPINGI sul telefono, WASD + spazio + E sul PC. I bot riempiono la partita se siete in pochi.
            </p>
          </>
        )}
        {s.game === 'ASTRO' && (
          <>
            <Setting label="😈 Impostori">
              <Segmented options={COUNTS} value={s.spiesCount} disabled={locked} onChange={(v) => onUpdateSettings({ spiesCount: v })} />
            </Setting>
            <Setting label="📋 Compiti a testa">
              <Segmented options={ASTRO_TASKS} value={s.astroTasks} disabled={locked} onChange={(v) => onUpdateSettings({ astroTasks: v })} />
            </Setting>
            <Setting label="🔪 Ricarica tra un’eliminazione e l’altra">
              <Segmented options={ASTRO_KILL} value={s.astroKill} disabled={locked} onChange={(v) => onUpdateSettings({ astroKill: v })} />
            </Setting>
            <Setting label="🗣️ Durata della riunione">
              <Segmented options={ASTRO_MEETING} value={s.astroMeeting} disabled={locked} onChange={(v) => onUpdateSettings({ astroMeeting: v })} />
            </Setting>
            <p className="text-xs font-semibold text-slate-400">
              Più bello da 5 giocatori in su (2 impostori da 7). Sul telefono si gioca col joystick, sul PC con WASD o le frecce.
            </p>
          </>
        )}
        {s.game === 'TEATRINO' && (
          <Setting label="🔁 Quante volte recita ognuno">
            <Segmented options={LAPS} value={s.teatroLaps} disabled={locked} onChange={(v) => onUpdateSettings({ teatroLaps: v })} />
          </Setting>
        )}
        {s.game === 'SMORFIE' && (
          <>
            <Setting label="🔁 Round di selfie">
              <Segmented options={ROUNDS} value={s.smorfieRounds} disabled={locked} onChange={(v) => onUpdateSettings({ smorfieRounds: v })} />
            </Setting>
            <p className="text-xs font-semibold text-slate-400">Serve la fotocamera (o una foto dalla galleria). I selfie si cancellano quando inizia un’altra partita.</p>
          </>
        )}
        {s.game === 'DADI' && (
          <Setting label="🎲 Dadi a testa">
            <Segmented options={DICE} value={s.diceCount} disabled={locked} onChange={(v) => onUpdateSettings({ diceCount: v })} />
          </Setting>
        )}
        {s.game === 'OCA' && (
          <p className="text-sm font-semibold text-slate-300">
            40 caselle: oche, ponte, osteria, pozzo, scheletro… e caselle sfida dove il gruppo vota. Vince chi arriva per primo al traguardo!
          </p>
        )}
        {s.game === 'NONRIDERE' && (
          <Setting label="🔁 Quante volte fa il comico ognuno">
            <Segmented options={LAPS} value={s.nrLaps} disabled={locked} onChange={(v) => onUpdateSettings({ nrLaps: v })} />
          </Setting>
        )}
        {s.game === 'CHISONO' && (
          <p className="text-sm font-semibold text-slate-300">
            Ognuno riceve un personaggio famoso che vedono tutti tranne lui. A turno domande sì/no, a voce. Niente da impostare: avviate!
          </p>
        )}
        {s.game === 'IMPOSTORE' && (
          <>
            <Setting label="⏱️ Minuti per round">
              <Segmented options={TIMES} value={s.roundTimeSeconds} disabled={locked} onChange={(v) => onUpdateSettings({ roundTimeSeconds: v })} />
            </Setting>
            <Setting label="🎭 Numero di impostori">
              <Segmented options={COUNTS} value={s.spiesCount} disabled={locked} onChange={(v) => onUpdateSettings({ spiesCount: v })} />
            </Setting>
            <Setting label="🤫 L'impostore riceve">
              <Segmented options={IMPOSTOR_WORD} value={s.impostorWord ? 1 : 0} disabled={locked} onChange={(v) => onUpdateSettings({ impostorWord: v === 1 })} />
              <p className="mt-1.5 text-xs font-semibold text-slate-400">
                {s.impostorWord ? 'Con la parola simile, l’impostore non sa di esserlo: più risate!' : 'Senza parola, l’impostore sa di esserlo e deve bluffare.'}
              </p>
            </Setting>
          </>
        )}
        {flat && (
          <>
            {flat.options.map((o) => (
              <Setting key={o.key} label={o.label}>
                <Segmented
                  options={o.values}
                  value={flatOpt(s, flat.id as FlatId, o.key)}
                  disabled={locked}
                  onChange={(v) => onUpdateSettings({ extra: { [o.key]: v } })}
                />
              </Setting>
            ))}
            <p className="text-xs font-semibold text-slate-400">
              {flat.max ? `Da ${flat.min} a ${flat.max} giocatori.` : `Almeno ${flat.min} ${flat.min === 1 ? 'giocatore' : 'giocatori'}.`} Le regole sono nel libretto in alto.
            </p>
          </>
        )}
        {s.game === 'SPIA' && (
          <>
            <Setting label="⏱️ Minuti per round">
              <Segmented options={TIMES} value={s.roundTimeSeconds} disabled={locked} onChange={(v) => onUpdateSettings({ roundTimeSeconds: v })} />
            </Setting>
            <Setting label="🕵️ Numero di spie">
              <Segmented options={COUNTS} value={s.spiesCount} disabled={locked} onChange={(v) => onUpdateSettings({ spiesCount: v })} />
            </Setting>
            <Setting label="🎭 Ruoli (es. Panettiere, Cassiera)">
              <Segmented options={YES_NO} value={s.rolesEnabled ? 1 : 0} disabled={locked} onChange={(v) => onUpdateSettings({ rolesEnabled: v === 1 })} />
            </Setting>
            <Setting label={`📍 Luoghi in gioco: ${selectedCount}${s.spicy ? ' + 14 piccanti 🌶️' : ''}`}>
              <div className="flex flex-wrap gap-2">
                {LOCATION_CATEGORIES.map((cat) => {
                  const on = s.selectedCategories.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      disabled={locked}
                      onClick={() => toggleCategory(cat)}
                      className={`rounded-full border-2 px-3 py-1.5 text-sm font-bold transition-colors ${on ? 'border-amber-400 bg-amber-300/15 text-amber-50' : 'border-slate-700 text-slate-400'}`}
                    >
                      {CATEGORY_ICONS[cat]} {cat}
                    </button>
                  );
                })}
              </div>
            </Setting>
          </>
        )}
      </section>

      <BottomBar>
        {canStart ? (
          <>
            <div className={`rounded-[1.6rem] ${ready ? 'rainbow p-[3px]' : ''}`}>
              <button
                type="button"
                onClick={onStart}
                disabled={!ready}
                className={`h-16 w-full rounded-2xl bg-amber-400 text-xl font-black text-slate-950 disabled:opacity-60 ${ready ? 'shine' : ''}`}
              >
                {!ready
                  ? state.settings.game === 'PARTY3D'
                    ? `Aggiungi ${needed} bot o giocatori`
                    : flat?.max && online > flat.max
                      ? `Massimo ${flat.max} giocatori (${online})`
                      : `Servono ${minPlayers} giocatori (${online}/${minPlayers})`
                  : 'Avvia la partita'}
              </button>
            </div>
            {!isHost && <p className="text-center text-xs font-bold text-slate-200">{host?.name} è offline: puoi avviare tu.</p>}
          </>
        ) : (
          <p className="rounded-2xl border-2 border-slate-700 bg-slate-900/95 py-4 text-center font-bold text-slate-200">In attesa che {host?.name} avvii la partita…</p>
        )}
      </BottomBar>
    </div>
  );
}
