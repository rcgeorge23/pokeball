export type GroundTerrain = 'grass' | 'dirt';

export type GroundTileVariant =
  | 'grass_center'
  | 'grass_edge_n'
  | 'grass_edge_e'
  | 'grass_edge_s'
  | 'grass_edge_w'
  | 'dirt_center';

/**
 * Autotile convention: grass edge variants indicate where neighboring dirt is visible.
 * Priority when multiple dirt neighbors exist is stable and deterministic: N > E > S > W.
 */
export function buildGroundAutotileVariants(
  width: number,
  height: number,
  terrainByTile: GroundTerrain[]
): GroundTileVariant[] {
  const variants: GroundTileVariant[] = new Array(width * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const terrain = terrainByTile[index];

      if (terrain === 'dirt') {
        variants[index] = 'dirt_center';
        continue;
      }

      const northIsDirt = y > 0 && terrainByTile[(y - 1) * width + x] === 'dirt';
      const eastIsDirt = x < width - 1 && terrainByTile[y * width + (x + 1)] === 'dirt';
      const southIsDirt = y < height - 1 && terrainByTile[(y + 1) * width + x] === 'dirt';
      const westIsDirt = x > 0 && terrainByTile[y * width + (x - 1)] === 'dirt';

      if (northIsDirt) {
        variants[index] = 'grass_edge_n';
      } else if (eastIsDirt) {
        variants[index] = 'grass_edge_e';
      } else if (southIsDirt) {
        variants[index] = 'grass_edge_s';
      } else if (westIsDirt) {
        variants[index] = 'grass_edge_w';
      } else {
        variants[index] = 'grass_center';
      }
    }
  }

  return variants;
}
