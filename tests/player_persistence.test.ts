import test from 'node:test';
import assert from 'node:assert/strict';

import { hydratePlayerState } from '../src/player/player_model.js';
import {
  loadPlayerState,
  savePlayerState,
  toPersistedPlayerState,
} from '../src/player/persistence.js';

class MemoryStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

test('toPersistedPlayerState keeps only deterministic world fields', () => {
  const fullState = hydratePlayerState({
    name: 'Player',
    party: ['emberfox'],
    pokedex: ['emberfox'],
    position: { x: 24, y: 32 },
    defeatedTrainerIds: ['trainer-1'],
    worldSeed: 'world-fixed',
    worldVersion: 2,
    partyCondition: [{ hpRatio: 0.2, status: 'burn' }],
    partyProgress: [{ level: 5, xp: 33 }],
  });

  assert.deepEqual(toPersistedPlayerState(fullState), {
    position: { x: 24, y: 32 },
    defeatedTrainerIds: ['trainer-1'],
    worldSeed: 'world-fixed',
    worldVersion: 2,
  });
});

test('savePlayerState/loadPlayerState round-trips only minimal persisted fields', () => {
  const localStorage = new MemoryStorage();
  Object.assign(globalThis, {
    window: { localStorage },
  });

  const fullState = hydratePlayerState({
    name: 'Player',
    party: ['leafling', 'emberfox'],
    pokedex: ['leafling'],
    position: { x: 120, y: 64 },
    defeatedTrainerIds: ['trainer-a', 'trainer-b'],
    worldSeed: 'world-seed-abc',
    worldVersion: 7,
    partyCondition: [{ hpRatio: 0.3 }, { hpRatio: 1, status: 'poison' }],
    partyProgress: [{ level: 3, xp: 11 }, { level: 6, xp: 90 }],
  });

  savePlayerState(fullState);

  const loadedState = loadPlayerState();

  assert.deepEqual(loadedState, {
    position: { x: 120, y: 64 },
    defeatedTrainerIds: ['trainer-a', 'trainer-b'],
    worldSeed: 'world-seed-abc',
    worldVersion: 7,
  });
});
