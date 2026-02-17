import test from 'node:test';
import assert from 'node:assert/strict';

import { generateMapFromSeed } from '../src/world/generated_map.js';

function hashString(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}

function hashKeyMapOutputs(seed: string): string {
  const map = generateMapFromSeed(seed, {
    width: 48,
    height: 36,
    trainerCount: 8,
    signCount: 4,
  });

  const tileCounts = new Map<string, number>();
  for (const tile of map.tiles) {
    const key = String(tile);
    tileCounts.set(key, (tileCounts.get(key) ?? 0) + 1);
  }

  const keyOutputs = {
    dimensions: { width: map.width, height: map.height },
    tileCounts: [...tileCounts.entries()].sort(([left], [right]) => left.localeCompare(right)),
    poiCoords: {
      healPoint: map.spawnPoints.healPoint,
      signs: map.spawnPoints.signs.map((sign) => ({ x: sign.x, y: sign.y })),
      pointsOfInterest: map.metadata.pointsOfInterest.map((poi) => ({
        type: poi.type,
        x: poi.x,
        y: poi.y,
      })),
    },
    trainerCoords: map.spawnPoints.trainers.map((trainer) => ({ x: trainer.x, y: trainer.y })),
    championArenaCoord: map.metadata.navigationGraph.nodes
      .filter((node) => node.type === 'championArena')
      .map((node) => ({ x: node.x, y: node.y })),
  };

  return hashString(JSON.stringify(keyOutputs));
}

test('same seed produces the same key-output hash', () => {
  const hashA = hashKeyMapOutputs('determinism-hash-seed');
  const hashB = hashKeyMapOutputs('determinism-hash-seed');

  assert.equal(hashA, hashB);
});

test('different seeds produce different key-output hashes with high probability', () => {
  const hashA = hashKeyMapOutputs('determinism-hash-seed-a');
  const hashB = hashKeyMapOutputs('determinism-hash-seed-b');

  assert.ok(hashA !== hashB);
});
