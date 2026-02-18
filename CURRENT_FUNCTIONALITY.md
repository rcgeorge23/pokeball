# Current Game Functionality (Detailed Implementation Summary)

This document captures the *currently implemented* behavior of the game so it can be used as planning input for the next iteration.

---

## 1) High-level product shape

- Browser-based Phaser 3 game with two primary runtime loops:
  - **World exploration** (movement, interaction, trainer encounters, map systems).
  - **Turn-based battles** (move selection, status effects, AI, XP/reward flow).
- Core architecture is scene-driven:
  1. `BootScene`
  2. `PreloadScene`
  3. `WorldScene`
  4. `BattleScene`

---

## 2) Runtime, rendering, input, and startup behavior

### Engine/runtime configuration

- Phaser is configured with:
  - `800x600` base canvas.
  - Arcade physics (`gravity: 0`, `debug: false`).
  - Up to 3 active pointers for touch/input support.
  - Scene order: Boot → Preload → World → Battle.
- Scale mode uses `FIT` and centers the game both horizontally and vertically.

### Startup sequence

1. **BootScene**
   - Initializes player state from persistence/hydration.
   - Applies scaling and background defaults.
   - Starts preload.
2. **PreloadScene**
   - Loads core assets (player/trainer SVG sprites, map JSON/tiles image, trainer/pokemon/move data JSON).
   - Starts world scene.

### DOM/UI shell and controls scaffold

- `index.html` provides fixed-position controls used by scenes:
  - Touch joystick container.
  - Battle button (primarily touch UX).
  - Pokédex open/close panel.
  - Re-center camera button.
  - Dev/debug buttons (regenerate seed, copy seed, collision toggle).
- Touch scrolling/gesture interference is suppressed using `touch-action: none`.

---

## 3) Player state model and persistence

### State model tracked in memory

Current player model tracks:

- Identity and party references (`name`, `party`).
- Pokédex IDs (`pokedex`).
- World position (`x`, `y`).
- Defeated trainer IDs.
- Procedural world identity (`worldSeed`, `worldVersion`).
- Party condition snapshots (`hpRatio`, optional status).
- Party progression snapshots (`level`, `xp`).

### Initial default state

- Default trainer name: `You`.
- Starter party: `emberfox`, `leafling`.
- Initial Pokédex prefilled with those starters.
- Initial position: `(400, 300)`.
- New procedural seed generated at profile creation.

### Hydration and sanitization behavior

- Load path applies strict shape normalization:
  - Non-array or invalid lists are replaced with defaults.
  - Invalid status values are dropped.
  - Levels/xp are clamped and normalized.
  - Missing/invalid `worldSeed` regenerates seed.
  - `worldVersion` is forced to current version.

### Important persistence limitation (current behavior)

- The localStorage persistence layer intentionally stores only:
  - `position`
  - `defeatedTrainerIds`
  - `worldSeed`
  - `worldVersion`
- It does **not** persist full player model fields (e.g., pokedex, party condition, party progress) across browser reload in the save payload.
- Save key: `pokemon-battler-save`.

---

## 4) Procedural world generation and map systems

### Core generation profile

- World map is generated from seed each run via `generateMapFromSeed`.
- Default map dimensions are large (`160x160` tiles).
- Generation retries up to a capped attempt count when playability validation fails.

### Guaranteed/validated playability constraints

Generation includes validation to ensure:

- Spawn tile is not blocked and has usable neighboring space.
- Heal point is reachable from spawn.
- Champion arena node exists and is reachable.
- Key points (spawn/heal/trainers/signs/POIs) obey minimum spacing.
- Minimum reachable trainer threshold is satisfied (tied to champion gate requirement).

### Navigation and authored procedural structure

- Map assembly includes systems for:
  - Navigation graph creation (start/hub/boss-gate/champion/encounter/loot node types).
  - Route and corridor carving.
  - Obstacle clustering/smoothing.
  - Building placement and champion arena shaping.
  - Reconnection pass for unreachable navigation nodes.
  - Single-region reachability cleanup.

### Difficulty zoning

- Each tile is assigned a difficulty band (`early`, `mid`, `late`) based on distance from spawn.
- Trainer placement and trainer party synthesis draw from this banding.

### Biomes/decor

- Tiles are annotated with biome metadata (`grassland`, `forest`, `rocky`, `lake`).
- Decoration layers are generated (tufts, flowers, rocks, trees, ruins, etc.).
- Biome landmarks are placed for flavor/world readability.

### Spawned interactive points

Generated spawn data includes:

- Player start.
- Heal point.
- Trainers.
- Sign posts.
- Points of interest:
  - Shortcut gate landmark.
  - Scenic landmark.

### Map rendering pipeline

- Procedural map is rendered through a generated Phaser tilemap.
- Layers:
  - Ground layer.
  - Decoration layer.
  - Collision layer.
- Collision layer is used for physics and hidden by default (can be toggled in dev mode).
- Tileset texture is procedurally generated at runtime from handcrafted SVG sources for grass/dirt + edge transitions, then packed into a Phaser atlas with deterministic grass↔dirt autotiling (priority N > E > S > W).

---

## 5) World exploration gameplay

### Player movement and controls

- Supported input paths:
  - Keyboard arrows.
  - `WASD`.
  - On-screen joystick (JoyStick library script in page).
- Input vectors are accumulated and normalized for consistent diagonal speed.
- Movement speed is fixed at runtime constant in world scene.

### Touch joystick parsing robustness

- Joystick direction parser supports:
  - Multiple shape/key aliases for axis fields.
  - Numeric/string values.
  - Direction-word fallback handling.
- Touch direction state is attached and cleaned on scene shutdown.

### Camera and minimap systems

- Main camera follows player by default and is bounded to world.
- Touch drag on map can temporarily detach camera follow and pan view.
- Re-center UI button appears when camera drifts away from player.
- Minimap UI shows:
  - Total map bounds.
  - Player dot position.
  - Current camera viewport rectangle.

### Environmental interaction systems

- **Heal point:**
  - If player stands still on heal tile long enough, party is healed.
  - Heal has cooldown and displays world message feedback.
- **Signposts:**
  - Nearby hint prompts interaction.
  - Pressing interact displays short dialogue bubble message.
- **Points of interest:**
  - Nearby hint prompts interaction.
  - Pressing interact displays POI title + description bubble.
- **Champion arena marker:**
  - Visible special marker and gating hint messaging.

### Champion gate progression

- Champion challenge is blocked until player defeats required generated trainer count (`6`).
- Arena interaction messaging reflects:
  - Progress toward unlock.
  - Unlock state.
  - Rematch state when champion already defeated.
- Champion opponent is procedurally generated from world seed with:
  - Seeded champion name choice.
  - Up to 3 unique species sampled from loaded pokémon list (with fallback set).

---

## 6) Trainer/NPC systems in world

### Trainer instantiation

- Trainers are procedurally instantiated at generated trainer spawn points.
- Base templates come from `trainers.json`, but runtime trainer instances are regenerated per world seed and spawn location.
- Generated trainer identity uses stable hashed IDs tied to seed/index/location.

### Behavior and facing

- Trainer behavior types:
  - `wander`
  - `stationary`
- Wanderers periodically choose random cardinal or idle vectors.
- Trainers carry/update facing direction (used by LOS detection).

### Defeat-state visuals

- Defeated trainers are tinted and receive visible `Defeated` status label.

### Proximity and interaction

- Nearby trainer within radius enables hint text and battle interaction.
- Keyboard interaction key is `E`.
- Touch battle button appears contextually when applicable.

### Line-of-sight encounter system

- Trainers can auto-engage player if:
  - Player is within LOS max distance.
  - Player is within trainer forward cone (dot threshold).
  - Collision layer does not block sampled LOS ray.
  - Trainer is undefeated.
- Encounter sequence:
  - Exclamation notice above trainer.
  - Scripted approach movement toward player.
  - Auto battle start after approach completes.

### Post-battle encounter grace

- On returning from battle, there is a temporary grace window to avoid immediate re-trigger.
- Scene also temporarily suppresses the recently battled trainer until player moves sufficiently far away.

---

## 7) Battle systems and turn resolution

### Battle setup

- Battle scene receives `player` and `opponent` payloads from world.
- Pokémon and move definitions are indexed from JSON cache.
- Runtime party instances are built from definitions.
- Persisted in-memory condition/progress are applied to player party at battle start.

### UI layout and battle affordances

- Battle UI includes:
  - Opponent title header.
  - Sprite avatars (generated from SVG by pokémon data).
  - HP bars + HP text.
  - Status text (Healthy/Burned/Poisoned/Paralyzed).
  - Move buttons based on current active player pokemon moves.
  - Exit Battle button.

### Turn order and action model

- On player move selection:
  - Opponent move chosen by expected-damage AI (with configurable second-best randomness).
  - First actor determined by effective speed.
  - Paralysis reduces effective speed.
  - Speed ties are randomized.

### Move hit/damage/status details

- Accuracy, crit chance, and crit multiplier are supported per move.
- Type chart currently defined for Fire/Grass/Electric/Normal interactions.
- Damage formula includes:
  - Move power.
  - Attack-defense delta.
  - Burn attack penalty for burned attackers.
  - Type multiplier.
  - Crit multiplier when crit occurs.
  - Global battle-side assist multiplier (dynamic rubber-banding by defeated trainer count).
- Status inflictions supported:
  - Burn
  - Poison
  - Paralyze
- Status side-effects:
  - Burn lowers attacker damage output.
  - Paralyze can prevent action (chance-based) and reduces effective speed.
  - Poison ticks at end of turn for % max HP.

### AI behavior

- Opponent AI ranks moves by expected damage (`damage * accuracy`).
- AI can intentionally choose second-best move sometimes for variety.
- Second-best choice chance scales with player average level (more forgiving early).
- Optional AI debug logging can be enabled via query param/localStorage (`debugAiChoice`).

### Mid-battle progression

- If active pokemon faints and side has reserves, next pokemon auto-sends out.
- HP bars animate when values change.
- Basic attack/hit/crit visual feedback exists (lunges, flashes, shake effects).

### Battle end states

- End result can be win or loss.
- On both outcomes, party is healed before returning to world.
- Continue button returns to world; includes recent trainer ID for encounter suppression.
- Exit Battle button allows leaving early (non-resolving state only), heals party, and returns to world.

---

## 8) Rewards, progression, and difficulty assist

### Victory rewards

On win:

- XP is awarded to all player party members based on opponent total `xpYield` split across party.
- Level-up processing applies stat gains:
  - HP, attack, defense, speed increase per level.
  - Partial heal on level-up.
- Progress snapshot is written back to player model (`partyProgress`).

### Pokédex reward rule

- First-time trainer defeat awards opponent lead pokemon to pokédex.
- Rematch wins do not re-award this pokédex unlock.

### Trainer defeat tracking

- First victory against a trainer marks trainer as defeated in player model.
- Defeated list drives world tint/status and champion-gate progression.

### Dynamic battle assist curve

- Early progression favors player damage output and nerfs opponent output.
- As defeated trainer count rises, multipliers converge toward neutral values.

---

## 9) Pokédex UX

- Floating `Open Pokédex` button available in world.
- Panel displays discovered entries by mapped pokemon name.
- Empty state: `No Pokémon discovered yet.`
- Panel supports close interaction and ARIA hidden-state toggling.

---

## 10) Development and debug affordances

(Visible in dev builds where enabled.)

- **Regenerate map button:** creates new world seed and restarts world at new spawn.
- **Copy seed button:** copies seed to clipboard (or logs to console fallback).
- **Collision toggle button:** reveals/hides collision layer overlay for debugging map traversal.
- **Seed/version display:** current seed and world version shown in world HUD during dev.

---

## 11) Data currently shipped

### Pokémon roster (9)

- emberfox
- leafling
- sparko
- tidemunk
- bouldercub
- gustwing
- shadepup
- frostkit
- petaloon

### Moves (5)

- tackle
- ember (burn chance)
- leaf_blade
- spark (paralyze chance)
- venom_jab (poison chance)

### Trainer templates (3)

- Ava
- Rowan
- Kai

These template entries provide seed material for procedural trainer generation and party species derivation by difficulty band.

---

## 12) Automated checks that define/guard current behavior

Current test suite covers core systems including:

- Seeded RNG determinism.
- Generated map determinism/playability/performance sampling.
- Trainer LOS logic.
- Procedural trainer generation determinism and constraints.
- Battle model mechanics (accuracy/crit/type/status/speed/AI move selection/assist multiplier).
- Reward logic and XP leveling.
- Player model hydration/sanitization and persistence field constraints.
- Joystick input parsing behavior.

