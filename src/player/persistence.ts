import { PlayerState } from './player_model.js';

const STORAGE_KEY = 'pokemon-battler-save';

export interface PersistedPlayerState {
  position: {
    x: number;
    y: number;
  };
  defeatedTrainerIds: string[];
  worldSeed: string;
  worldVersion: number;
}

export function toPersistedPlayerState(state: PlayerState): PersistedPlayerState {
  return {
    position: state.position,
    defeatedTrainerIds: state.defeatedTrainerIds,
    worldSeed: state.worldSeed,
    worldVersion: state.worldVersion,
  };
}

export function loadPlayerState(): Partial<PlayerState> | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PlayerState>;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    return {
      position: parsed.position,
      defeatedTrainerIds: parsed.defeatedTrainerIds,
      worldSeed: parsed.worldSeed,
      worldVersion: parsed.worldVersion,
    };
  } catch (error) {
    console.warn('Failed to parse save data.', error);
    return null;
  }
}

export function savePlayerState(state: PlayerState): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(toPersistedPlayerState(state)));
}
