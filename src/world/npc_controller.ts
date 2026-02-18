import Phaser from 'phaser';

import {
  canTrainerSeeTarget,
  DEFAULT_TRAINER_SIGHT_OPTIONS,
  FacingDirection,
} from './trainer_line_of_sight.js';

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
  private scriptedLock = false;

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
      this.instance.sprite.clearTint();
      this.instance.statusLabel.setVisible(false);
    }
  }

  setScriptedLock(locked: boolean): void {
    this.scriptedLock = locked;
    if (locked) {
      this.instance.sprite.setVelocity(0, 0);
    }
  }

  isDefeated(): boolean {
    return this.defeated;
  }

  update(time: number): void {
    if (this.scriptedLock) {
      this.instance.sprite.setVelocity(0, 0);
      this.updateLabelPosition();
      return;
    }

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
  private activeApproaches = new Map<
    string,
    {
      actor: TrainerActor;
      target: Phaser.Types.Math.Vector2Like;
      speed: number;
      stopDistance: number;
      startedAt: number;
      maxDurationMs: number;
      onComplete?: () => void;
    }
  >();

  constructor(
    private readonly scene: Phaser.Scene,
    trainerData: TrainerDefinition[]
  ) {
    trainerData.forEach((definition) => {
      const sprite = this.scene.physics.add.image(
        definition.x,
        definition.y,
        'trainer'
      );
      sprite.setScale(3);
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
    this.updateApproaches(time);
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

  getTrainerById(trainerId: string): TrainerInstance | null {
    const trainer = this.getTrainerActorById(trainerId);
    return trainer?.instance ?? null;
  }

  startApproach(
    trainerId: string,
    target: Phaser.Types.Math.Vector2Like,
    options?: {
      speed?: number;
      stopDistance?: number;
      maxDurationMs?: number;
      onComplete?: () => void;
    }
  ): boolean {
    const actor = this.getTrainerActorById(trainerId);
    if (!actor || actor.isDefeated()) {
      return false;
    }

    const speed = options?.speed ?? 120;
    const stopDistance = options?.stopDistance ?? 56;
    const maxDurationMs = options?.maxDurationMs ?? 2800;
    actor.setScriptedLock(true);

    this.activeApproaches.set(trainerId, {
      actor,
      target,
      speed,
      stopDistance,
      startedAt: this.scene.time.now,
      maxDurationMs,
      onComplete: options?.onComplete,
    });
    return true;
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
        (point: Phaser.Types.Math.Vector2Like) => {
          const tile = collisionLayer.getTileAtWorldXY(point.x, point.y);
          return Boolean(tile && tile.collides);
        },
        sightOptions
      );

      if (canSeePlayer && !trainer.isDefeated()) {
        return trainer.instance;
      }
    }

    return null;
  }

  private updateApproaches(time: number): void {
    for (const [trainerId, approach] of this.activeApproaches.entries()) {
      const trainerSprite = approach.actor.instance.sprite;
      const distanceToTarget = Phaser.Math.Distance.Between(
        trainerSprite.x,
        trainerSprite.y,
        approach.target.x,
        approach.target.y
      );

      const didTimeout = time - approach.startedAt >= approach.maxDurationMs;
      if (distanceToTarget <= approach.stopDistance || didTimeout) {
        trainerSprite.setVelocity(0, 0);
        approach.actor.setScriptedLock(false);
        this.activeApproaches.delete(trainerId);
        approach.onComplete?.();
        continue;
      }

      this.scene.physics.moveTo(
        trainerSprite,
        approach.target.x,
        approach.target.y,
        approach.speed
      );
    }
  }

  private getTrainerActorById(trainerId: string): TrainerActor | null {
    return (
      this.trainers.find(
        (actor) => actor.instance.definition.id === trainerId
      ) ?? null
    );
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
