import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CURRENT_WORLD_VERSION,
  generateWorldSeed,
  getPlayerPartyCondition,
  getPlayerPartyProgress,
  getPlayerState,
  healPlayerParty,
  hydratePlayerState,
  regenerateWorldSeed,
  setPlayerPartyCondition,
} from '../src/player/player_model.js';

test('generateWorldSeed returns a prefixed non-empty seed', () => {
  const seed = generateWorldSeed();
  assert.ok(seed.startsWith('world-'));
  assert.ok(seed.length > 'world-'.length);
});

test('hydratePlayerState generates world seed and version for a new game', () => {
  const state = hydratePlayerState(null);

  assert.equal(state.worldVersion, CURRENT_WORLD_VERSION);
  assert.ok(state.worldSeed.startsWith('world-'));
});

test('hydratePlayerState keeps existing world seed and version on continue', () => {
  const state = hydratePlayerState({
    name: 'Player',
    party: ['emberfox'],
    pokedex: ['emberfox'],
    position: { x: 1, y: 2 },
    defeatedTrainerIds: ['trainer-1'],
    worldSeed: 'world-fixed-seed',
    worldVersion: 3,
  });

  assert.equal(state.worldSeed, 'world-fixed-seed');
  assert.equal(state.worldVersion, 3);
});

test('hydratePlayerState backfills world metadata for legacy saves', () => {
  const state = hydratePlayerState({
    name: 'Legacy',
    party: ['leafling'],
    pokedex: ['leafling'],
    position: { x: 4, y: 8 },
    defeatedTrainerIds: [],
  });

  assert.equal(state.worldVersion, CURRENT_WORLD_VERSION);
  assert.ok(state.worldSeed.startsWith('world-'));
  assert.deepEqual(state.partyCondition, [{ hpRatio: 1 }]);
});



test('hydratePlayerState backfills partyProgress for legacy saves', () => {
  const state = hydratePlayerState({
    name: 'Legacy',
    party: ['leafling', 'emberfox'],
    pokedex: ['leafling'],
    position: { x: 4, y: 8 },
    defeatedTrainerIds: [],
  });

  assert.deepEqual(state.partyProgress, [
    { level: 1, xp: 0 },
    { level: 1, xp: 0 },
  ]);
});

test('regenerateWorldSeed updates the current state with a new seed', () => {
  const initialSeed = getPlayerState().worldSeed;

  const nextSeed = regenerateWorldSeed();

  assert.equal(getPlayerState().worldSeed, nextSeed);
  assert.equal(getPlayerState().worldVersion, CURRENT_WORLD_VERSION);
  assert.ok(nextSeed !== initialSeed);
});

test('setPlayerPartyCondition persists and healPlayerParty restores full HP and status', () => {
  setPlayerPartyCondition([
    { hpRatio: 0.4, status: 'burn' },
    { hpRatio: 0.05, status: 'poison' },
  ]);

  assert.deepEqual(getPlayerPartyCondition(), [
    { hpRatio: 0.4, status: 'burn' },
    { hpRatio: 0.05, status: 'poison' },
  ]);

  healPlayerParty();

  assert.deepEqual(getPlayerPartyCondition(), [{ hpRatio: 1 }, { hpRatio: 1 }]);
  assert.deepEqual(getPlayerPartyProgress(), [
    { level: 1, xp: 0 },
    { level: 1, xp: 0 },
  ]);
});
