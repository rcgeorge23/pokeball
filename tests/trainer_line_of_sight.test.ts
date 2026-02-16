import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canTrainerSeeTarget,
  DEFAULT_TRAINER_SIGHT_OPTIONS,
} from '../src/world/trainer_line_of_sight.js';

test('trainer sees target directly ahead within distance', () => {
  const canSee = canTrainerSeeTarget(
    { x: 0, y: 0 },
    'right',
    { x: 100, y: 0 },
    () => false
  );

  assert.equal(canSee, true);
});

test('trainer does not see target outside facing cone', () => {
  const canSee = canTrainerSeeTarget(
    { x: 0, y: 0 },
    'right',
    { x: 0, y: 100 },
    () => false
  );

  assert.equal(canSee, false);
});

test('trainer does not see target behind wall', () => {
  const canSee = canTrainerSeeTarget(
    { x: 0, y: 0 },
    'right',
    { x: 100, y: 0 },
    (point) => point.x >= 48 && point.x <= 64 && point.y === 0,
    {
      ...DEFAULT_TRAINER_SIGHT_OPTIONS,
      sampleStep: 8,
    }
  );

  assert.equal(canSee, false);
});
