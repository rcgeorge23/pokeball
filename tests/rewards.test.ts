import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyStatLevelGains,
  applyXpLevelUps,
  awardExperienceForVictory,
  calculateTotalXpYield,
} from '../src/battle/rewards.js';
import { TrainerState } from '../src/battle/battle_model.js';

const playerTrainer: TrainerState = {
  name: 'Player',
  party: [
    {
      id: 'emberfox',
      name: 'Emberfox',
      types: ['Fire'],
      level: 1,
      xp: 10,
      xpYield: 32,
      maxHp: 45,
      hp: 45,
      attack: 12,
      defense: 9,
      speed: 10,
      moves: [],
    },
    {
      id: 'leafling',
      name: 'Leafling',
      types: ['Grass'],
      level: 1,
      xp: 4,
      xpYield: 32,
      maxHp: 42,
      hp: 42,
      attack: 11,
      defense: 10,
      speed: 11,
      moves: [],
    },
  ],
};

const opponentTrainer: TrainerState = {
  name: 'Rival',
  party: [
    {
      id: 'aquaphin',
      name: 'Aquaphin',
      types: ['Water'],
      level: 1,
      xp: 0,
      xpYield: 35,
      maxHp: 40,
      hp: 0,
      attack: 9,
      defense: 10,
      speed: 9,
      moves: [],
    },
    {
      id: 'leafling',
      name: 'Leafling',
      types: ['Grass'],
      level: 1,
      xp: 0,
      xpYield: 25,
      maxHp: 42,
      hp: 0,
      attack: 11,
      defense: 10,
      speed: 11,
      moves: [],
    },
  ],
};

test('calculateTotalXpYield sums opponent xpYield values', () => {
  assert.equal(calculateTotalXpYield(opponentTrainer), 60);
});

test('awardExperienceForVictory grants equal XP share to player party', () => {
  const playerCopy: TrainerState = structuredClone(playerTrainer);

  const reward = awardExperienceForVictory(playerCopy, opponentTrainer);

  assert.equal(reward.totalXp, 60);
  assert.equal(reward.xpPerPokemon, 30);
  assert.equal(playerCopy.party[0].xp, 40);
  assert.equal(playerCopy.party[1].xp, 34);
});

test('applyStatLevelGains increases stats each gained level', () => {
  const pokemon = structuredClone(playerTrainer.party[0]);

  applyStatLevelGains(pokemon, 2);

  assert.equal(pokemon.level, 3);
  assert.equal(pokemon.maxHp, 53);
  assert.equal(pokemon.attack, 16);
  assert.equal(pokemon.defense, 13);
  assert.equal(pokemon.speed, 12);
});

test('applyXpLevelUps converts XP thresholds into level and stat gains', () => {
  const pokemon = structuredClone(playerTrainer.party[0]);
  pokemon.xp = 205;

  const levelsGained = applyXpLevelUps(pokemon);

  assert.equal(levelsGained, 2);
  assert.equal(pokemon.level, 3);
  assert.equal(pokemon.maxHp, 53);
  assert.equal(pokemon.attack, 16);
  assert.equal(pokemon.defense, 13);
  assert.equal(pokemon.speed, 12);
});
