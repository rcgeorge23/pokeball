import test from 'node:test';
import assert from 'node:assert/strict';

import { buildGroundAutotileVariants, GroundTerrain } from '../src/world/tiles/autotile.js';

test('buildGroundAutotileVariants selects edges around a vertical dirt stripe', () => {
  const width = 5;
  const height = 5;
  const terrain: GroundTerrain[] = Array.from({ length: width * height }, () => 'grass');

  for (let y = 0; y < height; y += 1) {
    terrain[y * width + 2] = 'dirt';
  }

  const variants = buildGroundAutotileVariants(width, height, terrain);

  for (let y = 0; y < height; y += 1) {
    assert.equal(variants[y * width + 2], 'dirt_center');
    assert.equal(variants[y * width + 1], 'grass_edge_e');
    assert.equal(variants[y * width + 3], 'grass_edge_w');
  }

  assert.equal(variants[0], 'grass_center');
  assert.equal(variants[width * height - 1], 'grass_center');
});

test('buildGroundAutotileVariants is deterministic with stable directional priority', () => {
  const width = 3;
  const height = 3;
  const terrain: GroundTerrain[] = [
    'grass', 'dirt', 'grass',
    'dirt', 'grass', 'dirt',
    'grass', 'dirt', 'grass',
  ];

  const first = buildGroundAutotileVariants(width, height, terrain);
  const second = buildGroundAutotileVariants(width, height, terrain);

  assert.deepEqual(first, second);
  assert.equal(first[4], 'grass_edge_n');
});
