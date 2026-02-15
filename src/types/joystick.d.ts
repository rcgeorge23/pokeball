interface JoyStickData {
  x?: number | string;
  y?: number | string;
  X?: number | string;
  Y?: number | string;
  posX?: number | string;
  posY?: number | string;
  positionX?: number | string;
  positionY?: number | string;
  direction?: string;
  distance?: number | string;
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
