import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateDamage,
  doesMoveHit,
  isCriticalHit,
  PokemonInstance,
} from '../src/battle/battle_model.js';

const attacker: PokemonInstance = {
  id: 'attacker',
  name: 'Attacker',
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
