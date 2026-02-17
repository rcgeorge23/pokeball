import { PokemonInstance, TrainerState } from './battle_model.js';

export interface VictoryReward {
  pokemon: PokemonInstance;
}

export interface ExperienceReward {
  totalXp: number;
  xpPerPokemon: number;
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
  });

  return {
    totalXp,
    xpPerPokemon,
  };
}
