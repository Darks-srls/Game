export interface Player {
  id: string;
  name: string;
  avatar: string;
  color: string;
  isHost: boolean;
  isReady: boolean;
  score: number;
  isOnline: boolean;
  role?: string;
  isSpy?: boolean;
}

export interface LocationRole {
  name: string;
  description?: string;
}

export interface LocationItem {
  id: string;
  name: string;
  category: string;
  icon: string;
  description: string;
  roles: string[];
}

export interface GameSettings {
  roundTimeSeconds: number; // e.g. 300, 360, 480
  spiesCount: number; // 1 or 2
  rolesEnabled: boolean;
  selectedCategories: string[];
}

export type GamePhase =
  | 'LOBBY'
  | 'REVEAL'
  | 'PLAYING'
  | 'ACCUSATION'
  | 'SPY_GUESS'
  | 'ROUND_OVER';

export interface Accusation {
  accuserId: string;
  accusedId: string;
  votes: Record<string, boolean>; // playerId -> true (colpevole/spia) / false (innocente)
  status: 'PENDING' | 'PASSED' | 'FAILED';
}

export interface SpyGuess {
  spyId: string;
  guessedLocationId: string | null;
  isCorrect: boolean | null;
}

export interface RoundResult {
  winner: 'SPIES' | 'CITIZENS';
  reason: string;
  spyIds: string[];
  location: LocationItem;
  playerRoles: { playerId: string; name: string; role: string; isSpy: boolean }[];
  pointsAwarded: Record<string, number>;
}

export interface GameLogEntry {
  id: string;
  timestamp: number;
  text: string;
  type: 'INFO' | 'ACTION' | 'WARNING' | 'ACCUSATION' | 'WIN';
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderColor: string;
  text: string;
  timestamp: number;
}

export interface RoomState {
  roomCode: string;
  phase: GamePhase;
  players: Player[];
  hostId: string;
  settings: GameSettings;
  currentRound: number;
  startingPlayerId: string | null;
  timeRemaining: number;
  timerRunning: boolean;
  accusation: Accusation | null;
  spyGuess: SpyGuess | null;
  roundResult: RoundResult | null;
  logs: GameLogEntry[];
  // Secret server-only fields
  secretLocation?: LocationItem;
}

// Sanitized state sent to a specific client
export interface ClientGameState {
  roomCode: string;
  phase: GamePhase;
  players: {
    id: string;
    name: string;
    avatar: string;
    color: string;
    isHost: boolean;
    isReady: boolean;
    score: number;
    isOnline: boolean;
    role?: string; // only revealed at ROUND_OVER
    isSpy?: boolean; // only revealed at ROUND_OVER
  }[];
  myId: string;
  hostId: string;
  settings: GameSettings;
  currentRound: number;
  startingPlayerId: string | null;
  timeRemaining: number;
  timerRunning: boolean;
  accusation: Accusation | null;
  spyGuess: SpyGuess | null;
  roundResult: RoundResult | null;
  logs: GameLogEntry[];
  availableLocations: LocationItem[];
  // Private to current user
  myRole: string; // "La Spia" or specific role name
  isSpy: boolean;
  location: LocationItem | null; // null if spy or during lobby/round over when not applicable
}
