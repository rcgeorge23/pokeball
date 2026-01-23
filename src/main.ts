import Phaser from 'phaser';

class BlankScene extends Phaser.Scene {
  create(): void {
    this.cameras.main.setBackgroundColor('#1b1f2a');
  }
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'app',
  scene: [BlankScene],
  backgroundColor: '#1b1f2a',
};

new Phaser.Game(config);
