import test from 'node:test';
import assert from 'node:assert/strict';

import { SeededRng } from '../src/world/seeded_rng.js';

test('SeededRng produces identical float sequences for the same seed', () => {
  const rngA = new SeededRng('world-seed-001');
  const rngB = new SeededRng('world-seed-001');

  const sequenceA = Array.from({ length: 8 }, () => rngA.nextFloat());
  const sequenceB = Array.from({ length: 8 }, () => rngB.nextFloat());

  assert.deepEqual(sequenceA, sequenceB);
});

test('SeededRng produces different sequences for different seeds', () => {
  const rngA = new SeededRng('world-seed-001');
  const rngB = new SeededRng('world-seed-002');

  const sequenceA = Array.from({ length: 8 }, () => rngA.nextFloat());
  const sequenceB = Array.from({ length: 8 }, () => rngB.nextFloat());

  const hasAnyDifference = sequenceA.some((value, index) => value !== sequenceB[index]);
  assert.ok(hasAnyDifference);
});

test('SeededRng nextInt stays in bounds and is deterministic', () => {
  const rngA = new SeededRng(42);
  const rngB = new SeededRng(42);

  const intsA = Array.from({ length: 12 }, () => rngA.nextInt(-2, 3));
  const intsB = Array.from({ length: 12 }, () => rngB.nextInt(-2, 3));

  assert.deepEqual(intsA, intsB);
  intsA.forEach((value) => {
    assert.ok(value >= -2 && value <= 3);
  });
});

test('SeededRng pick selects deterministically from arrays', () => {
  const options = ['grass', 'forest', 'rocky', 'lake'];
  const rngA = new SeededRng('biome-seed');
  const rngB = new SeededRng('biome-seed');

  const picksA = Array.from({ length: 6 }, () => rngA.pick(options));
  const picksB = Array.from({ length: 6 }, () => rngB.pick(options));

  assert.deepEqual(picksA, picksB);
  picksA.forEach((value) => {
    assert.ok(options.includes(value));
  });
});
