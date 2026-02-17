import { loadPlayerState, savePlayerState } from './persistence.js';

export const CURRENT_WORLD_VERSION = 1;

export type PersistedStatusCondition = 'burn' | 'poison' | 'paralyze';

export interface PartyCondition {
  hpRatio: number;
  status?: PersistedStatusCondition;
}

export interface PartyProgress {
  level: number;
  xp: number;
}

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
  partyCondition: PartyCondition[];
  partyProgress: PartyProgress[];
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
  const party = ['emberfox', 'leafling'];
  return {
    name: 'You',
    party,
    pokedex: [...party],
    position: {
      x: 400,
      y: 300,
    },
    defeatedTrainerIds: [],
    worldSeed: generateWorldSeed(),
    worldVersion: CURRENT_WORLD_VERSION,
    partyCondition: party.map(() => ({ hpRatio: 1 })),
    partyProgress: party.map(() => ({ level: 1, xp: 0 })),
  };
}

function sanitizeStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const filtered = value.filter((entry): entry is string => typeof entry === 'string');
  return filtered.length > 0 ? filtered : fallback;
}

function sanitizePartyCondition(
  value: unknown,
  partyLength: number
): PartyCondition[] {
  if (!Array.isArray(value)) {
    return Array.from({ length: partyLength }, () => ({ hpRatio: 1 }));
  }

  return Array.from({ length: partyLength }, (_, index) => {
    const candidate = value[index] as Partial<PartyCondition> | undefined;
    const hpRatio =
      typeof candidate?.hpRatio === 'number'
        ? Math.max(0, Math.min(1, candidate.hpRatio))
        : 1;
    const status =
      candidate?.status === 'burn' ||
      candidate?.status === 'poison' ||
      candidate?.status === 'paralyze'
        ? candidate.status
        : undefined;

    return status ? { hpRatio, status } : { hpRatio };
  });
}

function sanitizePartyProgress(
  value: unknown,
  partyLength: number
): PartyProgress[] {
  if (!Array.isArray(value)) {
    return Array.from({ length: partyLength }, () => ({ level: 1, xp: 0 }));
  }

  return Array.from({ length: partyLength }, (_, index) => {
    const candidate = value[index] as Partial<PartyProgress> | undefined;
    const level =
      typeof candidate?.level === 'number' && Number.isFinite(candidate.level)
        ? Math.max(1, Math.floor(candidate.level))
        : 1;
    const xp =
      typeof candidate?.xp === 'number' && Number.isFinite(candidate.xp)
        ? Math.max(0, Math.floor(candidate.xp))
        : 0;

    return { level, xp };
  });
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
    partyCondition: sanitizePartyCondition(
      saved.partyCondition,
      sanitizeStringArray(saved.party, initialState.party).length
    ),
    partyProgress: sanitizePartyProgress(
      saved.partyProgress,
      sanitizeStringArray(saved.party, initialState.party).length
    ),
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

export function getPlayerPartyCondition(): PartyCondition[] {
  return currentState.partyCondition.map((condition) => ({ ...condition }));
}

export function setPlayerPartyCondition(
  partyCondition: PartyCondition[]
): void {
  currentState = {
    ...currentState,
    partyCondition: sanitizePartyCondition(partyCondition, currentState.party.length),
  };
  savePlayerState(currentState);
}

export function healPlayerParty(): void {
  currentState = {
    ...currentState,
    partyCondition: currentState.party.map(() => ({ hpRatio: 1 })),
  };
  savePlayerState(currentState);
}

export function getPlayerPartyProgress(): PartyProgress[] {
  return currentState.partyProgress.map((progress) => ({ ...progress }));
}

export function setPlayerPartyProgress(
  partyProgress: PartyProgress[]
): void {
  currentState = {
    ...currentState,
    partyProgress: sanitizePartyProgress(partyProgress, currentState.party.length),
  };
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
