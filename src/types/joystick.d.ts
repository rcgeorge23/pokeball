interface JoyStickData {
  x?: number;
  y?: number;
  X?: number;
  Y?: number;
  posX?: number;
  posY?: number;
  positionX?: number;
  positionY?: number;
  direction?: string;
  distance?: number;
}

interface JoyStick {
  GetPosX?: () => number;
  GetPosY?: () => number;
  GetX?: () => number;
  GetY?: () => number;
  GetDir?: () => string;
}

declare const JoyStick: {
  new (
    containerId: string,
    options?: Record<string, unknown>,
    callback?: (stickData: JoyStickData) => void
  ): JoyStick;
};
