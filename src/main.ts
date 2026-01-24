import Phaser from 'phaser';

import { BootScene } from './scenes/boot_scene';
import { BattleScene } from './scenes/battle_scene';
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
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  input: {
    activePointers: 3,
  },
  scene: [BootScene, PreloadScene, WorldScene, BattleScene],
  backgroundColor: '#0f172a',
};

new Phaser.Game(config);
