// Cosa c'è da fare adesso: per ogni linea di lavoro il prossimo passo, dove farlo e i punti da indicare a schermo.
// Tutto ricavato dallo stato della partita (uguale per tutti), così la squadra sa sempre a che punto è.
import type { Horror1View } from '../../types/game';
import { BATTERY_SPOTS, FLOOR_NAMES, MODULE_SPOTS, STATIONS, floorBase } from '../../data/horror1';

export interface Target {
  f: number;
  x: number;
  y: number;
  z: number;
  label: string;
  maybe?: boolean; // posizione possibile (oggetto non ancora trovato)
}
export interface Objective {
  id: 'luci' | 'pompa' | 'batteria' | 'collaudo' | 'perdita' | 'uscita' | 'soccorso' | 'cura';
  title: string;
  done: boolean;
  blocked?: boolean;
  step: string; // il prossimo passo, scritto chiaro
  where?: string; // dove
  targets: Target[];
}

const st = (id: string, label?: string): Target => {
  const s = STATIONS.find((x) => x.id === id)!;
  return { f: s.f, x: s.x, y: floorBase(s.f) + s.y + 0.3, z: s.z, label: label ?? s.name };
};
const fl = (f: number) => FLOOR_NAMES[f].toLowerCase();

export function objectives(v: Horror1View, me: string, nameOf: (id: string) => string, now: number, posOf: (id: string) => { f: number; x: number; y: number; z: number } | null = () => null): Objective[] {
  const item = (kind: string) => v.items.find((i) => i.kind === kind) ?? null;
  const out: Objective[] = [];
  const mine = v.players[me]?.carrying;

  // ---- luci del secondo piano
  {
    const o: Objective = { id: 'luci', title: 'Luci del secondo piano', done: v.luce === 'ok', step: '', targets: [] };
    if (v.luce === 'ok') o.step = 'Ripristinate';
    else if (!v.modulo) {
      const m = item('modulo');
      if (m?.by === me) {
        o.step = 'Inserisci il modulo nel quadro luci';
        o.where = 'Piano terra · locale contatori (a sinistra dell’atrio)';
        o.targets.push(st('pannello'));
      } else if (m?.by) {
        o.step = `${nameOf(m.by)} porta il modulo al quadro luci`;
        o.where = 'Piano terra · locale contatori';
        o.targets.push(st('pannello'));
      } else if (m && v.found.includes(m.id)) {
        o.step = 'Prendi il modulo luci';
        o.where = `${FLOOR_NAMES[m.f]} · dove l’avete trovato`;
        o.targets.push({ f: m.f, x: m.x, y: m.y + 0.4, z: m.z, label: 'Modulo luci' });
      } else {
        o.step = 'Trova il modulo luci';
        o.where = 'Può essere in officina (cantina), nel deposito bici (piano terra) o su un tavolo del primo piano';
        for (const s of MODULE_SPOTS) o.targets.push({ f: s.f, x: s.x, y: floorBase(s.f) + s.y + 0.4, z: s.z, label: 'Modulo luci?', maybe: true });
      }
    } else if (v.luce === 'spenta') {
      o.step = 'Avvia il test: tieni giù la leva del quadro luci (fa rumore)';
      o.where = 'Piano terra · locale contatori';
      o.targets.push(st('pannello'));
    } else {
      const left = Math.max(0, Math.ceil((v.luceTestUntil - now) / 1000));
      o.step = `Conta quante volte lampeggia la lampada di prova e imposta il numero sul quadro (${left} s)`;
      o.where = 'Lampada: secondo piano, in fondo al corridoio · Quadro: piano terra. In due: uno conta e lo dice a voce';
      o.targets.push(st('lampada'), st('pannello'));
    }
    out.push(o);
  }

  // ---- pompa della cantina
  {
    const o: Objective = { id: 'pompa', title: 'Pompa della cantina', done: v.pompaOn, step: '', targets: [] };
    const f = item('filtro');
    if (v.pompaOn) o.step = v.acqua > 0.02 ? `In funzione · acqua al ${Math.round(v.acqua * 100)}%` : 'In funzione · lavanderia asciutta';
    else if (v.filtro === 'sporco') {
      o.step = 'Svita il filtro intasato dalla pompa';
      o.where = 'Cantina · locale pompa (a destra delle scale)';
      o.targets.push(st('filtro'));
    } else if (v.filtro === 'fuori' && f) {
      if (!f.clean) {
        if (f.by === me) {
          o.step = 'Strofina il filtro al lavello finché è pulito';
          o.where = 'Cantina · officina (a sinistra delle scale)';
          o.targets.push(st('lavello'));
        } else if (f.by) {
          o.step = `${nameOf(f.by)} porta il filtro al lavello dell’officina`;
          o.targets.push(st('lavello'));
        } else {
          o.step = 'Riprendi il filtro e puliscilo al lavello';
          o.where = `${FLOOR_NAMES[f.f]} · dove è stato appoggiato`;
          o.targets.push({ f: f.f, x: f.x, y: f.y + 0.4, z: f.z, label: 'Filtro' });
        }
      } else {
        o.step = f.by === me ? 'Riavvita il filtro pulito nella pompa' : f.by ? `${nameOf(f.by)} rimonta il filtro pulito` : 'Riprendi il filtro pulito e rimontalo';
        o.where = 'Cantina · locale pompa';
        o.targets.push(f.by ? st('filtro') : { f: f.f, x: f.x, y: f.y + 0.4, z: f.z, label: 'Filtro pulito' });
      }
    } else {
      o.step = 'Riavvia la pompa: tieni la lancetta della pressione nel verde (rumoroso; nel rosso si guasta)';
      o.where = 'Cantina · locale pompa · in due è più facile: chi guarda il livello in lavanderia allarga la zona verde';
      o.targets.push(st('pompa'), st('livello', 'Livello acqua'));
    }
    out.push(o);
  }

  // ---- batteria di emergenza
  {
    const o: Objective = { id: 'batteria', title: 'Batteria di emergenza', done: v.batteria, step: '', targets: [] };
    const b = item('batteria');
    if (v.batteria) o.step = 'Installata';
    else if (v.doors['c-deposito']?.lock === 'acqua') {
      o.blocked = true;
      o.step = 'Il deposito è allagato: prima riavvia la pompa';
      o.where = 'Cantina · deposito (dietro la lavanderia)';
    } else if (b?.by === me) {
      o.step = 'Porta la batteria all’alloggiamento e collega i cavi (sei più lento)';
      o.where = 'Piano terra · corridoio di servizio, accanto all’uscita';
      o.targets.push(st('alloggio'));
    } else if (b?.by) {
      o.step = `${nameOf(b.by)} porta la batteria all’uscita di servizio`;
      o.targets.push(st('alloggio'));
    } else if (b) {
      o.step = 'Prendi la batteria';
      o.where = v.found.includes(b.id) ? `${FLOOR_NAMES[b.f]} · dove l’avete trovata` : 'Cantina · nel deposito (dietro la lavanderia)';
      if (v.found.includes(b.id)) o.targets.push({ f: b.f, x: b.x, y: b.y + 0.4, z: b.z, label: 'Batteria' });
      else for (const s of BATTERY_SPOTS) o.targets.push({ f: s.f, x: s.x, y: floorBase(s.f) + 0.5, z: s.z, label: 'Batteria?', maybe: true });
    }
    out.push(o);
  }

  // ---- collaudo e uscita
  {
    const ready = v.luce === 'ok' && v.pompaOn && v.batteria;
    const o: Objective = { id: 'collaudo', title: 'Collaudo dell’uscita', done: v.collaudo.done, step: '', targets: [] };
    if (v.collaudo.done) o.step = 'Riuscito';
    else if (!ready) {
      o.blocked = true;
      o.step = 'Si sblocca quando luci, pompa e batteria sono pronte';
    } else {
      const left = v.collaudo.until ? Math.max(0, Math.ceil((v.collaudo.until - now) / 1000)) : 0;
      o.step = v.collaudo.a || v.collaudo.b ? `Inserisci il codice sull’altra postazione entro ${left} s` : 'Ogni display mostra il codice per l’altra postazione: leggetelo e inseritelo (in due, a voce, è velocissimo)';
      o.where = 'Quadro dell’uscita (piano terra, servizio) ↔ centralina (primo piano, vicino alle scale)';
      if (!v.collaudo.a) o.targets.push(st('collaudo1'));
      if (!v.collaudo.b) o.targets.push(st('collaudo2'));
    }
    out.push(o);
  }

  // ---- imprevisti e uscita
  if (v.leak) {
    const s = STATIONS.find((x) => x.id === v.leak!.st)!;
    const left = Math.max(0, Math.ceil((v.leak.until - now) / 1000));
    out.unshift({ id: 'perdita', title: 'Perdita di pressione', done: false, step: `Chiudi la valvola entro ${left} s`, where: `${FLOOR_NAMES[s.f]}`, targets: [st(s.id, 'Valvola')] });
  }
  if (v.collaudo.done) {
    out.unshift({
      id: 'uscita',
      title: 'Uscite tutti!',
      done: false,
      step: 'La porta di servizio è aperta: uscite da lì',
      where: 'Piano terra · in fondo al corridoio di servizio',
      targets: [{ f: 1, x: 26.6, y: 1.4, z: 13.5, label: 'Uscita' }],
    });
  }
  // compagni incatenati: prima di tutto
  for (const [id, ps] of Object.entries(v.players)) {
    if (id === me || ps.state !== 'intrappolato') continue;
    const pos = posOf(id);
    out.unshift({
      id: 'soccorso',
      title: `Libera ${nameOf(id)}`,
      done: false,
      step: 'Raggiungilo e apri il lucchetto: la combinazione la legge solo lui, fattela dire',
      where: pos ? FLOOR_NAMES[pos.f] : undefined,
      targets: pos ? [{ f: pos.f, x: pos.x, y: pos.y + 1, z: pos.z, label: nameOf(id) }] : [],
    });
  }
  if (v.players[me]?.state === 'ferito')
    out.push({ id: 'cura', title: 'Sei ferito', done: false, step: 'Medicati nel furgone in cortile: un altro colpo e resti incatenato', where: 'Cortile · retro del furgone', targets: [st('portone', 'Furgone')] });
  void mine;
  return out;
}

// Quanti impianti essenziali sono pronti (su 4)
export const progressOf = (v: Horror1View) => [v.luce === 'ok', v.pompaOn, v.batteria, v.collaudo.done].filter(Boolean).length;
export const floorWord = (from: number, to: number) => (to === from ? '' : to > from ? `↑ ${fl(to)}` : `↓ ${fl(to)}`);
