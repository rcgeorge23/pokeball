import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_GENERATED_MAP_HEIGHT,
  DEFAULT_GENERATED_MAP_WIDTH,
  GENERATED_MAP_BIOMES,
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
  assert.equal(map.metadata.decorationByTile.length, map.width * map.height);
  assert.deepEqual(map.metadata.biomeIds, GENERATED_MAP_BIOMES);
  assert.ok(map.metadata.biomeLandmarks.length > 0);
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

test('generateMapFromSeed assigns deterministic biome regions with blended borders', () => {
  const map = generateMapFromSeed('biome-region-seed', { width: 64, height: 48 });
  const biomeCounts = new Map<string, number>();

  for (const biome of map.metadata.biomeByTile) {
    biomeCounts.set(biome, (biomeCounts.get(biome) ?? 0) + 1);
  }

  for (const biomeId of GENERATED_MAP_BIOMES) {
    assert.ok((biomeCounts.get(biomeId) ?? 0) > 0);
  }

  const biomeTransitions = new Set<string>();
  const toIndex = (x: number, y: number): number => y * map.width + x;

  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const tileBiome = map.metadata.biomeByTile[toIndex(x, y)];
      const neighbors = [
        [x + 1, y],
        [x, y + 1],
      ];

      for (const [nextX, nextY] of neighbors) {
        if (nextX >= map.width || nextY >= map.height) {
          continue;
        }

        const nextBiome = map.metadata.biomeByTile[toIndex(nextX, nextY)];
        if (nextBiome === tileBiome) {
          continue;
        }

        const transitionKey = [tileBiome, nextBiome].sort().join('->');
        biomeTransitions.add(transitionKey);
      }
    }
  }

  assert.ok(biomeTransitions.size >= 3);
});

test('generateMapFromSeed places sparse deterministic decorations and biome landmarks', () => {
  const map = generateMapFromSeed('biome-decoration-seed', { width: 64, height: 48 });
  const mapRepeat = generateMapFromSeed('biome-decoration-seed', { width: 64, height: 48 });

  assert.deepEqual(map.metadata.decorationByTile, mapRepeat.metadata.decorationByTile);
  assert.deepEqual(map.metadata.biomeLandmarks, mapRepeat.metadata.biomeLandmarks);

  const decoratedTiles = map.metadata.decorationByTile.filter((value) => value !== null).length;
  const totalTiles = map.width * map.height;
  assert.ok(decoratedTiles > Math.floor(totalTiles * 0.01));
  assert.ok(decoratedTiles < Math.floor(totalTiles * 0.2));

  const landmarksByBiome = new Set(map.metadata.biomeLandmarks.map((landmark) => landmark.biomeId));
  for (const biomeId of GENERATED_MAP_BIOMES) {
    assert.ok(landmarksByBiome.has(biomeId));
  }
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

test('generateMapFromSeed keeps all walkable tiles connected to player start', () => {
  const map = generateMapFromSeed('walkable-connectivity-seed', { width: 60, height: 44 });
  const toIndex = (x: number, y: number): number => y * map.width + x;
  const start = map.spawnPoints.playerStart;
  const startIndex = toIndex(start.x, start.y);

  assert.equal(map.collision[startIndex], false);

  const visited = new Set<number>();
  const queue = [startIndex];
  visited.add(startIndex);

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

  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const index = toIndex(x, y);
      if (!map.collision[index]) {
        assert.ok(visited.has(index));
      }
    }
  }
});

test('generateMapFromSeed keeps required progression points reachable from spawn', () => {
  const map = generateMapFromSeed('playability-validation-seed', {
    width: 64,
    height: 48,
    trainerCount: 8,
  });
  const toIndex = (x: number, y: number): number => y * map.width + x;
  const start = map.spawnPoints.playerStart;
  const startIndex = toIndex(start.x, start.y);

  assert.equal(map.collision[startIndex], false);

  const visited = new Set<number>();
  const queue = [startIndex];
  visited.add(startIndex);

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

  const healPointIndex = toIndex(map.spawnPoints.healPoint.x, map.spawnPoints.healPoint.y);
  assert.ok(visited.has(healPointIndex));

  const championArenaNode = map.metadata.navigationGraph.nodes.find((node) => node.type === 'championArena');
  assert.ok(championArenaNode);
  if (!championArenaNode) {
    throw new Error('Expected champion arena node to exist.');
  }

  assert.ok(visited.has(toIndex(championArenaNode.x, championArenaNode.y)));

  const reachableTrainerCount = map.spawnPoints.trainers.filter((trainerPoint) =>
    visited.has(toIndex(trainerPoint.x, trainerPoint.y))
  ).length;

  assert.ok(reachableTrainerCount >= 3);
});

test('generateMapFromSeed carves a champion arena clearing around the arena node', () => {
  const map = generateMapFromSeed('champion-arena-clearing-seed', {
    width: 64,
    height: 48,
  });
  const toIndex = (x: number, y: number): number => y * map.width + x;
  const championArenaNode = map.metadata.navigationGraph.nodes.find((node) => node.type === 'championArena');

  assert.ok(championArenaNode);
  if (!championArenaNode) {
    throw new Error('Expected champion arena node to exist.');
  }

  let walkableArenaTiles = 0;
  const arenaRadius = 3;
  for (let offsetY = -arenaRadius; offsetY <= arenaRadius; offsetY += 1) {
    for (let offsetX = -arenaRadius; offsetX <= arenaRadius; offsetX += 1) {
      const x = championArenaNode.x + offsetX;
      const y = championArenaNode.y + offsetY;
      if (x < 1 || x > map.width - 2 || y < 1 || y > map.height - 2) {
        continue;
      }

      if (Math.hypot(offsetX, offsetY) > arenaRadius + 0.2) {
        continue;
      }

      if (!map.collision[toIndex(x, y)]) {
        walkableArenaTiles += 1;
      }
    }
  }

  assert.ok(walkableArenaTiles >= 20);
});

test('generateMapFromSeed enforces spawn safety and key point spacing rules', () => {
  const map = generateMapFromSeed('spawn-safety-seed', {
    width: 64,
    height: 48,
    trainerCount: 10,
    signCount: 6,
  });
  const toIndex = (x: number, y: number): number => y * map.width + x;

  const playerStart = map.spawnPoints.playerStart;
  const playerStartIndex = toIndex(playerStart.x, playerStart.y);
  assert.equal(map.collision[playerStartIndex], false);

  const playerNeighbors = [
    [playerStart.x - 1, playerStart.y],
    [playerStart.x + 1, playerStart.y],
    [playerStart.x, playerStart.y - 1],
    [playerStart.x, playerStart.y + 1],
  ].filter(([x, y]) => x >= 1 && x <= map.width - 2 && y >= 1 && y <= map.height - 2);

  const walkableNeighborCount = playerNeighbors.filter(([x, y]) => !map.collision[toIndex(x, y)]).length;
  assert.ok(walkableNeighborCount >= 2);

  const trainerKeys = new Set<string>();
  for (const trainer of map.spawnPoints.trainers) {
    assert.equal(map.collision[toIndex(trainer.x, trainer.y)], false);
    const key = `${trainer.x},${trainer.y}`;
    assert.equal(trainerKeys.has(key), false);
    trainerKeys.add(key);
  }

  const keyPoints = [
    map.spawnPoints.playerStart,
    map.spawnPoints.healPoint,
    ...map.spawnPoints.trainers,
    ...map.spawnPoints.signs,
  ];

  for (let index = 0; index < keyPoints.length; index += 1) {
    for (let compareIndex = index + 1; compareIndex < keyPoints.length; compareIndex += 1) {
      const spacing =
        Math.abs(keyPoints[index].x - keyPoints[compareIndex].x) +
        Math.abs(keyPoints[index].y - keyPoints[compareIndex].y);
      assert.ok(spacing >= 2);
    }
  }
});


test('generateMapFromSeed places early/mid/late trainers by distance bands', () => {
  const map = generateMapFromSeed('trainer-zones-seed', {
    width: 64,
    height: 48,
    trainerCount: 9,
  });
  const toIndex = (x: number, y: number): number => y * map.width + x;

  let earlyTrainers = 0;
  let midTrainers = 0;
  let lateTrainers = 0;

  for (const trainerPoint of map.spawnPoints.trainers) {
    const difficultyBand = map.metadata.difficultyBandByTile[toIndex(trainerPoint.x, trainerPoint.y)];
    if (difficultyBand === 'early') {
      earlyTrainers += 1;
    } else if (difficultyBand === 'mid') {
      midTrainers += 1;
    } else {
      lateTrainers += 1;
    }
  }

  assert.ok(earlyTrainers >= 1);
  assert.ok(midTrainers >= 1);
  assert.ok(lateTrainers >= 1);
});

test('generateMapFromSeed places signposts near route forks and loops when available', () => {
  const map = generateMapFromSeed('sign-forks-seed', {
    width: 64,
    height: 48,
    signCount: 6,
  });
  const toIndex = (x: number, y: number): number => y * map.width + x;

  for (const signPoint of map.spawnPoints.signs) {
    const walkableNeighbors = [
      [signPoint.x - 1, signPoint.y],
      [signPoint.x + 1, signPoint.y],
      [signPoint.x, signPoint.y - 1],
      [signPoint.x, signPoint.y + 1],
    ].filter(([x, y]) => x >= 1 && x <= map.width - 2 && y >= 1 && y <= map.height - 2)
      .filter(([x, y]) => !map.collision[toIndex(x, y)]).length;

    assert.ok(walkableNeighbors >= 2);
  }
});


test('generateMapFromSeed places deterministic POIs along optional route branches', () => {
  const map = generateMapFromSeed('poi-loop-seed', {
    width: 72,
    height: 54,
    trainerCount: 9,
    signCount: 5,
  });
  const repeatMap = generateMapFromSeed('poi-loop-seed', {
    width: 72,
    height: 54,
    trainerCount: 9,
    signCount: 5,
  });

  assert.deepEqual(map.metadata.pointsOfInterest, repeatMap.metadata.pointsOfInterest);
  assert.equal(map.metadata.pointsOfInterest.length, 2);

  const poiTypes = new Set(map.metadata.pointsOfInterest.map((poi) => poi.type));
  assert.ok(poiTypes.has('shortcutGate'));
  assert.ok(poiTypes.has('scenicLandmark'));

  const optionalNodeIds = new Set(
    map.metadata.navigationGraph.edges
      .filter((edge) => edge.kind === 'optional')
      .flatMap((edge) => [edge.fromNodeId, edge.toNodeId])
  );
  const optionalNodes = map.metadata.navigationGraph.nodes.filter((node) => optionalNodeIds.has(node.id));

  for (const pointOfInterest of map.metadata.pointsOfInterest) {
    const nearestOptionalNodeDistance = Math.min(
      ...optionalNodes.map(
        (node) =>
          Math.abs(node.x - pointOfInterest.x) +
          Math.abs(node.y - pointOfInterest.y)
      )
    );

    assert.ok(nearestOptionalNodeDistance <= 20);
  }
});
