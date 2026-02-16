import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateDamage,
  calculateExpectedDamage,
  doesMoveHit,
  doesStatusInflictApply,
  getTypeEffectivenessMultiplier,
  getPoisonTickDamage,
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
    type: 'Normal',
    critMultiplier: 1.5,
  });
  const criticalDamage = calculateDamage(
    attacker,
    defender,
    {
      power: 12,
      type: 'Normal',
      critMultiplier: 1.5,
    },
    true
  );

  assert.equal(normalDamage, 16);
  assert.equal(criticalDamage, 24);
});

test('calculateDamage applies type effectiveness multiplier', () => {
  const grassDefender: PokemonInstance = {
    ...defender,
    types: ['Grass'],
  };

  const resistedDamage = calculateDamage(attacker, defender, {
    power: 12,
    type: 'Grass',
    critMultiplier: 1.5,
  });

  const superEffectiveDamage = calculateDamage(attacker, grassDefender, {
    power: 12,
    type: 'Fire',
    critMultiplier: 1.5,
  });

  assert.equal(resistedDamage, 16);
  assert.equal(superEffectiveDamage, 32);
});



test('calculateDamage reduces attack when attacker is burned', () => {
  const burnedAttacker: PokemonInstance = {
    ...attacker,
    status: 'burn',
  };

  const normalDamage = calculateDamage(attacker, defender, {
    power: 12,
    type: 'Normal',
    critMultiplier: 1.5,
  });

  const burnedDamage = calculateDamage(burnedAttacker, defender, {
    power: 12,
    type: 'Normal',
    critMultiplier: 1.5,
  });

  assert.equal(normalDamage, 16);
  assert.equal(burnedDamage, 11);
});

test('doesStatusInflictApply respects clamped chance', () => {
  assert.equal(
    doesStatusInflictApply({ condition: 'burn', chance: 2 }, () => 0.99),
    true
  );
  assert.equal(
    doesStatusInflictApply({ condition: 'burn', chance: -1 }, () => 0),
    false
  );
  assert.equal(
    doesStatusInflictApply({ condition: 'burn', chance: 0.3 }, () => 0.3),
    false
  );
  assert.equal(
    doesStatusInflictApply({ condition: 'poison', chance: 0.6 }, () => 0.2),
    true
  );
});

test('getPoisonTickDamage returns 10% of max HP with minimum 1', () => {
  assert.equal(getPoisonTickDamage({ maxHp: 80 }), 8);
  assert.equal(getPoisonTickDamage({ maxHp: 5 }), 1);
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

test('getTypeEffectivenessMultiplier uses Fire/Grass/Electric/Normal chart rules', () => {
  assert.equal(getTypeEffectivenessMultiplier('Fire', ['Grass']), 2);
  assert.equal(getTypeEffectivenessMultiplier('Fire', ['Fire']), 0.5);
  assert.equal(getTypeEffectivenessMultiplier('Electric', ['Grass']), 0.5);
  assert.equal(getTypeEffectivenessMultiplier('Normal', ['Fire']), 1);
  assert.equal(getTypeEffectivenessMultiplier('Unknown', ['Grass']), 1);
});
