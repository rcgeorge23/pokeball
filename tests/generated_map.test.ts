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
  assert.ok(map.metadata.navigationGraph.nodes.length >= 10);
  assert.ok(map.metadata.navigationGraph.edges.length > 0);
  assert.ok(map.spawnPoints.trainers.length > 0);
  assert.ok(map.spawnPoints.signs.length > 0);
});

test('generateMapFromSeed includes deterministic navigation graph with required structure', () => {
  const map = generateMapFromSeed('graph-seed', { width: 40, height: 30 });
  const { nodes, edges, mainPathNodeIds } = map.metadata.navigationGraph;
  const nodesById = new Map(nodes.map((node) => [node.id, node]));

  assert.ok(nodes.some((node) => node.type === 'start'));
  assert.ok(nodes.some((node) => node.type === 'bossGate'));
  assert.ok(nodes.some((node) => node.type === 'championArena'));
  assert.ok(nodes.filter((node) => node.type === 'encounter').length >= 3);
  assert.ok(nodes.filter((node) => node.type === 'loot').length >= 2);

  assert.ok(mainPathNodeIds.length >= 5);
  assert.equal(mainPathNodeIds[0], 'start');
  assert.equal(mainPathNodeIds[mainPathNodeIds.length - 1], 'champion-arena');

  for (let index = 0; index < mainPathNodeIds.length - 1; index += 1) {
    assert.ok(
      edges.some(
        (edge) =>
          edge.kind === 'main' &&
          edge.fromNodeId === mainPathNodeIds[index] &&
          edge.toNodeId === mainPathNodeIds[index + 1]
      )
    );
  }

  assert.ok(edges.some((edge) => edge.kind === 'optional'));

  for (const edge of edges) {
    assert.ok(nodesById.has(edge.fromNodeId));
    assert.ok(nodesById.has(edge.toNodeId));
  }
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

test('generateMapFromSeed carves walkable routes for navigation graph nodes', () => {
  const map = generateMapFromSeed('route-carving-seed', { width: 48, height: 36 });
  const toIndex = (x: number, y: number): number => y * map.width + x;

  const startNode = map.metadata.navigationGraph.nodes.find((node) => node.id === 'start');
  assert.ok(startNode);
  if (!startNode) {
    throw new Error('Expected start node to be present in navigation graph.');
  }

  for (const node of map.metadata.navigationGraph.nodes) {
    assert.equal(map.collision[toIndex(node.x, node.y)], false);
  }

  const visited = new Set<number>();
  const queue = [toIndex(startNode.x, startNode.y)];
  visited.add(queue[0]);

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

  for (const mainPathNodeId of map.metadata.navigationGraph.mainPathNodeIds) {
    const node = map.metadata.navigationGraph.nodes.find((item) => item.id === mainPathNodeId);
    assert.ok(node);
    if (!node) {
      throw new Error(`Expected main path node ${mainPathNodeId} to be present.`);
    }

    assert.ok(visited.has(toIndex(node.x, node.y)));
  }

  const walkableTiles = map.collision.filter((isBlocked) => !isBlocked).length;
  assert.ok(walkableTiles > Math.floor(map.width * map.height * 0.15));
});
