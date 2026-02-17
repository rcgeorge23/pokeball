export interface MoveDefinition {
  id: string;
  name: string;
  type: string;
  power: number;
  accuracy?: number;
  critChance?: number;
  critMultiplier?: number;
  statusInflict?: StatusInflictDefinition;
}

export type StatusCondition = 'burn' | 'poison' | 'paralyze';

export interface StatusInflictDefinition {
  condition: StatusCondition;
  chance?: number;
}

export interface BattleMove extends MoveDefinition {
  accuracy: number;
  critChance: number;
  critMultiplier: number;
  statusInflict?: Required<StatusInflictDefinition>;
}

export interface PokemonDefinition {
  id: string;
  name: string;
  types: string[];
  level: number;
  xp: number;
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
  level: number;
  xp: number;
  maxHp: number;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  moves: BattleMove[];
  status?: StatusCondition;
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
      statusInflict: move.statusInflict
        ? {
            condition: move.statusInflict.condition,
            chance: move.statusInflict.chance ?? 1,
          }
        : undefined,
    };
  });

  return {
    id: definition.id,
    name: definition.name,
    types: [...definition.types],
    level: definition.level,
    xp: definition.xp,
    maxHp: definition.hp,
    hp: definition.hp,
    attack: definition.attack,
    defense: definition.defense,
    speed: definition.speed,
    moves,
    status: undefined,
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
  move: Pick<MoveDefinition, 'power' | 'type' | 'critMultiplier'>,
  isCritical = false,
  typeChart: TypeEffectivenessChart = TYPE_EFFECTIVENESS_CHART
): number {
  const attackStat = attacker.status === 'burn'
    ? Math.max(1, Math.floor(attacker.attack * 0.7))
    : attacker.attack;
  const base = move.power + attackStat - defender.defense;
  const typeMultiplier = getTypeEffectivenessMultiplier(
    move.type,
    defender.types,
    typeChart
  );
  const critMultiplier = Math.max(1, move.critMultiplier ?? 1.5);
  const total = isCritical ? base * critMultiplier * typeMultiplier : base * typeMultiplier;
  return Math.max(1, Math.floor(total));
}

export function doesStatusInflictApply(
  statusInflict: StatusInflictDefinition,
  rng: () => number = Math.random
): boolean {
  const chance = Math.min(1, Math.max(0, statusInflict.chance ?? 1));
  return rng() < chance;
}

export function getPoisonTickDamage(pokemon: Pick<PokemonInstance, 'maxHp'>): number {
  return Math.max(1, Math.floor(pokemon.maxHp * 0.1));
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
  const pokemonASpeed = getEffectiveSpeed(pokemonA);
  const pokemonBSpeed = getEffectiveSpeed(pokemonB);

  if (pokemonASpeed === pokemonBSpeed) {
    return rng() < 0.5 ? 'a' : 'b';
  }

  return pokemonASpeed > pokemonBSpeed ? 'a' : 'b';
}

export function getEffectiveSpeed(pokemon: Pick<PokemonInstance, 'speed' | 'status'>): number {
  if (pokemon.status !== 'paralyze') {
    return pokemon.speed;
  }

  return Math.max(1, Math.floor(pokemon.speed * 0.5));
}

export function doesParalysisPreventAction(
  pokemon: Pick<PokemonInstance, 'status'>,
  rng: () => number = Math.random
): boolean {
  if (pokemon.status !== 'paralyze') {
    return false;
  }

  return rng() < 0.25;
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
