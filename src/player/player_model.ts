import { loadPlayerState, savePlayerState } from './persistence';

export interface PlayerState {
  name: string;
  party: string[];
  pokedex: string[];
  position: {
    x: number;
    y: number;
  };
  defeatedTrainerIds: string[];
}

const initialState: PlayerState = {
  name: 'You',
  party: ['emberfox'],
  pokedex: ['emberfox'],
  position: {
    x: 400,
    y: 300,
  },
  defeatedTrainerIds: [],
};

let currentState: PlayerState = { ...initialState };

export function initializePlayerState(): void {
  const saved = loadPlayerState();
  if (saved) {
    currentState = {
      ...initialState,
      ...saved,
      position: {
        ...initialState.position,
        ...(saved.position ?? {}),
      },
      party: saved.party ?? initialState.party,
      pokedex: saved.pokedex ?? initialState.pokedex,
      defeatedTrainerIds:
        saved.defeatedTrainerIds ?? initialState.defeatedTrainerIds,
    };
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
