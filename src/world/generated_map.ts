import { SeededRng } from './seeded_rng.js';

export const DEFAULT_GENERATED_MAP_WIDTH = 128;
export const DEFAULT_GENERATED_MAP_HEIGHT = 128;

export type BiomeId = 'grassland' | 'forest' | 'rocky' | 'lake';
export const GENERATED_MAP_BIOMES: BiomeId[] = ['grassland', 'forest', 'rocky', 'lake'];

export type TileId = 'grass' | 'obstacle';
export type DecorationId =
  | 'grassTuft'
  | 'flower'
  | 'smallRock'
  | 'bigTree'
  | 'ruin'
  | 'stoneRing'
  | 'reedCluster';
export type DifficultyBand = 'early' | 'mid' | 'late';
export type NavigationNodeType =
  | 'start'
  | 'hub'
  | 'bossGate'
  | 'championArena'
  | 'encounter'
  | 'loot';

export interface MapPoint {
  x: number;
  y: number;
}

export interface GeneratedMapSpawnPoints {
  playerStart: MapPoint;
  healPoint: MapPoint;
  trainers: MapPoint[];
  signs: MapPoint[];
}

export interface GeneratedMapMetadata {
  biomeIds: BiomeId[];
  biomeByTile: BiomeId[];
  difficultyBandByTile: DifficultyBand[];
  decorationByTile: Array<DecorationId | null>;
  biomeLandmarks: Array<{ biomeId: BiomeId; x: number; y: number; decoration: DecorationId }>;
  navigationGraph: GeneratedMapNavigationGraph;
}

export interface GeneratedMapNavigationNode {
  id: string;
  type: NavigationNodeType;
  x: number;
  y: number;
}

export interface GeneratedMapNavigationEdge {
  fromNodeId: string;
  toNodeId: string;
  kind: 'main' | 'optional';
}

export interface GeneratedMapNavigationGraph {
  nodes: GeneratedMapNavigationNode[];
  edges: GeneratedMapNavigationEdge[];
  mainPathNodeIds: string[];
}

export interface GeneratedMap {
  width: number;
  height: number;
  tiles: TileId[];
  collision: boolean[];
  spawnPoints: GeneratedMapSpawnPoints;
  metadata: GeneratedMapMetadata;
}

export interface GenerateMapOptions {
  width?: number;
  height?: number;
  trainerCount?: number;
  signCount?: number;
}

const MAX_GENERATION_ATTEMPTS = 10;
const MIN_REACHABLE_TRAINERS = 3;

export function generateMapFromSeed(
  seed: string | number,
  options: GenerateMapOptions = {}
): GeneratedMap {
  for (let attemptIndex = 0; attemptIndex < MAX_GENERATION_ATTEMPTS; attemptIndex += 1) {
    const attemptSeed = `${String(seed)}:attempt:${attemptIndex}`;
    const generatedMap = generateMapFromAttemptSeed(seed, attemptSeed, options);
    const validationResult = validateGeneratedMapConnectivity(generatedMap, MIN_REACHABLE_TRAINERS);

    if (validationResult.ok) {
      return generatedMap;
    }

    if (isDevelopmentMode()) {
      console.warn(
        `Generated map validation failed for seed ${String(seed)} on attempt ${attemptIndex + 1}/${MAX_GENERATION_ATTEMPTS}: ${validationResult.reason}`
      );
    }
  }

  throw new Error(
    `Unable to generate a playable map for seed ${String(seed)} after ${MAX_GENERATION_ATTEMPTS} attempts.`
  );
}

function generateMapFromAttemptSeed(
  seed: string | number,
  attemptSeed: string,
  options: GenerateMapOptions = {}
): GeneratedMap {
  const width = options.width ?? DEFAULT_GENERATED_MAP_WIDTH;
  const height = options.height ?? DEFAULT_GENERATED_MAP_HEIGHT;

  if (width <= 4 || height <= 4) {
    throw new Error('Generated map width and height must be greater than 4 tiles.');
  }

  const rng = new SeededRng(attemptSeed);
  const tileCount = width * height;
  const tiles: TileId[] = Array.from({ length: tileCount }, () => 'obstacle');
  const collision = Array.from({ length: tileCount }, () => true);

  const toIndex = (x: number, y: number): number => y * width + x;

  for (let x = 0; x < width; x += 1) {
    const topIndex = toIndex(x, 0);
    const bottomIndex = toIndex(x, height - 1);
    tiles[topIndex] = 'obstacle';
    tiles[bottomIndex] = 'obstacle';
    collision[topIndex] = true;
    collision[bottomIndex] = true;
  }

  for (let y = 1; y < height - 1; y += 1) {
    const leftIndex = toIndex(0, y);
    const rightIndex = toIndex(width - 1, y);
    tiles[leftIndex] = 'obstacle';
    tiles[rightIndex] = 'obstacle';
    collision[leftIndex] = true;
    collision[rightIndex] = true;
  }

  const playerStart: MapPoint = {
    x: clamp(Math.floor(width / 2) + rng.nextInt(-3, 3), 1, width - 2),
    y: clamp(Math.floor(height / 2) + rng.nextInt(-3, 3), 1, height - 2),
  };
  const navigationGraph = buildNavigationGraph(rng, width, height, playerStart);
  carveNavigationRoutes(rng, width, height, navigationGraph, toIndex, tiles, collision);
  applyObstacleClusters(rng, width, height, navigationGraph, playerStart, toIndex, tiles, collision);
  ensureSingleReachableWalkableRegion(width, height, playerStart, toIndex, tiles, collision);
  const walkableTileKeys = collectWalkableTileKeys(width, height, toIndex, collision);

  const usedPoints = new Set<string>();
  const usedPointCoordinates: MapPoint[] = [];
  const registerPoint = (point: MapPoint): void => {
    usedPoints.add(`${point.x},${point.y}`);
    usedPointCoordinates.push(point);
  };
  registerPoint(playerStart);

  const healPoint = pickUniqueWalkablePoint(rng, width, height, usedPoints, {
    xMin: Math.max(1, playerStart.x - 5),
    xMax: Math.min(width - 2, playerStart.x + 5),
    yMin: Math.max(1, playerStart.y - 5),
    yMax: Math.min(height - 2, playerStart.y + 5),
  }, walkableTileKeys, usedPointCoordinates, 3);
  registerPoint(healPoint);

  const trainerCount = Math.max(1, options.trainerCount ?? 10);
  const signCount = Math.max(1, options.signCount ?? 4);

  const trainers = Array.from({ length: trainerCount }, () => {
    const trainerPoint = pickUniqueWalkablePoint(
      rng,
      width,
      height,
      usedPoints,
      undefined,
      walkableTileKeys,
      usedPointCoordinates,
      2
    );
    registerPoint(trainerPoint);
    return trainerPoint;
  });

  const signs = Array.from({ length: signCount }, () => {
    const signPoint = pickUniqueWalkablePoint(
      rng,
      width,
      height,
      usedPoints,
      undefined,
      walkableTileKeys,
      usedPointCoordinates,
      2
    );
    registerPoint(signPoint);
    return signPoint;
  });

  const biomeIds = GENERATED_MAP_BIOMES;
  const biomeByTile = assignBiomesByRegion(attemptSeed, width, height, biomeIds);
  const decorationByTile = applyDecorations(attemptSeed, width, height, collision, biomeByTile, {
    playerStart,
    healPoint,
    trainers,
    signs,
  });
  const biomeLandmarks = placeBiomeLandmarks(attemptSeed, width, height, collision, biomeByTile, decorationByTile, {
    playerStart,
    healPoint,
    trainers,
    signs,
  });
  const difficultyBandByTile: DifficultyBand[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = toIndex(x, y);
      const distanceFromSpawn = Math.hypot(x - playerStart.x, y - playerStart.y);
      const normalizedDistance = distanceFromSpawn / Math.max(width, height);
      if (normalizedDistance < 0.2) {
        difficultyBandByTile[index] = 'early';
      } else if (normalizedDistance < 0.45) {
        difficultyBandByTile[index] = 'mid';
      } else {
        difficultyBandByTile[index] = 'late';
      }
    }
  }

  return {
    width,
    height,
    tiles,
    collision,
    spawnPoints: {
      playerStart,
      healPoint,
      trainers,
      signs,
    },
    metadata: {
      biomeIds,
      biomeByTile,
      difficultyBandByTile,
      decorationByTile,
      biomeLandmarks,
      navigationGraph,
    },
  };
}

function validateGeneratedMapConnectivity(
  map: GeneratedMap,
  minimumReachableTrainers: number
): { ok: true } | { ok: false; reason: string } {
  const toIndex = (x: number, y: number): number => y * map.width + x;
  const startIndex = toIndex(map.spawnPoints.playerStart.x, map.spawnPoints.playerStart.y);

  if (map.collision[startIndex]) {
    return { ok: false, reason: 'Player spawn is blocked by collision.' };
  }

  const openNeighborsAroundPlayer = countWalkableOrthogonalNeighbors(
    map.width,
    map.height,
    toIndex,
    map.collision,
    map.spawnPoints.playerStart
  );
  if (openNeighborsAroundPlayer < 2) {
    return {
      ok: false,
      reason: `Player spawn does not have enough free neighboring tiles (found ${openNeighborsAroundPlayer}, expected at least 2).`,
    };
  }

  const trainerPointKeys = new Set<string>();
  for (const trainerPoint of map.spawnPoints.trainers) {
    const trainerIndex = toIndex(trainerPoint.x, trainerPoint.y);
    if (map.collision[trainerIndex]) {
      return { ok: false, reason: 'Trainer spawn is blocked by collision.' };
    }

    const key = `${trainerPoint.x},${trainerPoint.y}`;
    if (trainerPointKeys.has(key)) {
      return { ok: false, reason: 'Trainer spawns overlap each other.' };
    }

    trainerPointKeys.add(key);
  }

  const keyPoints: MapPoint[] = [
    map.spawnPoints.playerStart,
    map.spawnPoints.healPoint,
    ...map.spawnPoints.trainers,
    ...map.spawnPoints.signs,
  ];
  const minimumSpacing = 2;
  for (let index = 0; index < keyPoints.length; index += 1) {
    for (let compareIndex = index + 1; compareIndex < keyPoints.length; compareIndex += 1) {
      const spacing = manhattanDistance(keyPoints[index], keyPoints[compareIndex]);
      if (spacing < minimumSpacing) {
        return {
          ok: false,
          reason: `Key points are too close together (spacing ${spacing}, expected at least ${minimumSpacing}).`,
        };
      }
    }
  }

  const reachable = collectReachableWalkableTiles(
    map.width,
    map.height,
    toIndex,
    map.collision,
    startIndex
  );

  const healPointIndex = toIndex(map.spawnPoints.healPoint.x, map.spawnPoints.healPoint.y);
  if (!reachable.has(healPointIndex)) {
    return { ok: false, reason: 'Heal point is unreachable from player spawn.' };
  }

  const championNode = map.metadata.navigationGraph.nodes.find((node) => node.type === 'championArena');
  if (!championNode) {
    return { ok: false, reason: 'Champion arena node is missing from navigation graph.' };
  }

  const championIndex = toIndex(championNode.x, championNode.y);
  if (!reachable.has(championIndex)) {
    return { ok: false, reason: 'Champion arena is unreachable from player spawn.' };
  }

  const reachableTrainerCount = map.spawnPoints.trainers.filter((trainerPoint) =>
    reachable.has(toIndex(trainerPoint.x, trainerPoint.y))
  ).length;

  if (reachableTrainerCount < minimumReachableTrainers) {
    return {
      ok: false,
      reason: `Only ${reachableTrainerCount} trainers are reachable, expected at least ${minimumReachableTrainers}.`,
    };
  }

  return { ok: true };
}

function isDevelopmentMode(): boolean {
  const processLike = (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process;
  return processLike?.env?.NODE_ENV !== 'production';
}

function applyDecorations(
  seed: string | number,
  width: number,
  height: number,
  collision: boolean[],
  biomeByTile: BiomeId[],
  spawnPoints: GeneratedMapSpawnPoints
): Array<DecorationId | null> {
  const decorationByTile: Array<DecorationId | null> = Array.from({ length: width * height }, () => null);
  const decorationRng = new SeededRng(`decorations:${String(seed)}`);
  const protectedKeys = createProtectedPointKeys(spawnPoints);

  const toIndex = (x: number, y: number): number => y * width + x;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const tileIndex = toIndex(x, y);
      if (collision[tileIndex] || protectedKeys.has(`${x},${y}`)) {
        continue;
      }

      const biome = biomeByTile[tileIndex];
      const spawnChanceByBiome: Record<BiomeId, number> = {
        grassland: 0.052,
        forest: 0.065,
        rocky: 0.045,
        lake: 0.04,
      };

      if (decorationRng.nextFloat() > spawnChanceByBiome[biome]) {
        continue;
      }

      const decorationPoolByBiome: Record<BiomeId, DecorationId[]> = {
        grassland: ['grassTuft', 'flower'],
        forest: ['grassTuft', 'flower', 'bigTree'],
        rocky: ['smallRock', 'stoneRing'],
        lake: ['reedCluster', 'flower', 'grassTuft'],
      };

      decorationByTile[tileIndex] = decorationRng.pick(decorationPoolByBiome[biome]);
    }
  }

  return decorationByTile;
}

function placeBiomeLandmarks(
  seed: string | number,
  width: number,
  height: number,
  collision: boolean[],
  biomeByTile: BiomeId[],
  decorationByTile: Array<DecorationId | null>,
  spawnPoints: GeneratedMapSpawnPoints
): Array<{ biomeId: BiomeId; x: number; y: number; decoration: DecorationId }> {
  const toIndex = (x: number, y: number): number => y * width + x;
  const protectedKeys = createProtectedPointKeys(spawnPoints);
  const landmarkRng = new SeededRng(`landmarks:${String(seed)}`);
  const landmarkByBiome: Record<BiomeId, DecorationId> = {
    grassland: 'flower',
    forest: 'bigTree',
    rocky: 'ruin',
    lake: 'reedCluster',
  };
  const landmarks: Array<{ biomeId: BiomeId; x: number; y: number; decoration: DecorationId }> = [];

  for (const biomeId of GENERATED_MAP_BIOMES) {
    const candidates: MapPoint[] = [];

    for (let y = 2; y < height - 2; y += 1) {
      for (let x = 2; x < width - 2; x += 1) {
        const key = `${x},${y}`;
        const index = toIndex(x, y);
        if (collision[index] || biomeByTile[index] !== biomeId || protectedKeys.has(key)) {
          continue;
        }

        candidates.push({ x, y });
      }
    }

    if (candidates.length === 0) {
      continue;
    }

    const center = candidates[landmarkRng.nextInt(0, candidates.length - 1)];
    const landmarkDecoration = landmarkByBiome[biomeId];
    const shapeRadius = biomeId === 'forest' ? 2 : 1;

    for (let offsetY = -shapeRadius; offsetY <= shapeRadius; offsetY += 1) {
      for (let offsetX = -shapeRadius; offsetX <= shapeRadius; offsetX += 1) {
        const x = clamp(center.x + offsetX, 1, width - 2);
        const y = clamp(center.y + offsetY, 1, height - 2);
        const key = `${x},${y}`;
        const index = toIndex(x, y);

        if (
          collision[index] ||
          biomeByTile[index] !== biomeId ||
          protectedKeys.has(key)
        ) {
          continue;
        }

        decorationByTile[index] = landmarkDecoration;
      }
    }

    landmarks.push({
      biomeId,
      x: center.x,
      y: center.y,
      decoration: landmarkDecoration,
    });
  }

  return landmarks;
}

function createProtectedPointKeys(spawnPoints: GeneratedMapSpawnPoints): Set<string> {
  const protectedKeys = new Set<string>();
  const reservePoint = (point: MapPoint): void => {
    for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
      for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        protectedKeys.add(`${point.x + offsetX},${point.y + offsetY}`);
      }
    }
  };

  reservePoint(spawnPoints.playerStart);
  reservePoint(spawnPoints.healPoint);
  for (const point of spawnPoints.trainers) {
    reservePoint(point);
  }
  for (const point of spawnPoints.signs) {
    reservePoint(point);
  }

  return protectedKeys;
}

function assignBiomesByRegion(
  seed: string | number,
  width: number,
  height: number,
  biomeIds: BiomeId[]
): BiomeId[] {
  const toIndex = (x: number, y: number): number => y * width + x;
  const biomeByTile: BiomeId[] = Array.from({ length: width * height }, () => biomeIds[0]);
  const biomeRng = new SeededRng(`biome-regions:${String(seed)}`);

  const anchors = biomeIds.map((biomeId, index) => {
    const ratio = (index + 1) / (biomeIds.length + 1);
    const horizontalBias = index % 2 === 0 ? 0.28 : 0.72;
    const xCenter = width * horizontalBias;
    const yCenter = height * ratio;

    return {
      biomeId,
      x: clamp(Math.floor(xCenter + biomeRng.nextInt(-18, 18)), 1, width - 2),
      y: clamp(Math.floor(yCenter + biomeRng.nextInt(-18, 18)), 1, height - 2),
    };
  });

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = toIndex(x, y);
      let closestAnchor = anchors[0];
      let secondClosestAnchor = anchors[1] ?? anchors[0];
      let closestDistance = Number.POSITIVE_INFINITY;
      let secondClosestDistance = Number.POSITIVE_INFINITY;

      for (const anchor of anchors) {
        const distance = Math.hypot(x - anchor.x, y - anchor.y);
        if (distance < closestDistance) {
          secondClosestDistance = closestDistance;
          secondClosestAnchor = closestAnchor;
          closestDistance = distance;
          closestAnchor = anchor;
        } else if (distance < secondClosestDistance) {
          secondClosestDistance = distance;
          secondClosestAnchor = anchor;
        }
      }

      const borderDistanceDelta = secondClosestDistance - closestDistance;
      const blendNoise = noiseFromCoordinate(seed, x, y) * 2 - 1;
      const blendThreshold = 2.8 + Math.abs(blendNoise) * 2.2;
      biomeByTile[index] =
        borderDistanceDelta <= blendThreshold && blendNoise > 0
          ? secondClosestAnchor.biomeId
          : closestAnchor.biomeId;
    }
  }

  return biomeByTile;
}

function noiseFromCoordinate(seed: string | number, x: number, y: number): number {
  const source = `${String(seed)}:${x},${y}`;
  let hash = 2166136261;

  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return ((hash >>> 0) % 10000) / 10000;
}

function carveNavigationRoutes(
  rng: SeededRng,
  width: number,
  height: number,
  navigationGraph: GeneratedMapNavigationGraph,
  toIndex: (x: number, y: number) => number,
  tiles: TileId[],
  collision: boolean[]
): void {
  const nodesById = new Map(navigationGraph.nodes.map((node) => [node.id, node]));

  const carveTile = (x: number, y: number, thickness: number): void => {
    for (let offsetY = -thickness; offsetY <= thickness; offsetY += 1) {
      for (let offsetX = -thickness; offsetX <= thickness; offsetX += 1) {
        const nextX = clamp(x + offsetX, 1, width - 2);
        const nextY = clamp(y + offsetY, 1, height - 2);
        const tileIndex = toIndex(nextX, nextY);
        tiles[tileIndex] = 'grass';
        collision[tileIndex] = false;
      }
    }
  };

  const carvePathSegment = (
    from: MapPoint,
    to: MapPoint,
    axis: 'horizontal' | 'vertical',
    thickness: number
  ): void => {
    if (axis === 'horizontal') {
      const direction = from.x <= to.x ? 1 : -1;
      for (let x = from.x; x !== to.x + direction; x += direction) {
        carveTile(x, from.y, thickness);
      }
      return;
    }

    const direction = from.y <= to.y ? 1 : -1;
    for (let y = from.y; y !== to.y + direction; y += direction) {
      carveTile(from.x, y, thickness);
    }
  };

  for (const node of navigationGraph.nodes) {
    const clearingRadius = rng.nextFloat() < 0.35 ? 2 : 1;
    carveTile(node.x, node.y, clearingRadius);
  }

  for (const edge of navigationGraph.edges) {
    const fromNode = nodesById.get(edge.fromNodeId);
    const toNode = nodesById.get(edge.toNodeId);

    if (!fromNode || !toNode) {
      continue;
    }

    const thickness = edge.kind === 'main'
      ? rng.nextFloat() > 0.35
        ? 2
        : 1
      : rng.nextFloat() > 0.6
        ? 2
        : 1;
    const horizontalFirst = rng.nextFloat() > 0.5;
    const bendPoint: MapPoint = horizontalFirst
      ? { x: toNode.x, y: fromNode.y }
      : { x: fromNode.x, y: toNode.y };

    carvePathSegment(fromNode, bendPoint, horizontalFirst ? 'horizontal' : 'vertical', thickness);
    carvePathSegment(bendPoint, toNode, horizontalFirst ? 'vertical' : 'horizontal', thickness);
  }

}

function applyObstacleClusters(
  rng: SeededRng,
  width: number,
  height: number,
  navigationGraph: GeneratedMapNavigationGraph,
  playerStart: MapPoint,
  toIndex: (x: number, y: number) => number,
  tiles: TileId[],
  collision: boolean[]
): void {
  const protectedTiles = new Set<number>();
  for (const node of navigationGraph.nodes) {
    const radius = node.id === 'start' ? 2 : 1;
    for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
      for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
        const x = clamp(node.x + offsetX, 1, width - 2);
        const y = clamp(node.y + offsetY, 1, height - 2);
        protectedTiles.add(toIndex(x, y));
      }
    }
  }

  const clusterAttempts = Math.max(6, Math.floor((width * height) / 900));
  for (let attempt = 0; attempt < clusterAttempts; attempt += 1) {
    const centerX = clamp(playerStart.x + rng.nextInt(-28, 28), 2, width - 3);
    const centerY = clamp(playerStart.y + rng.nextInt(-24, 24), 2, height - 3);
    const radius = rng.nextFloat() > 0.72 ? 2 : 1;
    const candidateIndices: number[] = [];

    for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
      for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
        const x = centerX + offsetX;
        const y = centerY + offsetY;
        if (x < 1 || x > width - 2 || y < 1 || y > height - 2) {
          continue;
        }

        const index = toIndex(x, y);
        if (protectedTiles.has(index) || collision[index]) {
          continue;
        }

        candidateIndices.push(index);
      }
    }

    if (candidateIndices.length === 0) {
      continue;
    }

    for (const index of candidateIndices) {
      collision[index] = true;
      tiles[index] = 'obstacle';
    }

    if (!areAllMainPathNodesConnected(width, height, toIndex, collision, navigationGraph)) {
      for (const index of candidateIndices) {
        collision[index] = false;
        tiles[index] = 'grass';
      }
    }
  }
}

function ensureSingleReachableWalkableRegion(
  width: number,
  height: number,
  playerStart: MapPoint,
  toIndex: (x: number, y: number) => number,
  tiles: TileId[],
  collision: boolean[]
): void {
  const startIndex = toIndex(playerStart.x, playerStart.y);
  const reachable = collectReachableWalkableTiles(width, height, toIndex, collision, startIndex);

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = toIndex(x, y);
      if (!collision[index] && !reachable.has(index)) {
        collision[index] = true;
        tiles[index] = 'obstacle';
      }
    }
  }
}

function collectWalkableTileKeys(
  width: number,
  height: number,
  toIndex: (x: number, y: number) => number,
  collision: boolean[]
): Set<string> {
  const walkableTileKeys = new Set<string>();
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = toIndex(x, y);
      if (!collision[index]) {
        walkableTileKeys.add(`${x},${y}`);
      }
    }
  }

  return walkableTileKeys;
}

function areAllMainPathNodesConnected(
  width: number,
  height: number,
  toIndex: (x: number, y: number) => number,
  collision: boolean[],
  navigationGraph: GeneratedMapNavigationGraph
): boolean {
  const startNode = navigationGraph.nodes.find((node) => node.id === 'start');
  if (!startNode) {
    return false;
  }

  const reachable = collectReachableWalkableTiles(
    width,
    height,
    toIndex,
    collision,
    toIndex(startNode.x, startNode.y)
  );

  return navigationGraph.mainPathNodeIds.every((nodeId) => {
    const node = navigationGraph.nodes.find((item) => item.id === nodeId);
    return node ? reachable.has(toIndex(node.x, node.y)) : false;
  });
}

function collectReachableWalkableTiles(
  width: number,
  height: number,
  toIndex: (x: number, y: number) => number,
  collision: boolean[],
  startIndex: number
): Set<number> {
  const reachable = new Set<number>();
  if (collision[startIndex]) {
    return reachable;
  }

  const queue: number[] = [startIndex];
  reachable.add(startIndex);

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) {
      continue;
    }

    const x = current % width;
    const y = Math.floor(current / width);
    const neighbors: MapPoint[] = [
      { x: x - 1, y },
      { x: x + 1, y },
      { x, y: y - 1 },
      { x, y: y + 1 },
    ];

    for (const neighbor of neighbors) {
      if (
        neighbor.x < 1 ||
        neighbor.x > width - 2 ||
        neighbor.y < 1 ||
        neighbor.y > height - 2
      ) {
        continue;
      }

      const neighborIndex = toIndex(neighbor.x, neighbor.y);
      if (collision[neighborIndex] || reachable.has(neighborIndex)) {
        continue;
      }

      reachable.add(neighborIndex);
      queue.push(neighborIndex);
    }
  }

  return reachable;
}

function countWalkableOrthogonalNeighbors(
  width: number,
  height: number,
  toIndex: (x: number, y: number) => number,
  collision: boolean[],
  point: MapPoint
): number {
  const neighbors: MapPoint[] = [
    { x: point.x - 1, y: point.y },
    { x: point.x + 1, y: point.y },
    { x: point.x, y: point.y - 1 },
    { x: point.x, y: point.y + 1 },
  ];

  let walkableNeighborCount = 0;
  for (const neighbor of neighbors) {
    if (
      neighbor.x < 1 ||
      neighbor.x > width - 2 ||
      neighbor.y < 1 ||
      neighbor.y > height - 2
    ) {
      continue;
    }

    if (!collision[toIndex(neighbor.x, neighbor.y)]) {
      walkableNeighborCount += 1;
    }
  }

  return walkableNeighborCount;
}

function buildNavigationGraph(
  rng: SeededRng,
  width: number,
  height: number,
  playerStart: MapPoint
): GeneratedMapNavigationGraph {
  const nodes: GeneratedMapNavigationNode[] = [];
  const edges: GeneratedMapNavigationEdge[] = [];
  const usedPoints = new Set<string>();

  const registerNode = (
    id: string,
    type: NavigationNodeType,
    bounds?: { xMin: number; xMax: number; yMin: number; yMax: number },
    fixedPoint?: MapPoint
  ): GeneratedMapNavigationNode => {
    const point =
      fixedPoint ?? pickUniqueWalkablePoint(rng, width, height, usedPoints, bounds);
    usedPoints.add(`${point.x},${point.y}`);

    const node: GeneratedMapNavigationNode = { id, type, x: point.x, y: point.y };
    nodes.push(node);
    return node;
  };

  const startNode = registerNode('start', 'start', undefined, playerStart);
  const includeHub = rng.nextFloat() >= 0.35;
  const hubNode = includeHub
    ? registerNode('hub', 'hub', {
        xMin: clamp(Math.floor(width * 0.2), 1, width - 2),
        xMax: clamp(Math.floor(width * 0.45), 1, width - 2),
        yMin: clamp(Math.floor(height * 0.2), 1, height - 2),
        yMax: clamp(Math.floor(height * 0.45), 1, height - 2),
      })
    : null;

  const encounterNodes = Array.from({ length: 5 }, (_, index) =>
    registerNode(`encounter-${index + 1}`, 'encounter')
  );
  const lootNodes = Array.from({ length: 3 }, (_, index) =>
    registerNode(`loot-${index + 1}`, 'loot')
  );

  const bossGateNode = registerNode('boss-gate', 'bossGate', {
    xMin: clamp(Math.floor(width * 0.65), 1, width - 2),
    xMax: width - 2,
    yMin: clamp(Math.floor(height * 0.65), 1, height - 2),
    yMax: height - 2,
  });
  const championNode = registerNode('champion-arena', 'championArena', {
    xMin: clamp(Math.floor(width * 0.75), 1, width - 2),
    xMax: width - 2,
    yMin: clamp(Math.floor(height * 0.75), 1, height - 2),
    yMax: height - 2,
  });

  const mainPathNodes = [
    startNode,
    ...(hubNode ? [hubNode] : []),
    encounterNodes[0],
    encounterNodes[1],
    bossGateNode,
    championNode,
  ];

  for (let index = 0; index < mainPathNodes.length - 1; index += 1) {
    edges.push({
      fromNodeId: mainPathNodes[index].id,
      toNodeId: mainPathNodes[index + 1].id,
      kind: 'main',
    });
  }

  edges.push({
    fromNodeId: encounterNodes[0].id,
    toNodeId: encounterNodes[2].id,
    kind: 'optional',
  });
  edges.push({
    fromNodeId: encounterNodes[2].id,
    toNodeId: encounterNodes[1].id,
    kind: 'optional',
  });

  edges.push({
    fromNodeId: encounterNodes[1].id,
    toNodeId: lootNodes[0].id,
    kind: 'optional',
  });
  edges.push({
    fromNodeId: lootNodes[0].id,
    toNodeId: bossGateNode.id,
    kind: 'optional',
  });

  edges.push({
    fromNodeId: startNode.id,
    toNodeId: encounterNodes[3].id,
    kind: 'optional',
  });
  edges.push({
    fromNodeId: encounterNodes[3].id,
    toNodeId: lootNodes[1].id,
    kind: 'optional',
  });
  edges.push({
    fromNodeId: lootNodes[1].id,
    toNodeId: encounterNodes[4].id,
    kind: 'optional',
  });
  edges.push({
    fromNodeId: encounterNodes[4].id,
    toNodeId: championNode.id,
    kind: 'optional',
  });

  if (hubNode) {
    edges.push({
      fromNodeId: hubNode.id,
      toNodeId: lootNodes[2].id,
      kind: 'optional',
    });
    edges.push({
      fromNodeId: lootNodes[2].id,
      toNodeId: encounterNodes[2].id,
      kind: 'optional',
    });
  } else {
    edges.push({
      fromNodeId: encounterNodes[0].id,
      toNodeId: lootNodes[2].id,
      kind: 'optional',
    });
    edges.push({
      fromNodeId: lootNodes[2].id,
      toNodeId: bossGateNode.id,
      kind: 'optional',
    });
  }

  return {
    nodes,
    edges,
    mainPathNodeIds: mainPathNodes.map((node) => node.id),
  };
}

function pickUniqueWalkablePoint(
  rng: SeededRng,
  width: number,
  height: number,
  usedPoints: Set<string>,
  bounds: { xMin: number; xMax: number; yMin: number; yMax: number } = {
    xMin: 1,
    xMax: width - 2,
    yMin: 1,
    yMax: height - 2,
  },
  allowedPoints?: Set<string>,
  usedPointCoordinates: MapPoint[] = [],
  minimumManhattanDistance = 0
): MapPoint {
  const maxAttempts = 200;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const x = rng.nextInt(bounds.xMin, bounds.xMax);
    const y = rng.nextInt(bounds.yMin, bounds.yMax);
    const key = `${x},${y}`;
    const hasMinimumSpacing = usedPointCoordinates.every(
      (usedPoint) => manhattanDistance({ x, y }, usedPoint) >= minimumManhattanDistance
    );
    if (!usedPoints.has(key) && (!allowedPoints || allowedPoints.has(key)) && hasMinimumSpacing) {
      return { x, y };
    }
  }

  if (allowedPoints) {
    for (const key of allowedPoints) {
      if (usedPoints.has(key)) {
        continue;
      }

      const [xAsString, yAsString] = key.split(',');
      const x = Number(xAsString);
      const y = Number(yAsString);
      const withinBounds =
        x >= bounds.xMin &&
        x <= bounds.xMax &&
        y >= bounds.yMin &&
        y <= bounds.yMax;

      const hasMinimumSpacing = usedPointCoordinates.every(
        (usedPoint) => manhattanDistance({ x, y }, usedPoint) >= minimumManhattanDistance
      );

      if (withinBounds && hasMinimumSpacing) {
        return { x, y };
      }
    }
  }

  throw new Error('Unable to find a unique walkable point for generated map spawn placement.');
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function manhattanDistance(pointA: MapPoint, pointB: MapPoint): number {
  return Math.abs(pointA.x - pointB.x) + Math.abs(pointA.y - pointB.y);
}
