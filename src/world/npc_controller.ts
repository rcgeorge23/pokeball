import Phaser from 'phaser';

export type TrainerBehavior = 'stationary' | 'wander';

export interface TrainerDefinition {
  id: string;
  name: string;
  party: string[];
  behavior: TrainerBehavior;
  x: number;
  y: number;
}

export interface TrainerInstance {
  definition: TrainerDefinition;
  sprite: Phaser.Physics.Arcade.Image;
}

const WANDER_SPEED = 50;
const WANDER_DELAY_MIN = 900;
const WANDER_DELAY_MAX = 2000;

class TrainerActor {
  private nextMoveTime = 0;
  private currentVelocity = new Phaser.Math.Vector2(0, 0);

  constructor(public readonly instance: TrainerInstance) {}

  update(time: number): void {
    if (this.instance.definition.behavior !== 'wander') {
      this.instance.sprite.setVelocity(0, 0);
      return;
    }

    if (time < this.nextMoveTime) {
      return;
    }

    const choice = Phaser.Utils.Array.GetRandom([
      new Phaser.Math.Vector2(1, 0),
      new Phaser.Math.Vector2(-1, 0),
      new Phaser.Math.Vector2(0, 1),
      new Phaser.Math.Vector2(0, -1),
      new Phaser.Math.Vector2(0, 0),
    ]);

    this.currentVelocity.copy(choice).scale(WANDER_SPEED);
    this.instance.sprite.setVelocity(
      this.currentVelocity.x,
      this.currentVelocity.y
    );
    this.nextMoveTime =
      time + Phaser.Math.Between(WANDER_DELAY_MIN, WANDER_DELAY_MAX);
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

      this.trainers.push(
        new TrainerActor({
          definition,
          sprite,
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
}
