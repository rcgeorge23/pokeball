# Pokémon Trainer Battler (Browser-Only) — Step-by-Step Build Plan

This document is a practical, incremental plan for building a **browser-only**, **top-down 2D** trainer game where the player battles AI trainers, wins their first Pokémon, and stores winnings in a Pokédex.

## Goals (MVP)

- Top-down 2D world with a controllable trainer (touch + optional keyboard)
- NPC trainers roam or stand in the world
- Player can initiate battles with trainers
- Turn-based battle flow (simple stats + moves)
- If player wins: they receive opponent’s **first Pokémon used in battle**
- Captured/won Pokémon are added to the player’s **Pokédex**
- Entirely client-side (no server) with local persistence

## Non-goals (for now)

- Online multiplayer
- Complex Pokémon mechanics (types, status effects, breeding, items, etc.)
- Huge overworld
- Real Pokémon assets (avoid IP issues; use placeholders)

---

## Tech Choices (recommended)

**Rendering / Game Framework:** Phaser 3 (mobile-friendly canvas + input)  
**Language:** TypeScript  
**Build tooling:** Vite  
**State/persistence:** in-memory + localStorage (or IndexedDB later)  
**Testing:** Vitest (logic), Playwright (optional smoke tests)  
**Data:** JSON for Pokémon, moves, trainers, maps

---

## Repo Structure (suggested)

```
/src
  /assets
    /sprites
    /tilesets
    /audio
  /data
    pokemon.json
    moves.json
    trainers.json
    starter_pool.json
  /engine
    scene_manager.ts
    input.ts
    camera.ts
  /scenes
    boot_scene.ts
    preload_scene.ts
    world_scene.ts
    battle_scene.ts
    ui_scene.ts
  /world
    map_loader.ts
    npc_controller.ts
    collision.ts
    interaction.ts
  /battle
    battle_model.ts
    battle_flow.ts
    ai.ts
    damage.ts
    rewards.ts
  /player
    player_model.ts
    pokedex.ts
    inventory.ts
    persistence.ts
  main.ts
/index.html
```

---

## Step-by-step Plan

Tasks should be checked off once they are fully complete.

### Step 0 — Project Setup (Foundation)
**Deliverable:** A running blank game with hot reload.

- [x] Create project:
  - [x] `npm create vite@latest pokemon-battler -- --template vanilla-ts`
- [x] Install Phaser:
  - [x] `npm i phaser`
- [ ] Add basic linting/formatting (optional but helpful):
  - [ ] ESLint + Prettier
- [x] Create initial entrypoint (`src/main.ts`) that boots a Phaser game.
- [x] Configure responsive sizing for mobile:
  - [x] Use `Phaser.Scale.FIT` + `autoCenter` to adapt to touch devices
  - [x] Set `input.activePointers` for multi-touch
  - [x] Disable browser touch scrolling on the game canvas

**Acceptance criteria**
- [x] `npm run dev` opens a canvas and shows a solid background scene that fits a phone viewport.

---

### Step 1 — Core Game Loop & Scene Skeleton
**Deliverable:** Basic scene flow: Boot → Preload → World.

- [x] Add three scenes:
  - [x] `BootScene`: sets scale, background color, config
  - [x] `PreloadScene`: loads placeholder assets
  - [x] `WorldScene`: renders a simple world
- [x] Add a `SceneManager` or simple scene registration in `main.ts`.
- [ ] Add a simple touch input adapter in `engine/input.ts`:
  - [ ] Normalize touch input to movement vectors
  - [ ] Support on-screen controls (virtual joystick or D-pad)

**Acceptance criteria**
- [x] App loads assets and transitions into WorldScene automatically, with touch input initialized.

---

### Step 2 — Player Movement in a Top-down World
**Deliverable:** Player sprite moves with collisions in a simple map.

- [x] Add a placeholder player sprite (square, simple sprite sheet, or a static image).
- [x] Implement touch-first movement:
  - [x] On-screen joystick/D-pad for movement
  - [x] Optional keyboard support for desktop testing
- [x] Add a basic tilemap (even 1 screen) or a simple world with collision rectangles.
- [x] Add camera follow.

**Acceptance criteria**
- [x] Player moves smoothly via touch controls and cannot walk through collision areas.

---

### Step 3 — NPC Trainers in the World
**Deliverable:** Visible trainers with basic behavior + interaction trigger.

- [x] Create NPC trainer sprite + trainer data model:
  - [x] id, name, party (list of Pokémon ids), behavior type (stationary / wander)
- [x] Implement NPC spawn via `trainers.json`.
- [x] Implement:
  - [x] “wander” movement (random step every few seconds)
  - [x] interaction detection:
    - [x] tap trainer or tap action button, OR collision-based trigger
- [x] Add minimal UI hint: “Tap to battle”.

**Acceptance criteria**
- [x] Multiple trainers appear; player can trigger battle with one via touch.

---

### Step 4 — Battle Scene: Minimal Turn-based System (Vertical Slice)
**Deliverable:** Battle scene runs a simple turn loop and returns a win/lose result.

- [x] Create `BattleScene` that receives:
  - [x] player trainer state
  - [x] opponent trainer state
- [x] Define minimum battle model:
  - [x] Pokémon: `name`, `hp`, `attack`, `defense`, `speed`, `moves[]`
  - [x] Move: `name`, `power` (flat or scaled), optional accuracy (later)
- [x] Implement **battle flow**:
  - [x] show both Pokémon
  - [x] player chooses move (simple menu)
  - [x] opponent chooses move (random or simple AI)
  - [x] apply damage
  - [x] check faint
  - [x] switch next Pokémon if any (for now: 1 Pokémon each is fine)
- [x] Render basic UI:
  - [x] HP bars
  - [x] move buttons
  - [x] text log (“X used Tackle!”)
- [x] Ensure buttons are large enough for touch targets (min ~44px)

**Acceptance criteria**
- [x] Player can win/lose a battle using touch UI; battle ends and returns to WorldScene.

---

### Step 5 — Rewards Rule: Win Opponent’s First Pokémon
**Deliverable:** When player wins, they gain the first opponent Pokémon used.

- [x] Define reward logic in `battle/rewards.ts`:
  - [x] Determine opponent’s first Pokémon in battle (the lead).
  - [x] On victory: add to player Pokédex.
- [x] Implement a simple Pokédex model:
  - [x] list of owned Pokémon instances (or IDs)
  - [ ] optionally store “seen” vs “owned”
- [x] Add battle-end summary screen:
  - [x] “You won!”
  - [x] “You received: [PokémonName]”
  - [x] “Continue”

**Acceptance criteria**
- [x] Winning a battle adds the opponent’s lead Pokémon to Pokédex.

---

### Step 6 — Persistence (Local Save)
**Deliverable:** Refreshing the page keeps progress.

- [x] Implement `player/persistence.ts`:
  - [x] serialize player state: position, owned Pokémon, defeated trainers, settings
  - [x] save to `localStorage` (key: `pokemon-battler-save`)
- [x] Load on boot:
  - [x] if save exists, restore state
  - [x] else create new game state

**Acceptance criteria**
- [x] Progress and Pokédex persist after reload.

---

### Step 7 — World Progression: Defeated Trainers + Rematches (Optional)
**Deliverable:** Trainers can be marked defeated; optionally allow rematches.

- [x] Track `defeatedTrainerIds` in player state.
- [x] On battle win:
  - [x] mark opponent trainer as defeated
- [x] In world:
  - [x] defeated trainers change sprite tint or show “Defeated”
- [x] Decide rule:
  - [x] either no rematches
  - [x] or rematches allowed but no reward (or reward allowed—your call)

**Acceptance criteria**
- [x] Player can see who is defeated; defeated status persists.

---

### Step 8 — Expand Battle Depth (Iterative Enhancements)
**Deliverable:** Battles feel like a game rather than a demo.

Pick enhancements one at a time:
- [ ] Multiple Pokémon per trainer party (simple switching on faint)
- [ ] Turn order based on speed
- [ ] Accuracy / miss chance
- [ ] Critical hits
- [ ] Simple type effectiveness (only a few types to start)
- [ ] Better AI (choose move based on damage estimate)
- [ ] Animation polish (hit shake, flash, HP tween)

**Acceptance criteria**
- [ ] Each enhancement is testable and doesn’t break the loop.

---

### Step 9 — Content Pipeline (Data-driven Game)
**Deliverable:** Add Pokémon, moves, trainers by editing JSON, not code.

- [ ] Formalize schemas for:
  - [ ] `pokemon.json`
  - [ ] `moves.json`
  - [ ] `trainers.json`
- [ ] Add lightweight validation at load time:
  - [ ] missing Pokémon ids throw clear error
- [ ] Add starter selection screen:
  - [ ] choose 1 from `starter_pool.json`

**Acceptance criteria**
- [ ] Adding content requires editing data files only.

---

### Step 10 — UI/UX Polish (Still Browser-only)
**Deliverable:** Menus and presentation improvements.

- [ ] Title screen
- [ ] “New Game / Continue”
- [ ] Pokédex screen (list owned Pokémon)
- [ ] Controls screen
- [ ] Sound effects + music hooks
- [ ] Mobile controls polish:
  - [ ] Large touch targets, safe areas, and haptic feedback hooks (if available)
  - [ ] Orientation handling (portrait-first)

**Acceptance criteria**
- [ ] Game is playable end-to-end with clear UI.

---

## Definition of Done (MVP)
- Player moves around a small world
- Player can battle at least 3 trainers
- Winning gives opponent’s lead Pokémon
- Pokédex shows owned Pokémon
- Save/load works locally

---

## Testing Strategy (lightweight, but worth it)

### Unit tests (Vitest)
Focus on deterministic logic:
- damage calculation
- battle flow state transitions
- reward rule: “win grants opponent lead Pokémon”
- persistence serialization/deserialization

### Smoke test (optional)
- Launch game, start battle, win battle, verify Pokédex count increments

---

## Immediate Next Actions (Codex-friendly Tasks)
Create these as separate PR-sized steps:

1. **PR-001:** Vite + Phaser boot + scene skeleton
2. **PR-002:** Player movement + camera follow + collisions
3. **PR-003:** NPC trainers spawn + interaction prompt
4. **PR-004:** BattleScene with 1v1 turn loop + UI
5. **PR-005:** Rewards + Pokédex + localStorage persistence

---

## Notes on Assets / Legal
Use original placeholder sprites or open-licensed assets. Avoid shipping official Pokémon graphics/audio.
