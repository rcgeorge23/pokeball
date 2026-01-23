export interface MoveDefinition {
  id: string;
  name: string;
  power: number;
}

export interface PokemonDefinition {
  id: string;
  name: string;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  moves: string[];
}

export interface PokemonInstance {
  id: string;
  name: string;
  maxHp: number;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  moves: MoveDefinition[];
}

export interface TrainerState {
  name: string;
  party: PokemonInstance[];
}

export function buildIndex<T extends { id: string }>(items: T[]): Record<string, T> {
  return items.reduce<Record<string, T>>((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {});
}

export function createPokemonInstance(
  pokemonId: string,
  pokemonIndex: Record<string, PokemonDefinition>,
  moveIndex: Record<string, MoveDefinition>
): PokemonInstance {
  const definition = pokemonIndex[pokemonId];
  if (!definition) {
    throw new Error(`Missing pokemon definition for ${pokemonId}`);
  }

  const moves = definition.moves.map((moveId) => {
    const move = moveIndex[moveId];
    if (!move) {
      throw new Error(`Missing move definition for ${moveId}`);
    }
    return move;
  });

  return {
    id: definition.id,
    name: definition.name,
    maxHp: definition.hp,
    hp: definition.hp,
    attack: definition.attack,
    defense: definition.defense,
    speed: definition.speed,
    moves,
  };
}

export function createTrainerState(
  name: string,
  partyIds: string[],
  pokemonIndex: Record<string, PokemonDefinition>,
  moveIndex: Record<string, MoveDefinition>
): TrainerState {
  return {
    name,
    party: partyIds.map((pokemonId) =>
      createPokemonInstance(pokemonId, pokemonIndex, moveIndex)
    ),
  };
}

export function calculateDamage(
  attacker: PokemonInstance,
  defender: PokemonInstance,
  move: MoveDefinition
): number {
  const base = move.power + attacker.attack - defender.defense;
  return Math.max(1, Math.floor(base));
}
