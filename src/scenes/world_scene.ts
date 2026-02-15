import Phaser from 'phaser';

import {
  NpcController,
  TrainerDefinition,
  TrainerInstance,
} from '../world/npc_controller';
import {
  getPlayerState,
  persistPlayerState,
  PlayerState,
  updatePlayerPosition,
} from '../player/player_model';
import { deriveJoystickDirection } from '../world/joystick_input';

export class WorldScene extends Phaser.Scene {
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private moveKeys?: Record<string, Phaser.Input.Keyboard.Key>;
  private player?: Phaser.Physics.Arcade.Image;
  private interactKey?: Phaser.Input.Keyboard.Key;
  private npcController?: NpcController;
  private hintText?: Phaser.GameObjects.Text;
  private statusText?: Phaser.GameObjects.Text;
  private nearbyTrainer: TrainerInstance | null = null;
  private playerState!: PlayerState;
  private defeatedTrainerIds = new Set<string>();
  private lastSaveTime = 0;
  private touchDirections = new Map<string, Phaser.Math.Vector2>();
  private joystickElement?: HTMLElement;
  private battleButton?: HTMLButtonElement;
  private pokedexOpenButton?: HTMLButtonElement;
  private pokedexPanel?: HTMLElement;
  private pokedexList?: HTMLElement;
  private pokedexCloseButton?: HTMLButtonElement;
  private readonly isTouchDevice =
    'ontouchstart' in window || navigator.maxTouchPoints > 0;

  constructor() {
    super('WorldScene');
  }

  create(): void {
    const { width, height } = this.scale;
    const worldWidth = width * 2;
    const worldHeight = height * 2;
    this.playerState = getPlayerState();
    this.defeatedTrainerIds = new Set(this.playerState.defeatedTrainerIds);

    this.add.rectangle(0, 0, worldWidth, worldHeight, 0x1e293b).setOrigin(0);

    const playerStartX = this.playerState.position?.x ?? width / 2;
    const playerStartY = this.playerState.position?.y ?? height / 2;

    this.player = this.physics.add.image(
      playerStartX,
      playerStartY,
      'player'
    );
    this.player.setScale(4);
    this.player.setCollideWorldBounds(true);

    const walls = this.physics.add.staticGroup();
    const wallSpecs = [
      { x: worldWidth / 2, y: 140, w: 420, h: 36 },
      { x: worldWidth - 200, y: worldHeight / 2, w: 36, h: 360 },
      { x: 220, y: worldHeight - 160, w: 320, h: 36 },
    ];

    wallSpecs.forEach(({ x, y, w, h }) => {
      const wall = this.add.rectangle(x, y, w, h, 0x334155);
      this.physics.add.existing(wall, true);
      walls.add(wall);
    });

    this.physics.add.collider(this.player, walls);
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);

    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.startFollow(this.player);

    this.input.addPointer(2);
    this.cursors = this.input.keyboard?.createCursorKeys();
    this.moveKeys = this.input.keyboard?.addKeys('W,A,S,D') as Record<
      string,
      Phaser.Input.Keyboard.Key
    >;
    this.interactKey = this.input.keyboard?.addKey(
      Phaser.Input.Keyboard.KeyCodes.E
    );

    const trainerData =
      this.cache.json.get('trainers') ?? ([] as TrainerDefinition[]);
    this.npcController = new NpcController(
      this,
      trainerData as TrainerDefinition[]
    );
    this.npcController.setDefeatedTrainerIds(this.playerState.defeatedTrainerIds);

    this.npcController.getInstances().forEach((trainer) => {
      this.physics.add.collider(trainer.sprite, walls);
    });

    this.add
      .text(24, 24, 'Move with WASD, arrow keys, or touch controls', {
        fontSize: '16px',
        color: '#e2e8f0',
      })
      .setScrollFactor(0);

    this.createTouchControls();

    this.hintText = this.add
      .text(24, height - 48, '', {
        fontSize: '16px',
        color: '#f8fafc',
      })
      .setScrollFactor(0);

    this.statusText = this.add
      .text(
        24,
        height - 24,
        `Pokédex: ${this.playerState.pokedex.length}`,
        {
          fontSize: '14px',
          color: '#94a3b8',
        }
      )
      .setScrollFactor(0);

    this.setupPokedexUi();
  }

  update(time: number): void {
    if (!this.player) {
      return;
    }

    const speed = 180;
    const velocity = new Phaser.Math.Vector2(0, 0);

    if (this.cursors?.left?.isDown || this.moveKeys?.A?.isDown) {
      velocity.x -= 1;
    }
    if (this.cursors?.right?.isDown || this.moveKeys?.D?.isDown) {
      velocity.x += 1;
    }
    if (this.cursors?.up?.isDown || this.moveKeys?.W?.isDown) {
      velocity.y -= 1;
    }
    if (this.cursors?.down?.isDown || this.moveKeys?.S?.isDown) {
      velocity.y += 1;
    }

    for (const direction of this.touchDirections.values()) {
      velocity.x += direction.x;
      velocity.y += direction.y;
    }

    const magnitude = velocity.length();
    if (magnitude > 1) {
      velocity.normalize();
    }
    velocity.scale(speed);
    this.player.setVelocity(velocity.x, velocity.y);

    this.npcController?.update(time);
    this.nearbyTrainer =
      this.npcController?.findNearbyTrainer(this.player, 80) ?? null;

    if (this.hintText) {
      if (this.nearbyTrainer) {
        const isDefeated = this.defeatedTrainerIds.has(
          this.nearbyTrainer.definition.id
        );
        this.hintText.setText(
          isDefeated
            ? `${this.nearbyTrainer.definition.name} is defeated. Press E to rematch.`
            : `Press E to battle ${this.nearbyTrainer.definition.name}`
        );
      } else {
        this.hintText.setText('');
      }
    }

    this.updateBattleButton();

    if (this.interactKey && Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      this.startNearbyBattle();
    }

    if (time - this.lastSaveTime > 1500) {
      updatePlayerPosition(this.player.x, this.player.y);
      persistPlayerState();
      this.lastSaveTime = time;
    }
  }

  private createTouchControls(): void {
    const joystickElement = document.getElementById('joystick');
    if (!joystickElement) {
      return;
    }

    this.joystickElement = joystickElement;
    this.joystickElement.style.display = 'block';
    this.joystickElement.innerHTML = '';

    const updateDirection = (directionData: JoyStickData) => {
      const direction = deriveJoystickDirection(directionData);
      if (!direction) {
        this.touchDirections.delete('joystick');
        return;
      }

      this.touchDirections.set(
        'joystick',
        new Phaser.Math.Vector2(direction.x, direction.y)
      );
    };

    new JoyStick(
      'joystick',
      {
        title: 'Joystick',
        internalFillColor: '#94a3b8',
        internalStrokeColor: '#0f172a',
        externalStrokeColor: '#475569',
      },
      (stickData: JoyStickData) => {
        updateDirection(stickData);
      }
    );

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.touchDirections.delete('joystick');
      if (this.joystickElement) {
        this.joystickElement.style.display = 'none';
        this.joystickElement.innerHTML = '';
      }
    });

    this.createBattleButton();
  }

  private createBattleButton(): void {
    const battleButton = document.getElementById('battle-button');
    if (!battleButton || !this.isTouchDevice) {
      return;
    }

    this.battleButton = battleButton as HTMLButtonElement;
    this.battleButton.style.display = 'none';
    const onBattlePress = () => {
      this.startNearbyBattle();
    };

    this.battleButton.addEventListener('click', onBattlePress);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (!this.battleButton) {
        return;
      }

      this.battleButton.style.display = 'none';
      this.battleButton.textContent = 'Battle';
      this.battleButton.removeEventListener('click', onBattlePress);
      this.battleButton = undefined;
    });
  }

  private setupPokedexUi(): void {
    const pokedexOpenButton = document.getElementById('pokedex-open-button');
    const pokedexPanel = document.getElementById('pokedex-panel');
    const pokedexList = document.getElementById('pokedex-list');
    const pokedexCloseButton = document.getElementById('pokedex-close-button');

    if (
      !pokedexOpenButton ||
      !pokedexPanel ||
      !pokedexList ||
      !pokedexCloseButton
    ) {
      return;
    }

    this.pokedexOpenButton = pokedexOpenButton as HTMLButtonElement;
    this.pokedexPanel = pokedexPanel;
    this.pokedexList = pokedexList;
    this.pokedexCloseButton = pokedexCloseButton as HTMLButtonElement;

    const openPokedex = () => {
      this.refreshPokedexList();
      if (!this.pokedexPanel) {
        return;
      }

      this.pokedexPanel.style.display = 'flex';
      this.pokedexPanel.setAttribute('aria-hidden', 'false');
    };

    const closePokedex = () => {
      if (!this.pokedexPanel) {
        return;
      }

      this.pokedexPanel.style.display = 'none';
      this.pokedexPanel.setAttribute('aria-hidden', 'true');
    };

    this.pokedexOpenButton.addEventListener('click', openPokedex);
    this.pokedexCloseButton.addEventListener('click', closePokedex);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.pokedexOpenButton?.removeEventListener('click', openPokedex);
      this.pokedexCloseButton?.removeEventListener('click', closePokedex);

      if (this.pokedexPanel) {
        this.pokedexPanel.style.display = 'none';
        this.pokedexPanel.setAttribute('aria-hidden', 'true');
      }

      this.pokedexOpenButton = undefined;
      this.pokedexPanel = undefined;
      this.pokedexList = undefined;
      this.pokedexCloseButton = undefined;
    });
  }

  private refreshPokedexList(): void {
    if (!this.pokedexList) {
      return;
    }

    const pokemonData =
      (this.cache.json.get('pokemon') as { id: string; name: string }[]) ?? [];
    const nameById = new Map(pokemonData.map((pokemon) => [pokemon.id, pokemon.name]));

    const pokedexList = this.pokedexList;
    pokedexList.innerHTML = '';

    if (this.playerState.pokedex.length === 0) {
      const entry = document.createElement('li');
      entry.textContent = 'No Pokémon discovered yet.';
      pokedexList.append(entry);
      return;
    }

    this.playerState.pokedex.forEach((pokemonId) => {
      const entry = document.createElement('li');
      entry.textContent = nameById.get(pokemonId) ?? pokemonId;
      pokedexList.append(entry);
    });
  }

  private updateBattleButton(): void {
    if (!this.battleButton) {
      return;
    }

    this.battleButton.style.display = this.nearbyTrainer ? 'block' : 'none';
    this.battleButton.textContent = this.nearbyTrainer
      ? `Battle ${this.nearbyTrainer.definition.name}`
      : 'Battle';
  }

  private startNearbyBattle(): void {
    if (!this.player || !this.nearbyTrainer) {
      return;
    }

    updatePlayerPosition(this.player.x, this.player.y);
    persistPlayerState();
    this.statusText?.setText('Battle starting...');
    this.scene.start('BattleScene', {
      player: {
        name: this.playerState?.name ?? 'You',
        party: this.playerState?.party ?? [],
      },
      opponent: {
        id: this.nearbyTrainer.definition.id,
        name: this.nearbyTrainer.definition.name,
        party: this.nearbyTrainer.definition.party,
        defeated: this.defeatedTrainerIds.has(this.nearbyTrainer.definition.id),
      },
    });
  }
}
