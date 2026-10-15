// Cloudflare Worker + Durable Object: fa girare Axend Games online senza un server sempre acceso.
// Giochi: "La Spia" e "L'Impostore" (tutto a voce, conferma finale) e "Telefono senza fili" (scrivi → disegna → indovina).
import { DurableObject } from 'cloudflare:workers';
import type { ClientGameState, GameId, GameSettings, LocationItem, Player, RoomState, RoomSummary, TelEntry, TelView } from '../src/types/game';
import { DEFAULT_LOCATIONS, LOCATION_CATEGORIES, SPICY_LOCATIONS } from '../src/data/locations';
import { WORD_PAIRS, WORD_PAIRS_SPICY } from '../src/data/wordPairs';
import { MODES as BASE_MODES, type Board, type Ctx } from './modes';
import { PARTY_MODES } from './party';
import { PARTY2_MODES } from './party2';
import { ASTRO_MODES } from './astro';
import { PARTY3D_MODES } from './party3d';
import { HORROR_MODES } from './horror1';
import { FLAT_MODES } from './flat';
import { TURBO_MODES } from './turbo';
import { TURBO_OPTIONS } from '../src/game/turbo/room';
import { FLAT_IDS, flatInfo } from '../src/data/flatGames';
import type { NetPos } from '../src/data/party3d';
import { WORLD } from '../src/data/astro';

// Tutti i giochi "a moduli": disegno e bomba (modes.ts), giochi di gruppo (party.ts e party2.ts), videogiochi (astro.ts)
const MODES = { ...BASE_MODES, ...PARTY_MODES, ...PARTY2_MODES, ...ASTRO_MODES, ...PARTY3D_MODES, ...HORROR_MODES, ...FLAT_MODES, ...TURBO_MODES };
// Videogiochi in tempo reale: le posizioni viaggiano a parte, 10 volte al secondo
const REALTIME: GameId[] = ['ASTRO'];
const P3_GAMES: GameId[] = ['PARTY3D', 'HORROR1']; // giochi 3D: posizioni con quota, bot e fisica sul server
const P3_TICK_MS = 66;
const r2 = (v: number) => Math.round(v * 100) / 100;
const RT_TICK_MS = 100;
type RtPos = { x: number; y: number; f: number; m: number };

type Meta = { roomCode: string; playerId: string };
// Chi è nella home con la lista delle stanze aperte ha { watch: true } al posto della stanza
type Attachment = Meta | { watch: true } | null;

const ROOM_TTL = 12 * 60 * 60 * 1000; // le stanze inattive da 12 ore vengono cancellate
const MAX_PLAYERS = 16;
const GAMES: GameId[] = [
  'SPIA', 'IMPOSTORE', 'TELEFONO', 'DISEGNA', 'BOMBA', 'ARTISTA', 'BATTUTE', 'PREFERIRESTI', 'SINTONIA', 'TABU', 'CHISONO',
  'TEATRINO', 'SMORFIE', 'DADI', 'OCA', 'NONRIDERE', 'ASTRO', 'PARTY3D', 'HORROR1', 'TURBO',
  ...FLAT_IDS, // giochi flat a moduli
];
const STEP_GRACE = 4000; // a turno scaduto, qualche secondo per le consegne automatiche dei telefoni
const AWAY_GRACE = 45_000; // chi esce dall'app resta "attivo" per 45 secondi: se rientra, nessuno se ne accorge
const MAX_DRAWING = 600_000; // lunghezza massima del disegno in base64 (~450 KB)
const LIST_MAX_IDLE = 3 * 60 * 60 * 1000; // nella lista delle stanze aperte solo quelle usate nelle ultime 3 ore

const newId = () => 'p_' + Math.random().toString(36).substring(2, 10);
const cleanName = (v: unknown, fallback: string) => (typeof v === 'string' && v.trim() ? v.trim().substring(0, 18) : fallback);
const cleanShort = (v: unknown, fallback: string) => (typeof v === 'string' && v ? v.substring(0, 32) : fallback);
const mod = (a: number, n: number) => ((a % n) + n) % n;
// Telefono senza fili: turni pari = frase, turni dispari = disegno
const stepType = (step: number): TelEntry['type'] => (step % 2 === 0 ? 'text' : 'drawing');
const pick = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

function shuffle<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Codici stanza solo numerici, 4 cifre
function generateRoomCode(rooms: Map<string, RoomState>): string {
  for (let i = 0; i < 100; i++) {
    const code = String(1000 + Math.floor(Math.random() * 9000));
    if (!rooms.has(code)) return code;
  }
  return String(10000 + Math.floor(Math.random() * 90000));
}

function eligibleLocations(settings: GameSettings): LocationItem[] {
  const list = DEFAULT_LOCATIONS.filter(l => settings.selectedCategories.includes(l.category));
  return [...(list.length ? list : DEFAULT_LOCATIONS), ...(settings.spicy ? SPICY_LOCATIONS : [])];
}

// L'Impostore: "w3" = coppia normale n.3, "s3" = coppia piccante n.3
const pairOf = (key: string) => (key[0] === 's' ? WORD_PAIRS_SPICY : WORD_PAIRS)[Number(key.slice(1))];

// Spie o impostori: mai più di quanti ne permette il gruppo
const badCount = (settings: GameSettings, players: number) => Math.max(1, Math.min(settings.spiesCount, Math.floor((players - 1) / 2)));

const SERVER_NAME = 'global-v2';
const SERVER_VERSION = '2026-10-15-turbo';

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const url = new URL(request.url);
    // Un solo Durable Object gestisce tutte le stanze
    // (il nome cambia quando il server va aggiornato subito: l'oggetto vecchio resta acceso finché qualcuno è collegato
    //  e continuerebbe a usare il codice di prima)
    const server = () => env.GAME.get(env.GAME.idFromName(SERVER_NAME));
    if (url.pathname === '/ws') {
      if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected WebSocket', { status: 426 });
      return server().fetch(request);
    }
    if (url.pathname.startsWith('/img/')) return server().fetch(request); // disegni del Telefono senza fili
    if (url.pathname === '/api/health') return Response.json({ status: 'ok' });
    return env.ASSETS.fetch(request);
  },
};

export class GameServer extends DurableObject {
  rooms = new Map<string, RoomState>();

  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env);
    // I ping dei client ricevono risposta senza svegliare l'oggetto
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', '{"type":"PONG"}'));
    // Dopo l'ibernazione (o un aggiornamento) la memoria è vuota: ricarica le stanze salvate
    ctx.blockConcurrencyWhile(async () => {
      const saved = await ctx.storage.list<RoomState>({ prefix: 'room:' });
      const live = this.livePlayers();
      const now = Date.now();
      for (const [key, room] of saved) {
        if (!Array.isArray(room.roundPlayerIds)) {
          await ctx.storage.delete(key); // stanza di una versione vecchia
          continue;
        }
        room.settings.game ??= 'SPIA';
        room.settings.drawSeconds ??= 90;
        room.settings.impostorWord ??= true;
        room.settings.bombaMode ??= 'MISTO';
        room.settings.bombaLives ??= 3;
        room.settings.drawRounds ??= 2;
        room.settings.guessSeconds ??= 80;
        room.settings.customWords ??= '';
        room.settings.onlyCustom ??= false;
        room.settings.battuteRounds ??= 2;
        room.settings.writeSeconds ??= 90;
        room.settings.prefQuestions ??= 12;
        room.settings.sintoniaLaps ??= 1;
        room.settings.tabuSeconds ??= 60;
        room.settings.tabuLaps ??= 1;
        room.settings.teatroLaps ??= 1;
        room.settings.smorfieRounds ??= 2;
        room.settings.diceCount ??= 5;
        room.settings.nrLaps ??= 1;
        room.settings.astroTasks ??= 5;
        room.settings.astroKill ??= 30;
        room.settings.astroMeeting ??= 90;
        room.settings.partyBots ??= 3;
        room.settings.partyRounds ??= 5;
        room.settings.horrorPressure ??= 1;
        room.settings.spicy ??= false;
        room.settings.privateRoom ??= false;
        room.settings.extra ??= {};
        room.secretWords ??= null;
        room.tel ??= null;
        room.mg ??= null;
        if (room.mg) {
          const mode = MODES[room.mg.kind];
          if (!mode) room.mg = null; // gioco che non esiste più
          else mode.upgrade?.(room.mg.data);
        }
        this.rooms.set(room.roomCode, room);
        let changed = false;
        for (const p of room.players) {
          if (live.has(`${room.roomCode}:${p.id}`)) {
            p.isOnline = true;
            p.awaySince = null;
          } else if (p.isOnline && !p.awaySince) {
            p.awaySince = now; // tempo per ricollegarsi (es. dopo un aggiornamento del gioco)
            changed = true;
          }
        }
        // va salvato: se l'oggetto si riaddormenta e riparte, il conto alla rovescia non deve ricominciare da capo
        if (changed) await ctx.storage.put(key, room);
      }
      this.scheduleAlarm();
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/img/')) {
      const id = url.pathname.slice(5);
      const data = /^[\w-]{6,40}$/.test(id) ? await this.ctx.storage.get<Uint8Array>(`img:${id}`) : undefined;
      if (!data) return new Response('Disegno non trovato', { status: 404 });
      const jpeg = data[0] === 0xff && data[1] === 0xd8; // i selfie di Smorfie sono JPEG, i disegni PNG
      return new Response(data, { headers: { 'content-type': jpeg ? 'image/jpeg' : 'image/png', 'cache-control': 'public, max-age=86400, immutable' } });
    }
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (message === 'versione') return this.send(ws, 'VERSIONE', { v: SERVER_VERSION });
    if (typeof message !== 'string') {
      const b = new Uint8Array(message);
      if (b[0] === 0xa1) return this.relayVoice(ws, b);
    }
    try {
      this.handleClientMessage(ws, JSON.parse(typeof message === 'string' ? message : new TextDecoder().decode(message)));
    } catch (err) {
      console.error('Messaggio non valido:', err);
    }
  }

  async webSocketClose(ws: WebSocket) {
    this.detach(ws); // prima si stacca il giocatore (serve la connessione ancora aperta), poi si chiude
    try { ws.close(1000, 'bye'); } catch {}
  }

  async webSocketError(ws: WebSocket) {
    this.detach(ws);
  }

  // Sveglia unica per tutte le stanze: turni scaduti del telefono e giocatori usciti dall'app da troppo
  async alarm() {
    const now = Date.now();
    for (const room of this.rooms.values()) {
      let changed = false;
      for (const p of room.players) {
        if (p.awaySince && now - p.awaySince >= AWAY_GRACE) {
          p.awaySince = null;
          p.isOnline = false;
          changed = true;
        }
      }
      const t = room.tel;
      if (room.phase === 'PLAYING' && t) {
        const expired = !!t.stepEndsAt && t.stepEndsAt + STEP_GRACE <= now;
        const onlyAbsentMissing = changed && t.submitted.length > 0 && !this.telWaiting(room).length;
        if (expired || onlyAbsentMissing) {
          this.advanceStep(room);
          changed = true;
        }
      }
      if (room.phase === 'PLAYING' && room.mg) {
        try {
          const mode = MODES[room.mg.kind]!;
          if (mode.tick(room.mg.data, this.ctxFor(room))) changed = true;
          if (mode.finished(room.mg.data)) room.phase = 'ROUND_OVER';
          else if (P3_GAMES.includes(room.mg.kind)) this.ensureP3(room.roomCode); // dopo un riavvio il giro riparte
          else if (mode.fast) this.ensureFast(room.roomCode);
        } catch (err) {
          console.error('Scadenza non gestita nella stanza', room.roomCode, err);
        }
      }
      if (changed) this.broadcastRoom(room.roomCode);
    }
    this.scheduleAlarm();
  }

  scheduleAlarm() {
    let next = Infinity;
    for (const r of this.rooms.values()) {
      if (r.phase === 'PLAYING' && r.tel?.stepEndsAt) next = Math.min(next, r.tel.stepEndsAt + STEP_GRACE);
      if (r.phase === 'PLAYING' && r.mg) {
        try {
          next = Math.min(next, MODES[r.mg.kind]!.deadline(r.mg.data) ?? Infinity);
        } catch (err) {
          console.error('Scadenza illeggibile nella stanza', r.roomCode, err);
        }
      }
      for (const p of r.players) if (p.awaySince) next = Math.min(next, p.awaySince + AWAY_GRACE);
    }
    if (next < Infinity) this.ctx.storage.setAlarm(Math.max(next, Date.now() + 500));
  }

  attachment(ws: WebSocket): Attachment {
    try { return ws.deserializeAttachment() as Attachment; } catch { return null; }
  }

  // Voce di prossimità: pezzetti già compressi dal telefono. Si girano ai compagni della stessa partita
  // (solo a chi è abbastanza vicino, o a tutti se è la radio). Niente viene salvato o registrato.
  relayVoice(ws: WebSocket, b: Uint8Array) {
    const m = this.meta(ws);
    if (!m || b.length < 3 || b.length > 4000) return;
    const now = Date.now();
    const last = this.voiceAt.get(m.playerId) ?? 0;
    if (now - last < 15) return; // niente raffiche (i pezzetti normali arrivano ogni ~100 ms)
    this.voiceAt.set(m.playerId, now);
    const radio = (b[1] & 1) === 1;
    const map = this.p3.get(m.roomCode);
    const from = map?.get(m.playerId);
    const id = new TextEncoder().encode(m.playerId).subarray(0, 255);
    const out = new Uint8Array(3 + id.length + b.length - 2);
    out[0] = 0xa2;
    out[1] = id.length;
    out.set(id, 2);
    out[2 + id.length] = b[1];
    out.set(b.subarray(2), 3 + id.length);
    for (const sock of this.ctx.getWebSockets()) {
      if (sock === ws) continue;
      const o = this.meta(sock);
      if (!o || o.roomCode !== m.roomCode || o.playerId === m.playerId) continue;
      if (!radio && from) {
        const to = map?.get(o.playerId);
        // oltre i 25 metri (o due piani) non si sentirebbe comunque: non serve mandarlo
        if (to && Math.hypot(to.x - from.x, to.z - from.z, (to.y - from.y) * 1.5) > 25) continue;
      }
      try {
        sock.send(out.buffer);
      } catch {
        // connessione appena chiusa
      }
    }
  }
  voiceAt = new Map<string, number>();

  meta(ws: WebSocket): Meta | null {
    const a = this.attachment(ws);
    return a && 'roomCode' in a ? a : null;
  }

  // ---- Stanze aperte: la home le vede in diretta e ci si unisce con un tocco ----
  roomList(): RoomSummary[] {
    const now = Date.now();
    const list: RoomSummary[] = [];
    for (const r of this.rooms.values()) {
      if (r.settings.privateRoom) continue;
      const online = r.players.filter(p => p.isOnline);
      if (!online.length || now - (r.lastActivity ?? 0) > LIST_MAX_IDLE) continue;
      const host = r.players.find(p => p.id === r.hostId) ?? online[0];
      list.push({
        code: r.roomCode,
        game: r.settings.game,
        phase: r.phase,
        players: online.length,
        full: r.players.length >= MAX_PLAYERS,
        spicy: r.settings.spicy,
        host: { name: host.name, avatar: host.avatar, color: host.color },
      });
    }
    // prima le stanze in attesa, poi le più affollate
    return list.sort((a, b) => Number(a.phase !== 'LOBBY') - Number(b.phase !== 'LOBBY') || b.players - a.players).slice(0, 30);
  }

  roomsTimer: ReturnType<typeof setTimeout> | null = null;
  lastRooms = '';
  // Dopo ogni cambiamento la lista parte al massimo una volta ogni 400 ms, e solo se è diversa
  roomsChanged() {
    if (this.roomsTimer) return;
    this.roomsTimer = setTimeout(() => {
      this.roomsTimer = null;
      const json = JSON.stringify({ type: 'ROOMS', payload: this.roomList() });
      if (json === this.lastRooms) return;
      this.lastRooms = json;
      for (const ws of this.ctx.getWebSockets()) {
        const a = this.attachment(ws);
        if (a && 'watch' in a) try { ws.send(json); } catch {}
      }
    }, 400);
  }

  // "CODICE:playerId" di tutti i giocatori con una connessione aperta
  livePlayers(except?: WebSocket): Set<string> {
    const live = new Set<string>();
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except || ws.readyState > 1) continue;
      const m = this.meta(ws);
      if (m) live.add(`${m.roomCode}:${m.playerId}`);
    }
    return live;
  }

  send(ws: WebSocket, type: string, payload: unknown) {
    try { ws.send(JSON.stringify({ type, payload })); } catch {}
  }

  error(ws: WebSocket, message: string, code?: string) {
    this.send(ws, 'ERROR', { message, code });
  }

  // Strumenti che i giochi a moduli usano per leggere la stanza e mandare messaggi
  ctxFor(room: RoomState): Ctx {
    const host = () => room.players.find(p => p.id === room.hostId);
    return {
      now: Date.now(),
      isOnline: id => !!room.players.find(p => p.id === id)?.isOnline,
      canLead: id => id === room.hostId || !host()?.isOnline,
      emit: (type, payload, exceptId) => {
        for (const ws of this.ctx.getWebSockets()) {
          const m = this.meta(ws);
          if (m?.roomCode === room.roomCode && m.playerId !== exceptId) this.send(ws, type, payload);
        }
      },
      storeImage: (dataUrl) => {
        const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
        if (!match || match[1].length > MAX_DRAWING) return null;
        const id = `${room.roomCode}-${Math.random().toString(36).substring(2, 12)}`;
        this.ctx.storage.put(`img:${id}`, Uint8Array.from(atob(match[1]), (c) => c.charCodeAt(0)));
        return { url: `/img/${id}`, key: `img:${id}` };
      },
      pos: (id) => this.rt.get(room.roomCode)?.get(id) ?? null,
      p3get: (id) => this.p3.get(room.roomCode)?.get(id) ?? null,
      p3set: (id, p) => {
        this.p3Map(room.roomCode).set(id, p);
      },
      knock: (id, v) => {
        for (const ws of this.ctx.getWebSockets()) {
          const m = this.meta(ws);
          if (m?.roomCode === room.roomCode && m.playerId === id) this.send(ws, 'P3_KNOCK', v);
        }
      },
      teleport: (points) => {
        const map = this.rtPositions(room.roomCode);
        for (const [id, p] of Object.entries(points)) map.set(id, { x: p.x, y: p.y, f: 0, m: 0 });
        this.rtDirty.add(room.roomCode);
        this.ensureRtLoop(room.roomCode);
      },
    };
  }

  // ---- Tempo reale (videogiochi): posizioni solo in memoria, mai salvate ----
  rt = new Map<string, Map<string, RtPos>>();
  rtTimers = new Map<string, ReturnType<typeof setInterval>>();
  rtDirty = new Set<string>();

  rtPositions(code: string) {
    let map = this.rt.get(code);
    if (!map) this.rt.set(code, (map = new Map()));
    return map;
  }

  ensureRtLoop(code: string) {
    if (this.rtTimers.has(code)) return;
    this.rtTimers.set(code, setInterval(() => this.rtTick(code), RT_TICK_MS));
  }

  stopRt(code: string) {
    clearInterval(this.rtTimers.get(code));
    this.rtTimers.delete(code);
    this.rt.delete(code);
    this.rtDirty.delete(code);
  }

  // Ogni 100 ms (solo se qualcuno si è mosso): i vivi vedono solo i vivi, i fantasmi vedono tutti
  rtTick(code: string) {
    const room = this.rooms.get(code);
    if (!room || room.phase !== 'PLAYING' || !room.mg || !REALTIME.includes(room.mg.kind)) return this.stopRt(code);
    if (!this.rtDirty.has(code)) return;
    this.rtDirty.delete(code);
    const alive: Record<string, boolean> = room.mg.data.alive ?? {};
    const all = [...this.rtPositions(code)].map(([id, p]) => [id, Math.round(p.x), Math.round(p.y), p.f, p.m]);
    const living = JSON.stringify({ type: 'RT_POS', payload: { p: all.filter(([id]) => alive[id as string]) } });
    const ghosts = JSON.stringify({ type: 'RT_POS', payload: { p: all } });
    for (const ws of this.ctx.getWebSockets()) {
      const m = this.meta(ws);
      if (m?.roomCode !== code) continue;
      try {
        ws.send(alive[m.playerId] ? living : ghosts);
      } catch {}
    }
  }

  // ---- Giochi 3D (Axend Party): posizioni con quota e verso, bot mossi dal server, 15 giri al secondo ----
  p3 = new Map<string, Map<string, NetPos>>();
  p3Timers = new Map<string, { timer: ReturnType<typeof setInterval>; last: number }>();

  p3Map(code: string) {
    let map = this.p3.get(code);
    if (!map) this.p3.set(code, (map = new Map()));
    return map;
  }

  // ---- giochi veloci (Axend Turbo): un giro a hz fissi che manda lo stato del campo ai telefoni della stanza
  fastTimers = new Map<string, { last: number; timer: ReturnType<typeof setInterval> }>();
  ensureFast(code: string) {
    if (this.fastTimers.has(code)) return;
    const room = this.rooms.get(code);
    const hz = room?.mg ? (MODES[room.mg.kind]?.fast?.hz ?? 60) : 60;
    const entry = { last: Date.now(), timer: setInterval(() => this.fastTick(code), 1000 / hz) };
    this.fastTimers.set(code, entry);
  }
  stopFast(code: string) {
    const e = this.fastTimers.get(code);
    if (e) clearInterval(e.timer);
    this.fastTimers.delete(code);
  }
  fastTick(code: string) {
    const room = this.rooms.get(code);
    const entry = this.fastTimers.get(code);
    const mode = room?.mg ? MODES[room.mg.kind] : undefined;
    if (!room || !entry || room.phase !== 'PLAYING' || !room.mg || !mode?.fast) return this.stopFast(code);
    const now = Date.now();
    const dt = Math.min(0.25, (now - entry.last) / 1000);
    entry.last = now;
    let changed = false;
    try {
      const r = mode.fast.tick(room.mg.data, this.ctxFor(room), dt);
      changed = !!r.changed;
      if (r.send) {
        for (const ws of this.ctx.getWebSockets()) {
          if (this.meta(ws)?.roomCode !== code) continue;
          try {
            ws.send(r.send);
          } catch {}
        }
      }
      if (mode.finished(room.mg.data)) {
        room.phase = 'ROUND_OVER';
        changed = true;
      }
    } catch (err) {
      console.error('Errore nel giro veloce della stanza', code, err);
    }
    if (changed) {
      this.broadcastRoom(code);
      this.scheduleAlarm();
    }
  }

  ensureP3(code: string) {
    if (this.p3Timers.has(code)) return;
    const entry = { last: Date.now(), timer: setInterval(() => this.p3Tick(code), P3_TICK_MS) };
    this.p3Timers.set(code, entry);
  }

  stopP3(code: string) {
    const e = this.p3Timers.get(code);
    if (e) clearInterval(e.timer);
    this.p3Timers.delete(code);
    this.p3.delete(code);
  }

  p3Tick(code: string) {
    const room = this.rooms.get(code);
    const entry = this.p3Timers.get(code);
    if (!room || !entry || room.phase !== 'PLAYING' || !room.mg || !P3_GAMES.includes(room.mg.kind)) return this.stopP3(code);
    const now = Date.now();
    const dt = Math.min(0.2, (now - entry.last) / 1000);
    entry.last = now;
    const mode = MODES[room.mg.kind]!;
    let changed = false;
    try {
      changed = !!mode.p3Tick?.(room.mg.data, this.ctxFor(room), dt);
      if (mode.finished(room.mg.data)) {
        room.phase = 'ROUND_OVER';
        changed = true;
      }
    } catch (err) {
      console.error('Errore nel giro 3D della stanza', code, err);
    }
    if (changed) {
      this.broadcastRoom(code);
      this.scheduleAlarm();
    }
    const list = [...this.p3Map(code)].map(([id, p]) => [id, r2(p.x), r2(p.y), r2(p.z), r2(p.r), p.a]);
    const json = JSON.stringify({ type: 'P3_POS', payload: { p: list } });
    for (const ws of this.ctx.getWebSockets()) {
      if (this.meta(ws)?.roomCode !== code) continue;
      try {
        ws.send(json);
      } catch {}
    }
  }

  // Mentre si disegna arrivano tanti tratti: si salvano al massimo ogni 1,5 secondi
  saveTimers = new Map<string, ReturnType<typeof setTimeout>>();
  persistSoon(room: RoomState) {
    if (this.saveTimers.has(room.roomCode)) return;
    this.saveTimers.set(
      room.roomCode,
      setTimeout(() => {
        this.saveTimers.delete(room.roomCode);
        if (this.rooms.get(room.roomCode) === room) this.ctx.storage.put(`room:${room.roomCode}`, room);
      }, 1500),
    );
  }

  // La connessione si è chiusa (app in background, telefono bloccato, cambio rete):
  // il giocatore resta "attivo" per un po' e, se rientra in tempo, nessuno nota niente
  detach(ws: WebSocket) {
    const meta = this.meta(ws);
    if (!meta) return;
    try { ws.serializeAttachment(null); } catch {}
    const room = this.rooms.get(meta.roomCode);
    const player = room?.players.find(p => p.id === meta.playerId);
    if (!room || !player || !player.isOnline) return;
    if (this.livePlayers(ws).has(`${room.roomCode}:${player.id}`)) return; // ancora collegato da un'altra scheda
    player.awaySince = Date.now();
    this.ctx.storage.put(`room:${room.roomCode}`, room);
    this.scheduleAlarm();
  }

  // Salva la stanza e manda a ogni giocatore la sua vista (senza i segreti degli altri)
  broadcastRoom(code: string) {
    const room = this.rooms.get(code);
    if (!room) return;
    room.lastActivity = Date.now();
    this.ctx.storage.put(`room:${code}`, room);
    // giochi veloci: dopo un riavvio del server il giro riparte appena qualcuno rientra
    if (room.phase === 'PLAYING' && room.mg && MODES[room.mg.kind]?.fast) this.ensureFast(code);

    const game = room.settings.game;
    const inGame = room.phase !== 'LOBBY';
    const over = room.phase === 'ROUND_OVER';
    const t = inGame ? room.tel : null;
    const mode = inGame && room.mg ? MODES[room.mg.kind]! : null;
    const roundIds = t ? t.order : mode ? mode.ids(room.mg!.data) : room.roundPlayerIds;
    const doneIds = t ? t.submitted : room.confirmations;
    const availableLocations = game === 'SPIA' ? eligibleLocations(room.settings).map(l => ({ id: l.id, name: l.name, icon: l.icon })) : [];
    const players = room.players.map(p => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      color: p.color,
      isHost: p.id === room.hostId,
      isOnline: p.isOnline,
      inRound: inGame && roundIds.includes(p.id),
      confirmed: room.phase === 'PLAYING' && doneIds.includes(p.id),
    }));
    const spiesInRound = inGame ? room.roster.filter(r => r.isSpy).length : 0;
    // Album del telefono: si vede solo fin dove è stato svelato
    const album =
      t && over
        ? t.revealDone
          ? t.chains
          : [...t.chains.slice(0, t.revealChain), { ...t.chains[t.revealChain], entries: t.chains[t.revealChain].entries.slice(0, t.revealStep) }]
        : null;

    for (const ws of this.ctx.getWebSockets()) {
      const meta = this.meta(ws);
      if (!meta || meta.roomCode !== code) continue;
      const me = room.players.find(p => p.id === meta.playerId);
      if (!me) continue;
      const mine = inGame ? room.roster.find(r => r.id === me.id) : undefined;
      // Impostore con parola simile: non deve sapere di esserlo
      const isSpy = !!mine?.isSpy && !(game === 'IMPOSTORE' && room.settings.impostorWord);

      let tel: TelView | null = null;
      if (t) {
        const i = t.order.indexOf(me.id);
        let myInput: TelEntry | null = null;
        if (room.phase === 'PLAYING' && i >= 0 && t.step > 0) {
          // cosa devo disegnare/descrivere: l'ultima pagina valida della catena che mi tocca
          const chain = t.chains[mod(i - t.step, t.order.length)];
          for (let k = t.step - 1; k >= 0 && !myInput; k--) if (chain.entries[k]?.content) myInput = chain.entries[k];
        }
        tel = {
          step: t.step,
          totalSteps: t.totalSteps,
          stepType: stepType(t.step),
          stepEndsAt: t.stepEndsAt,
          inGame: i >= 0,
          mySubmitted: t.submitted.includes(me.id),
          myInput,
          roster: t.roster,
          album,
          revealChain: t.revealChain,
          revealStep: t.revealStep,
          revealDone: t.revealDone,
        };
      }

      const state: ClientGameState = {
        roomCode: code,
        phase: room.phase,
        players,
        myId: me.id,
        hostId: room.hostId,
        settings: room.settings,
        currentRound: room.currentRound,
        startingPlayerId: room.startingPlayerId,
        timerEndsAt: room.timerEndsAt,
        serverNow: Date.now(),
        spiesInRound,
        availableLocations,
        inRound: !!mine,
        isSpy,
        myRole: mine?.role ?? '',
        location: game === 'SPIA' && (over || (mine && !mine.isSpy)) ? room.secretLocation ?? null : null,
        words: game === 'IMPOSTORE' && over ? room.secretWords ?? null : null,
        reveal: over && !t ? room.roster : null,
        forcedEnd: room.forcedEnd,
        tel,
        mg: mode ? mode.view(room.mg!.data, me.id) : null,
      };
      this.send(ws, 'STATE_UPDATE', state);
    }
    this.roomsChanged();
  }

  // Spia/impostore: giocatori del round collegati che non hanno ancora confermato
  waitingFor(room: RoomState): string[] {
    return room.roundPlayerIds.filter(id => room.players.find(p => p.id === id)?.isOnline && !room.confirmations.includes(id));
  }

  // Telefono: giocatori collegati che non hanno ancora consegnato il turno
  telWaiting(room: RoomState): string[] {
    const t = room.tel;
    if (!t) return [];
    return t.order.filter(id => room.players.find(p => p.id === id)?.isOnline && !t.submitted.includes(id));
  }

  endRound(room: RoomState, forced: boolean) {
    room.phase = 'ROUND_OVER';
    room.forcedEnd = forced;
    room.timerEndsAt = null;
  }

  resetRound(room: RoomState) {
    room.roundPlayerIds = [];
    room.confirmations = [];
    room.roster = [];
    room.secretLocation = undefined;
    room.secretWords = null;
    room.startingPlayerId = null;
    room.timerEndsAt = null;
    room.forcedEnd = false;
  }

  // Chiude il gioco a moduli in corso e cancella le sue foto (Smorfie)
  clearMg(room: RoomState) {
    this.stopRt(room.roomCode);
    this.stopP3(room.roomCode);
    const keys: string[] = room.mg?.data?.imageKeys ?? [];
    for (let i = 0; i < keys.length; i += 128) this.ctx.storage.delete(keys.slice(i, i + 128));
    room.mg = null;
  }

  // Cancella la partita del telefono e i suoi disegni
  clearTel(room: RoomState) {
    const keys = room.tel?.imageKeys ?? [];
    for (let i = 0; i < keys.length; i += 128) this.ctx.storage.delete(keys.slice(i, i + 128));
    room.tel = null;
  }

  startSpia(room: RoomState, online: Player[]) {
    const pool = eligibleLocations(room.settings);
    let fresh = pool.filter(l => !room.usedLocationIds.includes(l.id));
    if (!fresh.length) {
      room.usedLocationIds = room.usedLocationIds.filter(id => !pool.some(l => l.id === id));
      fresh = pool;
    }
    const location = pick(fresh);
    room.usedLocationIds = [...room.usedLocationIds, location.id].slice(-200);
    const spyIds = new Set(shuffle(online).slice(0, badCount(room.settings, online.length)).map(p => p.id));
    const roles = shuffle(location.roles);
    let next = 0;
    room.roster = online.map(p => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      color: p.color,
      isSpy: spyIds.has(p.id),
      role: spyIds.has(p.id) ? 'La Spia' : room.settings.rolesEnabled ? roles[next++ % roles.length] : 'Agente',
    }));
    room.roundPlayerIds = online.map(p => p.id);
    room.secretLocation = location;
    room.startingPlayerId = pick(online).id;
    room.timerEndsAt = room.settings.roundTimeSeconds > 0 ? Date.now() + room.settings.roundTimeSeconds * 1000 : null;
  }

  // L'Impostore: la maggioranza riceve una parola, gli impostori quella simile (o niente)
  startImpostore(room: RoomState, online: Player[]) {
    const s = room.settings;
    // 🌶️ piccante: le coppie sgravate escono più spesso di quelle normali
    const keys = [...WORD_PAIRS.map((_, i) => `w${i}`), ...(s.spicy ? WORD_PAIRS_SPICY.flatMap((_, i) => Array<string>(3).fill(`s${i}`)) : [])];
    let choices = keys.filter(k => !room.usedLocationIds.includes(k));
    if (!choices.length) {
      room.usedLocationIds = room.usedLocationIds.filter(id => !/^[ws]\d+$/.test(id));
      choices = keys;
    }
    const key = pick(choices);
    room.usedLocationIds = [...room.usedLocationIds, key].slice(-200);
    const [civil, other] = shuffle(pairOf(key));
    const impostors = new Set(shuffle(online).slice(0, badCount(s, online.length)).map(p => p.id));
    room.roster = online.map(p => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      color: p.color,
      isSpy: impostors.has(p.id),
      role: impostors.has(p.id) ? (s.impostorWord ? other : '') : civil,
    }));
    room.secretWords = { civil, impostor: s.impostorWord ? other : null };
    room.roundPlayerIds = online.map(p => p.id);
    // Senza parola, l'impostore non inizia mai il giro (sarebbe impossibile)
    room.startingPlayerId = pick(s.impostorWord ? online : online.filter(p => !impostors.has(p.id))).id;
    room.timerEndsAt = s.roundTimeSeconds > 0 ? Date.now() + s.roundTimeSeconds * 1000 : null;
  }

  // Ogni giocatore ha un album; a ogni turno gli album passano al giocatore successivo
  startTelefono(room: RoomState, online: Player[]) {
    const players = shuffle(online);
    const totalSteps = Math.min(Math.max(players.length, 4), 10);
    room.tel = {
      order: players.map(p => p.id),
      roster: players.map(p => ({ id: p.id, name: p.name, avatar: p.avatar, color: p.color })),
      step: 0,
      totalSteps,
      chains: players.map(p => ({ ownerId: p.id, entries: Array(totalSteps).fill(null) })),
      submitted: [],
      stepEndsAt: null,
      imageKeys: [],
      revealChain: 0,
      revealStep: 1,
      revealDone: false,
    };
    room.tel.stepEndsAt = this.stepDeadline(room);
  }

  stepDeadline(room: RoomState): number | null {
    const secs = room.settings.drawSeconds;
    if (!secs || !room.tel) return null;
    return Date.now() + (stepType(room.tel.step) === 'drawing' ? secs : Math.min(45, secs)) * 1000;
  }

  advanceStep(room: RoomState) {
    const t = room.tel;
    if (!t || room.phase !== 'PLAYING') return;
    const n = t.order.length;
    t.order.forEach((id, i) => {
      // chi non ha consegnato salta il turno
      t.chains[mod(i - t.step, n)].entries[t.step] ??= { type: stepType(t.step), by: id, content: null };
    });
    t.step += 1;
    t.submitted = [];
    if (t.step >= t.totalSteps) {
      room.phase = 'ROUND_OVER';
      t.stepEndsAt = null;
      t.revealChain = 0;
      t.revealStep = 1;
      t.revealDone = false;
    } else {
      t.stepEndsAt = this.stepDeadline(room);
    }
  }

  deleteRoom(room: RoomState) {
    this.clearTel(room);
    this.clearMg(room);
    this.rooms.delete(room.roomCode);
    this.ctx.storage.delete(`room:${room.roomCode}`);
    this.roomsChanged();
  }

  removePlayer(room: RoomState, playerId: string, kicked: boolean) {
    const code = room.roomCode;
    room.players = room.players.filter(p => p.id !== playerId);
    room.roundPlayerIds = room.roundPlayerIds.filter(id => id !== playerId);
    room.confirmations = room.confirmations.filter(id => id !== playerId);
    for (const ws of this.ctx.getWebSockets()) {
      const m = this.meta(ws);
      if (m?.roomCode !== code || m.playerId !== playerId) continue;
      if (kicked) this.send(ws, 'KICKED', {});
      try { ws.serializeAttachment(null); } catch {}
      try { ws.close(4001, kicked ? 'rimosso' : 'uscito'); } catch {}
    }
    if (!room.players.length) return this.deleteRoom(room);
    // Se esce chi ha creato la stanza, il comando passa a un altro giocatore
    if (room.hostId === playerId) room.hostId = (room.players.find(p => p.isOnline) ?? room.players[0]).id;
    if (room.phase !== 'PLAYING') return;
    if (room.mg) {
      const mode = MODES[room.mg.kind]!;
      mode.leave(room.mg.data, playerId, this.ctxFor(room));
      if (mode.finished(room.mg.data)) room.phase = 'ROUND_OVER';
      this.scheduleAlarm();
      return;
    }
    // Se mancava solo lui, si va avanti
    if (room.tel) {
      if (room.tel.submitted.length && !this.telWaiting(room).length) {
        this.advanceStep(room);
        this.scheduleAlarm();
      }
    } else if (room.confirmations.length && !this.waitingFor(room).length) {
      this.endRound(room, false);
    }
  }

  cleanupRooms() {
    const live = this.livePlayers();
    for (const [code, room] of this.rooms) {
      if (Date.now() - (room.lastActivity ?? 0) < ROOM_TTL) continue;
      if (room.players.some(p => live.has(`${code}:${p.id}`))) continue;
      this.deleteRoom(room);
    }
  }

  handleClientMessage(ws: WebSocket, message: { type?: string; payload?: any }) {
    const type = message?.type;
    const payload = message?.payload ?? {};

    // La home chiede la lista delle stanze aperte e poi la riceve aggiornata in diretta
    if (type === 'WATCH_ROOMS') {
      if (!this.meta(ws)) ws.serializeAttachment({ watch: true });
      this.send(ws, 'ROOMS', this.roomList());
      return;
    }
    if (type === 'UNWATCH_ROOMS') {
      if (!this.meta(ws)) ws.serializeAttachment(null);
      return;
    }

    if (type === 'CREATE_ROOM') {
      this.detach(ws);
      this.cleanupRooms();
      const roomCode = generateRoomCode(this.rooms);
      const player: Player = {
        id: newId(),
        name: cleanName(payload.name, 'Agente 007'),
        avatar: cleanShort(payload.avatar, 'av1'),
        color: cleanShort(payload.color, '#12b5f5'),
        isOnline: true,
      };
      const room: RoomState = {
        roomCode,
        phase: 'LOBBY',
        players: [player],
        hostId: player.id,
        settings: {
          game: GAMES.includes(payload.game) ? payload.game : 'SPIA',
          roundTimeSeconds: 480,
          spiesCount: 1,
          rolesEnabled: true,
          selectedCategories: [...LOCATION_CATEGORIES],
          impostorWord: true,
          drawSeconds: 90,
          bombaMode: 'MISTO',
          bombaLives: 3,
          drawRounds: 2,
          guessSeconds: 80,
          customWords: '',
          onlyCustom: false,
          battuteRounds: 2,
          writeSeconds: 90,
          prefQuestions: 12,
          sintoniaLaps: 1,
          tabuSeconds: 60,
          tabuLaps: 1,
          teatroLaps: 1,
          smorfieRounds: 2,
          diceCount: 5,
          nrLaps: 1,
          astroTasks: 5,
          astroKill: 30,
          astroMeeting: 90,
          partyBots: 3,
          partyRounds: 5,
          horrorPressure: 1,
          spicy: false,
          privateRoom: false,
          extra: {},
        },
        currentRound: 0,
        roundPlayerIds: [],
        confirmations: [],
        roster: [],
        startingPlayerId: null,
        timerEndsAt: null,
        forcedEnd: false,
        secretWords: null,
        usedLocationIds: [],
        tel: null,
        mg: null,
      };
      this.rooms.set(roomCode, room);
      ws.serializeAttachment({ roomCode, playerId: player.id });
      this.send(ws, 'JOINED', { roomCode, playerId: player.id });
      this.broadcastRoom(roomCode);
      return;
    }

    if (type === 'JOIN_ROOM') {
      const roomCode = String(payload.roomCode ?? '').replace(/\D/g, '');
      const room = this.rooms.get(roomCode);
      if (!room) return this.error(ws, `La stanza ${roomCode} non esiste (o è scaduta). Controlla il codice.`, 'ROOM_NOT_FOUND');
      let player = payload.playerId ? room.players.find(p => p.id === payload.playerId) : undefined;
      // Rientro automatico di chi non fa più parte della stanza (è uscito o è stato rimosso)
      if (payload.playerId && !player && !payload.name) return this.error(ws, 'Non fai più parte di quella stanza.', 'SESSION_EXPIRED');
      this.detach(ws);
      if (player) {
        player.isOnline = true;
        player.awaySince = null;
      } else {
        if (room.players.length >= MAX_PLAYERS) return this.error(ws, 'La stanza è piena (massimo 16 giocatori).', 'ROOM_FULL');
        player = {
          id: newId(),
          name: cleanName(payload.name, 'Agente ' + (room.players.length + 1)),
          avatar: cleanShort(payload.avatar, 'av1'),
          color: cleanShort(payload.color, '#12b5f5'),
          isOnline: true,
        };
        room.players.push(player);
      }
      ws.serializeAttachment({ roomCode, playerId: player.id });
      this.send(ws, 'JOINED', { roomCode, playerId: player.id });
      this.broadcastRoom(roomCode);
      return;
    }

    const meta = this.meta(ws);
    const room = meta ? this.rooms.get(meta.roomCode) : undefined;
    const me = room?.players.find(p => p.id === meta!.playerId);
    if (!room || !me) return;
    const code = room.roomCode;
    const isHost = room.hostId === me.id;
    // Il capo è chi ha creato la stanza; se è offline, chiunque può mandare avanti la partita
    const canLead = isHost || !room.players.find(p => p.id === room.hostId)?.isOnline;

    // Videogiochi: la mia posizione (niente salvataggi né aggiornamenti generali: ci pensa il giro da 100 ms)
    if (type === 'RT_MOVE') {
      if (room.phase !== 'PLAYING' || !room.mg || !REALTIME.includes(room.mg.kind) || !room.mg.data.order?.includes(me.id)) return;
      const x = Number(payload.x);
      const y = Number(payload.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      this.rtPositions(code).set(me.id, {
        x: Math.max(0, Math.min(WORLD.w, x)),
        y: Math.max(0, Math.min(WORLD.h, y)),
        f: payload.f ? 1 : 0,
        m: payload.m ? 1 : 0,
      });
      this.rtDirty.add(code);
      this.ensureRtLoop(code);
      return;
    }

    // Giochi 3D: la mia posizione (x, y, z, verso, animazione)
    if (type === 'P3_MOVE') {
      if (room.phase !== 'PLAYING' || !room.mg || !P3_GAMES.includes(room.mg.kind) || !room.mg.data.humans?.includes(me.id)) return;
      const v = [payload.x, payload.y, payload.z, payload.r].map(Number);
      if (!v.every(Number.isFinite)) return;
      const c = (n: number) => Math.max(-300, Math.min(300, n));
      this.p3Map(code).set(me.id, { x: c(v[0]), y: c(v[1]), z: c(v[2]), r: v[3], a: Number(payload.a) | 0 });
      this.ensureP3(code);
      return;
    }

    // Giochi veloci: i miei comandi (niente salvataggi né aggiornamenti generali: ci pensa il giro veloce)
    if (type === 'FAST_IN') {
      if (room.phase !== 'PLAYING' || !room.mg) return;
      const mode = MODES[room.mg.kind];
      if (!mode?.fast) return;
      try {
        mode.fast.input(room.mg.data, me.id, payload, this.ctxFor(room));
      } catch (err) {
        console.error('Comando veloce non valido', err);
      }
      return;
    }

    // Voce di prossimità: i telefoni si scambiano i messaggi per collegarsi direttamente (WebRTC). Il server li passa e basta:
    // l'audio non passa mai di qui e non viene registrato
    if (type === 'RTC') {
      const to = String(payload?.to ?? '');
      if (!room.players.some(p => p.id === to) || JSON.stringify(payload?.d ?? null).length > 20000) return;
      for (const sock of this.ctx.getWebSockets()) {
        const m = this.meta(sock);
        if (m?.roomCode === code && m.playerId === to) this.send(sock, 'RTC', { from: me.id, d: payload.d });
      }
      return;
    }

    // Giochi a moduli (Bomba, Disegna e indovina, Artista impostore e gli altri)
    if (type?.startsWith('MG_')) {
      if (!room.mg || room.phase !== 'PLAYING') return;
      const mode = MODES[room.mg.kind]!;
      const changed = mode.action(room.mg.data, me.id, type, payload, this.ctxFor(room));
      if (mode.finished(room.mg.data)) room.phase = 'ROUND_OVER';
      if (changed) {
        this.scheduleAlarm();
        this.broadcastRoom(code);
      } else this.persistSoon(room);
      return;
    }

    // Foglio condiviso: chi si è perso dei tratti (es. dopo essere rientrato) li richiede
    if (type === 'DRAW_SYNC') {
      const board = room.mg?.data?.board as Board | undefined;
      const from = Math.max(0, Number(payload.from) || 0);
      if (board && board.id === payload.board) this.send(ws, 'DRAW_SYNC', { board: board.id, from, ops: board.ops.slice(from) });
      return;
    }

    switch (type) {
      case 'UPDATE_SETTINGS': {
        if (!isHost || room.phase !== 'LOBBY') return; // i parametri li cambia solo chi ha creato la stanza
        const s = room.settings;
        if (GAMES.includes(payload.game)) s.game = payload.game;
        if (typeof payload.roundTimeSeconds === 'number') {
          s.roundTimeSeconds = payload.roundTimeSeconds <= 0 ? 0 : Math.max(60, Math.min(1800, Math.round(payload.roundTimeSeconds)));
        }
        if (typeof payload.drawSeconds === 'number') {
          s.drawSeconds = payload.drawSeconds <= 0 ? 0 : Math.max(30, Math.min(300, Math.round(payload.drawSeconds)));
        }
        if (typeof payload.spiesCount === 'number') s.spiesCount = Math.max(1, Math.min(3, Math.round(payload.spiesCount)));
        if (typeof payload.rolesEnabled === 'boolean') s.rolesEnabled = payload.rolesEnabled;
        if (typeof payload.impostorWord === 'boolean') s.impostorWord = payload.impostorWord;
        if (['MISTO', 'SILLABE', 'CATEGORIE', 'LETTERE'].includes(payload.bombaMode)) s.bombaMode = payload.bombaMode;
        if (typeof payload.bombaLives === 'number') s.bombaLives = Math.max(1, Math.min(5, Math.round(payload.bombaLives)));
        if (typeof payload.drawRounds === 'number') s.drawRounds = Math.max(1, Math.min(5, Math.round(payload.drawRounds)));
        if (typeof payload.guessSeconds === 'number') s.guessSeconds = Math.max(40, Math.min(150, Math.round(payload.guessSeconds)));
        if (typeof payload.customWords === 'string') s.customWords = payload.customWords.slice(0, 1500);
        if (typeof payload.onlyCustom === 'boolean') s.onlyCustom = payload.onlyCustom;
        if (typeof payload.battuteRounds === 'number') s.battuteRounds = Math.max(1, Math.min(3, Math.round(payload.battuteRounds)));
        if (typeof payload.writeSeconds === 'number') s.writeSeconds = Math.max(45, Math.min(180, Math.round(payload.writeSeconds)));
        if (typeof payload.prefQuestions === 'number') s.prefQuestions = Math.max(5, Math.min(30, Math.round(payload.prefQuestions)));
        if (typeof payload.sintoniaLaps === 'number') s.sintoniaLaps = Math.max(1, Math.min(3, Math.round(payload.sintoniaLaps)));
        if (typeof payload.tabuSeconds === 'number') s.tabuSeconds = Math.max(30, Math.min(120, Math.round(payload.tabuSeconds)));
        if (typeof payload.tabuLaps === 'number') s.tabuLaps = Math.max(1, Math.min(3, Math.round(payload.tabuLaps)));
        if (typeof payload.teatroLaps === 'number') s.teatroLaps = Math.max(1, Math.min(3, Math.round(payload.teatroLaps)));
        if (typeof payload.smorfieRounds === 'number') s.smorfieRounds = Math.max(1, Math.min(3, Math.round(payload.smorfieRounds)));
        if (typeof payload.diceCount === 'number') s.diceCount = Math.max(2, Math.min(6, Math.round(payload.diceCount)));
        if (typeof payload.nrLaps === 'number') s.nrLaps = Math.max(1, Math.min(3, Math.round(payload.nrLaps)));
        if (typeof payload.astroTasks === 'number') s.astroTasks = Math.max(2, Math.min(12, Math.round(payload.astroTasks)));
        if (typeof payload.astroKill === 'number') s.astroKill = Math.max(10, Math.min(60, Math.round(payload.astroKill)));
        if (typeof payload.astroMeeting === 'number') s.astroMeeting = Math.max(30, Math.min(180, Math.round(payload.astroMeeting)));
        if (typeof payload.partyBots === 'number') s.partyBots = Math.max(0, Math.min(11, Math.round(payload.partyBots)));
        if (typeof payload.partyRounds === 'number') s.partyRounds = Math.max(3, Math.min(15, Math.round(payload.partyRounds)));
        if (typeof payload.horrorPressure === 'number') s.horrorPressure = Math.max(0, Math.min(2, Math.round(payload.horrorPressure)));
        if (typeof payload.spicy === 'boolean') s.spicy = payload.spicy;
        if (typeof payload.privateRoom === 'boolean') s.privateRoom = payload.privateRoom;
        // giochi flat a moduli: solo le impostazioni del gioco scelto, solo con i valori ammessi
        if (payload.extra && typeof payload.extra === 'object') {
          const info = flatInfo(s.game);
          const turboOpts = s.game === 'TURBO' ? Object.values(TURBO_OPTIONS).map((o) => ({ key: o.key, values: o.values.map((v) => [v, '']) })) : [];
          for (const [k, v] of Object.entries(payload.extra as Record<string, unknown>)) {
            const o = info?.options.find((x) => x.key === k) ?? turboOpts.find((x) => x.key === k);
            if (o && typeof v === 'number' && o.values.some(([x]) => x === v)) s.extra = { ...(s.extra ?? {}), [k]: v };
          }
        }
        if (Array.isArray(payload.selectedCategories)) {
          const cats = payload.selectedCategories.filter((c: unknown) => typeof c === 'string' && LOCATION_CATEGORIES.includes(c));
          if (cats.length) s.selectedCategories = cats;
        }
        break;
      }

      case 'START_GAME': {
        if (!canLead || room.phase === 'PLAYING') return;
        const online = room.players.filter(p => p.isOnline);
        // Axend Party: si può giocare anche in pochi, i bot riempiono la partita
        const party = room.settings.game === 'PARTY3D';
        const turbo = room.settings.game === 'TURBO'; // Axend Turbo: si gioca anche da soli, i bot riempiono le squadre
        const horror = room.settings.game === 'HORROR1';
        const flat = flatInfo(room.settings.game);
        if (horror && online.length > 8) return this.error(ws, 'Questo gioco è per squadre da 1 a 8 persone.');
        if (flat && !MODES[flat.id]) return this.error(ws, `${flat.name} non è ancora pronto: scegli un altro gioco.`);
        if (flat && online.length < flat.min) return this.error(ws, `Per ${flat.name} servono almeno ${flat.min} giocatori collegati.`);
        if (flat?.max && online.length > flat.max) return this.error(ws, `${flat.name} si gioca al massimo in ${flat.max}.`);
        if (turbo && online.length > 6) return this.error(ws, 'Axend Turbo si gioca al massimo 3 contro 3.');
        if (!horror && !flat && !turbo && (party ? online.length < 1 || online.length + room.settings.partyBots < 3 : online.length < 3))
          return this.error(ws, party ? 'Servono almeno 3 giocatori, contando i bot.' : 'Servono almeno 3 giocatori collegati per iniziare.');
        this.resetRound(room);
        this.clearTel(room);
        this.clearMg(room);
        const mode = MODES[room.settings.game];
        if (mode) room.mg = { kind: room.settings.game, data: mode.start(room.settings, online, this.ctxFor(room)) };
        else if (room.settings.game === 'TELEFONO') this.startTelefono(room, online);
        else if (room.settings.game === 'IMPOSTORE') this.startImpostore(room, online);
        else this.startSpia(room, online);
        room.currentRound += 1;
        room.phase = 'PLAYING';
        if (room.mg && P3_GAMES.includes(room.mg.kind)) this.ensureP3(room.roomCode);
        if (room.mg && MODES[room.mg.kind]?.fast) this.ensureFast(room.roomCode);
        this.scheduleAlarm();
        break;
      }

      // ---- La Spia e L'Impostore ----
      case 'TOGGLE_CONFIRM':
        if (room.tel || room.phase !== 'PLAYING' || !room.roundPlayerIds.includes(me.id)) return;
        room.confirmations = room.confirmations.includes(me.id)
          ? room.confirmations.filter(id => id !== me.id)
          : [...room.confirmations, me.id];
        if (!this.waitingFor(room).length) this.endRound(room, false);
        break;

      case 'FORCE_END':
        if (room.tel || !canLead || room.phase !== 'PLAYING') return;
        this.endRound(room, true);
        break;

      // ---- Telefono senza fili ----
      case 'TEL_SUBMIT': {
        const t = room.tel;
        if (room.phase !== 'PLAYING' || !t) return;
        const i = t.order.indexOf(me.id);
        if (i < 0 || t.submitted.includes(me.id)) return;
        const kind = stepType(t.step);
        let content: string | null = null;
        if (kind === 'text') {
          content = typeof payload.text === 'string' && payload.text.trim() ? payload.text.trim().substring(0, 120) : null;
        } else if (typeof payload.drawing === 'string') {
          const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(payload.drawing);
          if (!match || match[1].length > MAX_DRAWING) return this.error(ws, 'Disegno non valido o troppo grande.');
          const id = `${code}-${Math.random().toString(36).substring(2, 12)}`;
          this.ctx.storage.put(`img:${id}`, Uint8Array.from(atob(match[1]), c => c.charCodeAt(0)));
          t.imageKeys.push(`img:${id}`);
          content = `/img/${id}`;
        }
        t.chains[mod(i - t.step, t.order.length)].entries[t.step] = { type: kind, by: me.id, content };
        t.submitted.push(me.id);
        if (!this.telWaiting(room).length) {
          this.advanceStep(room);
          this.scheduleAlarm();
        }
        break;
      }

      case 'TEL_FORCE_NEXT':
        if (!canLead || room.phase !== 'PLAYING' || !room.tel) return;
        this.advanceStep(room);
        this.scheduleAlarm();
        break;

      case 'TEL_REVEAL_NEXT': {
        const t = room.tel;
        if (!canLead || room.phase !== 'ROUND_OVER' || !t || t.revealDone) return;
        if (t.revealStep < t.totalSteps) t.revealStep += 1;
        else if (t.revealChain < t.chains.length - 1) {
          t.revealChain += 1;
          t.revealStep = 1;
        } else t.revealDone = true;
        break;
      }

      // ---- Comuni ----
      case 'BACK_TO_LOBBY':
        // Anche a partita in corso: si torna tutti alla stanza, senza svelare niente
        if (!canLead || room.phase === 'LOBBY') return;
        this.resetRound(room);
        this.clearTel(room);
        this.clearMg(room);
        room.phase = 'LOBBY';
        break;

      case 'KICK_PLAYER':
        if (!isHost || room.phase === 'PLAYING' || payload.playerId === me.id) return;
        this.removePlayer(room, String(payload.playerId), true);
        break;

      case 'LEAVE_ROOM':
        this.removePlayer(room, me.id, false);
        if (this.rooms.has(code)) this.broadcastRoom(code);
        return;

      default:
        return;
    }
    if (this.rooms.has(code)) this.broadcastRoom(code);
  }
}
