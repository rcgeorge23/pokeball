import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CHAMPION_GATE_REQUIRED_DEFEATS,
  generateMapFromSeed,
} from '../src/world/generated_map.js';

function collectReachableWalkableTiles(map: ReturnType<typeof generateMapFromSeed>): Set<number> {
  const toIndex = (x: number, y: number): number => y * map.width + x;
  const startIndex = toIndex(map.spawnPoints.playerStart.x, map.spawnPoints.playerStart.y);
  const visited = new Set<number>([startIndex]);
  const queue = [startIndex];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) {
      continue;
    }

    const x = current % map.width;
    const y = Math.floor(current / map.width);
    const neighbors = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ];

    for (const [nextX, nextY] of neighbors) {
      if (nextX < 0 || nextX >= map.width || nextY < 0 || nextY >= map.height) {
        continue;
      }

      const nextIndex = toIndex(nextX, nextY);
      if (map.collision[nextIndex] || visited.has(nextIndex)) {
        continue;
      }

      visited.add(nextIndex);
      queue.push(nextIndex);
    }
  }

  return visited;
}

test('generated maps keep path-to-end, POI reachability, and trainer reachability across seed samples', () => {
  const seedSamples = Array.from({ length: 20 }, (_, index) => `playability-sample-seed-${index}`);

  for (const seed of seedSamples) {
    const map = generateMapFromSeed(seed, {
      width: 64,
      height: 48,
    });
    const toIndex = (x: number, y: number): number => y * map.width + x;
    const reachableTiles = collectReachableWalkableTiles(map);

    const championArenaNode = map.metadata.navigationGraph.nodes.find((node) => node.type === 'championArena');
    assert.ok(championArenaNode);
    if (!championArenaNode) {
      throw new Error(`Expected champion arena node for seed ${seed}`);
    }

    if (!reachableTiles.has(toIndex(championArenaNode.x, championArenaNode.y))) {
      throw new Error(`Expected reachable champion arena for seed ${seed}`);
    }

    for (const pointOfInterest of map.metadata.pointsOfInterest) {
      if (!reachableTiles.has(toIndex(pointOfInterest.x, pointOfInterest.y))) {
        throw new Error(`Expected reachable POI ${pointOfInterest.id} for seed ${seed}`);
      }
    }

    const reachableTrainerCount = map.spawnPoints.trainers.filter((trainerPoint) =>
      reachableTiles.has(toIndex(trainerPoint.x, trainerPoint.y))
    ).length;

    if (reachableTrainerCount < CHAMPION_GATE_REQUIRED_DEFEATS) {
      throw new Error(
        `Expected at least ${CHAMPION_GATE_REQUIRED_DEFEATS} reachable trainers for seed ${seed}, got ${reachableTrainerCount}`
      );
    }
  }
});

test('map generation stays under a basic performance budget for seed batches', () => {
  const seedSamples = Array.from({ length: 30 }, (_, index) => `perf-sample-seed-${index}`);
  const startMs = Date.now();

  for (const seed of seedSamples) {
    generateMapFromSeed(seed, {
      width: 64,
      height: 48,
    });
  }

  const elapsedMs = Date.now() - startMs;
  if (elapsedMs >= 2_500) {
    throw new Error(
      `Expected generation of ${seedSamples.length} maps to finish in under 2500ms, got ${elapsedMs}ms`
    );
  }
});
