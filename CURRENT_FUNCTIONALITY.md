# Current Functionality Overview

This document describes the current, implemented behavior of the project as it exists today.

## Product Summary

The app is a browser-only, Phaser 3-based top-down trainer battler prototype. The player explores a simple world, approaches NPC trainers, starts turn-based battles, and earns Pokédex entries by defeating trainers for the first time.

## Runtime & Tooling

- **Framework/runtime:** Phaser 3 with Arcade physics.
- **Language:** TypeScript.
- **Build/dev server:** Vite.
- **Persistence:** `localStorage` under key `pokemon-battler-save`.
- **Tests:** Node built-in test runner + TypeScript compile step for joystick input utilities.

## Boot and Scene Flow

The game initializes with the following scene order:

1. **BootScene**
   - Initializes player state from persistence.
   - Configures responsive scaling (`FIT`) and centering.
   - Sets camera background color.
   - Transitions to preload.

2. **PreloadScene**
   - Loads a placeholder player image (base64).
   - Loads JSON data for trainers, Pokémon, and moves.
   - Transitions to world.

3. **WorldScene**
   - Main exploration loop.
   - Handles world movement, collisions, NPC behavior, proximity interactions, and UI overlays.

4. **BattleScene**
   - Turn-based combat and reward flow.
   - Returns back to world after result.

## Game Configuration

- Canvas defaults to **800x600**, auto renderer selection (`Phaser.AUTO`), dark background.
- Arcade physics has no gravity and no debug visuals.
- Multi-touch input is enabled (`activePointers: 3`).
- Browser touch scrolling is suppressed through CSS (`touch-action: none`).

## World Exploration Functionality

### World Layout

- World size is currently 2x the visible viewport in both axes.
- Three rectangular obstacle walls are created as static physics objects.
- Player and NPCs collide with walls and world bounds.
- Camera follows the player and is clamped to world bounds.

### Player Movement

Supported input methods:

- Keyboard arrows
- `W`, `A`, `S`, `D`
- On-screen joystick (via external JoyStick script)

Movement behavior:

- Inputs are combined into a vector.
- Vector is normalized when magnitude exceeds 1 to keep diagonal speed consistent.
- Final movement uses a fixed speed scalar.

### Touch Controls

- A joystick container in DOM is populated when WorldScene starts.
- Joystick callback data is converted into movement vectors via utility parsing that supports:
  - Numeric and string axis values.
  - Multiple key aliases (`x`, `X`, `posX`, `positionX`, etc.).
  - Direction-label fallback (`north`, `se`, `left`, etc.) with optional distance scalar.
- On scene shutdown, joystick UI is hidden and listeners/state are cleaned up.

### NPC Trainers in World

- Trainers spawn from `src/data/trainers.json`.
- Each trainer has:
  - `id`
  - `name`
  - `party` (Pokémon IDs)
  - `behavior` (`wander` or `stationary`)
  - world `x/y`
- Wander behavior picks random cardinal/idle directions on periodic delays.
- Defeated trainers are tinted and display a `Defeated` status label.

### Trainer Interaction

- Nearby trainer detection is based on distance radius from player.
- If a trainer is nearby:
  - Keyboard hint appears (`Press E to battle...` or rematch message if defeated).
  - On touch devices, a `Battle <Name>` button is shown.
- Battles can be initiated by:
  - Pressing `E` when near a trainer.
  - Tapping the battle button on touch devices.

### Pokédex UI (World Overlay)

- A persistent `Open Pokédex` button is available in the DOM.
- Clicking opens an overlay panel with current Pokédex entries.
- Pokémon IDs are mapped to display names from loaded Pokémon data.
- Empty-state message: `No Pokémon discovered yet.`
- Overlay includes a close button and ARIA hidden-state toggling.

## Battle Functionality

### Battle Setup

When a battle starts, WorldScene passes:

- Player trainer name + party from current player state.
- Opponent trainer id, name, and party from selected NPC.
- Whether opponent is already defeated (for rematch reward rules).

BattleScene then:

- Builds lookup indexes for Pokémon and move definitions.
- Creates runtime Pokémon instances from definitions.
- Initializes lead Pokémon on both sides.
- Renders:
  - Battle title
  - Placeholder sprites (player/opponent tint differentiation)
  - Status panels for names and HP
  - Move buttons for the active player Pokémon

### Turn System

- Player picks one move from active Pokémon move list.
- Damage formula:
  - `max(1, floor(move.power + attacker.attack - defender.defense))`
- Opponent move is selected randomly from its active Pokémon move list.
- Turn resolution includes short delays for readability.

### Multi-Pokémon Handling

- If active opponent Pokémon faints and opponent has another, next opponent Pokémon is sent out.
- If active player Pokémon faints and player has another, next player Pokémon is sent out.
- If no remaining Pokémon on one side:
  - Player win or loss is finalized.

### Battle End and Continue Flow

- Move buttons are disabled at battle end.
- Result message displayed in battle log area.
- A `Continue` button returns to WorldScene.

### Reward Rules

On **win against a trainer not already defeated**:

- Player receives opponent lead Pokémon (first party slot) into Pokédex.
- Trainer is marked as defeated in player state.
- Reward text appears: `You received: <PokemonName>`.

On rematch wins (already defeated trainers):

- No additional reward is granted.

## Player State and Persistence

### State Shape

Current player state tracks:

- Name
- Party (Pokémon IDs used in battles)
- Pokédex (owned/discovered IDs)
- Position (`x/y`)
- Defeated trainer IDs

### Defaults

New/default profile starts with:

- Name: `You`
- Party: `emberfox`, `leafling`
- Pokédex prefilled with the starting two Pokémon
- Position: `(400, 300)`

### Save/Load Behavior

- On boot, state is loaded from local storage if present and valid JSON.
- Invalid save JSON is ignored with a console warning.
- State is saved:
  - Every ~1.5 seconds during world updates (position persistence).
  - Immediately when Pokédex is updated.
  - Immediately when trainer defeat status changes.
  - Before entering battle from world.

## Data Content Currently Shipped

### Pokémon Definitions

- `emberfox`
- `leafling`
- `sparko`

Each has base stats and move IDs.

### Move Definitions

- `tackle`
- `ember`
- `leaf_blade`
- `spark`

Each move currently only has `id`, `name`, and `power`.

### Trainer Definitions

Three trainers are configured:

- Ava (`wander`)
- Rowan (`stationary`)
- Kai (`wander`)

Each has a two-Pokémon party.

## Test Coverage Present Today

Automated tests currently focus on joystick parsing utilities:

- Axis reading from numeric/string payloads.
- Axis normalization behavior.
- Direction derivation from axis values.
- Direction fallback by label + distance.
- Null direction when centered.
- Case-insensitive direction label parsing.

## Current Limitations / Scope Boundaries

- No online or backend features (client-only).
- No type effectiveness/status effects/accuracy/critical hits.
- No animations beyond basic UI/state transitions.
- No explicit speed-order turn priority despite speed stat existing.
- No inventory/items/capture mechanics.
- No complex map system or tilemap-driven world.
- Uses placeholder sprite image for player and trainers.
