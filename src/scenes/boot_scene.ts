import Phaser from 'phaser';

import { initializePlayerState } from '../player/player_model';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    initializePlayerState();
    this.scale.scaleMode = Phaser.Scale.FIT;
    this.scale.autoCenter = Phaser.Scale.CENTER_BOTH;
    this.cameras.main.setBackgroundColor('#0f172a');
    this.scene.start('PreloadScene');
  }
}
