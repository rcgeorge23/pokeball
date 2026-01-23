export interface PlayerState {
  name: string;
  party: string[];
  pokedex: string[];
}

const initialState: PlayerState = {
  name: 'You',
  party: ['emberfox'],
  pokedex: ['emberfox'],
};

let currentState: PlayerState = { ...initialState };

export function getPlayerState(): PlayerState {
  return currentState;
}

export function addPokemonToPokedex(pokemonId: string): void {
  if (!currentState.pokedex.includes(pokemonId)) {
    currentState = {
      ...currentState,
      pokedex: [...currentState.pokedex, pokemonId],
    };
  }
}
