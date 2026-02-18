import Phaser from 'phaser';

import { DecorationId, GeneratedMap, GeneratedMapNavigationNode } from './generated_map.js';
import {
  buildGroundAutotileVariants,
  GroundTerrain,
  GroundTileVariant,
} from './tiles/autotile.js';
import { SVG_TILE_TEXTURE_KEY_BY_VARIANT } from './tiles/svgTileset.js';

const GENERATED_TILESET_KEY = 'generated-map-tileset';
const GENERATED_TILE_SIZE = 16;

const GROUND_TILE_INDEX_BY_VARIANT: Record<GroundTileVariant, number> = {
  grass_center: 0,
  dirt_center: 1,
  grass_edge_n: 2,
  grass_edge_e: 3,
  grass_edge_s: 4,
  grass_edge_w: 5,
};

const OBSTACLE_TILE_INDEX = 6;

const DECORATION_TILE_INDEX_BY_ID: Record<DecorationId, number> = {
  grassTuft: 7,
  flower: 8,
  smallRock: 9,
  bigTree: 10,
  ruin: 11,
  stoneRing: 12,
  reedCluster: 13,
};

export interface GeneratedMapRenderResult {
  collisionLayer: Phaser.Tilemaps.TilemapLayer;
  worldWidth: number;
  worldHeight: number;
  tileSize: number;
}

export function renderGeneratedMap(
  scene: Phaser.Scene,
  generatedMap: GeneratedMap
): GeneratedMapRenderResult {
  ensureGeneratedTilesetTexture(scene);

  const tilemap = scene.make.tilemap({
    width: generatedMap.width,
    height: generatedMap.height,
    tileWidth: GENERATED_TILE_SIZE,
    tileHeight: GENERATED_TILE_SIZE,
  });

  const mapTileset = tilemap.addTilesetImage(GENERATED_TILESET_KEY);
  if (!mapTileset) {
    throw new Error('Unable to initialize generated map tileset.');
  }

  const tileRows = toGroundRows(generatedMap);
  const decorationRows = toDecorationRows(generatedMap);
  const collisionRows = toCollisionRows(generatedMap);
  const groundLayer = tilemap.createBlankLayer('Ground', mapTileset, 0, 0);
  const decorationLayer = tilemap.createBlankLayer('Decoration', mapTileset, 0, 0);
  const collisionLayer = tilemap.createBlankLayer('Collision', mapTileset, 0, 0);

  if (!groundLayer || !collisionLayer || !decorationLayer) {
    throw new Error('Unable to create generated map tile layers.');
  }

  groundLayer.putTilesAt(tileRows, 0, 0);
  decorationLayer.putTilesAt(decorationRows, 0, 0);

  collisionLayer.putTilesAt(collisionRows, 0, 0);
  collisionLayer.setVisible(false);
  collisionLayer.setCollision(OBSTACLE_TILE_INDEX);

  return {
    collisionLayer,
    worldWidth: tilemap.widthInPixels,
    worldHeight: tilemap.heightInPixels,
    tileSize: GENERATED_TILE_SIZE,
  };
}

function toDecorationRows(generatedMap: GeneratedMap): number[][] {
  const rows: number[][] = [];

  for (let y = 0; y < generatedMap.height; y += 1) {
    const row: number[] = [];
    for (let x = 0; x < generatedMap.width; x += 1) {
      const index = y * generatedMap.width + x;
      const decorationId = generatedMap.metadata.decorationByTile[index];
      row.push(decorationId ? DECORATION_TILE_INDEX_BY_ID[decorationId] : -1);
    }

    rows.push(row);
  }

  return rows;
}

function toGroundRows(generatedMap: GeneratedMap): number[][] {
  const terrainByTile = buildGroundTerrainMap(generatedMap);
  const autotileVariants = buildGroundAutotileVariants(
    generatedMap.width,
    generatedMap.height,
    terrainByTile
  );
  const rows: number[][] = [];

  for (let y = 0; y < generatedMap.height; y += 1) {
    const row: number[] = [];
    for (let x = 0; x < generatedMap.width; x += 1) {
      const index = y * generatedMap.width + x;
      if (generatedMap.collision[index]) {
        row.push(OBSTACLE_TILE_INDEX);
        continue;
      }

      row.push(GROUND_TILE_INDEX_BY_VARIANT[autotileVariants[index]]);
    }

    rows.push(row);
  }

  return rows;
}

function toCollisionRows(generatedMap: GeneratedMap): number[][] {
  const rows: number[][] = [];

  for (let y = 0; y < generatedMap.height; y += 1) {
    const row: number[] = [];
    for (let x = 0; x < generatedMap.width; x += 1) {
      const index = y * generatedMap.width + x;
      row.push(generatedMap.collision[index] ? OBSTACLE_TILE_INDEX : -1);
    }

    rows.push(row);
  }

  return rows;
}

function buildGroundTerrainMap(generatedMap: GeneratedMap): GroundTerrain[] {
  const terrainByTile: GroundTerrain[] = Array.from(
    { length: generatedMap.width * generatedMap.height },
    (_, index) => (generatedMap.tiles[index] === 'grass' ? 'grass' : 'dirt')
  );
  const nodeById = new Map(
    generatedMap.metadata.navigationGraph.nodes.map((node) => [node.id, node])
  );

  for (const node of generatedMap.metadata.navigationGraph.nodes) {
    markDirtCircle(generatedMap, terrainByTile, node.x, node.y, 1);
  }

  for (const edge of generatedMap.metadata.navigationGraph.edges) {
    const fromNode = nodeById.get(edge.fromNodeId);
    const toNode = nodeById.get(edge.toNodeId);
    if (!fromNode || !toNode) {
      continue;
    }

    markDirtLine(generatedMap, terrainByTile, fromNode, toNode);
  }

  return terrainByTile;
}

function markDirtLine(
  generatedMap: GeneratedMap,
  terrainByTile: GroundTerrain[],
  start: GeneratedMapNavigationNode,
  end: GeneratedMapNavigationNode
): void {
  const dx = Math.abs(end.x - start.x);
  const dy = Math.abs(end.y - start.y);
  const sx = start.x < end.x ? 1 : -1;
  const sy = start.y < end.y ? 1 : -1;

  let x = start.x;
  let y = start.y;
  let err = dx - dy;

  while (true) {
    markDirtCircle(generatedMap, terrainByTile, x, y, 1);

    if (x === end.x && y === end.y) {
      break;
    }

    const err2 = err * 2;
    if (err2 > -dy) {
      err -= dy;
      x += sx;
    }

    if (err2 < dx) {
      err += dx;
      y += sy;
    }
  }
}

function markDirtCircle(
  generatedMap: GeneratedMap,
  terrainByTile: GroundTerrain[],
  centerX: number,
  centerY: number,
  radius: number
): void {
  for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
    for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
      const x = centerX + offsetX;
      const y = centerY + offsetY;
      if (x < 0 || y < 0 || x >= generatedMap.width || y >= generatedMap.height) {
        continue;
      }

      const index = y * generatedMap.width + x;
      if (generatedMap.collision[index]) {
        continue;
      }

      terrainByTile[index] = 'dirt';
    }
  }
}

function ensureGeneratedTilesetTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(GENERATED_TILESET_KEY)) {
    return;
  }

  const tileTextureOrder: string[] = [
    SVG_TILE_TEXTURE_KEY_BY_VARIANT.grass_center,
    SVG_TILE_TEXTURE_KEY_BY_VARIANT.dirt_center,
    SVG_TILE_TEXTURE_KEY_BY_VARIANT.grass_edge_n,
    SVG_TILE_TEXTURE_KEY_BY_VARIANT.grass_edge_e,
    SVG_TILE_TEXTURE_KEY_BY_VARIANT.grass_edge_s,
    SVG_TILE_TEXTURE_KEY_BY_VARIANT.grass_edge_w,
  ];

  const textureWidth = GENERATED_TILE_SIZE * 14;
  const textureHeight = GENERATED_TILE_SIZE;
  const canvasTexture = scene.textures.createCanvas(
    GENERATED_TILESET_KEY,
    textureWidth,
    textureHeight
  );

  if (!canvasTexture) {
    throw new Error('Unable to create generated map tileset canvas texture.');
  }

  const context = canvasTexture.getContext();
  context.imageSmoothingEnabled = false;

  tileTextureOrder.forEach((textureKey, index) => {
    const sourceImage = scene.textures.get(textureKey).getSourceImage() as CanvasImageSource;
    context.drawImage(
      sourceImage,
      0,
      0,
      32,
      32,
      index * GENERATED_TILE_SIZE,
      0,
      GENERATED_TILE_SIZE,
      GENERATED_TILE_SIZE
    );
  });

  drawGeneratedSolidTile(context, 6, 0x4a5568);
  drawGeneratedSolidTile(context, 7, 0x3f9b57);
  drawGeneratedSolidTile(context, 8, 0xfacc15);
  drawGeneratedSolidTile(context, 9, 0x9ca3af);
  drawGeneratedSolidTile(context, 10, 0x166534);
  drawGeneratedSolidTile(context, 11, 0x92400e);
  drawGeneratedSolidTile(context, 12, 0x6b7280);
  drawGeneratedSolidTile(context, 13, 0x0ea5a4);

  canvasTexture.refresh();
}

function drawGeneratedSolidTile(
  context: CanvasRenderingContext2D,
  tileIndex: number,
  color: number
): void {
  const x = tileIndex * GENERATED_TILE_SIZE;
  const hex = `#${color.toString(16).padStart(6, '0')}`;
  context.fillStyle = hex;
  context.fillRect(x, 0, GENERATED_TILE_SIZE, GENERATED_TILE_SIZE);
}
