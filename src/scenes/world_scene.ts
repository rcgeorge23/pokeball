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
  private joystickPointerId: number | null = null;
  private joystickAnchor = new Phaser.Math.Vector2();
  private joystickMaxDistance = 0;
  private joystickKnob?: Phaser.GameObjects.Arc;

  constructor() {
    super('WorldScene');
  }

  create(): void {
    const { width, height } = this.scale;
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

    const magnitude = velocity.length();
    if (magnitude > 1) {
      velocity.normalize();
    }
    velocity.scale(speed);
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
    const baseRadius = 54;
    const knobRadius = 26;
    const maxDistance = 40;

    this.joystickAnchor.set(baseX, baseY);
    this.joystickMaxDistance = maxDistance;

    const base = this.add
      .circle(baseX, baseY, baseRadius, 0x0f172a, 0.6)
      .setStrokeStyle(2, 0x475569);
    base.setScrollFactor(0);
    base.setDepth(20);

    this.joystickKnob = this.add
      .circle(baseX, baseY, knobRadius, 0x94a3b8, 0.9)
      .setStrokeStyle(2, 0x0f172a);
    this.joystickKnob.setScrollFactor(0);
    this.joystickKnob.setDepth(21);

    const updateJoystick = (pointer: Phaser.Input.Pointer) => {
      const delta = new Phaser.Math.Vector2(
        pointer.x - this.joystickAnchor.x,
        pointer.y - this.joystickAnchor.y
      );
      if (delta.length() > this.joystickMaxDistance) {
        delta.setLength(this.joystickMaxDistance);
      }
      this.joystickKnob?.setPosition(
        this.joystickAnchor.x + delta.x,
        this.joystickAnchor.y + delta.y
      );
      const normalized = delta
        .clone()
        .scale(1 / Math.max(this.joystickMaxDistance, 1));
      this.touchDirections.set(pointer.id, normalized);
    };

    const startJoystick = (pointer: Phaser.Input.Pointer) => {
      this.joystickPointerId = pointer.id;
      updateJoystick(pointer);
    };

    const stopJoystick = (pointer: Phaser.Input.Pointer) => {
      if (this.joystickPointerId !== pointer.id) {
        return;
      }
      this.touchDirections.delete(pointer.id);
      this.joystickPointerId = null;
      this.joystickKnob?.setPosition(
        this.joystickAnchor.x,
        this.joystickAnchor.y
      );
    };

    const hitArea = new Phaser.Geom.Circle(baseX, baseY, baseRadius);
    base.setInteractive(hitArea, Phaser.Geom.Circle.Contains);
    this.joystickKnob.setInteractive(
      new Phaser.Geom.Circle(baseX, baseY, knobRadius),
      Phaser.Geom.Circle.Contains
    );

    base.on('pointerdown', startJoystick);
    this.joystickKnob.on('pointerdown', startJoystick);

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.joystickPointerId === pointer.id) {
        updateJoystick(pointer);
      }
    });

    this.input.on('pointerup', stopJoystick);
    this.input.on('pointerupoutside', stopJoystick);

    this.add
      .text(baseX - baseRadius, baseY - baseRadius - 30, 'Joystick', {
        fontSize: '14px',
        color: '#cbd5f5',
      })
      .setScrollFactor(0)
      .setDepth(20);
  }
}
