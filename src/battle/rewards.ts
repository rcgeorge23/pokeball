import { PokemonInstance, TrainerState } from './battle_model';

export interface VictoryReward {
  pokemon: PokemonInstance;
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
