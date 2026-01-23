import Phaser from 'phaser';

const PLAYER_DATA_URI =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAPCAYAAAA71pVKAAAAM0lEQVQoU2NkYGD4z0AEMDEwMDD8T2JgYGBg+P//PwMDA8M/AwMDAwMAAAVoA3sJd8CRAAAAAElFTkSuQmCC';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  preload(): void {
    this.load.image('player', PLAYER_DATA_URI);
  }

  create(): void {
    this.scene.start('WorldScene');
  }
}
