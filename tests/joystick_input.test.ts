import test from 'node:test';
import assert from 'node:assert/strict';

import {
  deriveJoystickDirection,
  directionFromLabel,
  normalizeAxis,
  readAxis,
} from '../src/world/joystick_input.js';

test('readAxis supports string values from JoyStick callback payloads', () => {
  assert.equal(readAxis({ x: '-43.5' }, 'x'), -43.5);
  assert.equal(readAxis({ positionY: '75' }, 'y', 'positionY'), 75);
});

test('normalizeAxis supports both percentage-like and unit-like values', () => {
  assert.equal(normalizeAxis(50), 0.5);
  assert.equal(normalizeAxis('0.25'), 0.25);
  assert.equal(normalizeAxis('-120'), -1);
});

test('deriveJoystickDirection converts axis values into movement vectors', () => {
  assert.deepEqual(deriveJoystickDirection({ x: '50', y: '-25' }), {
    x: 0.5,
    y: -0.25,
  });
});

test('deriveJoystickDirection falls back to directional labels and distance', () => {
  const result = deriveJoystickDirection({ direction: 'northwest', distance: 50 });
  assert.ok(result);
  if (!result) {
    throw new Error('Expected a direction result');
  }
  assert.ok(Math.abs(result.x - -0.3535) < 0.001);
  assert.ok(Math.abs(result.y - -0.3535) < 0.001);
});

test('deriveJoystickDirection returns null when stick is centered', () => {
  assert.equal(deriveJoystickDirection({ x: '0', y: '0' }), null);
});

test('directionFromLabel maps labels case-insensitively', () => {
  assert.deepEqual(directionFromLabel(' Right '), { x: 1, y: 0 });
});
