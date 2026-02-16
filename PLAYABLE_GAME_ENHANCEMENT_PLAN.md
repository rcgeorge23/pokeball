# Playable Game Enhancement Plan (Codex Checklist)

This plan upgrades the current prototype into a more enjoyable, replayable, “game-feeling” experience. It is designed for Codex to execute step-by-step.

## How Codex should use this file
- [ ] Work top to bottom.
- [ ] When you complete an item, change - [ ] to - [x].
- [ ] For every completed item, add a short trailing note with the PR/commit, e.g. - [x] Add speed-based turn order (PR #12).
- [ ] Keep items small enough to ship in focused PRs.

---

## Milestone 1: Battles feel fun (juice + strategy)

### 1.1 Turn order & turn clarity
- [x] Implement speed-based turn order (higher speed acts first; ties random). (commit 8870b6f)
- [x] Display a clear “Turn order” log line: Leafling moves first! (commit b3947e8)
- [x] Add a per-turn state lock so input cannot be spammed during resolution. (commit b3947e8)

Done when: speed affects who goes first and it’s visible in logs.

### 1.2 Accuracy, crits, and “gamey” feedback
- [x] Extend move schema to include: (PR: add move accuracy/crit schema defaults)
  - [x] accuracy (0–1, default 1)
  - [x] critChance (0–1, default e.g. 0.1)
  - [x] critMultiplier (default e.g. 1.5)
- [x] Apply miss chance and log “It missed!” (commit ac2308d)
- [x] Apply critical hits and log “Critical hit!” (commit 16c579f)
- [x] Add small camera shake on crit (use Phaser Camera Shake). (PR pending)

Done when: misses/criticals happen and are clearly communicated.

### 1.3 Battle “juice” (animations without new art)
- [x] Tween HP bar changes instead of instant jumps. (PR pending)
- [x] Add attacker “lunge” tween + defender “hit flash” tween. (PR: add battle lunge/flash tweens)
- [x] Add a short sprite shake on hit (or camera shake on big hits). (commit 0036827)
- [x] Add simple sound hooks (stubbed functions is fine if assets not ready): playSfx("hit"), playSfx("faint"). (PR: add battle SFX hooks)

Done when: battles visibly animate and feel responsive.

### 1.4 Improve AI (from random to reasonable)
- [x] Replace random move selection with expected damage maximization (consider accuracy). (PR pending)
- [x] Add a small randomness factor so AI isn’t perfectly deterministic (e.g. 10% chance pick 2nd best). (commit 8870b6f)
- [x] Log AI choice only in debug mode (toggle). (commit a7a6983)

Done when: AI uses better moves most of the time.

---

## Milestone 2: Depth without complexity explosion (types + statuses “lite”)

### 2.1 Add a minimal type system (3–4 types)
- [x] Extend Pokémon definitions with types: string[] (start with 1 type each). (commit f85350c)
- [x] Extend move definitions with type: string. (PR: add move type field)
- [x] Add a small type chart (start with Fire/Grass/Electric/Normal). (commit in this PR)
- [x] Apply type multiplier to damage and log: (commit in this PR)
  - [x] “It’s super effective!”
  - [x] “It’s not very effective…”

Done when: types matter, but implementation stays small.

### 2.2 One simple status effect (optional but impactful)

Pick one:
- [x] Burn: -attack (or damage over time). (commit a7a6983)
- [x] Poison: damage over time (commit 0d02bab)
- [x] Paralyze: speed reduction + small chance to skip turn (commit in this commit)
- [x] Extend moves with optional statusInflict field. (commit a7a6983)
- [x] Implement status application + end-of-turn tick if relevant. (commit a7a6983)
- [x] Add status icon/text in status panel. (commit a7a6983)

Done when: at least one status exists end-to-end and is readable.

---

## Milestone 3: The world feels like a real place (tilemap + trainer behaviors)

### 3.1 Move from rectangles to a tilemap world
- [x] Add a basic Tiled map (single “town route” layout). (commit e438747)
- [x] Load tilemap JSON + tileset in PreloadScene. (commit 12b96c8)
- [x] Replace manual obstacles with tile collision layer. (commit d5b6688)
- [x] Prefer “collision from collision data” / collision group approach. (commit in this commit)
- [x] Ensure camera bounds match map bounds. (commit in this commit)

Done when: collisions come from the tilemap, not hard-coded rectangles.

### 3.2 Trainer line-of-sight battles (classic feel)
- [x] Give trainers facing direction (for stationary and wander). (commit in this PR)
- [x] Implement LOS cone/ray check. (commit a73263a)
- [ ] If player enters LOS:
  - [ ] trainer notices (exclamation marker)
  - [ ] trainer walks toward player
  - [ ] battle auto-starts
- [ ] Keep “Press E” as fallback interaction option.

Done when: you can trigger battles by walking into a trainer’s sightline.

### 3.3 Add world “comfort” interactions
- [ ] Add a healing point (simple interactable tile/object):
  - [ ] restores player party HP
  - [ ] shows “Your team is fully healed!”
- [ ] Add basic signposts/dialogue bubbles (static text is fine).

Done when: the world has at least 2 interactive non-battle objects.

---

## Milestone 4: Progression loop (why keep playing?)

### 4.1 Leveling and XP (simple progression)
- [ ] Add Pokémon fields: level, xp.
- [ ] Add xpYield to Pokémon definitions (or derived from stats).
- [ ] Award XP on battle win (and partial on loss, optional).
- [ ] On level up:
  - [ ] increase stats by small increments
  - [ ] heal a little or not (your choice, but be consistent)
  - [ ] Show “Level Up!” in battle log and in post-battle summary.

Done when: Pokémon grow stronger and it’s visible.

### 4.2 Trainer difficulty curve
- [ ] Add trainer “tier” or “difficulty” field.
- [ ] Scale trainer parties (levels, move variety) based on tier.
- [ ] Add at least 6–10 trainers total across the map.

Done when: later trainers are meaningfully harder.

### 4.3 Make the Pokédex rewarding
- [ ] Expand Pokédex UI to show per-entry:
  - [ ] name
  - [ ] types
  - [ ] level (if owned)
  - [ ] a short description (optional)
- [ ] Add “Seen” vs “Owned” states (even if only Owned used now).

Done when: the Pokédex feels like a collection UI, not just a list.

---

## Milestone 5: Game structure & polish (finishable, restartable)

### 5.1 Title screen + new game/continue
- [ ] Add TitleScene with:
  - [ ] Continue (only if save exists)
  - [ ] New Game (clears save after confirmation)
- [ ] Add a tiny “Controls” panel (keyboard + joystick).
- [ ] Ensure scene transitions use explicit data passing.

Done when: the game has a proper entry flow.

### 5.2 A clear goal: “Beat the Champion”
- [ ] Add a final trainer (“Champion”) with a stronger team.
- [ ] Gate Champion behind defeating N trainers (e.g. 6).
- [ ] On Champion defeat:
  - [ ] show a simple credits / win screen
  - [ ] optionally allow New Game+

Done when: the game can be “completed”.

### 5.3 Audio and feel
- [ ] Add 3–5 SFX (hit, faint, win, lose, interact).
- [ ] Add looping world music + battle music (placeholder acceptable).
- [ ] Add settings toggles (mute music, mute SFX) saved in localStorage.

Done when: game feels alive even with placeholder art.

---

## Milestone 6: Code health & tests (keep it maintainable)

### 6.1 Extract pure battle logic for testing
- [ ] Move damage / accuracy / crit / type calculations into pure functions.
- [ ] Add tests for:
  - [ ] speed order
  - [ ] accuracy miss
  - [ ] crit multiplier
  - [ ] type effectiveness
  - [ ] reward rules (first-time vs rematch)
- [ ] Add a deterministic RNG option for tests (seeded or injectable).

Done when: battle rules are well-covered by tests (not just joystick parsing).

### 6.2 Data validation
- [ ] Validate JSON content on load:
  - [ ] missing move IDs referenced by Pokémon
  - [ ] missing Pokémon IDs referenced by trainers
  - [ ] invalid type names
- [ ] Fail fast with clear console errors.

Done when: bad data fails loudly and quickly.

---

## Recommended execution order (if you want maximum “fun” fastest)
1. [ ] Milestone 1 (Battles feel fun)
2. [ ] Milestone 3 (Tilemap + LOS trainers)
3. [ ] Milestone 4 (XP/levels + more trainers)
4. [ ] Milestone 5 (Title + Champion + polish)
5. [ ] Milestone 6 (tests + validation)
6. [ ] Milestone 2 (types/statuses) can be started earlier if desired, but keep it minimal.

---

## Notes for Codex (guardrails)
- [ ] Keep features data-driven (prefer adding fields to moves.json, pokemon.json, trainers.json).
- [ ] Prefer small PRs (one sub-section at a time).
- [ ] Avoid adding complex mechanics until Milestone 1 and 3 are complete.
