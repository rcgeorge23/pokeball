import Phaser from 'phaser';

import {
  NpcController,
  TrainerDefinition,
  TrainerInstance,
} from '../world/npc_controller';

export class WorldScene extends Phaser.Scene {
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private moveKeys?: Record<string, Phaser.Input.Keyboard.Key>;
  private player?: Phaser.Physics.Arcade.Image;
  private interactKey?: Phaser.Input.Keyboard.Key;
  private npcController?: NpcController;
  private hintText?: Phaser.GameObjects.Text;
  private statusText?: Phaser.GameObjects.Text;
  private nearbyTrainer: TrainerInstance | null = null;

  constructor() {
    super('WorldScene');
  }

  create(): void {
    const { width, height } = this.scale;
    const worldWidth = width * 2;
    const worldHeight = height * 2;

    this.add.rectangle(0, 0, worldWidth, worldHeight, 0x1e293b).setOrigin(0);

    this.player = this.physics.add.image(width / 2, height / 2, 'player');
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

    this.npcController.getInstances().forEach((trainer) => {
      this.physics.add.collider(trainer.sprite, walls);
    });

    this.add
      .text(24, 24, 'Move with WASD or arrow keys', {
        fontSize: '16px',
        color: '#e2e8f0',
      })
      .setScrollFactor(0);

    this.hintText = this.add
      .text(24, height - 48, '', {
        fontSize: '16px',
        color: '#f8fafc',
      })
      .setScrollFactor(0);

    this.statusText = this.add
      .text(24, height - 24, '', {
        fontSize: '14px',
        color: '#94a3b8',
      })
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

    velocity.normalize().scale(speed);
    this.player.setVelocity(velocity.x, velocity.y);

    this.npcController?.update(time);
    this.nearbyTrainer = this.npcController?.findNearbyTrainer(
      this.player,
      80
    );

    if (this.hintText) {
      if (this.nearbyTrainer) {
        this.hintText.setText(
          `Press E to battle ${this.nearbyTrainer.definition.name}`
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
      const opponentName = this.nearbyTrainer.definition.name;
      this.statusText?.setText(
        `You challenge ${opponentName}. Battle scene coming soon!`
      );
    }
  }
}
