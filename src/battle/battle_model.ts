export interface MoveDefinition {
  id: string;
  name: string;
  power: number;
  accuracy?: number;
  critChance?: number;
  critMultiplier?: number;
}

export interface BattleMove extends MoveDefinition {
  accuracy: number;
  critChance: number;
  critMultiplier: number;
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
  moves: BattleMove[];
}

export interface TrainerState {
  name: string;
  party: PokemonInstance[];
}

export type TurnOrder = 'a' | 'b';

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
    return {
      ...move,
      accuracy: move.accuracy ?? 1,
      critChance: move.critChance ?? 0.1,
      critMultiplier: move.critMultiplier ?? 1.5,
    };
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
  move: Pick<MoveDefinition, 'power' | 'critMultiplier'>,
  isCritical = false
): number {
  const base = move.power + attacker.attack - defender.defense;
  const critMultiplier = Math.max(1, move.critMultiplier ?? 1.5);
  const total = isCritical ? base * critMultiplier : base;
  return Math.max(1, Math.floor(total));
}

export function doesMoveHit(
  move: Pick<MoveDefinition, 'accuracy'>,
  rng: () => number = Math.random
): boolean {
  const accuracy = Math.min(1, Math.max(0, move.accuracy ?? 1));
  return rng() < accuracy;
}

export function isCriticalHit(
  move: Pick<MoveDefinition, 'critChance'>,
  rng: () => number = Math.random
): boolean {
  const critChance = Math.min(1, Math.max(0, move.critChance ?? 0.1));
  return rng() < critChance;
}

export function decideFirstActor(
  pokemonA: PokemonInstance,
  pokemonB: PokemonInstance,
  rng: () => number = Math.random
): TurnOrder {
  if (pokemonA.speed === pokemonB.speed) {
    return rng() < 0.5 ? 'a' : 'b';
  }

  return pokemonA.speed > pokemonB.speed ? 'a' : 'b';
}

export function calculateExpectedDamage(
  attacker: PokemonInstance,
  defender: PokemonInstance,
  move: BattleMove
): number {
  return calculateDamage(attacker, defender, move) * move.accuracy;
}

export function pickBestMoveByExpectedDamage(
  attacker: PokemonInstance,
  defender: PokemonInstance
): BattleMove {
  if (attacker.moves.length === 0) {
    throw new Error(`${attacker.name} has no moves to choose from.`);
  }

  return attacker.moves.reduce((bestMove, candidateMove) => {
    const bestExpectedDamage = calculateExpectedDamage(
      attacker,
      defender,
      bestMove
    );
    const candidateExpectedDamage = calculateExpectedDamage(
      attacker,
      defender,
      candidateMove
    );

    if (candidateExpectedDamage > bestExpectedDamage) {
      return candidateMove;
    }

    return bestMove;
  });
}
