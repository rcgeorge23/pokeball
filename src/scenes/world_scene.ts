import Phaser from 'phaser';

import {
  NpcController,
  TrainerDefinition,
  TrainerInstance,
} from '../world/npc_controller';
import {
  getPlayerState,
  persistPlayerState,
  PlayerState,
  updatePlayerPosition,
} from '../player/player_model';

export class WorldScene extends Phaser.Scene {
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private moveKeys?: Record<string, Phaser.Input.Keyboard.Key>;
  private player?: Phaser.Physics.Arcade.Image;
  private interactKey?: Phaser.Input.Keyboard.Key;
  private npcController?: NpcController;
  private hintText?: Phaser.GameObjects.Text;
  private statusText?: Phaser.GameObjects.Text;
  private nearbyTrainer: TrainerInstance | null = null;
  private playerState!: PlayerState;
  private defeatedTrainerIds = new Set<string>();
  private lastSaveTime = 0;
  private touchDirections = new Map<number, Phaser.Math.Vector2>();

  constructor() {
    super('WorldScene');
  }

  create(): void {
    const { height } = this.scale;
    const worldWidth = width * 2;
    const worldHeight = height * 2;
    this.playerState = getPlayerState();
    this.defeatedTrainerIds = new Set(this.playerState.defeatedTrainerIds);

    this.add.rectangle(0, 0, worldWidth, worldHeight, 0x1e293b).setOrigin(0);

    const playerStartX = this.playerState.position?.x ?? width / 2;
    const playerStartY = this.playerState.position?.y ?? height / 2;

    this.player = this.physics.add.image(
      playerStartX,
      playerStartY,
      'player'
    );
    this.player.setScale(4);
    this.player.setCollideWorldBounds(true);

    const walls = this.physics.add.staticGroup();
    const wallSpecs = [
      { x: worldWidth / 2, y: 140, w: 420, h: 36 },
      { x: worldWidth - 200, y: worldHeight / 2, w: 36, h: 360 },
      { x: 220, y: worldHeight - 160, w: 320, h: 36 },
    ];

    wallSpecs.forEach(({ x, y, w, h }) => {
      const wall = this.add.rectangle(x, y, w, h, 0x334155);
      this.physics.add.existing(wall, true);
      walls.add(wall);
    });

    this.physics.add.collider(this.player, walls);
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);

    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.startFollow(this.player);

    this.input.addPointer(2);
    this.cursors = this.input.keyboard?.createCursorKeys();
    this.moveKeys = this.input.keyboard?.addKeys('W,A,S,D') as Record<
      string,
      Phaser.Input.Keyboard.Key
    >;
    this.interactKey = this.input.keyboard?.addKey(
      Phaser.Input.Keyboard.KeyCodes.E
    );

    const trainerData =
      this.cache.json.get('trainers') ?? ([] as TrainerDefinition[]);
    this.npcController = new NpcController(
      this,
      trainerData as TrainerDefinition[]
    );
    this.npcController.setDefeatedTrainerIds(this.playerState.defeatedTrainerIds);

    this.npcController.getInstances().forEach((trainer) => {
      this.physics.add.collider(trainer.sprite, walls);
    });

    this.add
      .text(24, 24, 'Move with WASD or arrow keys', {
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
  }

  update(time: number): void {
    if (!this.player || !this.cursors || !this.moveKeys) {
      return;
    }

    const speed = 180;
    const velocity = new Phaser.Math.Vector2(0, 0);

    if (this.cursors.left?.isDown || this.moveKeys.A.isDown) {
      velocity.x -= 1;
    }
    if (this.cursors.right?.isDown || this.moveKeys.D.isDown) {
      velocity.x += 1;
    }
    if (this.cursors.up?.isDown || this.moveKeys.W.isDown) {
      velocity.y -= 1;
    }
    if (this.cursors.down?.isDown || this.moveKeys.S.isDown) {
      velocity.y += 1;
    }

    for (const direction of this.touchDirections.values()) {
      velocity.x += direction.x;
      velocity.y += direction.y;
    }

    velocity.normalize().scale(speed);
    this.player.setVelocity(velocity.x, velocity.y);

    this.npcController?.update(time);
    this.nearbyTrainer =
      this.npcController?.findNearbyTrainer(this.player, 80) ?? null;

    if (this.hintText) {
      if (this.nearbyTrainer) {
        const isDefeated = this.defeatedTrainerIds.has(
          this.nearbyTrainer.definition.id
        );
        this.hintText.setText(
          isDefeated
            ? `${this.nearbyTrainer.definition.name} is defeated. Press E to rematch.`
            : `Press E to battle ${this.nearbyTrainer.definition.name}`
        );
      } else {
        this.hintText.setText('');
      }
    }

    if (
      this.nearbyTrainer &&
      this.interactKey &&
      Phaser.Input.Keyboard.JustDown(this.interactKey)
    ) {
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
          defeated: this.defeatedTrainerIds.has(
            this.nearbyTrainer.definition.id
          ),
        },
      });
    }

    if (time - this.lastSaveTime > 1500) {
      updatePlayerPosition(this.player.x, this.player.y);
      persistPlayerState();
      this.lastSaveTime = time;
    }
  }

  private createTouchControls(): void {
    const { height } = this.scale;
    const baseX = 90;
    const baseY = height - 140;
    const buttonSize = 54;
    const gap = 10;

    const labelStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: '18px',
      color: '#f8fafc',
    };

    const createButton = (
      x: number,
      y: number,
      label: string,
      direction: Phaser.Math.Vector2
    ) => {
      const rect = this.add
        .rectangle(x, y, buttonSize, buttonSize, 0x1e293b, 0.8)
        .setOrigin(0)
        .setStrokeStyle(2, 0x475569);
      const text = this.add
        .text(x + buttonSize / 2, y + buttonSize / 2, label, labelStyle)
        .setOrigin(0.5);
      const container = this.add.container(0, 0, [rect, text]);
      container.setScrollFactor(0);
      container.setSize(buttonSize, buttonSize);
      container.setInteractive(
        new Phaser.Geom.Rectangle(x, y, buttonSize, buttonSize),
        Phaser.Geom.Rectangle.Contains
      );

      const setDirection = (pointer: Phaser.Input.Pointer) => {
        this.touchDirections.set(pointer.id, direction.clone());
      };

      const clearDirection = (pointer: Phaser.Input.Pointer) => {
        this.touchDirections.delete(pointer.id);
      };

      container.on('pointerdown', setDirection);
      container.on('pointerup', clearDirection);
      container.on('pointerout', clearDirection);
      return container;
    };

    createButton(
      baseX,
      baseY - buttonSize - gap,
      '▲',
      new Phaser.Math.Vector2(0, -1)
    );
    createButton(
      baseX,
      baseY + buttonSize + gap,
      '▼',
      new Phaser.Math.Vector2(0, 1)
    );
    createButton(
      baseX - buttonSize - gap,
      baseY,
      '◀',
      new Phaser.Math.Vector2(-1, 0)
    );
    createButton(
      baseX + buttonSize + gap,
      baseY,
      '▶',
      new Phaser.Math.Vector2(1, 0)
    );

    this.add
      .text(baseX - buttonSize, baseY - buttonSize - 40, 'Touch controls', {
        fontSize: '14px',
        color: '#cbd5f5',
      })
      .setScrollFactor(0);
  }
}
