# Deterministic Procedural Map Plan (Codex Checklist)

This plan upgrades the current static world into a more interesting, deterministic, procedurally generated tilemap world that is reproducible from a seed and supports progression, trainer placement, and interactive points.

## How Codex should use this file
- Work top to bottom.
- When you complete an item, change `- [ ]` to `- [x]`.
- For every completed item, add a short trailing note with the PR/commit, e.g. `- [x] Add seeded RNG utility (PR #18)`.
- Keep items small enough to ship in focused PRs.

---

## Milestone 1: Determinism foundation (seeded generation)

### 1.1 Seeded RNG utility (single source of randomness)
- [x] Add a SeededRng utility with `nextFloat()`, `nextInt(min, maxInclusive)`, and `pick(array)`. (this PR)
- [x] Ensure no map generation logic uses `Math.random()` directly. (no map generation logic exists yet)
- [x] Add tests proving the same seed produces the same sequence. (this PR)

Done when: the RNG is deterministic and unit-tested.

### 1.2 Save/restore seed in player state
- [x] Extend player save state with:
  - [x] `worldSeed: string` (or number)
  - [x] `worldVersion: number` (for future migrations) (this commit)
- [x] On New Game: generate a seed and persist it. (this commit)
- [x] On Continue: always reuse the persisted seed. (this commit)
- [x] Add a debug overlay (optional) to show current seed. (this commit)

Done when: reloading recreates the exact same world from the saved seed.

---

## Milestone 2: Tilemap generation pipeline (replace authored map with generated map)

### 2.1 Define generated map data model
- [x] Introduce `GeneratedMap` structure: (this commit)
  - [x] `width`, `height` (in tiles) (this commit)
  - [x] `tiles: TileId[]` or 2D array (this commit)
  - [x] `collision: boolean[]` or collision layer info (this commit)
  - [x] `spawnPoints` (player start, trainers, heal point, signs) (this commit)
  - [x] `metadata` (biome ids, zones, difficulty bands) (this commit)
- [x] Decide tile scale and map size targets (e.g. 128x128 tiles). (this commit: default 128x128 tiles)

Done when: map generation produces a complete in-memory representation.

### 2.2 Render generated map in Phaser
- [x] Implement a simple renderer that converts `GeneratedMap` into a Phaser tile layer: (this commit)
  - [x] Choose a small tileset (even placeholder colored tiles is fine). (this commit)
  - [x] Create collision from generated collision data. (this commit)
  - [x] Update camera bounds to match generated world bounds. (this commit)

Done when: the world is generated and playable without any authored map.

### 2.3 Basic QA hooks for debugging
- [x] Add a “Regenerate (New Seed)” debug button available only in dev mode. (this commit)
- [ ] Add a “Copy seed” button (or log seed clearly) for bug reports.
- [ ] Add a “Show collision” debug toggle (visual overlay optional).

Done when: you can iterate on generation quickly and reproduce bugs via seed.

---

## Milestone 3: Interesting layout (path graph + regions)

Goal: a map that feels like it has structure (routes, loops, clearings), not pure noise.

### 3.1 Generate a high-level navigation graph
- [ ] Generate a set of key nodes:
  - [ ] `start`
  - [ ] `hub` (optional)
  - [ ] `bossGate` / `championArena` placeholder
  - [ ] several `encounterNodes` (clearings)
  - [ ] several `lootNodes` (future-proof)
- [ ] Connect nodes with a graph that guarantees:
  - [ ] at least one main path from start → end
  - [ ] at least one optional loop / shortcut
- [ ] Store this graph in map metadata for future use (quests, gating).

Done when: every map has a consistent “journey” structure.

### 3.2 Carve routes from the graph into tiles
- [ ] Carve walkable paths between connected nodes using a grid routing algorithm:
  - [ ] Keep it simple: Manhattan routing with controlled bends, or weighted routing that avoids water/rocks.
  - [ ] Widen paths occasionally (e.g. 2–3 tiles) to avoid “corridor” feel.
  - [ ] Add a few “clearings” (open areas) around nodes.

Done when: the player can traverse a recognizable route network.

### 3.3 Add boundaries and obstacles that make sense
- [ ] Fill non-walkable space with obstacle tiles (rocks/trees/walls).
- [ ] Add occasional obstacle clusters that shape movement (not random peppering).
- [ ] Ensure no enclosed unreachable areas unless intentionally marked as decoration.

Done when: the world feels shaped, and traversal choices exist.

---

## Milestone 4: Biomes and variation (still deterministic)

### 4.1 Biome assignment (simple, readable rules)
- [ ] Define 3–4 biomes (e.g. grass, forest, rocky, lake).
- [ ] Assign biomes by region using deterministic rules:
  - [ ] e.g. distance from start, or partition map into Voronoi-like regions using seeded points
- [ ] Ensure biome borders are blended (avoid harsh rectangles).

Done when: different areas look and feel distinct.

### 4.2 Biome decoration pass (visual interest)
- [ ] Add a decoration layer (non-colliding) for visual variety:
  - [ ] grass tufts, flowers, small rocks, etc.
- [ ] Ensure decoration placement is seeded and sparse enough to keep performance stable.
- [ ] Add at least one “landmark” tile cluster per biome (e.g. big tree, ruin).

Done when: the map has memorable visual features beyond paths.

---

## Milestone 5: Guaranteed playability constraints (no bad seeds)

This milestone prevents frustrating maps.

### 5.1 Connectivity validation
- [ ] After generation, run a flood-fill/BFS from player spawn over walkable tiles.
- [ ] Verify required points are reachable:
  - [ ] at minimum: at least N trainers, heal point, and end/champion arena placeholder
- [ ] If validation fails:
  - [ ] regenerate using the same seed + deterministic “attempt index”
  - [ ] cap attempts (e.g. 10) and log failures in dev mode

Done when: every seed yields a playable world.

### 5.2 Spawn safety and collision sanity
- [ ] Ensure player spawn is:
  - [ ] on a walkable tile
  - [ ] not adjacent to immediate unavoidable collision
- [ ] Ensure trainers don’t spawn overlapping walls or each other.
- [ ] Ensure minimum spacing between key points (avoid clutter).

Done when: spawns are always safe and sensible.

---

## Milestone 6: Content placement (trainers, heal points, signs)

### 6.1 Deterministic placement rules
- [ ] Define placement rules by zone:
  - [ ] early zone: easier trainers
  - [ ] mid zone: moderate trainers
  - [ ] late zone: hardest trainers
- [ ] Place:
  - [ ] 1 heal point near start (or hub)
  - [ ] multiple trainers along/near routes and clearings
  - [ ] a few signposts at forks/loops (basic text is fine)

Done when: the map supports progression and teaches navigation.

### 6.2 Procedural trainer roster generation (data-driven)
- [ ] Add a generator that creates trainer instances from templates:
  - [ ] name pool
  - [ ] party composition constraints
  - [ ] difficulty scaling by distance / zone
- [ ] Keep a stable trainer id derivation from seed + index so defeat persistence still works.
- [ ] Ensure rematch rules keep working across reloads.

Done when: trainers are varied, reproducible, and persistently defeatable.

---

## Milestone 7: Deterministic “points of interest” loop (makes exploration rewarding)

### 7.1 Add optional POIs that change the route choice
- [ ] Add at least 2 POI types:
  - [ ] shortcut gate (locked until N defeats, or always open but hidden behind loop)
  - [ ] scenic landmark (purely cosmetic + sign text)
- [ ] Place POIs along optional loop branches to reward exploration.

Done when: there’s a reason to wander beyond the main route.

### 7.2 Add lightweight gating for the “end”
- [ ] Place a “Champion Arena” area at the far end of the main path.
- [ ] Add a simple gate condition (e.g. defeat N trainers) before arena battle.
- [ ] Ensure the map generator always places enough trainers to satisfy the gate.

Done when: the procedural map supports a full run with a clear objective.

---

## Milestone 8: Persistence & versioning (future-proof)

### 8.1 Store only what you must
- [ ] Persist:
  - [ ] `worldSeed`
  - [ ] `worldVersion`
  - [ ] defeated trainers
  - [ ] player position
- [ ] Do not persist full tile arrays unless needed (regenerate from seed each boot).

Done when: save files stay small and stable.

### 8.2 World version migration behavior
- [ ] If `worldVersion` mismatches current generator version:
  - [ ] either regenerate with same seed using new version, or
  - [ ] start a new seed with a clear “world updated” message (pick one policy and stick to it)

Done when: generator can evolve without breaking saves unexpectedly.

---

## Milestone 9: Tests (map quality is not optional)

### 9.1 Determinism tests
- [ ] Same seed → same hash of key map outputs (e.g. tile counts, POI coords, trainer ids).
- [ ] Different seed → different outputs (with high probability).

Done when: determinism is provable and regressions are caught.

### 9.2 Playability tests
- [ ] Generated map always:
  - [ ] has a connected path start → end
  - [ ] has required POIs reachable
  - [ ] has at least N trainers reachable
- [ ] Validate generation completes under a time budget (basic performance guard).

Done when: “bad seeds” don’t ship and perf stays acceptable.

---

## Recommended execution order (best fun-per-effort)
1. Milestone 1 (seed + persistence)
2. Milestone 2 (generate + render)
3. Milestone 3 (graph + carving)
4. Milestone 5 (validation)
5. Milestone 6 (trainer/POI placement)
6. Milestone 4 (biomes + decoration)
7. Milestone 7 (POI loop + gating)
8. Milestone 8–9 (versioning + tests)

---

## Notes for Codex (guardrails)
- Keep generation layered (graph → carve paths → fill terrain → decorate → place entities → validate).
- Prefer simple, inspectable algorithms over heavy noise at first.
- Never ship a generator without connectivity validation.
- Make reproduction easy: always log/display the seed in dev mode.
