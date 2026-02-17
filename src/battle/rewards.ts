import { PokemonInstance, TrainerState } from './battle_model.js';

const XP_PER_LEVEL = 100;
const LEVEL_UP_HP_GAIN = 4;
const LEVEL_UP_ATTACK_GAIN = 2;
const LEVEL_UP_DEFENSE_GAIN = 2;
const LEVEL_UP_SPEED_GAIN = 1;
const LEVEL_UP_HEAL_RATIO = 0.2;

export interface VictoryReward {
  pokemon: PokemonInstance;
}

export interface ExperienceReward {
  totalXp: number;
  xpPerPokemon: number;
}

export function applyStatLevelGains(
  pokemon: PokemonInstance,
  levelsToGain: number
): void {
  for (let i = 0; i < levelsToGain; i += 1) {
    const previousMaxHp = pokemon.maxHp;
    pokemon.level += 1;
    pokemon.maxHp += LEVEL_UP_HP_GAIN;
    pokemon.attack += LEVEL_UP_ATTACK_GAIN;
    pokemon.defense += LEVEL_UP_DEFENSE_GAIN;
    pokemon.speed += LEVEL_UP_SPEED_GAIN;

    const healedHp = Math.ceil(previousMaxHp * LEVEL_UP_HEAL_RATIO);
    pokemon.hp = Math.min(pokemon.hp + healedHp, pokemon.maxHp);
  }
}

export function applyXpLevelUps(pokemon: PokemonInstance): number {
  const previousLevel = pokemon.level;
  const expectedLevel = Math.floor(pokemon.xp / XP_PER_LEVEL) + 1;
  const levelsToGain = Math.max(0, expectedLevel - pokemon.level);
  if (levelsToGain > 0) {
    applyStatLevelGains(pokemon, levelsToGain);
  }
  return pokemon.level - previousLevel;
}

export function getLeadPokemon(trainer: TrainerState): PokemonInstance {
  if (trainer.party.length === 0) {
    throw new Error(`Trainer ${trainer.name} has no pokemon to reward.`);
  }
  return trainer.party[0];
}

export function applyVictoryReward(
  opponent: TrainerState,
  addToPokedex: (pokemonId: string) => void
): VictoryReward {
  const leadPokemon = getLeadPokemon(opponent);
  addToPokedex(leadPokemon.id);
  return { pokemon: leadPokemon };
}

export function calculateTotalXpYield(opponent: TrainerState): number {
  return opponent.party.reduce(
    (total, pokemon) => total + pokemon.xpYield,
    0
  );
}

export function awardExperienceForVictory(
  player: TrainerState,
  opponent: TrainerState
): ExperienceReward {
  if (player.party.length === 0) {
    throw new Error(`Trainer ${player.name} has no pokemon to receive XP.`);
  }

  const totalXp = calculateTotalXpYield(opponent);
  const xpPerPokemon = Math.max(1, Math.floor(totalXp / player.party.length));

  player.party.forEach((pokemon) => {
    pokemon.xp += xpPerPokemon;
    applyXpLevelUps(pokemon);
  });

  return {
    totalXp,
    xpPerPokemon,
  };
}
