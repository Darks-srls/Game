import { useState, useEffect, useRef, useCallback } from 'react';
import { ClientGameState, GameSettings, ChatMessage } from '../types/game';
import { soundManager } from '../utils/audio';

export interface ReactionEvent {
  playerId: string;
  playerName: string;
  emoji: string;
  id: string;
}

export function useGameSocket() {
  const [connected, setConnected] = useState(false);
  const [gameState, setGameState] = useState<ClientGameState | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [reactions, setReactions] = useState<ReactionEvent[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isManuallyClosedRef = useRef(false);
  const phaseRef = useRef<string | undefined>(undefined);

  // Retrieve saved session
  const getSavedSession = () => {
    try {
      const roomCode = sessionStorage.getItem('spyfall_roomCode');
      const playerId = sessionStorage.getItem('spyfall_playerId');
      return { roomCode, playerId };
    } catch {
      return { roomCode: null, playerId: null };
    }
  };

  const saveSession = (roomCode: string, playerId: string) => {
    try {
      sessionStorage.setItem('spyfall_roomCode', roomCode);
      sessionStorage.setItem('spyfall_playerId', playerId);
    } catch (e) {
      console.warn('Storage not available', e);
    }
  };

  const clearSession = () => {
    try {
      sessionStorage.removeItem('spyfall_roomCode');
      sessionStorage.removeItem('spyfall_playerId');
    } catch (e) {
      console.warn('Storage not available', e);
    }
  };

  const connect = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

    try {
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      // Keepalive: evita che reti mobili/NAT chiudano la connessione inattiva
      const ping = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) socket.send('ping');
      }, 30000);
      socket.addEventListener('close', () => clearInterval(ping));

      socket.onopen = () => {
        setConnected(true);
        setErrorMessage(null);

        // Attempt to rejoin if there was a saved session
        const { roomCode, playerId } = getSavedSession();
        if (roomCode && playerId) {
          socket.send(JSON.stringify({
            type: 'JOIN_ROOM',
            payload: { roomCode, playerId }
          }));
        }
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const { type, payload } = data;

          switch (type) {
            case 'STATE_UPDATE': {
              const prevPhase = phaseRef.current;
              phaseRef.current = payload.phase;
              setGameState(payload);
              if (payload.roomCode && payload.myId) {
                saveSession(payload.roomCode, payload.myId);
              }

              // Sound triggers on phase transition
              if (prevPhase !== payload.phase) {
                if (payload.phase === 'REVEAL') {
                  soundManager.playRoleReveal(payload.isSpy);
                } else if (payload.phase === 'ACCUSATION') {
                  soundManager.playAlarm();
                } else if (payload.phase === 'ROUND_OVER') {
                  soundManager.playVictory();
                }
              }
              break;
            }

            case 'TIMER_TICK': {
              setGameState(prev => {
                if (!prev) return null;
                const newTime = payload.timeRemaining;
                if (newTime <= 10 && newTime > 0) {
                  soundManager.playTick();
                }
                return { ...prev, timeRemaining: newTime };
              });
              break;
            }

            case 'ROOM_CREATED':
            case 'JOINED_SUCCESS': {
              saveSession(payload.roomCode, payload.playerId);
              break;
            }

            case 'REACTION': {
              const newReaction: ReactionEvent = {
                id: Math.random().toString(36).substring(2, 9),
                playerId: payload.playerId,
                playerName: payload.playerName,
                emoji: payload.emoji
              };
              setReactions(prev => [...prev.slice(-10), newReaction]);
              // Auto remove after 3.5s
              setTimeout(() => {
                setReactions(prev => prev.filter(r => r.id !== newReaction.id));
              }, 3500);
              break;
            }

            case 'CHAT_MESSAGE': {
              setChatMessages(prev => [...prev.slice(-50), payload]);
              break;
            }

            case 'ERROR': {
              setErrorMessage(payload.message || 'Errore di gioco');
              // Clear error message after 5 seconds
              setTimeout(() => setErrorMessage(null), 5000);
              break;
            }

            default:
              break;
          }
        } catch (err) {
          console.error('Error parsing WS message:', err);
        }
      };

      socket.onclose = () => {
        setConnected(false);
        if (!isManuallyClosedRef.current) {
          // Reconnect attempt
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 2000);
        }
      };

      socket.onerror = (err) => {
        console.error('WebSocket error:', err);
        socket.close();
      };
    } catch (err) {
      console.error('WebSocket initialization error:', err);
    }
  }, []); // stabile: prima si riconnetteva a ogni cambio di fase

  useEffect(() => {
    isManuallyClosedRef.current = false;
    connect();

    return () => {
      isManuallyClosedRef.current = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  const send = useCallback((type: string, payload: unknown = {}) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
    }
  }, []);

  const createRoom = useCallback((name: string, avatar: string, color: string) => {
    soundManager.playClick();
    send('CREATE_ROOM', { name, avatar, color });
  }, [send]);

  const joinRoom = useCallback((roomCode: string, name: string, avatar: string, color: string) => {
    soundManager.playClick();
    send('JOIN_ROOM', { roomCode, name, avatar, color });
  }, [send]);

  const updateProfile = useCallback((name?: string, avatar?: string, color?: string) => {
    send('UPDATE_PROFILE', { name, avatar, color });
  }, [send]);

  const toggleReady = useCallback(() => {
    soundManager.playClick();
    send('TOGGLE_READY');
  }, [send]);

  const updateSettings = useCallback((settings: Partial<GameSettings>) => {
    soundManager.playClick();
    send('UPDATE_SETTINGS', settings);
  }, [send]);

  const startGame = useCallback(() => {
    soundManager.playClick();
    send('START_GAME');
  }, [send]);

  const startInterrogation = useCallback(() => {
    soundManager.playClick();
    send('START_INTERROGATION');
  }, [send]);

  const callAccusation = useCallback((accusedId: string) => {
    soundManager.playClick();
    send('CALL_ACCUSATION', { accusedId });
  }, [send]);

  const cancelAccusation = useCallback(() => {
    soundManager.playClick();
    send('CANCEL_ACCUSATION');
  }, [send]);

  const castVote = useCallback((isGuilty: boolean) => {
    soundManager.playClick();
    send('CAST_VOTE', { isGuilty });
  }, [send]);

  const declareSpy = useCallback(() => {
    soundManager.playClick();
    send('SPY_DECLARE');
  }, [send]);

  const submitSpyGuess = useCallback((locationId: string) => {
    soundManager.playClick();
    send('SUBMIT_SPY_GUESS', { locationId });
  }, [send]);

  const nextRound = useCallback(() => {
    soundManager.playClick();
    send('NEXT_ROUND');
  }, [send]);

  const resetScores = useCallback(() => {
    soundManager.playClick();
    send('RESET_SCORES');
  }, [send]);

  const sendReaction = useCallback((emoji: string) => {
    soundManager.playClick();
    send('SEND_REACTION', { emoji });
  }, [send]);

  const sendChatMessage = useCallback((text: string) => {
    send('CHAT_MESSAGE', { text });
  }, [send]);

  const leaveRoom = useCallback(() => {
    clearSession();
    setGameState(null);
    if (wsRef.current) {
      wsRef.current.close();
      connect();
    }
  }, [connect]);

  return {
    connected,
    gameState,
    chatMessages,
    reactions,
    errorMessage,
    createRoom,
    joinRoom,
    updateProfile,
    toggleReady,
    updateSettings,
    startGame,
    startInterrogation,
    callAccusation,
    cancelAccusation,
    castVote,
    declareSpy,
    submitSpyGuess,
    nextRound,
    resetScores,
    sendReaction,
    sendChatMessage,
    leaveRoom
  };
}
