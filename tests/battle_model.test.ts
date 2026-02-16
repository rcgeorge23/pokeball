import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateDamage,
  calculateExpectedDamage,
  doesMoveHit,
  isCriticalHit,
  pickBestMoveByExpectedDamage,
  PokemonInstance,
} from '../src/battle/battle_model.js';

const attacker: PokemonInstance = {
  id: 'attacker',
  name: 'Attacker',
  types: ['Normal'],
  maxHp: 50,
  hp: 50,
  attack: 14,
  defense: 8,
  speed: 10,
  moves: [],
};

const defender: PokemonInstance = {
  id: 'defender',
  name: 'Defender',
  types: ['Normal'],
  maxHp: 50,
  hp: 50,
  attack: 9,
  defense: 10,
  speed: 8,
  moves: [],
};

test('doesMoveHit respects clamped accuracy', () => {
  assert.equal(doesMoveHit({ accuracy: 2 }, () => 0.99), true);
  assert.equal(doesMoveHit({ accuracy: -1 }, () => 0), false);
  assert.equal(doesMoveHit({ accuracy: 0.5 }, () => 0.5), false);
});

test('isCriticalHit respects clamped crit chance', () => {
  assert.equal(isCriticalHit({ critChance: 0.25 }, () => 0.2), true);
  assert.equal(isCriticalHit({ critChance: 0.25 }, () => 0.25), false);
  assert.equal(isCriticalHit({ critChance: -1 }, () => 0), false);
});

test('calculateDamage applies critical multiplier when critical hit occurs', () => {
  const normalDamage = calculateDamage(attacker, defender, {
    power: 12,
    critMultiplier: 1.5,
  });
  const criticalDamage = calculateDamage(
    attacker,
    defender,
    {
      power: 12,
      critMultiplier: 1.5,
    },
    true
  );

  assert.equal(normalDamage, 16);
  assert.equal(criticalDamage, 24);
});


test('calculateExpectedDamage accounts for move accuracy', () => {
  const expectedDamage = calculateExpectedDamage(attacker, defender, {
    id: 'precise-strike',
    name: 'Precise Strike',
    type: 'Normal',
    power: 12,
    accuracy: 0.75,
    critChance: 0.1,
    critMultiplier: 1.5,
  });

  assert.equal(expectedDamage, 12);
});

test('pickBestMoveByExpectedDamage selects highest expected damage move', () => {
  const aiPokemon: PokemonInstance = {
    ...attacker,
    moves: [
      {
        id: 'heavy-slam',
        name: 'Heavy Slam',
        type: 'Normal',
        power: 18,
        accuracy: 0.5,
        critChance: 0.1,
        critMultiplier: 1.5,
      },
      {
        id: 'steady-hit',
        name: 'Steady Hit',
        type: 'Normal',
        power: 13,
        accuracy: 0.9,
        critChance: 0.1,
        critMultiplier: 1.5,
      },
    ],
  };

  const selectedMove = pickBestMoveByExpectedDamage(aiPokemon, defender, () => 0.5);

  assert.equal(selectedMove.id, 'steady-hit');
});

test('pickBestMoveByExpectedDamage can pick second-best move for variety', () => {
  const aiPokemon: PokemonInstance = {
    ...attacker,
    moves: [
      {
        id: 'heavy-slam',
        name: 'Heavy Slam',
        type: 'Normal',
        power: 18,
        accuracy: 0.5,
        critChance: 0.1,
        critMultiplier: 1.5,
      },
      {
        id: 'steady-hit',
        name: 'Steady Hit',
        type: 'Normal',
        power: 13,
        accuracy: 0.9,
        critChance: 0.1,
        critMultiplier: 1.5,
      },
    ],
  };

  const selectedMove = pickBestMoveByExpectedDamage(aiPokemon, defender, () => 0.05);

  assert.equal(selectedMove.id, 'heavy-slam');
});
