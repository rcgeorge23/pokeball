import { loadPlayerState, savePlayerState } from './persistence.js';

export const CURRENT_WORLD_VERSION = 1;

export interface PlayerState {
  name: string;
  party: string[];
  pokedex: string[];
  position: {
    x: number;
    y: number;
  };
  defeatedTrainerIds: string[];
  worldSeed: string;
  worldVersion: number;
}

let fallbackSeedCounter = 0;

export function generateWorldSeed(): string {
  const cryptoObject = globalThis.crypto;
  if (cryptoObject?.getRandomValues) {
    const bytes = new Uint8Array(8);
    cryptoObject.getRandomValues(bytes);
    const value = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `world-${value}`;
  }

  fallbackSeedCounter += 1;
  return `world-${Date.now().toString(36)}-${fallbackSeedCounter.toString(36)}`;
}

function createInitialState(): PlayerState {
  return {
    name: 'You',
    party: ['emberfox', 'leafling'],
    pokedex: ['emberfox', 'leafling'],
    position: {
      x: 400,
      y: 300,
    },
    defeatedTrainerIds: [],
    worldSeed: generateWorldSeed(),
    worldVersion: CURRENT_WORLD_VERSION,
  };
}

function sanitizeStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const filtered = value.filter((entry): entry is string => typeof entry === 'string');
  return filtered.length > 0 ? filtered : fallback;
}

export function hydratePlayerState(saved: Partial<PlayerState> | null): PlayerState {
  const initialState = createInitialState();
  if (!saved) {
    return initialState;
  }

  const hasValidPosition = typeof saved.position?.x === 'number' && typeof saved.position?.y === 'number';
  const worldSeed = typeof saved.worldSeed === 'string' && saved.worldSeed.length > 0
    ? saved.worldSeed
    : generateWorldSeed();
  const worldVersion = typeof saved.worldVersion === 'number'
    ? saved.worldVersion
    : CURRENT_WORLD_VERSION;

  return {
    ...initialState,
    ...saved,
    position: hasValidPosition && saved.position ? saved.position : initialState.position,
    party: sanitizeStringArray(saved.party, initialState.party),
    pokedex: sanitizeStringArray(saved.pokedex, initialState.pokedex),
    defeatedTrainerIds: sanitizeStringArray(saved.defeatedTrainerIds, initialState.defeatedTrainerIds),
    worldSeed,
    worldVersion,
  };
}

let currentState: PlayerState = createInitialState();

export function initializePlayerState(): void {
  const saved = loadPlayerState();
  currentState = hydratePlayerState(saved);

  if (
    !saved
    || saved.worldSeed !== currentState.worldSeed
    || saved.worldVersion !== currentState.worldVersion
  ) {
    savePlayerState(currentState);
  }
}

export function getPlayerState(): PlayerState {
  return currentState;
}

export function addPokemonToPokedex(pokemonId: string): void {
  if (!currentState.pokedex.includes(pokemonId)) {
    currentState = {
      ...currentState,
      pokedex: [...currentState.pokedex, pokemonId],
    };
    savePlayerState(currentState);
  }
}

export function isTrainerDefeated(trainerId: string): boolean {
  return currentState.defeatedTrainerIds.includes(trainerId);
}

export function markTrainerDefeated(trainerId: string): void {
  if (!currentState.defeatedTrainerIds.includes(trainerId)) {
    currentState = {
      ...currentState,
      defeatedTrainerIds: [...currentState.defeatedTrainerIds, trainerId],
    };
    savePlayerState(currentState);
  }
}

export function updatePlayerPosition(x: number, y: number): void {
  currentState = {
    ...currentState,
    position: {
      x,
      y,
    },
  };
}

export function persistPlayerState(): void {
  savePlayerState(currentState);
}

export function regenerateWorldSeed(): string {
  const worldSeed = generateWorldSeed();
  currentState = {
    ...currentState,
    worldSeed,
    worldVersion: CURRENT_WORLD_VERSION,
  };
  savePlayerState(currentState);
  return worldSeed;
}
