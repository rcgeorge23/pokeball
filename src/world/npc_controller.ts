import Phaser from 'phaser';

import {
  canTrainerSeeTarget,
  DEFAULT_TRAINER_SIGHT_OPTIONS,
  FacingDirection,
} from './trainer_line_of_sight';

export type TrainerBehavior = 'stationary' | 'wander';

const DIRECTION_TO_VECTOR: Record<FacingDirection, Phaser.Math.Vector2> = {
  up: new Phaser.Math.Vector2(0, -1),
  down: new Phaser.Math.Vector2(0, 1),
  left: new Phaser.Math.Vector2(-1, 0),
  right: new Phaser.Math.Vector2(1, 0),
};

export interface TrainerDefinition {
  id: string;
  name: string;
  party: string[];
  behavior: TrainerBehavior;
  facing?: FacingDirection;
  x: number;
  y: number;
}

export interface TrainerInstance {
  definition: TrainerDefinition;
  sprite: Phaser.Physics.Arcade.Image;
  statusLabel: Phaser.GameObjects.Text;
  facingDirection: FacingDirection;
}

const WANDER_SPEED = 50;
const WANDER_DELAY_MIN = 900;
const WANDER_DELAY_MAX = 2000;

class TrainerActor {
  private nextMoveTime = 0;
  private currentVelocity = new Phaser.Math.Vector2(0, 0);
  private defeated = false;

  constructor(public readonly instance: TrainerInstance) {}

  getFacingVector(): Phaser.Math.Vector2 {
    return DIRECTION_TO_VECTOR[this.instance.facingDirection].clone();
  }

  setDefeated(defeated: boolean): void {
    this.defeated = defeated;
    if (defeated) {
      this.instance.sprite.setTint(0x94a3b8);
      this.instance.statusLabel.setText('Defeated').setVisible(true);
    } else {
      this.instance.sprite.setTint(0xf97316);
      this.instance.statusLabel.setVisible(false);
    }
  }

  update(time: number): void {
    if (this.defeated) {
      this.instance.sprite.setVelocity(0, 0);
      this.updateLabelPosition();
      return;
    }

    if (this.instance.definition.behavior !== 'wander') {
      this.instance.sprite.setVelocity(0, 0);
      this.updateLabelPosition();
      return;
    }

    if (time < this.nextMoveTime) {
      this.updateLabelPosition();
      return;
    }

    const choice = Phaser.Utils.Array.GetRandom([
      new Phaser.Math.Vector2(1, 0),
      new Phaser.Math.Vector2(-1, 0),
      new Phaser.Math.Vector2(0, 1),
      new Phaser.Math.Vector2(0, -1),
      new Phaser.Math.Vector2(0, 0),
    ]);

    const nextFacingDirection = vectorToFacingDirection(choice);
    if (nextFacingDirection) {
      this.instance.facingDirection = nextFacingDirection;
    }

    this.currentVelocity.copy(choice).scale(WANDER_SPEED);
    this.instance.sprite.setVelocity(
      this.currentVelocity.x,
      this.currentVelocity.y
    );
    this.nextMoveTime =
      time + Phaser.Math.Between(WANDER_DELAY_MIN, WANDER_DELAY_MAX);
    this.updateLabelPosition();
  }

  private updateLabelPosition(): void {
    this.instance.statusLabel.setPosition(
      this.instance.sprite.x,
      this.instance.sprite.y + 32
    );
  }
}

export class NpcController {
  private trainers: TrainerActor[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    trainerData: TrainerDefinition[]
  ) {
    trainerData.forEach((definition) => {
      const sprite = this.scene.physics.add.image(
        definition.x,
        definition.y,
        'player'
      );
      sprite.setScale(4);
      sprite.setTint(0xf97316);
      sprite.setCollideWorldBounds(true);

      const statusLabel = this.scene.add
        .text(definition.x, definition.y + 32, '', {
          fontSize: '12px',
          color: '#e2e8f0',
          backgroundColor: '#1f2937',
          padding: { x: 6, y: 2 },
        })
        .setOrigin(0.5, 0)
        .setVisible(false);

      this.trainers.push(
        new TrainerActor({
          definition,
          sprite,
          statusLabel,
          facingDirection: definition.facing ?? 'down',
        })
      );
    });
  }

  update(time: number): void {
    this.trainers.forEach((trainer) => trainer.update(time));
  }

  getInstances(): TrainerInstance[] {
    return this.trainers.map((trainer) => trainer.instance);
  }

  setDefeatedTrainerIds(defeatedIds: string[]): void {
    const defeatedSet = new Set(defeatedIds);
    this.trainers.forEach((trainer) => {
      trainer.setDefeated(defeatedSet.has(trainer.instance.definition.id));
    });
  }

  getFacingVector(trainerId: string): Phaser.Math.Vector2 | null {
    const trainer = this.trainers.find(
      (actor) => actor.instance.definition.id === trainerId
    );

    if (!trainer) {
      return null;
    }

    return trainer.getFacingVector();
  }

  findNearbyTrainer(
    player: Phaser.Physics.Arcade.Image,
    radius: number
  ): TrainerInstance | null {
    for (const trainer of this.trainers) {
      const { sprite } = trainer.instance;
      const distance = Phaser.Math.Distance.Between(
        player.x,
        player.y,
        sprite.x,
        sprite.y
      );
      if (distance <= radius) {
        return trainer.instance;
      }
    }
    return null;
  }

  findTrainerWithLineOfSight(
    player: Phaser.Physics.Arcade.Image,
    collisionLayer: Phaser.Tilemaps.TilemapLayer,
    options?: Partial<{
      maxDistance: number;
      minFacingDot: number;
      sampleStep: number;
    }>
  ): TrainerInstance | null {
    const sightOptions = {
      ...DEFAULT_TRAINER_SIGHT_OPTIONS,
      ...options,
    };

    for (const trainer of this.trainers) {
      const trainerPosition = {
        x: trainer.instance.sprite.x,
        y: trainer.instance.sprite.y,
      };
      const canSeePlayer = canTrainerSeeTarget(
        trainerPosition,
        trainer.instance.facingDirection,
        { x: player.x, y: player.y },
        (point) => {
          const tile = collisionLayer.getTileAtWorldXY(point.x, point.y);
          return Boolean(tile && tile.collides);
        },
        sightOptions
      );

      if (canSeePlayer) {
        return trainer.instance;
      }
    }

    return null;
  }
}

function vectorToFacingDirection(
  velocity: Phaser.Math.Vector2
): FacingDirection | null {
  if (Math.abs(velocity.x) > Math.abs(velocity.y)) {
    if (velocity.x > 0) {
      return 'right';
    }
    if (velocity.x < 0) {
      return 'left';
    }
  } else {
    if (velocity.y > 0) {
      return 'down';
    }
    if (velocity.y < 0) {
      return 'up';
    }
  }

  return null;
}
