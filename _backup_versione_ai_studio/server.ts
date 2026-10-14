import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { fileURLToPath } from 'url';
import {
  GamePhase,
  GameSettings,
  LocationItem,
  Player,
  RoomState,
  ClientGameState,
  GameLogEntry
} from './src/types/game';
import { DEFAULT_LOCATIONS } from './src/data/locations';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);
const isProd = process.env.NODE_ENV === 'production';

app.use(express.json());

// In-memory room store
const rooms = new Map<string, RoomState>();
const roomTimers = new Map<string, NodeJS.Timeout>();

// Client connection mapping: socket -> { roomCode, playerId }
interface ClientMeta {
  roomCode: string;
  playerId: string;
  ws: WebSocket;
}
const socketClients = new Map<WebSocket, ClientMeta>();

// Helper to generate 4-character room codes
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  if (rooms.has(code)) {
    return generateRoomCode();
  }
  return code;
}

// Helper to get active locations based on settings
function getEligibleLocations(settings: GameSettings): LocationItem[] {
  let list = DEFAULT_LOCATIONS.filter(loc =>
    settings.selectedCategories.includes(loc.category)
  );
  if (list.length === 0) {
    list = DEFAULT_LOCATIONS;
  }
  return list;
}

// Broadcast sanitized state to all players in a room
function broadcastRoom(roomCode: string) {
  const room = rooms.get(roomCode);
  if (!room) return;

  const eligibleLocs = getEligibleLocations(room.settings);

  for (const [ws, meta] of socketClients.entries()) {
    if (meta.roomCode === roomCode && ws.readyState === WebSocket.OPEN) {
      const player = room.players.find(p => p.id === meta.playerId);
      if (!player) continue;

      const isGameOver = room.phase === 'ROUND_OVER';
      const isPlayerSpy = player.isSpy === true;

      // Sanitize other players so secrets aren't leaked in devtools
      const sanitizedPlayers = room.players.map(p => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        color: p.color,
        isHost: p.isHost,
        isReady: p.isReady,
        score: p.score,
        isOnline: p.isOnline,
        role: isGameOver ? p.role : (p.id === player.id ? p.role : undefined),
        isSpy: isGameOver ? p.isSpy : (p.id === player.id ? p.isSpy : undefined)
      }));

      const clientState: ClientGameState = {
        roomCode: room.roomCode,
        phase: room.phase,
        players: sanitizedPlayers,
        myId: player.id,
        hostId: room.hostId,
        settings: room.settings,
        currentRound: room.currentRound,
        startingPlayerId: room.startingPlayerId,
        timeRemaining: room.timeRemaining,
        timerRunning: room.timerRunning,
        accusation: room.accusation,
        spyGuess: room.spyGuess,
        roundResult: room.roundResult,
        logs: room.logs.slice(-20),
        availableLocations: eligibleLocs,
        myRole: isPlayerSpy ? 'La Spia' : (player.role || ''),
        isSpy: isPlayerSpy,
        location: isPlayerSpy ? null : (room.secretLocation || null)
      };

      try {
        ws.send(JSON.stringify({ type: 'STATE_UPDATE', payload: clientState }));
      } catch (err) {
        console.error('Error sending state to client:', err);
      }
    }
  }
}

function broadcastEvent(roomCode: string, type: string, payload: unknown) {
  for (const [ws, meta] of socketClients.entries()) {
    if (meta.roomCode === roomCode && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type, payload }));
      } catch (err) {
        console.error('Error broadcasting event:', err);
      }
    }
  }
}

function addLog(room: RoomState, text: string, type: GameLogEntry['type'] = 'INFO') {
  room.logs.push({
    id: Math.random().toString(36).substring(2, 9),
    timestamp: Date.now(),
    text,
    type
  });
}

// Timer controller for rooms
function stopRoomTimer(roomCode: string) {
  const existing = roomTimers.get(roomCode);
  if (existing) {
    clearInterval(existing);
    roomTimers.delete(roomCode);
  }
  const room = rooms.get(roomCode);
  if (room) {
    room.timerRunning = false;
  }
}

function startRoomTimer(roomCode: string) {
  stopRoomTimer(roomCode);
  const room = rooms.get(roomCode);
  if (!room) return;

  room.timerRunning = true;
  const interval = setInterval(() => {
    const currentRoom = rooms.get(roomCode);
    if (!currentRoom || !currentRoom.timerRunning || currentRoom.phase !== 'PLAYING') {
      stopRoomTimer(roomCode);
      return;
    }

    if (currentRoom.timeRemaining > 0) {
      currentRoom.timeRemaining -= 1;
      // Only broadcast tick every second if playing
      broadcastEvent(roomCode, 'TIMER_TICK', { timeRemaining: currentRoom.timeRemaining });
      if (currentRoom.timeRemaining === 0) {
        stopRoomTimer(roomCode);
        addLog(currentRoom, '⏰ Tempo scaduto! Inizia la fase di accusa finale o la spia può dichiararsi.', 'WARNING');
        currentRoom.phase = 'ACCUSATION';
        // Auto create final open accusation where everyone must vote
        broadcastRoom(roomCode);
      }
    } else {
      stopRoomTimer(roomCode);
    }
  }, 1000);

  roomTimers.set(roomCode, interval);
}

// Setup HTTP server
const httpServer = http.createServer(app);

// Setup WebSocket server
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

wss.on('connection', (ws: WebSocket) => {
  ws.on('message', (message: string) => {
    try {
      const data = JSON.parse(message.toString());
      handleClientMessage(ws, data);
    } catch (err) {
      console.error('Invalid message received:', err);
    }
  });

  ws.on('close', () => {
    const meta = socketClients.get(ws);
    if (meta) {
      const room = rooms.get(meta.roomCode);
      if (room) {
        const player = room.players.find(p => p.id === meta.playerId);
        if (player) {
          player.isOnline = false;
          addLog(room, `${player.name} si è disconnesso/a.`, 'INFO');
          // If host disconnected, reassign host to another online player if available
          if (player.isHost) {
            const nextOnline = room.players.find(p => p.isOnline && p.id !== player.id);
            if (nextOnline) {
              player.isHost = false;
              nextOnline.isHost = true;
              room.hostId = nextOnline.id;
              addLog(room, `${nextOnline.name} è ora il nuovo Capogruppo (Host).`, 'ACTION');
            }
          }
          broadcastRoom(meta.roomCode);
        }
      }
      socketClients.delete(ws);
    }
  });
});

function handleClientMessage(ws: WebSocket, message: { type: string; payload: any }) {
  const { type, payload } = message;

  switch (type) {
    case 'CREATE_ROOM': {
      const roomCode = generateRoomCode();
      const playerId = 'p_' + Math.random().toString(36).substring(2, 9);
      const newPlayer: Player = {
        id: playerId,
        name: (payload.name || 'Agente 007').trim().substring(0, 18),
        avatar: payload.avatar || '🕵️‍♂️',
        color: payload.color || '#3b82f6',
        isHost: true,
        isReady: true,
        score: 0,
        isOnline: true
      };

      const newRoom: RoomState = {
        roomCode,
        phase: 'LOBBY',
        players: [newPlayer],
        hostId: playerId,
        settings: {
          roundTimeSeconds: 420, // 7 minutes default
          spiesCount: 1,
          rolesEnabled: true,
          selectedCategories: [
            'Viaggi & Mezzi',
            'Città & Servizi',
            'Svago & Locali',
            'Lavoro & Studio',
            'Mistero & Avventura'
          ]
        },
        currentRound: 1,
        startingPlayerId: null,
        timeRemaining: 420,
        timerRunning: false,
        accusation: null,
        spyGuess: null,
        roundResult: null,
        logs: []
      };

      addLog(newRoom, `Stanza ${roomCode} creata da ${newPlayer.name}!`, 'ACTION');
      rooms.set(roomCode, newRoom);
      socketClients.set(ws, { roomCode, playerId, ws });

      ws.send(JSON.stringify({ type: 'ROOM_CREATED', payload: { roomCode, playerId } }));
      broadcastRoom(roomCode);
      break;
    }

    case 'JOIN_ROOM': {
      const roomCode = (payload.roomCode || '').toUpperCase().trim();
      const room = rooms.get(roomCode);
      if (!room) {
        ws.send(JSON.stringify({ type: 'ERROR', payload: { message: `Stanza "${roomCode}" non trovata!` } }));
        return;
      }

      // Check if rejoining existing player
      let player = room.players.find(p => p.id === payload.playerId);
      if (player) {
        player.isOnline = true;
        player.name = (payload.name || player.name).trim().substring(0, 18);
        if (payload.avatar) player.avatar = payload.avatar;
        if (payload.color) player.color = payload.color;
        addLog(room, `${player.name} è rientrato/a nella stanza.`, 'INFO');
      } else {
        if (room.phase !== 'LOBBY') {
          ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Partita già in corso! Attendi la fine del round.' } }));
          return;
        }

        const newPlayerId = 'p_' + Math.random().toString(36).substring(2, 9);
        player = {
          id: newPlayerId,
          name: (payload.name || 'Agente ' + (room.players.length + 1)).trim().substring(0, 18),
          avatar: payload.avatar || '🕶️',
          color: payload.color || '#10b981',
          isHost: room.players.length === 0,
          isReady: false,
          score: 0,
          isOnline: true
        };
        room.players.push(player);
        addLog(room, `${player.name} si è unito/a alla missione.`, 'INFO');
      }

      socketClients.set(ws, { roomCode, playerId: player.id, ws });
      ws.send(JSON.stringify({ type: 'JOINED_SUCCESS', payload: { roomCode, playerId: player.id } }));
      broadcastRoom(roomCode);
      break;
    }

    case 'UPDATE_PROFILE': {
      const meta = socketClients.get(ws);
      if (!meta) return;
      const room = rooms.get(meta.roomCode);
      if (!room) return;
      const player = room.players.find(p => p.id === meta.playerId);
      if (!player) return;

      if (payload.name) player.name = payload.name.trim().substring(0, 18);
      if (payload.avatar) player.avatar = payload.avatar;
      if (payload.color) player.color = payload.color;
      broadcastRoom(meta.roomCode);
      break;
    }

    case 'TOGGLE_READY': {
      const meta = socketClients.get(ws);
      if (!meta) return;
      const room = rooms.get(meta.roomCode);
      if (!room || room.phase !== 'LOBBY') return;
      const player = room.players.find(p => p.id === meta.playerId);
      if (!player) return;

      player.isReady = !player.isReady;
      broadcastRoom(meta.roomCode);
      break;
    }

    case 'UPDATE_SETTINGS': {
      const meta = socketClients.get(ws);
      if (!meta) return;
      const room = rooms.get(meta.roomCode);
      if (!room || room.hostId !== meta.playerId || room.phase !== 'LOBBY') return;

      if (typeof payload.roundTimeSeconds === 'number') {
        room.settings.roundTimeSeconds = Math.max(60, Math.min(1200, payload.roundTimeSeconds));
        room.timeRemaining = room.settings.roundTimeSeconds;
      }
      if (typeof payload.spiesCount === 'number') {
        room.settings.spiesCount = Math.max(1, Math.min(3, payload.spiesCount));
      }
      if (typeof payload.rolesEnabled === 'boolean') {
        room.settings.rolesEnabled = payload.rolesEnabled;
      }
      if (Array.isArray(payload.selectedCategories)) {
        room.settings.selectedCategories = payload.selectedCategories;
      }

      addLog(room, 'Impostazioni aggiornate dal Capogruppo.', 'INFO');
      broadcastRoom(meta.roomCode);
      break;
    }

    case 'START_GAME': {
      const meta = socketClients.get(ws);
      if (!meta) return;
      const room = rooms.get(meta.roomCode);
      if (!room || room.hostId !== meta.playerId) return;

      const onlinePlayers = room.players.filter(p => p.isOnline);
      if (onlinePlayers.length < 3) {
        ws.send(JSON.stringify({
          type: 'ERROR',
          payload: { message: 'Servono almeno 3 giocatori online per iniziare la missione!' }
        }));
        return;
      }

      // Pick a random location from active categories
      const eligibleLocs = getEligibleLocations(room.settings);
      const chosenLocation = eligibleLocs[Math.floor(Math.random() * eligibleLocs.length)];
      room.secretLocation = chosenLocation;

      // Determine spies
      const spiesCount = Math.min(room.settings.spiesCount, Math.floor(onlinePlayers.length / 2));
      const shuffledPlayers = [...onlinePlayers].sort(() => 0.5 - Math.random());
      const spyIds = new Set<string>();

      for (let i = 0; i < spiesCount; i++) {
        spyIds.add(shuffledPlayers[i].id);
      }

      // Assign roles
      const shuffledRoles = [...chosenLocation.roles].sort(() => 0.5 - Math.random());
      let roleIdx = 0;

      for (const p of room.players) {
        if (spyIds.has(p.id)) {
          p.isSpy = true;
          p.role = 'La Spia';
        } else {
          p.isSpy = false;
          if (room.settings.rolesEnabled) {
            p.role = shuffledRoles[roleIdx % shuffledRoles.length];
            roleIdx++;
          } else {
            p.role = 'Agente Innocente';
          }
        }
      }

      // Pick random starting player to interrogate first
      const randomStartingPlayer = onlinePlayers[Math.floor(Math.random() * onlinePlayers.length)];
      room.startingPlayerId = randomStartingPlayer.id;

      room.phase = 'REVEAL';
      room.timeRemaining = room.settings.roundTimeSeconds;
      room.accusation = null;
      room.spyGuess = null;
      room.roundResult = null;

      addLog(room, `Round ${room.currentRound} iniziato! Consulta la tua carta d'identità segreta.`, 'ACTION');
      addLog(room, `${randomStartingPlayer.name} farà la prima domanda!`, 'INFO');

      stopRoomTimer(meta.roomCode);
      broadcastRoom(meta.roomCode);
      break;
    }

    case 'START_INTERROGATION': {
      const meta = socketClients.get(ws);
      if (!meta) return;
      const room = rooms.get(meta.roomCode);
      if (!room || room.phase !== 'REVEAL') return;

      room.phase = 'PLAYING';
      addLog(room, 'Interrogatorio iniziato! Il tempo scorre...', 'ACTION');
      startRoomTimer(meta.roomCode);
      broadcastRoom(meta.roomCode);
      break;
    }

    case 'CALL_ACCUSATION': {
      const meta = socketClients.get(ws);
      if (!meta) return;
      const room = rooms.get(meta.roomCode);
      if (!room || room.phase !== 'PLAYING') return;

      const accuser = room.players.find(p => p.id === meta.playerId);
      const accused = room.players.find(p => p.id === payload.accusedId);
      if (!accuser || !accused || accuser.id === accused.id) return;

      stopRoomTimer(meta.roomCode);
      room.phase = 'ACCUSATION';
      room.accusation = {
        accuserId: accuser.id,
        accusedId: accused.id,
        votes: {
          [accuser.id]: true // Accuser naturally votes guilty
        },
        status: 'PENDING'
      };

      addLog(room, `🚨 ${accuser.name} ha lanciato un'accusa contro ${accused.name}! È lui/lei la spia?`, 'ACCUSATION');
      broadcastRoom(meta.roomCode);
      break;
    }

    case 'CANCEL_ACCUSATION': {
      const meta = socketClients.get(ws);
      if (!meta) return;
      const room = rooms.get(meta.roomCode);
      if (!room || room.phase !== 'ACCUSATION' || !room.accusation) return;

      // Only host or the accuser can cancel an accusation if not all have voted
      if (room.hostId === meta.playerId || room.accusation.accuserId === meta.playerId) {
        room.phase = 'PLAYING';
        room.accusation = null;
        addLog(room, 'Accusa ritirata. L\'interrogatorio riprende.', 'INFO');
        startRoomTimer(meta.roomCode);
        broadcastRoom(meta.roomCode);
      }
      break;
    }

    case 'CAST_VOTE': {
      const meta = socketClients.get(ws);
      if (!meta) return;
      const room = rooms.get(meta.roomCode);
      if (!room || room.phase !== 'ACCUSATION' || !room.accusation) return;

      const voter = room.players.find(p => p.id === meta.playerId);
      if (!voter) return;

      // Accused cannot vote on their own trial (standard Spyfall rules)
      if (voter.id === room.accusation.accusedId) return;

      room.accusation.votes[voter.id] = Boolean(payload.isGuilty);

      // Check if all eligible players have voted
      const eligibleVoters = room.players.filter(p => p.isOnline && p.id !== room.accusation!.accusedId);
      const votesCount = Object.keys(room.accusation.votes).length;

      if (votesCount >= eligibleVoters.length) {
        // Evaluate votes: require majority guilty votes
        const guiltyCount = Object.values(room.accusation.votes).filter(v => v === true).length;
        const required = Math.ceil(eligibleVoters.length * 0.5);
        const accusedPlayer = room.players.find(p => p.id === room.accusation!.accusedId);

        if (guiltyCount >= required && accusedPlayer) {
          // Accused is voted guilty!
          room.accusation.status = 'PASSED';
          if (accusedPlayer.isSpy) {
            // Found the spy! Spy gets one final chance to guess the location!
            addLog(room, `🎯 Voto confermato! ${accusedPlayer.name} è DAVVERO LA SPIA! Ha un'ultima possibilità per indovinare il luogo.`, 'ACTION');
            room.phase = 'SPY_GUESS';
            room.spyGuess = {
              spyId: accusedPlayer.id,
              guessedLocationId: null,
              isCorrect: null
            };
          } else {
            // Accused an innocent citizen! The Spies win immediately!
            addLog(room, `💥 ERRORE FATALE! ${accusedPlayer.name} era un innocente! Le Spie vincono!`, 'WIN');
            finishRound(room, 'SPIES', `${accusedPlayer.name} è stato accusato ingiustamente!`);
          }
        } else {
          // Accusation rejected
          room.accusation.status = 'FAILED';
          addLog(room, `La maggioranza non ha ritenuto colpevole ${accusedPlayer?.name}. L'interrogatorio riprende!`, 'INFO');
          room.phase = 'PLAYING';
          room.accusation = null;
          startRoomTimer(meta.roomCode);
        }
      }

      broadcastRoom(meta.roomCode);
      break;
    }

    case 'SPY_DECLARE': {
      // Spy voluntarily reveals themselves and attempts to guess the location
      const meta = socketClients.get(ws);
      if (!meta) return;
      const room = rooms.get(meta.roomCode);
      if (!room || (room.phase !== 'PLAYING' && room.phase !== 'ACCUSATION')) return;

      const player = room.players.find(p => p.id === meta.playerId);
      if (!player || !player.isSpy) {
        ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Solo una Spia può dichiararsi per indovinare il luogo!' } }));
        return;
      }

      stopRoomTimer(meta.roomCode);
      room.phase = 'SPY_GUESS';
      room.spyGuess = {
        spyId: player.id,
        guessedLocationId: null,
        isCorrect: null
      };

      addLog(room, `🕵️‍♂️ ${player.name} si è dichiarato/a come Spia e sta per indovinare il luogo!`, 'ACCUSATION');
      broadcastRoom(meta.roomCode);
      break;
    }

    case 'SUBMIT_SPY_GUESS': {
      const meta = socketClients.get(ws);
      if (!meta) return;
      const room = rooms.get(meta.roomCode);
      if (!room || room.phase !== 'SPY_GUESS' || !room.spyGuess) return;

      if (room.spyGuess.spyId !== meta.playerId) return;

      const guessedId = payload.locationId;
      const isCorrect = guessedId === room.secretLocation?.id;
      room.spyGuess.guessedLocationId = guessedId;
      room.spyGuess.isCorrect = isCorrect;

      const guessedLoc = DEFAULT_LOCATIONS.find(l => l.id === guessedId);
      const spyPlayer = room.players.find(p => p.id === meta.playerId);

      if (isCorrect) {
        addLog(room, `🎉 La Spia ${spyPlayer?.name} ha indovinato correttamente il luogo: ${room.secretLocation?.name}! Le Spie vincono!`, 'WIN');
        finishRound(room, 'SPIES', `La Spia ha indovinato il luogo segreto (${room.secretLocation?.name})!`);
      } else {
        addLog(room, `❌ La Spia ${spyPlayer?.name} ha sbagliato il luogo (ha detto ${guessedLoc?.name || 'Sconosciuto'} invece di ${room.secretLocation?.name})! Gli Agenti vincono!`, 'WIN');
        finishRound(room, 'CITIZENS', `La Spia non ha indovinato il luogo (${room.secretLocation?.name})!`);
      }

      broadcastRoom(meta.roomCode);
      break;
    }

    case 'NEXT_ROUND': {
      const meta = socketClients.get(ws);
      if (!meta) return;
      const room = rooms.get(meta.roomCode);
      if (!room || room.hostId !== meta.playerId) return;

      stopRoomTimer(meta.roomCode);
      room.currentRound += 1;
      room.phase = 'LOBBY';
      room.secretLocation = undefined;
      room.startingPlayerId = null;
      room.timeRemaining = room.settings.roundTimeSeconds;
      room.accusation = null;
      room.spyGuess = null;
      room.roundResult = null;

      // Reset ready states except host
      for (const p of room.players) {
        p.isReady = p.id === room.hostId;
        p.role = undefined;
        p.isSpy = undefined;
      }

      addLog(room, `Pronti per il Round ${room.currentRound}! I punteggi sono conservati.`, 'ACTION');
      broadcastRoom(meta.roomCode);
      break;
    }

    case 'RESET_SCORES': {
      const meta = socketClients.get(ws);
      if (!meta) return;
      const room = rooms.get(meta.roomCode);
      if (!room || room.hostId !== meta.playerId) return;

      for (const p of room.players) {
        p.score = 0;
      }
      room.currentRound = 1;
      addLog(room, 'Punteggi azzerati dal Capogruppo.', 'INFO');
      broadcastRoom(meta.roomCode);
      break;
    }

    case 'SEND_REACTION': {
      const meta = socketClients.get(ws);
      if (!meta) return;
      const room = rooms.get(meta.roomCode);
      if (!room) return;
      const player = room.players.find(p => p.id === meta.playerId);
      if (!player) return;

      broadcastEvent(meta.roomCode, 'REACTION', {
        playerId: player.id,
        playerName: player.name,
        emoji: payload.emoji
      });
      break;
    }

    case 'CHAT_MESSAGE': {
      const meta = socketClients.get(ws);
      if (!meta) return;
      const room = rooms.get(meta.roomCode);
      if (!room) return;
      const player = room.players.find(p => p.id === meta.playerId);
      if (!player) return;

      const text = (payload.text || '').trim().substring(0, 150);
      if (!text) return;

      broadcastEvent(meta.roomCode, 'CHAT_MESSAGE', {
        id: Math.random().toString(36).substring(2, 9),
        senderId: player.id,
        senderName: player.name,
        senderColor: player.color,
        text,
        timestamp: Date.now()
      });
      break;
    }

    default:
      console.warn('Unknown message type:', type);
  }
}

function finishRound(room: RoomState, winner: 'SPIES' | 'CITIZENS', reason: string) {
  stopRoomTimer(room.roomCode);
  room.phase = 'ROUND_OVER';

  const spyPlayers = room.players.filter(p => p.isSpy);
  const spyIds = spyPlayers.map(p => p.id);
  const pointsAwarded: Record<string, number> = {};

  if (winner === 'SPIES') {
    // Spies win: +3 points to each spy
    for (const p of room.players) {
      if (p.isSpy) {
        p.score += 3;
        pointsAwarded[p.id] = 3;
      } else {
        pointsAwarded[p.id] = 0;
      }
    }
  } else {
    // Citizens win: +1 point to each citizen, +2 if citizen initiated successful accusation
    const successfulAccuser = room.accusation?.status === 'PASSED' ? room.accusation.accuserId : null;
    for (const p of room.players) {
      if (!p.isSpy) {
        const bonus = p.id === successfulAccuser ? 2 : 1;
        p.score += bonus;
        pointsAwarded[p.id] = bonus;
      } else {
        pointsAwarded[p.id] = 0;
      }
    }
  }

  room.roundResult = {
    winner,
    reason,
    spyIds,
    location: room.secretLocation || DEFAULT_LOCATIONS[0],
    playerRoles: room.players.map(p => ({
      playerId: p.id,
      name: p.name,
      role: p.role || (p.isSpy ? 'La Spia' : 'Agente'),
      isSpy: p.isSpy === true
    })),
    pointsAwarded
  };
}

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', activeRooms: rooms.size });
});

// Configure Vite or Static files
async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`Spyfall server running on http://0.0.0.0:${port}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
