import type { NetPos } from '../data/party3d';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { BoardInfo, ClientGameState, DrawOp, GameId, GameSettings, RoomSummary } from '../types/game';
import { soundManager } from '../utils/audio';

const SESSION_KEY = 'spia_sessione';
const FATAL_ERRORS = ['ROOM_NOT_FOUND', 'SESSION_EXPIRED', 'ROOM_FULL'];
// Azioni segrete dei videogiochi: niente suono di clic (dal vivo si sentirebbe chi le fa)
const SILENT_ACTIONS = ['MG_TASK', 'MG_KILL', 'MG_VENT', 'MG_SABOTAGE', 'MG_FIX', 'MG_HOLD', 'MG_DOOR', 'MG_CAMS', 'MG_PUSH', 'MG_SIT', 'MG_SHOOT', 'MG_DASH', 'MG_RELEASE', 'MG_PICK', 'MG_DROP', 'MG_PING', 'MG_EVAC', 'MG_THROW', 'MG_STOP', 'MG_ACCECA', 'MG_LOTTA', 'MG_CODICE', 'MG_LUCCHETTO', 'MG_HIDE', 'MG_RESPIRO', 'MG_VOCE', 'MG_GUASTO', 'MG_NUMERO', 'MG_PROVA'];

type Session = { roomCode: string; playerId: string; savedAt: number };

// Videogiochi: ultime posizioni arrivate dal server (lette dal disegno a ogni fotogramma, senza ridisegnare React)
export type RtPositions = { at: number; p: Map<string, { x: number; y: number; f: number; m: number }> };
export interface Realtime {
  ref: { current: RtPositions };
  send: (x: number, y: number, f: number, m: number) => void;
  // giochi 3D (Axend Party)
  p3: { current: P3Positions };
  p3send: (p: NetPos) => void;
  p3events: { current: ((type: 'P3_KNOCK' | 'P3_FX', payload: any) => void) | null };
  // voce di prossimità: messaggi per collegare direttamente i telefoni (il server li passa e basta)
  rtcSend: (to: string, d: unknown) => void;
  rtc: { current: ((from: string, d: any) => void) | null };
  // voce che passa dal server (pezzetti compressi in binario)
  voiceSend: (data: ArrayBuffer) => void;
  voiceIn: { current: ((from: string, flags: number, data: Uint8Array) => void) | null };
}
export type P3Positions = { at: number; p: Map<string, NetPos> };

// La sessione resta salvata anche chiudendo il browser: riaprendo si rientra da soli
export function loadSession(): Session | null {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') as Session | null;
    return s && Date.now() - s.savedAt < 12 * 60 * 60 * 1000 ? s : null;
  } catch {
    return null;
  }
}

function saveSession(roomCode: string, playerId: string) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ roomCode, playerId, savedAt: Date.now() }));
  } catch {
    // memoria del browser non disponibile
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // memoria del browser non disponibile
  }
}

export function useGameSocket() {
  const [connected, setConnected] = useState(false);
  const [gameState, setGameState] = useState<ClientGameState | null>(null);
  const [restoring, setRestoring] = useState(() => !!loadSession());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [clockOffset, setClockOffset] = useState(0);
  // Stanze aperte (home): arrivano dal server e si aggiornano da sole
  const [rooms, setRooms] = useState<RoomSummary[] | null>(null);
  // Foglio condiviso dei giochi con disegno: la lista dei tratti si aggiorna sul posto
  const [boardVersion, setBoardVersion] = useState(0);
  const boardRef = useRef<{ id: number; ops: DrawOp[]; syncing: number }>({ id: -1, ops: [], syncing: 0 });
  const rtRef = useRef<RtPositions>({ at: 0, p: new Map() });
  const p3Ref = useRef<P3Positions>({ at: 0, p: new Map() });
  const p3EventsRef = useRef<((type: 'P3_KNOCK' | 'P3_FX', payload: any) => void) | null>(null);
  const rtcRef = useRef<((from: string, d: any) => void) | null>(null);
  const voiceInRef = useRef<((from: string, flags: number, data: Uint8Array) => void) | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const lastMessageRef = useRef(Date.now());
  const retryRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingRef = useRef<string | null>(null); // creazione/ingresso da inviare appena connessi
  const phaseRef = useRef('');
  const stoppedRef = useRef(false);

  const showError = useCallback((message: string) => {
    setErrorMessage(message);
    clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setErrorMessage(null), 4500);
  }, []);

  // Disegno nuovo o tratti mancanti (es. dopo un rientro): si chiedono al server quelli che non ho
  const syncBoard = useCallback((ws: WebSocket, board: BoardInfo) => {
    if (boardRef.current.id !== board.id) {
      boardRef.current = { id: board.id, ops: [], syncing: 0 };
      setBoardVersion((v) => v + 1);
    }
    const b = boardRef.current;
    if (board.count > b.ops.length && Date.now() - b.syncing > 2000) {
      b.syncing = Date.now();
      ws.send(JSON.stringify({ type: 'DRAW_SYNC', payload: { board: b.id, from: b.ops.length } }));
    }
  }, []);

  const connect = useCallback(() => {
    clearTimeout(retryRef.current);
    const old = wsRef.current;
    if (old) {
      old.onclose = null;
      old.onmessage = null;
      try {
        old.close();
      } catch {
        // già chiusa
      }
    }
    const socket = new WebSocket(`${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`);
    wsRef.current = socket;
    lastMessageRef.current = Date.now();

    socket.onopen = () => {
      setConnected(true);
      const pending = pendingRef.current;
      pendingRef.current = null;
      const session = loadSession();
      if (pending) socket.send(pending);
      else if (session) {
        socket.send(JSON.stringify({ type: 'JOIN_ROOM', payload: { roomCode: session.roomCode, playerId: session.playerId } }));
      } else {
        setRestoring(false);
        socket.send(JSON.stringify({ type: 'WATCH_ROOMS', payload: {} })); // sono nella home: voglio la lista delle stanze
      }
    };

    socket.binaryType = 'arraybuffer';
    socket.onmessage = (event) => {
      lastMessageRef.current = Date.now();
      if (event.data instanceof ArrayBuffer) {
        // voce: [0xA2][lunghezza id][id][flag][campioni]
        const b = new Uint8Array(event.data);
        if (b[0] === 0xa2 && b.length > 3) {
          const n = b[1];
          const from = new TextDecoder().decode(b.subarray(2, 2 + n));
          voiceInRef.current?.(from, b[2 + n], b.subarray(3 + n));
        }
        return;
      }
      let data: { type?: string; payload?: any };
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }
      const { type, payload } = data;
      if (type === 'STATE_UPDATE') {
        const state = payload as ClientGameState;
        const offset = state.serverNow - Date.now();
        setClockOffset((prev) => (Math.abs(prev - offset) > 1000 ? offset : prev));
        saveSession(state.roomCode, state.myId);
        const phaseKey = `${state.phase}:${state.currentRound}`;
        // il ritorno alla stanza fa un "whoosh"; inizio e fine partita hanno i loro suoni (uguali per tutti)
        if (phaseRef.current && phaseKey !== phaseRef.current && state.phase === 'LOBBY') soundManager.playWhoosh();
        phaseRef.current = phaseKey;
        setRestoring(false);
        setGameState(state);
        const board = (state.mg as { board?: BoardInfo } | null)?.board;
        if (board) syncBoard(socket, board);
      } else if (type === 'P3_POS') {
        p3Ref.current = {
          at: Date.now(),
          p: new Map((payload?.p ?? []).map(([id, x, y, z, r, a]: [string, number, number, number, number, number]) => [id, { x, y, z, r, a }])),
        };
      } else if (type === 'P3_KNOCK' || type === 'P3_FX') {
        p3EventsRef.current?.(type, payload);
      } else if (type === 'RTC') {
        rtcRef.current?.(payload?.from, payload?.d);
      } else if (type === 'RT_POS') {
        rtRef.current = { at: Date.now(), p: new Map((payload?.p ?? []).map(([id, x, y, f, m]: [string, number, number, number, number]) => [id, { x, y, f, m }])) };
      } else if (type === 'ROOMS') {
        setRooms(Array.isArray(payload) ? (payload as RoomSummary[]) : []);
      } else if (type === 'JOINED') {
        saveSession(payload.roomCode, payload.playerId);
      } else if (type === 'ERROR') {
        if (FATAL_ERRORS.includes(payload?.code)) {
          clearSession();
          phaseRef.current = '';
          setGameState(null);
          setRestoring(false);
        }
        soundManager.playError();
        showError(payload?.message || 'Qualcosa è andato storto');
      } else if (type === 'KICKED') {
        clearSession();
        phaseRef.current = '';
        setGameState(null);
        showError('Chi ha creato la stanza ti ha rimosso.');
      } else if (type === 'DRAW_OP') {
        // un tratto nuovo di chi sta disegnando
        const b = boardRef.current;
        if (payload.board !== b.id) return;
        if (payload.index === b.ops.length) {
          b.ops.push(payload.op);
          setBoardVersion((v) => v + 1);
        } else if (payload.index > b.ops.length && Date.now() - b.syncing > 2000) {
          b.syncing = Date.now();
          socket.send(JSON.stringify({ type: 'DRAW_SYNC', payload: { board: b.id, from: b.ops.length } }));
        }
      } else if (type === 'DRAW_SYNC') {
        // i tratti che mi mancavano
        const b = boardRef.current;
        if (payload.board !== b.id || payload.from > b.ops.length) return;
        b.ops = [...b.ops.slice(0, payload.from), ...payload.ops];
        b.syncing = 0;
        setBoardVersion((v) => v + 1);
      }
    };

    socket.onclose = () => {
      if (wsRef.current !== socket) return;
      setConnected(false);
      if (!stoppedRef.current) retryRef.current = setTimeout(connect, 1500);
    };

    socket.onerror = () => {
      try {
        socket.close();
      } catch {
        // già chiusa
      }
    };
  }, [showError]);

  useEffect(() => {
    stoppedRef.current = false;
    connect();

    // Ping regolare + controllo delle connessioni "zombie" (telefono bloccato, cambio di rete)
    const heartbeat = setInterval(() => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      if (Date.now() - lastMessageRef.current > 45000) connect();
      else ws.send('ping');
    }, 15000);

    // Quando si torna sull'app, ci si ricollega subito e si rientra nella stanza
    let hiddenAt = 0;
    const wake = () => {
      if (document.visibilityState !== 'visible') {
        hiddenAt = Date.now();
        return;
      }
      const ws = wsRef.current;
      const wasAway = hiddenAt > 0 && Date.now() - hiddenAt > 5000;
      hiddenAt = 0;
      // dopo qualche secondo fuori dall'app la connessione del telefono spesso è morta: meglio riaprirla subito
      if (!ws || ws.readyState > WebSocket.OPEN || wasAway) {
        connect();
        return;
      }
      if (ws.readyState !== WebSocket.OPEN) return;
      const sentAt = Date.now();
      ws.send('ping');
      setTimeout(() => {
        if (wsRef.current === ws && lastMessageRef.current < sentAt) connect();
      }, 4000);
    };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('online', wake);
    window.addEventListener('pageshow', wake);

    return () => {
      stoppedRef.current = true;
      clearInterval(heartbeat);
      clearTimeout(retryRef.current);
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('online', wake);
      window.removeEventListener('pageshow', wake);
      const ws = wsRef.current;
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, [connect]);

  // Tornati nella home (es. stanza chiusa o scaduta) con la connessione aperta: si torna a seguire le stanze
  const onHome = connected && !gameState && !restoring;
  useEffect(() => {
    const ws = wsRef.current;
    if (onHome && ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'WATCH_ROOMS', payload: {} }));
  }, [onHome]);

  const send = useCallback(
    (type: string, payload: unknown = {}) => {
      const ws = wsRef.current;
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type, payload }));
        return;
      }
      showError('Connessione persa: mi ricollego…');
      if (!ws || ws.readyState > WebSocket.OPEN) connect();
    },
    [connect, showError],
  );

  // Creazione e ingresso: se la connessione non è ancora pronta, partono appena si apre
  const sendOrQueue = useCallback(
    (type: string, payload: unknown) => {
      const ws = wsRef.current;
      const message = JSON.stringify({ type, payload });
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(message);
        return;
      }
      pendingRef.current = message;
      if (!ws || ws.readyState > WebSocket.OPEN) connect();
    },
    [connect],
  );

  // Esci: nuova connessione pulita, così nessun messaggio della vecchia stanza ti riporta dentro
  const leaveRoom = useCallback(() => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'LEAVE_ROOM', payload: {} }));
    clearSession();
    phaseRef.current = '';
    setGameState(null);
    connect();
  }, [connect]);

  const cancelRestore = useCallback(() => {
    clearSession();
    setRestoring(false);
    setGameState(null);
    connect();
  }, [connect]);

  return {
    connected,
    gameState,
    rooms,
    errorMessage,
    clockOffset,
    restoring,
    cancelRestore,
    leaveRoom,
    createRoom: (name: string, avatar: string, color: string, game: GameId) => {
      soundManager.playClick();
      sendOrQueue('CREATE_ROOM', { name, avatar, color, game });
    },
    joinRoom: (roomCode: string, name: string, avatar: string, color: string) => {
      soundManager.playClick();
      sendOrQueue('JOIN_ROOM', { roomCode, name, avatar, color });
    },
    updateSettings: (settings: Partial<GameSettings>) => {
      soundManager.playClick();
      send('UPDATE_SETTINGS', settings);
    },
    startGame: () => {
      soundManager.playClick();
      send('START_GAME');
    },
    toggleConfirm: () => {
      soundManager.playClick();
      send('TOGGLE_CONFIRM');
    },
    forceEnd: () => send('FORCE_END'),
    backToLobby: () => {
      soundManager.playClick();
      send('BACK_TO_LOBBY');
    },
    kickPlayer: (playerId: string) => send('KICK_PLAYER', { playerId }),
    telSubmit: (content: { text?: string; drawing?: string | null }) => send('TEL_SUBMIT', content),
    telForceNext: () => send('TEL_FORCE_NEXT'),
    telRevealNext: () => {
      soundManager.playClick();
      send('TEL_REVEAL_NEXT');
    },
    // Giochi a moduli
    board: boardRef.current.ops,
    boardVersion,
    mgAction: (type: string, payload: unknown = {}) => {
      if (!SILENT_ACTIONS.includes(type)) soundManager.playClick();
      send(type, payload);
    },
    // Videogiochi: la mia posizione (senza suoni e senza avvisi, va e basta)
    realtime: {
      ref: rtRef,
      send: (x: number, y: number, f: number, m: number) => {
        const ws = wsRef.current;
        if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'RT_MOVE', payload: { x: Math.round(x), y: Math.round(y), f, m } }));
      },
      p3: p3Ref,
      p3send: (p: NetPos) => {
        const ws = wsRef.current;
        const k = (v: number) => Math.round(v * 100) / 100;
        if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'P3_MOVE', payload: { x: k(p.x), y: k(p.y), z: k(p.z), r: k(p.r), a: p.a } }));
      },
      p3events: p3EventsRef,
      rtcSend: (to: string, d: unknown) => {
        const ws = wsRef.current;
        if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'RTC', payload: { to, d } }));
      },
      rtc: rtcRef,
      voiceSend: (data: ArrayBuffer) => {
        const ws = wsRef.current;
        // se la connessione è intasata si salta un pezzetto invece di accumulare ritardo
        if (ws?.readyState === WebSocket.OPEN && ws.bufferedAmount < 64000) ws.send(data);
      },
      voiceIn: voiceInRef,
    } as Realtime,
    // Il mio tratto: compare subito sul mio foglio e parte verso gli altri
    drawOp: (op: DrawOp) => {
      boardRef.current.ops.push(op);
      setBoardVersion((v) => v + 1);
      const ws = wsRef.current;
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'MG_DRAW', payload: { op } }));
    },
  };
}
