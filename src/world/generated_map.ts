import { SeededRng } from './seeded_rng.js';

export const DEFAULT_GENERATED_MAP_WIDTH = 128;
export const DEFAULT_GENERATED_MAP_HEIGHT = 128;

export type TileId = 'grass' | 'obstacle';
export type DifficultyBand = 'early' | 'mid' | 'late';

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
  biomeIds: string[];
  biomeByTile: string[];
  difficultyBandByTile: DifficultyBand[];
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

export function generateMapFromSeed(
  seed: string | number,
  options: GenerateMapOptions = {}
): GeneratedMap {
  const width = options.width ?? DEFAULT_GENERATED_MAP_WIDTH;
  const height = options.height ?? DEFAULT_GENERATED_MAP_HEIGHT;

  if (width <= 4 || height <= 4) {
    throw new Error('Generated map width and height must be greater than 4 tiles.');
  }

  const rng = new SeededRng(seed);
  const tileCount = width * height;
  const tiles: TileId[] = Array.from({ length: tileCount }, () => 'grass');
  const collision = Array.from({ length: tileCount }, () => false);

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

  const usedPoints = new Set<string>();
  const registerPoint = (point: MapPoint): void => {
    usedPoints.add(`${point.x},${point.y}`);
  };

  const playerStart: MapPoint = {
    x: clamp(Math.floor(width / 2) + rng.nextInt(-3, 3), 1, width - 2),
    y: clamp(Math.floor(height / 2) + rng.nextInt(-3, 3), 1, height - 2),
  };
  registerPoint(playerStart);

  const healPoint = pickUniqueWalkablePoint(rng, width, height, usedPoints, {
    xMin: Math.max(1, playerStart.x - 5),
    xMax: Math.min(width - 2, playerStart.x + 5),
    yMin: Math.max(1, playerStart.y - 5),
    yMax: Math.min(height - 2, playerStart.y + 5),
  });
  registerPoint(healPoint);

  const trainerCount = Math.max(1, options.trainerCount ?? 10);
  const signCount = Math.max(1, options.signCount ?? 4);

  const trainers = Array.from({ length: trainerCount }, () => {
    const trainerPoint = pickUniqueWalkablePoint(rng, width, height, usedPoints);
    registerPoint(trainerPoint);
    return trainerPoint;
  });

  const signs = Array.from({ length: signCount }, () => {
    const signPoint = pickUniqueWalkablePoint(rng, width, height, usedPoints);
    registerPoint(signPoint);
    return signPoint;
  });

  const biomeIds = ['grassland', 'forest', 'rocky', 'lake'];
  const biomeByTile: string[] = [];
  const difficultyBandByTile: DifficultyBand[] = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = toIndex(x, y);
      const xRatio = x / Math.max(1, width - 1);
      const yRatio = y / Math.max(1, height - 1);
      const regionNoise = rng.nextFloat() * 0.18 - 0.09;
      const biomeIndex = clamp(Math.floor((xRatio + yRatio + regionNoise) * 2), 0, biomeIds.length - 1);
      biomeByTile[index] = biomeIds[biomeIndex];

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
    },
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
  }
): MapPoint {
  const maxAttempts = 200;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const x = rng.nextInt(bounds.xMin, bounds.xMax);
    const y = rng.nextInt(bounds.yMin, bounds.yMax);
    const key = `${x},${y}`;
    if (!usedPoints.has(key)) {
      return { x, y };
    }
  }

  throw new Error('Unable to find a unique walkable point for generated map spawn placement.');
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
