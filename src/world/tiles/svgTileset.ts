import Phaser from 'phaser';

import dirtCenterSvg from '../../assets/tiles/svg/dirt_center.svg?raw';
import grassCenterSvg from '../../assets/tiles/svg/grass_center.svg?raw';
import grassEdgeESvg from '../../assets/tiles/svg/grass_edge_e.svg?raw';
import grassEdgeNSvg from '../../assets/tiles/svg/grass_edge_n.svg?raw';
import grassEdgeSSvg from '../../assets/tiles/svg/grass_edge_s.svg?raw';
import grassEdgeWSvg from '../../assets/tiles/svg/grass_edge_w.svg?raw';

export const SVG_TILE_TEXTURE_KEY_BY_VARIANT = {
  grass_center: 'tile_grass_center',
  dirt_center: 'tile_dirt_center',
  grass_edge_n: 'tile_grass_edge_n',
  grass_edge_e: 'tile_grass_edge_e',
  grass_edge_s: 'tile_grass_edge_s',
  grass_edge_w: 'tile_grass_edge_w',
} as const;

const SVG_TILE_SOURCE_BY_KEY: Record<string, string> = {
  [SVG_TILE_TEXTURE_KEY_BY_VARIANT.grass_center]: grassCenterSvg,
  [SVG_TILE_TEXTURE_KEY_BY_VARIANT.dirt_center]: dirtCenterSvg,
  [SVG_TILE_TEXTURE_KEY_BY_VARIANT.grass_edge_n]: grassEdgeNSvg,
  [SVG_TILE_TEXTURE_KEY_BY_VARIANT.grass_edge_e]: grassEdgeESvg,
  [SVG_TILE_TEXTURE_KEY_BY_VARIANT.grass_edge_s]: grassEdgeSSvg,
  [SVG_TILE_TEXTURE_KEY_BY_VARIANT.grass_edge_w]: grassEdgeWSvg,
};

export function enqueueSvgTileset(scene: Phaser.Scene): void {
  for (const [textureKey, svg] of Object.entries(SVG_TILE_SOURCE_BY_KEY)) {
    if (scene.textures.exists(textureKey)) {
      continue;
    }

    scene.load.image(textureKey, toBase64SvgDataUrl(svg));
  }
}

function toBase64SvgDataUrl(svgText: string): string {
  const bytes = new TextEncoder().encode(svgText);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return `data:image/svg+xml;base64,${btoa(binary)}`;
}
