import Phaser from 'phaser';

export class WorldScene extends Phaser.Scene {
  constructor() {
    super('WorldScene');
  }

  create(): void {
    const { width, height } = this.scale;

    this.add.rectangle(0, 0, width * 2, height * 2, 0x1e293b).setOrigin(0);
    this.add
      .text(width / 2, height / 2 - 80, 'World Scene', {
        fontSize: '32px',
        color: '#e2e8f0',
      })
      .setOrigin(0.5);

    const player = this.add.image(width / 2, height / 2, 'player');
    player.setScale(4);

    this.add
      .text(width / 2, height / 2 + 80, 'Assets loaded ✓', {
        fontSize: '16px',
        color: '#94a3b8',
      })
      .setOrigin(0.5);
  }
}
