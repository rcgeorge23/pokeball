import Phaser from 'phaser';

import { DecorationId, GeneratedMap, TileId } from './generated_map.js';

const GENERATED_TILESET_KEY = 'generated-map-tileset';
const GENERATED_TILE_SIZE = 16;

const TILE_INDEX_BY_ID: Record<TileId, number> = {
  grass: 0,
  obstacle: 1,
};

const DECORATION_TILE_INDEX_BY_ID: Record<DecorationId, number> = {
  grassTuft: 2,
  flower: 3,
  smallRock: 4,
  bigTree: 5,
  ruin: 6,
  stoneRing: 7,
  reedCluster: 8,
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

  const tileRows = toTileRows(generatedMap);
  const decorationRows = toDecorationRows(generatedMap);
  const groundLayer = tilemap.createBlankLayer('Ground', mapTileset, 0, 0);
  const decorationLayer = tilemap.createBlankLayer('Decoration', mapTileset, 0, 0);
  const collisionLayer = tilemap.createBlankLayer('Collision', mapTileset, 0, 0);

  if (!groundLayer || !collisionLayer || !decorationLayer) {
    throw new Error('Unable to create generated map tile layers.');
  }

  groundLayer.putTilesAt(tileRows, 0, 0);
  decorationLayer.putTilesAt(decorationRows, 0, 0);

  collisionLayer.putTilesAt(tileRows, 0, 0);
  collisionLayer.setVisible(false);
  collisionLayer.setCollision(TILE_INDEX_BY_ID.obstacle);

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

function toTileRows(generatedMap: GeneratedMap): number[][] {
  const rows: number[][] = [];

  for (let y = 0; y < generatedMap.height; y += 1) {
    const row: number[] = [];
    for (let x = 0; x < generatedMap.width; x += 1) {
      const index = y * generatedMap.width + x;
      if (generatedMap.collision[index]) {
        row.push(TILE_INDEX_BY_ID.obstacle);
        continue;
      }

      row.push(TILE_INDEX_BY_ID[generatedMap.tiles[index]]);
    }

    rows.push(row);
  }

  return rows;
}

function ensureGeneratedTilesetTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(GENERATED_TILESET_KEY)) {
    return;
  }

  const graphics = scene.add.graphics();
  graphics.setVisible(false);

  graphics.fillStyle(0x2f855a, 1);
  graphics.fillRect(0, 0, GENERATED_TILE_SIZE, GENERATED_TILE_SIZE);

  graphics.fillStyle(0x4a5568, 1);
  graphics.fillRect(
    GENERATED_TILE_SIZE,
    0,
    GENERATED_TILE_SIZE,
    GENERATED_TILE_SIZE
  );

  graphics.fillStyle(0x3f9b57, 1);
  graphics.fillRect(GENERATED_TILE_SIZE * 2, 0, GENERATED_TILE_SIZE, GENERATED_TILE_SIZE);

  graphics.fillStyle(0xfacc15, 1);
  graphics.fillRect(GENERATED_TILE_SIZE * 3, 0, GENERATED_TILE_SIZE, GENERATED_TILE_SIZE);

  graphics.fillStyle(0x9ca3af, 1);
  graphics.fillRect(GENERATED_TILE_SIZE * 4, 0, GENERATED_TILE_SIZE, GENERATED_TILE_SIZE);

  graphics.fillStyle(0x166534, 1);
  graphics.fillRect(GENERATED_TILE_SIZE * 5, 0, GENERATED_TILE_SIZE, GENERATED_TILE_SIZE);

  graphics.fillStyle(0x92400e, 1);
  graphics.fillRect(GENERATED_TILE_SIZE * 6, 0, GENERATED_TILE_SIZE, GENERATED_TILE_SIZE);

  graphics.fillStyle(0x6b7280, 1);
  graphics.fillRect(GENERATED_TILE_SIZE * 7, 0, GENERATED_TILE_SIZE, GENERATED_TILE_SIZE);

  graphics.fillStyle(0x0ea5a4, 1);
  graphics.fillRect(GENERATED_TILE_SIZE * 8, 0, GENERATED_TILE_SIZE, GENERATED_TILE_SIZE);

  graphics.generateTexture(
    GENERATED_TILESET_KEY,
    GENERATED_TILE_SIZE * 9,
    GENERATED_TILE_SIZE
  );
  graphics.destroy();
}
