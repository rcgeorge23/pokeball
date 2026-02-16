export interface MoveDefinition {
  id: string;
  name: string;
  type: string;
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
  types: string[];
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  moves: string[];
}

export interface PokemonInstance {
  id: string;
  name: string;
  types: string[];
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

export type TypeEffectivenessChart = Record<string, Record<string, number>>;

export const TYPE_EFFECTIVENESS_CHART: TypeEffectivenessChart = {
  Fire: {
    Grass: 2,
    Fire: 0.5,
  },
  Grass: {
    Fire: 0.5,
    Electric: 0.5,
  },
  Electric: {
    Grass: 0.5,
    Electric: 0.5,
  },
  Normal: {},
};

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
    types: [...definition.types],
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

export function getTypeEffectivenessMultiplier(
  moveType: string,
  defenderTypes: string[],
  typeChart: TypeEffectivenessChart = TYPE_EFFECTIVENESS_CHART
): number {
  return defenderTypes.reduce((multiplier, defenderType) => {
    const attackingTypeRules = typeChart[moveType];
    if (!attackingTypeRules) {
      return multiplier;
    }

    return multiplier * (attackingTypeRules[defenderType] ?? 1);
  }, 1);
}

export function pickBestMoveByExpectedDamage(
  attacker: PokemonInstance,
  defender: PokemonInstance,
  rng: () => number = Math.random,
  secondBestChance = 0.1
): BattleMove {
  if (attacker.moves.length === 0) {
    throw new Error(`${attacker.name} has no moves to choose from.`);
  }

  if (attacker.moves.length === 1) {
    return attacker.moves[0];
  }

  const rankedMoves = [...attacker.moves].sort((moveA, moveB) => {
    const expectedDamageA = calculateExpectedDamage(attacker, defender, moveA);
    const expectedDamageB = calculateExpectedDamage(attacker, defender, moveB);
    return expectedDamageB - expectedDamageA;
  });

  const clampedSecondBestChance = Math.min(1, Math.max(0, secondBestChance));
  if (rng() < clampedSecondBestChance) {
    return rankedMoves[1];
  }

  return rankedMoves[0];
}
