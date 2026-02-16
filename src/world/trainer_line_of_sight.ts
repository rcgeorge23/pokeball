export type FacingDirection = 'up' | 'down' | 'left' | 'right';

export interface Point2D {
  x: number;
  y: number;
}

export interface TrainerSightOptions {
  maxDistance: number;
  minFacingDot: number;
  sampleStep: number;
}

export const DEFAULT_TRAINER_SIGHT_OPTIONS: TrainerSightOptions = {
  maxDistance: 180,
  minFacingDot: Math.cos((35 * Math.PI) / 180),
  sampleStep: 8,
};

const DIRECTION_TO_VECTOR: Record<FacingDirection, Point2D> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export function canTrainerSeeTarget(
  trainerPosition: Point2D,
  facingDirection: FacingDirection,
  targetPosition: Point2D,
  isBlocked: (point: Point2D) => boolean,
  options: TrainerSightOptions = DEFAULT_TRAINER_SIGHT_OPTIONS
): boolean {
  const toTarget = {
    x: targetPosition.x - trainerPosition.x,
    y: targetPosition.y - trainerPosition.y,
  };

  const distance = Math.hypot(toTarget.x, toTarget.y);
  if (distance === 0 || distance > options.maxDistance) {
    return false;
  }

  const normalizedToTarget = {
    x: toTarget.x / distance,
    y: toTarget.y / distance,
  };
  const facingVector = DIRECTION_TO_VECTOR[facingDirection];
  const facingDot =
    normalizedToTarget.x * facingVector.x +
    normalizedToTarget.y * facingVector.y;

  if (facingDot < options.minFacingDot) {
    return false;
  }

  const steps = Math.floor(distance / options.sampleStep);
  for (let step = 1; step < steps; step += 1) {
    const point = {
      x: trainerPosition.x + normalizedToTarget.x * step * options.sampleStep,
      y: trainerPosition.y + normalizedToTarget.y * step * options.sampleStep,
    };
    if (isBlocked(point)) {
      return false;
    }
  }

  return true;
}
