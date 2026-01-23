import Phaser from 'phaser';

import { BootScene } from './scenes/boot_scene';
import { PreloadScene } from './scenes/preload_scene';
import { WorldScene } from './scenes/world_scene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'app',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false,
    },
  },
  scene: [BootScene, PreloadScene, WorldScene],
  backgroundColor: '#0f172a',
};

new Phaser.Game(config);
