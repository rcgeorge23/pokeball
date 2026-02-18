import Phaser from 'phaser';

import {
  NpcController,
  TrainerDefinition,
  TrainerInstance,
} from '../world/npc_controller';
import {
  getPlayerState,
  healPlayerParty,
  persistPlayerState,
  PlayerState,
  regenerateWorldSeed,
  updatePlayerPosition,
} from '../player/player_model';
import { deriveJoystickDirection } from '../world/joystick_input';
import {
  CHAMPION_GATE_REQUIRED_DEFEATS,
  GeneratedMapPointOfInterest,
  generateMapFromSeed,
} from '../world/generated_map';
import { SeededRng } from '../world/seeded_rng';
import { generateProceduralTrainerData } from '../world/procedural_trainer_generator';
import { renderGeneratedMap } from '../world/generated_map_renderer';

export class WorldScene extends Phaser.Scene {
  private static readonly POST_BATTLE_ENCOUNTER_GRACE_MS = 1200;
  private static readonly HEAL_WAIT_DURATION_MS = 700;
  private static readonly HEAL_WAIT_COOLDOWN_MS = 1800;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private moveKeys?: Record<string, Phaser.Input.Keyboard.Key>;
  private player?: Phaser.Physics.Arcade.Image;
  private interactKey?: Phaser.Input.Keyboard.Key;
  private npcController?: NpcController;
  private collisionLayer?: Phaser.Tilemaps.TilemapLayer;
  private tileSize = 16;
  private hintText?: Phaser.GameObjects.Text;
  private statusText?: Phaser.GameObjects.Text;
  private nearbyTrainer: TrainerInstance | null = null;
  private spottingTrainer: TrainerInstance | null = null;
  private lineOfSightSequenceActive = false;
  private playerState!: PlayerState;
  private defeatedTrainerIds = new Set<string>();
  private lastSaveTime = 0;
  private touchDirections = new Map<string, Phaser.Math.Vector2>();
  private joystickElement?: HTMLElement;
  private battleButton?: HTMLButtonElement;
  private pokedexOpenButton?: HTMLButtonElement;
  private pokedexPanel?: HTMLElement;
  private pokedexList?: HTMLElement;
  private pokedexCloseButton?: HTMLButtonElement;
  private regenerateButton?: HTMLButtonElement;
  private copySeedButton?: HTMLButtonElement;
  private toggleCollisionButton?: HTMLButtonElement;
  private recenterButton?: HTMLButtonElement;
  private mapDragPointerId?: number;
  private isMapDragging = false;
  private minimapMapBounds?: Phaser.GameObjects.Rectangle;
  private minimapViewportRect?: Phaser.GameObjects.Rectangle;
  private minimapPlayerDot?: Phaser.GameObjects.Arc;
  private minimapScale = 1;
  private worldPixelWidth = 0;
  private worldPixelHeight = 0;
  private isCameraFollowingPlayer = true;
  private healPointWorldPosition?: Phaser.Math.Vector2;
  private healPointTile?: { x: number; y: number };
  private signposts: Array<{ position: Phaser.Math.Vector2; message: string }> = [];
  private pointsOfInterest: Array<{ poi: GeneratedMapPointOfInterest; position: Phaser.Math.Vector2 }> = [];
  private championArenaWorldPosition?: Phaser.Math.Vector2;
  private activeDialogueBubble?: Phaser.GameObjects.Text;
  private worldMessage = '';
  private worldMessageUntil = 0;
  private recentlyBattledTrainerId?: string;
  private shouldIgnoreRecentTrainerEncounter = false;
  private shouldApplyPostBattleEncounterGrace = false;
  private postBattleEncounterGraceUntil = 0;
  private lastPlayerMovementTime = 0;
  private lastWaitHealTime = Number.NEGATIVE_INFINITY;
  private readonly isTouchDevice =
    'ontouchstart' in window || navigator.maxTouchPoints > 0;

  constructor() {
    super('WorldScene');
  }

  init(data?: { recentBattleTrainerId?: string }): void {
    const recentBattleTrainerId = data?.recentBattleTrainerId;
    this.recentlyBattledTrainerId = recentBattleTrainerId;
    this.shouldIgnoreRecentTrainerEncounter = Boolean(recentBattleTrainerId);
    this.shouldApplyPostBattleEncounterGrace = Boolean(recentBattleTrainerId);
  }

  create(): void {
    this.resetTransientSceneState();

    const { width, height } = this.scale;
    this.playerState = getPlayerState();
    const generatedMap = generateMapFromSeed(this.playerState.worldSeed);
    const { collisionLayer, worldWidth, worldHeight, tileSize } = renderGeneratedMap(
      this,
      generatedMap
    );
    this.collisionLayer = collisionLayer;
    this.tileSize = tileSize;
    this.defeatedTrainerIds = new Set(this.playerState.defeatedTrainerIds);

    const generatedSpawnX = generatedMap.spawnPoints.playerStart.x * tileSize + tileSize / 2;
    const generatedSpawnY = generatedMap.spawnPoints.playerStart.y * tileSize + tileSize / 2;
    this.healPointWorldPosition = new Phaser.Math.Vector2(
      generatedMap.spawnPoints.healPoint.x * tileSize + tileSize / 2,
      generatedMap.spawnPoints.healPoint.y * tileSize + tileSize / 2
    );
    this.healPointTile = {
      x: generatedMap.spawnPoints.healPoint.x,
      y: generatedMap.spawnPoints.healPoint.y,
    };
    this.signposts = generatedMap.spawnPoints.signs.map((signPoint, index) => ({
      position: new Phaser.Math.Vector2(
        signPoint.x * tileSize + tileSize / 2,
        signPoint.y * tileSize + tileSize / 2
      ),
      message: this.getSignpostMessage(index),
    }));
    this.pointsOfInterest = generatedMap.metadata.pointsOfInterest.map((poi) => ({
      poi,
      position: new Phaser.Math.Vector2(poi.x * tileSize + tileSize / 2, poi.y * tileSize + tileSize / 2),
    }));
    const championArenaNode = generatedMap.metadata.navigationGraph.nodes.find(
      (node) => node.type === 'championArena'
    );
    this.championArenaWorldPosition = championArenaNode
      ? new Phaser.Math.Vector2(
          championArenaNode.x * tileSize + tileSize / 2,
          championArenaNode.y * tileSize + tileSize / 2
        )
      : undefined;
    this.renderHealPointMarker(this.healPointWorldPosition);
    this.signposts.forEach((signpost) => this.renderSignpostMarker(signpost.position));
    this.pointsOfInterest.forEach((pointOfInterest) => this.renderPointOfInterestMarker(pointOfInterest));
    if (this.championArenaWorldPosition) {
      this.renderChampionArenaMarker(this.championArenaWorldPosition);
    }

    const playerStartX = this.playerState.position?.x ?? generatedSpawnX;
    const playerStartY = this.playerState.position?.y ?? generatedSpawnY;

    this.player = this.physics.add.image(
      playerStartX,
      playerStartY,
      'player'
    );
    this.player.setScale(4);
    this.player.setCollideWorldBounds(true);

    this.physics.add.collider(this.player, collisionLayer);
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);

    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.startFollow(this.player);
    this.isCameraFollowingPlayer = true;
    this.setupTouchMapDragging();
    this.setupRecenterButton();
    this.setupMinimap(worldWidth, worldHeight);

    this.input.addPointer(2);
    this.cursors = this.input.keyboard?.createCursorKeys();
    this.moveKeys = this.input.keyboard?.addKeys('W,A,S,D') as Record<
      string,
      Phaser.Input.Keyboard.Key
    >;
    this.interactKey = this.input.keyboard?.addKey(
      Phaser.Input.Keyboard.KeyCodes.E
    );

    const trainerData = generateProceduralTrainerData({
      worldSeed: this.playerState.worldSeed,
      trainerTemplates: (this.cache.json.get('trainers') ?? []) as TrainerDefinition[],
      trainerPoints: generatedMap.spawnPoints.trainers,
      tileSize,
      width: generatedMap.width,
      difficultyBandByTile: generatedMap.metadata.difficultyBandByTile,
    });
    this.npcController = new NpcController(this, trainerData);
    this.npcController.setDefeatedTrainerIds(this.playerState.defeatedTrainerIds);

    this.npcController.getInstances().forEach((trainer) => {
      this.physics.add.collider(trainer.sprite, collisionLayer);
    });

    this.add
      .text(24, 24, 'Move with WASD, arrow keys, or touch controls', {
        fontSize: '16px',
        color: '#e2e8f0',
      })
      .setScrollFactor(0);

    this.createTouchControls();

    this.hintText = this.add
      .text(24, height - 48, '', {
        fontSize: '16px',
        color: '#f8fafc',
      })
      .setScrollFactor(0);

    this.statusText = this.add
      .text(
        24,
        height - 24,
        `Pokédex: ${this.playerState.pokedex.length}`,
        {
          fontSize: '14px',
          color: '#94a3b8',
        }
      )
      .setScrollFactor(0);

    if (import.meta.env.DEV) {
      this.add
        .text(
          width - 24,
          24,
          `Seed: ${this.playerState.worldSeed} · v${this.playerState.worldVersion}`,
          {
            fontSize: '13px',
            color: '#94a3b8',
            align: 'right',
          }
        )
        .setOrigin(1, 0)
        .setScrollFactor(0);
    }

    this.setupPokedexUi();

    if (this.shouldApplyPostBattleEncounterGrace) {
      this.postBattleEncounterGraceUntil =
        this.time.now + WorldScene.POST_BATTLE_ENCOUNTER_GRACE_MS;
      this.shouldApplyPostBattleEncounterGrace = false;
    } else {
      this.postBattleEncounterGraceUntil = 0;
    }

    if (import.meta.env.DEV) {
      this.setupDebugRegenerateButton(tileSize);
      this.setupDebugCopySeedButton();
      this.setupDebugCollisionToggle(collisionLayer);
    }
  }

  update(time: number): void {
    if (!this.player) {
      return;
    }

    const speed = 180;
    const velocity = new Phaser.Math.Vector2(0, 0);

    if (this.lineOfSightSequenceActive) {
      this.player.setVelocity(0, 0);
    }

    if (!this.lineOfSightSequenceActive && (this.cursors?.left?.isDown || this.moveKeys?.A?.isDown)) {
      velocity.x -= 1;
    }
    if (!this.lineOfSightSequenceActive && (this.cursors?.right?.isDown || this.moveKeys?.D?.isDown)) {
      velocity.x += 1;
    }
    if (!this.lineOfSightSequenceActive && (this.cursors?.up?.isDown || this.moveKeys?.W?.isDown)) {
      velocity.y -= 1;
    }
    if (!this.lineOfSightSequenceActive && (this.cursors?.down?.isDown || this.moveKeys?.S?.isDown)) {
      velocity.y += 1;
    }

    for (const direction of this.lineOfSightSequenceActive ? [] : this.touchDirections.values()) {
      velocity.x += direction.x;
      velocity.y += direction.y;
    }

    const magnitude = velocity.length();
    const isPlayerMoving = magnitude > 0.01;
    if (magnitude > 1) {
      velocity.normalize();
    }
    velocity.scale(speed);
    this.player.setVelocity(velocity.x, velocity.y);

    if (isPlayerMoving) {
      this.lastPlayerMovementTime = time;
    }

    this.updateCameraTracking();
    this.updateMinimap();
    this.tryHealPlayerPartyWhileWaiting(time, isPlayerMoving);

    this.npcController?.update(time);
    this.spottingTrainer =
      this.player && this.npcController && this.collisionLayer
        ? this.npcController.findTrainerWithLineOfSight(
            this.player,
            this.collisionLayer,
            {
              maxDistance: this.tileSize * 8,
              sampleStep: this.tileSize / 2,
            }
          )
        : null;
    this.nearbyTrainer =
      this.npcController?.findNearbyTrainer(this.player, 80) ?? null;

    this.updateRecentTrainerEncounterIgnore();

    this.maybeStartLineOfSightEncounter();

    if (this.hintText) {
      const nearHealPoint = this.isPlayerNearHealPoint();
      if (
        this.spottingTrainer &&
        !this.defeatedTrainerIds.has(this.spottingTrainer.definition.id)
      ) {
        this.hintText.setText(`${this.spottingTrainer.definition.name} spots you!`);
      } else if (this.nearbyTrainer) {
        const isDefeated = this.defeatedTrainerIds.has(
          this.nearbyTrainer.definition.id
        );
        this.hintText.setText(
          isDefeated
            ? `${this.nearbyTrainer.definition.name} is defeated. Press E to rematch.`
            : `Press E to battle ${this.nearbyTrainer.definition.name}`
        );
      } else if (nearHealPoint) {
        this.hintText.setText('Wait on the spring tile to heal your team');
      } else if (this.isPlayerNearChampionArena()) {
        this.hintText.setText(this.getChampionArenaHint());
      } else if (this.getNearbySignpost()) {
        this.hintText.setText('Press E to read sign');
      } else if (this.getNearbyPointOfInterest()) {
        this.hintText.setText('Press E to inspect landmark');
      } else if (this.worldMessageUntil > time) {
        this.hintText.setText(this.worldMessage);
      } else {
        this.hintText.setText('');
      }
    }

    this.updateBattleButton();

    if (!this.lineOfSightSequenceActive && this.interactKey && Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      if (this.nearbyTrainer) {
        this.startNearbyBattle();
      } else {
        this.tryChallengeChampionArena();
        this.tryReadNearbySignpost();
        this.tryInspectNearbyPointOfInterest();
      }
    }

    if (time - this.lastSaveTime > 1500) {
      updatePlayerPosition(this.player.x, this.player.y);
      persistPlayerState();
      this.lastSaveTime = time;
    }
  }

  private renderHealPointMarker(position: Phaser.Math.Vector2): void {
    const marker = this.add.circle(position.x, position.y, this.tileSize * 0.35, 0x38bdf8, 0.9);
    marker.setDepth(1);

    this.tweens.add({
      targets: marker,
      alpha: 0.45,
      scale: 1.12,
      duration: 720,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
  }

  private isPlayerNearHealPoint(): boolean {
    if (!this.player || !this.healPointWorldPosition) {
      return false;
    }

    return Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      this.healPointWorldPosition.x,
      this.healPointWorldPosition.y
    ) <= this.tileSize * 1.15;
  }

  private isPlayerOnHealPointTile(): boolean {
    if (!this.player || !this.healPointTile) {
      return false;
    }

    return (
      Math.floor(this.player.x / this.tileSize) === this.healPointTile.x
      && Math.floor(this.player.y / this.tileSize) === this.healPointTile.y
    );
  }

  private getNearbySignpost(): { position: Phaser.Math.Vector2; message: string } | null {
    if (!this.player) {
      return null;
    }

    return (
      this.signposts.find(
        (signpost) =>
          Phaser.Math.Distance.Between(
            this.player?.x ?? 0,
            this.player?.y ?? 0,
            signpost.position.x,
            signpost.position.y
          ) <= this.tileSize * 1.25
      ) ?? null
    );
  }

  private tryHealPlayerPartyWhileWaiting(currentTime: number, isPlayerMoving: boolean): void {
    if (!this.isPlayerOnHealPointTile() || isPlayerMoving) {
      return;
    }

    const waitingDuration = currentTime - this.lastPlayerMovementTime;
    if (waitingDuration < WorldScene.HEAL_WAIT_DURATION_MS) {
      return;
    }

    if (currentTime - this.lastWaitHealTime < WorldScene.HEAL_WAIT_COOLDOWN_MS) {
      return;
    }

    this.lastWaitHealTime = currentTime;

    healPlayerParty();
    this.worldMessage = 'Your team is fully healed!';
    this.worldMessageUntil = currentTime + 2200;
    this.hintText?.setText(this.worldMessage);
  }

  private tryReadNearbySignpost(): void {
    const nearbySignpost = this.getNearbySignpost();
    if (!nearbySignpost || !this.player) {
      return;
    }

    this.showDialogueBubble(nearbySignpost.message, this.player.x, this.player.y - 52);
  }

  private showDialogueBubble(message: string, x: number, y: number): void {
    this.activeDialogueBubble?.destroy();
    this.activeDialogueBubble = this.add
      .text(x, y, message, {
        fontSize: '14px',
        color: '#0f172a',
        backgroundColor: '#f8fafc',
        padding: { x: 10, y: 6 },
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(10);

    this.tweens.add({
      targets: this.activeDialogueBubble,
      alpha: { from: 0.15, to: 1 },
      duration: 130,
      ease: 'Sine.Out',
    });

    this.time.delayedCall(2200, () => {
      this.activeDialogueBubble?.destroy();
      this.activeDialogueBubble = undefined;
    });
  }


  private getNearbyPointOfInterest(): { poi: GeneratedMapPointOfInterest; position: Phaser.Math.Vector2 } | null {
    if (!this.player) {
      return null;
    }

    return (
      this.pointsOfInterest.find(
        ({ position }) =>
          Phaser.Math.Distance.Between(
            this.player?.x ?? 0,
            this.player?.y ?? 0,
            position.x,
            position.y
          ) <= this.tileSize * 1.4
      ) ?? null
    );
  }

  private tryInspectNearbyPointOfInterest(): void {
    const nearbyPointOfInterest = this.getNearbyPointOfInterest();
    if (!nearbyPointOfInterest || !this.player) {
      return;
    }

    this.showDialogueBubble(
      `${nearbyPointOfInterest.poi.title}: ${nearbyPointOfInterest.poi.description}`,
      this.player.x,
      this.player.y - 52
    );
  }

  private renderPointOfInterestMarker(pointOfInterest: { poi: GeneratedMapPointOfInterest; position: Phaser.Math.Vector2 }): void {
    const colorByType: Record<GeneratedMapPointOfInterest['type'], number> = {
      shortcutGate: 0x60a5fa,
      scenicLandmark: 0xf59e0b,
    };

    const marker = this.add.star(
      pointOfInterest.position.x,
      pointOfInterest.position.y,
      5,
      this.tileSize * 0.12,
      this.tileSize * 0.38,
      colorByType[pointOfInterest.poi.type],
      0.92
    );
    marker.setDepth(1);

    this.tweens.add({
      targets: marker,
      angle: pointOfInterest.poi.type === 'shortcutGate' ? 360 : -360,
      duration: pointOfInterest.poi.type === 'shortcutGate' ? 5000 : 7200,
      repeat: -1,
      ease: 'Linear',
    });
  }

  private renderSignpostMarker(position: Phaser.Math.Vector2): void {
    const post = this.add.rectangle(
      position.x,
      position.y + this.tileSize * 0.1,
      this.tileSize * 0.45,
      this.tileSize * 0.65,
      0x92400e,
      0.95
    );
    post.setDepth(1);

    const face = this.add.rectangle(
      position.x,
      position.y - this.tileSize * 0.22,
      this.tileSize * 0.9,
      this.tileSize * 0.62,
      0xfef3c7,
      0.95
    );
    face.setDepth(1);

    this.add
      .text(position.x, position.y - this.tileSize * 0.22, '!', {
        fontSize: '16px',
        color: '#7c2d12',
      })
      .setOrigin(0.5)
      .setDepth(2);
  }

  private getSignpostMessage(index: number): string {
    const messages = [
      'Sign: Healing spring nearby.',
      'Tip: Trainers who spot you will challenge you!',
      'Hint: The Pokédex tracks Pokémon you discover.',
      'Remember: Press E to interact with things in the world.',
      'Explorer note: Seeds create entirely new routes.',
    ];

    return messages[index % messages.length];
  }

  private isPlayerNearChampionArena(): boolean {
    if (!this.player || !this.championArenaWorldPosition) {
      return false;
    }

    return Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      this.championArenaWorldPosition.x,
      this.championArenaWorldPosition.y
    ) <= this.tileSize * 1.5;
  }

  private getDefeatedGeneratedTrainerCount(): number {
    return this.playerState.defeatedTrainerIds.filter((trainerId) =>
      trainerId.startsWith('generated-trainer-')
    ).length;
  }

  private getChampionArenaHint(): string {
    const championTrainerId = this.getChampionTrainerId();
    const championAlreadyDefeated = this.playerState.defeatedTrainerIds.includes(championTrainerId);
    if (championAlreadyDefeated) {
      return 'Champion arena cleared. Press E to rematch the Champion.';
    }

    const defeatedCount = this.getDefeatedGeneratedTrainerCount();
    if (defeatedCount < CHAMPION_GATE_REQUIRED_DEFEATS) {
      return `Champion Gate: ${defeatedCount}/${CHAMPION_GATE_REQUIRED_DEFEATS} trainers defeated.`;
    }

    return 'Press E to challenge the Champion!';
  }

  private tryChallengeChampionArena(): void {
    if (!this.player || !this.isPlayerNearChampionArena()) {
      return;
    }

    const defeatedCount = this.getDefeatedGeneratedTrainerCount();
    if (defeatedCount < CHAMPION_GATE_REQUIRED_DEFEATS) {
      this.showDialogueBubble(
        `Champion Gate sealed. Defeat ${CHAMPION_GATE_REQUIRED_DEFEATS - defeatedCount} more trainer(s).`,
        this.player.x,
        this.player.y - 52
      );
      return;
    }

    const championSeed = `${this.playerState.worldSeed}:champion-arena`;
    const championRng = new SeededRng(championSeed);
    const championNamePool = ['Champion Ione', 'Champion Rhea', 'Champion Kael'];
    const speciesPool = ['emberfox', 'sparko', 'leafling'];

    const championParty: string[] = [];
    const availableSpecies = [...speciesPool];
    while (championParty.length < 3 && availableSpecies.length > 0) {
      const index = championRng.nextInt(0, availableSpecies.length - 1);
      const [pickedSpecies] = availableSpecies.splice(index, 1);
      championParty.push(pickedSpecies);
    }

    updatePlayerPosition(this.player.x, this.player.y);
    persistPlayerState();
    this.scene.start('BattleScene', {
      player: {
        name: this.playerState?.name ?? 'You',
        party: this.playerState?.party ?? [],
      },
      opponent: {
        id: this.getChampionTrainerId(),
        name: championRng.pick(championNamePool),
        party: championParty,
        defeated: this.defeatedTrainerIds.has(this.getChampionTrainerId()),
      },
    });
  }

  private getChampionTrainerId(): string {
    return `generated-champion-${this.playerState.worldSeed}`;
  }

  private renderChampionArenaMarker(position: Phaser.Math.Vector2): void {
    const marker = this.add.star(
      position.x,
      position.y,
      6,
      this.tileSize * 0.25,
      this.tileSize * 0.6,
      0xe11d48,
      0.95
    );
    marker.setDepth(2);

    this.tweens.add({
      targets: marker,
      scale: 1.12,
      alpha: 0.55,
      duration: 580,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
  }


  private createTouchControls(): void {
    const joystickElement = document.getElementById('joystick');
    if (!joystickElement) {
      return;
    }

    this.joystickElement = joystickElement;
    this.joystickElement.style.display = 'block';
    this.joystickElement.innerHTML = '';

    const updateDirection = (directionData: JoyStickData) => {
      const direction = deriveJoystickDirection(directionData);
      if (!direction) {
        this.touchDirections.delete('joystick');
        return;
      }

      this.touchDirections.set(
        'joystick',
        new Phaser.Math.Vector2(direction.x, direction.y)
      );
    };

    new JoyStick(
      'joystick',
      {
        title: 'Joystick',
        internalFillColor: '#94a3b8',
        internalStrokeColor: '#0f172a',
        externalStrokeColor: '#475569',
      },
      (stickData: JoyStickData) => {
        updateDirection(stickData);
      }
    );

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.resetTransientSceneState();
      this.touchDirections.delete('joystick');
      if (this.joystickElement) {
        this.joystickElement.style.display = 'none';
        this.joystickElement.innerHTML = '';
      }
    });

    this.createBattleButton();
  }

  private resetTransientSceneState(): void {
    this.nearbyTrainer = null;
    this.spottingTrainer = null;
    this.lineOfSightSequenceActive = false;
    this.touchDirections.clear();
    this.worldMessage = '';
    this.worldMessageUntil = 0;
    this.mapDragPointerId = undefined;
    this.isMapDragging = false;
    this.isCameraFollowingPlayer = true;
    this.shouldApplyPostBattleEncounterGrace = false;
    this.postBattleEncounterGraceUntil = 0;
    this.lastPlayerMovementTime = 0;
    this.lastWaitHealTime = Number.NEGATIVE_INFINITY;
    this.healPointTile = undefined;
  }

  private createBattleButton(): void {
    const battleButton = document.getElementById('battle-button');
    if (!battleButton || !this.isTouchDevice) {
      return;
    }

    this.battleButton = battleButton as HTMLButtonElement;
    this.battleButton.style.display = 'none';
    const onBattlePress = () => {
      this.startNearbyBattle();
    };

    this.battleButton.addEventListener('click', onBattlePress);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (!this.battleButton) {
        return;
      }

      this.battleButton.style.display = 'none';
      this.battleButton.textContent = 'Battle';
      this.battleButton.removeEventListener('click', onBattlePress);
      this.battleButton = undefined;
    });
  }

  private setupPokedexUi(): void {
    const pokedexOpenButton = document.getElementById('pokedex-open-button');
    const pokedexPanel = document.getElementById('pokedex-panel');
    const pokedexList = document.getElementById('pokedex-list');
    const pokedexCloseButton = document.getElementById('pokedex-close-button');

    if (
      !pokedexOpenButton ||
      !pokedexPanel ||
      !pokedexList ||
      !pokedexCloseButton
    ) {
      return;
    }

    this.pokedexOpenButton = pokedexOpenButton as HTMLButtonElement;
    this.pokedexPanel = pokedexPanel;
    this.pokedexList = pokedexList;
    this.pokedexCloseButton = pokedexCloseButton as HTMLButtonElement;

    const openPokedex = () => {
      this.refreshPokedexList();
      if (!this.pokedexPanel) {
        return;
      }

      this.pokedexPanel.style.display = 'flex';
      this.pokedexPanel.setAttribute('aria-hidden', 'false');
    };

    const closePokedex = () => {
      if (!this.pokedexPanel) {
        return;
      }

      this.pokedexPanel.style.display = 'none';
      this.pokedexPanel.setAttribute('aria-hidden', 'true');
    };

    this.pokedexOpenButton.addEventListener('click', openPokedex);
    this.pokedexCloseButton.addEventListener('click', closePokedex);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.pokedexOpenButton?.removeEventListener('click', openPokedex);
      this.pokedexCloseButton?.removeEventListener('click', closePokedex);

      if (this.pokedexPanel) {
        this.pokedexPanel.style.display = 'none';
        this.pokedexPanel.setAttribute('aria-hidden', 'true');
      }

      this.pokedexOpenButton = undefined;
      this.pokedexPanel = undefined;
      this.pokedexList = undefined;
      this.pokedexCloseButton = undefined;
    });
  }

  private refreshPokedexList(): void {
    if (!this.pokedexList) {
      return;
    }

    const pokemonData =
      (this.cache.json.get('pokemon') as { id: string; name: string }[]) ?? [];
    const nameById = new Map(pokemonData.map((pokemon) => [pokemon.id, pokemon.name]));

    const pokedexList = this.pokedexList;
    pokedexList.innerHTML = '';

    if (this.playerState.pokedex.length === 0) {
      const entry = document.createElement('li');
      entry.textContent = 'No Pokémon discovered yet.';
      pokedexList.append(entry);
      return;
    }

    this.playerState.pokedex.forEach((pokemonId) => {
      const entry = document.createElement('li');
      entry.textContent = nameById.get(pokemonId) ?? pokemonId;
      pokedexList.append(entry);
    });
  }

  private updateBattleButton(): void {
    if (!this.battleButton) {
      return;
    }

    this.battleButton.style.display =
      this.nearbyTrainer && !this.lineOfSightSequenceActive ? 'block' : 'none';
    this.battleButton.textContent = this.nearbyTrainer
      ? `Battle ${this.nearbyTrainer.definition.name}`
      : 'Battle';
  }

  private setupDebugRegenerateButton(tileSize: number): void {
    const regenerateButton = document.getElementById('regenerate-map-button');
    if (!regenerateButton) {
      return;
    }

    this.regenerateButton = regenerateButton as HTMLButtonElement;
    this.regenerateButton.style.display = 'inline-flex';

    const onRegenerate = () => {
      const nextSeed = regenerateWorldSeed();
      const regeneratedMap = generateMapFromSeed(nextSeed);
      const spawnX = regeneratedMap.spawnPoints.playerStart.x * tileSize + tileSize / 2;
      const spawnY = regeneratedMap.spawnPoints.playerStart.y * tileSize + tileSize / 2;
      updatePlayerPosition(spawnX, spawnY);
      persistPlayerState();
      this.scene.restart();
    };

    this.regenerateButton.addEventListener('click', onRegenerate);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.regenerateButton?.removeEventListener('click', onRegenerate);
      if (this.regenerateButton) {
        this.regenerateButton.style.display = 'none';
      }
      this.regenerateButton = undefined;
    });
  }


  private setupDebugCollisionToggle(collisionLayer: Phaser.Tilemaps.TilemapLayer): void {
    const toggleCollisionButton = document.getElementById('toggle-collision-button');
    if (!toggleCollisionButton) {
      return;
    }

    this.toggleCollisionButton = toggleCollisionButton as HTMLButtonElement;
    this.toggleCollisionButton.style.display = 'inline-flex';

    const setCollisionVisibility = (isVisible: boolean) => {
      collisionLayer.setVisible(isVisible);
      collisionLayer.setAlpha(isVisible ? 0.65 : 1);

      if (this.toggleCollisionButton) {
        this.toggleCollisionButton.textContent = isVisible
          ? 'Hide Collision'
          : 'Show Collision';
      }
    };

    let isCollisionVisible = false;
    setCollisionVisibility(isCollisionVisible);

    const onToggleCollision = () => {
      isCollisionVisible = !isCollisionVisible;
      setCollisionVisibility(isCollisionVisible);
    };

    this.toggleCollisionButton.addEventListener('click', onToggleCollision);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.toggleCollisionButton?.removeEventListener('click', onToggleCollision);
      if (this.toggleCollisionButton) {
        this.toggleCollisionButton.style.display = 'none';
        this.toggleCollisionButton.textContent = 'Show Collision';
      }

      collisionLayer.setVisible(false);
      collisionLayer.setAlpha(1);
      this.toggleCollisionButton = undefined;
    });
  }

  private setupDebugCopySeedButton(): void {
    const copySeedButton = document.getElementById('copy-seed-button');
    if (!copySeedButton) {
      return;
    }

    this.copySeedButton = copySeedButton as HTMLButtonElement;
    this.copySeedButton.style.display = 'inline-flex';

    const defaultLabel = 'Copy Seed';
    const flashLabel = (label: string) => {
      if (!this.copySeedButton) {
        return;
      }

      this.copySeedButton.textContent = label;
      window.setTimeout(() => {
        if (this.copySeedButton) {
          this.copySeedButton.textContent = defaultLabel;
        }
      }, 1200);
    };

    const onCopySeed = async () => {
      const seed = this.playerState.worldSeed;

      if (!navigator.clipboard?.writeText) {
        console.info(`World seed: ${seed}`);
        flashLabel('Seed logged');
        return;
      }

      try {
        await navigator.clipboard.writeText(seed);
        flashLabel('Copied!');
      } catch {
        console.info(`World seed: ${seed}`);
        flashLabel('Seed logged');
      }
    };

    const onCopySeedClick = () => {
      void onCopySeed();
    };

    this.copySeedButton.addEventListener('click', onCopySeedClick);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.copySeedButton?.removeEventListener('click', onCopySeedClick);
      if (this.copySeedButton) {
        this.copySeedButton.style.display = 'none';
        this.copySeedButton.textContent = defaultLabel;
      }
      this.copySeedButton = undefined;
    });
  }


  private setupTouchMapDragging(): void {
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      if (this.mapDragPointerId !== undefined || !pointer.primaryDown) {
        return;
      }

      this.mapDragPointerId = pointer.id;
      this.isMapDragging = false;
    });

    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
      if (!this.player || this.mapDragPointerId !== pointer.id || !pointer.primaryDown) {
        return;
      }

      if (!this.isMapDragging && pointer.getDistance() < 8) {
        return;
      }

      this.isMapDragging = true;
      if (this.isCameraFollowingPlayer) {
        this.cameras.main.stopFollow();
        this.isCameraFollowingPlayer = false;
      }

      this.cameras.main.scrollX -= pointer.position.x - pointer.prevPosition.x;
      this.cameras.main.scrollY -= pointer.position.y - pointer.prevPosition.y;
      this.clampCameraScroll();
    });

    const clearDragState = (pointer: Phaser.Input.Pointer) => {
      if (this.mapDragPointerId === pointer.id) {
        this.mapDragPointerId = undefined;
      }
      this.isMapDragging = false;
    };

    this.input.on(Phaser.Input.Events.POINTER_UP, clearDragState);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, clearDragState);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off(Phaser.Input.Events.POINTER_DOWN);
      this.input.off(Phaser.Input.Events.POINTER_MOVE);
      this.input.off(Phaser.Input.Events.POINTER_UP, clearDragState);
      this.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, clearDragState);
    });
  }

  private setupRecenterButton(): void {
    const recenterButton = document.getElementById('recenter-button');
    if (!recenterButton) {
      return;
    }

    this.recenterButton = recenterButton as HTMLButtonElement;
    this.recenterButton.style.display = 'none';

    const onRecenter = () => {
      if (!this.player) {
        return;
      }

      this.cameras.main.startFollow(this.player, true, 0.15, 0.15);
      this.isCameraFollowingPlayer = true;
      this.isMapDragging = false;
      this.mapDragPointerId = undefined;
      if (this.recenterButton) {
        this.recenterButton.style.display = 'none';
      }
    };

    this.recenterButton.addEventListener('click', onRecenter);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.recenterButton?.removeEventListener('click', onRecenter);
      if (this.recenterButton) {
        this.recenterButton.style.display = 'none';
      }
      this.recenterButton = undefined;
    });
  }

  private updateCameraTracking(): void {
    if (!this.player) {
      return;
    }

    const camera = this.cameras.main;
    const cameraCenterX = camera.scrollX + camera.width / 2;
    const cameraCenterY = camera.scrollY + camera.height / 2;
    const isCenteredOnPlayer =
      Phaser.Math.Distance.Between(cameraCenterX, cameraCenterY, this.player.x, this.player.y) < this.tileSize * 0.8;

    if (this.recenterButton) {
      this.recenterButton.style.display = isCenteredOnPlayer ? 'none' : 'block';
    }

    if (!this.isCameraFollowingPlayer && isCenteredOnPlayer && !this.isMapDragging) {
      camera.startFollow(this.player, true, 0.2, 0.2);
      this.isCameraFollowingPlayer = true;
    }
  }


  private clampCameraScroll(): void {
    const maxScrollX = Math.max(0, this.worldPixelWidth - this.cameras.main.width);
    const maxScrollY = Math.max(0, this.worldPixelHeight - this.cameras.main.height);
    this.cameras.main.scrollX = Phaser.Math.Clamp(this.cameras.main.scrollX, 0, maxScrollX);
    this.cameras.main.scrollY = Phaser.Math.Clamp(this.cameras.main.scrollY, 0, maxScrollY);
  }

  private setupMinimap(worldWidth: number, worldHeight: number): void {
    this.worldPixelWidth = worldWidth;
    this.worldPixelHeight = worldHeight;

    const minimapWidth = 148;
    const minimapHeight = 148;
    const margin = 20;
    const minimapX = this.scale.width - minimapWidth - margin;
    const minimapY = 20;

    this.minimapScale = Math.min((minimapWidth - 20) / worldWidth, (minimapHeight - 20) / worldHeight);

    this.add
      .rectangle(minimapX, minimapY, minimapWidth, minimapHeight, 0x0f172a, 0.42)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(30);

    const mapDrawWidth = worldWidth * this.minimapScale;
    const mapDrawHeight = worldHeight * this.minimapScale;
    const mapOffsetX = minimapX + (minimapWidth - mapDrawWidth) / 2;
    const mapOffsetY = minimapY + (minimapHeight - mapDrawHeight) / 2;

    this.minimapMapBounds = this.add
      .rectangle(mapOffsetX, mapOffsetY, mapDrawWidth, mapDrawHeight, 0x38bdf8, 0.2)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x94a3b8, 0.8)
      .setScrollFactor(0)
      .setDepth(31);

    this.minimapViewportRect = this.add
      .rectangle(mapOffsetX, mapOffsetY, this.cameras.main.width * this.minimapScale, this.cameras.main.height * this.minimapScale)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0xf8fafc, 0.95)
      .setFillStyle(0xffffff, 0.08)
      .setScrollFactor(0)
      .setDepth(32);

    this.minimapPlayerDot = this.add
      .circle(mapOffsetX, mapOffsetY, 3, 0xf97316, 0.95)
      .setScrollFactor(0)
      .setDepth(33);

  }

  private updateMinimap(): void {
    if (!this.player || !this.minimapMapBounds || !this.minimapPlayerDot || !this.minimapViewportRect) {
      return;
    }

    const mapX = this.minimapMapBounds.x;
    const mapY = this.minimapMapBounds.y;

    this.minimapPlayerDot.setPosition(
      mapX + this.player.x * this.minimapScale,
      mapY + this.player.y * this.minimapScale
    );

    this.minimapViewportRect.setPosition(
      mapX + this.cameras.main.scrollX * this.minimapScale,
      mapY + this.cameras.main.scrollY * this.minimapScale
    );
  }


  private maybeStartLineOfSightEncounter(): void {
    if (this.time.now < this.postBattleEncounterGraceUntil) {
      return;
    }

    if (
      this.lineOfSightSequenceActive ||
      !this.player ||
      !this.spottingTrainer ||
      this.defeatedTrainerIds.has(this.spottingTrainer.definition.id)
    ) {
      return;
    }

    const trainer = this.spottingTrainer;
    this.lineOfSightSequenceActive = true;
    this.showTrainerNotice(trainer);

    this.time.delayedCall(480, () => {
      if (!this.player || !this.npcController) {
        this.lineOfSightSequenceActive = false;
        return;
      }

      const didStartApproach = this.npcController.startApproach(
        trainer.definition.id,
        this.player,
        {
          speed: 120,
          stopDistance: 56,
          maxDurationMs: 3200,
          onComplete: () => {
            const refreshedTrainer =
              this.npcController?.getTrainerById(trainer.definition.id) ?? trainer;
            this.startBattleWithTrainer(refreshedTrainer);
          },
        }
      );

      if (!didStartApproach) {
        this.lineOfSightSequenceActive = false;
      }
    });
  }

  private updateRecentTrainerEncounterIgnore(): void {
    if (!this.shouldIgnoreRecentTrainerEncounter || !this.recentlyBattledTrainerId || !this.player) {
      return;
    }

    if (this.spottingTrainer?.definition.id === this.recentlyBattledTrainerId) {
      this.spottingTrainer = null;
    }

    const nearbyTrainer = this.nearbyTrainer;
    if (nearbyTrainer?.definition.id === this.recentlyBattledTrainerId) {
      this.nearbyTrainer = null;
    }

    const recentlyBattledTrainer = this.npcController?.getTrainerById(this.recentlyBattledTrainerId);
    if (!recentlyBattledTrainer) {
      this.shouldIgnoreRecentTrainerEncounter = false;
      this.recentlyBattledTrainerId = undefined;
      return;
    }

    const distanceFromRecentTrainer = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      recentlyBattledTrainer.sprite.x,
      recentlyBattledTrainer.sprite.y
    );

    if (distanceFromRecentTrainer > 120) {
      this.shouldIgnoreRecentTrainerEncounter = false;
      this.recentlyBattledTrainerId = undefined;
    }
  }

  private showTrainerNotice(trainer: TrainerInstance): void {
    const exclamation = this.add
      .text(trainer.sprite.x, trainer.sprite.y - 44, '!', {
        fontSize: '28px',
        color: '#facc15',
        stroke: '#7c2d12',
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: exclamation,
      y: exclamation.y - 10,
      alpha: 0.35,
      duration: 220,
      yoyo: true,
      repeat: 1,
      onComplete: () => exclamation.destroy(),
    });
  }

  private startBattleWithTrainer(trainer: TrainerInstance): void {
    this.lineOfSightSequenceActive = false;
    this.nearbyTrainer = trainer;
    this.startNearbyBattle();
  }

  private startNearbyBattle(): void {
    if (!this.player || !this.nearbyTrainer || this.lineOfSightSequenceActive) {
      return;
    }

    updatePlayerPosition(this.player.x, this.player.y);
    persistPlayerState();
    this.statusText?.setText('Battle starting...');
    this.scene.start('BattleScene', {
      player: {
        name: this.playerState?.name ?? 'You',
        party: this.playerState?.party ?? [],
      },
      opponent: {
        id: this.nearbyTrainer.definition.id,
        name: this.nearbyTrainer.definition.name,
        party: this.nearbyTrainer.definition.party,
        defeated: this.defeatedTrainerIds.has(this.nearbyTrainer.definition.id),
      },
    });
  }
}
