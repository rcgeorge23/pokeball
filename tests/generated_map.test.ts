import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_GENERATED_MAP_HEIGHT,
  DEFAULT_GENERATED_MAP_WIDTH,
  generateMapFromSeed,
} from '../src/world/generated_map.js';

test('generateMapFromSeed returns a complete generated map structure', () => {
  const map = generateMapFromSeed('map-structure-seed');

  assert.equal(map.width, DEFAULT_GENERATED_MAP_WIDTH);
  assert.equal(map.height, DEFAULT_GENERATED_MAP_HEIGHT);
  assert.equal(map.tiles.length, map.width * map.height);
  assert.equal(map.collision.length, map.width * map.height);
  assert.equal(map.metadata.biomeByTile.length, map.width * map.height);
  assert.equal(map.metadata.difficultyBandByTile.length, map.width * map.height);
  assert.ok(map.metadata.biomeIds.length >= 3);
  assert.ok(map.spawnPoints.trainers.length > 0);
  assert.ok(map.spawnPoints.signs.length > 0);
});

test('generateMapFromSeed is deterministic for the same seed and options', () => {
  const options = { width: 32, height: 24, trainerCount: 6, signCount: 3 };
  const mapA = generateMapFromSeed('same-seed', options);
  const mapB = generateMapFromSeed('same-seed', options);

  assert.deepEqual(mapA, mapB);
});

test('generateMapFromSeed changes output for different seeds', () => {
  const options = { width: 32, height: 24, trainerCount: 6, signCount: 3 };
  const mapA = generateMapFromSeed('seed-a', options);
  const mapB = generateMapFromSeed('seed-b', options);

  assert.ok(JSON.stringify(mapA.spawnPoints) !== JSON.stringify(mapB.spawnPoints));
});
