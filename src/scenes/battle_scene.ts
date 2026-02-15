import Phaser from 'phaser';

import {
  buildIndex,
  calculateDamage,
  createTrainerState,
  decideFirstActor,
  MoveDefinition,
  PokemonDefinition,
  PokemonInstance,
  TrainerState,
} from '../battle/battle_model';
import { applyVictoryReward } from '../battle/rewards';
import {
  addPokemonToPokedex,
  isTrainerDefeated,
  markTrainerDefeated,
} from '../player/player_model';

interface BattleSceneData {
  player: {
    name: string;
    party: string[];
  };
  opponent: {
    id: string;
    name: string;
    party: string[];
    defeated?: boolean;
  };
}

export class BattleScene extends Phaser.Scene {
  private playerTrainer?: TrainerState;
  private opponentTrainer?: TrainerState;
  private playerPokemon?: PokemonInstance;
  private opponentPokemon?: PokemonInstance;
  private logText?: Phaser.GameObjects.Text;
  private playerHpBar?: Phaser.GameObjects.Rectangle;
  private opponentHpBar?: Phaser.GameObjects.Rectangle;
  private playerHpText?: Phaser.GameObjects.Text;
  private opponentHpText?: Phaser.GameObjects.Text;
  private playerNameText?: Phaser.GameObjects.Text;
  private opponentNameText?: Phaser.GameObjects.Text;
  private moveButtons: Phaser.GameObjects.Container[] = [];
  private isResolving = false;
  private opponentTrainerId?: string;
  private opponentAlreadyDefeated = false;
  private playerPokemonIndex = 0;
  private opponentPokemonIndex = 0;

  constructor() {
    super('BattleScene');
  }

  create(data: BattleSceneData): void {
    this.resetBattleState();

    this.opponentTrainerId = data.opponent.id;
    this.opponentAlreadyDefeated =
      data.opponent.defeated ??
      (this.opponentTrainerId
        ? isTrainerDefeated(this.opponentTrainerId)
        : false);

    const pokemonData =
      (this.cache.json.get('pokemon') as PokemonDefinition[]) ?? [];
    const moveData = (this.cache.json.get('moves') as MoveDefinition[]) ?? [];
    const pokemonIndex = buildIndex(pokemonData);
    const moveIndex = buildIndex(moveData);

    this.playerTrainer = createTrainerState(
      data.player.name,
      data.player.party,
      pokemonIndex,
      moveIndex
    );
    this.opponentTrainer = createTrainerState(
      data.opponent.name,
      data.opponent.party,
      pokemonIndex,
      moveIndex
    );

    this.playerPokemonIndex = 0;
    this.opponentPokemonIndex = 0;
    this.playerPokemon = this.playerTrainer.party[this.playerPokemonIndex];
    this.opponentPokemon = this.opponentTrainer.party[this.opponentPokemonIndex];

    this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x0f172a)
      .setOrigin(0);

    this.add
      .text(24, 24, `Battle vs ${this.opponentTrainer.name}`, {
        fontSize: '20px',
        color: '#f8fafc',
      })
      .setScrollFactor(0);

    this.add
      .image(this.scale.width * 0.25, this.scale.height * 0.55, 'player')
      .setScale(6)
      .setTint(0x38bdf8);

    this.add
      .image(this.scale.width * 0.75, this.scale.height * 0.3, 'player')
      .setScale(6)
      .setTint(0xf97316);

    this.renderStatusPanels();
    this.renderMoveButtons();
    this.updateHpBars();

    this.logText = this.add
      .text(24, this.scale.height - 160, 'Choose a move.', {
        fontSize: '16px',
        color: '#e2e8f0',
      })
      .setScrollFactor(0);
  }

  private resetBattleState(): void {
    this.time.removeAllEvents();
    this.isResolving = false;
    this.clearMoveButtons();
    this.playerTrainer = undefined;
    this.opponentTrainer = undefined;
    this.playerPokemon = undefined;
    this.opponentPokemon = undefined;
    this.opponentTrainerId = undefined;
    this.opponentAlreadyDefeated = false;
    this.playerPokemonIndex = 0;
    this.opponentPokemonIndex = 0;
  }

  private renderStatusPanels(): void {
    if (!this.playerPokemon || !this.opponentPokemon) {
      return;
    }

    this.add
      .rectangle(20, this.scale.height - 260, 260, 80, 0x1e293b)
      .setOrigin(0)
      .setStrokeStyle(2, 0x334155);
    this.add
      .rectangle(this.scale.width - 280, 80, 260, 80, 0x1e293b)
      .setOrigin(0)
      .setStrokeStyle(2, 0x334155);

    this.playerNameText = this.add.text(
      32,
      this.scale.height - 252,
      this.playerPokemon.name,
      {
        fontSize: '16px',
        color: '#f8fafc',
      }
    );

    this.opponentNameText = this.add.text(
      this.scale.width - 268,
      88,
      this.opponentPokemon.name,
      {
        fontSize: '16px',
        color: '#f8fafc',
      }
    );

    this.playerHpBar = this.add
      .rectangle(32, this.scale.height - 222, 200, 12, 0x22c55e)
      .setOrigin(0);
    this.opponentHpBar = this.add
      .rectangle(this.scale.width - 268, 118, 200, 12, 0x22c55e)
      .setOrigin(0);

    this.playerHpText = this.add.text(32, this.scale.height - 204, '', {
      fontSize: '14px',
      color: '#cbd5f5',
    });

    this.opponentHpText = this.add.text(this.scale.width - 268, 136, '', {
      fontSize: '14px',
      color: '#cbd5f5',
    });
  }

  private refreshStatusPanels(): void {
    if (
      !this.playerPokemon ||
      !this.opponentPokemon ||
      !this.playerNameText ||
      !this.opponentNameText
    ) {
      return;
    }

    this.playerNameText.setText(this.playerPokemon.name);
    this.opponentNameText.setText(this.opponentPokemon.name);
    this.updateHpBars();
  }

  private clearMoveButtons(): void {
    this.moveButtons.forEach((button) => button.destroy());
    this.moveButtons = [];
  }

  private refreshMoveButtons(): void {
    this.clearMoveButtons();
    this.renderMoveButtons();
  }

  private setPlayerPokemon(index: number): void {
    if (!this.playerTrainer) {
      return;
    }
    this.playerPokemonIndex = index;
    this.playerPokemon = this.playerTrainer.party[index];
    this.refreshStatusPanels();
    this.refreshMoveButtons();
  }

  private setOpponentPokemon(index: number): void {
    if (!this.opponentTrainer) {
      return;
    }
    this.opponentPokemonIndex = index;
    this.opponentPokemon = this.opponentTrainer.party[index];
    this.refreshStatusPanels();
  }

  private renderMoveButtons(): void {
    if (!this.playerPokemon) {
      return;
    }

    const buttonWidth = 160;
    const buttonHeight = 48;
    const startX = 24;
    const gap = 12;
    const totalRows = Math.ceil(this.playerPokemon.moves.length / 2);
    const layoutHeight =
      totalRows * buttonHeight + Math.max(0, totalRows - 1) * gap;
    const startY = this.scale.height - layoutHeight - 24;

    this.playerPokemon.moves.forEach((move, index) => {
      const row = Math.floor(index / 2);
      const col = index % 2;
      const x = startX + col * (buttonWidth + gap);
      const y = startY + row * (buttonHeight + gap);

      const button = this.add
        .rectangle(0, 0, buttonWidth, buttonHeight, 0x334155)
        .setOrigin(0)
        .setStrokeStyle(2, 0x475569);

      const label = this.add.text(12, 12, move.name, {
        fontSize: '16px',
        color: '#f8fafc',
      });

      const container = this.add.container(x, y, [button, label]);
      container.setSize(buttonWidth, buttonHeight);
      container.setInteractive(
        new Phaser.Geom.Rectangle(0, 0, buttonWidth, buttonHeight),
        Phaser.Geom.Rectangle.Contains
      );
      container.on('pointerdown', () => this.handlePlayerMove(move));
      this.moveButtons.push(container);
    });
  }

  private handlePlayerMove(move: MoveDefinition): void {
    if (this.isResolving || !this.playerPokemon || !this.opponentPokemon) {
      return;
    }

    this.isResolving = true;
    this.setButtonsEnabled(false);

    const opponentMove = Phaser.Utils.Array.GetRandom(
      this.opponentPokemon.moves
    );
    const firstActor = decideFirstActor(
      this.playerPokemon,
      this.opponentPokemon,
      () => Phaser.Math.FloatBetween(0, 1)
    );

    const firstLabel =
      firstActor === 'a' ? this.playerPokemon.name : this.opponentPokemon.name;
    this.logText?.setText(`Turn order: ${firstLabel} moves first!`);

    const firstMove = firstActor === 'a' ? move : opponentMove;
    const secondMove = firstActor === 'a' ? opponentMove : move;
    const firstSide = firstActor === 'a' ? 'player' : 'opponent';
    const secondSide = firstSide === 'player' ? 'opponent' : 'player';

    this.time.delayedCall(700, () => {
      const firstResult = this.resolveAction(firstSide, firstMove);
      if (firstResult !== 'continue') {
        return;
      }

      this.time.delayedCall(700, () => {
        const secondResult = this.resolveAction(secondSide, secondMove);
        if (secondResult === 'continue') {
          this.isResolving = false;
          this.setButtonsEnabled(true);
        }
      });
    });
  }

  private resolveAction(
    attackerSide: 'player' | 'opponent',
    move: MoveDefinition
  ): 'continue' | 'switching' | 'ended' {
    if (!this.playerPokemon || !this.opponentPokemon) {
      return 'ended';
    }

    const attacker =
      attackerSide === 'player' ? this.playerPokemon : this.opponentPokemon;
    const defender =
      attackerSide === 'player' ? this.opponentPokemon : this.playerPokemon;

    const damage = calculateDamage(attacker, defender, move);

    defender.hp = Math.max(0, defender.hp - damage);
    this.updateHpBars();
    this.logText?.setText(`${attacker.name} used ${move.name}!`);

    if (defender.hp > 0) {
      return 'continue';
    }

    if (attackerSide === 'player') {
      const nextOpponentIndex = this.opponentPokemonIndex + 1;
      if (
        this.opponentTrainer &&
        nextOpponentIndex < this.opponentTrainer.party.length
      ) {
        const faintedName = defender.name;
        this.time.delayedCall(700, () => {
          this.setOpponentPokemon(nextOpponentIndex);
          this.logText?.setText(
            `${faintedName} fainted! ${this.opponentTrainer?.name} sent out ${this.opponentPokemon?.name}!`
          );
          this.isResolving = false;
          this.setButtonsEnabled(true);
        });
        return 'switching';
      }

      this.endBattle('win');
      return 'ended';
    }

    const nextPlayerIndex = this.playerPokemonIndex + 1;
    if (this.playerTrainer && nextPlayerIndex < this.playerTrainer.party.length) {
      const faintedName = defender.name;
      this.time.delayedCall(700, () => {
        this.setPlayerPokemon(nextPlayerIndex);
        this.logText?.setText(
          `${faintedName} fainted! Go ${this.playerPokemon?.name}!`
        );
        this.isResolving = false;
        this.setButtonsEnabled(true);
      });
      return 'switching';
    }

    this.endBattle('lose');
    return 'ended';
  }

  private endBattle(result: 'win' | 'lose'): void {
    this.isResolving = true;
    this.setButtonsEnabled(false);

    let rewardMessage = '';
    if (
      result === 'win' &&
      this.opponentTrainer &&
      !this.opponentAlreadyDefeated
    ) {
      const reward = applyVictoryReward(
        this.opponentTrainer,
        addPokemonToPokedex
      );
      rewardMessage = `You received: ${reward.pokemon.name}`;

      if (this.opponentTrainerId) {
        markTrainerDefeated(this.opponentTrainerId);
      }
    }

    const message =
      result === 'win'
        ? `You won against ${this.opponentTrainer?.name}!`
        : `${this.opponentTrainer?.name} defeated you.`;
    this.logText?.setText(message);
    if (rewardMessage) {
      this.add
        .text(24, this.scale.height - 128, rewardMessage, {
          fontSize: '16px',
          color: '#fde68a',
        })
        .setScrollFactor(0);
    }

    const buttonWidth = 200;
    const buttonHeight = 52;
    const x = this.scale.width - buttonWidth - 24;
    const y = this.scale.height - buttonHeight - 24;

    const button = this.add
      .rectangle(0, 0, buttonWidth, buttonHeight, 0x22c55e)
      .setOrigin(0)
      .setStrokeStyle(2, 0x166534);
    const label = this.add.text(20, 14, 'Continue', {
      fontSize: '18px',
      color: '#0f172a',
    });
    const container = this.add.container(x, y, [button, label]);
    container.setSize(buttonWidth, buttonHeight);
    container.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, buttonWidth, buttonHeight),
      Phaser.Geom.Rectangle.Contains
    );
    container.on('pointerdown', () => {
      this.scene.start('WorldScene');
    });
  }

  private updateHpBars(): void {
    if (
      !this.playerPokemon ||
      !this.opponentPokemon ||
      !this.playerHpBar ||
      !this.opponentHpBar
    ) {
      return;
    }

    const playerRatio = this.playerPokemon.hp / this.playerPokemon.maxHp;
    const opponentRatio = this.opponentPokemon.hp / this.opponentPokemon.maxHp;

    this.playerHpBar.width = 200 * Phaser.Math.Clamp(playerRatio, 0, 1);
    this.opponentHpBar.width = 200 * Phaser.Math.Clamp(opponentRatio, 0, 1);

    this.playerHpText?.setText(
      `HP: ${this.playerPokemon.hp} / ${this.playerPokemon.maxHp}`
    );
    this.opponentHpText?.setText(
      `HP: ${this.opponentPokemon.hp} / ${this.opponentPokemon.maxHp}`
    );
  }

  private setButtonsEnabled(enabled: boolean): void {
    this.moveButtons.forEach((button) => {
      button.setAlpha(enabled ? 1 : 0.5);
      if (button.input) {
        button.input.enabled = enabled;
      }
    });
  }
}
