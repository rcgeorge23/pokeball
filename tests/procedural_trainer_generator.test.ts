import test from 'node:test';
import assert from 'node:assert/strict';

import { TrainerDefinition } from '../src/world/npc_controller.js';
import { generateProceduralTrainerData } from '../src/world/procedural_trainer_generator.js';
import { DifficultyBand } from '../src/world/generated_map.js';

const trainerTemplates: TrainerDefinition[] = [
  {
    id: 'template-1',
    name: 'Template One',
    party: ['leafling', 'sparko'],
    behavior: 'wander',
    x: 0,
    y: 0,
  },
  {
    id: 'template-2',
    name: 'Template Two',
    party: ['emberfox', 'sparko'],
    behavior: 'stationary',
    x: 0,
    y: 0,
  },
];

test('generateProceduralTrainerData is deterministic for the same seed and trainer points', () => {
  const options = {
    worldSeed: 'trainer-seed-alpha',
    trainerTemplates,
    trainerPoints: [
      { x: 3, y: 3 },
      { x: 10, y: 10 },
      { x: 16, y: 16 },
    ],
    tileSize: 16,
    width: 32,
    difficultyBandByTile: Array.from({ length: 32 * 32 }, (_, index): DifficultyBand => {
      const x = index % 32;
      if (x < 10) {
        return 'early';
      }

      if (x < 20) {
        return 'mid';
      }

      return 'late';
    }),
  };

  const firstRun = generateProceduralTrainerData(options);
  const secondRun = generateProceduralTrainerData(options);

  assert.deepEqual(firstRun, secondRun);
});

test('generateProceduralTrainerData scales generated party size by zone difficulty', () => {
  const width = 32;
  const difficultyBandByTile: DifficultyBand[] = Array.from({ length: width * width }, () => 'mid');
  difficultyBandByTile[3 * width + 3] = 'early';
  difficultyBandByTile[11 * width + 11] = 'mid';
  difficultyBandByTile[20 * width + 20] = 'late';

  const generated = generateProceduralTrainerData({
    worldSeed: 'trainer-zone-scaling',
    trainerTemplates,
    trainerPoints: [
      { x: 3, y: 3 },
      { x: 11, y: 11 },
      { x: 20, y: 20 },
    ],
    tileSize: 16,
    width,
    difficultyBandByTile,
  });

  const [earlyTrainer, midTrainer, lateTrainer] = generated;
  assert.ok(earlyTrainer.party.length >= 1 && earlyTrainer.party.length <= 2);
  assert.ok(midTrainer.party.length >= 2 && midTrainer.party.length <= 3);
  assert.equal(lateTrainer.party.length, 3);

  for (const trainer of generated) {
    assert.equal(new Set(trainer.party).size, trainer.party.length);
  }
});

test('generateProceduralTrainerData produces stable trainer ids tied to seed and position', () => {
  const options = {
    worldSeed: 'stable-id-seed',
    trainerTemplates,
    trainerPoints: [
      { x: 8, y: 8 },
      { x: 12, y: 6 },
    ],
    tileSize: 16,
    width: 24,
    difficultyBandByTile: Array.from({ length: 24 * 24 }, (): DifficultyBand => 'mid'),
  };

  const generatedA = generateProceduralTrainerData(options);
  const generatedB = generateProceduralTrainerData(options);
  const generatedWithDifferentSeed = generateProceduralTrainerData({
    ...options,
    worldSeed: 'stable-id-seed-2',
  });

  assert.deepEqual(
    generatedA.map((trainer) => trainer.id),
    generatedB.map((trainer) => trainer.id)
  );
  assert.ok(
    JSON.stringify(generatedA.map((trainer) => trainer.id))
      !== JSON.stringify(generatedWithDifferentSeed.map((trainer) => trainer.id))
  );
});
