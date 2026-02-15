export type DirectionVector = { x: number; y: number };

const DIRECTION_LOOKUP: Record<string, DirectionVector> = {
  n: { x: 0, y: -1 },
  north: { x: 0, y: -1 },
  up: { x: 0, y: -1 },
  ne: { x: 1, y: -1 },
  northeast: { x: 1, y: -1 },
  e: { x: 1, y: 0 },
  east: { x: 1, y: 0 },
  right: { x: 1, y: 0 },
  se: { x: 1, y: 1 },
  southeast: { x: 1, y: 1 },
  s: { x: 0, y: 1 },
  south: { x: 0, y: 1 },
  down: { x: 0, y: 1 },
  sw: { x: -1, y: 1 },
  southwest: { x: -1, y: 1 },
  w: { x: -1, y: 0 },
  west: { x: -1, y: 0 },
  left: { x: -1, y: 0 },
  nw: { x: -1, y: -1 },
  northwest: { x: -1, y: -1 },
};

export const normalizeAxis = (value: unknown): number => {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  if (Math.abs(numeric) > 1) {
    return Math.max(-1, Math.min(1, numeric / 100));
  }

  return Math.max(-1, Math.min(1, numeric));
};

export const readAxis = (
  data: JoyStickData,
  ...keys: (keyof JoyStickData)[]
): number => {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return 0;
};

export const directionFromLabel = (label?: string): DirectionVector | null => {
  if (!label) {
    return null;
  }

  return DIRECTION_LOOKUP[label.trim().toLowerCase()] ?? null;
};

export const deriveJoystickDirection = (
  stickData: JoyStickData
): DirectionVector | null => {
  const axisX = readAxis(stickData, 'x', 'X', 'posX', 'positionX');
  const axisY = readAxis(stickData, 'y', 'Y', 'posY', 'positionY');
  const normalizedX = normalizeAxis(axisX);
  const normalizedY = normalizeAxis(axisY);

  if (Math.abs(normalizedX) > 0 || Math.abs(normalizedY) > 0) {
    if (normalizedX * normalizedX + normalizedY * normalizedY < 0.0001) {
      return null;
    }

    return {
      x: normalizedX,
      y: normalizedY,
    };
  }

  const fallbackDirection = directionFromLabel(stickData.direction);
  if (!fallbackDirection) {
    return null;
  }

  const distance = normalizeAxis(stickData.distance ?? 100);
  if (Math.abs(distance) < 0.0001) {
    return null;
  }

  const magnitude = Math.hypot(fallbackDirection.x, fallbackDirection.y);
  if (magnitude < 0.0001) {
    return null;
  }

  return {
    x: (fallbackDirection.x / magnitude) * distance,
    y: (fallbackDirection.y / magnitude) * distance,
  };
};
