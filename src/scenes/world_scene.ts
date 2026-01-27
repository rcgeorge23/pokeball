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
  private touchDirections = new Map<string, Phaser.Math.Vector2>();
  private joystickElement?: HTMLElement;

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
    if (!this.player) {
      return;
    }

    const speed = 180;
    const velocity = new Phaser.Math.Vector2(0, 0);

    if (this.cursors?.left?.isDown || this.moveKeys?.A?.isDown) {
      velocity.x -= 1;
    }
    if (this.cursors?.right?.isDown || this.moveKeys?.D?.isDown) {
      velocity.x += 1;
    }
    if (this.cursors?.up?.isDown || this.moveKeys?.W?.isDown) {
      velocity.y -= 1;
    }
    if (this.cursors?.down?.isDown || this.moveKeys?.S?.isDown) {
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
    const joystickElement = document.getElementById('joystick');
    if (!joystickElement) {
      return;
    }

    this.joystickElement = joystickElement;
    this.joystickElement.style.display = 'block';
    this.joystickElement.innerHTML = '';

    const normalizeAxis = (value: number): number => {
      if (!Number.isFinite(value)) {
        return 0;
      }
      if (Math.abs(value) > 1) {
        return Phaser.Math.Clamp(value / 100, -1, 1);
      }
      return Phaser.Math.Clamp(value, -1, 1);
    };

    const readAxis = (
      data: JoyStickData,
      ...keys: (keyof JoyStickData)[]
    ): number => {
      for (const key of keys) {
        const value = data[key];
        if (typeof value === 'number') {
          return value;
        }
      }
      return 0;
    };

    const directionFromLabel = (label?: string): Phaser.Math.Vector2 | null => {
      if (!label) {
        return null;
      }
      const normalized = label.trim().toLowerCase();
      const lookup: Record<string, Phaser.Math.Vector2> = {
        n: new Phaser.Math.Vector2(0, -1),
        north: new Phaser.Math.Vector2(0, -1),
        up: new Phaser.Math.Vector2(0, -1),
        ne: new Phaser.Math.Vector2(1, -1),
        northeast: new Phaser.Math.Vector2(1, -1),
        e: new Phaser.Math.Vector2(1, 0),
        east: new Phaser.Math.Vector2(1, 0),
        right: new Phaser.Math.Vector2(1, 0),
        se: new Phaser.Math.Vector2(1, 1),
        southeast: new Phaser.Math.Vector2(1, 1),
        s: new Phaser.Math.Vector2(0, 1),
        south: new Phaser.Math.Vector2(0, 1),
        down: new Phaser.Math.Vector2(0, 1),
        sw: new Phaser.Math.Vector2(-1, 1),
        southwest: new Phaser.Math.Vector2(-1, 1),
        w: new Phaser.Math.Vector2(-1, 0),
        west: new Phaser.Math.Vector2(-1, 0),
        left: new Phaser.Math.Vector2(-1, 0),
        nw: new Phaser.Math.Vector2(-1, -1),
        northwest: new Phaser.Math.Vector2(-1, -1),
      };

      return lookup[normalized] ?? null;
    };

    const updateDirection = (x: number, y: number) => {
      const direction = new Phaser.Math.Vector2(
        normalizeAxis(x),
        normalizeAxis(y)
      );
      if (direction.lengthSq() < 0.0001) {
        this.touchDirections.delete('joystick');
        return;
      }
      this.touchDirections.set('joystick', direction);
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
        const axisX = readAxis(
          stickData,
          'x',
          'X',
          'posX',
          'positionX'
        );
        const axisY = readAxis(
          stickData,
          'y',
          'Y',
          'posY',
          'positionY'
        );
        if (axisX !== 0 || axisY !== 0) {
          updateDirection(axisX, axisY);
          return;
        }

        const fallbackDirection = directionFromLabel(stickData.direction);
        if (fallbackDirection) {
          const distance = stickData.distance ?? 100;
          const scaledDistance = Phaser.Math.Clamp(distance / 100, 0, 1);
          fallbackDirection.normalize().scale(scaledDistance);
          if (fallbackDirection.lengthSq() < 0.0001) {
            this.touchDirections.delete('joystick');
          } else {
            this.touchDirections.set('joystick', fallbackDirection);
          }
          return;
        }

        this.touchDirections.delete('joystick');
      }
    );

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.touchDirections.delete('joystick');
      if (this.joystickElement) {
        this.joystickElement.style.display = 'none';
        this.joystickElement.innerHTML = '';
      }
    });
  }
}
