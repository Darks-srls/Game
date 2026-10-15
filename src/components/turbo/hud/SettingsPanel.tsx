// ⚽🚗 Axend Turbo — impostazioni (dall'ingranaggio o con Esc): schede Comandi, Telecamera, Grafica, Telefono.
// Comandi: la lista delle azioni, tocca un tasto e "premi un tasto" per riassegnarlo (tastiera e mouse, o controller) + ripristina.
// Tutto si salva da solo nel browser (prefs: 'axend_turbo_prefs', tasti: 'axend_turbo_keys' e 'axend_turbo_pad').
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { UiIcon } from '../../party3d/icons';
import { DEFAULT_CAM, type CamSettings, type Quality } from '../contract';
import { PAD_ACTIONS } from '../input/gamepad';
import { KEY_ACTIONS, keyLabel, padLabel } from '../input/keyboard';
import { ACTION_INFO, type ActionGroup } from '../input/labels';
import type { TurboInput } from '../input/manager';
import { DEFAULT_PHONE, isCoarsePointer, saveTurboPrefs, type PhonePrefs, type TurboPrefs } from '../input/prefs';
import type { KeyAction } from '../input/types';

export type SettingsTab = 'comandi' | 'telecamera' | 'grafica' | 'telefono';

export interface SettingsPanelProps {
  prefs: TurboPrefs;
  onChange: (p: TurboPrefs) => void; // il pannello ha già salvato e passato le nuove impostazioni a `input`
  input?: TurboInput | null; // serve per riassegnare i tasti (senza: la lista si vede ma non si cambia)
  onClose: () => void; // "Riprendi"
  onLeave?: () => void; // "Esci dalla partita"
  onEndMatch?: () => void; // "Termina" (solo chi guida la stanza)
  initialTab?: SettingsTab;
}

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'comandi', label: 'Comandi' },
  { id: 'telecamera', label: 'Telecamera' },
  { id: 'grafica', label: 'Grafica' },
  { id: 'telefono', label: 'Telefono' },
];

export function SettingsPanel({ prefs, onChange, input, onClose, onLeave, onEndMatch, initialTab }: SettingsPanelProps) {
  const [tab, setTab] = useState<SettingsTab>(initialTab ?? (isCoarsePointer() ? 'telefono' : 'comandi'));
  const update = (next: TurboPrefs) => {
    saveTurboPrefs(next);
    input?.setPrefs(next);
    onChange(next);
  };
  return (
    <div
      data-turbo-ui
      className="absolute inset-0 z-[60] grid place-items-center bg-[#0b0623]/70 p-3 backdrop-blur-sm pt-[max(12px,env(safe-area-inset-top))] pb-[max(12px,env(safe-area-inset-bottom))]"
      onPointerDown={(e) => e.target === e.currentTarget && !input?.keyboard.capturing && onClose()}
    >
      <div className="sc-panel pop flex max-h-full w-full max-w-xl flex-col gap-3 overflow-hidden p-4">
        <div className="flex items-center justify-between">
          <h3 className="sc-stroke font-display text-[30px] leading-none text-white">Impostazioni</h3>
          <button type="button" onClick={onClose} className="sc-btn sc-red grid h-11 w-11 place-items-center font-display text-xl" aria-label="Chiudi">
            ✕
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TABS.map((t) => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)} className={`sc-btn py-2 font-display text-lg ${tab === t.id ? 'sc-yellow' : 'sc-dark'}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 pb-1">
          {tab === 'comandi' && <ControlsTab input={input} prefs={prefs} update={update} />}
          {tab === 'telecamera' && <CameraTab cam={prefs.cam} set={(cam) => update({ ...prefs, cam })} />}
          {tab === 'grafica' && <GraphicsTab quality={prefs.quality} set={(quality) => update({ ...prefs, quality })} />}
          {tab === 'telefono' && <PhoneTab phone={prefs.phone} set={(phone) => update({ ...prefs, phone })} />}
        </div>

        <div className={`grid gap-2.5 ${onLeave && onEndMatch ? 'grid-cols-3' : onLeave || onEndMatch ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <button type="button" onClick={onClose} className="sc-btn sc-green py-3 font-display text-xl">
            Riprendi
          </button>
          {onEndMatch && (
            <button type="button" onClick={onEndMatch} className="sc-btn sc-yellow py-3 font-display text-xl">
              Termina
            </button>
          )}
          {onLeave && (
            <button type="button" onClick={onLeave} className="sc-btn sc-red flex items-center justify-center gap-1.5 py-3 font-display text-xl">
              <UiIcon name="exit" size={22} /> Esci
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- pezzi comuni
function Section({ title, children, note }: { title: string; children: ReactNode; note?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <h4 className="sc-stroke-sm font-display text-xl leading-none text-amber-300">{title}</h4>
      {children}
      {note && <p className="text-sm font-bold leading-snug text-white/70">{note}</p>}
    </div>
  );
}

function Slider({ label, value, min, max, step, fmt, onChange }: { label: string; value: number; min: number; max: number; step: number; fmt: (v: number) => string; onChange: (v: number) => void }) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <label className="flex flex-col gap-2">
      <span className="flex items-center gap-2 text-base font-black text-white">
        {label}
        <span className="ml-auto font-display text-lg text-amber-300 tabular-nums">{fmt(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="sc-range w-full"
        style={{ ['--fill' as string]: `${fill}%` }}
      />
    </label>
  );
}

function Toggle({ label, desc, on, set }: { label: string; desc?: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => set(!on)} className="flex items-center gap-3 rounded-2xl border-[3px] border-[#1d0f3d] bg-white/10 p-3 text-left">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-base font-black leading-tight text-white">{label}</span>
        {desc && <span className="mt-0.5 text-sm font-bold leading-snug text-white/70">{desc}</span>}
      </span>
      <span className={`sc-btn ${on ? 'sc-green' : 'sc-dark'} shrink-0 px-3 py-1 font-display text-lg`}>{on ? 'SÌ' : 'NO'}</span>
    </button>
  );
}

// ---------------------------------------------------------------- Comandi
type Device = 'tastiera' | 'controller';
const GROUPS: ActionGroup[] = ['Guida', 'In aria', 'Partita'];

function ControlsTab({ input, prefs, update }: { input?: TurboInput | null; prefs: TurboPrefs; update: (p: TurboPrefs) => void }) {
  const [device, setDevice] = useState<Device>(input?.device === 'controller' ? 'controller' : 'tastiera');
  const [capturing, setCapturing] = useState<{ action: KeyAction; slot: 0 | 1 } | null>(null);
  const [, setVersion] = useState(0);
  const cancel = useRef<(() => void) | null>(null);
  const [padName, setPadName] = useState<string | null>(() => input?.gamepad.name() ?? null);

  // il nome del controller collegato (si aggiorna da solo)
  useEffect(() => {
    if (device !== 'controller' || !input) return;
    const id = setInterval(() => setPadName(input.gamepad.name()), 800);
    return () => clearInterval(id);
  }, [device, input]);

  // si annulla l'attesa del tasto se si cambia scheda o si chiude
  useEffect(
    () => () => {
      cancel.current?.();
      cancel.current = null;
    },
    [],
  );
  const stopCapture = () => {
    cancel.current?.();
    cancel.current = null;
    setCapturing(null);
  };
  useEffect(stopCapture, [device]);

  const map = input ? (device === 'tastiera' ? input.keyboard.map : input.gamepad.map) : null;
  const actions = device === 'tastiera' ? KEY_ACTIONS : PAD_ACTIONS;
  const label = device === 'tastiera' ? keyLabel : padLabel;

  const startCapture = (action: KeyAction, slot: 0 | 1) => {
    if (!input) return;
    stopCapture();
    setCapturing({ action, slot });
    const done = (code: string | null) => {
      cancel.current = null;
      setCapturing(null);
      if (code === null) return;
      if (device === 'tastiera') input.keyboard.bind(action, slot, code);
      else input.gamepad.bind(action, slot, code);
      setVersion((v) => v + 1);
    };
    cancel.current = device === 'tastiera' ? input.keyboard.captureNext(done) : input.gamepad.captureNext(done);
  };

  const reset = () => {
    if (!input) return;
    stopCapture();
    if (device === 'tastiera') input.keyboard.resetMap();
    else input.gamepad.resetMap();
    setVersion((v) => v + 1);
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        {(['tastiera', 'controller'] as Device[]).map((d) => (
          <button key={d} type="button" onClick={() => setDevice(d)} className={`sc-btn py-2 font-display text-base ${device === d ? 'sc-blue' : 'sc-dark'}`}>
            {d === 'tastiera' ? 'Tastiera e mouse' : 'Controller'}
          </button>
        ))}
      </div>

      {device === 'controller' && (
        <div className="flex flex-col gap-3">
          <p className={`sc-chip px-3 py-2 text-sm font-black ${padName ? 'text-lime-300' : 'text-white/80'}`}>{padName ? `Collegato: ${padName}` : 'Nessun controller: collegalo e premi un pulsante'}</p>
          <Slider label="Zona morta delle levette" value={prefs.padDeadzone} min={0.05} max={0.4} step={0.01} fmt={(v) => v.toFixed(2)} onChange={(v) => update({ ...prefs, padDeadzone: v })} />
          <p className="text-sm font-bold leading-snug text-white/70">Levetta sinistra: sterzo, muso su/giù e imbardata. Levetta destra: sguardo libero.</p>
        </div>
      )}

      <p className="rounded-2xl border-[3px] border-[#1d0f3d] bg-white/10 px-3 py-2 text-sm font-bold leading-snug text-white/85">
        {capturing ? (
          <>
            <span className="font-display text-base text-amber-300">Premi un {device === 'tastiera' ? 'tasto o un pulsante del mouse' : 'pulsante del controller'}</span>
            {device === 'tastiera' ? ' · Esc per annullare · Canc per togliere' : ''}
          </>
        ) : (
          'Tocca un tasto per cambiarlo. Più azioni possono stare sullo stesso tasto (come W: accelera e muso giù).'
        )}
      </p>

      {!input && <p className="text-sm font-bold text-red-300">I comandi si possono cambiare solo durante la partita.</p>}

      {map &&
        GROUPS.map((g) => {
          const rows = ACTION_INFO.filter((i) => i.group === g && actions.includes(i.action));
          if (!rows.length) return null;
          return (
            <Section key={g} title={g}>
              <div className="flex flex-col gap-1.5">
                {rows.map((r) => (
                  <div key={r.action} className="flex items-center gap-2 rounded-xl bg-[#1d0f3d]/45 px-2.5 py-1.5">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-[15px] font-black leading-tight text-white">{r.label}</span>
                      {r.hint && <span className="text-xs font-bold leading-tight text-white/60">{r.hint}</span>}
                    </span>
                    {([0, 1] as const).map((slot) => {
                      const on = capturing?.action === r.action && capturing.slot === slot;
                      const code = map[r.action][slot];
                      return (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => (on ? stopCapture() : startCapture(r.action, slot))}
                          disabled={!input}
                          className={`sc-btn min-w-[74px] shrink-0 !rounded-xl px-2 py-1 font-display text-[15px] leading-tight sm:min-w-[92px] ${on ? 'sc-yellow pulse-soft' : code ? 'sc-dark' : 'sc-dark opacity-60'}`}
                        >
                          {on ? 'Premi…' : label(code)}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </Section>
          );
        })}

      {device === 'tastiera' && (
        <p className="text-sm font-bold leading-snug text-white/70">Attenzione: Ctrl + W chiude la scheda del browser. Mentre tieni premuti i tasti di gioco il browser chiede prima conferma; se ti dà fastidio, sposta il rollio libero su un altro tasto.</p>
      )}

      <button type="button" onClick={reset} disabled={!input} className="sc-btn sc-purple py-2.5 font-display text-lg disabled:opacity-50">
        Ripristina {device === 'tastiera' ? 'tastiera' : 'controller'} (come Rocket League)
      </button>
    </>
  );
}

// ---------------------------------------------------------------- Telecamera
const CAM_SLIDERS: { key: Exclude<keyof CamSettings, 'ballCam'>; label: string; min: number; max: number; step: number; fmt: (v: number) => string }[] = [
  { key: 'fov', label: 'Campo visivo', min: 60, max: 110, step: 1, fmt: (v) => `${v}°` },
  { key: 'distance', label: 'Distanza', min: 100, max: 400, step: 10, fmt: (v) => `${v}` },
  { key: 'height', label: 'Altezza', min: 40, max: 200, step: 10, fmt: (v) => `${v}` },
  { key: 'angle', label: 'Inclinazione', min: -15, max: 0, step: 1, fmt: (v) => `${v}°` },
  { key: 'stiffness', label: 'Rigidità', min: 0, max: 1, step: 0.05, fmt: (v) => v.toFixed(2) },
  { key: 'swivel', label: 'Velocità dello sguardo libero', min: 1, max: 10, step: 0.1, fmt: (v) => v.toFixed(1) },
];

function CameraTab({ cam, set }: { cam: CamSettings; set: (c: CamSettings) => void }) {
  return (
    <>
      <Toggle label="Telecamera palla" desc="Accesa: la visuale tiene sempre in vista la palla. Si cambia anche in partita (C, rotella, Y o PALLA)." on={cam.ballCam} set={(v) => set({ ...cam, ballCam: v })} />
      <Section title="Visuale" note="Più distanza e campo visivo = vedi più campo; più rigidità = la telecamera resta attaccata alla macchina anche col boost.">
        {CAM_SLIDERS.map((s) => (
          <Slider key={s.key} label={s.label} value={cam[s.key]} min={s.min} max={s.max} step={s.step} fmt={s.fmt} onChange={(v) => set({ ...cam, [s.key]: v })} />
        ))}
      </Section>
      <button type="button" onClick={() => set({ ...DEFAULT_CAM })} className="sc-btn sc-purple py-2.5 font-display text-lg">
        Ripristina (come Rocket League)
      </button>
    </>
  );
}

// ---------------------------------------------------------------- Grafica
const QUALITIES: { id: Quality; label: string; desc: string }[] = [
  { id: 'alta', label: 'Alta', desc: 'Ombre, riflessi ed effetti al massimo (PC e telefoni potenti)' },
  { id: 'media', label: 'Media', desc: 'Bilanciata: va bene sulla maggior parte dei telefoni' },
  { id: 'bassa', label: 'Bassa', desc: 'Più fluida sui telefoni vecchi o se scalda' },
];

function GraphicsTab({ quality, set }: { quality: Quality; set: (q: Quality) => void }) {
  return (
    <Section title="Qualità grafica">
      <div className="flex flex-col gap-2">
        {QUALITIES.map((q) => (
          <button key={q.id} type="button" onClick={() => set(q.id)} className={`sc-btn flex flex-col items-start px-4 py-2.5 text-left ${quality === q.id ? 'sc-yellow' : 'sc-dark'}`}>
            <span className="font-display text-xl leading-tight">{q.label}</span>
            <span className={`text-sm font-bold leading-snug ${quality === q.id ? 'text-[#1d0f3d]/80' : 'text-white/70'}`}>{q.desc}</span>
          </button>
        ))}
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------- Telefono
function PhoneTab({ phone, set }: { phone: PhonePrefs; set: (p: PhonePrefs) => void }) {
  return (
    <>
      <Toggle label="Accelera da solo" desc="La macchina va sempre avanti, come nei giochi per telefono. Tieni RETRO per frenare e andare indietro." on={phone.autoThrottle} set={(v) => set({ ...phone, autoThrottle: v })} />
      <Toggle label="Raddrizza in aria da sola" desc="Quando non tocchi il joystick in aria, la macchina si gira con le ruote verso terra." on={phone.autoAirOrient} set={(v) => set({ ...phone, autoAirOrient: v })} />
      <Section title="Joystick">
        <Slider label="Grandezza" value={phone.joySize} min={0.8} max={1.4} step={0.05} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set({ ...phone, joySize: v })} />
        <Slider label="Sensibilità" value={phone.joySens} min={0.6} max={1.8} step={0.05} fmt={(v) => v.toFixed(2)} onChange={(v) => set({ ...phone, joySens: v })} />
      </Section>
      <button type="button" onClick={() => set({ ...DEFAULT_PHONE })} className="sc-btn sc-purple py-2.5 font-display text-lg">
        Ripristina telefono
      </button>
      <Section title="Come si gioca sul telefono">
        <ul className="flex flex-col gap-1 text-sm font-bold leading-snug text-white/85">
          <li>• Joystick a sinistra: sterza. In aria: muso su/giù e gira.</li>
          <li>• SALTA due volte: doppio salto. SALTA + joystick in aria: capriola.</li>
          <li>• BOOST: tienilo premuto. Puoi scivolare col pollice da BOOST a SALTA.</li>
          <li>• DRIFT: derapata a terra; in aria fa rollare la macchina col joystick.</li>
          <li>• ASSISTITO: per 5 secondi guida il bot (parate, passaggi, tiri), poi si ricarica.</li>
          <li>• Trascina nello spazio vuoto a destra per guardarti intorno.</li>
        </ul>
      </Section>
    </>
  );
}
