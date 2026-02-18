import Phaser from 'phaser';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  preload(): void {
    this.load.svg('player', 'assets/sprites/player.svg');
    this.load.svg('trainer', 'assets/sprites/trainer.svg');
    this.load.tilemapTiledJSON('town-route-map', 'assets/maps/town_route.json');
    this.load.image('town-tiles', 'assets/tilesets/town_tiles.png');
    this.load.json(
      'trainers',
      new URL('../data/trainers.json', import.meta.url).toString()
    );
    this.load.json(
      'pokemon',
      new URL('../data/pokemon.json', import.meta.url).toString()
    );
    this.load.json(
      'moves',
      new URL('../data/moves.json', import.meta.url).toString()
    );
  }

  create(): void {
    this.scene.start('WorldScene');
  }
}
